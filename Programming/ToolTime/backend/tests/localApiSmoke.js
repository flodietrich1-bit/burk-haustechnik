import assert from 'node:assert/strict';

const authResponse = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'superadmin@tooltime.local', password: 'ToolTime-Local-2026!', returnSecureToken: true }),
});
assert.equal(authResponse.ok, true, authResponse.ok ? '' : `Auth failed: ${await authResponse.text()}`);
const { idToken } = await authResponse.json();
const headers = { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' };

const preflight = await fetch('http://127.0.0.1:3001/api/tenants/burk', {
  method: 'OPTIONS',
  headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'authorization,content-type' },
});
assert.equal(preflight.ok, true);
assert.match(preflight.headers.get('access-control-allow-methods') || '', /\bPATCH\b/);

const tenantResponse = await fetch('http://127.0.0.1:3001/api/tenants', { headers });
assert.equal(tenantResponse.ok, true, tenantResponse.ok ? '' : `Tenant list failed: ${await tenantResponse.text()}`);
const tenants = await tenantResponse.json();
assert.equal(tenants.some(tenant => tenant.id === 'burk'), true);

const company = {
  legalName: 'Burk Haustechnik GmbH', contactName: 'Lokaler Ansprechpartner',
  phone: '+49 123 456789', email: 'kontakt@burk.test', country: 'Deutschland', billingSameAsContact: true,
};
const updateResponse = await fetch('http://127.0.0.1:3001/api/tenants/burk', {
  method: 'PATCH', headers,
  body: JSON.stringify({ company, branding: { primaryColor: '#6D28D9', logoPath: null } }),
});
assert.equal(updateResponse.ok, true, updateResponse.ok ? '' : `Tenant update failed: ${await updateResponse.text()}`);

const updatedTenantResponse = await fetch('http://127.0.0.1:3001/api/tenants/burk', { headers });
assert.equal(updatedTenantResponse.ok, true, updatedTenantResponse.ok ? '' : `Tenant reload failed: ${await updatedTenantResponse.text()}`);
const updatedTenant = await updatedTenantResponse.json();
assert.equal(updatedTenant.company.contactName, company.contactName);
assert.equal(updatedTenant.company.email, company.email);
assert.equal(updatedTenant.company.billingSameAsContact, true);
assert.equal(updatedTenant.company.billingName, company.contactName);
assert.equal(updatedTenant.company.billingEmail, company.email);
assert.equal(updatedTenant.company.billingPhone, company.phone);
assert.equal(updatedTenant.branding.primaryColor, '#6D28D9');

for (const status of ['suspended', 'active']) {
  const statusResponse = await fetch('http://127.0.0.1:3001/api/tenants/burk', {
    method: 'PATCH', headers, body: JSON.stringify({ status }),
  });
  assert.equal(statusResponse.ok, true, statusResponse.ok ? '' : `Status update to ${status} failed: ${await statusResponse.text()}`);
}

const inviteResponse = await fetch('http://127.0.0.1:3001/api/tenants/burk/invites', {
  method: 'POST', headers, body: JSON.stringify({ displayName: 'Lokaler Monteur', role: 'monteur', defaultLanguage: 'de' }),
});
assert.equal(inviteResponse.ok, true, inviteResponse.ok ? '' : `Invite creation failed: ${await inviteResponse.text()}`);
const invite = await inviteResponse.json();
assert.match(invite.shortCode, /^[A-Z2-9]{2}-[A-Z2-9]{4}$/);
assert.match(invite.qrDataUrl, /^data:image\/png;base64,/);
assert.ok(invite.pdfBase64.length > 1000);

const redeemResponse = await fetch('http://127.0.0.1:3001/api/public/invites/redeem', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ code: invite.shortCode, installationId: 'local-smoke-device' }),
});
if (redeemResponse.status === 429) {
  console.log('Invite redemption skipped: local rate limit is active.');
} else {
  assert.equal(redeemResponse.ok, true, redeemResponse.ok ? '' : `Invite redemption failed: ${await redeemResponse.text()}`);
  const redemption = await redeemResponse.json();
  assert.equal(redemption.tenantId, 'burk');
  assert.ok(redemption.customToken);

  const secondRedeem = await fetch('http://127.0.0.1:3001/api/public/invites/redeem', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: invite.shortCode, installationId: 'local-smoke-device-2' }),
  });
  assert.equal(secondRedeem.ok, false, 'A redeemed invitation must not be reusable');
}

