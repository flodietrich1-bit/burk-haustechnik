import crypto from 'crypto';
import { adminDb } from '../adminFirebase.js';

function key(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function penaltyMs(attempts) {
  if (attempts >= 5) return 24 * 60 * 60 * 1000;
  if (attempts >= 4) return 60 * 60 * 1000;
  if (attempts >= 3) return 10 * 60 * 1000;
  return 0;
}

export async function consumeInviteAttempt({ ip, installationId, codeFingerprint }) {
  const bucketIds = [key(`ip:${ip}`), key(`install:${installationId}`), key(`code:${codeFingerprint}`)];
  const now = Date.now();
  let retryAfterMs = 0;
  let wasAlreadyLocked = false;
  await adminDb.runTransaction(async tx => {
    const refs = bucketIds.map(id => adminDb.doc(`rateLimits/${id}`));
    const snapshots = await tx.getAll(...refs);
    for (let index = 0; index < refs.length; index++) {
      const ref = refs[index];
      const snap = snapshots[index];
      const current = snap.data() || {};
      const existingRetry = Math.max(0, Number(current.lockedUntilMs || 0) - now);
      if (existingRetry > 0) {
        wasAlreadyLocked = true;
        retryAfterMs = Math.max(retryAfterMs, existingRetry);
        continue;
      }
      const windowExpired = !current.windowStartedAt || now - current.windowStartedAt.toMillis() > 24 * 60 * 60 * 1000;
      const attempts = windowExpired ? 1 : Number(current.attempts || 0) + 1;
      const lockedUntilMs = Math.max(Number(current.lockedUntilMs || 0), now + penaltyMs(attempts));
      tx.set(ref, { attempts, windowStartedAt: windowExpired ? new Date(now) : current.windowStartedAt, lockedUntilMs, expiresAt: new Date(now + 48 * 60 * 60 * 1000) }, { merge: true });
    }
  });
  return { allowed: !wasAlreadyLocked, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
}

export async function clearInviteAttempt({ ip, installationId, codeFingerprint }) {
  const ids = [key(`ip:${ip}`), key(`install:${installationId}`), key(`code:${codeFingerprint}`)];
  const batch = adminDb.batch();
  ids.forEach(id => batch.delete(adminDb.doc(`rateLimits/${id}`)));
  await batch.commit();
}
