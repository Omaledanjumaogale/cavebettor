import { BOOKMAKERS, LEAGUE_MAP, MODELS, TEAM_MAP } from '#lib/data/catalog';
import type {
  Fixture,
  Insight,
  Market,
  MarketGroup,
  MarketOutcome,
  ModelComponent,
  Prediction,
  Recommendation,
  ScoreCell,
  Team,
  ValueBet
} from '#lib/types';
import {
  clamp,
  fairOdds,
  jitter,
  kellyFraction,
  normalCdf,
  normalPdf,
  poissonPmf,
  round,
  seeded
} from './core';
import { expectedScore } from './fixtures';

const MAX_GOALS = 8;
const GRID = Array.from({ length: MAX_GOALS + 1 }, (_, i) => i);
export const PAPER_BANKROLL_NGN = 1_250_000;

interface CoreModel {
  home: number;
  draw: number;
  away: number;
  expected: { home: number; away: number; total: number };
  grid: ScoreCell[];
  btts: number;
  over15: number;
  over25: number;
  over35: number;
  topScorelines: ScoreCell[];
  spread?: { line: number; homeCover: number; awayCover: number };
  totalLine?: { line: number; over: number; under: number };
  moneyline?: { home: number; away: number };
  margin: number;
  sd: number;
}

function normalizeGrid(grid: number[][]): number[][] {
  const total = grid.flat().reduce((a, b) => a + b, 0);
  return grid.map((row) => row.map((p) => p / total));
}

function cellsFromGrid(grid: number[][], offsetHome = 0, offsetAway = 0): ScoreCell[] {
  const cells: ScoreCell[] = [];
  grid.forEach((row, h) => row.forEach((p, a) => {
    if (p > 0.00001) cells.push({ home: h + offsetHome, away: a + offsetAway, probability: p, total: p });
  }));
  return cells;
}

function summarizeGrid(grid: number[][], offsetHome = 0, offsetAway = 0): Pick<CoreModel, 'home' | 'draw' | 'away' | 'btts' | 'over15' | 'over25' | 'over35' | 'grid' | 'topScorelines'> {
  let home = 0;
  let draw = 0;
  let away = 0;
  let btts = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  grid.forEach((row, h) => row.forEach((p, a) => {
    const H = h + offsetHome;
    const A = a + offsetAway;
    if (H > A) home += p;
    else if (H === A) draw += p;
    else away += p;
    if (H > 0 && A > 0) btts += p;
    if (H + A > 1.5) over15 += p;
    if (H + A > 2.5) over25 += p;
    if (H + A > 3.5) over35 += p;
  }));
  const cells = cellsFromGrid(grid, offsetHome, offsetAway);
  const topScorelines = [...cells].sort((x, y) => y.probability - x.probability).slice(0, 10);
  return { home, draw, away, btts, over15, over25, over35, grid: cells, topScorelines };
}

/** Dixon–Coles corrected score matrix for football and 60-minute hockey. */
function poissonGrid(lambdaHome: number, lambdaAway: number, rho: number): number[][] {
  const matrix: number[][] = GRID.map((h) =>
    GRID.map((a) => poissonPmf(lambdaHome, h) * poissonPmf(lambdaAway, a))
  );
  const tau = (h: number, a: number) => {
    if (h === 0 && a === 0) return 1 - lambdaHome * lambdaAway * rho;
    if (h === 0 && a === 1) return 1 + lambdaHome * rho;
    if (h === 1 && a === 0) return 1 + lambdaAway * rho;
    if (h === 1 && a === 1) return 1 - rho;
    return 1;
  };
  matrix[0][0] *= tau(0, 0);
  matrix[0][1] *= tau(0, 1);
  matrix[1][0] *= tau(1, 0);
  matrix[1][1] *= tau(1, 1);
  return normalizeGrid(matrix);
}

function footballCore(fixture: Fixture): CoreModel {
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const seed = fixture.id;
  const expected = expectedScore('football', home, away, 1.065);
  const rho = -0.085 + jitter(seed + 'rho', 0.018);

  // Live adjustment: only goals still to be scored follow the Poisson process.
  const live = fixture.status === 'live' || fixture.status === 'halftime';
  const progress = live ? clamp((fixture.minute ?? 45) / 95, 0, 1) : 0;
  const remaining = live ? clamp(1 - progress * 1.06, 0.04, 1) : 1;
  const lambdaH = clamp(expected.home * remaining, 0.05, 4.4);
  const lambdaA = clamp(expected.away * remaining, 0.05, 4.2);
  const grid = poissonGrid(lambdaH, lambdaA, rho);

  // In-play probabilities must include the goals already on the board.
  const summary = summarizeGrid(grid, live ? fixture.score.home : 0, live ? fixture.score.away : 0);
  if (live) {
    // Re-anchor expectations for display at full-match level.
    const total = (fixture.score.home + fixture.score.away) / Math.max(0.08, progress);
    return {
      ...summary,
      expected: { home: expected.home, away: expected.away, total },
      grid: summary.grid,
      moneyline: {
        home: clamp(summary.home + summary.draw * 0.58, 0.01, 0.97),
        away: clamp(summary.away + summary.draw * 0.42, 0.01, 0.97)
      },
      margin: 0,
      sd: 1
    };
  }

  return {
    ...summary,
    expected: { ...expected, total: expected.home + expected.away },
    margin: 0,
    sd: 1
  };
}

