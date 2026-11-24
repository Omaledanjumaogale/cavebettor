import { BOOKMAKERS, LEAGUE_MAP, MODELS } from '#lib/data/catalog';
import { awayTeam, fixtureLeague, homeTeam } from '#lib/data/registry';
import { sportProfile } from '#lib/data/sportProfiles';
import type {
  AnalysisMetric,
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
import { buildMarkets } from './markets';
import { calibrateThreeWay, scoringProfile } from './scoring';

const MAX_GOALS = 8;
const GRID = Array.from({ length: MAX_GOALS + 1 }, (_, i) => i);
export const PAPER_BANKROLL_NGN = 1_250_000;

interface PeriodModel {
  id: string;
  label: string;
  home: number;
  draw: number;
  away: number;
  total: number;
  line: number;
  over: number;
  under: number;
}

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
  periods: PeriodModel[];
  halves?: { first: ScoreCell[]; second: ScoreCell[] };
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

function periodFromGrid(id: string, label: string, grid: number[][], line: number): PeriodModel {
  const cells = cellsFromGrid(grid);
  const total = cells.reduce((a, c) => a + c.probability * (c.home + c.away), 0);
  let home = 0;
  let draw = 0;
  let away = 0;
  let over = 0;
  for (const c of cells) {
    if (c.home > c.away) home += c.probability;
    else if (c.home === c.away) draw += c.probability;
    else away += c.probability;
    if (c.home + c.away > line) over += c.probability;
  }
  return { id, label, home, draw, away, total, line, over, under: 1 - over };
}

function normalPeriod(
  id: string,
  label: string,
  meanMargin: number,
  meanTotal: number,
  sdMargin: number,
  sdTotal: number,
  line: number
): PeriodModel {
  // A period can finish level (halftime / quarter); the draw band is
  // half a point either side of zero.
  const draw = normalCdf(0.5 / sdMargin) - normalCdf(-0.5 / sdMargin);
  const home = normalCdf((meanMargin - 0.5) / sdMargin);
  const away = Math.max(0, 1 - home - draw);
  const over = 1 - normalCdf((line - meanTotal) / sdTotal);
  return { id, label, home, draw, away, total: meanTotal, line, over, under: 1 - over };
}

function solveSetProbability(matchProb: number, bestOfFive: boolean): number {
  // Invert the best-of-three/five set formula. A small binary search keeps
  // set and game markets consistent with the match-winner probability.
  const target = clamp(matchProb, 0.01, 0.99);
  let lo = 0.01;
  let hi = 0.99;
  for (let i = 0; i < 40; i++) {
    const s = (lo + hi) / 2;
    const p = bestOfFive
      ? s ** 3 + 3 * s ** 3 * (1 - s) + 6 * s ** 3 * (1 - s) ** 2
      : s ** 2 + 2 * s ** 2 * (1 - s);
    if (p < target) lo = s;
    else hi = s;
  }
  return (lo + hi) / 2;
}

function footballHTFTProbs(first: ScoreCell[], second: ScoreCell[]): number[] {
  const outcomes = Array(9).fill(0);
  const idx = (h: number, a: number) => (h > a ? 0 : h === a ? 1 : 2);
  for (const f of first) {
    for (const s of second) {
      const ht = idx(f.home, f.away);
      const ft = idx(f.home + s.home, f.away + s.away);
      outcomes[ht * 3 + ft] += f.probability * s.probability;
    }
  }
  return outcomes;
}

function footballCore(fixture: Fixture): CoreModel {
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  const seed = fixture.id;
  const league = fixtureLeague(fixture);
  const profile = scoringProfile('football', fixture.leagueId, `${league.name} ${league.country ?? ''}`);
  const expected = expectedScore('football', home, away, 1.065, `${league.name} ${league.country ?? ''}`);
  const rho = -0.085 + jitter(seed + 'rho', 0.018);
  const strength = clamp(Math.abs(home.elo - away.elo) / 420, 0.2, 0.95);

  // Live adjustment: only goals still to be scored follow the Poisson process.
  const live = fixture.status === 'live' || fixture.status === 'halftime';
  const progress = live ? clamp((fixture.minute ?? 45) / 95, 0, 1) : 0;
  const remaining = live ? clamp(1 - progress * 1.06, 0.04, 1) : 1;
  const lambdaH = clamp(expected.home * remaining, 0.05, 4.4);
  const lambdaA = clamp(expected.away * remaining, 0.05, 4.2);
  const grid = poissonGrid(lambdaH, lambdaA, rho);
  const firstGrid = poissonGrid(clamp(lambdaH * 0.45, 0.02, 3.4), clamp(lambdaA * 0.45, 0.02, 3.2), rho);
  const secondGrid = poissonGrid(clamp(lambdaH * 0.55, 0.02, 3.8), clamp(lambdaA * 0.55, 0.02, 3.6), rho);
  const periods = [periodFromGrid('ht', 'First half', firstGrid, 1.5)];
  const halves = { first: cellsFromGrid(firstGrid), second: cellsFromGrid(secondGrid) };

  // In-play probabilities must include the goals already on the board.
  const raw = summarizeGrid(grid, live ? fixture.score.home : 0, live ? fixture.score.away : 0);
  // Poisson with an Elo prior is over-confident; blend towards the league's
  // own home/draw/away base rates before anything is shown or recommended.
  const calibrated = calibrateThreeWay(raw, profile, strength);
  const summary = { ...raw, ...calibrated };
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
      periods,
      halves,
      margin: 0,
      sd: 1
    };
  }

  return {
    ...summary,
    expected: { ...expected, total: expected.home + expected.away },
    periods,
    halves,
    margin: 0,
    sd: 1
  };
}

