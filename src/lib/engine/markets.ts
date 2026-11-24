import { BOOKMAKERS } from '#lib/data/catalog';
import { awayTeam, homeTeam } from '#lib/data/registry';
import type { Fixture, Market, MarketGroup, MarketOutcome, ScoreCell } from '#lib/types';
import { clamp, fairOdds, jitter, kellyFraction, normalCdf, round } from './core';

interface PeriodModel {
  id: string; label: string; home: number; draw: number; away: number;
  total: number; line: number; over: number; under: number;
}

export interface MarketModel {
  home: number; draw: number; away: number;
  expected: { home: number; away: number; total: number };
  grid: ScoreCell[]; btts: number; topScorelines: ScoreCell[];
  spread?: { line: number; homeCover: number; awayCover: number };
  totalLine?: { line: number; over: number; under: number };
  moneyline?: { home: number; away: number };
  periods: PeriodModel[];
  halves?: { first: ScoreCell[]; second: ScoreCell[] };
  margin: number; sd: number;
}

interface OutcomeSpec { label: string; shortLabel?: string; probability: number }

function priceOutcome(fixture: Fixture, spec: OutcomeSpec, marketId: string, index: number): MarketOutcome {
  const p = clamp(spec.probability, 0.0015, 0.996);
  const key = `${fixture.id}-${marketId}-${index}`;
  const books = BOOKMAKERS.map((book, bi) => {
    const marginFactor = 1 + book.margin * 0.9;
    const bias = jitter(`${key}-${book.id}-bias`, 0.065);
    const noise = 1 + jitter(`${key}-${book.id}-${bi}`, 0.012) + bi * 0.0004;
    const implied = clamp(p * marginFactor * (1 + bias) * noise, 0.001, 0.999);
    return { book, odds: round(Math.max(1.01, 1 / implied), 2) };
  });
  const best = books.reduce((a, b) => (b.odds > a.odds ? b : a));
  const edge = p * best.odds - 1;
  return {
    id: `${marketId}-${index}`, label: spec.label, shortLabel: spec.shortLabel,
    modelProbability: round(p, 4), fairOdds: fairOdds(p), bookOdds: best.odds,
    bestBook: best.book.name, edge: round(edge, 4), kelly: round(kellyFraction(p, best.odds), 4),
    trend: round(jitter(`${marketId}-${spec.label}-trend`, 0.055), 3),
    confidence: Math.round(clamp(58 + p * 18 + Math.min(20, Math.max(0, edge) * 220), 40, 96)),
    value: edge > 0.025 && p > 0.08
  };
}

function mk(fixture: Fixture, id: string, group: MarketGroup, label: string, description: string, specs: OutcomeSpec[]): Market {
  // A market with a single priced side proves nothing; drop it rather than pad.
  const usable = specs.filter((s) => clamp(s.probability, 0, 1) > 0.004);
  return {
    id, group, label, description,
    outcomes: usable.map((s, i) => priceOutcome(fixture, s, id, i)),
    bookmakerCount: BOOKMAKERS.length, updatedAt: new Date().toISOString()
  };
}

function htft(first: ScoreCell[], second: ScoreCell[]): number[] {
  const out = Array(9).fill(0);
  const idx = (h: number, a: number) => (h > a ? 0 : h === a ? 1 : 2);
  for (const f of first) for (const s of second) out[idx(f.home, f.away) * 3 + idx(f.home + s.home, f.away + s.away)] += f.probability * s.probability;
  return out;
}

const fmtLine = (line: number) => (Number.isInteger(line) ? String(line) : line.toFixed(1));

/**
 * Lines are chosen per fixture around the model's own expectation, not from a
 * fixed ladder. A 1.4-goal match gets 0.5 and 1.5; a 3.6-goal match gets 2.5,
 * 3.5 and 4.5, in both directions.
 */
