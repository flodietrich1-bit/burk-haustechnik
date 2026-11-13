import assert from 'node:assert/strict';
import test from 'node:test';
import { sendEmail } from '../services/emailService.js';

test('Resend receives invitation PDF as base64 attachment', async () => {
  let request;
  const result = await sendEmail({
    to: 'recipient@example.com', subject: 'Einladung', text: 'Aktivierungslink',
    attachments: [{ filename: 'Einladung.pdf', content: Buffer.from('%PDF-test') }],
    idempotencyKey: 'invitation-test',
  }, {
    resendApiKey: 'test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ id: 'mail-test' }) };
    },
  });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.equal(request.options.headers['Idempotency-Key'], 'invitation-test');
  const body = JSON.parse(request.options.body);
  assert.equal(body.from, 'P12 Aufmaß <info@p12-aufmass.de>');
  assert.deepEqual(body.to, ['recipient@example.com']);
  assert.deepEqual(body.attachments, [{ filename: 'Einladung.pdf', content: Buffer.from('%PDF-test').toString('base64') }]);
  assert.deepEqual(result, { sent: true, provider: 'resend', messageId: 'mail-test' });
});

test('Resend rejection reports an HTTP code without leaking credentials', async () => {
  await assert.rejects(
    sendEmail({ to: 'recipient@example.com', subject: 'Test', text: 'Test' }, {
      resendApiKey: 'test-key', fetchImpl: async () => ({ ok: false, status: 403 }),
    }),
    { message: 'RESEND_HTTP_403' },
  );
});