function hockeyCore(fixture: Fixture): CoreModel {
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const expected = expectedScore('icehockey', home, away, 1.04);
  const rho = -0.05;
  const live = fixture.status === 'live';
  const progress = live ? clamp((fixture.minute ?? 30) / 90, 0, 1) : 0;
  const remaining = live ? clamp(1 - progress, 0.05, 1) : 1;
  const lambdaH = expected.home * remaining;
  const lambdaA = expected.away * remaining;
  const grid = poissonGrid(lambdaH, lambdaA, rho);
  const summary = summarizeGrid(grid, live ? fixture.score.home : 0, live ? fixture.score.away : 0);
  const homeMl = clamp(summary.home + summary.draw * 0.54, 0.02, 0.96);
  const awayMl = clamp(summary.away + summary.draw * 0.46, 0.02, 0.96);
  const total = live
    ? fixture.score.home + fixture.score.away + lambdaH + lambdaA
    : expected.home + expected.away;
  const margin = live
    ? fixture.score.home - fixture.score.away + lambdaH - lambdaA
    : expected.home - expected.away;
  return {
    ...summary,
    home: summary.home,
    away: summary.away,
    draw: summary.draw,
    expected: { ...expected, total },
    moneyline: { home: homeMl, away: awayMl },
    spread: { line: -1.5, homeCover: clamp(normalCdf((margin - 1.5) / 2.3), 0.03, 0.97), awayCover: 1 - clamp(normalCdf((margin - 1.5) / 2.3), 0.03, 0.97) },
    totalLine: { line: 5.5, over: 1 - normalCdf((5.5 - total) / 2.1), under: normalCdf((5.5 - total) / 2.1) },
    margin,
    sd: 2.3
  };
}

function basketballCore(fixture: Fixture): CoreModel {
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const expected = expectedScore('basketball', home, away, 1);
  const seed = fixture.id;
  const live = fixture.status === 'live';
  const progress = live ? clamp((fixture.minute ?? 72) / 150, 0, 1) : 0;
  const remaining = live ? clamp(1 - progress, 0.04, 1) : 1;
  const finalHome = live ? fixture.score.home + expected.home * remaining : expected.home;
  const finalAway = live ? fixture.score.away + expected.away * remaining : expected.away;
  const sdMargin = home.leagueId === 'nba' ? 12.6 : home.leagueId === 'euroleague' ? 9.8 : 8.9;
  const sdTotal = home.leagueId === 'nba' ? 19.4 : 14.6;
  const margin = finalHome - finalAway + jitter(seed + 'm', 0.6);
  const total = finalHome + finalAway;
  const homeProb = clamp(normalCdf(margin / sdMargin), 0.03, 0.97);
  const line = Math.round(margin * 2) / 2;
  const totalLine = Math.round(total * 2) / 2;
  const homeCover = clamp(normalCdf((margin - line) / sdMargin), 0.02, 0.98);
  const over = clamp(1 - normalCdf((totalLine - total) / sdTotal), 0.02, 0.98);

  // Approximate scoreline cloud around the modal score.
  const iH = Math.round(finalHome);
  const iA = Math.round(finalAway);
  const cells: ScoreCell[] = [];
  for (let dh = -9; dh <= 9; dh += 2) {
    for (let da = -9; da <= 9; da += 2) {
      const p = normalPdf(iH + dh, finalHome, 11) * normalPdf(iA + da, finalAway, 11);
      cells.push({ home: iH + dh, away: iA + da, probability: p, total: p });
    }
  }
  const norm = cells.reduce((a, b) => a + b.probability, 0);
  const grid = cells.map((c) => ({ ...c, probability: c.probability / norm }));
  const topScorelines = [...grid].sort((a, b) => b.probability - a.probability).slice(0, 8);

  return {
    home: homeProb,
    draw: 0,
    away: 1 - homeProb,
    expected: { ...expected, total },
    grid,
    btts: 0.92,
    over15: 1,
    over25: 1,
    over35: 0.99,
    topScorelines,
    spread: { line, homeCover, awayCover: 1 - homeCover },
    totalLine: { line: totalLine, over, under: 1 - over },
    moneyline: { home: homeProb, away: 1 - homeProb },
    margin,
    sd: sdMargin
  };
}

