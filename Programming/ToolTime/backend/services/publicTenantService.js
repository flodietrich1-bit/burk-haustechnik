import { randomBytes } from 'node:crypto';
import { adminDb } from '../adminFirebase.js';

export function publicSlugForName(name) {
  return String(name || '').trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export async function ensurePublicSlug(tenantRef) {
  const tenant = await tenantRef.get();
  if (!tenant.exists) return null;
  if (tenant.get('publicSlug')) return tenant.get('publicSlug');
  const base = publicSlugForName(tenant.get('name')) || 'firma';
  const reserved = new Set(['admin', 'invite', 'login', 't', 'api']);
  let slug = base;
  const alias = await adminDb.doc(`tenantAliases/${slug}`).get();
  const otherTenant = await adminDb.doc(`tenants/${slug}`).get();
  if (reserved.has(slug) || (alias.exists && alias.get('tenantId') !== tenantRef.id) || (otherTenant.exists && otherTenant.id !== tenantRef.id)) {
    slug = `${base.slice(0, 49)}-${randomBytes(4).toString('hex')}`;
  }
  const batch = adminDb.batch();
  batch.update(tenantRef, { publicSlug: slug });
  if (!(alias.exists && alias.get('tenantId') === tenantRef.id && slug === base)) {
    batch.create(adminDb.doc(`tenantAliases/${slug}`), { tenantId: tenantRef.id });
  }
  try { await batch.commit(); }
  catch (error) {
    const latest = await tenantRef.get();
    if (latest.get('publicSlug')) return latest.get('publicSlug');
    throw error;
  }
  return slug;
}

export async function resolvePublicTenant(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(normalized)) return null;
  const alias = await adminDb.doc(`tenantAliases/${normalized}`).get();
  const id = alias.exists ? alias.get('tenantId') : normalized;
  const tenant = await adminDb.doc(`tenants/${id}`).get();
  if (!tenant.exists || tenant.get('status') !== 'active') return null;
  if (alias.exists && tenant.get('publicSlug') !== normalized) return null;
  return tenant;
}

export function publicBranding(tenant) {
  const branding = tenant.get('branding') || {};
  return {
    tenantId: tenant.id,
    slug: tenant.get('publicSlug') || tenant.get('slug') || tenant.id,
    name: tenant.get('name') || tenant.id,
    primaryColor: /^#[0-9a-f]{6}$/i.test(branding.primaryColor || '') ? branding.primaryColor : '#7437D9',
    secondaryColor: /^#[0-9a-f]{6}$/i.test(branding.secondaryColor || '') ? branding.secondaryColor : '#1F1A4D',
    logoZoom: Number(branding.logoZoom) || 1,
    logoVersion: Number(branding.logoVersion) || 0,
    hasLogo: Boolean(branding.logoPath),
  };
}
