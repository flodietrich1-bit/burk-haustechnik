import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../adminFirebase.js';

// Create the account in Firebase Authentication first. Never store a password here.
const projectId = process.env.FIREBASE_PROJECT_ID;
const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
const tenantId = String(process.env.BOOTSTRAP_TENANT_ID || 'burk').trim();
if (!projectId || projectId !== process.env.CONFIRM_PROJECT_ID) throw new Error('Set FIREBASE_PROJECT_ID and matching CONFIRM_PROJECT_ID.');
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Use seed:local for emulators.');
if (!/^\S+@\S+\.\S+$/.test(email) || !/^[a-z0-9-]{2,64}$/.test(tenantId)) throw new Error('Set SUPERADMIN_EMAIL and a valid BOOTSTRAP_TENANT_ID.');

const user = await adminAuth.getUserByEmail(email);
if (user.disabled) throw new Error('The Firebase Authentication user is disabled.');
const tenantRef = adminDb.doc(`tenants/${tenantId}`);
const existingTenant = await tenantRef.get();

// Preserve existing branding, company details and projects.
if (!existingTenant.exists) {
  if (tenantId !== 'burk') throw new Error('Tenant does not exist; create it through the admin API first.');
  await tenantRef.create({
    name: 'Burk Haustechnik', slug: 'burk', publicSlug: 'burk', status: 'active',
    branding: { primaryColor: '#7437D9', secondaryColor: '#1F1A4D', logoPath: null, logoVersion: 0 },
    counters: { activeUsers: 1, projects: 0 }, createdBy: user.uid,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
}

const batch = adminDb.batch();
batch.set(adminDb.doc(`users/${user.uid}`), {
  email: user.email || email, displayName: user.displayName || email,
  platformRole: 'superadmin', tenantIds: FieldValue.arrayUnion(tenantId),
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
batch.set(tenantRef.collection('members').doc(user.uid), {
  email: user.email || email, displayName: user.displayName || email,
  role: 'admin', status: 'active', defaultLanguage: 'de', assignedProjectIds: [],
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });
await batch.commit();
await adminAuth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), platformRole: 'superadmin' });
console.log(`Setup complete for ${email} (${user.uid}) in project ${projectId}, tenant ${tenantId}. Sign out and in again.`);
