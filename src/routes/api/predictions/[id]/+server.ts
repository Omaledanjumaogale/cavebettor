import { error, json } from '@sveltejs/kit';
import { getFixture } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { LEAGUE_MAP, TEAM_MAP } from '#lib/data/catalog';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ params }) => {
  const fixture = getFixture(params.id);
  if (!fixture) throw error(404, `Fixture ${params.id} not found`);
  return json({
    fixture,
    league: LEAGUE_MAP[fixture.leagueId],
    home: TEAM_MAP[fixture.homeId],
    away: TEAM_MAP[fixture.awayId],
    prediction: getPrediction(fixture)
  });
};