const createCompany = { legalName: 'Löschtest GmbH', contactName: 'Test Person', phone: '+49 123 456', email: 'test@example.org' };
const createdResponse = await fetch('http://127.0.0.1:3001/api/tenants', {
  method: 'POST', headers, body: JSON.stringify({ name: createCompany.legalName, company: createCompany, primaryColor: '#7437D9', secondaryColor: '#1F1A4D' }),
});
assert.equal(createdResponse.status, 201, createdResponse.ok ? '' : await createdResponse.text());
const { id: testTenantId } = await createdResponse.json();
assert.match(testTenantId, /^firma-[a-f0-9]{16}$/);
const inviteBauleiter = () => fetch(`http://127.0.0.1:3001/api/tenants/${testTenantId}/invites`, {
  method: 'POST', headers, body: JSON.stringify({ displayName: 'Test Bauleiter', email: 'bauleiter@example.org', role: 'bauleiter' }),
});
assert.equal((await inviteBauleiter()).status, 409, 'A new tenant needs an admin invitation first');
const invitedEmail = `admin-${Date.now()}@example.org`;
const adminInvite = await fetch(`http://127.0.0.1:3001/api/tenants/${testTenantId}/invites`, {
  method: 'POST', headers, body: JSON.stringify({ displayName: 'Test Admin', email: invitedEmail, role: 'admin' }),
});
assert.equal(adminInvite.status, 201, adminInvite.ok ? '' : await adminInvite.text());
const adminInviteData = await adminInvite.json();
const mismatch = await fetch('http://127.0.0.1:3001/api/public/invites/redeem-web', {
  method: 'POST', headers, body: JSON.stringify({ qrToken: adminInviteData.qrToken }),
});
assert.equal(mismatch.status, 400, 'A different signed-in email must not redeem the invitation');
const signup = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: invitedEmail, password: 'Test-Admin-2026!', returnSecureToken: true }),
});
assert.equal(signup.ok, true, signup.ok ? '' : await signup.text());
const adminToken = (await signup.json()).idToken;
const adminHeaders = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
const webRedeem = await fetch('http://127.0.0.1:3001/api/public/invites/redeem-web', {
  method: 'POST', headers: adminHeaders, body: JSON.stringify({ qrToken: adminInviteData.qrToken }),
});
assert.equal(webRedeem.ok, true, webRedeem.ok ? '' : await webRedeem.text());
assert.equal((await webRedeem.json()).tenantId, testTenantId);
const ownTenant = await fetch(`http://127.0.0.1:3001/api/tenants/${testTenantId}`, { headers: adminHeaders });
assert.equal(ownTenant.ok, true, 'The invited admin must access their tenant');
const otherTenant = await fetch('http://127.0.0.1:3001/api/tenants/burk', { headers: adminHeaders });
assert.equal(otherTenant.status, 403, 'The invited admin must not access another tenant');
const again = await fetch('http://127.0.0.1:3001/api/public/invites/redeem-web', {
  method: 'POST', headers: adminHeaders, body: JSON.stringify({ qrToken: adminInviteData.qrToken }),
});
assert.equal(again.status, 400, 'The web invitation must be single-use');
assert.equal((await inviteBauleiter()).status, 201, 'A bauleiter can be invited after an admin');
const archive = await fetch(`http://127.0.0.1:3001/api/tenants/${testTenantId}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'archived' }) });
assert.equal(archive.ok, true);
const restore = await fetch(`http://127.0.0.1:3001/api/tenants/${testTenantId}`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'active' }) });
assert.equal(restore.ok, true);
const deleted = await fetch(`http://127.0.0.1:3001/api/tenants/${testTenantId}`, { method: 'DELETE', headers });
assert.equal(deleted.ok, true, deleted.ok ? '' : await deleted.text());
const afterDelete = await fetch(`http://127.0.0.1:3001/api/tenants/${testTenantId}`, { headers });
assert.equal(afterDelete.status, 404);
console.log('Local API smoke test passed: auth, tenant save/branding/status, invite creation, web admin redemption and access isolation, archive, restore and direct delete.');
