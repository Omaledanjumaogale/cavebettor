import { LEAGUE_MAP, SPORTS, TEAM_MAP } from '#lib/data/catalog';
import { getFixtures } from '#lib/engine/fixtures';
import { getPrediction } from '#lib/engine/predictions';
import { round } from '#lib/engine/core';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const sport = url.searchParams.get('sport') ?? 'all';
  const sort = url.searchParams.get('sort') ?? 'edge';
  const fixtures = getFixtures();
  const fixtureMap = new Map(fixtures.map((f) => [f.id, f]));

  const bets: any[] = [];
  for (const fixture of fixtures) {
    if (fixture.status === 'finished') continue;
    const prediction = getPrediction(fixture);
    for (const bet of prediction.valueBets) {
      if (sport !== 'all' && fixture.sport !== sport) continue;
      const league = LEAGUE_MAP[fixture.leagueId];
      bets.push({
        ...bet,
        fixtureId: fixture.id,
        kickoff: fixture.kickoff,
        status: fixture.status,
        sport: fixture.sport,
        league: league.shortName,
        leagueColour: league.colour,
        home: TEAM_MAP[fixture.homeId].name,
        away: TEAM_MAP[fixture.awayId].name,
        homeShort: TEAM_MAP[fixture.homeId].shortName,
        awayShort: TEAM_MAP[fixture.awayId].shortName,
        modelConfidence: prediction.confidence,
        risk: bet.modelProbability > 0.6 ? 'low' : bet.modelProbability > 0.4 ? 'medium' : 'high'
      });
    }
  }

  const sorted = [...bets].sort((a, b) => {
    if (sort === 'confidence') return b.confidence - a.confidence;
    if (sort === 'odds') return b.odds - a.odds;
    if (sort === 'time') return +new Date(a.kickoff) - +new Date(b.kickoff);
    return b.edge - a.edge;
  });

  const uniqueFixtures = new Map<string, any>();
  for (const bet of [...bets].sort((a, b) => b.edge - a.edge)) {
    if (!uniqueFixtures.has(bet.fixtureId)) uniqueFixtures.set(bet.fixtureId, bet);
  }
  const acca = [...uniqueFixtures.values()].slice(0, 3).map((b) => ({ selection: b.selection, odds: b.odds, fixture: `${b.homeShort} vs ${b.awayShort}`, probability: b.modelProbability, fixtureId: b.fixtureId }));
  const accaOdds = round(acca.reduce((a, b) => a * b.odds, 1), 2);
  const accaProbability = round(acca.reduce((a, b) => a * b.probability, 1), 4);

  const sportCounts = SPORTS.map((s) => ({
    ...s,
    bets: bets.filter((b) => b.sport === s.id).length,
    avgEdge: bets.filter((b) => b.sport === s.id).length
      ? bets.filter((b) => b.sport === s.id).reduce((a, b) => a + b.edge, 0) / bets.filter((b) => b.sport === s.id).length
      : 0
  }));

  return {
    filters: { sport, sort },
    bets: sorted.slice(0, 80),
    total: bets.length,
    sports: sportCounts,
    acca: { legs: acca, odds: accaOdds, probability: accaProbability },
    summary: {
      count: bets.length,
      avgEdge: bets.length ? round(bets.reduce((a, b) => a + b.edge, 0) / bets.length, 4) : 0,
      bestEdge: bets.length ? Math.max(...bets.map((b) => b.edge)) : 0,
      avgConfidence: bets.length ? Math.round(bets.reduce((a, b) => a + b.confidence, 0) / bets.length) : 0,
      exposure: bets.reduce((a, b) => a + b.stakeNgn, 0),
      fixtures: uniqueFixtures.size
    },
    noValue: fixtures
      .filter((f) => f.status === 'scheduled' && getPrediction(f).valueBets.length === 0)
      .slice(0, 6)
      .map((f) => ({
        fixtureId: f.id,
        kickoff: f.kickoff,
        league: LEAGUE_MAP[f.leagueId].shortName,
        home: TEAM_MAP[f.homeId].name,
        away: TEAM_MAP[f.awayId].name,
        confidence: getPrediction(f).confidence,
        pick: getPrediction(f).recommended
      }))
  };
};
