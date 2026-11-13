import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const emulatorPort = Number((process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':').pop());
const env = await initializeTestEnvironment({ projectId: 'demo-tooltime', firestore: { host: '127.0.0.1', port: emulatorPort, rules } });
await env.clearFirestore();

await env.withSecurityRulesDisabled(async context => {
  const db = context.firestore();
  await setDoc(doc(db, 'tenants/burk'), { name: 'Burk', status: 'active' });
  await setDoc(doc(db, 'tenants/burk/members/admin-1'), { role: 'admin', status: 'active', assignedProjectIds: [] });
  await setDoc(doc(db, 'tenants/burk/members/monteur-1'), { role: 'monteur', status: 'active', assignedProjectIds: ['project-1'] });
  await setDoc(doc(db, 'tenants/burk/members/bauleiter-1'), { role: 'bauleiter', status: 'active', assignedProjectIds: [] });
  await setDoc(doc(db, 'tenants/burk/members/kaufmann-1'), { role: 'kaufmaennisch', status: 'active', assignedProjectIds: [] });
  await setDoc(doc(db, 'tenants/burk/members/other-bauleiter'), { role: 'bauleiter', status: 'active', assignedProjectIds: [] });
  await setDoc(doc(db, 'tenants/burk/projects/project-1'), { name: 'Projekt 1', status: 'in_progress' });
  await setDoc(doc(db, 'tenants/burk/projects/project-2'), { name: 'Projekt 2', status: 'in_progress', projectManagerId: 'bauleiter-1', commercialManagerId: 'kaufmann-1' });
  await setDoc(doc(db, 'tenants/other'), { name: 'Other', status: 'active' });
  await setDoc(doc(db, 'users/super-firestore'), { platformRole: 'superadmin', email: 'admin@example.com' });
  await setDoc(doc(db, 'users/ordinary'), { email: 'ordinary@example.com' });
});

test('unauthenticated users cannot read tenants', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'tenants/burk')));
});

test('superadmin can read and update every tenant', async () => {
  const db = env.authenticatedContext('super-1', { platformRole: 'superadmin' }).firestore();
  await assertSucceeds(getDoc(doc(db, 'tenants/other')));
  await assertSucceeds(updateDoc(doc(db, 'tenants/other'), { status: 'suspended' }));
});

test('Firestore user profile grants superadmin access without a token claim', async () => {
  const db = env.authenticatedContext('super-firestore').firestore();
  await assertSucceeds(getDoc(doc(db, 'users/super-firestore')));
  await assertSucceeds(getDoc(doc(db, 'tenants/other')));
  await assertSucceeds(updateDoc(doc(db, 'tenants/other'), { status: 'active' }));
});

test('ordinary users cannot write their own global role or inspect another profile', async () => {
  const db = env.authenticatedContext('ordinary').firestore();
  await assertSucceeds(getDoc(doc(db, 'users/ordinary')));
  await assertFails(updateDoc(doc(db, 'users/ordinary'), { platformRole: 'superadmin' }));
  await assertFails(getDoc(doc(db, 'users/super-firestore')));
  await assertFails(getDoc(doc(db, 'tenants/other')));
});

test('tenant admin can access own tenant and all projects but cannot change membership directly', async () => {
  const db = env.authenticatedContext('admin-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'tenants/burk')));
  await assertSucceeds(getDoc(doc(db, 'tenants/burk/projects/project-1')));
  await assertFails(updateDoc(doc(db, 'tenants/burk/members/monteur-1'), { role: 'admin' }));
  await assertFails(getDoc(doc(db, 'tenants/other')));
});

test('assigned monteur can read project and create own booking only', async () => {
  const db = env.authenticatedContext('monteur-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'tenants/burk/projects/project-1')));
  await assertSucceeds(setDoc(doc(db, 'tenants/burk/projects/project-1/bookings/own'), { createdByUid: 'monteur-1' }));
  await assertFails(setDoc(doc(db, 'tenants/burk/projects/project-1/bookings/forged'), { createdByUid: 'other-user' }));
});

test('selected project manager and commercial manager can read their project', async () => {
  for (const uid of ['bauleiter-1', 'kaufmann-1']) {
    const db = env.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, 'tenants/burk/projects/project-2')));
    await assertFails(getDoc(doc(db, 'tenants/burk/projects/project-1')));
  }
  await assertFails(getDoc(doc(env.authenticatedContext('other-bauleiter').firestore(), 'tenants/burk/projects/project-2')));
});

test('material request and commercial approval are server-owned transitions', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'tenants/burk/projects/project-1/addendums/requested'), { status: 'requested', title: 'Rohr', requestedToEmail: 'kaufmann@example.org' });
    await setDoc(doc(context.firestore(), 'tenants/burk/projects/project-1/addendums/pending'), { status: 'pending', title: 'Rohr' });
    await setDoc(doc(context.firestore(), 'tenants/burk/projects/project-1/addendums/approved'), { status: 'approved', title: 'Filter', commercialApprovedBy: 'Einkauf' });
  });
  const admin = env.authenticatedContext('admin-1').firestore();
  const bauleiter = env.authenticatedContext('bauleiter-1').firestore();
  await assertFails(updateDoc(doc(admin, 'tenants/burk/projects/project-1/addendums/requested'), { status: 'approved' }));
  await assertFails(updateDoc(doc(admin, 'tenants/burk/projects/project-1/addendums/pending'), { status: 'requested' }));
  await assertFails(updateDoc(doc(admin, 'tenants/burk/projects/project-1/addendums/pending'), { commercialApprovedBy: 'Fake' }));
  await assertFails(setDoc(doc(admin, 'tenants/burk/projects/project-1/materialOrders/forged'), { sent: true }));
  await assertFails(updateDoc(doc(bauleiter, 'tenants/burk/projects/project-1/addendums/pending'), { status: 'requested' }));
  await assertSucceeds(updateDoc(doc(admin, 'tenants/burk/projects/project-1/addendums/pending'), { status: 'approved', approvalType: 'in_stock' }));
  await assertSucceeds(updateDoc(doc(admin, 'tenants/burk/projects/project-1/addendums/approved'), { lvPositionId: 'new-position' }));
});

test('suspended tenant blocks ordinary members', async () => {
  await env.withSecurityRulesDisabled(async context => updateDoc(doc(context.firestore(), 'tenants/burk'), { status: 'suspended' }));
  await assertFails(getDoc(doc(env.authenticatedContext('admin-1').firestore(), 'tenants/burk/projects/project-1')));
});

test.after(async () => { await env.clearFirestore(); await env.cleanup(); });
