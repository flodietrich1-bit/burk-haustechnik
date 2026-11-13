import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { sendEmail } from './emailService.js';

const roleNames = { admin: 'Administrator', bauleiter: 'Bauleiter', kaufmaennisch: 'kaufmännischer Mitarbeiter', monteur: 'Monteur' };
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function pdfBuffer({ tenantName, displayName, role, shortCode, webInviteUrl, qrDataUrl }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 }); const chunks = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.fontSize(24).fillColor('#1C2A3B').text('Willkommen bei P12 Aufmaß');
    doc.moveDown().fontSize(12).fillColor('#334155').text(`Hallo ${displayName},`);
    doc.moveDown(0.5).text(`${tenantName} hat Sie als ${roleNames[role]} zu P12 Aufmaß eingeladen.`);
    doc.moveDown().image(qrDataUrl, { fit: [220, 220], align: 'center' });
    if (role === 'monteur') doc.moveDown().fontSize(26).fillColor('#0F172A').text(shortCode, { align: 'center', characterSpacing: 3 });
    else doc.moveDown().fontSize(10).fillColor('#334155').text(`Aktivierungslink: ${webInviteUrl}`, { align: 'center', link: webInviteUrl });
    doc.moveDown().fontSize(10).fillColor('#64748B').text('Diese Einladung ist einmalig und sieben Tage gültig.', { align: 'center' });
    doc.end();
  });
}

export async function prepareInvitationDelivery({ tenantName, tenantSlug, webBaseUrl, displayName, email, role, shortCode, qrToken, inviteId, invitedByName = 'P12 Aufmaß' }, { sendEmailImpl = sendEmail } = {}) {
  const deepLink = `tooltime://invite?token=${encodeURIComponent(qrToken)}`;
  const baseUrl = (process.env.INVITE_WEB_BASE_URL || webBaseUrl || 'https://p12-aufmass.de').replace(/\/$/, '');
  const companyPath = encodeURIComponent(tenantSlug.toUpperCase());
  const webInviteUrl = role !== 'monteur' ? `${baseUrl}/${companyPath}/invite?token=${encodeURIComponent(qrToken)}&Firma=${companyPath}` : null;
  const qrDataUrl = await QRCode.toDataURL(webInviteUrl || deepLink, { errorCorrectionLevel: 'M', margin: 2, width: 600 });
  const pdf = await pdfBuffer({ tenantName, displayName, role, shortCode, webInviteUrl, qrDataUrl });
  let emailSent = false;
  let emailError = null;
  if (email) {
    const sender = invitedByName === 'P12 Aufmaß' ? 'P12 Aufmaß' : `${invitedByName} von ${tenantName}`;
    const introduction = `Du wurdest von ${sender} als ${roleNames[role]} zu P12 Aufmaß eingeladen.`;
    const text = role === 'monteur'
      ? `Hallo ${displayName},\n\n${introduction}\n\nÖffne die TT-App und scanne den QR-Code in der angehängten PDF. Dein Aktivierungscode lautet: ${shortCode}\n\nDie Einladung ist einmalig und sieben Tage gültig.\n\nViele Grüße\nP12 Aufmaß`
      : `Hallo ${displayName},\n\n${introduction}\n\nNimm deine Einladung über diesen Link an: ${webInviteUrl}\n\nAuf der Aktivierungsseite legst du dein Passwort fest. Du brauchst keinen zusätzlichen Code.\n\nDie Einladung ist einmalig und sieben Tage gültig.\n\nViele Grüße\nP12 Aufmaß`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f1a4d"><h1>Einladung zu P12 Aufmaß</h1><p>Hallo ${escapeHtml(displayName)},</p><p>${escapeHtml(introduction)}</p>${role === 'monteur' ? `<p>Öffne die TT-App und scanne den QR-Code in der angehängten PDF.</p><p>Dein Aktivierungscode: <strong>${escapeHtml(shortCode)}</strong></p>` : `<p><a href="${escapeHtml(webInviteUrl)}" style="display:inline-block;background:#7437d9;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Einladung annehmen</a></p><p>Auf der Aktivierungsseite legst du dein Passwort fest. Ein zusätzlicher Code ist nicht nötig.</p>`}<p>Die Einladung ist einmalig und sieben Tage gültig.</p><p>Viele Grüße<br>P12 Aufmaß</p></div>`;
    try {
      const result = await sendEmailImpl({
        to: email, subject: `${tenantName}: Einladung zu P12 Aufmaß`, text, html,
        attachments: [{ filename: 'P12-Aufmass-Einladung.pdf', content: pdf }],
        idempotencyKey: `invitation-${inviteId}`,
      });
      emailSent = result.sent;
      if (!result.sent) emailError = 'NOT_CONFIGURED';
    } catch (error) {
      emailError = 'SEND_FAILED';
      console.error('Invitation email delivery failed:', error?.message || 'UNKNOWN_ERROR');
    }
  }
  return { qrDataUrl, webInviteUrl, pdfBase64: pdf.toString('base64'), emailSent, emailError };
}