function hockeyCore(fixture: Fixture): CoreModel {
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  const league = fixtureLeague(fixture);
  const profile = scoringProfile('icehockey', fixture.leagueId, `${league.name} ${league.country ?? ''}`);
  const expected = expectedScore('icehockey', home, away, 1.04, `${league.name} ${league.country ?? ''}`);
  const rho = -0.05;
  const strength = clamp(Math.abs(home.elo - away.elo) / 420, 0.2, 0.95);
  const live = fixture.status === 'live';
  const progress = live ? clamp((fixture.minute ?? 30) / 90, 0, 1) : 0;
  const remaining = live ? clamp(1 - progress, 0.05, 1) : 1;
  const lambdaH = expected.home * remaining;
  const lambdaA = expected.away * remaining;
  const grid = poissonGrid(lambdaH, lambdaA, rho);
  const raw = summarizeGrid(grid, live ? fixture.score.home : 0, live ? fixture.score.away : 0);
  const summary = { ...raw, ...calibrateThreeWay(raw, profile, strength) };
  const periods = [1, 2, 3].map((n) =>
    periodFromGrid(`p${n}`, `Period ${n}`, poissonGrid(clamp(lambdaH / 3, 0.01, 2.2), clamp(lambdaA / 3, 0.01, 2.1), rho), 1.5)
  );
  const homeMl = clamp(summary.home + summary.draw * 0.54, 0.02, 0.9);
  const awayMl = clamp(summary.away + summary.draw * 0.46, 0.02, 0.9);
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
    spread: (() => {
      const cover = clamp(1 - normalCdf((1.5 - margin) / 2.3), 0.02, 0.98);
      return { line: -1.5, homeCover: cover, awayCover: 1 - cover };
    })(),
    totalLine: (() => {
      const over = clamp(1 - normalCdf((5.5 - total) / 2.1), 0.02, 0.98);
      return { line: 5.5, over, under: 1 - over };
    })(),
    periods,
    margin,
    sd: 2.3
  };
}

function basketballCore(fixture: Fixture): CoreModel {
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  const league = fixtureLeague(fixture);
  const profile = scoringProfile('basketball', fixture.leagueId, `${league.name} ${league.country ?? ''}`);
  const expected = expectedScore('basketball', home, away, 1, `${league.name} ${league.country ?? ''}`);
  const seed = fixture.id;
  const live = fixture.status === 'live';
  // A live projection must respect the score already on the board: if 107
  // points are in, the game is half gone no matter what the clock feed says.
  // `minute` is elapsed wall-clock time for a basketball game (about 150 for
  // the NBA, 120 in Europe), not the 48-minute game clock.
  const clockProgress = live ? clamp((fixture.minute ?? 72) / (profile.total >= 200 ? 150 : 120), 0, 0.98) : 0;
  const scored = fixture.score.home + fixture.score.away;
  const scoreProgress = live ? clamp(scored / profile.total, 0, 0.97) : 0;
  // The clock may run ahead of the scoreboard (timeouts, stoppages) but never
  // so far that 107 points in looks like the first quarter.
  const progress = Math.max(scoreProgress, Math.min(clockProgress, scoreProgress + 0.3));
  const remaining = live ? clamp(1 - progress, 0.05, 1) : 1;
  const finalHome = live ? fixture.score.home + expected.home * remaining : expected.home;
  const finalAway = live ? fixture.score.away + expected.away * remaining : expected.away;
  // Volatility follows the competition: NBA games swing far more than a
  // women's league game, where a 128-point total is the whole contest.
  const sdMargin = profile.sdMargin;
  const sdTotal = profile.sdTotal;
  const margin = finalHome - finalAway + jitter(seed + 'm', profile.sdMargin * 0.05);
  const total = finalHome + finalAway;
  const rawHome = clamp(normalCdf(margin / sdMargin), 0.05, 0.95);
  const calibrated = calibrateThreeWay(
    { home: rawHome, draw: 0, away: 1 - rawHome },
    profile,
    clamp(Math.abs(margin) / 26, 0.2, 0.95)
  );
  const homeProb = calibrated.home;
  const line = Math.round(margin * 2) / 2;
  const totalLine = Math.round(total * 2) / 2;
  const homeCover = clamp(1 - normalCdf((line - margin) / sdMargin), 0.02, 0.98);
  const over = clamp(1 - normalCdf((totalLine - total) / sdTotal), 0.02, 0.98);
  const periods = [
    normalPeriod('h1', 'First half', margin / 2, total / 2, sdMargin * 0.72, sdTotal * 0.72, Math.round((total / 2) * 2) / 2),
    ...[1, 2, 3, 4].map((q) =>
      normalPeriod(`q${q}`, `Quarter ${q}`, margin / 4, total / 4, sdMargin * 0.55, sdTotal * 0.55, Math.round((total / 4) * 2) / 2)
    )
  ];

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
    btts: 0,
    over15: 0,
    over25: 0,
    over35: 0,
    topScorelines,
    periods,
    spread: { line, homeCover, awayCover: 1 - homeCover },
    totalLine: { line: totalLine, over, under: 1 - over },
    moneyline: { home: homeProb, away: 1 - homeProb },
    margin,
    sd: sdMargin
  };
}

