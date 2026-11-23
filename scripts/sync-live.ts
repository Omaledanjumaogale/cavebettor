import fs from 'node:fs';
import path from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { buildSnapshotBundle } from '../src/lib/snapshot';

const envFile = path.resolve('.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i);
    if (process.env[key]) continue;
    let value = line.slice(i + 1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

const url = process.env.PUBLIC_CONVEX_URL;
const secret = process.env.CAVEBETTOR_SYNC_SECRET;
if (!url || !secret) {
  console.error('PUBLIC_CONVEX_URL and CAVEBETTOR_SYNC_SECRET are required.');
  process.exit(1);
}

const client = new ConvexHttpClient(url);
const bundle = buildSnapshotBundle();
const started = Date.now();

for (const doc of bundle.snapshots) {
  const result = await client.mutation(api.live.pushSnapshot, {
    secret,
    key: doc.key,
    payload: doc.payload,
    counts: doc.counts,
    generatedAt: bundle.generatedAt
  });
  console.log(`snapshot ${doc.key.padEnd(10)} ${(result.bytes / 1024).toFixed(0)} KB`);
}

for (let i = 0; i < bundle.predictions.length; i += 25) {
  const items = bundle.predictions.slice(i, i + 25).map((row) => ({ ...row, generatedAt: bundle.generatedAt }));
  const result = await client.mutation(api.live.pushPredictions, { secret, items });
  process.stdout.write(`predictions ${i + result.written}/${bundle.predictions.length}\r`);
}

const finished = await client.mutation(api.live.finishSync, {
  secret,
  fixtures: bundle.stats.fixtures,
  predictions: bundle.stats.predictions,
  valueSelections: bundle.stats.valueSelections,
  version: bundle.version,
  source: 'local-engine',
  detail: `Synced from the deterministic engine at ${new Date().toISOString()}`
});
console.log(`\nSync complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(JSON.stringify({ ...bundle.stats, lastSyncedAt: finished.lastSyncedAt }, null, 2));
