import AsyncStorage from '@react-native-async-storage/async-storage';

// Default production API base URL (Express backend)
export const DEFAULT_API_BASE = 'https://p12-aufmass.de/api';
const INSTALLATION_ID_KEY = 'ttapp_installation_id';
const API_BASE_OVERRIDE_KEY = 'ttapp_api_base_override';

/**
 * Resolve current API base URL
 */
export async function getApiBaseUrl() {
  try {
    const override = await AsyncStorage.getItem(API_BASE_OVERRIDE_KEY);
    if (override && override.trim()) {
      return override.trim().replace(/\/$/, '');
    }
  } catch {}
  return DEFAULT_API_BASE;
}

/**
 * Set an API base URL override (e.g. for development/staging)
 */
export async function setApiBaseUrlOverride(url) {
  try {
    if (!url) {
      await AsyncStorage.removeItem(API_BASE_OVERRIDE_KEY);
    } else {
      await AsyncStorage.setItem(API_BASE_OVERRIDE_KEY, url.trim().replace(/\/$/, ''));
    }
  } catch {}
}

/**
 * Returns a persistent installation ID for this device
 */
export async function getInstallationId() {
  try {
    let id = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
    if (!id) {
      // Generate unique installation ID
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 10);
      id = `inst_${timestamp}_${randomPart}`;
      await AsyncStorage.setItem(INSTALLATION_ID_KEY, id);
    }
    return id;
  } catch {
    return `inst_${Date.now()}`;
  }
}

export async function resetInstallationId() {
  try {
    await AsyncStorage.removeItem(INSTALLATION_ID_KEY);
  } catch {}
}

/**
 * Parse an invitation token from either a QR code content or raw string
 * Supports:
 * - tooltime://invite?token=XYZ
 * - https://.../invite?token=XYZ
 * - Raw 32-64 char base64url token
 * - 5-8 character short code (e.g. ABC234, AB-C234)
 */
export function parseInviteInput(scannedData) {
  if (!scannedData || typeof scannedData !== 'string') {
    return { qrToken: null, code: null };
  }

  const clean = scannedData.trim();

  // 1. Deep Link or Web URL with ?token=... or &token=...
  if (clean.includes('token=')) {
    try {
      const match = clean.match(/[?&]token=([A-Za-z0-9_-]+)/);
      if (match && match[1]) {
        return { qrToken: decodeURIComponent(match[1]), code: null };
      }
    } catch {}
  }

  // 2. Short code format: e.g. "AB-C234" or "ABC234" (alphanumeric 5-8 chars, no slashes or colons)
  const codeCandidate = clean.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (
    !clean.includes('/') &&
    !clean.includes(':') &&
    codeCandidate.length >= 5 &&
    codeCandidate.length <= 8
  ) {
    return { qrToken: null, code: codeCandidate };
  }

  // 3. Raw qrToken: 32 to 64 character base64url string
  if (/^[A-Za-z0-9_-]{32,64}$/.test(clean)) {
    return { qrToken: clean, code: null };
  }

  // Invalid invite format
  return { qrToken: null, code: null };
}


/**
 * Redeem an invite code or qrToken via Express backend
 * POST /api/public/invites/redeem
 */
export async function redeemInviteApi({ code, qrToken }) {
  const installationId = await getInstallationId();
  const apiBase = await getApiBaseUrl();

  const payload = {
    installationId,
    ...(code ? { code } : {}),
    ...(qrToken ? { qrToken } : {}),
  };

  const response = await fetch(`${apiBase}/public/invites/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.code || `REDEEM_FAILED_${response.status}`);
    error.status = response.status;
    error.code = data.code;
    error.retryAfterSeconds = data.retryAfterSeconds;
    throw error;
  }

  return data; // { customToken, tenantId, requiresLocalPinSetup }
}

/**
 * Fetch assigned projects for the authenticated monteur via Express backend
 * GET /api/tenants/:tenantId/projects
 */
export async function fetchAssignedProjectsApi(tenantId, idToken) {
  if (!tenantId) throw new Error('MISSING_TENANT_ID');
  if (!idToken) throw new Error('MISSING_ID_TOKEN');

  const apiBase = await getApiBaseUrl();
  const response = await fetch(`${apiBase}/tenants/${tenantId}/projects`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });

  const data = await response.json().catch(() => ([]));

  if (!response.ok) {
    const error = new Error(data?.code || `PROJECTS_FETCH_FAILED_${response.status}`);
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }

  return Array.isArray(data) ? data : [];
}
