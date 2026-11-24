import { LEAGUES, SPORTS, TEAM_MAP } from '#lib/data/catalog';
import { awayTeam, fixtureLeague, homeTeam, resolveTeam } from '#lib/data/registry';
import { getPrediction } from '#lib/engine/predictions';
import { cardOf } from '#lib/snapshot';
import { liveCards } from '#lib/server/live';
import { pageFixtureUniverse } from '#lib/server/feed';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const sport = url.searchParams.get('sport') ?? 'all';
  const league = url.searchParams.get('league') ?? 'all';
  const status = url.searchParams.get('status') ?? 'all';
  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const view = url.searchParams.get('view') === 'table' ? 'table' : 'grid';

  const [universe, cards] = await Promise.all([pageFixtureUniverse(), liveCards()]);
  const all = universe.fixtures;
  const cardFor = (fixture: (typeof all)[number]) => cards?.[fixture.id] ?? cardOf(getPrediction(fixture));
  const filtered = all.filter((f) => {
    if (sport !== 'all' && f.sport !== sport) return false;
    if (league !== 'all' && f.leagueId !== league) return false;
    if (status === 'live' && f.status !== 'live' && f.status !== 'halftime') return false;
    if (status === 'upcoming' && f.status !== 'scheduled') return false;
    if (status === 'finished' && f.status !== 'finished') return false;
    if (status === 'value') {
      if (!cardFor(f).valueBets.length) return false;
    }
    if (q) {
      const hay = `${resolveTeam(f.homeId, f.leagueId)?.name} ${resolveTeam(f.awayId, f.leagueId)?.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return {
    filters: { sport, league, status, q, view },
    total: all.length,
    fixtures: filtered.slice(0, 120).map((fixture) => {
      return {
        fixture,
        prediction: cardFor(fixture)
      };
    }),
    leagues: LEAGUES.map((l) => ({ id: l.id, name: l.name, shortName: l.shortName, sport: l.sport, country: l.country, colour: l.colour })),
    sports: SPORTS,
    feedSource: universe.source
  };
};
