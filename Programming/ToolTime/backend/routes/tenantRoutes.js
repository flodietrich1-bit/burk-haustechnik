import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminStorage } from '../adminFirebase.js';
import { authenticateFirebaseUser, requireSuperadmin, requireTenantRole } from '../middleware/auth.js';
import { createInvite } from '../services/inviteService.js';
import { prepareInvitationDelivery } from '../services/invitationDeliveryService.js';
import { sendEmail } from '../services/emailService.js';
import { ensurePublicSlug, publicSlugForName } from '../services/publicTenantService.js';

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
  const basePublicSlug = publicSlugForName(name) || 'firma';
  const reserved = new Set(['admin', 'invite', 'login', 't', 'api']);
  let publicSlug = basePublicSlug;
  if (reserved.has(publicSlug) || (await adminDb.doc(`tenantAliases/${publicSlug}`).get()).exists || (await adminDb.doc(`tenants/${publicSlug}`).get()).exists) {
    publicSlug = `${basePublicSlug.slice(0, 49)}-${randomBytes(4).toString('hex')}`;
  }
  const batch = adminDb.batch();
  batch.create(ref, {
    name: String(name).trim(), slug, publicSlug, status: 'active',
    branding: { primaryColor, secondaryColor, logoPath: null, logoZoom: 1, logoVersion: 0 },
    company: { ...sanitizedCompany, legalName: sanitizedCompany.legalName || String(name).trim() }, counters: { activeUsers: 0, projects: 0 },
    createdBy: req.auth.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  batch.create(adminDb.doc(`tenantAliases/${publicSlug}`), { tenantId: ref.id });
  await batch.commit();
  res.status(201).json({ id: ref.id, publicSlug });
});

tenantRouter.get('/:tenantId', requireTenantRole('admin', 'bauleiter', 'kaufmaennisch', 'monteur'), async (req, res) => {
  const tenantRef = adminDb.doc(`tenants/${req.params.tenantId}`);
  await ensurePublicSlug(tenantRef);
  const snap = await tenantRef.get();
  if (!snap.exists) return res.status(404).json({ code: 'TENANT_NOT_FOUND' });
  res.json({ id: snap.id, ...snap.data() });
});

tenantRouter.get('/:tenantId/projects', requireTenantRole('admin', 'bauleiter', 'kaufmaennisch', 'monteur'), async (req, res) => {
  const snap = await adminDb.collection(`tenants/${req.params.tenantId}/projects`).get();
  const uid = req.auth.uid;
  const email = String(req.auth.email || '').toLowerCase();
  const role = req.tenantMember?.role;
  const assigned = new Set(req.tenantMember?.assignedProjectIds || []);
  const fields = role === 'bauleiter'
    ? ['projectManagerId', 'deputyProjectManagerId', 'projectManagerEmail', 'deputyProjectManagerEmail']
    : role === 'kaufmaennisch'
      ? ['commercialManagerId', 'deputyCommercialManagerId', 'commercialManagerEmail', 'deputyCommercialManagerEmail']
      : [];
  const projects = snap.docs.filter(doc => {
    if (req.auth.platformRole === 'superadmin' || role === 'admin' || assigned.has(doc.id)) return true;
    const project = doc.data();
    if (role === 'monteur' && (project.assignedMonteurIds || []).includes(uid)) return true;
    return fields.some(field => field.endsWith('Email')
      ? email && String(project[field] || '').toLowerCase() === email
      : project[field] === uid);
  }).map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(projects);
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
  const members = await tenantRef.collection('members').get();
  const indexes = adminDb.batch();
  for (const invite of invites.docs) {
    if (invite.get('shortCodeHash')) indexes.delete(adminDb.doc(`inviteCodeIndex/${invite.get('shortCodeHash')}`));
    if (invite.get('qrTokenHash')) indexes.delete(adminDb.doc(`inviteQrIndex/${invite.get('qrTokenHash')}`));
  }
  if (tenant.get('publicSlug')) indexes.delete(adminDb.doc(`tenantAliases/${tenant.get('publicSlug')}`));
  await adminStorage.bucket().deleteFiles({ prefix: `tenants/${req.params.tenantId}/` });
  await adminDb.recursiveDelete(tenantRef);
  await Promise.all(members.docs.map(async member => {
    const profile = adminDb.doc(`users/${member.id}`);
    if ((await profile.get()).exists) await profile.update({ tenantIds: FieldValue.arrayRemove(req.params.tenantId), updatedAt: FieldValue.serverTimestamp() });
  }));
  await indexes.commit();
  res.json({ success: true });
});

