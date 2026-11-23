import { error } from '@sveltejs/kit';
import { LEAGUE_MAP, MODELS, TEAM_MAP, BOOKMAKERS } from '#lib/data/catalog';
import { getFixture, getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { getLeagueTable } from '#lib/engine/analytics';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
  const fixture = getFixture(params.id);
  if (!fixture) throw error(404, 'Fixture not found');
  const prediction = getPrediction(fixture);
  const league = LEAGUE_MAP[fixture.leagueId];
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];

  const related = getFixtures()
    .filter((f) => f.leagueId === fixture.leagueId && f.id !== fixture.id)
    .slice(0, 5)
    .map((f) => {
      const p = getPrediction(f);
      return {
        fixture: f,
        prediction: {
          fixtureId: p.fixtureId,
          probabilities: p.probabilities,
          confidence: p.confidence,
          valueBets: p.valueBets.slice(0, 1),
          recommended: p.recommended,
          expectedGoals: p.expectedGoals,
          edge: p.edge
        }
      };
    });

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
