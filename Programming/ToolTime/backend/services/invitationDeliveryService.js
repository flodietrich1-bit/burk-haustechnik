import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

function pdfBuffer({ tenantName, displayName, shortCode, qrDataUrl }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 }); const chunks = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.fontSize(24).fillColor('#1C2A3B').text('Willkommen bei P12 Aufmaß');
    doc.moveDown().fontSize(12).fillColor('#334155').text(`Hallo ${displayName},`);
    doc.moveDown(0.5).text(`${tenantName} hat Sie zu P12 Aufmaß eingeladen. Nutzen Sie den Aktivierungscode für Ihren Zugang.`);
    doc.moveDown().image(qrDataUrl, { fit: [220, 220], align: 'center' });
    doc.moveDown().fontSize(26).fillColor('#0F172A').text(shortCode, { align: 'center', characterSpacing: 3 });
    doc.moveDown().fontSize(10).fillColor('#64748B').text('Diese Einladung ist einmalig und sieben Tage gültig.', { align: 'center' });
    doc.end();
  });
}

export async function prepareInvitationDelivery({ tenantName, displayName, email, role, shortCode, qrToken }) {
  const deepLink = `tooltime://invite?token=${encodeURIComponent(qrToken)}`;
  const qrDataUrl = await QRCode.toDataURL(deepLink, { errorCorrectionLevel: 'M', margin: 2, width: 600 });
  const pdf = await pdfBuffer({ tenantName, displayName, shortCode, qrDataUrl });
  const webBaseUrl = process.env.INVITE_WEB_BASE_URL?.replace(/\/$/, '');
  const webInviteUrl = role !== 'monteur' && webBaseUrl ? `${webBaseUrl}/invite?token=${encodeURIComponent(qrToken)}` : null;
  if (email && process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({ from: process.env.INVITE_FROM_EMAIL, to: email, subject: `${tenantName}: Einladung zu P12 Aufmaß`, text: `Willkommen bei P12 Aufmaß. Ihr Aktivierungscode lautet ${shortCode}.${webInviteUrl ? `\n\nAktivieren Sie Ihren Firmenzugang über diesen einmalig gültigen Link: ${webInviteUrl}` : ''}\n\nDie Einladung ist sieben Tage gültig.`, attachments: [{ filename: 'P12-Aufmass-Einladung.pdf', content: pdf }] });
  }
  return { qrDataUrl, pdfBase64: pdf.toString('base64'), emailSent: Boolean(email && process.env.SMTP_HOST) };
}