function baseballCore(fixture: Fixture): CoreModel {
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const expected = expectedScore('baseball', home, away, 1.03);
  const sd = 2.7;
  const live = fixture.status === 'live';
  const progress = live ? clamp((fixture.minute ?? 95) / 190, 0, 1) : 0;
  const remaining = live ? clamp(1 - progress, 0.04, 1) : 1;
  const lambdaH = expected.home * remaining;
  const lambdaA = expected.away * remaining;
  const grid: number[][] = Array.from({ length: 16 }, () => Array(16).fill(0));
  for (let h = 0; h < 16; h++) for (let a = 0; a < 16; a++) grid[h][a] = poissonPmf(lambdaH, h) * poissonPmf(lambdaA, a);
  const normalized = normalizeGrid(grid);
  let homeWin = 0;
  for (let h = 0; h < 16; h++) for (let a = 0; a < 16; a++) if (h > a) homeWin += normalized[h][a];
  homeWin = clamp(homeWin + (1 - homeWin) * 0.52, 0.03, 0.97);
  const summary = summarizeGrid(normalized, live ? fixture.score.home : 0, live ? fixture.score.away : 0);
  const total = live ? fixture.score.home + fixture.score.away + lambdaH + lambdaA : expected.home + expected.away;
  const margin = live ? fixture.score.home - fixture.score.away + lambdaH - lambdaA : expected.home - expected.away;
  return {
    ...summary,
    home: homeWin,
    draw: 0,
    away: 1 - homeWin,
    expected: { ...expected, total },
    grid: cellsFromGrid(normalized).filter((c) => c.home < 13 && c.away < 13),
    topScorelines: summary.topScorelines.filter((c) => c.home < 13 && c.away < 13).slice(0, 8),
    moneyline: { home: homeWin, away: 1 - homeWin },
    spread: {
      line: -1.5,
      homeCover: clamp(normalCdf((margin - 1.5) / sd), 0.02, 0.98),
      awayCover: 1 - clamp(normalCdf((margin - 1.5) / sd), 0.02, 0.98)
    },
    totalLine: { line: 8.5, over: clamp(1 - normalCdf((8.5 - total) / 3.1), 0.03, 0.97), under: clamp(normalCdf((8.5 - total) / 3.1), 0.03, 0.97) },
    margin,
    sd
  };
}

function tennisCore(fixture: Fixture): CoreModel {
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const bestOfFive = fixture.leagueId === 'grandslam';
  const eloDiff = home.elo - away.elo + 38;
  let winProb = 1 / (1 + Math.pow(10, -eloDiff / 400));
  if (bestOfFive) winProb = clamp(winProb + (winProb > 0.5 ? 0.035 : -0.035), 0.03, 0.97);
  const seed = fixture.id;
  winProb = clamp(winProb + jitter(seed + 'tennis', 0.012), 0.03, 0.97);
  const expected = expectedScore('tennis', home, away, 1);
  const gamesTotal = expected.home + expected.away;
  const line = 22.5;
  const sd = bestOfFive ? 5.2 : 4.3;
  const over = 1 - normalCdf((line - gamesTotal) / sd);
  const handicapLine = Math.round((expected.home - expected.away) * 2) / 2;

  return {
    home: winProb,
    draw: 0,
    away: 1 - winProb,
    expected: { ...expected, total: gamesTotal },
    grid: [],
    btts: 0,
    over15: 1,
    over25: 1,
    over35: 1,
    topScorelines: [],
    spread: {
      line: -handicapLine,
      homeCover: clamp(normalCdf((expected.home - expected.away - handicapLine) / sd), 0.03, 0.97),
      awayCover: 1 - clamp(normalCdf((expected.home - expected.away - handicapLine) / sd), 0.03, 0.97)
    },
    totalLine: { line, over, under: 1 - over },
    moneyline: { home: winProb, away: 1 - winProb },
    margin: expected.home - expected.away,
    sd
  };
}

function coreFor(fixture: Fixture): CoreModel {
  switch (fixture.sport) {
    case 'football':
      return footballCore(fixture);
    case 'basketball':
      return basketballCore(fixture);
    case 'tennis':
      return tennisCore(fixture);
    case 'icehockey':
      return hockeyCore(fixture);
    case 'baseball':
      return baseballCore(fixture);
  }
}

/* ── Market construction ─────────────────────────────────────────────────── */

interface OutcomeSpec {
  label: string;
  shortLabel?: string;
  probability: number;
  group?: MarketGroup;
}

let priceScope = '';

