/**
 * PWA contract checks.
 *
 * Runs in CI and after every build: a manifest that loses its maskable icon or
 * a service worker that starts caching `/api/` is a release blocker, not a
 * cosmetic bug. Also cross-checks the E-WIN descriptor against the app so the
 * hub never links to a route that no longer exists.
 */
import { readFile, stat } from 'node:fs/promises';

const failures = [];
const warn = [];
const ok = [];

function check(condition, message) {
  if (condition) ok.push(message);
  else failures.push(message);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const manifestRaw = await readFile('static/manifest.webmanifest', 'utf8');
let manifest;
try {
  manifest = JSON.parse(manifestRaw);
  ok.push('manifest.webmanifest is valid JSON');
} catch (error) {
  failures.push(`manifest.webmanifest is not valid JSON: ${error.message}`);
  manifest = {};
}

check(manifest.name && manifest.name.length > 5, 'manifest has a full name');
check(manifest.short_name && manifest.short_name.length <= 12, 'manifest short_name fits a home screen');
check(['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display), 'manifest display is installable');
check(manifest.start_url?.startsWith('/'), 'manifest start_url is in scope');
check(manifest.scope === '/', 'manifest scope covers the app');
check(manifest.theme_color === '#070d0b', 'manifest theme_color matches the shell');
check(manifest.id, 'manifest has a stable id');

const icons = manifest.icons ?? [];
const sizes = new Set(icons.map((icon) => icon.sizes));
check(sizes.has('192x192'), 'manifest has a 192px icon');
check(sizes.has('512x512'), 'manifest has a 512px icon');
check(icons.some((icon) => String(icon.purpose).includes('maskable')), 'manifest has a maskable icon');
for (const icon of icons) {
  check(await exists(`static${icon.src}`), `icon file exists: ${icon.src}`);
}

const screenshots = manifest.screenshots ?? [];
check(screenshots.some((shot) => shot.form_factor === 'wide'), 'manifest has a wide screenshot');
check(screenshots.some((shot) => shot.form_factor === 'narrow'), 'manifest has a narrow screenshot');
for (const shot of screenshots) {
  check(await exists(`static${shot.src}`), `screenshot file exists: ${shot.src}`);
}

const shortcuts = manifest.shortcuts ?? [];
check(shortcuts.length >= 3, 'manifest exposes at least three shortcuts');
for (const shortcut of shortcuts) {
  check(shortcut.url?.startsWith('/'), `shortcut ${shortcut.short_name} points at a route`);
}

// The service worker must never cache private routes.
const sw = await readFile('static/sw.js', 'utf8');
check(sw.includes("'/api/'") && sw.includes("'/auth/'"), 'service worker excludes /api/ and /auth/');
check(/networkFirstNavigation/.test(sw), 'service worker is network-first for navigations');
check(sw.includes("'/offline'"), 'service worker precaches the offline page');
check(await exists('src/routes/offline/+page.svelte'), 'offline route exists');
check(await exists('src/routes/offline/+page.ts'), 'offline route is prerendered');
for (const route of ['/dashboard', '/predictions', '/fixtures', '/live']) {
  check(await exists(`src/routes/(app)${route}/+page.svelte`), `shortcut target exists: ${route}`);
}

// app.html must carry the iOS meta tags (iOS ignores the manifest).
const appHtml = await readFile('src/app.html', 'utf8');
for (const needle of [
  'manifest.webmanifest',
  'apple-mobile-web-app-capable',
  'apple-touch-icon',
  'apple-mobile-web-app-status-bar-style',
  'mobile-web-app-capable',
  'viewport-fit=cover'
]) {
  check(appHtml.includes(needle), `app.html includes ${needle}`);
}

// E-WIN descriptor.
const descriptorRaw = await readFile('static/.well-known/ewin-app.json', 'utf8');
let descriptor;
try {
  descriptor = JSON.parse(descriptorRaw);
  ok.push('E-WIN descriptor is valid JSON');
} catch (error) {
  failures.push(`E-WIN descriptor is not valid JSON: ${error.message}`);
  descriptor = {};
}
check(descriptor.appId === 'cavebettor', 'descriptor appId is cavebettor');
check(descriptor.endpoints?.ssoStart && descriptor.endpoints?.health, 'descriptor declares health and SSO endpoints');
check(Array.isArray(descriptor.capabilities) && descriptor.capabilities.includes('sso'), 'descriptor advertises SSO');
for (const link of descriptor.deepLinks ?? []) {
  const route = link.path === '/' ? '' : link.path;
  const candidates = [`src/routes/(app)${route}/+page.svelte`, `src/routes/(public)${route}/+page.svelte`, `src/routes${route}/+page.svelte`];
  let found = false;
  for (const candidate of candidates) if (await exists(candidate)) found = true;
  check(found, `deep link resolves to a route: ${link.path}`);
}
check(descriptor.pwa?.installable === true, 'descriptor tells the hub the app is installable');

// Headers.
const headers = await readFile('_headers', 'utf8');
check(/\/sw\.js[\s\S]*?Cache-Control: no-cache/.test(headers), '_headers keeps sw.js uncached');
check(headers.includes('Service-Worker-Allowed: /'), '_headers allows the worker at root scope');
check(/manifest\.webmanifest[\s\S]*?application\/manifest\+json/.test(headers), 'manifest is served as application/manifest+json');

console.log(`${ok.length} checks passed`);
if (warn.length) console.log(warn.map((line) => `! ${line}`).join('\n'));
if (failures.length) {
  console.error(`\n${failures.length} PWA check(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('PWA verification passed.');
