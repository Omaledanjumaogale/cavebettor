import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { ConvexHttpClient } from 'convex/browser';
import { buildSnapshotBundle } from '#lib/snapshot';
import type { Fixture } from '#lib/types';

const url = publicEnv.PUBLIC_CONVEX_URL || process.env.PUBLIC_CONVEX_URL || '';
const demoMode = (publicEnv.PUBLIC_DEMO_MODE || process.env.PUBLIC_DEMO_MODE || 'false') === 'true';

const TTL = 20_000;
const cache = new Map<string, { at: number; value: unknown }>();
let client: ConvexHttpClient | null = null;

export function convexConfigured() {
  return Boolean(url) && !demoMode;
}

function getClient() {
  if (!client) client = new ConvexHttpClient(url);
  return client;
}

async function withTimeout<T>(promise: Promise<T>, ms = 2600): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Convex request timed out')), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Read a page-shaped snapshot from Convex. Returns null to trigger the local fallback. */
export async function readSnapshot<T>(key: string): Promise<T | null> {
  if (!convexConfigured()) return null;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  try {
    const row = await withTimeout(getClient().query('live:snapshot' as never, { key } as never));
    if (!row || typeof (row as { payload?: unknown }).payload !== 'string') return null;
    const value = JSON.parse((row as { payload: string }).payload) as T;
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return null;
  }
}

export async function liveFixtures(): Promise<Fixture[] | null> {
  return readSnapshot<Fixture[]>('fixtures');
}

export async function liveSyncStatus() {
  if (!convexConfigured()) return null;
  try {
    return await withTimeout(getClient().query('live:status' as never, {} as never));
  } catch {
    return null;
  }
}

export function syncSecret() {
  return privateEnv.CAVEBETTOR_SYNC_SECRET || process.env.CAVEBETTOR_SYNC_SECRET || '';
}

/** Push the current engine read model into Convex. Used by the admin sync route and CLI. */
export async function syncLiveData() {
  const secret = syncSecret();
  if (!convexConfigured() || !secret) throw new Error('Convex live sync is not configured.');
  const c = getClient();
  const bundle = buildSnapshotBundle();
  for (const doc of bundle.snapshots) {
    await c.mutation('live:pushSnapshot' as never, {
      secret,
      key: doc.key,
      payload: doc.payload,
      counts: doc.counts,
      generatedAt: bundle.generatedAt
    } as never);
  }
  for (let i = 0; i < bundle.predictions.length; i += 25) {
    const items = bundle.predictions.slice(i, i + 25).map((row) => ({ ...row, generatedAt: bundle.generatedAt }));
    await c.mutation('live:pushPredictions' as never, { secret, items } as never);
  }
  const finished = await c.mutation('live:finishSync' as never, {
    secret,
    fixtures: bundle.stats.fixtures,
    predictions: bundle.stats.predictions,
    valueSelections: bundle.stats.valueSelections,
    version: bundle.version,
    source: 'cloudflare-pages',
    detail: `Synced from the server engine at ${new Date().toISOString()}`
  } as never);
  cache.clear();
  return { ...bundle.stats, lastSyncedAt: (finished as { lastSyncedAt: number }).lastSyncedAt };
}

export async function convexAdminOverview(secret = syncSecret()) {
  if (!convexConfigured() || !secret) return null;
  try {
    return await withTimeout(getClient().query('auth:overview' as never, { secret } as never), 5000);
  } catch {
    return null;
  }
}