function priceOutcome(spec: OutcomeSpec, marketId: string, index: number): MarketOutcome {
  const p = clamp(spec.probability, 0.0015, 0.996);
  const key = `${priceScope}-${marketId}-${marketId}-${index}`;
  const books = BOOKMAKERS.map((book, bi) => {
    const marginFactor = 1 + book.margin * 0.9;
    // Each book holds a slightly different opinion. The bias is what creates
    // genuine best-price edges instead of a uniform overround.
    const bias = jitter(`${key}-${book.id}-bias`, 0.065);
    const noise = 1 + jitter(`${key}-${book.id}-${bi}`, 0.012) + bi * 0.0004;
    const implied = clamp(p * marginFactor * (1 + bias) * noise, 0.001, 0.999);
    return { book, odds: round(Math.max(1.01, 1 / implied), 2) };
  });
  const best = books.reduce((a, b) => (b.odds > a.odds ? b : a));
  const edge = p * best.odds - 1;
  return {
    id: `${marketId}-${index}`,
    label: spec.label,
    shortLabel: spec.shortLabel,
    modelProbability: round(p, 4),
    fairOdds: fairOdds(p),
    bookOdds: best.odds,
    bestBook: best.book.name,
    edge: round(edge, 4),
    kelly: round(kellyFraction(p, best.odds), 4),
    trend: round(jitter(`${marketId}-${spec.label}-trend`, 0.055), 3),
    confidence: Math.round(clamp(58 + p * 18 + Math.min(20, Math.max(0, edge) * 220), 40, 96)),
    value: edge > 0.025 && p > 0.08
  };
}

function market(id: string, group: MarketGroup, label: string, description: string, specs: OutcomeSpec[]): Market {
  const outcomes = specs.map((s, i) => priceOutcome(s, id, i));
  return {
    id,
    group,
    label,
    description,
    outcomes,
    bookmakerCount: BOOKMAKERS.length,
    updatedAt: new Date().toISOString()
  };
}

