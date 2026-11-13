import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../adminFirebase.js';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('seedEmulator may only run against Firebase emulators');
}

const email = 'superadmin@tooltime.local';
const password = 'ToolTime-Local-2026!';
let user;
try { user = await adminAuth.getUserByEmail(email); }
catch (error) {
  if (error.code !== 'auth/user-not-found') throw error;
  const existingMember = await adminDb.collection('tenants/burk/members').where('email', '==', email).limit(1).get();
  const uid = existingMember.empty ? 'local-superadmin' : existingMember.docs[0].id;
  user = await adminAuth.createUser({ uid, email, password, emailVerified: true, displayName: 'Lokaler Systembetreiber' });
}
await adminAuth.setCustomUserClaims(user.uid, { platformRole: 'superadmin' });
await adminDb.doc(`users/${user.uid}`).set({ email, displayName: user.displayName, platformRole: 'superadmin', tenantIds: FieldValue.arrayUnion('burk'), updatedAt: FieldValue.serverTimestamp() }, { merge: true });

const tenantRef = adminDb.doc('tenants/burk');
await tenantRef.set({
  name: 'Burk Haustechnik', slug: 'burk', status: 'active',
  branding: { primaryColor: '#3B82C4', logoPath: null, logoVersion: 0 },
  counters: { activeUsers: 1, projects: 0 }, createdBy: user.uid,
  createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
await tenantRef.collection('members').doc(user.uid).set({
  displayName: user.displayName, email, role: 'admin', status: 'active', defaultLanguage: 'de', assignedProjectIds: [],
  createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

console.log(`Local seed ready: ${email} / ${password}`);
