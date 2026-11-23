import { json } from '@sveltejs/kit';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { LEAGUE_MAP, TEAM_MAP } from '#lib/data/catalog';
import type { RequestHandler } from './$types';

export const prerender = false;

/** GET /api/fixtures?sport=football&league=epl&status=live&q=arsenal&limit=50 */
export const GET: RequestHandler = ({ url }) => {
  const p = url.searchParams;
  const sport = p.get('sport');
  const league = p.get('league');
  const status = p.get('status');
  const q = (p.get('q') ?? '').toLowerCase();
  const limit = Math.min(200, Number(p.get('limit') ?? 100));

  const fixtures = getFixtures().filter((f) => {
    if (sport && sport !== 'all' && f.sport !== sport) return false;
    if (league && league !== 'all' && f.leagueId !== league) return false;
    if (status === 'live' && f.status !== 'live' && f.status !== 'halftime') return false;
    if (status === 'upcoming' && f.status !== 'scheduled') return false;
    if (status === 'finished' && f.status !== 'finished') return false;
    if (q) {
      const hay = `${TEAM_MAP[f.homeId]?.name} ${TEAM_MAP[f.awayId]?.name} ${LEAGUE_MAP[f.leagueId]?.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).slice(0, limit);

  return json({
    count: fixtures.length,
    fixtures: fixtures.map((f) => {
      const prediction = getPrediction(f);
      return {
        fixture: f,
        league: LEAGUE_MAP[f.leagueId],
        home: TEAM_MAP[f.homeId],
        away: TEAM_MAP[f.awayId],
        probabilities: prediction.probabilities,
        confidence: prediction.confidence,
        valueBets: prediction.valueBets.slice(0, 2),
        recommended: prediction.recommended
      };
    })
  });
};
