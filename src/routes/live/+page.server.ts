import { LEAGUE_MAP, SPORTS, TEAM_MAP } from '#lib/data/catalog';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  const fixtures = getFixtures();
  const live = fixtures.filter((f) => f.status === 'live' || f.status === 'halftime');
  const recent = fixtures.filter((f) => f.status === 'finished').slice(-6).reverse();
  const upcoming = fixtures.filter((f) => f.status === 'scheduled').slice(0, 8);

  const pack = (f: (typeof fixtures)[number]) => {
    const p = getPrediction(f);
    return {
      fixture: f,
      prediction: {
        fixtureId: p.fixtureId,
        probabilities: p.probabilities,
        confidence: p.confidence,
        valueBets: p.valueBets.slice(0, 3),
        recommended: p.recommended,
        expectedGoals: p.expectedGoals,
        edge: p.edge,
        insights: p.insights.slice(0, 2),
        bothTeamsScore: p.bothTeamsScore,
        over25: p.over25
      },
      league: LEAGUE_MAP[f.leagueId],
      home: TEAM_MAP[f.homeId],
      away: TEAM_MAP[f.awayId],
      history: Array.from({ length: 18 }, (_, i) => {
        const base = p.probabilities.home * 100;
        return Math.max(4, Math.min(94, base + Math.sin(i / 2.4 + f.id.length) * 4 + (i * 0.22)));
      })
    };
  };

  return {
    live: live.map(pack),
    recent: recent.map(pack),
    upcoming: upcoming.map(pack),
    sports: SPORTS,
    counts: {
      live: live.length,
      goals: live.reduce((a, f) => a + f.score.home + f.score.away, 0),
      value: live.flatMap((f) => getPrediction(f).valueBets).length,
      leagues: new Set(live.map((f) => f.leagueId)).size
    }
  };
};
