import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { adminAuth, adminDb } from '../adminFirebase.js';
import app from '../server.js';

test('material request sends one branded email and commercial approval updates addendum and feed', async () => {
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST, 'Firebase emulators are required');
  const suffix = randomUUID().slice(0, 8);
  const tenantId = `workflow-${suffix}`;
  const senderEmail = `sender-${suffix}@example.test`;
  const buyerEmail = `buyer-${suffix}@example.test`;
  const installerEmail = `installer-${suffix}@example.test`;
  const sender = await adminAuth.createUser({ email: senderEmail, password: 'Workflow-Test-2026!' });
  const buyer = await adminAuth.createUser({ email: buyerEmail, password: 'Workflow-Test-2026!' });
  const installer = await adminAuth.createUser({ email: installerEmail, password: 'Workflow-Test-2026!' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const nativeFetch = globalThis.fetch;
  const sent = [];
  globalThis.fetch = async (url, options) => {
    if (String(url) === 'https://api.resend.com/emails') {
      sent.push({ headers: options.headers, body: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ id: 'mock-message-id' }) };
    }
    return nativeFetch(url, options);
  };
  try {
    await adminDb.doc(`tenants/${tenantId}`).set({ name: 'Testfirma', status: 'active', branding: { primaryColor: '#123456' } });
    await adminDb.doc(`tenants/${tenantId}/members/${sender.uid}`).set({ role: 'bauleiter', status: 'active', displayName: 'Bauleiter Test', assignedProjectIds: ['project-1'], email: senderEmail });
    await adminDb.doc(`tenants/${tenantId}/members/${buyer.uid}`).set({ role: 'kaufmaennisch', status: 'active', displayName: 'Einkauf Test', assignedProjectIds: ['project-1'], email: buyerEmail });
    await adminDb.doc(`tenants/${tenantId}/members/${installer.uid}`).set({ role: 'monteur', status: 'active', displayName: 'Monteur Test', assignedProjectIds: ['project-1'], email: installerEmail });
    await adminDb.doc(`tenants/${tenantId}/projects/project-1`).set({ name: 'Projekt <Test>', status: 'in_progress', commercialManagerId: buyer.uid, commercialManager: 'Einkauf Test', commercialManagerEmail: buyerEmail });
    await adminDb.doc(`tenants/${tenantId}/projects/project-1/rooms/room-1`).set({ name: 'Bad EG' });
    await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/add-1`).set({ title: 'Rohr <DN 25>', quantity: 4, qu: 'm', status: 'pending', requestedBy: 'Bauleiter Test', description: 'Mehrbedarf & Prüfung' });
    async function token(email) {
      const result = await nativeFetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Workflow-Test-2026!', returnSecureToken: true }) });
      if (!result.ok) assert.fail(await result.text());
      return (await result.json()).idToken;
    }
    const senderToken = await token(senderEmail);
    const buyerToken = await token(buyerEmail);
    const installerToken = await token(installerEmail);
    const path = `${base}/tenants/${tenantId}/projects/project-1`;
    const orderId = randomUUID();
    async function post(url, bearer, body) {
      const result = await nativeFetch(url, { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: result.status, body: await result.json() };
    }
    const prematureApproval = await post(`${path}/addendums/add-1/commercial-decision`, buyerToken, { decision: 'approved', fulfillment: 'reordered' });
    assert.equal(prematureApproval.status, 409);
    const payload = { recipient: 'primary', subject: 'Materialanfrage', text: 'Bitte bestellen', orderId, addendumIds: ['add-1'], quantities: { 'add-1': 6 } };
    const first = await post(`${path}/material-orders`, senderToken, payload);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(sent.length, 1);
    assert.match(sent[0].body.html, /Materialanfrage im Portal prüfen/);
    assert.match(sent[0].body.html, /Projekt &lt;Test&gt;/);
    assert.match(sent[0].body.html, /item=add-1/);
    assert.equal(sent[0].headers['Idempotency-Key'], `material-order-${orderId}`);
    const second = await post(`${path}/material-orders`, senderToken, payload);
    assert.equal(second.status, 200);
    assert.equal(second.body.alreadySent, true);
    assert.equal(sent.length, 1);
    const requested = await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/add-1`).get();
    assert.equal(requested.get('status'), 'requested');
    assert.equal(requested.get('requestedToEmail'), buyerEmail);
    assert.equal(requested.get('reorderedQty'), 6);
    const denied = await post(`${path}/addendums/add-1/commercial-decision`, senderToken, { decision: 'approved' });
    assert.equal(denied.status, 403);
    const discussion = await post(`${path}/addendums/add-1/commercial-decision`, buyerToken, { decision: 'needs_discussion', note: 'Lieferzeit prüfen' });
    assert.equal(discussion.status, 200, JSON.stringify(discussion.body));
    assert.equal((await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/add-1`).get()).get('commercialNote'), 'Lieferzeit prüfen');
    const followUp = await post(`${path}/material-orders`, senderToken, { ...payload, orderId: randomUUID(), text: 'Alternative prüfen' });
    assert.equal(followUp.status, 200, JSON.stringify(followUp.body));
    assert.equal(sent.length, 2);
    assert.equal((await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/add-1`).get()).get('status'), 'requested');
    const approved = await post(`${path}/addendums/add-1/commercial-decision`, buyerToken, { decision: 'approved', fulfillment: 'reordered' });
    assert.equal(approved.status, 200, JSON.stringify(approved.body));
    const final = await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/add-1`).get();
    assert.equal(final.get('status'), 'approved');
    assert.equal(final.get('approvalType'), 'reordered');
    assert.equal(final.get('commercialApprovedBy'), 'Einkauf Test');
    assert.ok(final.get('commercialApprovedAt'));
    const feed = await adminDb.collection(`tenants/${tenantId}/projects/project-1/bookings`).get();
    assert.equal(feed.size, 4);
    await adminDb.doc(`tenants/${tenantId}/members/${sender.uid}`).update({ role: 'admin' });
    const allEvents = await nativeFetch(`${base}/tenants/${tenantId}/material-events`, { headers: { Authorization: `Bearer ${senderToken}` } });
    assert.equal(allEvents.status, 200);
    assert.equal((await allEvents.json()).length, 4);
    const memberPath = `${base}/tenants/${tenantId}/members/${installer.uid}`;
    const invalidPhone = await nativeFetch(memberPath, { method: 'PATCH', headers: { Authorization: `Bearer ${senderToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '<script>' }) });
    assert.equal(invalidPhone.status, 400);
    const memberUpdate = await nativeFetch(memberPath, { method: 'PATCH', headers: { Authorization: `Bearer ${senderToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '+49 171 2345678', defaultLanguage: 'ro', assignedProjectIds: ['project-1'] }) });
    assert.equal(memberUpdate.status, 200, await memberUpdate.text());
    const updatedMember = await adminDb.doc(`tenants/${tenantId}/members/${installer.uid}`).get();
    assert.equal(updatedMember.get('phone'), '+49 171 2345678');
    assert.equal(updatedMember.get('defaultLanguage'), 'ro');
    const unplanned = await post(`${path}/addendums/unplanned`, installerToken, { title: 'Zusätzlicher Filter', quantity: 1, qu: 'Stk', roomId: 'room-1', note: 'Vor Ort nötig' });
    assert.equal(unplanned.status, 201, JSON.stringify(unplanned.body));
    assert.equal(unplanned.body.createdByRole, 'monteur');
    assert.equal(unplanned.body.roomName, 'Bad EG');
    assert.equal((await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/${unplanned.body.id}`).get()).get('status'), 'pending');
    const unplannedDiscussion = await post(`${path}/addendums/${unplanned.body.id}/unplanned-discussion`, buyerToken, { note: 'Bitte Einbauort abstimmen' });
    assert.equal(unplannedDiscussion.status, 200, JSON.stringify(unplannedDiscussion.body));
    assert.equal((await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/${unplanned.body.id}`).get()).get('commercialNote'), 'Bitte Einbauort abstimmen');
    await adminDb.doc(`tenants/${tenantId}/members/${sender.uid}`).update({ role: 'bauleiter' });
    const unplannedReply = await post(`${path}/addendums/${unplanned.body.id}/unplanned-discussion`, senderToken, { note: 'Im Bad EG montiert' });
    assert.equal(unplannedReply.status, 200, JSON.stringify(unplannedReply.body));
    const discussedItem = await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/${unplanned.body.id}`).get();
    assert.equal(discussedItem.get('status'), 'pending');
    assert.deepEqual(discussedItem.get('discussionHistory').map(entry => entry.note), ['Bitte Einbauort abstimmen', 'Im Bad EG montiert']);
    await adminDb.doc(`tenants/${tenantId}/members/${sender.uid}`).update({ role: 'admin' });
    await adminDb.doc(`tenants/${tenantId}/projects/project-1/aufmasse/auf-1`).set({
      aufmassNumber: 'AUF-2026-001', projectName: 'Projekt Test', dateFrom: '2026-11-01', dateTo: '2026-11-14',
      createdBy: 'Bauleiter Test', summaryItems: [], roomsData: [], totalPeriodVolume: 0,
    });
    const sendAufmass = await post(`${path}/aufmasse/auf-1/send`, senderToken, { recipientRole: 'kaufmaennisch', excelFilename: 'Aufmass_AUF-2026-001.xlsx', excelBase64: Buffer.from('PK\x03\x04test').toString('base64') });
    assert.equal(sendAufmass.status, 200, JSON.stringify(sendAufmass.body));
    assert.equal(sendAufmass.body.recipientEmail, buyerEmail);
    const aufmassMail = sent.at(-1).body;
    assert.deepEqual(aufmassMail.to, [buyerEmail]);
    assert.deepEqual(aufmassMail.attachments.map(attachment => attachment.filename), ['Aufmass_AUF-2026-001.pdf', 'Aufmass_AUF-2026-001.xlsx']);
    assert.ok(Buffer.from(aufmassMail.attachments[0].content, 'base64').subarray(0, 4).equals(Buffer.from('%PDF')));
    assert.ok(Buffer.from(aufmassMail.attachments[1].content, 'base64').subarray(0, 4).equals(Buffer.from('PK\x03\x04')));
    await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/add-2`).set({ title: 'Rohr aus Lager', type: 'material', quantity: 3, qu: 'm', status: 'pending' });
    const stockApproval = await post(`${path}/addendums/add-2/commercial-decision`, senderToken, { decision: 'approved', fulfillment: 'in_stock' });
    assert.equal(stockApproval.status, 200, JSON.stringify(stockApproval.body));
    const stockItem = await adminDb.doc(`tenants/${tenantId}/projects/project-1/addendums/add-2`).get();
    assert.equal(stockItem.get('status'), 'approved');
    assert.equal(stockItem.get('approvalType'), 'in_stock');
    assert.equal(stockItem.get('commercialApprovedBy'), 'Bauleiter Test');
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise(resolve => server.close(resolve));
    await adminDb.recursiveDelete(adminDb.doc(`tenants/${tenantId}`));
    await Promise.all([adminAuth.deleteUser(sender.uid), adminAuth.deleteUser(buyer.uid), adminAuth.deleteUser(installer.uid)]);
  }
});
