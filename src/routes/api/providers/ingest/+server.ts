import { json } from '@sveltejs/kit';
import { syncSecret } from '#lib/server/live';
import { writeCacheIfChanged } from '#lib/server/cache';
import { normaliseProviderFixtures } from '#lib/server/providers/normalise';
import type { ApiFootballFixture, ApiFootballSport } from '#lib/server/providers/apiFootball';
import type { RequestHandler } from './$types';

export const prerender = false;

const SPORTS: ApiFootballSport[] = ['football', 'basketball', 'icehockey', 'nba', 'baseball'];

/**
 * POST /api/providers/ingest
 *
 * Bulk provider rows arrive here and are written to the Cloudflare R2 data
 * plane. Convex only receives small metadata, so the free-tier database and
 * egress allowances stay intact.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  const expected = syncSecret();
  const supplied = request.headers.get('x-cavebettor-sync-secret') ?? '';
  let diff = expected.length ^ supplied.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (supplied.charCodeAt(i) || 0);
  const authorized = (Boolean(expected) && diff === 0) || locals.user?.role === 'super_admin';
  if (!authorized) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    source?: string;
    sport?: string;
    rows?: unknown[];
  };
  const rows = Array.isArray(body.rows) ? (body.rows as ApiFootballFixture[]) : [];
  const sport = (body.sport ?? 'football') as ApiFootballSport;
  if (!SPORTS.includes(sport)) return json({ ok: false, error: 'Unknown sport' }, { status: 400 });

  const { fixtures, rejected } = normaliseProviderFixtures(rows, sport);
  const key = `providers/${sport}/fixtures`;
  const { changed, meta } = await writeCacheIfChanged(key, fixtures, 3 * 3600_000, body.source ?? 'api-football');

  return json({
    ok: true,
    source: body.source ?? 'api-football',
    sport,
    received: rows.length,
    normalised: fixtures.length,
    rejected,
    storage: 'r2',
    changed,
    bytes: meta.bytes,
    storedAt: new Date().toISOString()
  });
};
