// Failure-only regression: no credentials or session tokens are supplied or issued.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { SESSION_RECOVERY_KEY } from '../src/lib/session-recovery.ts';

const appUrl = new URL(process.env.APP_URL || 'http://localhost:3000');
const configResponse = await fetch(new URL('/api/config', appUrl));
assert.equal(configResponse.status, 200, 'A real local Tide adapter must be configured');
const config = await configResponse.json();
const issuer = new URL(`realms/${config.realm}/`, `${config['auth-server-url'].replace(/\/+$/, '')}/`);
const authPath = `${issuer.pathname}protocol/openid-connect/auth`;
const tokenPath = `${issuer.pathname}protocol/openid-connect/token`;
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
let tokenAttempts = 0;
let topLevelLogins = 0;
try {
  const page = await browser.newPage();
  await page.route((url) => url.origin === issuer.origin && url.pathname === authPath, async (route) => {
    const requestUrl = new URL(route.request().url());
    const destination = new URL(requestUrl.searchParams.get('redirect_uri'));
    assert.equal(destination.origin, appUrl.origin);
    const result = new URLSearchParams({ state: requestUrl.searchParams.get('state') || '' });
    if (requestUrl.searchParams.get('prompt') === 'none') result.set('error', 'login_required');
    else {
      topLevelLogins++;
      result.set('code', 'synthetic-callback-regression-code');
    }
    if (requestUrl.searchParams.get('response_mode') === 'query') destination.search = result.toString();
    else destination.hash = result.toString();
    await route.fulfill({ status: 302, headers: { Location: destination.href } });
  });
  await page.route((url) => url.origin === issuer.origin && url.pathname === tokenPath, async (route) => {
    const headers = {
      'Access-Control-Allow-Origin': appUrl.origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': route.request().headers()['access-control-request-headers'] || 'content-type,dpop',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    tokenAttempts++;
    await route.fulfill({ status: 500, headers, contentType: 'application/json', body: JSON.stringify({ error: 'server_error', error_description: 'Synthetic token-signing failure' }) });
  });
  await page.goto(appUrl.href, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Sign in with TideCloak' }).click();
  await page.getByRole('heading', { name: 'Sign-in could not be completed.' }).waitFor({ timeout: 45_000 });
  assert.equal(new URL(page.url()).pathname, '/auth/redirect', 'Failed callback must not silently return home');
  assert.equal(tokenAttempts, 1, 'Provider should process the callback exactly once, without a second hybrid PKCE handler');
  assert(await page.getByRole('button', { name: 'Try sign-in again' }).isVisible());
  assert(await page.getByRole('alert').first().isVisible());
  console.log('PASS: one provider-owned token exchange; signing failure stays visible on the callback page with retry.');

  await page.goto(new URL('/vault', appUrl).href, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Sign in with TideCloak' }).waitFor();
  assert.equal(topLevelLogins, 1, 'A visitor without a previous-session hint should keep the sign-in gate');

  // Simulate the non-secret hint left by a previous successful sign-in.
  // The hint must never grant authentication or access to the API.
  await page.evaluate(key => sessionStorage.setItem(key, '1'), SESSION_RECOVERY_KEY);
  const denied = await page.request.get(new URL('/api/vault', appUrl).href);
  assert.equal(denied.status(), 401);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Sign-in could not be completed.' }).waitFor({ timeout: 45_000 });
  assert.equal(topLevelLogins, 2, 'Reload should attempt one top-level session recovery');
  assert.equal(tokenAttempts, 2, 'Recovery should use the existing provider-owned callback');
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), SESSION_RECOVERY_KEY), null);

  await page.goto(new URL('/vault', appUrl).href, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Sign in with TideCloak' }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Sign in with TideCloak' }).waitFor();
  assert.equal(topLevelLogins, 2, 'Failed recovery must not redirect again on another reload');
  console.log('PASS: previous-session hint triggers one recovery; fresh visitors stay signed out; a hint grants no API access; failed recovery does not loop.');
} finally { await browser.close(); }
