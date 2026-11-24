import { json } from '@sveltejs/kit';
import { syncSecret } from '#lib/server/live';
import { feedMeta, mergedFixtures, refreshProviderFeed, refreshLiveNow } from '#lib/server/feed';
import { recentProviderCalls } from '#lib/server/providers/apiFootball';
import { refreshMarketPrices } from '#lib/server/providers/marketFeed';
import { apiFootballSportUsage, budgetSnapshot } from '#lib/server/providers/budget';
import type { RequestHandler } from './$types';

export const prerender = false;

function authorised(request: Request): boolean {
  const expected = syncSecret();
  const supplied = request.headers.get('x-cavebettor-sync-secret') ?? '';
  let diff = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  return Boolean(expected) && diff === 0;
}

const FULL_REFRESH_AFTER = 6 * 3600_000;
const LIVE_SWEEP_AFTER = 12 * 60_000;

/**
 * Decide what the collector should spend this tick.
 *
 * The API-Sports plan allows 100 requests a day for the whole account, so the
 * live sweep is paced against the clock: it only runs while the remaining
 * allowance is ahead of an even burn across the day. That spreads live scores
 * over the full 24 hours instead of exhausting the plan by mid-morning.
 */
async function autoPlan(): Promise<{ mode: 'full' | 'live' | 'idle'; reason: string }> {
  const meta = await feedMeta();
  if (!meta || !meta.fixtureCount) return { mode: 'full', reason: 'no cached feed yet' };
  if (meta.ageMs > FULL_REFRESH_AFTER) return { mode: 'full', reason: 'fixture window older than 6h' };
  if (meta.ageMs < LIVE_SWEEP_AFTER) return { mode: 'idle', reason: 'feed is fresh' };

  const ledger = (await budgetSnapshot()).find((entry) => entry.provider === 'api-football');
  if (!ledger) return { mode: 'live', reason: 'no budget ledger recorded' };

  const now = Date.now();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const dayFraction = (now - midnight.getTime()) / 86_400_000;
  const pacingTarget = ledger.limit * (1 - dayFraction);

  if (ledger.remaining < 6) return { mode: 'idle', reason: `only ${ledger.remaining} requests left today` };
  if (ledger.remaining < pacingTarget) {
    return { mode: 'idle', reason: `holding ${ledger.remaining} requests for later in the day` };
  }
  return { mode: 'live', reason: 'ahead of the daily burn rate' };
}

/**
 * GET /api/providers/refresh — read-only view of the collector state.
 */
export const GET: RequestHandler = async () => {
  const [snapshot, sports, meta, plan] = await Promise.all([
    budgetSnapshot(),
    apiFootballSportUsage(),
    feedMeta(),
    autoPlan()
  ]);
  return json({
    ok: true,
    feed: meta,
    plan,
    budgets: snapshot,
    apiFootballBySport: sports,
    providerCalls: recentProviderCalls(),
    note: 'Provider calls only happen from the scheduled collector or the guarded background revalidation. Page loads read the R2 cache.'
  });
};

/**
 * POST /api/providers/refresh
 *
 * Called by the scheduled collection worker and by the owner console. Omit the
 * body to let the budget planner decide; force a mode with `{ mode: 'full' }`
 * or `{ mode: 'live' }`. Every provider call is still gated by the ledger.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const allowed = authorised(request) || locals.user?.role === 'super_admin';
  if (!allowed) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    mode?: 'full' | 'live' | 'auto';
    fixtures?: boolean;
    live?: boolean;
    markets?: boolean;
    liveOnly?: boolean;
  };

  let mode: 'full' | 'live' | 'idle' = 'full';
  let reason = 'explicit request';
  if (body.mode === 'full' || body.fixtures === true) {
    mode = 'full';
  } else if (body.mode === 'live' || body.liveOnly === true || body.live === true) {
    mode = 'live';
  } else {
    const plan = await autoPlan();
    mode = plan.mode;
    reason = plan.reason;
  }

  const started = Date.now();
  let feed = null;
  let liveRows = 0;

  if (mode === 'full') {
    feed = await refreshProviderFeed();
  } else if (mode === 'live') {
    liveRows = await refreshLiveNow();
    feed = await feedMeta();
  }

  // Market prices are optional: the odds allowance is monthly, so they are
  // refreshed on their own cadence and only for competitions with fixtures.
  let markets: { provider: 'none' | 'the-odds-api' | 'odd-api'; prices: number } = { provider: 'none', prices: 0 };
  if (body.markets === true) {
    const universe = await mergedFixtures();
    const bundle = await refreshMarketPrices(universe.fixtures);
    markets = { provider: bundle.provider, prices: bundle.prices.length };
  }

  const [snapshot, sports, meta] = await Promise.all([budgetSnapshot(), apiFootballSportUsage(), feedMeta()]);

  return json({
    ok: true,
    mode,
    reason,
    liveRows,
    feed: feed ?? meta,
    markets,
    budgets: snapshot,
    apiFootballBySport: sports,
    providerCalls: recentProviderCalls(),
    durationMs: Date.now() - started,
    storage: 'r2',
    at: new Date().toISOString()
  });
};
