import https from 'https';
import path from 'path';

const APS_CLIENT_ID = process.env.APS_CLIENT_ID || '9AHBCjpebTtOOglbfEJhCcKZSkvb7k9RLwZ67vXONYHC0u4T';
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET || 'DQFW3M0CqIqdidjlwlT2UEdIVFuijXargAbq8TMyrZAxqZq6lzEx1JDQJm2NqRNz';
const BUCKET_KEY = 'tooltime_cad_bucket_9ahbc';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Utility helper for HTTPS requests
 */
function requestJson(url, options, postData = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(u, options, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf-8');
        try {
          const json = raw ? JSON.parse(raw) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      if (Buffer.isBuffer(postData)) {
        req.write(postData);
      } else if (typeof postData === 'string') {
        req.write(postData);
      } else {
        req.write(JSON.stringify(postData));
      }
    }
    req.end();
  });
}

/**
 * 1. Obtains 2-legged OAuth token from Autodesk
 */
export async function getApsToken(scope = 'bucket:create bucket:read data:read data:write') {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const basicAuth = Buffer.from(`${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`).toString('base64');
  const postData = `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`;

  const res = await requestJson('https://developer.api.autodesk.com/authentication/v2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, postData);

  if (res.status !== 200 || !res.data?.access_token) {
    throw new Error(`Autodesk OAuth failed: ${res.status} - ${JSON.stringify(res.data)}`);
  }

  cachedToken = res.data.access_token;
  tokenExpiresAt = now + (res.data.expires_in || 3500) * 1000;
  return cachedToken;
}

/**
 * Public token for frontend Viewer (read-only)
 */
export async function getViewerToken() {
  const basicAuth = Buffer.from(`${APS_CLIENT_ID}:${APS_CLIENT_SECRET}`).toString('base64');
  const postData = 'grant_type=client_credentials&scope=viewables:read';

  const res = await requestJson('https://developer.api.autodesk.com/authentication/v2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, postData);

  if (res.status !== 200 || !res.data?.access_token) {
    throw new Error(`Autodesk Viewer Token failed: ${res.status}`);
  }

  return {
    access_token: res.data.access_token,
    expires_in: res.data.expires_in
  };
}

/**
 * 2. Ensures OSS Bucket exists
 */
export async function ensureBucket() {
  const token = await getApsToken();
  const res = await requestJson('https://developer.api.autodesk.com/oss/v2/buckets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, {
    bucketKey: BUCKET_KEY,
    policyKey: 'transient'
  });

  if (res.status === 200 || res.status === 409) {
    return BUCKET_KEY;
  }
  return BUCKET_KEY;
}

/**
 * 3. Uploads DWG buffer via Signed S3 Upload & triggers Model Derivative
 */
export async function uploadAndTranslateDwg(buffer, originalFileName) {
  const token = await getApsToken();
  await ensureBucket();

  const timestamp = Date.now();
  const safeName = path.basename(originalFileName, path.extname(originalFileName))
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const objectKey = `${safeName}_${timestamp}.dwg`;

  // Step A: Request signed S3 upload URL
  const signedRes = await requestJson(
    `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  if (signedRes.status !== 200 || !signedRes.data?.urls?.[0]) {
    throw new Error(`Failed to get S3 signed URL: ${signedRes.status}`);
  }

  const s3Url = signedRes.data.urls[0];
  const uploadKey = signedRes.data.uploadKey;

  // Step B: Direct S3 binary upload
  const uploadRes = await requestJson(s3Url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': buffer.length
    }
  }, buffer);

  if (uploadRes.status < 200 || uploadRes.status >= 300) {
    throw new Error(`S3 direct upload failed with status ${uploadRes.status}`);
  }

  // Step C: Finalize S3 upload
  const finalizeRes = await requestJson(
    `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    },
    { uploadKey }
  );

  if (finalizeRes.status !== 200 || !finalizeRes.data?.objectId) {
    throw new Error(`Failed to finalize upload: ${finalizeRes.status}`);
  }

  const objectId = finalizeRes.data.objectId;
  const urn = Buffer.from(objectId).toString('base64').replace(/=/g, '');

  // Step D: Start Model Derivative translation job
  const jobRes = await requestJson('https://developer.api.autodesk.com/modelderivative/v2/designdata/job', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, {
    input: { urn },
    output: {
      formats: [{ type: 'svf', views: ['2d', '3d'] }]
    }
  });

  return {
    urn,
    objectId,
    bucketKey: BUCKET_KEY,
    objectKey,
    jobStatus: jobRes.status,
    jobData: jobRes.data
  };
}

/**
 * 4. Get Manifest status for a URN
 */
export async function getManifest(urn) {
  const token = await getApsToken('data:read');
  const res = await requestJson(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.data;
}
