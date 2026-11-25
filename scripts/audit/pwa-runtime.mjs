/**
 * PWA runtime audit, run against a live deployment.
 *
 * Proves the promises the manifest and service worker make: the worker
 * activates, the shell is precached, private routes are never stored, the
 * offline notice is served when the network is gone, and the ecosystem
 * descriptor resolves.
 *
 *   npm run audit:pwa
 *   npm run audit:pwa -- https://staging.example.com
 */
import { chromium } from 'playwright-core';

const base = (process.argv[2] || process.env.AUDIT_BASE_URL || 'https://cavebettor.ewinproject.org').replace(/\/$/, '');
const executablePath = process.env.CHROME_PATH;
const failures = [];
const pass = (label, detail = '') => console.log(`✓ ${label.padEnd(34)} ${detail}`);
const fail = (label, detail) => {
  failures.push(`${label}: ${detail}`);
  console.error(`✗ ${label.padEnd(34)} ${detail}`);
};

const browser = await chromium.launch({ executablePath, channel: executablePath ? undefined : 'msedge' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();

await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle', timeout: 90_000 });

const manifestHref = await page.getAttribute('link[rel="manifest"]', 'href');
manifestHref ? pass('manifest linked', manifestHref) : fail('manifest linked', 'no <link rel="manifest">');

const sw = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const registration = await navigator.serviceWorker.ready;
  return { supported: true, scope: registration.scope, active: Boolean(registration.active), state: registration.active?.state };
});
if (!sw.supported) fail('service worker', 'not supported in this browser');
else if (!sw.active) fail('service worker', `registered but ${sw.state}`);
else pass('service worker active', `${sw.scope} (${sw.state})`);

await page.waitForTimeout(2500);
const caches = await page.evaluate(async () => {
  const names = await window.caches.keys();
  const detail = {};
  for (const name of names) {
    const cache = await window.caches.open(name);
    detail[name] = (await cache.keys()).map((request) => new URL(request.url).pathname);
  }
  return detail;
});
const cachedPaths = Object.values(caches).flat();
cachedPaths.includes('/offline') ? pass('offline shell precached', '/offline') : fail('offline shell precached', 'missing from cache');

const leaked = cachedPaths.filter((path) => path.startsWith('/api/') || path.startsWith('/auth/'));
leaked.length ? fail('private routes uncached', leaked.join(', ')) : pass('private routes uncached', `${cachedPaths.length} paths checked`);

// Speculation rules must be neutralised: prerendering costs a Worker call and
// hides the offline notice behind a stale document.
const rules = await page.evaluate(async () => {
  const response = await fetch('/cdn-cgi/speculation');
  if (!response.ok) return null;
  return response.json().catch(() => null);
});
if (rules) {
  const empty = (rules.prerender ?? []).length === 0 && (rules.prefetch ?? []).length === 0;
  empty ? pass('speculation disabled', 'empty rule set') : fail('speculation disabled', 'Cloudflare rules still active');
} else {
  pass('speculation disabled', 'no rule set served');
}

const installVisible = await page.evaluate(() =>
  /install cavebettor|add to home screen|install app/i.test(document.body.innerText)
);
installVisible
  ? pass('install entry point', 'visible in the workspace')
  : fail('install entry point', 'no install affordance on the dashboard');

/*
 * The offline branch itself is covered by `tests/service-worker.test.ts`, which
 * runs the worker against a fake network. Browser-level offline emulation does
 * not reach the worker's own network stack, so it would report a false pass.
 * What is checked here is that the cached notice is intact and usable.
 */
const offlineShell = await page.evaluate(async () => {
  const cached = await caches.match('/offline');
  if (!cached) return null;
  return { body: await cached.text(), status: cached.status };
});
if (offlineShell && /you are offline|no connection/i.test(offlineShell.body)) {
  pass('offline notice cached', `${offlineShell.status} · ${offlineShell.body.length} bytes`);
} else {
  fail('offline notice cached', offlineShell ? 'cached copy has no offline copy' : 'not in CacheStorage');
}

const meta = await page.evaluate(() => ({
  appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute('content'),
  appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content'),
  appleIcon: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')
}));
meta.appleCapable === 'yes' && meta.appleIcon
  ? pass('iOS metadata', `${meta.appleTitle} · ${meta.appleIcon}`)
  : fail('iOS metadata', JSON.stringify(meta));

const descriptor = await page.evaluate(async () => (await fetch('/.well-known/ewin-app.json')).json().catch(() => null));
descriptor?.appId === 'cavebettor' && descriptor?.endpoints?.ssoStart
  ? pass('E-WIN descriptor', `${descriptor.appId} · ${descriptor.endpoints.ssoStart}`)
  : fail('E-WIN descriptor', 'missing or malformed');

const ecosystem = await page.evaluate(async () => (await fetch('/api/ecosystem/manifest')).json().catch(() => null));
ecosystem?.pwa?.installable
  ? pass('ecosystem manifest', `installable · ${ecosystem.pwa.display}`)
  : fail('ecosystem manifest', 'pwa block missing');

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} PWA runtime failure(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('\nPWA runtime audit passed.');
