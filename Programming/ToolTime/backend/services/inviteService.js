import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../adminFirebase.js';

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function inviteSecret() {
  const secret = process.env.INVITE_HMAC_SECRET;
  if (!secret || secret.length < 32) throw new Error('INVITE_HMAC_SECRET must contain at least 32 characters');
  return secret;
}

function hmac(value) {
  return crypto.createHmac('sha256', inviteSecret()).update(value).digest('hex');
}

function randomCode() {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, value => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function inspectWebInvite({ code, qrToken, email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedCode = normalizeCode(code);
  if (!normalizedEmail || (!qrToken && normalizedCode.length !== 6)) return null;
  const isQr = Boolean(qrToken);
  const lookupHash = hmac(isQr ? `qr:${qrToken}` : `short:${normalizedCode}`);
  const indexCollection = isQr ? 'inviteQrIndex' : 'inviteCodeIndex';
  const indexSnap = await adminDb.doc(`${indexCollection}/${lookupHash}`).get();
  if (!indexSnap.exists) return null;
  const { tenantId, inviteId, generation } = indexSnap.data();
  const [tenantSnap, inviteSnap] = await Promise.all([
    adminDb.doc(`tenants/${tenantId}`).get(),
    adminDb.doc(`tenants/${tenantId}/invites/${inviteId}`).get(),
  ]);
  const invite = inviteSnap.data();
  if (!tenantSnap.exists || tenantSnap.get('status') !== 'active' || !inviteSnap.exists
    || invite.status !== 'pending' || invite.generation !== generation
    || invite.expiresAt.toDate() <= new Date() || invite.role === 'monteur'
    || invite.emailNormalized !== normalizedEmail) return null;
  try {
    await adminAuth.getUserByEmail(normalizedEmail);
    return { accountExists: true };
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    return { accountExists: false };
  }
}

export function formatShortCode(code) {
  return `${code.slice(0, 2)}-${code.slice(2)}`;
}

export async function createInvite({ tenantId, actorUid, input }) {
  const inviteRef = adminDb.collection(`tenants/${tenantId}/invites`).doc();
  const shortCode = randomCode();
  const qrToken = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  const generation = 1;
  const lookupHash = hmac(`short:${shortCode}`);

  const invite = {
    displayName: String(input.displayName || '').trim(),
    emailNormalized: input.email ? String(input.email).trim().toLowerCase() : null,
    role: input.role,
    defaultLanguage: input.defaultLanguage || 'de',
    assignedProjectIds: Array.isArray(input.assignedProjectIds) ? input.assignedProjectIds : [],
    status: 'pending', generation, sendCount: 0,
    shortCodeHash: lookupHash,
    qrTokenHash: hmac(`qr:${qrToken}`),
    createdByUid: actorUid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt,
  };

  const batch = adminDb.batch();
  batch.create(inviteRef, invite);
  batch.create(adminDb.doc(`inviteCodeIndex/${lookupHash}`), { tenantId, inviteId: inviteRef.id, generation });
  batch.create(adminDb.doc(`inviteQrIndex/${invite.qrTokenHash}`), { tenantId, inviteId: inviteRef.id, generation });
  await batch.commit();

  return { inviteId: inviteRef.id, shortCode: formatShortCode(shortCode), qrToken, expiresAt: expiresAt.toISOString() };
}

export async function redeemInvite({ code, qrToken, installationId, webUid }) {
  const normalized = normalizeCode(code);
  const isQr = Boolean(qrToken);
  const lookupHash = isQr ? hmac(`qr:${qrToken}`) : hmac(`short:${normalized}`);
  const indexCollection = isQr ? 'inviteQrIndex' : 'inviteCodeIndex';
  const indexSnap = await adminDb.doc(`${indexCollection}/${lookupHash}`).get();
  if (!indexSnap.exists) return null;

  const { tenantId, inviteId, generation } = indexSnap.data();
  const inviteRef = adminDb.doc(`tenants/${tenantId}/invites/${inviteId}`);
  if (webUid && (await adminDb.doc(`tenants/${tenantId}`).get()).get('status') !== 'active') return null;
  const webUser = webUid ? await adminAuth.getUser(webUid) : null;
  const reservationId = crypto.randomUUID();
  let inviteData;

  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(inviteRef);
    const invite = snap.data();
    if (!snap.exists || invite.status !== 'pending' || invite.generation !== generation || invite.expiresAt.toDate() <= new Date()) {
      throw Object.assign(new Error('INVITE_INVALID'), { publicCode: 'INVITE_INVALID' });
    }
    if (webUid && (!invite.emailNormalized || invite.role === 'monteur')) throw Object.assign(new Error('INVITE_INVALID'), { publicCode: 'INVITE_INVALID' });
    if (webUser && webUser.email?.toLowerCase() !== invite.emailNormalized) throw Object.assign(new Error('INVITE_EMAIL_MISMATCH'), { publicCode: 'INVITE_EMAIL_MISMATCH' });
    inviteData = invite;
    tx.update(inviteRef, { status: 'redeeming', reservationId, ...(installationId ? { installationId } : {}), updatedAt: FieldValue.serverTimestamp() });
  });

  try {
    let user;
    if (webUid) {
      user = webUser;
    } else if (inviteData.emailNormalized) {
      try { user = await adminAuth.getUserByEmail(inviteData.emailNormalized); }
      catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        user = await adminAuth.createUser({ email: inviteData.emailNormalized, displayName: inviteData.displayName, emailVerified: false });
      }
    } else {
      const deterministicUid = `invite_${inviteId}`;
      try { user = await adminAuth.getUser(deterministicUid); }
      catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        user = await adminAuth.createUser({ uid: deterministicUid, displayName: inviteData.displayName });
      }
    }

    const memberRef = adminDb.doc(`tenants/${tenantId}/members/${user.uid}`);
    const deviceRef = installationId ? memberRef.collection('devices').doc(installationId) : null;
    const batch = adminDb.batch();
    batch.set(memberRef, {
      displayName: inviteData.displayName, email: inviteData.emailNormalized, role: inviteData.role,
      defaultLanguage: inviteData.defaultLanguage, assignedProjectIds: inviteData.assignedProjectIds,
      status: 'active', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (deviceRef) batch.set(deviceRef, { status: 'active', activatedAt: FieldValue.serverTimestamp(), lastSeenAt: FieldValue.serverTimestamp() });
    batch.update(inviteRef, { status: 'redeemed', redeemedAt: FieldValue.serverTimestamp(), redeemedByUid: user.uid, updatedAt: FieldValue.serverTimestamp() });
    batch.delete(adminDb.doc(`inviteCodeIndex/${inviteData.shortCodeHash}`));
    batch.delete(adminDb.doc(`inviteQrIndex/${inviteData.qrTokenHash}`));
    await batch.commit();

    return webUid ? { tenantId } : { customToken: await adminAuth.createCustomToken(user.uid), tenantId, requiresLocalPinSetup: true };
  } catch (error) {
    await inviteRef.update({ status: 'pending', reservationId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }).catch(() => {});
    throw error;
  }
}
