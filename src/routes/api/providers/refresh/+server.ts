import { json } from '@sveltejs/kit';
import { syncSecret } from '#lib/server/live';
import { refreshProviderFeed, refreshLiveNow, mergedFixtures } from '#lib/server/feed';
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

/**
 * GET /api/providers/refresh — read-only view of the collector state.
 */
export const GET: RequestHandler = async () => {
  const [snapshot, sports] = await Promise.all([budgetSnapshot(), apiFootballSportUsage()]);
  return json({
    ok: true,
    budgets: snapshot,
    apiFootballBySport: sports,
    note: 'Provider calls only happen from the scheduled collector. Page loads read the R2 cache.'
  });
};

/**
 * POST /api/providers/refresh
 *
 * Called by the scheduled collection worker. Each provider call is gated by
 * the budget ledger, so this route can be invoked freely without exceeding
 * the plan ceilings.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const allowed = authorised(request) || locals.user?.role === 'super_admin';
  if (!allowed) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { live?: boolean; fixtures?: boolean; markets?: boolean };

  const started = Date.now();
  const fixtures =
    body.fixtures === false
      ? { provider: 0, rejected: 0, sports: [], requests: 0 }
      : await refreshProviderFeed();
  const live = body.live === false ? 0 : await refreshLiveNow();

  // Market prices are optional: the odds allowance is monthly, so they are
  // refreshed on their own cadence and only for competitions with fixtures.
  let markets: { provider: 'none' | 'the-odds-api' | 'odd-api'; prices: number } = { provider: 'none', prices: 0 };
  if (body.markets !== false) {
    const universe = await mergedFixtures();
    const bundle = await refreshMarketPrices(universe.fixtures);
    markets = { provider: bundle.provider, prices: bundle.prices.length };
  }

  const snapshot = await budgetSnapshot();
  const sports = await apiFootballSportUsage();

  return json({
    ok: true,
    fixtures,
    liveRows: live,
    markets,
    budgets: snapshot,
    apiFootballBySport: sports,
    durationMs: Date.now() - started,
    storage: 'r2',
    at: new Date().toISOString()
  });
};
