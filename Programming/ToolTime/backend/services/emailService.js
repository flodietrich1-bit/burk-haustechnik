import nodemailer from 'nodemailer';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'P12 Aufmaß <info@p12-aufmass.de>';

// Shared server-side transport for invitations and future transactional emails.
export async function sendEmail({ to, subject, text, html, attachments = [], idempotencyKey }, { resendApiKey = process.env.RESEND_API_KEY, fetchImpl = fetch, fromOverride } = {}) {
  const from = fromOverride || process.env.EMAIL_FROM || process.env.INVITE_FROM_EMAIL || DEFAULT_FROM;
  if (resendApiKey) {
    const response = await fetchImpl(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from, to: [to], subject, text, ...(html ? { html } : {}),
        attachments: attachments.map(({ filename, content }) => ({ filename, content: Buffer.from(content).toString('base64') })),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      let details = '';
      if (typeof response.text === 'function') {
        try {
          const bodyText = await response.text();
          const parsed = JSON.parse(bodyText);
          details = parsed.message || parsed.error || bodyText;
        } catch {}
      }
      if (response.status === 403 && details.toLowerCase().includes('not verified') && from !== 'P12 Aufmaß <onboarding@resend.dev>') {
        console.warn(`Resend domain not verified for sender "${from}". Falling back to onboarding@resend.dev`);
        return sendEmail(
          { to, subject, text, html, attachments, idempotencyKey: idempotencyKey ? `${idempotencyKey}-fallback` : undefined },
          { resendApiKey, fetchImpl, fromOverride: 'P12 Aufmaß <onboarding@resend.dev>' }
        );
      }
      throw new Error(details ? `RESEND_HTTP_${response.status}: ${details}` : `RESEND_HTTP_${response.status}`);
    }
    const result = await response.json();
    if (!result.id) throw new Error('RESEND_RESPONSE_INVALID');
    return { sent: true, provider: 'resend', messageId: result.id };
  }

  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    const result = await transport.sendMail({ from, to, subject, text, html, attachments });
    return { sent: true, provider: 'smtp', messageId: result.messageId };
  }

  return { sent: false, provider: null, messageId: null };
}
