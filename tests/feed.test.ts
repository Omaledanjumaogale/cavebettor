import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCache, writeCache } from '#lib/server/cache';
import { readProviderFixtures, resetFeedMemo } from '#lib/server/feed';

const FEED_KEY = 'feed/fixtures';
const LIVE_KEY = 'feed/live';

function fixture(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    sport: 'football',
    leagueId: 'epl',
    homeId: `${id}-home`,
    awayId: `${id}-away`,
    homeTeam: { id: `${id}-home`, name: 'Home FC', shortName: 'HOM', leagueId: 'epl', sport: 'football' },
    awayTeam: { id: `${id}-away`, name: 'Away FC', shortName: 'AWY', leagueId: 'epl', sport: 'football' },
    league: { id: 'epl', name: 'Premier League', shortName: 'EPL', sport: 'football', country: 'England', colour: '#c9ff4d' },
    kickoff: '2026-11-24T18:00:00.000Z',
    status: 'scheduled',
    score: { home: 0, away: 0 },
    venue: 'Test Ground',
    round: 'Matchday 12',
    h2h: { homeWins: 0, draws: 0, awayWins: 0, last: [] },
    source: 'api-football',
    ...overrides
  } as never;
}

describe('provider feed read model', () => {
  beforeEach(async () => {
    await deleteCache(FEED_KEY);
    await deleteCache(LIVE_KEY);
    await deleteCache('feed/results');
    resetFeedMemo();
  });

  it('returns an empty list instead of a poisoned payload', async () => {
    await writeCache(FEED_KEY, { value: [], storedAt: 1, expiresAt: 2 }, 60_000);
    expect(await readProviderFixtures()).toEqual([]);
  });

  it('overlays the live sweep onto the collected window', async () => {
    await writeCache(
      FEED_KEY,
      [fixture('a'), fixture('b'), fixture('c')],
      60_000
    );
    // Live rows must look like they kicked off recently, otherwise the
    // lifecycle layer is right to call them finished.
    const kickedOff = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
    await writeCache(
      LIVE_KEY,
      [
        fixture('b', { status: 'live', minute: 63, kickoff: kickedOff(70), score: { home: 2, away: 1 } }),
        fixture('d', { status: 'live', minute: 5, kickoff: kickedOff(10) })
      ],
      60_000
    );

    const rows = await readProviderFixtures();
    const byId = new Map(rows.map((row) => [row.id, row]));

    expect(rows).toHaveLength(4);
    expect(byId.get('a')!.status).toBe('scheduled');
    expect(byId.get('b')!.status).toBe('live');
    expect(byId.get('b')!.score).toEqual({ home: 2, away: 1 });
    expect(byId.get('b')!.homeTeam?.name).toBe('Home FC');
    expect(byId.get('d')!.minute).toBe(5);
  });

  it('serves the window alone when the live sweep is missing', async () => {
    await writeCache(FEED_KEY, [fixture('x')], 60_000);
    const rows = await readProviderFixtures();
    expect(rows.map((row) => row.id)).toEqual(['x']);
  });
});
