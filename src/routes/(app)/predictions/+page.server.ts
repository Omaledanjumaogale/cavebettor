import { SPORTS } from '#lib/data/catalog';
import { awayTeam, fixtureLeague, homeTeam, resolveTeam } from '#lib/data/registry';
import { getPrediction } from '#lib/engine/predictions';
import { round } from '#lib/engine/core';
import { pageFixtureUniverse } from '#lib/server/feed';
import type { PageServerLoad } from './$types';

/** The board changes slowly; keep one copy per isolate so repeat views are instant. */
const BOARD_MEMO_MS = 90_000;
const boardMemo = new Map<string, { at: number; payload: any }>();

export const load: PageServerLoad = async ({ url }) => {
  const sport = url.searchParams.get('sport') ?? 'all';
  // Model probability first: the board is ordered by how likely a selection
  // is to settle, not by how short its price is.
  const sort = url.searchParams.get('sort') ?? 'probability';
  // "all" projects every fixture in the horizon, one headline call each;
  // "value" keeps the stricter positive-edge board.
  const mode = url.searchParams.get('mode') === 'value' ? 'value' : 'all';
  const memoKey = `${sport}|${sort}|${mode}|${url.searchParams.get('page') ?? '1'}`;
  const memo = boardMemo.get(memoKey);
  if (memo && Date.now() - memo.at < BOARD_MEMO_MS) return memo.payload;
  const universe = await pageFixtureUniverse();
  const now = Date.now();
  // Every fixture inside the published horizon is priced. There is no sample
  // of 32: the board exists to project the whole schedule, and a fixture that
  // is omitted here simply never appears for the punter.
  const horizon = now + 3 * 86_400_000;
  const fixtures = universe.fixtures
    .filter((fixture) => fixture.status !== 'finished' && +new Date(fixture.kickoff) <= horizon)
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
  const cardFor = (fixture: (typeof fixtures)[number]) => getPrediction(fixture);

  const bets: any[] = [];
  for (const fixture of fixtures) {
    if (sport !== 'all' && fixture.sport !== sport) continue;
    const prediction = cardFor(fixture);
    const league = fixtureLeague(fixture);
    const common = {
      fixtureId: fixture.id,
      kickoff: fixture.kickoff,
      status: fixture.status,
      sport: fixture.sport,
      league: league.name,
      leagueColour: league.colour,
      home: homeTeam(fixture).name,
      away: awayTeam(fixture).name,
      modelConfidence: prediction.confidence
    };
    if (mode === 'all') {
      // One frozen headline per fixture: no fixture is left without a call.
      const call = prediction.recommended ?? prediction.recommendations[0];
      if (!call) continue;
      bets.push({
        ...call,
        ...common,
        bookmaker: 'Model call',
        impliedProbability: round(1 / call.odds, 4),
        kellyStake: 0,
        stakeNgn: call.edge >= 0.005 ? call.stakeNgn : 0,
        isValue: call.edge >= 0.005,
        risk: call.risk ?? (call.modelProbability > 0.6 ? 'low' : call.modelProbability > 0.4 ? 'medium' : 'high')
      });
    } else {
      for (const bet of prediction.valueBets) {
        bets.push({
          ...bet,
          ...common,
          isValue: true,
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

  const pageSize = 40;
  const requestedPage = Number(url.searchParams.get('page') ?? '1');
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.floor(requestedPage)), pageCount)
    : 1;
  const start = (page - 1) * pageSize;

  const payload = {
    filters: { sport, sort, mode },
    bets: sorted.slice(start, start + pageSize),
    total: bets.length,
    page,
    pageCount,
    pageSize,
    shownFrom: sorted.length ? start + 1 : 0,
    shownTo: Math.min(start + pageSize, sorted.length),
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
    noValue: mode === 'value' ? fixtures
      .filter((f) => f.status === 'scheduled' && cardFor(f).valueBets.length === 0)
      .slice(0, 6)
      .map((f) => ({
        fixtureId: f.id,
        kickoff: f.kickoff,
        sport: f.sport,
        league: fixtureLeague(f).name,
        home: resolveTeam(f.homeId, f.leagueId).name,
        away: resolveTeam(f.awayId, f.leagueId).name,
        confidence: cardFor(f).confidence,
        pick: cardFor(f).recommended
      })) : []
  };

  boardMemo.set(memoKey, { at: Date.now(), payload });
  if (boardMemo.size > 12) boardMemo.delete(boardMemo.keys().next().value as string);
  return payload;
};
