import { adminAuth, adminDb } from '../adminFirebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const email = process.env.BOOTSTRAP_SUPERADMIN_EMAIL;
const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;
if (!email || !password || password.length < 12) throw new Error('Set BOOTSTRAP_SUPERADMIN_EMAIL and a password with at least 12 characters');

let user;
try { user = await adminAuth.getUserByEmail(email); }
catch (error) {
  if (error.code !== 'auth/user-not-found') throw error;
  user = await adminAuth.createUser({ email, password, emailVerified: true, displayName: 'ToolTime Systembetreiber' });
}
await adminAuth.setCustomUserClaims(user.uid, { platformRole: 'superadmin' });

const tenantRef = adminDb.doc('tenants/burk');
if (!(await tenantRef.get()).exists) {
  await tenantRef.create({ name: 'Burk Haustechnik', slug: 'burk', status: 'active', branding: { primaryColor: '#3B82C4', logoPath: null, logoVersion: 0 }, counters: { activeUsers: 0, projects: 0 }, createdBy: user.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
console.log('Bootstrap complete. Sign out and in again to refresh custom claims.');