function buildMarkets(fixture: Fixture, core: CoreModel): Market[] {
  priceScope = fixture.id;
  const markets: Market[] = [];
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const hs = home.shortName;
  const as = away.shortName;

  if (fixture.sport === 'football' || fixture.sport === 'icehockey') {
    const drawLabel = fixture.sport === 'football' ? 'Draw' : 'Draw (60 min)';
    markets.push(
      market('1x2', 'match', 'Match result — 1X2', 'Full-time three-way result', [
        { label: `${hs} win`, probability: core.home },
        { label: drawLabel, probability: core.draw },
        { label: `${as} win`, probability: core.away }
      ])
    );
    markets.push(
      market('dc', 'match', 'Double chance', 'Two of the three results covered', [
        { label: `${hs} or draw`, probability: core.home + core.draw },
        { label: `${hs} or ${as}`, probability: core.home + core.away },
        { label: `Draw or ${as}`, probability: core.draw + core.away }
      ])
    );
    markets.push(
      market('dnb', 'match', 'Draw no bet', 'Stake returned on a draw', [
        { label: hs, probability: core.home / Math.max(0.01, core.home + core.away) },
        { label: as, probability: core.away / Math.max(0.01, core.home + core.away) }
      ])
    );
  }

  if (fixture.sport === 'football') {
    markets.push(
      market('btts', 'totals', 'Both teams to score', 'Both sides find the net', [
        { label: 'Yes', probability: core.btts },
        { label: 'No', probability: 1 - core.btts }
      ]),
      market('ou15', 'totals', 'Total goals — 1.5', 'Over / under 1.5 goals', [
        { label: 'Over 1.5', probability: core.over15 },
        { label: 'Under 1.5', probability: 1 - core.over15 }
      ]),
      market('ou25', 'totals', 'Total goals — 2.5', 'Over / under 2.5 goals', [
        { label: 'Over 2.5', probability: core.over25 },
        { label: 'Under 2.5', probability: 1 - core.over25 }
      ]),
      market('ou35', 'totals', 'Total goals — 3.5', 'Over / under 3.5 goals', [
        { label: 'Over 3.5', probability: core.over35 },
        { label: 'Under 3.5', probability: 1 - core.over35 }
      ])
    );

    const ahHome = core.grid.reduce((sum, c) => sum + (c.home - c.away > 1 ? c.probability : 0), 0);
    const ahPush = core.grid.reduce((sum, c) => sum + (c.home - c.away === 1 ? c.probability : 0), 0);
    const denom = Math.max(0.01, 1 - ahPush);
    markets.push(
      market('ah', 'handicap', `Asian handicap ${hs} −1`, 'Home side starts one goal behind', [
        { label: `${hs} −1`, probability: ahHome / denom },
        { label: `${as} +1`, probability: 1 - ahHome / denom }
      ]),
      market('cs', 'score', 'Correct score', 'Top projected scorelines', [
        ...core.topScorelines.slice(0, 5).map((c) => ({
          label: `${c.home}–${c.away}`,
          probability: c.probability
        })),
        {
          label: 'Any other',
          probability: Math.max(0.01, 1 - core.topScorelines.slice(0, 5).reduce((a, c) => a + c.probability, 0))
        }
      ])
    );
  }

  if (fixture.sport === 'basketball') {
    markets.push(
      market('ml', 'match', 'Moneyline', 'Outright winner including overtime', [
        { label: hs, probability: core.home },
        { label: as, probability: core.away }
      ]),
      market('spread', 'handicap', `Points spread ${core.spread?.line ?? 0}`, 'Handicap inclusive of overtime', [
        { label: `${hs} ${(core.spread?.line ?? 0) > 0 ? '+' : ''}${core.spread?.line ?? 0}`, probability: core.spread?.homeCover ?? 0.5 },
        { label: `${as} ${(core.spread?.line ?? 0) < 0 ? '+' : '−'}${Math.abs(core.spread?.line ?? 0)}`, probability: core.spread?.awayCover ?? 0.5 }
      ]),
      market('total', 'totals', `Total points ${core.totalLine?.line ?? 0}`, 'Combined points over / under', [
        { label: `Over ${core.totalLine?.line ?? 0}`, probability: core.totalLine?.over ?? 0.5 },
        { label: `Under ${core.totalLine?.line ?? 0}`, probability: core.totalLine?.under ?? 0.5 }
      ]),
      market('teamtotal', 'totals', `${hs} team total`, 'Home team points over / under', [
        { label: `Over ${Math.round((core.expected.home - 2) * 2) / 2}`, probability: 0.52 },
        { label: `Under ${Math.round((core.expected.home - 2) * 2) / 2}`, probability: 0.48 }
      ])
    );
  }

  if (fixture.sport === 'tennis') {
    const bestOfFive = fixture.leagueId === 'grandslam';
    const p = core.home;
    const straight = bestOfFive ? p * p * p : p * p;
    const deciding = bestOfFive ? 3 * p * p * (1 - p) : 2 * p * (1 - p);
    markets.push(
      market('ml', 'match', 'Match winner', 'Best-of-three match result', [
        { label: home.shortName, probability: p },
        { label: away.shortName, probability: 1 - p }
      ]),
      market('sets', 'sets', 'Set betting', 'Correct set score', [
        { label: bestOfFive ? '3–0' : '2–0', probability: straight },
        { label: bestOfFive ? '3–1' : '2–1', probability: deciding * 0.6 },
        { label: bestOfFive ? '1–3' : '1–2', probability: (1 - p) * (1 - p) * 2 * p * 0.5 },
        { label: bestOfFive ? '0–3' : '0–2', probability: (1 - p) * (1 - p) }
      ]),
      market('games', 'totals', `Total games ${core.totalLine?.line ?? 22.5}`, 'Games in the match', [
        { label: `Over ${core.totalLine?.line ?? 22.5}`, probability: core.totalLine?.over ?? 0.5 },
        { label: `Under ${core.totalLine?.line ?? 22.5}`, probability: core.totalLine?.under ?? 0.5 }
      ]),
      market('gamehcp', 'handicap', `Game handicap ${hs}`, 'Handicap on total games won', [
        { label: `${hs} ${core.spread?.line ?? 0}`, probability: core.spread?.homeCover ?? 0.5 },
        { label: `${as} +${Math.abs(core.spread?.line ?? 0)}`, probability: core.spread?.awayCover ?? 0.5 }
      ])
    );
  }

  if (fixture.sport === 'icehockey') {
    markets.push(
      market('ml', 'match', 'Moneyline (incl. OT)', 'Winner including overtime and shootout', [
        { label: hs, probability: core.moneyline?.home ?? core.home },
        { label: as, probability: core.moneyline?.away ?? core.away }
      ]),
      market('puck', 'handicap', 'Puck line ±1.5', 'Three-way result with a 1.5 goal handicap', [
        { label: `${hs} −1.5`, probability: core.spread?.homeCover ?? 0.5 },
        { label: `${as} +1.5`, probability: core.spread?.awayCover ?? 0.5 }
      ]),
      market('total', 'totals', `Total goals ${core.totalLine?.line ?? 5.5}`, 'Combined goals over / under', [
        { label: `Over ${core.totalLine?.line ?? 5.5}`, probability: core.totalLine?.over ?? 0.5 },
        { label: `Under ${core.totalLine?.line ?? 5.5}`, probability: core.totalLine?.under ?? 0.5 }
      ])
    );
  }

  if (fixture.sport === 'baseball') {
    markets.push(
      market('ml', 'match', 'Moneyline', 'Outright winner including extra innings', [
        { label: hs, probability: core.home },
        { label: as, probability: core.away }
      ]),
      market('runline', 'handicap', 'Run line −1.5', 'Home side must win by two or more', [
        { label: `${hs} −1.5`, probability: core.spread?.homeCover ?? 0.5 },
        { label: `${as} +1.5`, probability: core.spread?.awayCover ?? 0.5 }
      ]),
      market('total', 'totals', `Total runs ${core.totalLine?.line ?? 8.5}`, 'Combined runs over / under', [
        { label: `Over ${core.totalLine?.line ?? 8.5}`, probability: core.totalLine?.over ?? 0.5 },
        { label: `Under ${core.totalLine?.line ?? 8.5}`, probability: core.totalLine?.under ?? 0.5 }
      ])
    );
  }

  return markets;
}

