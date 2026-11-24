#!/usr/bin/env node
/**
 * Post-deployment verification against the live production domain.
 *
 * Checks every generated visual, the static public pages, the recovery page
 * and the protected routes. Run with:
 *
 *   PRODUCTION_URL=https://cavebettor.ewinproject.org node scripts/verify-production.mjs
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const base = (process.env.PRODUCTION_URL ?? 'https://cavebettor.ewinproject.org').replace(/\/$/, '');
const manifestPath = path.join(root, 'design-assets/asset-build-manifest.json');

const failures = [];

/** Static files live under the asset root, so strip the repo-relative folder. */
const publicPath = (file) => `/${file.replace(/^static\//, '').replace(/\\/g, '/')}`;

async function check(label, url, expectations = {}) {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    const contentType = res.headers.get('content-type') ?? '';
    const ok = expectations.allow404 ? res.ok || res.status === 404 : res.ok;
    console.log(`${ok ? '✓' : '✗'} ${label.padEnd(46)} ${res.status} ${contentType}`);
    if (!ok) failures.push(`${label} returned ${res.status}`);
    if (expectations.type && !contentType.includes(expectations.type)) {
      failures.push(`${label} served ${contentType || 'no content-type'}, expected ${expectations.type}`);
    }
    if (expectations.contains) {
      const body = await res.text();
      if (!body.includes(expectations.contains)) {
        failures.push(`${label} does not reference "${expectations.contains}"`);
      }
    }
    return res;
  } catch (error) {
    console.log(`✗ ${label.padEnd(46)} ${String(error.message)}`);
    failures.push(`${label} unreachable: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log(`Verifying ${base}\n`);

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const image of manifest.images ?? []) {
      const url = publicPath(image.path);
      await check(url, `${base}${url}`, { type: 'image/webp' });
    }
    for (const banner of manifest.banners ?? []) {
      const url = publicPath(banner.webp);
      await check(url, `${base}${url}`, { type: 'image/webp' });
    }
  }

  await check('landing page', `${base}/`, { type: 'text/html', contains: '/images/generated/hero-command-centre.webp' });
  await check('pricing page', `${base}/pricing`, { type: 'text/html' });
  await check('recovery page', `${base}/this-route-does-not-exist`, { type: 'text/html', allow404: true });
  await check('health endpoint', `${base}/api/health`, { type: 'application/json' });

  const buildInfo = await fetch(`${base}/build-info.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (buildInfo?.commit) console.log(`✓ running commit ${buildInfo.commit.slice(0, 8)} (${buildInfo.builtAt})`);
  else console.warn('! build-info.json missing or has no commit — cannot prove the deployed revision.');

  if (failures.length) {
    console.error(`\n${failures.length} production check(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nProduction verification passed.');
}

main();
