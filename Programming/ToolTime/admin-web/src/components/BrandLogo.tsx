import { useEffect, useState } from 'react';
import { brandBackgroundColor, brandTextAccentColor, readableTextColor, type PublicTenantBranding } from '../types/branding';

export function BrandLogo({ branding }: { branding: PublicTenantBranding }) {
  const [failedLogo, setFailedLogo] = useState(false);
  const [failedFallback, setFailedFallback] = useState(false);
  useEffect(() => { setFailedLogo(false); setFailedFallback(false); }, [branding.logoUrl, branding.slug]);
  const fallbackLogo = branding.slug.toLowerCase() === 'burk' ? '/burk-haustechnik-logo.svg' : branding.slug.toLowerCase() === 'p12' ? '/p12-aufmass-logo.svg' : '';
  const source = branding.logoUrl && !failedLogo ? branding.logoUrl : fallbackLogo && !failedFallback ? fallbackLogo : '';
  if (source) return <img src={source} alt={`${branding.name} Logo`} onError={() => source === branding.logoUrl ? setFailedLogo(true) : setFailedFallback(true)} className="max-h-24 max-w-56 object-contain" style={{ transform: `scale(${branding.logoZoom || 1})`, transformOrigin: 'left center' }}/>;
  return <div className="flex items-center gap-3"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold" style={{ backgroundColor: brandBackgroundColor(branding.primaryColor), color: readableTextColor(branding.primaryColor) }}>{branding.name.trim().charAt(0).toUpperCase()}</span><span className="max-w-52 text-lg font-bold leading-tight" style={{ color: brandTextAccentColor(branding.secondaryColor) }}>{branding.name}</span></div>;
}