tenantRouter.post('/:tenantId/projects/:projectId/material-orders', requireTenantRole('admin', 'bauleiter'), async (req, res) => {
  const { tenantId, projectId } = req.params;
  const { recipient = 'primary', subject, text, orderId } = req.body || {};
  if (!['primary', 'deputy'].includes(recipient) || typeof subject !== 'string' || !subject.trim() || subject.length > 250
    || typeof text !== 'string' || !text.trim() || text.length > 20000 || !/^[a-f0-9-]{36}$/i.test(String(orderId || ''))) {
    return res.status(400).json({ code: 'MATERIAL_ORDER_INVALID' });
  }
  const projectRef = adminDb.doc(`tenants/${tenantId}/projects/${projectId}`);
  const project = await projectRef.get();
  if (!project.exists) return res.status(404).json({ code: 'PROJECT_NOT_FOUND' });
  if (req.auth.platformRole !== 'superadmin' && req.tenantMember?.role !== 'admin'
    && !req.tenantMember?.assignedProjectIds?.includes(projectId)) return res.status(403).json({ code: 'PROJECT_ACCESS_DENIED' });
  const recipientName = recipient === 'deputy' ? project.get('deputyCommercialManager') : project.get('commercialManager');
  const recipientEmail = recipient === 'deputy' ? project.get('deputyCommercialManagerEmail') : project.get('commercialManagerEmail');
  const recipientId = recipient === 'deputy' ? project.get('deputyCommercialManagerId') : project.get('commercialManagerId');
  if (!recipientEmail || !/^\S+@\S+\.\S+$/.test(recipientEmail)) return res.status(409).json({ code: 'COMMERCIAL_MANAGER_MISSING' });
  const memberRef = adminDb.collection(`tenants/${tenantId}/members`);
  const member = recipientId
    ? (await memberRef.doc(recipientId).get()).data()
    : (await memberRef.where('email', '==', recipientEmail.toLowerCase()).limit(1).get()).docs[0]?.data();
  if (!member || member.status !== 'active' || !['admin', 'kaufmaennisch'].includes(member.role)
    || member.email?.toLowerCase() !== recipientEmail.toLowerCase()) return res.status(409).json({ code: 'COMMERCIAL_MANAGER_MISSING' });
  try {
    const delivery = await sendEmail({
      to: recipientEmail, subject: subject.trim(), text: text.trim(),
      idempotencyKey: `material-order-${orderId}`,
    });
    if (!delivery.sent) return res.status(503).json({ code: 'EMAIL_NOT_CONFIGURED' });
    res.json({ sent: true, recipientName: recipientName || recipientEmail, recipientEmail, messageId: delivery.messageId });
  } catch (error) {
    console.error('Material order email failed:', error.message);
    res.status(502).json({ code: 'EMAIL_SEND_FAILED' });
  }
});

tenantRouter.get('/:tenantId/members', requireTenantRole('admin'), async (req, res) => {
  const snap = await adminDb.collection(`tenants/${req.params.tenantId}/members`).get();
  const members = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  members.sort((left, right) => String(left.displayName || left.email || left.id).localeCompare(String(right.displayName || right.email || right.id), 'de'));
  res.json(members);
});

tenantRouter.patch('/:tenantId/members/:uid', requireTenantRole('admin'), async (req, res) => {
  const memberRef = adminDb.doc(`tenants/${req.params.tenantId}/members/${req.params.uid}`);
  const current = await memberRef.get();
  if (!current.exists) return res.status(404).json({ code: 'MEMBER_NOT_FOUND' });
  const update = { updatedAt: FieldValue.serverTimestamp() };
  if (req.body?.displayName !== undefined) {
    const displayName = String(req.body.displayName).trim();
    if (!displayName || displayName.length > 120) return res.status(400).json({ code: 'MEMBER_NAME_INVALID' });
    update.displayName = displayName;
  }
  if (req.body?.role) {
    if (!['admin', 'bauleiter', 'kaufmaennisch', 'monteur'].includes(req.body.role)) return res.status(400).json({ code: 'ROLE_INVALID' });
    update.role = req.body.role;
  }
  if (req.body?.status) {
    if (!['active', 'inactive'].includes(req.body.status)) return res.status(400).json({ code: 'MEMBER_STATUS_INVALID' });
    update.status = req.body.status;
  }
  if (Array.isArray(req.body?.assignedProjectIds)) update.assignedProjectIds = req.body.assignedProjectIds.map(String);
  if (current.get('role') === 'admin' && current.get('status') === 'active' && ((update.role && update.role !== 'admin') || update.status === 'inactive')) {
    const admins = await memberRef.parent.where('role', '==', 'admin').get();
    if (admins.docs.filter(doc => doc.get('status') === 'active').length <= 1) return res.status(409).json({ code: 'LAST_ADMIN_REQUIRED' });
  }
  await memberRef.update(update);
  if (req.body?.status === 'inactive') await adminAuth.revokeRefreshTokens(req.params.uid);
  res.json({ success: true });
});

