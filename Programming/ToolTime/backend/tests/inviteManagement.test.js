import assert from 'node:assert/strict';
import test from 'node:test';
import { createInvite, cleanupRedeemedInvites } from '../services/inviteService.js';
import { adminDb } from '../adminFirebase.js';

test('createInvite assigns project and stores metadata', async () => {
  const tenantId = `test_tenant_${Date.now()}`;
  const invite = await createInvite({
    tenantId,
    actorUid: 'admin-tester',
    input: {
      displayName: 'Max Monteur',
      email: 'max@example.com',
      role: 'monteur',
      projectId: 'proj_alpha_1',
      projectName: 'Projekt Alpha',
    },
  });

  assert.ok(invite.inviteId);
  assert.ok(invite.shortCode);

  const docSnap = await adminDb.doc(`tenants/${tenantId}/invites/${invite.inviteId}`).get();
  assert.ok(docSnap.exists);
  const data = docSnap.data();
  assert.equal(data.displayName, 'Max Monteur');
  assert.equal(data.projectId, 'proj_alpha_1');
  assert.deepEqual(data.assignedProjectIds, ['proj_alpha_1']);
  assert.equal(data.projectName, 'Projekt Alpha');

  // Clean up
  await docSnap.ref.delete();
});

test('cleanupRedeemedInvites removes redeemed invites older than 30 days', async () => {
  const tenantId = `test_tenant_cleanup_${Date.now()}`;
  const oldRedeemedDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const recentRedeemedDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const oldDoc = adminDb.collection(`tenants/${tenantId}/invites`).doc('old_redeemed');
  await oldDoc.set({
    displayName: 'Old User',
    status: 'redeemed',
    redeemedAt: oldRedeemedDate,
  });

  const recentDoc = adminDb.collection(`tenants/${tenantId}/invites`).doc('recent_redeemed');
  await recentDoc.set({
    displayName: 'Recent User',
    status: 'redeemed',
    redeemedAt: recentRedeemedDate,
  });

  const pendingDoc = adminDb.collection(`tenants/${tenantId}/invites`).doc('pending_invite');
  await pendingDoc.set({
    displayName: 'Pending User',
    status: 'pending',
    createdAt: oldRedeemedDate,
  });

  const deleted = await cleanupRedeemedInvites(tenantId);
  assert.equal(deleted, 1);

  const [oldCheck, recentCheck, pendingCheck] = await Promise.all([
    oldDoc.get(),
    recentDoc.get(),
    pendingDoc.get(),
  ]);

  assert.equal(oldCheck.exists, false, 'Old redeemed invite should be deleted');
  assert.equal(recentCheck.exists, true, 'Recent redeemed invite should still exist');
  assert.equal(pendingCheck.exists, true, 'Pending invite should not be deleted');

  // Clean up remaining
  await Promise.all([recentDoc.delete(), pendingDoc.delete()]);
});