function baseballCore(fixture: Fixture): CoreModel {
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  const league = fixtureLeague(fixture);
  const profile = scoringProfile('baseball', fixture.leagueId, `${league.name} ${league.country ?? ''}`);
  const expected = expectedScore('baseball', home, away, 1.03, `${league.name} ${league.country ?? ''}`);
  const sd = profile.sdTotal;
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
  homeWin = 0.5 + (homeWin - 0.5) * 0.86;
  const summary = summarizeGrid(normalized, live ? fixture.score.home : 0, live ? fixture.score.away : 0);
  const total = live ? fixture.score.home + fixture.score.away + lambdaH + lambdaA : expected.home + expected.away;
  const margin = live ? fixture.score.home - fixture.score.away + lambdaH - lambdaA : expected.home - expected.away;
  const periods = [periodFromGrid('f5', 'First 5 innings', poissonGrid(clamp(lambdaH * 5 / 9, 0.05, 5), clamp(lambdaA * 5 / 9, 0.05, 5), 0), 4.5)];
  const cover = clamp(1 - normalCdf((1.5 - margin) / sd), 0.02, 0.98);
  const over = clamp(1 - normalCdf((8.5 - total) / 3.1), 0.03, 0.97);
  return {
    ...summary,
    home: homeWin,
    draw: 0,
    away: 1 - homeWin,
    expected: { ...expected, total },
    periods,
    grid: cellsFromGrid(normalized).filter((c) => c.home < 13 && c.away < 13),
    topScorelines: summary.topScorelines.filter((c) => c.home < 13 && c.away < 13).slice(0, 8),
    moneyline: { home: homeWin, away: 1 - homeWin },
    spread: { line: -1.5, homeCover: cover, awayCover: 1 - cover },
    totalLine: { line: 8.5, over, under: 1 - over },
    margin,
    sd
  };
}

