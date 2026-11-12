import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminStorage } from '../adminFirebase.js';
import { authenticateFirebaseUser, requireSuperadmin, requireTenantRole } from '../middleware/auth.js';
import { createInvite } from '../services/inviteService.js';
import { prepareInvitationDelivery } from '../services/invitationDeliveryService.js';

export const tenantRouter = Router();
tenantRouter.use(authenticateFirebaseUser);

tenantRouter.get('/memberships/me', async (req, res) => {
  const tenants = await adminDb.collection('tenants').get();
  if (req.auth.platformRole === 'superadmin') {
    return res.json(tenants.docs.map(doc => ({ tenantId: doc.id, tenantName: doc.get('name'), role: 'admin', status: doc.get('status') })));
  }
  const memberRefs = tenants.docs.map(doc => adminDb.doc(`tenants/${doc.id}/members/${req.auth.uid}`));
  const members = memberRefs.length ? await adminDb.getAll(...memberRefs) : [];
  res.json(members.filter(snap => snap.exists && snap.get('status') === 'active').map(snap => {
    const tenantId = snap.ref.parent.parent.id;
    const tenant = tenants.docs.find(doc => doc.id === tenantId);
    return { tenantId, tenantName: tenant?.get('name'), ...snap.data() };
  }));
});

tenantRouter.get('/', requireSuperadmin, async (_req, res) => {
  const snap = await adminDb.collection('tenants').orderBy('name').get();
  const tenants = await Promise.all(snap.docs.map(async doc => {
    const [members, projects] = await Promise.all([
      doc.ref.collection('members').select('status').get(),
      doc.ref.collection('projects').select('status').get(),
    ]);
    const activeUsers = members.docs.filter(member => member.get('status') === 'active').length;
    const activeProjects = projects.docs.filter(project => ['draft', 'in_progress'].includes(project.get('status'))).length;
    const data = doc.data();
    return { id: doc.id, ...data, counters: { activeUsers, inactiveUsers: members.size - activeUsers, activeProjects, inactiveProjects: projects.size - activeProjects }, company: data.company || {} };
  }));
  res.json(tenants);
});

tenantRouter.post('/', requireSuperadmin, async (req, res) => {
  const { name, primaryColor = '#7437D9', secondaryColor = '#1F1A4D', company = {} } = req.body || {};
  const sanitizedCompany = sanitizeCompany(company);
  if (!String(name || '').trim() || !/^#[0-9A-F]{6}$/i.test(primaryColor) || !/^#[0-9A-F]{6}$/i.test(secondaryColor)
    || !sanitizedCompany.contactName || !sanitizedCompany.phone || !/^\S+@\S+\.\S+$/.test(sanitizedCompany.email)) {
    return res.status(400).json({ code: 'TENANT_INPUT_INVALID' });
  }
  const slug = `firma-${randomBytes(8).toString('hex')}`;
  const ref = adminDb.doc(`tenants/${slug}`);
  await ref.create({
    name: String(name).trim(), slug, status: 'active',
    branding: { primaryColor, secondaryColor, logoPath: null, logoZoom: 1, logoVersion: 0 },
    company: { ...sanitizedCompany, legalName: sanitizedCompany.legalName || String(name).trim() }, counters: { activeUsers: 0, projects: 0 },
    createdBy: req.auth.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ id: ref.id });
});

tenantRouter.get('/:tenantId', requireTenantRole('admin', 'bauleiter', 'kaufmaennisch', 'monteur'), async (req, res) => {
  const snap = await adminDb.doc(`tenants/${req.params.tenantId}`).get();
  if (!snap.exists) return res.status(404).json({ code: 'TENANT_NOT_FOUND' });
  res.json({ id: snap.id, ...snap.data() });
});

