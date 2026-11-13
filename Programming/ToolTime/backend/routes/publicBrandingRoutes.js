import { Router } from 'express';
import { adminStorage } from '../adminFirebase.js';
import { publicBranding, resolvePublicTenant } from '../services/publicTenantService.js';

export const publicBrandingRouter = Router();

publicBrandingRouter.get('/:slug', async (req, res) => {
  const tenant = await resolvePublicTenant(req.params.slug);
  if (!tenant) return res.status(404).json({ code: 'TENANT_NOT_FOUND' });
  const brand = publicBranding(tenant);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ ...brand, logoUrl: brand.hasLogo ? `/api/public/branding/${encodeURIComponent(brand.slug)}/logo?v=${brand.logoVersion}` : null });
});

publicBrandingRouter.get('/:slug/logo', async (req, res) => {
  const tenant = await resolvePublicTenant(req.params.slug);
  const path = tenant?.get('branding')?.logoPath;
  if (!tenant || !path || !String(path).startsWith(`tenants/${tenant.id}/branding/`)) return res.status(404).end();
  try {
    const file = adminStorage.bucket().file(path);
    const [metadata] = await file.getMetadata();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(metadata.contentType)) return res.status(415).end();
    res.set('Content-Type', metadata.contentType);
    res.set('Cache-Control', 'public, max-age=300');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'; sandbox");
    file.createReadStream().on('error', () => { if (!res.headersSent) res.status(404); res.end(); }).pipe(res);
  } catch { res.status(404).end(); }
});
