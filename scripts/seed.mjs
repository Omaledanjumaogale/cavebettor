#!/usr/bin/env node
/**
 * Seed the Convex demo workspace.
 *
 * Usage:
 *   npx convex dev            # in one terminal (creates deployment + _generated)
 *   node scripts/seed.mjs     # in another
 *
 * Requires a configured Convex project (`npx convex init` or `npx convex dev`).
 */
import { execSync } from 'node:child_process';

console.log('CaveBettor → seeding Convex demo data…');
try {
  execSync('npx convex run seed:seedDemo', { stdio: 'inherit' });
  console.log('\nDone. The demo workspace, fixtures, predictions, models and sources are seeded.');
  console.log('Tip: pass {"reset":true} as JSON to rebuild: npx convex run seed:seedDemo \'{"reset":true}\'');
} catch (error) {
  console.error('\nSeeding failed. Make sure Convex is initialised and the dev deployment is running.');
  console.error('  1. npm run convex:dev');
  console.error('  2. node scripts/seed.mjs');
  process.exit(1);
}