tenantRouter.patch('/:tenantId', requireTenantRole('admin'), async (req, res) => {
  const tenantRef = adminDb.doc(`tenants/${req.params.tenantId}`);
  const current = await tenantRef.get();
  if (!current.exists) return res.status(404).json({ code: 'TENANT_NOT_FOUND' });
  const update = { updatedAt: FieldValue.serverTimestamp() };
  if (req.body?.name) update.name = String(req.body.name).trim();
  if (req.body?.company) {
    update.company = sanitizeCompany(req.body.company);
    if (update.company.legalName) update.name = update.company.legalName;
  }
  if (req.body?.branding) {
    const branding = { ...current.get('branding'), ...req.body.branding };
    if (!/^#[0-9A-F]{6}$/i.test(branding.primaryColor || '') || !/^#[0-9A-F]{6}$/i.test(branding.secondaryColor || '#1F1A4D')
      || !Number.isFinite(Number(branding.logoZoom ?? 1)) || Number(branding.logoZoom ?? 1) < 0.5 || Number(branding.logoZoom ?? 1) > 3
      || (branding.logoPath && !String(branding.logoPath).startsWith(`tenants/${req.params.tenantId}/branding/`))) return res.status(400).json({ code: 'BRANDING_INVALID' });
    update.branding = { ...branding, secondaryColor: branding.secondaryColor || '#1F1A4D', logoZoom: Number(branding.logoZoom ?? 1), logoVersion: Date.now() };
  }
  if (req.body?.status) {
    if (req.auth.platformRole !== 'superadmin' || !['active', 'suspended', 'archived'].includes(req.body.status)) return res.status(403).json({ code: 'STATUS_CHANGE_DENIED' });
    update.status = req.body.status;
  }
  await tenantRef.update(update);
  res.json({ success: true });
});

tenantRouter.delete('/:tenantId', requireSuperadmin, async (req, res) => {
  const tenantRef = adminDb.doc(`tenants/${req.params.tenantId}`);
  const tenant = await tenantRef.get();
  if (!tenant.exists) return res.status(404).json({ code: 'TENANT_NOT_FOUND' });
  const invites = await tenantRef.collection('invites').get();
  const indexes = adminDb.batch();
  for (const invite of invites.docs) {
    if (invite.get('shortCodeHash')) indexes.delete(adminDb.doc(`inviteCodeIndex/${invite.get('shortCodeHash')}`));
    if (invite.get('qrTokenHash')) indexes.delete(adminDb.doc(`inviteQrIndex/${invite.get('qrTokenHash')}`));
  }
  await adminStorage.bucket().deleteFiles({ prefix: `tenants/${req.params.tenantId}/` });
  await adminDb.recursiveDelete(tenantRef);
  await indexes.commit();
  res.json({ success: true });
});

tenantRouter.get('/:tenantId/members', requireTenantRole('admin'), async (req, res) => {
  const snap = await adminDb.collection(`tenants/${req.params.tenantId}/members`).get();
  const members = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  members.sort((left, right) => String(left.displayName || left.email || left.id).localeCompare(String(right.displayName || right.email || right.id), 'de'));
  res.json(members);
});

tenantRouter.patch('/:tenantId/members/:uid', requireTenantRole('admin'), async (req, res) => {
  const update = { updatedAt: FieldValue.serverTimestamp() };
  if (req.body?.role) {
    if (!['admin', 'bauleiter', 'kaufmaennisch', 'monteur'].includes(req.body.role)) return res.status(400).json({ code: 'ROLE_INVALID' });
    update.role = req.body.role;
  }
  if (req.body?.status) {
    if (!['active', 'inactive'].includes(req.body.status)) return res.status(400).json({ code: 'MEMBER_STATUS_INVALID' });
    update.status = req.body.status;
  }
  if (Array.isArray(req.body?.assignedProjectIds)) update.assignedProjectIds = req.body.assignedProjectIds.map(String);
  await adminDb.doc(`tenants/${req.params.tenantId}/members/${req.params.uid}`).update(update);
  if (req.body?.status === 'inactive') await adminAuth.revokeRefreshTokens(req.params.uid);
  res.json({ success: true });
});

tenantRouter.post('/:tenantId/invites', requireTenantRole('admin'), async (req, res) => {
  const allowedRoles = new Set(['admin', 'bauleiter', 'kaufmaennisch', 'monteur']);
  if (!req.body?.displayName || !allowedRoles.has(req.body?.role) || (req.body.role !== 'monteur' && !req.body.email)) {
    return res.status(400).json({ code: 'INVITE_INPUT_INVALID' });
  }
  if (req.body.role !== 'admin') {
    const tenantRef = adminDb.doc(`tenants/${req.params.tenantId}`);
    const [admins, adminInvites] = await Promise.all([
      tenantRef.collection('members').where('role', '==', 'admin').get(),
      tenantRef.collection('invites').where('role', '==', 'admin').get(),
    ]);
    const hasAdmin = admins.docs.some(doc => doc.get('status') === 'active') || adminInvites.docs.some(doc => doc.get('status') === 'pending' && doc.get('expiresAt')?.toDate?.() > new Date());
    if (!hasAdmin) return res.status(409).json({ code: 'ADMIN_INVITE_REQUIRED' });
  }
  const result = await createInvite({ tenantId: req.params.tenantId, actorUid: req.auth.uid, input: req.body });
  const tenant = (await adminDb.doc(`tenants/${req.params.tenantId}`).get()).data();
  const delivery = await prepareInvitationDelivery({ tenantName: tenant?.name || req.params.tenantId, displayName: req.body.displayName, email: req.body.email, role: req.body.role, shortCode: result.shortCode, qrToken: result.qrToken });
  res.status(201).json({ ...result, ...delivery });
});

