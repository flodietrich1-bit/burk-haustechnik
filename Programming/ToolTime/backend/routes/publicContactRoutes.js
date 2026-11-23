import express from 'express';
import rateLimit from 'express-rate-limit';
import { adminDb } from '../adminFirebase.js';
import { sendEmail } from '../services/emailService.js';

export const publicContactRouter = express.Router();

// Rate limiting: max 5 contact submissions per 15 minutes per IP
const contactRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    error: 'Zu viele Anfragen in kurzer Zeit. Bitte versuche es in wenigen Minuten erneut.'
  }
});

publicContactRouter.post('/', contactRateLimiter, async (req, res) => {
  try {
    const { name, email, company = '', phone = '', message } = req.body || {};

    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedCompany = String(company || '').trim();
    const trimmedPhone = String(phone || '').trim();
    const trimmedMessage = String(message || '').trim();

    // Validation
    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({ code: 'INVALID_NAME', error: 'Bitte gib deinen vollständigen Namen an.' });
    }
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      return res.status(400).json({ code: 'INVALID_EMAIL', error: 'Bitte gib eine gültige E-Mail-Adresse an.' });
    }
    if (!trimmedMessage || trimmedMessage.length < 10) {
      return res.status(400).json({ code: 'INVALID_MESSAGE', error: 'Die Nachricht muss mindestens 10 Zeichen lang sein.' });
    }

    const createdAt = new Date().toISOString();
    const inquiryData = {
      name: trimmedName,
      email: trimmedEmail,
      company: trimmedCompany,
      phone: trimmedPhone,
      message: trimmedMessage,
      createdAt,
      status: 'new',
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    // 1. Persist inquiry in Firestore
    let inquiryId = null;
    try {
      const docRef = await adminDb.collection('contactInquiries').add(inquiryData);
      inquiryId = docRef.id;
    } catch (dbErr) {
      console.warn('[Contact] Firestore save warning (continuing with email):', dbErr?.message || dbErr);
    }

    // 2. Send notification email to the P12 team
    const notificationRecipient = process.env.CONTACT_RECEIVER_EMAIL || 'info@p12-aufmass.de';
    const emailSubject = `Neue Kontaktanfrage: ${trimmedName}${trimmedCompany ? ` (${trimmedCompany})` : ''}`;
    const emailText = `Neue Kontaktanfrage über p12-aufmass.de:

Name: ${trimmedName}
E-Mail: ${trimmedEmail}
Unternehmen: ${trimmedCompany || '–'}
Telefon: ${trimmedPhone || '–'}
Datum: ${new Date().toLocaleString('de-DE')}

Nachricht:
----------------------------------------
${trimmedMessage}
----------------------------------------
ID: ${inquiryId || 'n/a'}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; color: #1F1A4D;">
        <h2 style="color: #7437D9; margin-bottom: 8px;">Neue Kontaktanfrage über P12 - Aufmaß</h2>
        <p style="margin-top: 0; color: #68647D;">Es ist eine neue Nachricht über das Website-Kontaktformular eingegangen.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #EAE5F4; width: 140px;">Name:</td><td style="padding: 8px; border-bottom: 1px solid #EAE5F4;">${trimmedName}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #EAE5F4;">E-Mail:</td><td style="padding: 8px; border-bottom: 1px solid #EAE5F4;"><a href="mailto:${trimmedEmail}" style="color: #7437D9;">${trimmedEmail}</a></td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #EAE5F4;">Unternehmen:</td><td style="padding: 8px; border-bottom: 1px solid #EAE5F4;">${trimmedCompany || '–'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #EAE5F4;">Telefon:</td><td style="padding: 8px; border-bottom: 1px solid #EAE5F4;">${trimmedPhone || '–'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #EAE5F4;">Datum:</td><td style="padding: 8px; border-bottom: 1px solid #EAE5F4;">${new Date().toLocaleString('de-DE')}</td></tr>
        </table>
        <h3 style="color: #1F1A4D; margin-top: 24px;">Nachricht:</h3>
        <div style="background-color: #F7F5FC; padding: 16px; border-radius: 12px; border-left: 4px solid #7437D9; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${trimmedMessage}</div>
      </div>
    `;

    try {
      await sendEmail({
        to: notificationRecipient,
        subject: emailSubject,
        text: emailText,
        html: emailHtml
      });
    } catch (emailErr) {
      console.error('[Contact] Failed to send notification email:', emailErr?.message || emailErr);
      // We don't fail the user if Firestore saved the request
    }

    // 3. Send optional confirmation to user
    try {
      await sendEmail({
        to: trimmedEmail,
        subject: 'Ihre Anfrage bei P12 - Aufmaß',
        text: `Hallo ${trimmedName},\n\nvielen Dank für Ihre Anfrage bei P12 - Aufmaß.\n\nWir haben Ihre Nachricht erhalten und melden uns zeitnah bei Ihnen.\n\nMit freundlichen Grüßen\nIhr Team von P12 - Aufmaß\nEine Plattform der P12 Ventures GmbH\nhttps://p12-aufmass.de`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; color: #1F1A4D;">
            <h2 style="color: #7437D9;">Vielen Dank für Ihre Anfrage!</h2>
            <p>Hallo ${trimmedName},</p>
            <p>wir haben Ihre Nachricht erhalten und werden uns schnellstmöglich bei Ihnen zurückmelden.</p>
            <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #EAE5F4; font-size: 13px; color: #68647D;">
              <strong>P12 - Aufmaß</strong><br/>
              Eine Plattform der P12 Ventures GmbH<br/>
              Pölitzstraße 12 · 04155 Leipzig<br/>
              Geschäftsführer: Peter Suhayda<br/>
              <a href="https://p12-aufmass.de" style="color: #7437D9;">p12-aufmass.de</a> · <a href="https://p12v.de" style="color: #7437D9;">p12v.de</a>
            </p>
          </div>
        `
      });
    } catch (confErr) {
      // Ignored if user confirmation fails
    }

    res.json({
      success: true,
      inquiryId,
      message: 'Vielen Dank für Ihre Anfrage. Wir werden uns zeitnah bei Ihnen melden.'
    });
  } catch (error) {
    console.error('[Contact] Error processing contact inquiry:', error);
    res.status(500).json({ code: 'SERVER_ERROR', error: 'Beim Absenden der Anfrage ist ein Fehler aufgetreten. Bitte versuche es später noch einmal.' });
  }
});
