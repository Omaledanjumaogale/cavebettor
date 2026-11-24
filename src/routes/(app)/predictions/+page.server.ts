import { LEAGUE_MAP, SPORTS, TEAM_MAP } from '#lib/data/catalog';
import { awayTeam, fixtureLeague, homeTeam, resolveTeam } from '#lib/data/registry';
import { getPrediction } from '#lib/engine/predictions';
import { round } from '#lib/engine/core';
import { cardOf } from '#lib/snapshot';
import { liveCards, readSnapshot } from '#lib/server/live';
import { pageFixtureUniverse } from '#lib/server/feed';
import type { PageServerLoad } from './$types';

/** Hard ceiling on fixtures priced per request (CPU + latency guard). */
const BOARD_SCAN_LIMIT = 32;

/** The board changes slowly; keep one copy per isolate so repeat views are instant. */
const BOARD_MEMO_MS = 90_000;
const boardMemo = new Map<string, { at: number; payload: any }>();

export const load: PageServerLoad = async ({ url }) => {
  const sport = url.searchParams.get('sport') ?? 'all';
  // Model probability first: the board is ordered by how likely a selection
  // is to settle, not by how short its price is.
  const sort = url.searchParams.get('sort') ?? 'probability';
  const memoKey = `${sport}|${sort}`;
  const memo = boardMemo.get(memoKey);
  if (memo && Date.now() - memo.at < BOARD_MEMO_MS) return memo.payload;
  const [universe, cards, board] = await Promise.all([pageFixtureUniverse(), liveCards(), readSnapshot<any[]>('board')]);
  const now = Date.now();
  // Only the next slate is priced: computing every fixture in a 1,300-row
  // window would exceed the Worker CPU budget and return 5xx pages.
  const horizon = now + 3 * 86_400_000;
  const fixtures = universe.fixtures
    .filter((fixture) => fixture.status !== 'finished' && +new Date(fixture.kickoff) <= horizon)
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff))
    .slice(0, BOARD_SCAN_LIMIT);
  const cardFor = (fixture: (typeof fixtures)[number]) => cards?.[fixture.id] ?? cardOf(getPrediction(fixture));

  // Only trust cached board rows that still exist in the current fixture
  // universe; anything else is stale mock data and gets recomputed below.
  const universeIds = new Set(fixtures.map((f) => f.id));
  const liveBoard = (board ?? []).filter((bet: any) => bet.fixture && universeIds.has(bet.fixture.id));

  const bets: any[] = [];
  if (liveBoard.length) {
    for (const bet of liveBoard) {
      const fixture = bet.fixture;
      if (!fixture || fixture.status === 'finished') continue;
      if (sport !== 'all' && fixture.sport !== sport) continue;
      const league = fixtureLeague(fixture);
      const card = cardFor(fixture);
      bets.push({
        ...bet,
        fixtureId: fixture.id,
        kickoff: fixture.kickoff,
        status: fixture.status,
        sport: fixture.sport,
        league: league.name,
        leagueColour: league.colour,
        home: homeTeam(fixture).name,
        away: awayTeam(fixture).name,
        modelConfidence: card.confidence,
        risk: bet.modelProbability > 0.6 ? 'low' : bet.modelProbability > 0.4 ? 'medium' : 'high'
      });
    }
  } else {
    for (const fixture of fixtures) {
      if (fixture.status === 'finished') continue;
      const prediction = cardFor(fixture);
      for (const bet of prediction.valueBets) {
        if (sport !== 'all' && fixture.sport !== sport) continue;
        const league = fixtureLeague(fixture);
        bets.push({
          ...bet,
          fixtureId: fixture.id,
          kickoff: fixture.kickoff,
          status: fixture.status,
          sport: fixture.sport,
          league: league.name,
          leagueColour: league.colour,
          home: homeTeam(fixture).name,
          away: awayTeam(fixture).name,
          modelConfidence: prediction.confidence,
          risk: bet.modelProbability > 0.6 ? 'low' : bet.modelProbability > 0.4 ? 'medium' : 'high'
        });
      }
    }
  }

  const sorted = [...bets].sort((a, b) => {
    if (sort === 'edge') return b.edge - a.edge;
    if (sort === 'confidence') return b.confidence - a.confidence;
    if (sort === 'odds') return b.odds - a.odds;
    if (sort === 'time') return +new Date(a.kickoff) - +new Date(b.kickoff);
    return b.modelProbability - a.modelProbability || b.edge - a.edge;
  });

  const uniqueFixtures = new Map<string, any>();
  for (const bet of [...bets].sort((a, b) => b.modelProbability - a.modelProbability)) {
    if (!uniqueFixtures.has(bet.fixtureId)) uniqueFixtures.set(bet.fixtureId, bet);
  }
  const acca = [...uniqueFixtures.values()].slice(0, 3).map((b) => ({ selection: b.selection, odds: b.odds, fixture: `${b.home} vs ${b.away}`, probability: b.modelProbability, fixtureId: b.fixtureId }));
  const accaOdds = round(acca.reduce((a, b) => a * b.odds, 1), 2);
  const accaProbability = round(acca.reduce((a, b) => a * b.probability, 1), 4);

  const sportCounts = SPORTS.map((s) => ({
    ...s,
    bets: bets.filter((b) => b.sport === s.id).length,
    avgEdge: bets.filter((b) => b.sport === s.id).length
      ? bets.filter((b) => b.sport === s.id).reduce((a, b) => a + b.edge, 0) / bets.filter((b) => b.sport === s.id).length
      : 0
  }));

  const payload = {
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
      .filter((f) => f.status === 'scheduled' && cardFor(f).valueBets.length === 0)
      .slice(0, 6)
      .map((f) => ({
        fixtureId: f.id,
        kickoff: f.kickoff,
        league: fixtureLeague(f).name,
        home: resolveTeam(f.homeId, f.leagueId).name,
        away: resolveTeam(f.awayId, f.leagueId).name,
        confidence: cardFor(f).confidence,
        pick: cardFor(f).recommended
      }))
  };

  boardMemo.set(memoKey, { at: Date.now(), payload });
  if (boardMemo.size > 12) boardMemo.delete(boardMemo.keys().next().value as string);
  return payload;
};
