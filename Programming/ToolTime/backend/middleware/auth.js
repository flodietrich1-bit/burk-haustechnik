import { adminAuth, adminDb } from '../adminFirebase.js';

export async function authenticateFirebaseUser(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ code: 'AUTH_REQUIRED' });

  try {
    req.auth = await adminAuth.verifyIdToken(match[1], true);
    if (req.auth.platformRole !== 'superadmin') {
      const profile = await adminDb.doc(`users/${req.auth.uid}`).get();
      if (profile.get('platformRole') === 'superadmin') req.auth.platformRole = 'superadmin';
    }
    next();
  } catch {
    res.status(401).json({ code: 'AUTH_INVALID' });
  }
}

export function requireSuperadmin(req, res, next) {
  if (req.auth?.platformRole !== 'superadmin') {
    return res.status(403).json({ code: 'SUPERADMIN_REQUIRED' });
  }
  next();
}

export function requireTenantRole(...allowedRoles) {
  return async (req, res, next) => {
    const tenantId = req.params.tenantId || req.body?.tenantId;
    if (!tenantId || !req.auth?.uid) return res.status(403).json({ code: 'TENANT_ACCESS_DENIED' });
    if (req.auth.platformRole === 'superadmin') return next();

    const [tenantSnap, memberSnap] = await Promise.all([
      adminDb.doc(`tenants/${tenantId}`).get(),
      adminDb.doc(`tenants/${tenantId}/members/${req.auth.uid}`).get(),
    ]);
    const member = memberSnap.data();
    if (!tenantSnap.exists || tenantSnap.get('status') !== 'active' || !memberSnap.exists || member?.status !== 'active' || !allowedRoles.includes(member.role)) {
      return res.status(403).json({ code: 'TENANT_ACCESS_DENIED' });
    }
    req.tenantMember = member;
    next();
  };
}
