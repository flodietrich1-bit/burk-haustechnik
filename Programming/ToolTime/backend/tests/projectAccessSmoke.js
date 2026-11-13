import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { adminAuth, adminDb } from '../adminFirebase.js';

assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST, 'Firebase emulators required');
const tenantId = `access-test-${randomUUID()}`;
const tenantRef = adminDb.doc(`tenants/${tenantId}`);
const password = 'Access-Test-2026!';
const users = [];

try {
  await tenantRef.set({ name: 'Access Test', status: 'active' });
  const people = [
    { role: 'bauleiter', email: `bauleiter-${randomUUID()}@example.test` },
    { role: 'kaufmaennisch', email: `kaufmann-${randomUUID()}@example.test` },
    { role: 'bauleiter', email: `unrelated-${randomUUID()}@example.test` },
  ];
  for (const person of people) {
    const user = await adminAuth.createUser({ email: person.email, password });
    users.push(user);
    await tenantRef.collection('members').doc(user.uid).set({ role: person.role, status: 'active', email: person.email, assignedProjectIds: [] });
  }
  await tenantRef.collection('projects').doc('selected').set({
    name: 'Selected Project', status: 'in_progress', projectManagerId: users[0].uid,
    commercialManagerId: users[1].uid,
  });
  await tenantRef.collection('projects').doc('other').set({ name: 'Other Project', status: 'in_progress' });

  for (let i = 0; i < people.length; i++) {
    const signIn = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: people[i].email, password, returnSecureToken: true }),
    });
    assert.equal(signIn.ok, true);
    const { idToken } = await signIn.json();
    const response = await fetch(`http://127.0.0.1:3001/api/tenants/${tenantId}/projects`, {
      headers: { authorization: `Bearer ${idToken}` },
    });
    assert.equal(response.ok, true, response.ok ? '' : await response.text());
    const projects = await response.json();
    assert.deepEqual(projects.map(project => project.id), i < 2 ? ['selected'] : []);
  }
  console.log('Project access smoke passed for selected Bauleiter, kaufmännische Leitung and unrelated user.');
} finally {
  await adminDb.recursiveDelete(tenantRef);
  await Promise.all(users.map(user => adminAuth.deleteUser(user.uid)));
}