function tennisCore(fixture: Fixture): CoreModel {
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  const bestOfFive = fixture.bestOfFive ?? (fixture.leagueId === 'grandslam' && home.elo >= 2100 && away.elo >= 2100);
  const eloDiff = home.elo - away.elo + 26;
  let winProb = 1 / (1 + Math.pow(10, -eloDiff / 400));
  const seed = fixture.id;
  winProb = clamp(winProb + jitter(seed + 'tennis', 0.012), 0.03, 0.97);
  // An Elo-only win probability overstates lopsided ties; pull it to the middle.
  winProb = 0.5 + (winProb - 0.5) * 0.88;
  const setProb = solveSetProbability(winProb, bestOfFive);
  const setsToWin = bestOfFive ? 3 : 2;
  const totalGames = bestOfFive ? 37.5 : 23.2;
  const homeGames = totalGames * (0.5 + (winProb - 0.5) * 0.34);
  const awayGames = totalGames - homeGames;
  const line = bestOfFive ? 38.5 : 22.5;
  const sd = bestOfFive ? 6.4 : 4.35;
  const over = 1 - normalCdf((line - totalGames) / sd);
  const gameDiff = homeGames - awayGames;
  const handicapLine = Math.round(gameDiff * 2) / 2;
  const homeCover = 1 - normalCdf((handicapLine - gameDiff) / sd);
  const firstSetTotal = bestOfFive ? 10.2 : 9.8;
  const periods = [normalPeriod('set1', 'First set', 0, firstSetTotal, 0.001, 3.6, 9.5)];
  periods[0] = { ...periods[0], home: setProb, draw: 0, away: 1 - setProb };

  return {
    home: winProb,
    draw: 0,
    away: 1 - winProb,
    expected: { home: homeGames, away: awayGames, total: totalGames },
    grid: [],
    btts: 0,
    over15: 0,
    over25: 0,
    over35: 0,
    topScorelines: [],
    periods,
    spread: { line: -handicapLine, homeCover, awayCover: 1 - homeCover },
    totalLine: { line, over, under: 1 - over },
    moneyline: { home: winProb, away: 1 - winProb },
    margin: gameDiff,
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

/* ── Market construction (sport-specific) ───────────────────────────────── */

/* ── Model components ────────────────────────────────────────────────────── */

function componentProbabilities(fixture: Fixture, core: CoreModel) {
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
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
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  const league = fixtureLeague(fixture);
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

/**
 * Every priced selection the model actually likes, ranked by how likely it is
 * to land rather than by how big the price is.
 *
 * The punter's edge comes from strike rate the bookmaker has mispriced, so a
 * 78% over 1.5 that pays 1.42 outranks a 9% correct score at 14.0. Duplicate
 * rows (the same selection reachable through two ladders) are collapsed.
 */
function buildValueBets(markets: Market[], bankroll = PAPER_BANKROLL_NGN): ValueBet[] {
  const seen = new Set<string>();
  const candidates = markets
    .flatMap((m) =>
      m.outcomes.map((o) => ({
        market: m.label,
        marketId: m.id,
        marketGroup: m.group,
        outcomeId: o.id,
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
    // A selection the model thinks is underpriced AND likely enough to settle.
    .filter((v) => v.edge >= 0.02 && v.odds >= 1.25 && v.modelProbability >= 0.35)
    .filter((v) => {
      const key = `${v.selection}|${Math.round(v.modelProbability * 1000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return candidates
    .sort((a, b) => b.modelProbability - a.modelProbability || b.edge - a.edge)
    .slice(0, 12)
    .map((v) => ({ ...v, stakeNgn: Math.max(1000, Math.min(50_000, v.stakeNgn)) }));
}

/**
 * Punter-facing selection model.
 *
 * A staked bet needs both a real chance of landing and a price worth taking, so
 * the board is built in this order:
 *
 *   1. Only positive-EV outcomes are eligible.
 *   2. Team names are written out in full - no abbreviations on a bet slip.
 *   3. One line per direction: the best "Over" line and the best "Under" line,
 *      chosen by strike rate, never an arbitrary baseline. Over 154.5 and under
 *      190 can both win, so both may stand; over 200 with under 180 cannot, so
 *      only the stronger one survives.
 *   4. A marginal favourite is not a "straight win" bet. When the straight
 *      price is not dominant, the covering markets (double chance, Asian
 *      handicap, handicap/spread, draw no bet) are preferred because they are
 *      the ones that actually win.
 *   5. Everything is ranked by model probability, then edge.
 */

/** Matches "match under 2.5", "1st half over 0.5", "Feyenoord over 1.5", "under 89.5". */
const TOTALS_DIRECTION = /\b(over|under)\s+([0-9]+(?:\.[0-9]+)?)/i;

interface Candidate {
  marketId: string;
  marketGroup: string;
  market: string;
  selection: string;
  outcomeId?: string;
  odds: number;
  modelProbability: number;
  edge: number;
  confidence: number;
  bookmaker: string;
  stakeNgn: number;
  line?: number;
  scope?: string;
  direction?: 'over' | 'under';
}

function fullName(selection: string, home: string, away: string, hs: string, as: string): string {
  // Only expand genuine short codes. A one-letter abbreviation would corrupt
  // every word containing that letter ("Draw" -> "Diriangenraw").
  let out = selection;
  if (hs.length >= 2 && hs !== home) out = out.split(hs).join(home);
  if (as.length >= 2 && as !== away) out = out.split(as).join(away);
  return out;
}

function periodKey(marketId: string): string {
  if (/^(ht|h1)/i.test(marketId)) return 'first-half';
  // Hockey periods and basketball quarters share one bucket: the board should
  // not fill half its slots with correlated period unders.
  if (/^(p[0-9]|q[0-9])/i.test(marketId)) return 'period';
  if (/^(f5)/i.test(marketId)) return 'first-five';
  if (/^(set1)/i.test(marketId)) return 'first-set';
  return 'full';
}

function scoreOf(row: Candidate): number {
  return row.modelProbability * 1000 + row.edge * 100;
}

/** "1st half", "first half" and "h1" must collapse to one scope. */
const SCOPE_ALIASES: Array<[RegExp, string]> = [
  [/^(1st|first)\s+half\b/i, 'first half'],
  [/^(1st|first)\s+period\b/i, 'first period'],
  [/^(1st|first)\s+quarter\b/i, 'first quarter'],
  [/^(1st|first)\s+set\b/i, 'first set'],
  [/^(first|1st)\s+(5|five)\s+innings\b/i, 'first five innings']
];

/** Split a totals label into its scope ("Feyenoord", "1st half", "match") and line. */
function readTotals(row: Candidate): { scope: string; direction: 'over' | 'under'; line: number } | null {
  const match = TOTALS_DIRECTION.exec(row.selection);
  if (!match) return null;
  const raw = row.selection.slice(0, match.index).trim() || 'match';
  let scope = raw.toLowerCase();
  for (const [pattern, canonical] of SCOPE_ALIASES) {
    if (pattern.test(raw)) {
      scope = canonical;
      break;
    }
  }
  return { scope, direction: match[1].toLowerCase() as 'over' | 'under', line: Number(match[2]) };
}

function selectRecommendations(markets: Market[], fixture: Fixture): Candidate[] {
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);

  const all: Candidate[] = markets.flatMap((market) =>
    market.outcomes.map((outcome) => ({
      marketId: market.id,
      marketGroup: market.group,
      market: fullName(market.label, home.name, away.name, home.shortName, away.shortName),
      selection: fullName(outcome.label, home.name, away.name, home.shortName, away.shortName),
      outcomeId: outcome.id,
      odds: outcome.bookOdds,
      modelProbability: outcome.modelProbability,
      edge: outcome.edge,
      confidence: outcome.confidence,
      bookmaker: outcome.bestBook,
      stakeNgn: Math.round((PAPER_BANKROLL_NGN * outcome.kelly) / 100) * 100
    }))
  );

  // Two tiers, both ranked by how likely the bet is to settle:
  //   value  — a real edge over the price (the preferred tier);
  //   safety — a fair-or-better price on a high strike rate. A 90% shot at a
  //            fair 1.14 is a better bet to win than a 49% shot at 2.10, and
  //            the board must say so instead of hiding behind a price floor.
  const valueRows = all.filter((row) => row.edge >= 0.02 && row.odds >= 1.2 && row.odds <= 6);
  const seenRow = new Set(valueRows.map((row) => `${row.marketId}|${row.selection}`));
  const safetyRows = all.filter(
    (row) =>
      row.modelProbability >= 0.55 &&
      row.edge >= -0.01 &&
      row.odds >= 1.05 &&
      !seenRow.has(`${row.marketId}|${row.selection}`)
  );
  const eligible = [...valueRows, ...safetyRows];
  if (!eligible.length) return [];

  // ── totals: best line per scope and direction, then compatibility ────────
  const totalsByKey = new Map<string, Candidate>();
  const others: Candidate[] = [];

  for (const row of eligible) {
    const totals = readTotals(row);
    if (!totals) {
      others.push(row);
      continue;
    }
    const key = `${totals.scope}|${totals.direction}`;
    const candidate: Candidate = { ...row, ...totals };
    const incumbent = totalsByKey.get(key);
    if (!incumbent || scoreOf(candidate) > scoreOf(incumbent)) totalsByKey.set(key, candidate);
  }

  let totals = [...totalsByKey.values()];

  // Over X and under Y coexist only when Y > X (a 154.5 over and a 190 under
  // can both land; a 200 over and an 180 under cannot).
  const scopes = new Set(totals.map((row) => row.scope ?? 'match'));
  for (const scope of scopes) {
    const over = totals.find((row) => row.scope === scope && row.direction === 'over');
    const under = totals.find((row) => row.scope === scope && row.direction === 'under');
    if (over && under && (under.line ?? 0) <= (over.line ?? 0)) {
      const drop = scoreOf(over) >= scoreOf(under) ? under : over;
      totals = totals.filter((row) => row !== drop);
    }
  }

  // ── straight win versus the cover that actually settles ─────────────────
  const straight = others.find((row) => row.marketId === '1x2' || row.marketId === 'ml');
  const covers = others.filter((row) => row.marketId === 'dc' || row.marketId === 'dnb');
  const handicaps = others.filter((row) => /^(ah|spread|puck|runline|sethcp)/.test(row.marketId));
  const keep: Candidate[] = [];

  if (straight) {
    const weak = straight.modelProbability < 0.62;
    const better = [...covers, ...handicaps].sort((a, b) => scoreOf(b) - scoreOf(a))[0];
    if (weak && better && better.modelProbability > straight.modelProbability) keep.push(better);
    else keep.push(straight);
  }

  const usedFamilies = new Set<string>();
  for (const row of [...covers, ...handicaps]) {
    if (keep.some((k) => k.marketId === row.marketId && k.selection === row.selection)) continue;
    const family = /^(ah|spread|puck|runline|sethcp)/.test(row.marketId) ? 'handicap' : 'cover';
    const key = `${family}|${periodKey(row.marketId)}`;
    if (usedFamilies.has(key)) continue;
    usedFamilies.add(key);
    keep.push(row);
  }

  for (const row of others) {
    if (keep.includes(row) || row === straight) continue;
    // Exact scores and set scores are lottery tickets, not recommendations.
    if (row.marketId === 'cs' || row.marketId === 'totalexact' || row.marketId === 'sets' || row.marketId === 'margin' || row.marketId === 'totalband') continue;
    if (/^(ah|spread|puck|runline|sethcp)/.test(row.marketId)) continue;
    const key = `${row.marketId}|${periodKey(row.marketId)}`;
    if (usedFamilies.has(key)) continue;
    usedFamilies.add(key);
    keep.push(row);
  }

  const merged = [...keep, ...totals];
  const seen = new Set<string>();
  const unique = merged.filter((row) => {
    const key = `${row.marketId}|${row.selection}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Correlated legs: never fill the board with three period unders.
  const perPeriod = new Map<string, number>();
  const balanced = unique
    .sort((a, b) => b.modelProbability - a.modelProbability || b.edge - a.edge)
    .filter((row) => {
      const key = periodKey(row.marketId);
      const count = perPeriod.get(key) ?? 0;
      if (count >= 2) return false;
      perPeriod.set(key, count + 1);
      return true;
    });

  return balanced.slice(0, 10);
}

function buildRecommendations(valueBets: ValueBet[], markets: Market[], fixture: Fixture): Recommendation[] {
  const selected = selectRecommendations(markets, fixture);

  if (selected.length) {
    const counts = new Map<string, number>();
    for (const row of selected) counts.set(row.selection, (counts.get(row.selection) ?? 0) + 1);

    return selected.map((row, index) => ({
      // "Iga Swiatek" wins the match and the first set; the bet slip must say which.
      selection: (counts.get(row.selection) ?? 0) > 1 ? `${row.selection} (${row.market})` : row.selection,
      market: row.market,
      marketId: row.marketId,
      outcomeId: row.outcomeId,
      odds: row.odds,
      modelProbability: row.modelProbability,
      edge: row.edge,
      stakeNgn: Math.max(1000, Math.min(50_000, row.stakeNgn)),
      confidence: row.confidence,
      rationale:
        `${(row.modelProbability * 100).toFixed(1)}% model strike rate against ${row.odds.toFixed(2)} at ${row.bookmaker} - ` +
        `${(row.edge * 100).toFixed(1)}% above the implied price.` +
        (index === 0 ? ' Highest-confidence call on this fixture.' : ''),
      risk: (row.modelProbability > 0.65 ? 'low' : row.modelProbability > 0.45 ? 'medium' : 'high') as 'low' | 'medium' | 'high'
    }));
  }

  const core = markets.find((m) => m.id === '1x2' || m.id === 'ml');
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  const fallback = core?.outcomes.reduce((a, b) => (b.modelProbability > a.modelProbability ? b : a));
  const label = (value: string) => fullName(value, home.name, away.name, home.shortName, away.shortName);
  return [
    {
      selection: fallback ? label(fallback.label) : 'No bet',
      market: core ? label(core.label) : 'Match result',
      marketId: core?.id,
      outcomeId: fallback?.id,
      odds: fallback?.bookOdds ?? 2,
      modelProbability: fallback?.modelProbability ?? 0.5,
      edge: fallback ? fallback.modelProbability * fallback.bookOdds - 1 : 0,
      stakeNgn: 0,
      confidence: fallback?.confidence ?? 60,
      rationale: 'No selection clears both the strike-rate and value thresholds. The model passes on this fixture - the most likely result is shown for reference only.',
      risk: 'medium'
    }
  ];
}

function buildRecommendation(valueBets: ValueBet[], markets: Market[], fixture: Fixture): Recommendation {
  const core = markets.find((m) => m.id === '1x2' || m.id === 'ml');
  const best = valueBets.slice().sort((a, b) => b.modelProbability - a.modelProbability || b.edge - a.edge)[0];
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);

  if (best) {
    return {
      selection: best.selection,
      market: best.market,
      marketId: best.marketId,
      outcomeId: best.outcomeId,
      odds: best.odds,
      modelProbability: best.modelProbability,
      edge: best.edge,
      stakeNgn: best.stakeNgn,
      confidence: best.confidence,
      rationale: `Highest-confidence call: ${(best.modelProbability * 100).toFixed(1)}% model strike rate at ${best.odds.toFixed(2)} with ${best.bookmaker}, ${(best.edge * 100).toFixed(1)}% above the implied price. Quarter-Kelly sizing on a ₦1.25m paper bankroll.`,
      risk: best.modelProbability > 0.6 ? 'low' : best.modelProbability > 0.4 ? 'medium' : 'high'
    };
  }

  const fallback = core?.outcomes.reduce((a, b) => (b.modelProbability > a.modelProbability ? b : a));
  return {
    selection: fallback?.label ?? `${home.shortName} win`,
    market: core?.label ?? 'Match result',
    marketId: core?.id,
    outcomeId: fallback?.id,
    odds: fallback?.bookOdds ?? 2,
    modelProbability: fallback?.modelProbability ?? 0.5,
    edge: fallback ? fallback.modelProbability * fallback.bookOdds - 1 : 0,
    stakeNgn: 5000,
    confidence: fallback?.confidence ?? 60,
    rationale: 'No selection clears the value threshold. This is the model’s most likely outcome — treated as a no-bet or minimum-stake watchlist item.',
    risk: 'medium'
  };
}

function buildMetrics(fixture: Fixture, core: CoreModel): AnalysisMetric[] {
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  const seed = fixture.id;
  const stat = (n: number, spread: number) => round(n + jitter(seed + n, spread), 1);
  if (fixture.sport === 'football') {
    const possession = fixture.stats?.possession ?? [55, 45];
    return [
      { id: 'xg', label: 'Expected goals', value: core.expected.home + core.expected.away, display: `${core.expected.home.toFixed(2)} – ${core.expected.away.toFixed(2)}`, hint: `${home.shortName} vs ${away.shortName} projected goals`, tone: 'neutral' },
      { id: 'shots', label: 'Shots', value: (fixture.stats?.shots?.[0] ?? 13) + (fixture.stats?.shots?.[1] ?? 10), display: `${fixture.stats?.shots?.[0] ?? 13} – ${fixture.stats?.shots?.[1] ?? 10}`, hint: 'Total attempts and on-target split', tone: 'neutral' },
      { id: 'possession', label: 'Possession', value: possession[0], display: `${possession[0]}% – ${possession[1]}%`, hint: 'Share of the ball', tone: 'neutral' },
      { id: 'btts', label: 'BTTS', value: core.btts, display: `${(core.btts * 100).toFixed(1)}%`, hint: 'Both teams to score', tone: core.btts > 0.55 ? 'positive' : 'neutral' },
      { id: 'goals', label: 'Goal environment', value: core.expected.total, display: `${core.expected.total.toFixed(2)} goals`, hint: 'Projected combined goals', tone: 'neutral' }
    ];
  }
  if (fixture.sport === 'basketball') {
    const pace = stat(98, 3);
    return [
      { id: 'points', label: 'Projected points', value: core.expected.total, display: `${core.expected.home.toFixed(0)} – ${core.expected.away.toFixed(0)}`, hint: 'Full-game points including overtime', tone: 'neutral' },
      { id: 'pace', label: 'Pace', value: pace, display: `${pace.toFixed(1)} poss/48`, hint: 'Possessions per 48 minutes', tone: 'neutral' },
      { id: 'spread', label: 'Spread', value: core.spread?.line ?? 0, display: `${(core.spread?.line ?? 0) > 0 ? '+' : ''}${core.spread?.line ?? 0}`, hint: 'Model point margin at the line', tone: 'neutral' },
      { id: 'total', label: 'Total', value: core.totalLine?.line ?? 0, display: `${core.totalLine?.line ?? 0} points`, hint: 'Combined points line', tone: 'neutral' },
      { id: 'rating', label: 'Offensive rating', value: 116, display: `${stat(116, 2).toFixed(1)} ORtg`, hint: 'Points per 100 possessions', tone: 'positive' }
    ];
  }
  if (fixture.sport === 'icehockey') {
    const shots = stat(31, 4);
    return [
      { id: 'xg', label: 'Expected goals', value: core.expected.total, display: `${core.expected.home.toFixed(2)} – ${core.expected.away.toFixed(2)}`, hint: 'Shot-quality weighted goals', tone: 'neutral' },
      { id: 'shots', label: 'Shots', value: shots, display: `${shots.toFixed(0)} total`, hint: 'Shot volume at 5v5 and special teams', tone: 'neutral' },
      { id: 'save', label: 'Goalie save %', value: 91.2, display: `${stat(91.2, 1.2).toFixed(1)}%`, hint: 'Starter-adjusted save percentage', tone: 'neutral' },
      { id: 'pp', label: 'Power play', value: 22.4, display: `${stat(22.4, 2).toFixed(1)}%`, hint: 'Conversion and chances', tone: 'neutral' },
      { id: 'total', label: 'Goal environment', value: core.expected.total, display: `${core.expected.total.toFixed(1)} goals`, hint: 'Projected regulation goals', tone: 'neutral' }
    ];
  }
  if (fixture.sport === 'baseball') {
    return [
      { id: 'runs', label: 'Projected runs', value: core.expected.total, display: `${core.expected.home.toFixed(1)} – ${core.expected.away.toFixed(1)}`, hint: 'Full-game run expectancy', tone: 'neutral' },
      { id: 'starter', label: 'Starter', value: 3.52, display: `${stat(3.52, 0.35).toFixed(2)} xFIP`, hint: 'Starting pitcher run prevention', tone: 'neutral' },
      { id: 'bullpen', label: 'Bullpen', value: 3.88, display: `${stat(3.88, 0.4).toFixed(2)} ERA`, hint: 'Relief run prevention', tone: 'neutral' },
      { id: 'park', label: 'Park factor', value: 1.02, display: `${stat(1.02, 0.06).toFixed(2)}×`, hint: 'Run environment at the venue', tone: 'neutral' },
      { id: 'total', label: 'Run environment', value: core.totalLine?.line ?? 8.5, display: `${core.totalLine?.line ?? 8.5} runs`, hint: 'Combined runs line', tone: 'neutral' }
    ];
  }
  return [
    { id: 'hold', label: 'Hold %', value: 82.4, display: `${stat(82.4, 3).toFixed(1)}%`, hint: 'Service games held', tone: 'positive' },
    { id: 'break', label: 'Break %', value: 27.6, display: `${stat(27.6, 3).toFixed(1)}%`, hint: 'Return games won', tone: 'neutral' },
    { id: 'serve', label: 'First-serve points', value: 71.8, display: `${stat(71.8, 2.5).toFixed(1)}%`, hint: 'Points won behind first serve', tone: 'neutral' },
    { id: 'sets', label: 'Set spread', value: core.home - core.away, display: `${(core.home - core.away > 0 ? '+' : '')}${(core.home - core.away).toFixed(2)}`, hint: 'Projected set margin', tone: 'neutral' },
    { id: 'games', label: 'Total games', value: core.expected.total, display: `${core.expected.total.toFixed(1)} games`, hint: 'Projected games in the match', tone: 'neutral' }
  ];
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
  const recommendations = buildRecommendations([], markets, fixture);
  const valueBets = valueBetsFromRecommendations(recommendations, markets);
  const recommendation = recommendations[0] ?? buildRecommendation(valueBets, markets, fixture);
  const insights = buildInsights(fixture, core, markets, confidence);
  const profile = sportProfile(fixture.sport);

  return {
    fixtureId: fixture.id,
    sport: fixture.sport,
    scoreUnit: profile.scoreUnitPlural,
    marketContext: profile.backtest.settlement,
    modelLabel: profile.backtest.model,
    settlement: profile.backtest.settlement,
    metrics: buildMetrics(fixture, core),
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
    recommendations,
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

/**
 * Turn the ranked recommendations into the value-bet rows used by the tables,
 * so the table and the board always describe the same selections.
 */
function valueBetsFromRecommendations(recommendations: Recommendation[], markets: Market[]): ValueBet[] {
  const index = new Map<string, Market>();
  for (const market of markets) index.set(market.id, market);

  return recommendations
    .map((rec) => {
      const market = rec.marketId ? index.get(rec.marketId) : undefined;
      const outcome = market?.outcomes.find((o) => o.label === rec.selection || o.id === rec.outcomeId);
      return {
        market: rec.market,
        marketId: rec.marketId ?? '',
        marketGroup: market?.group,
        outcomeId: rec.outcomeId,
        selection: rec.selection,
        odds: rec.odds,
        modelProbability: rec.modelProbability,
        impliedProbability: 1 / rec.odds,
        edge: outcome?.edge ?? rec.modelProbability * rec.odds - 1,
        kellyStake: outcome?.kelly ?? 0,
        stakeNgn: rec.stakeNgn,
        confidence: rec.confidence,
        bookmaker: outcome?.bestBook ?? ''
      } satisfies ValueBet;
    })
    .filter((bet) => bet.marketId);
}