tenantRouter.get('/:tenantId/invites', requireTenantRole('admin'), async (req, res) => {
  const snap = await adminDb.collection(`tenants/${req.params.tenantId}/invites`).orderBy('createdAt', 'desc').limit(100).get();
  res.json(snap.docs.map(doc => {
    const data = doc.data();
    return { id: doc.id, displayName: data.displayName, email: data.emailNormalized, role: data.role, status: data.status, expiresAt: data.expiresAt?.toDate?.().toISOString(), createdAt: data.createdAt?.toDate?.().toISOString(), redeemedAt: data.redeemedAt?.toDate?.().toISOString() };
  }));
});

tenantRouter.post('/:tenantId/invites/:inviteId/revoke', requireTenantRole('admin'), async (req, res) => {
  const ref = adminDb.doc(`tenants/${req.params.tenantId}/invites/${req.params.inviteId}`);
  const snap = await ref.get(); const invite = snap.data();
  if (!snap.exists || invite.status === 'redeemed') return res.status(409).json({ code: 'INVITE_NOT_REVOCABLE' });
  const batch = adminDb.batch();
  batch.update(ref, { status: 'revoked', revokedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  if (invite.shortCodeHash) batch.delete(adminDb.doc(`inviteCodeIndex/${invite.shortCodeHash}`));
  if (invite.qrTokenHash) batch.delete(adminDb.doc(`inviteQrIndex/${invite.qrTokenHash}`));
  await batch.commit(); res.json({ success: true });
});

tenantRouter.post('/:tenantId/invites/:inviteId/resend', requireTenantRole('admin'), async (req, res) => {
  const oldRef = adminDb.doc(`tenants/${req.params.tenantId}/invites/${req.params.inviteId}`);
  const oldSnap = await oldRef.get(); const old = oldSnap.data();
  if (!oldSnap.exists || old.status === 'redeemed') return res.status(409).json({ code: 'INVITE_NOT_RESENDABLE' });
  const revokeBatch = adminDb.batch();
  revokeBatch.update(oldRef, { status: 'revoked', revokedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  if (old.shortCodeHash) revokeBatch.delete(adminDb.doc(`inviteCodeIndex/${old.shortCodeHash}`));
  if (old.qrTokenHash) revokeBatch.delete(adminDb.doc(`inviteQrIndex/${old.qrTokenHash}`));
  await revokeBatch.commit();
  const result = await createInvite({ tenantId: req.params.tenantId, actorUid: req.auth.uid, input: { ...old, email: old.emailNormalized } });
  const tenant = (await adminDb.doc(`tenants/${req.params.tenantId}`).get()).data();
  const delivery = await prepareInvitationDelivery({ tenantName: tenant?.name || req.params.tenantId, displayName: old.displayName, email: old.emailNormalized, role: old.role, shortCode: result.shortCode, qrToken: result.qrToken });
  res.status(201).json({ ...result, ...delivery });
});

function sanitizeCompany(input = {}) {
  const text = key => String(input[key] || '').trim().slice(0, 200);
  const billingSameAsContact = input.billingSameAsContact === true;
  return {
    legalName: text('legalName'), street: text('street'), postalCode: text('postalCode'), city: text('city'),
    country: text('country') || 'Deutschland', phone: text('phone'), email: text('email'), website: text('website'),
    billingSameAsContact, billingName: billingSameAsContact ? text('contactName') : text('billingName'),
    billingEmail: billingSameAsContact ? text('email') : text('billingEmail'),
    billingPhone: billingSameAsContact ? text('phone') : text('billingPhone'), vatId: text('vatId'), contactName: text('contactName'),
  };
}
