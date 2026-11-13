import { auth } from '../firebase';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL;
const defaultApiBase = import.meta.env.PROD ? '/api' : `${window.location.protocol}//${window.location.hostname}:3001/api`;
const API_BASE = (configuredApiBase || defaultApiBase).replace(/\/$/, '');
export function apiAssetUrl(path: string): string { return `${new URL(API_BASE, window.location.origin).origin}${path}`; }

export class ApiConnectionError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`Backend nicht erreichbar (${url}). Bitte versuche es später erneut.`);
    this.name = 'ApiConnectionError';
    this.url = url;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const url = `${API_BASE}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch (error) {
    if (error instanceof TypeError) throw new ApiConnectionError(url);
    throw error;
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiConnectionError(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code || `HTTP_${response.status}`);
  return body as T;
}

export async function uploadToApi<T>(path: string, formData: FormData): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  const url = `${API_BASE}${path}`;
  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
  } catch (error) {
    if (error instanceof TypeError) throw new ApiConnectionError(url);
    throw error;
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiConnectionError(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code || `HTTP_${response.status}`);
  return body as T;
}
