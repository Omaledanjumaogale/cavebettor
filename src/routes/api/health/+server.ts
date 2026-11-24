import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { getFixtures } from '#lib/engine/fixtures';
import { DATA_SOURCES, MODELS } from '#lib/data/catalog';
import { convexConfigured, liveSyncStatus, readSnapshot } from '#lib/server/live';
import { feedMeta, mergedFixtures } from '#lib/server/feed';
import type { Fixture } from '#lib/types';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async () => {
  const [snap, wire, meta] = await Promise.all([readSnapshot<Fixture[]>('fixtures'), mergedFixtures(), feedMeta()]);
  const fixtures = wire.providerCount > 0 ? wire.fixtures : (snap ?? getFixtures());
  const sync: any = await liveSyncStatus();
  const llmProvider = privateEnv.AGNES_AI_KEY || process.env.AGNES_AI_KEY
    ? 'agnes'
    : privateEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY
      ? 'openai'
      : 'grounded-template';
  return json({
    status: 'ok',
    service: 'cavebettor',
    version: '1.1.0',
    time: new Date().toISOString(),
    engine: 'CaveBettor Ensemble v7.3',
    source: wire.providerCount > 0 ? 'api-sports' : snap ? 'convex-live' : 'local-engine',
    fixtures: fixtures.length,
    live: fixtures.filter((f) => f.status === 'live' || f.status === 'halftime').length,
    providerFixtures: wire.providerCount,
    competitions: meta?.leagues ?? 0,
    sports: Object.keys(meta?.sports ?? {}),
    feed: meta
      ? { generatedAt: meta.generatedAt, ageMs: meta.ageMs, stale: meta.stale, requests: meta.requests }
      : null,
    models: MODELS.filter((m) => m.status === 'production').length,
    sources: DATA_SOURCES.length,
    llm: llmProvider,
    llmModel: privateEnv.AGNES_MODEL || process.env.AGNES_MODEL || privateEnv.OPENAI_MODEL || process.env.OPENAI_MODEL || null,
    convex: convexConfigured() ? 'configured' : 'local-engine',
    convexSync: sync?.state
      ? { lastSyncedAt: sync.state.lastSyncedAt, fixtures: sync.state.fixtures, predictions: sync.state.predictions, valueSelections: sync.state.valueSelections }
      : null,
    auth: {
      google: Boolean(privateEnv.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID),
      github: Boolean(privateEnv.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID),
      ewin: Boolean(privateEnv.EWIN_CONVEX_SITE_URL || process.env.EWIN_CONVEX_SITE_URL),
      admin: Boolean(privateEnv.SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL)
    },
    site: publicEnv.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || null,
    currency: 'NGN'
  });
};
