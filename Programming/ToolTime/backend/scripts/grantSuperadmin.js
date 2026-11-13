// One-time production setup. Create the Firebase Authentication user first.
const projectId = process.env.FIREBASE_PROJECT_ID;
const confirmedProjectId = process.env.CONFIRM_PROJECT_ID;
const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();

if (!projectId || projectId !== confirmedProjectId) {
  throw new Error('Set FIREBASE_PROJECT_ID and matching CONFIRM_PROJECT_ID for the intended project.');
}
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('This command is for the live Firebase project; disable local emulators.');
}
if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Set SUPERADMIN_EMAIL to the existing Firebase Authentication user.');

const { adminAuth, adminDb } = await import('../adminFirebase.js');
const { FieldValue } = await import('firebase-admin/firestore');
const user = await adminAuth.getUserByEmail(email);
if (user.disabled) throw new Error('The Firebase Authentication user is disabled.');

await adminAuth.setCustomUserClaims(user.uid, { ...user.customClaims, platformRole: 'superadmin' });
await adminDb.doc(`users/${user.uid}`).set({
  email: user.email || email,
  displayName: user.displayName || null,
  platformRole: 'superadmin',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
console.log(`Superadmin role granted to ${email} in ${projectId}. Sign out and sign in again to refresh the token.`);