function ladder(
  expected: number,
  options: { step?: number; span?: number; count?: number; min?: number; half?: boolean } = {}
): number[] {
  const step = options.step ?? 0.5;
  const half = options.half ?? true;
  // Whole multiples of the step so no line ever lands on a stray decimal.
  const spanSteps = Math.max(1, Math.floor((options.span ?? 1.6) / step));
  const min = options.min ?? step;
  const count = options.count ?? 6;
  const snapped = Math.round(expected / step) * step;
  const candidates: number[] = [];

  const clean = (value: number) => {
    const rounded = round(value, 4);
    // Totals are quoted on half lines: 0.5, 1.5, 156.5 — never on a whole number.
    return half ? Math.floor(rounded) + 0.5 : round(rounded, 1);
  };

  for (let offset = -spanSteps; offset <= spanSteps; offset += 1) {
    const line = clean(snapped + offset * step);
    if (line >= min) candidates.push(line);
  }

  // Always include the nearest half line either side of the expectation.
  const floorHalf = Math.floor(expected) + 0.5;
  for (const line of [floorHalf, floorHalf + 1]) {
    if (line >= min && !candidates.includes(line)) candidates.push(line);
  }

  return [...new Set(candidates)].sort((a, b) => a - b).slice(0, count);
}

export function buildMarkets(fixture: Fixture, core: MarketModel): Market[] {
  const markets: Market[] = [];
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  // Labels carry the full club name: a bet slip reading "M over 1.5" is useless.
  const hs = home.name;
  const as = away.name;
  const cells = core.grid;
  const expectedTotal = core.expected.home + core.expected.away;
  const sd = Math.max(0.35, core.sd);

  const overUnder = (line: number) => {
    const over = cells.reduce((sum, c) => sum + (c.home + c.away > line ? c.probability : 0), 0);
    return { over: clamp(over, 0.001, 0.999), under: clamp(1 - over, 0.001, 0.999) };
  };
  const exactTotals = (max: number, label: string) => {
    const specs: OutcomeSpec[] = [];
    let covered = 0;
    for (let total = 0; total < max; total++) {
      const probability = cells.reduce((sum, c) => sum + (c.home + c.away === total ? c.probability : 0), 0);
      covered += probability;
      specs.push({ label: String(total), probability });
    }
    specs.push({ label: `${max}+`, probability: Math.max(0.001, 1 - covered) });
    markets.push(mk(fixture, 'totalexact', 'totals', label, 'The exact combined score', specs));
  };
  const teamTotal = (
    side: 'home' | 'away',
    mean: number,
    sigma: number,
    label: string,
    lines: number[],
    scope: string
  ) => {
    for (const line of lines) {
      const over = clamp(1 - normalCdf((line - mean) / sigma), 0.02, 0.98);
      markets.push(mk(fixture, `teamtotal-${side}-${Math.round(line * 10)}`, 'totals', `${label} ${fmtLine(line)}`, `${label} over / under`, [
        { label: `${scope} over ${fmtLine(line)}`, probability: over },
        { label: `${scope} under ${fmtLine(line)}`, probability: 1 - over }
      ]));
    }
  };
  /** Continuous over/under ladder from a mean and spread. */
  const numericTotal = (
    idPrefix: string,
    label: string,
    description: string,
    mean: number,
    sigma: number,
    lineOptions: Parameters<typeof ladder>[1],
    scope = 'match'
  ) => {
    for (const line of ladder(mean, lineOptions)) {
      const over = clamp(1 - normalCdf((line - mean) / sigma), 0.02, 0.98);
      markets.push(mk(fixture, `${idPrefix}${Math.round(line * 10)}`, 'totals', `${label} ${fmtLine(line)}`, description, [
        { label: `${scope} over ${fmtLine(line)}`, probability: over },
        { label: `${scope} under ${fmtLine(line)}`, probability: 1 - over }
      ]));
    }
  };
  /** Continuous handicap ladder from an expected margin. */
  const numericHandicap = (
    idPrefix: string,
    label: string,
    description: string,
    margin: number,
    sigma: number,
    lines: number[],
    unit = ''
  ) => {
    for (const line of lines) {
      const homeCovers = clamp(1 - normalCdf((-line - margin) / sigma), 0.02, 0.98);
      markets.push(mk(fixture, `${idPrefix}${Math.round(Math.abs(line) * 10)}${line < 0 ? 'n' : 'p'}`, 'handicap', `${label} ${fmtLine(line)}`, description, [
        { label: `${hs} ${line > 0 ? '+' : ''}${fmtLine(line)}${unit}`, probability: homeCovers },
        { label: `${as} ${-line > 0 ? '+' : ''}${fmtLine(-line)}${unit}`, probability: 1 - homeCovers }
      ]));
    }
  };
  const periodMarkets = (periods: PeriodModel[]) => {
    for (const p of periods) {
      const specs: OutcomeSpec[] = [{ label: `${hs} win`, probability: p.home }];
      if (p.draw > 0.04) specs.push({ label: 'Tie', probability: p.draw });
      specs.push({ label: `${as} win`, probability: p.away });
      markets.push(mk(fixture, p.id, 'period', p.label, `${p.label} result`, specs));
      markets.push(mk(fixture, `${p.id}total`, 'period', `${p.label} total ${fmtLine(p.line)}`, `${p.label} combined score`, [
        { label: `${p.label.toLowerCase()} over ${fmtLine(p.line)}`, probability: p.over },
        { label: `${p.label.toLowerCase()} under ${fmtLine(p.line)}`, probability: p.under }
      ]));
    }
  };
  const scoreMarket = (title: string, top = 7) => mk(fixture, 'cs', 'score', 'Correct score', title, [
    ...core.topScorelines.slice(0, top).map((c) => ({ label: `${c.home}–${c.away}`, probability: c.probability })),
    { label: 'Any other', probability: Math.max(0.001, 1 - core.topScorelines.slice(0, top).reduce((a, c) => a + c.probability, 0)) }
  ]);
  /** Asian handicap from the goal grid, handling the push on whole lines. */
  const gridHandicap = (line: number, label: string, description: string) => {
    const win = cells.reduce((sum, c) => sum + (c.home - c.away + line > 0 ? c.probability : 0), 0);
    const push = Number.isInteger(line) ? cells.reduce((sum, c) => sum + (c.home - c.away + line === 0 ? c.probability : 0), 0) : 0;
    const denom = Math.max(0.02, 1 - push);
    markets.push(mk(fixture, `ah${Math.round(Math.abs(line) * 10)}${line < 0 ? 'n' : 'p'}`, 'handicap', `${label} ${fmtLine(line)}`, description, [
      { label: `${hs} ${line > 0 ? '+' : ''}${fmtLine(line)}`, probability: clamp(win / denom, 0.02, 0.98) },
      { label: `${as} ${-line > 0 ? '+' : ''}${fmtLine(-line)}`, probability: clamp((denom - win) / denom, 0.02, 0.98) }
    ]));
  };

  if (fixture.sport === 'football') {
    markets.push(
      mk(fixture, '1x2', 'match', 'Match result — 1X2', 'Full-time three-way result', [
        { label: `${hs} win`, probability: core.home }, { label: 'Draw', probability: core.draw }, { label: `${as} win`, probability: core.away }
      ]),
      mk(fixture, 'ht', 'period', 'Half-time result', 'Result after the first 45 minutes', [
        { label: `${hs} win`, probability: core.periods[0].home }, { label: 'Draw', probability: core.periods[0].draw }, { label: `${as} win`, probability: core.periods[0].away }
      ]),
      mk(fixture, 'htft', 'period', 'Half-time / full-time', 'Half-time result followed by full-time result', (() => {
        const probs = htft(core.halves?.first ?? [], core.halves?.second ?? []);
        return [`${hs}/${hs}`, `${hs}/Draw`, `${hs}/${as}`, `Draw/${hs}`, 'Draw/Draw', `Draw/${as}`, `${as}/${hs}`, `${as}/Draw`, `${as}/${as}`].map((label, i) => ({ label, probability: probs[i] ?? 0 }));
      })()),
      mk(fixture, 'dc', 'match', 'Double chance', 'Two of the three results covered', [
        { label: `${hs} or draw`, probability: core.home + core.draw },
        { label: `${hs} or ${as}`, probability: core.home + core.away },
        { label: `Draw or ${as}`, probability: core.draw + core.away }
      ]),
      mk(fixture, 'dnb', 'match', 'Draw no bet', 'Stake returned on a draw', [
        { label: hs, probability: core.home / Math.max(0.01, core.home + core.away) },
        { label: as, probability: core.away / Math.max(0.01, core.home + core.away) }
      ]),
      mk(fixture, 'btts', 'totals', 'Both teams to score', 'Both sides find the net', [
        { label: 'Yes', probability: core.btts }, { label: 'No', probability: 1 - core.btts }
      ])
    );

    // Full-time totals around this fixture's expectation (0.5 up to 6.5).
    for (const line of ladder(expectedTotal, { step: 0.5, span: 1.5, min: 0.5, count: 6 })) {
      const t = overUnder(line);
      markets.push(mk(fixture, `ou${Math.round(line * 10)}`, 'totals', `Total goals — ${fmtLine(line)}`, 'Over / under goals', [
        { label: `match over ${fmtLine(line)}`, probability: t.over }, { label: `match under ${fmtLine(line)}`, probability: t.under }
      ]));
    }
    exactTotals(7, 'Total goals — exact');

    // Asian handicap ladder around the projected margin.
    const margin = core.expected.home - core.expected.away;
    const ahLines = Number(margin >= 0.25) ? [0.5, 1, 1.5, 2] : margin <= -0.25 ? [-0.5, -1, -1.5, -2] : [0, 0.5, -0.5];
    for (const line of ahLines) {
      gridHandicap(line, `Asian handicap ${hs}`, line === 0 ? 'Level ball; the draw is a push' : 'One-goal steps; whole lines push on the exact margin');
    }

    // First-half totals ladder from the half-time expectation.
    const firstHalf = core.periods[0];
    for (const line of ladder(firstHalf.total, { step: 0.5, span: 1, min: 0.5, count: 4 })) {
      const over = cells.reduce((sum, c) => sum + (c.home + c.away > line ? c.probability : 0), 0);
      markets.push(mk(fixture, `htou${Math.round(line * 10)}`, 'period', `1st half total ${fmtLine(line)}`, 'Combined goals before the break', [
        { label: `1st half over ${fmtLine(line)}`, probability: clamp(over * 0.46, 0.02, 0.98) },
        { label: `1st half under ${fmtLine(line)}`, probability: clamp(1 - over * 0.46, 0.02, 0.98) }
      ]));
    }

    // Team totals around each side's own expectation.
    teamTotal('home', core.expected.home, Math.max(0.5, sd * 0.8), `${hs} goals`, ladder(core.expected.home, { step: 0.5, span: 1, min: 0.5, count: 3 }), hs);
    teamTotal('away', core.expected.away, Math.max(0.5, sd * 0.8), `${as} goals`, ladder(core.expected.away, { step: 0.5, span: 1, min: 0.5, count: 3 }), as);

    markets.push(scoreMarket('Top projected full-time scorelines'));
    periodMarkets(core.periods);
  }

  if (fixture.sport === 'basketball') {
    const spreadLine = core.spread?.line ?? 0;
    const totalMean = core.totalLine?.line ?? expectedTotal;
    const margin = core.margin || core.expected.home - core.expected.away;
    const pointSd = Math.max(6, core.sd);

    markets.push(
      mk(fixture, 'ml', 'match', 'Moneyline', 'Outright winner including overtime', [
        { label: hs, probability: core.home }, { label: as, probability: core.away }
      ])
    );

    // Spread ladder: the model's own line plus the two steps either side.
    const spreadLines = [-1, 0, 1].map((offset) => round(spreadLine + offset * 4.5, 1)).filter((line, i, arr) => arr.indexOf(line) === i);
    for (const line of spreadLines) {
      const homeCovers = clamp(1 - normalCdf((-line - margin) / pointSd), 0.02, 0.98);
      markets.push(mk(fixture, `spread${Math.round(Math.abs(line) * 10)}${line < 0 ? 'n' : 'p'}`, 'handicap', `Points spread ${line > 0 ? '+' : ''}${fmtLine(line)}`, 'Handicap including overtime; exact margin is a push', [
        { label: `${hs} ${line > 0 ? '+' : ''}${fmtLine(line)}`, probability: homeCovers },
        { label: `${as} ${-line > 0 ? '+' : ''}${fmtLine(-line)}`, probability: 1 - homeCovers }
      ]));
    }

    // Totals ladder around the projected combined points (e.g. 156.5 … 234.5).
    numericTotal('total', 'Total points', 'Combined points over / under including overtime', totalMean, pointSd * 1.15, { step: 4.5, span: 9, min: 40, count: 5 }, 'match');

    // First-half totals around half the projection.
    numericTotal('h1total', '1st half points', 'Combined points in the first half', totalMean / 2.02, (pointSd * 1.15) / 1.9, { step: 4.5, span: 9, min: 30, count: 4 }, '1st half');

    teamTotal('home', core.expected.home, 9.6, `${hs} team total`, ladder(core.expected.home, { step: 4.5, span: 5, min: 30, count: 2 }), hs);
    teamTotal('away', core.expected.away, 9.6, `${as} team total`, ladder(core.expected.away, { step: 4.5, span: 5, min: 30, count: 2 }), as);

    const bandSd = Math.max(5, core.sd);
    const bands = [[1, 5], [6, 10], [11, 15], [16, 200], [-5, -1], [-10, -6], [-15, -11], [-200, -16]];
    markets.push(mk(fixture, 'margin', 'score', 'Winning margin', 'Final margin bands including overtime', bands.map(([lo, hi]) => ({
      label: `${lo > 0 ? hs : as} ${Math.abs(lo)}–${Math.abs(hi) === 200 ? '16+' : Math.abs(hi)}`,
      probability: normalCdf((hi + 0.5 - margin) / bandSd) - normalCdf((lo - 0.5 - margin) / bandSd)
    }))));
    const start = Math.floor(expectedTotal / 10) * 10 - 20;
    const totalBands = Array.from({ length: 5 }, (_, i) => {
      const lo = start + i * 10;
      const hi = lo + 9;
      return { label: `${lo}–${hi}`, probability: normalCdf((hi + 0.5 - expectedTotal) / (core.sd * 1.5)) - normalCdf((lo - 0.5 - expectedTotal) / (core.sd * 1.5)) };
    });
    totalBands.push({ label: `${start + 50}+`, probability: Math.max(0.001, 1 - totalBands.reduce((a, b) => a + b.probability, 0)) });
    markets.push(mk(fixture, 'totalband', 'score', 'Total points band', 'Final combined points band', totalBands));
    periodMarkets(core.periods);
  }

  if (fixture.sport === 'icehockey') {
    const goalSd = Math.max(1.1, core.sd);
    const margin = core.expected.home - core.expected.away;
    const totalMean = core.totalLine?.line ?? expectedTotal;
    markets.push(
      mk(fixture, '1x2', 'match', '60-minute result', 'Three-way result after regulation', [
        { label: `${hs} win`, probability: core.home }, { label: 'Draw after 60', probability: core.draw }, { label: `${as} win`, probability: core.away }
      ]),
      mk(fixture, 'ml', 'match', 'Moneyline (incl. OT)', 'Winner including overtime and shootout', [
        { label: hs, probability: core.moneyline?.home ?? core.home }, { label: as, probability: core.moneyline?.away ?? core.away }
      ])
    );
    numericHandicap('puck', 'Puck line', 'Final score with a 1.5-goal handicap', margin, goalSd, [-1.5, 1.5]);
    numericTotal('total', 'Total goals', 'Combined goals over / under', totalMean, goalSd, { step: 0.5, span: 1.25, min: 3.5, count: 5 }, 'match');
    numericTotal('p1total', '1st period goals', 'Combined goals in the opening period', totalMean / 3.05, goalSd / 1.7, { step: 0.5, span: 1, min: 0.5, count: 3 }, '1st period');
    exactTotals(8, 'Total goals — exact');
    teamTotal('home', core.expected.home, 1.8, `${hs} goals`, ladder(core.expected.home, { step: 0.5, span: 1, min: 0.5, count: 2 }), hs);
    teamTotal('away', core.expected.away, 1.8, `${as} goals`, ladder(core.expected.away, { step: 0.5, span: 1, min: 0.5, count: 2 }), as);
    markets.push(scoreMarket('Top projected scorelines after regulation'));
    periodMarkets(core.periods);
  }

  if (fixture.sport === 'baseball') {
    const runSd = Math.max(1.2, core.sd);
    const margin = core.expected.home - core.expected.away;
    const totalMean = core.totalLine?.line ?? expectedTotal;
    markets.push(
      mk(fixture, 'ml', 'match', 'Moneyline', 'Outright winner including extra innings', [
        { label: hs, probability: core.home }, { label: as, probability: core.away }
      ])
    );
    // Run line in both directions around this fixture's own margin.
    numericHandicap('runline', 'Run line', 'Final score with a 1.5-run handicap', margin, runSd, [-1.5, 1.5]);
    numericTotal('total', 'Total runs', 'Combined runs over / under', totalMean, runSd, { step: 0.5, span: 1.5, min: 5.5, count: 5 }, 'match');
    // First five innings is the standard baseball side market.
    numericTotal('f5total', 'First 5 innings runs', 'Combined runs in the first five innings', totalMean * 0.58, runSd * 0.75, { step: 0.5, span: 1, min: 2.5, count: 3 }, 'first 5 innings');
    exactTotals(11, 'Total runs — exact');
    teamTotal('home', core.expected.home, 1.9, `${hs} runs`, ladder(core.expected.home, { step: 0.5, span: 1, min: 0.5, count: 2 }), hs);
    teamTotal('away', core.expected.away, 1.9, `${as} runs`, ladder(core.expected.away, { step: 0.5, span: 1, min: 0.5, count: 2 }), as);
    markets.push(scoreMarket('Top projected scorelines after extra innings'));
    periodMarkets(core.periods);
  }

  if (fixture.sport === 'tennis') {
    const bestOfFive = fixture.bestOfFive ?? (fixture.leagueId === 'grandslam' && home.elo >= 2100 && away.elo >= 2100);
    const p = core.home;
    let lo = 0.01;
    let hi = 0.99;
    for (let i = 0; i < 40; i++) {
      const x = (lo + hi) / 2;
      const q = bestOfFive ? x ** 3 + 3 * x ** 3 * (1 - x) + 6 * x ** 3 * (1 - x) ** 2 : x ** 2 + 2 * x ** 2 * (1 - x);
      if (q < p) lo = x; else hi = x;
    }
    const s = (lo + hi) / 2;
    const scores = bestOfFive
      ? [{ label: '3–0', probability: s ** 3 }, { label: '3–1', probability: 3 * s ** 3 * (1 - s) }, { label: '3–2', probability: 6 * s ** 3 * (1 - s) ** 2 }, { label: '2–3', probability: 6 * (1 - s) ** 3 * s ** 2 }, { label: '1–3', probability: 3 * (1 - s) ** 3 * s }, { label: '0–3', probability: (1 - s) ** 3 }]
      : [{ label: '2–0', probability: s ** 2 }, { label: '2–1', probability: 2 * s ** 2 * (1 - s) }, { label: '1–2', probability: 2 * (1 - s) ** 2 * s }, { label: '0–2', probability: (1 - s) ** 2 }];
    const cover = scores.filter((x) => (bestOfFive ? ['3–0', '3–1', '3–2'] : ['2–0', '2–1']).includes(x.label)).reduce((a, x) => a + x.probability, 0) * 0.82;
    const gamesMean = core.totalLine?.line ?? (bestOfFive ? 38.5 : 22.5);
    markets.push(
      mk(fixture, 'ml', 'match', 'Match winner', bestOfFive ? 'Best-of-five match' : 'Best-of-three match', [
        { label: home.shortName, probability: p }, { label: away.shortName, probability: 1 - p }
      ]),
      mk(fixture, 'sets', 'sets', 'Correct set score', 'Final set score', scores),
      mk(fixture, 'sethcp', 'handicap', `Set handicap ${home.shortName} −1.5`, 'Straight-set win covers the handicap', [
        { label: `${home.shortName} −1.5`, probability: cover }, { label: `${away.shortName} +1.5`, probability: 1 - cover }
      ]),
      mk(fixture, 'gamehcp', 'handicap', `Game handicap ${home.shortName}`, 'Handicap on total games won', [
        { label: `${home.shortName} ${core.spread?.line ?? 0}`, probability: core.spread?.homeCover ?? 0.5 },
        { label: `${away.shortName} +${Math.abs(core.spread?.line ?? 0)}`, probability: core.spread?.awayCover ?? 0.5 }
      ]),
      mk(fixture, 'set1', 'sets', 'First set winner', 'Result of the opening set', [
        { label: home.shortName, probability: core.periods[0].home }, { label: away.shortName, probability: core.periods[0].away }
      ]),
      mk(fixture, 'set1games', 'sets', 'First set games 9.5', 'Games in the opening set', [
        { label: 'Over 9.5', probability: core.periods[0].over }, { label: 'Under 9.5', probability: core.periods[0].under }
      ])
    );
    numericTotal('games', 'Total games', 'Games in the match', gamesMean, 3.6, { step: 1.5, span: 4.5, min: 12.5, count: 4 }, 'match');
  }

  return markets;
}