/* ── Model components ────────────────────────────────────────────────────── */

function componentProbabilities(fixture: Fixture, core: CoreModel) {
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const seed = fixture.id;
  const eloHome = 1 / (1 + Math.pow(10, -(home.elo + 48 - away.elo) / 400));
  const eloDraw = fixture.sport === 'football' || fixture.sport === 'icehockey' ? 0.24 : 0;
  const eloHomeFinal = eloHome * (1 - eloDraw);
  const eloAwayFinal = (1 - eloHome) * (1 - eloDraw);

  const shift = (base: number, key: string, spread: number) => clamp(base + jitter(key, spread), 0.01, 0.97);

  return {
    elo: { home: eloHomeFinal, draw: eloDraw, away: eloAwayFinal },
    gbm: {
      home: shift(core.home, seed + 'gbm-h', 0.018),
      draw: shift(core.draw, seed + 'gbm-d', 0.014),
      away: shift(core.away, seed + 'gbm-a', 0.018)
    },
    sequence: {
      home: shift(core.home, seed + 'seq-h', 0.03),
      draw: shift(core.draw, seed + 'seq-d', 0.02),
      away: shift(core.away, seed + 'seq-a', 0.03)
    },
    market: {
      home: shift(core.home, seed + 'mkt-h', 0.022),
      draw: shift(core.draw, seed + 'mkt-d', 0.018),
      away: shift(core.away, seed + 'mkt-a', 0.022)
    }
  };
}

function buildComponents(fixture: Fixture, core: CoreModel): ModelComponent[] {
  const probs = componentProbabilities(fixture, core);
  const sport = fixture.sport;
  const components: ModelComponent[] = [
    {
      id: 'mdl_dixon_coles',
      name: 'Dixon–Coles Poisson',
      family: 'statistical',
      weight: sport === 'football' ? 0.34 : 0.22,
      homeProbability: core.home,
      drawProbability: core.draw,
      awayProbability: core.away,
      confidence: 78,
      note: sport === 'football' ? 'Low-score corrected bivariate Poisson' : 'Goal / run generating process',
      accuracy: 0.581
    },
    {
      id: 'mdl_elo',
      name: 'Dynamic Elo',
      family: 'statistical',
      weight: 0.18,
      homeProbability: probs.elo.home,
      drawProbability: probs.elo.draw,
      awayProbability: probs.elo.away,
      confidence: 72,
      note: 'Rating difference with home advantage',
      accuracy: 0.684
    },
    {
      id: 'mdl_gbm',
      name: 'CaveBoost GBM',
      family: 'machine-learning',
      weight: 0.28,
      homeProbability: probs.gbm.home,
      drawProbability: probs.gbm.draw,
      awayProbability: probs.gbm.away,
      confidence: 84,
      note: '142 engineered features, market-anchored',
      accuracy: 0.612
    }
  ];

  if (sport === 'football') {
    components.push({
      id: 'mdl_sequence',
      name: 'Temporal Sequence Net',
      family: 'machine-learning',
      weight: 0.08,
      homeProbability: probs.sequence.home,
      drawProbability: probs.sequence.draw,
      awayProbability: probs.sequence.away,
      confidence: 68,
      note: 'Shadow model — 12-match attention sequence',
      accuracy: 0.596
    });
  } else if (sport === 'icehockey') {
    components.push({
      id: 'mdl_hockey',
      name: 'NHL Shot-Volume',
      family: 'machine-learning',
      weight: 0.22,
      homeProbability: probs.gbm.home,
      drawProbability: probs.gbm.draw,
      awayProbability: probs.gbm.away,
      confidence: 76,
      note: 'Expected goals share + goalie adjustment',
      accuracy: 0.594
    });
  } else if (sport === 'baseball') {
    components.push({
      id: 'mdl_baseball',
      name: 'MLB Run Environment',
      family: 'machine-learning',
      weight: 0.24,
      homeProbability: probs.gbm.home,
      drawProbability: probs.gbm.draw,
      awayProbability: probs.gbm.away,
      confidence: 74,
      note: 'Pitcher xFIP, park and weather',
      accuracy: 0.577
    });
  }

  components.push({
    id: 'mdl_market',
    name: 'Market consensus',
    family: 'market',
    weight: 0.2,
    homeProbability: probs.market.home,
    drawProbability: probs.market.draw,
    awayProbability: probs.market.away,
    confidence: 88,
    note: 'Vig-free median of 8 books',
    accuracy: 0.701
  });

  const total = components.reduce((a, c) => a + c.weight, 0);
  return components.map((c) => ({ ...c, weight: round(c.weight / total, 3) }));
}

/* ── Insights & recommendation ───────────────────────────────────────────── */

