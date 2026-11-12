export interface TenantBranding {
  name: string;
  logoUrl?: string;
  logoZoom?: number;
  primaryColor: string;
  secondaryColor: string;
}

export function readableTextColor(hex: string): string {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.18 ? '#172033' : '#FFFFFF';
}
