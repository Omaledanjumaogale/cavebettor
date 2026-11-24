#!/usr/bin/env node
/**
 * Build-time guard for the static-first delivery model.
 *
 * Fails the pipeline when a public page that must be served as a static HTML
 * file is missing from the build output, and reports which routes stay
 * dynamic (and therefore still require the Worker).
 */
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.svelte-kit/cloudflare');

const STATIC_PAGES = [
  { path: '/', file: 'index.html' },
  { path: '/pricing', file: 'pricing.html' }
];

const DYNAMIC_ROUTES = [
  '/api/*',
  '/auth/*',
  '/dashboard',
  '/fixtures',
  '/live',
  '/odds',
  '/predictions',
  '/models',
  '/scrapers',
  '/analytics',
  '/paper',
  '/settings',
  '/workspace',
  '/admin',
  '/sports',
  '/betslip'
];

async function main() {
  if (!existsSync(output)) {
    console.error(`✗ Build output ${path.relative(root, output)} is missing — run \`npm run build\` first.`);
    process.exitCode = 1;
    return;
  }

  const errors = [];
  for (const page of STATIC_PAGES) {
    const file = path.join(output, page.file);
    if (!existsSync(file)) {
      errors.push(`Static page ${page.path} was not produced (expected ${path.relative(root, file)}).`);
      continue;
    }
    const html = await readFile(file, 'utf8');
    if (!/<html/i.test(html)) errors.push(`${page.file} does not look like an HTML document.`);
    const size = (await stat(file)).size;
    console.log(`✓ ${page.path.padEnd(22)} → ${page.file} (${(size / 1024).toFixed(1)} kB)`);
  }

  const routesFile = path.join(output, '_routes.json');
  if (!existsSync(routesFile)) {
    errors.push('_routes.json was not generated — the adapter route rules are missing.');
  } else {
    const routes = JSON.parse(await readFile(routesFile, 'utf8'));
    const excluded = (routes.exclude ?? []).join(' ');
    for (const page of STATIC_PAGES) {
      if (!excluded.includes(page.file.replace('.html', '')) && !excluded.includes(page.path)) {
        warnings.push(`_routes.json does not exclude ${page.path} from Function invocation.`);
      }
    }
    console.log(`✓ _routes.json excludes ${routes.exclude?.length ?? 0} path pattern(s) from Functions.`);
  }

  for (const warning of warnings) console.warn(`! ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`✗ ${error}`);
    console.error(`\n${errors.length} static-delivery problem(s).`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nStatic pages: ${STATIC_PAGES.map((p) => p.path).join(', ')}`);
  console.log(`Dynamic (Worker-backed): ${DYNAMIC_ROUTES.join(', ')}`);
}

const warnings = [];
main();
