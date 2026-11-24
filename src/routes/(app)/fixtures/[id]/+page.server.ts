import { error } from '@sveltejs/kit';
import { LEAGUE_MAP, MODELS, TEAM_MAP, BOOKMAKERS } from '#lib/data/catalog';
import { awayTeam, fixtureLeague, homeTeam, resolveTeam } from '#lib/data/registry';
import { getFixture } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { getLeagueTable } from '#lib/engine/analytics';
import { cardOf } from '#lib/snapshot';
import { liveCards, livePrediction } from '#lib/server/live';
import { pageFixtureUniverse } from '#lib/server/feed';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const [universe, cards] = await Promise.all([pageFixtureUniverse(), liveCards()]);
  const fixture = universe.fixtures.find((f) => f.id === params.id) ?? getFixture(params.id);
  if (!fixture) throw error(404, 'Fixture not found');
  const prediction = (await livePrediction(fixture.id)) ?? getPrediction(fixture);
  const cardFor = (f: typeof fixture) => cards?.[f.id] ?? cardOf(getPrediction(f));
  const league = fixtureLeague(fixture);
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);

  const related = universe.fixtures
    .filter((f) => f.leagueId === fixture.leagueId && f.id !== fixture.id)
    .slice(0, 5)
    .map((f) => ({ fixture: f, prediction: cardFor(f) }));

  return {
    fixture,
    league,
    home,
    away,
    prediction,
    related,
    table: league.sport === 'football' ? getLeagueTable(league.id).slice(0, 8) : [],
    bookmakers: BOOKMAKERS,
    models: MODELS.filter((m) => m.family !== 'llm').map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      status: m.status,
      accuracy: m.accuracy,
      family: m.family,
      calibration: m.calibration
    }))
  };
};
