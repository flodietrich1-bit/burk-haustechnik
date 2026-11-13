export interface TenantBranding {
  name: string;
  logoUrl?: string;
  logoZoom?: number;
  primaryColor: string;
  secondaryColor: string;
}

export interface PublicTenantBranding extends TenantBranding {
  tenantId: string;
  slug: string;
  logoUrl?: string;
}

function channels(hex: string): number[] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return [116, 55, 217];
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance(values: number[]): number {
  const [red, green, blue] = values.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function toHex(values: number[]): string {
  return `#${values.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function darkenToContrast(hex: string): string {
  const rgb = channels(hex);
  if (luminance(rgb) <= 0.18) return hex;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 16; step += 1) {
    const middle = (low + high) / 2;
    if (luminance(rgb.map(value => Math.floor(value * middle))) > 0.18) high = middle;
    else low = middle;
  }
  return toHex(rgb.map(value => Math.floor(value * low)));
}

export function readableTextColor(hex: string): string {
  return luminance(channels(hex)) > 0.3 ? '#172033' : '#FFFFFF';
}

export function brandBackgroundColor(hex: string): string {
  return readableTextColor(hex) === '#FFFFFF' ? darkenToContrast(hex) : hex;
}

export function brandTextAccentColor(hex: string): string {
  return darkenToContrast(hex);
}
