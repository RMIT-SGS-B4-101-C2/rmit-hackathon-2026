// Read-only local realm diagnostics. Prints booleans/counts, never credentials or tokens.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';

const adapter = JSON.parse(await readFile('data/tidecloak.json', 'utf8'));
const base = adapter['auth-server-url'].replace(/\/+$/, '');
async function adminGet(path) {
  const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST', body: new URLSearchParams({
      client_id: 'admin-cli', grant_type: 'password',
      username: process.env.KC_BOOTSTRAP_ADMIN_USERNAME || 'admin',
      password: process.env.KC_BOOTSTRAP_ADMIN_PASSWORD || '',
    }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Admin authentication returned ${response.status}`);
  const { access_token } = await response.json();
  const result = await fetch(`${base}/admin/realms/${encodeURIComponent(adapter.realm)}${path}`, {
    headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(15000),
  });
  if (!result.ok) throw new Error(`Read-only realm lookup returned ${result.status}`);
  return result.json();
}
const realm = await adminGet('');
const clients = await adminGet(`/clients?clientId=${encodeURIComponent(adapter.resource)}`);
const client = clients[0];
const users = await adminGet('/users?username=admin&exact=true');
const user = users[0];
if (!client || !user) throw new Error('Expected local client/admin principal not found');
const roles = await adminGet(`/users/${user.id}/role-mappings/realm/composite`);
const names = new Set(roles.map((role) => role.name));
const changes = await adminGet('/iga/change-requests?status=PENDING');
const required = ['appUser', '_tide_enabled', '_tide_vault.selfencrypt', '_tide_vault.selfdecrypt'];
const checks = {
  realmEnabled: realm.enabled === true,
  tideGovernance: realm.attributes?.['iga.attestor'] === 'tide',
  clientEnabled: client.enabled === true,
  authorizationCodeFlow: client.standardFlowEnabled === true,
  dpopBoundTokens: client.attributes?.['dpop.bound.access.tokens'] === 'true',
  callbackAllowed: client.redirectUris?.some((uri) => uri === 'http://localhost:3000/*' || uri === 'http://localhost:3000/auth/redirect'),
  appOriginAllowed: client.webOrigins?.includes('http://localhost:3000'),
  linkedIdentity: Boolean(user.attributes?.tideUserKey?.[0] && user.attributes?.vuid?.[0]),
  pendingRequiredActions: user.requiredActions?.length ?? 0,
  requiredRoles: Object.fromEntries(required.map((role) => [role, names.has(role)])),
  pendingGovernanceChanges: Array.isArray(changes) ? changes.length : null,
  embeddedVerificationKey: Boolean(adapter.jwk?.keys?.length),
};
console.log(JSON.stringify(checks, null, 2));