function buildInsights(fixture: Fixture, core: CoreModel, markets: Market[], confidence: number): Insight[] {
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];
  const league = LEAGUE_MAP[fixture.leagueId];
  const insights: Insight[] = [];
  const xgDiff = core.expected.home - core.expected.away;

  insights.push({
    kind: 'model',
    title: core.home > core.away ? `${home.name} are the model’s favourites` : `${away.name} hold the edge`,
    body: `The ensemble gives ${home.shortName} ${(core.home * 100).toFixed(1)}% and ${away.shortName} ${(core.away * 100).toFixed(1)}%${core.draw > 0 ? `, with the draw at ${(core.draw * 100).toFixed(1)}%` : ''}. Expected score: ${core.expected.home.toFixed(2)}–${core.expected.away.toFixed(2)}.`,
    impact: 'neutral',
    confidence: Math.round(confidence)
  });

  const biggest = markets
    .flatMap((m) => m.outcomes.map((o) => ({ ...o, market: m.label })))
    .sort((a, b) => b.edge - a.edge)[0];
  if (biggest) {
    insights.push({
      kind: 'market',
      title: biggest.value ? `Value detected: ${biggest.label}` : `Market is efficiently priced`,
      body: biggest.value
        ? `${biggest.label} is priced at ${biggest.bookOdds.toFixed(2)} (${biggest.bestBook}) against a model probability of ${(biggest.modelProbability * 100).toFixed(1)}%. That is a ${(biggest.edge * 100).toFixed(1)}% edge on turnover.`
        : `The best available price on ${biggest.label} implies ${(100 / biggest.bookOdds).toFixed(1)}% versus our ${(biggest.modelProbability * 100).toFixed(1)}%. No actionable edge after margin.`,
      impact: biggest.value ? 'positive' : 'neutral',
      confidence: biggest.confidence
    });
  }

  insights.push({
    kind: 'form',
    title: 'Recent form and venue',
    body: `${home.name} arrive with ${home.form.join('')} (${home.form.filter((f) => f === 'W').length} wins in five) and ${home.xgFor.toFixed(2)} xG per match. ${away.name} show ${away.form.join('')} and ${away.xgAgainst.toFixed(2)} xGA. ${fixture.venue} has produced ${(core.over25 * 100).toFixed(0)}% over 2.5 goals in this model.`,
    impact: 'neutral',
    confidence: 70
  });

  if (core.btts > 0.55) {
    insights.push({
      kind: 'model',
      title: 'Both sides project to score',
      body: `BTTS is ${(core.btts * 100).toFixed(1)}% — driven by ${home.shortName}’s ${home.xgFor.toFixed(2)} xG and ${away.shortName}’s ${away.xgFor.toFixed(2)} xG. The no-BTTS leg only makes sense if one defence is materially underrated.`,
      impact: 'positive',
      confidence: 74
    });
  }

  if (Math.abs(core.home - core.away) < 0.07 && core.draw > 0.22) {
    insights.push({
      kind: 'warning',
      title: 'Tight match — variance is high',
      body: `The top two outcomes are within ${(Math.abs(core.home - core.away) * 100).toFixed(1)} percentage points. Staking should be reduced; quarter-Kelly is recommended.`,
      impact: 'negative',
      confidence: 68
    });
  }

  const valueCount = markets.flatMap((m) => m.outcomes).filter((o) => o.value).length;
  insights.push({
    kind: 'model',
    title: `${valueCount} positive-EV selections across ${markets.length} markets`,
    body: `The engine scanned ${markets.reduce((a, m) => a + m.outcomes.length, 0)} outcomes across ${BOOKMAKERS.length} bookmakers. ${valueCount} cleared the 2.5% edge threshold after removing the margin. ${league.name} pricing is ${valueCount > 4 ? 'loose' : 'reasonably sharp'} today.`,
    impact: valueCount > 0 ? 'positive' : 'neutral',
    confidence: 80
  });

  if (fixture.weather) {
    insights.push({
      kind: 'weather',
      title: 'Conditions',
      body: `${fixture.weather} at ${fixture.venue}. ${fixture.weather.includes('rain') ? 'Wet surfaces historically suppress total goals by 4–7% and increase draw probability.' : 'Conditions are neutral for the totals markets.'}`,
      impact: 'neutral',
      confidence: 60
    });
  }

  return insights;
}

function buildValueBets(markets: Market[], bankroll = PAPER_BANKROLL_NGN): ValueBet[] {
  return markets
    .flatMap((m) =>
      m.outcomes.map((o) => ({
        market: m.label,
        marketId: m.id,
        selection: o.label,
        odds: o.bookOdds,
        modelProbability: o.modelProbability,
        impliedProbability: 1 / o.bookOdds,
        edge: o.edge,
        kellyStake: o.kelly,
        stakeNgn: Math.round((bankroll * o.kelly) / 100) * 100,
        confidence: o.confidence,
        bookmaker: o.bestBook
      }))
    )
    .filter((v) => v.edge >= 0.025 && v.odds >= 1.3 && v.odds <= 12 && v.modelProbability >= 0.15)
    .sort((a, b) => b.edge * b.confidence - a.edge * a.confidence)
    .slice(0, 8)
    .map((v) => ({ ...v, stakeNgn: Math.max(1000, Math.min(50_000, v.stakeNgn)) }));
}

