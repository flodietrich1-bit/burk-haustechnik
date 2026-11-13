// Removes the old, global demo data. Tenant records, branding and Firebase Auth accounts are preserved.
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminStorage } from '../adminFirebase.js';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId || projectId !== process.env.CONFIRM_PROJECT_ID) {
  throw new Error('Set FIREBASE_PROJECT_ID and matching CONFIRM_PROJECT_ID.');
}
if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('This script targets the live project; use the emulator reset for local data.');
}

const apply = process.env.APPLY_LEGACY_CLEANUP === 'yes';
const tenantId = String(process.env.RESET_TENANT_ID || '').trim();
const superadminEmail = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
if (tenantId && (!/^[a-z0-9-]{2,64}$/.test(tenantId) || !/^\S+@\S+\.\S+$/.test(superadminEmail))) {
  throw new Error('Set a valid RESET_TENANT_ID and SUPERADMIN_EMAIL to reset demo data inside a tenant.');
}
const protectedUser = tenantId ? await adminAuth.getUserByEmail(superadminEmail) : null;
const authUids = new Set();
let pageToken;
do {
  const page = await adminAuth.listUsers(1000, pageToken);
  page.users.forEach(user => authUids.add(user.uid));
  pageToken = page.pageToken;
} while (pageToken);

const globalCollections = ['projects', 'bookings', 'addendums'];
const targets = [];
for (const name of globalCollections) {
  const snapshot = await adminDb.collection(name).get();
  console.log(`${name}: ${snapshot.size} legacy root documents`);
  targets.push(...snapshot.docs.map(doc => doc.ref));
}

const users = await adminDb.collection('users').get();
const legacyUsers = users.docs.filter(doc => !authUids.has(doc.id));
const passwordProfiles = users.docs.filter(doc => authUids.has(doc.id) && Object.hasOwn(doc.data(), 'password'));
console.log(`users: ${legacyUsers.length} legacy documents without Firebase Auth UID`);
console.log(`users: ${passwordProfiles.length} Auth-linked profiles with a legacy password field`);
console.log(`Protected Firebase Auth UIDs: ${authUids.size}`);

let tenantProjects = [];
let tenantInvites = [];
let tenantMembers = [];
if (tenantId) {
  const tenantRef = adminDb.doc(`tenants/${tenantId}`);
  if (!(await tenantRef.get()).exists) {
    console.log(`tenants/${tenantId}: not present; no tenant demo data to remove`);
  } else {
    const [projects, invites, members] = await Promise.all([
      tenantRef.collection('projects').get(), tenantRef.collection('invites').get(), tenantRef.collection('members').get(),
    ]);
    tenantProjects = projects.docs;
    tenantInvites = invites.docs;
    tenantMembers = members.docs.filter(doc => doc.id !== protectedUser.uid);
    console.log(`tenants/${tenantId}: ${tenantProjects.length} projects, ${tenantInvites.length} invites, ${tenantMembers.length} members to remove`);
    console.log(`Protected tenant member: ${protectedUser.uid}`);
  }
}

if (!apply) {
  console.log('Preview only. Set APPLY_LEGACY_CLEANUP=yes to remove the listed demo documents.');
} else {
  for (const ref of [...targets, ...legacyUsers.map(doc => doc.ref)]) {
    await adminDb.recursiveDelete(ref);
  }
  for (const profile of passwordProfiles) {
    await profile.ref.update({ password: FieldValue.delete() });
  }
  for (const invite of tenantInvites) {
    if (invite.get('shortCodeHash')) await adminDb.doc(`inviteCodeIndex/${invite.get('shortCodeHash')}`).delete();
    if (invite.get('qrTokenHash')) await adminDb.doc(`inviteQrIndex/${invite.get('qrTokenHash')}`).delete();
    await adminDb.recursiveDelete(invite.ref);
  }
  for (const project of tenantProjects) await adminDb.recursiveDelete(project.ref);
  for (const member of tenantMembers) {
    await adminDb.recursiveDelete(member.ref);
    const profile = adminDb.doc(`users/${member.id}`);
    if ((await profile.get()).exists) {
      await profile.update({ tenantIds: FieldValue.arrayRemove(tenantId), updatedAt: FieldValue.serverTimestamp() });
    }
  }
  if (tenantId) await adminStorage.bucket().deleteFiles({ prefix: `tenants/${tenantId}/projects/` });
  console.log('Demo data removed. Company branding and Firebase Auth accounts were preserved.');
}
