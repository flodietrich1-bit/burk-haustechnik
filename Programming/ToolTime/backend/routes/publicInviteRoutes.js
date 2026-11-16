import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateFirebaseUser } from '../middleware/auth.js';
import { inspectWebInvite, redeemInvite, loginMonteur } from '../services/inviteService.js';
import { clearInviteAttempt, consumeInviteAttempt } from '../services/rateLimitService.js';
import crypto from 'crypto';

export const publicInviteRouter = Router();
const redeemLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

publicInviteRouter.post('/validate-web', redeemLimiter, async (req, res) => {
  const { code, qrToken, email, tenantSlug } = req.body || {};
  if ((!code && !qrToken) || (!qrToken && !/^\S+@\S+\.\S+$/.test(String(email || '').trim()))) return res.status(400).json({ code: 'INVITE_INVALID' });
  try {
    const result = await inspectWebInvite({ code, qrToken, email, tenantSlug });
    if (!result) return res.status(400).json({ code: 'INVITE_INVALID' });
    res.json(result);
  } catch (error) {
    console.error('Web invitation validation failed', error);
    res.status(500).json({ code: 'INVITE_VALIDATION_FAILED' });
  }
});

publicInviteRouter.post('/redeem', redeemLimiter, async (req, res) => {
  const { code, qrToken, installationId, password } = req.body || {};
  if ((!code && !qrToken) || !installationId) return res.status(400).json({ code: 'INVITE_INVALID' });
  try {
    const codeFingerprint = crypto.createHash('sha256').update(String(code || qrToken)).digest('hex');
    const limit = await consumeInviteAttempt({ ip: req.ip || 'unknown', installationId, codeFingerprint });
    if (!limit.allowed) return res.status(429).json({ code: 'INVITE_RATE_LIMITED', retryAfterSeconds: limit.retryAfterSeconds });
    const result = await redeemInvite({ code, qrToken, installationId, password });
    if (!result) return res.status(400).json({ code: 'INVITE_INVALID' });
    await clearInviteAttempt({ ip: req.ip || 'unknown', installationId, codeFingerprint });
    res.json(result);
  } catch (error) {
    if (error.publicCode === 'INVITE_INVALID') return res.status(400).json({ code: 'INVITE_INVALID' });
    console.error('Invite redemption failed:', error);
    res.status(500).json({ code: 'INVITE_REDEEM_FAILED' });
  }
});


publicInviteRouter.post('/redeem-web', redeemLimiter, authenticateFirebaseUser, async (req, res) => {
  const { code, qrToken, tenantSlug } = req.body || {};
  if (!code && !qrToken) return res.status(400).json({ code: 'INVITE_INVALID' });
  try {
    const codeFingerprint = crypto.createHash('sha256').update(String(code || qrToken)).digest('hex');
    const limit = await consumeInviteAttempt({ ip: req.ip || 'unknown', installationId: req.auth.uid, codeFingerprint });
    if (!limit.allowed) return res.status(429).json({ code: 'INVITE_RATE_LIMITED', retryAfterSeconds: limit.retryAfterSeconds });
    const result = await redeemInvite({ code, qrToken, webUid: req.auth.uid, tenantSlug });
    if (!result) return res.status(400).json({ code: 'INVITE_INVALID' });
    await clearInviteAttempt({ ip: req.ip || 'unknown', installationId: req.auth.uid, codeFingerprint });
    res.json(result);
  } catch (error) {
    if (error.publicCode) return res.status(400).json({ code: error.publicCode });
    console.error('Web invitation redemption failed', error);
    res.status(500).json({ code: 'INVITE_REDEEM_FAILED' });
  }
});

publicInviteRouter.post('/login', redeemLimiter, async (req, res) => {
  const { tenantId, monteurId, password } = req.body || {};
  if (!tenantId || !monteurId || !password) return res.status(400).json({ code: 'INVALID_INPUT' });
  try {
    const result = await loginMonteur({ tenantId, monteurId, password });
    res.json(result);
  } catch (error) {
    if (error.publicCode === 'MEMBER_NOT_FOUND') return res.status(404).json({ code: 'MEMBER_NOT_FOUND' });
    if (error.publicCode === 'INVALID_PASSWORD') return res.status(401).json({ code: 'INVALID_PASSWORD' });
    if (error.publicCode === 'PASSWORD_NOT_SET') return res.status(400).json({ code: 'PASSWORD_NOT_SET' });
    console.error('Monteur login failed:', error);
    res.status(500).json({ code: 'LOGIN_FAILED' });
  }
});