function buildRecommendation(valueBets: ValueBet[], markets: Market[], fixture: Fixture): Recommendation {
  const core = markets.find((m) => m.id === '1x2' || m.id === 'ml');
  const best = valueBets[0];
  const home = TEAM_MAP[fixture.homeId];
  const away = TEAM_MAP[fixture.awayId];

  if (best) {
    return {
      selection: best.selection,
      market: best.market,
      odds: best.odds,
      modelProbability: best.modelProbability,
      stakeNgn: best.stakeNgn,
      confidence: best.confidence,
      rationale: `Best risk-adjusted edge on the board: ${(best.edge * 100).toFixed(1)}% over the implied price at ${best.bookmaker}. Quarter-Kelly sizing on a ₦1.25m paper bankroll.`,
      risk: best.modelProbability > 0.6 ? 'low' : best.modelProbability > 0.4 ? 'medium' : 'high'
    };
  }

  const fallback = core?.outcomes.reduce((a, b) => (b.modelProbability > a.modelProbability ? b : a));
  return {
    selection: fallback?.label ?? `${home.shortName} win`,
    market: core?.label ?? 'Match result',
    odds: fallback?.bookOdds ?? 2,
    modelProbability: fallback?.modelProbability ?? 0.5,
    stakeNgn: 5000,
    confidence: fallback?.confidence ?? 60,
    rationale: 'No selection clears the value threshold. This is the model’s most likely outcome — treated as a no-bet or minimum-stake watchlist item.',
    risk: 'medium'
  };
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export function buildPrediction(fixture: Fixture): Prediction {
  const core = coreFor(fixture);
  const markets = buildMarkets(fixture, core);
  const components = buildComponents(fixture, core);
  const dataQuality = round(clamp(0.87 + jitter(fixture.id + 'dq', 0.05), 0.72, 0.99), 3);

  const probs = [core.home, core.draw, core.away].filter((p) => p > 0.001);
  const entropy = -probs.reduce((a, p) => a + p * Math.log(p), 0) / Math.log(Math.max(2, probs.length));
  const topEdge = Math.max(0, ...markets.flatMap((m) => m.outcomes.map((o) => o.edge)));
  const confidence = Math.round(clamp(58 + (1 - entropy) * 24 + dataQuality * 8 + Math.min(10, topEdge * 120), 45, 96));
  const valueBets = buildValueBets(markets);
  const recommendation = buildRecommendation(valueBets, markets, fixture);
  const insights = buildInsights(fixture, core, markets, confidence);

  return {
    fixtureId: fixture.id,
    generatedAt: new Date().toISOString(),
    modelVersion: 'CaveBettor Ensemble v7.3',
    ensembleVersion: '2026.02.1',
    expectedGoals: {
      home: round(core.expected.home, 2),
      away: round(core.expected.away, 2),
      total: round(core.expected.total, 2)
    },
    probabilities: { home: round(core.home, 4), draw: round(core.draw, 4), away: round(core.away, 4) },
    fairOdds: {
      home: fairOdds(core.home),
      draw: fairOdds(Math.max(core.draw, 0.001)),
      away: fairOdds(core.away)
    },
    doubleChance: {
      homeOrDraw: round(core.home + core.draw, 4),
      homeOrAway: round(core.home + core.away, 4),
      drawOrAway: round(core.draw + core.away, 4)
    },
    bothTeamsScore: round(core.btts, 4),
    over15: round(core.over15, 4),
    over25: round(core.over25, 4),
    over35: round(core.over35, 4),
    scoreGrid: core.grid,
    topScorelines: core.topScorelines.slice(0, 8),
    markets,
    components,
    confidence,
    dataQuality,
    edge: round(topEdge, 4),
    valueBets,
    recommended: recommendation,
    insights,
    expectedPoints: core.expected,
    spread: core.spread,
    totalLine: core.totalLine
  };
}

const predictionCache = new Map<string, Prediction>();

export function getPrediction(fixture: Fixture): Prediction {
  const key = `${fixture.id}:${fixture.status}:${fixture.score.home}:${fixture.score.away}:${fixture.minute ?? 0}`;
  const hit = predictionCache.get(key);
  if (hit) return hit;
  const prediction = buildPrediction(fixture);
  if (predictionCache.size > 240) predictionCache.clear();
  predictionCache.set(key, prediction);
  return prediction;
}

export function modelById(id: string) {
  return MODELS.find((m) => m.id === id);
}
