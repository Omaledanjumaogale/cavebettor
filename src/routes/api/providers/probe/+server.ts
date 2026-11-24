import { json } from '@sveltejs/kit';
import { syncSecret } from '#lib/server/live';
import { fetchSportDay, fetchSportLive, recentProviderCalls, type ApiFootballSport } from '#lib/server/providers/apiFootball';
import { normaliseProviderFixtures } from '#lib/server/providers/normalise';
import { isoDate } from '#lib/server/providers/apiFootball';
import type { RequestHandler } from './$types';

export const prerender = false;

const SPORTS: ApiFootballSport[] = ['football', 'basketball', 'icehockey', 'nba', 'baseball'];

function authorised(request: Request, locals: App.Locals): boolean {
  if (locals.user?.role === 'super_admin') return true;
  const expected = syncSecret();
  const supplied = request.headers.get('x-cavebettor-sync-secret') ?? '';
  if (!expected) return false;
  let diff = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  return diff === 0;
}

/**
 * GET /api/providers/probe?sport=football&mode=live|day
 *
 * Owner diagnostic: performs exactly one budgeted provider call for one sport
 * and reports what came back, so a silent fallback is never mistaken for real
 * data. Costs one request from the daily allowance per invocation.
 */
export const GET: RequestHandler = async ({ url, request, locals }) => {
  if (!authorised(request, locals)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const sport = (url.searchParams.get('sport') ?? 'football') as ApiFootballSport;
  if (!SPORTS.includes(sport)) return json({ ok: false, error: `Unknown sport. Use one of ${SPORTS.join(', ')}.` }, { status: 400 });

  const mode = url.searchParams.get('mode') === 'day' ? 'day' : 'live';
  const day = url.searchParams.get('date') ?? isoDate(0);
  const started = Date.now();

  const result = mode === 'day' ? await fetchSportDay(sport, day) : await fetchSportLive(sport);
  let mapped: unknown = null;
  let mapError: string | null = null;
  try {
    mapped = result.rows.length ? normaliseProviderFixtures(result.rows, sport).fixtures.slice(0, 1) : [];
  } catch (error) {
    mapError = String(error);
  }

  return json({
    ok: true,
    sport,
    mode,
    day: mode === 'day' ? day : undefined,
    source: result.source,
    rows: result.rows.length,
    mapped: Array.isArray(mapped) ? mapped.length : 0,
    sample: mapped,
    mapError,
    calls: recentProviderCalls(),
    durationMs: Date.now() - started
  });
};
