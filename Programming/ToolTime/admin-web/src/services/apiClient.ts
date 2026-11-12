import { auth } from '../firebase';

const configuredApiBase = import.meta.env.VITE_API_BASE_URL;
const API_BASE = (configuredApiBase || `${window.location.protocol}//${window.location.hostname}:3001/api`).replace(/\/$/, '');

export class ApiConnectionError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`Backend nicht erreichbar (${url}). Bitte prüfen, ob der lokale Backend-Dienst läuft und dieses Gerät den Host erreichen kann.`);
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
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.code || `HTTP_${response.status}`);
  return body as T;
}