tenantRouter.delete('/:tenantId/members/:uid', requireTenantRole('admin'), async (req, res) => {
  const memberRef = adminDb.doc(`tenants/${req.params.tenantId}/members/${req.params.uid}`);
  const current = await memberRef.get();
  if (!current.exists) return res.status(404).json({ code: 'MEMBER_NOT_FOUND' });
  if (req.auth.uid === req.params.uid && req.auth.platformRole !== 'superadmin') return res.status(409).json({ code: 'SELF_REMOVAL_DENIED' });
  if (current.get('role') === 'admin' && current.get('status') === 'active') {
    const admins = await memberRef.parent.where('role', '==', 'admin').get();
    if (admins.docs.filter(doc => doc.get('status') === 'active').length <= 1) return res.status(409).json({ code: 'LAST_ADMIN_REQUIRED' });
  }
  await adminDb.recursiveDelete(memberRef);
  const profile = adminDb.doc(`users/${req.params.uid}`);
  if ((await profile.get()).exists) await profile.update({ tenantIds: FieldValue.arrayRemove(req.params.tenantId), updatedAt: FieldValue.serverTimestamp() });
  await adminAuth.revokeRefreshTokens(req.params.uid).catch(error => {
    if (error.code !== 'auth/user-not-found') throw error;
  });
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
  const tenantRef = adminDb.doc(`tenants/${req.params.tenantId}`);
  const tenantSlug = await ensurePublicSlug(tenantRef);
  const tenant = (await tenantRef.get()).data();
  const delivery = await prepareInvitationDelivery({ tenantName: tenant?.name || req.params.tenantId, tenantSlug, webBaseUrl: process.env.NODE_ENV === 'production' ? undefined : req.get('origin'), displayName: req.body.displayName, email: req.body.email, role: req.body.role, shortCode: result.shortCode, qrToken: result.qrToken, inviteId: result.inviteId, invitedByName: req.auth.platformRole === 'superadmin' ? 'P12 Aufmaß' : req.tenantMember?.displayName || 'Administrator' });
  await tenantRef.collection('invites').doc(result.inviteId).update({ emailSent: delivery.emailSent, emailError: delivery.emailError, sendCount: req.body.email ? 1 : 0, updatedAt: FieldValue.serverTimestamp() });
  res.status(201).json({ ...result, ...delivery });
});

tenantRouter.get('/:tenantId/invites', requireTenantRole('admin'), async (req, res) => {
  const snap = await adminDb.collection(`tenants/${req.params.tenantId}/invites`).orderBy('createdAt', 'desc').limit(100).get();
  res.json(snap.docs.map(doc => {
    const data = doc.data();
    return { id: doc.id, displayName: data.displayName, email: data.emailNormalized, role: data.role, status: data.status, emailSent: data.emailSent || false, emailError: data.emailError || null, expiresAt: data.expiresAt?.toDate?.().toISOString(), createdAt: data.createdAt?.toDate?.().toISOString(), redeemedAt: data.redeemedAt?.toDate?.().toISOString() };
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
  const tenantRef = adminDb.doc(`tenants/${req.params.tenantId}`);
  const tenantSlug = await ensurePublicSlug(tenantRef);
  const tenant = (await tenantRef.get()).data();
  const delivery = await prepareInvitationDelivery({ tenantName: tenant?.name || req.params.tenantId, tenantSlug, webBaseUrl: process.env.NODE_ENV === 'production' ? undefined : req.get('origin'), displayName: old.displayName, email: old.emailNormalized, role: old.role, shortCode: result.shortCode, qrToken: result.qrToken, inviteId: result.inviteId, invitedByName: req.auth.platformRole === 'superadmin' ? 'P12 Aufmaß' : req.tenantMember?.displayName || 'Administrator' });
  await tenantRef.collection('invites').doc(result.inviteId).update({ emailSent: delivery.emailSent, emailError: delivery.emailError, sendCount: old.emailNormalized ? 1 : 0, updatedAt: FieldValue.serverTimestamp() });
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
