import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-tooltime', firestore: { host: '127.0.0.1', port: 8085, rules } });
await env.clearFirestore();

await env.withSecurityRulesDisabled(async context => {
  const db = context.firestore();
  await setDoc(doc(db, 'tenants/burk'), { name: 'Burk', status: 'active' });
  await setDoc(doc(db, 'tenants/burk/members/admin-1'), { role: 'admin', status: 'active', assignedProjectIds: [] });
  await setDoc(doc(db, 'tenants/burk/members/monteur-1'), { role: 'monteur', status: 'active', assignedProjectIds: ['project-1'] });
  await setDoc(doc(db, 'tenants/burk/projects/project-1'), { name: 'Projekt 1', status: 'in_progress' });
  await setDoc(doc(db, 'tenants/other'), { name: 'Other', status: 'active' });
});

test('unauthenticated users cannot read tenants', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'tenants/burk')));
});

test('superadmin can read and update every tenant', async () => {
  const db = env.authenticatedContext('super-1', { platformRole: 'superadmin' }).firestore();
  await assertSucceeds(getDoc(doc(db, 'tenants/other')));
  await assertSucceeds(updateDoc(doc(db, 'tenants/other'), { status: 'suspended' }));
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

test('suspended tenant blocks ordinary members', async () => {
  await env.withSecurityRulesDisabled(async context => updateDoc(doc(context.firestore(), 'tenants/burk'), { status: 'suspended' }));
  await assertFails(getDoc(doc(env.authenticatedContext('admin-1').firestore(), 'tenants/burk/projects/project-1')));
});

test.after(async () => { await env.clearFirestore(); await env.cleanup(); });
