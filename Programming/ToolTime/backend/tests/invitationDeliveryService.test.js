import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareInvitationDelivery } from '../services/invitationDeliveryService.js';

test('invitation includes branded link and generated PDF in the outgoing email', async () => {
  let outgoing;
  const invitation = await prepareInvitationDelivery({
    tenantName: 'Burk Haustechnik', tenantSlug: 'burk', webBaseUrl: 'http://localhost:5173',
    displayName: 'Anna Beispiel', email: 'anna@example.com', role: 'admin', invitedByName: 'P12 Aufmaß',
    shortCode: 'AB-C234', qrToken: 'sample-token', inviteId: 'test-invite',
  }, {
    sendEmailImpl: async message => { outgoing = message; return { sent: true }; },
  });
  assert.equal(invitation.emailSent, true);
  assert.equal(invitation.webInviteUrl, 'http://localhost:5173/BURK/invite?token=sample-token&Firma=BURK');
  assert.match(outgoing.text, /http:\/\/localhost:5173\/BURK\/invite\?token=sample-token&Firma=BURK/);
  assert.match(outgoing.text, /Du wurdest von P12 Aufmaß als Administrator/);
  assert.doesNotMatch(outgoing.text, /AB-C234/);
  assert.match(outgoing.html, /Aktivierung/);
  assert.equal(outgoing.idempotencyKey, 'invitation-test-invite');
  assert.equal(outgoing.attachments[0].filename, 'P12-Aufmass-Einladung.pdf');
  assert.equal(outgoing.attachments[0].content.subarray(0, 4).toString(), '%PDF');
  assert.equal(invitation.pdfBase64, outgoing.attachments[0].content.toString('base64'));
});

test('installer invitation includes the activation code and named inviter', async () => {
  let outgoing;
  await prepareInvitationDelivery({
    tenantName: 'Burk Haustechnik', tenantSlug: 'burk', webBaseUrl: 'http://localhost:5173',
    displayName: 'Max Monteur', email: 'max@example.com', role: 'monteur', invitedByName: 'Florian Burk',
    shortCode: 'AB-C234', qrToken: 'sample-token', inviteId: 'installer-invite',
  }, { sendEmailImpl: async message => { outgoing = message; return { sent: true }; } });
  assert.match(outgoing.text, /Du wurdest von Florian Burk von Burk Haustechnik als Monteur/);
  assert.match(outgoing.text, /AB-C234/);
});

test('failed email leaves invitation details available for manual delivery', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const invitation = await prepareInvitationDelivery({
      tenantName: 'Burk Haustechnik', tenantSlug: 'burk', webBaseUrl: 'http://localhost:5173',
      displayName: 'Anna Beispiel', email: 'anna@example.com', role: 'admin',
      shortCode: 'AB-C234', qrToken: 'sample-token', inviteId: 'test-invite',
    }, {
      sendEmailImpl: async () => { throw new Error('RESEND_HTTP_403'); },
    });
    assert.equal(invitation.emailSent, false);
    assert.equal(invitation.emailError, 'SEND_FAILED');
    assert.ok(invitation.pdfBase64);
    assert.ok(invitation.webInviteUrl);
  } finally {
    console.error = originalError;
  }
});
