import { BOOKMAKERS } from '#lib/data/catalog';
import { awayTeam, fixtureLeague, homeTeam } from '#lib/data/registry';
import type { Fixture, Market, MarketGroup, MarketOutcome, ScoreCell } from '#lib/types';
import { clamp, fairOdds, jitter, kellyFraction, normalCdf, normalQuantile, round } from './core';
import { scoringProfile } from './scoring';

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

interface OutcomeSpec {
  label: string;
  shortLabel?: string;
  probability: number;
  /**
   * What the market itself believes before it sees our model: the competition's
   * structural probability for this line. Books price the line off consensus
   * and league priors; we price our own, so a genuine disagreement shows up as
   * edge instead of as random noise.
   */
  prior?: number;
}

function priceOutcome(fixture: Fixture, spec: OutcomeSpec, marketId: string, index: number): MarketOutcome {
  const p = clamp(spec.probability, 0.0015, 0.996);
  const key = `${fixture.id}-${marketId}-${index}`;
  // The price reflects the market's own view: mostly the competition prior with
  // a share of the model. If our probability beats that view, the edge is real
  // rather than an artefact of pricing the model against itself.
  const marketP = clamp(spec.prior === undefined ? p : 0.62 * spec.prior + 0.38 * p, 0.01, 0.99);
  const books = BOOKMAKERS.map((book, bi) => {
    const marginFactor = 1 + book.margin * 0.9;
    const bias = jitter(`${key}-${book.id}-bias`, 0.045);
    const noise = 1 + jitter(`${key}-${book.id}-${bi}`, 0.008) + bi * 0.0004;
    const implied = clamp(marketP * marginFactor * (1 + bias) * noise, 0.001, 0.999);
    return { book, odds: round(Math.max(1.01, 1 / implied), 2) };
  });
  const best = books.reduce((a, b) => (b.odds > a.odds ? b : a));
  // A displayed edge above ~35% is a state mismatch, not a market mistake.
  const edge = clamp(p * best.odds - 1, -1, 0.35);
  return {
    id: `${marketId}-${index}`, label: spec.label, shortLabel: spec.shortLabel,
    modelProbability: round(p, 4), fairOdds: fairOdds(p), bookOdds: best.odds,
    prior: spec.prior === undefined ? undefined : round(spec.prior, 4),
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

/** Lines are quoted on half steps in the sport's own scoring unit. */
const halfLine = (value: number) => Math.floor(value) + 0.5;

/**
 * The lines a punter should actually be offered.
 *
 * A ladder centred on the model's expectation is a coin flip with a price tag.
 * Instead we place the quote away from the mean, at the distance where the model
 * is genuinely confident (default 76%), and then quote one and two steps further
 * out so there is a ranked choice. The near-mean line is never published: it is
 * the one the book wins.
 */
export function safeLineSet(
  mean: number,
  sd: number,
  step: number,
  opts: { min?: number; max?: number; target?: number; count?: number; half?: boolean } = {}
): { over: number[]; under: number[] } {
  const spread = Math.max(0.2, sd);
  const target = opts.target ?? 0.76;
  const z = Math.max(0.4, normalQuantile(target));
  const count = opts.count ?? 3;
  const min = opts.min ?? step;
  const clean = (value: number) => (opts.half === false ? round(value, 1) : halfLine(value));

  const over: number[] = [];
  const under: number[] = [];
  for (let i = 0; i < count; i++) {
    const distance = (z + i * 0.32) * spread;
    const o = clean(mean - distance);
    const u = clean(mean + distance);
    if (o >= min && (opts.max === undefined || o <= opts.max)) over.push(o);
    if (u >= min && (opts.max === undefined || u <= opts.max)) under.push(u);
  }
  const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
  return { over: unique(over), under: unique(under) };
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
  const league = fixtureLeague(fixture);
  const profile = scoringProfile(fixture.sport, fixture.leagueId, `${league.name} ${league.country ?? ''}`);

  // The market sees the same score we do; it just shrinks fixture-specific
  // expectation towards the competition average. Building the prior that way
  // keeps live totals sane and makes every edge a disagreement about the
  // fixture, never about a mismatched match state.
  const live = fixture.status === 'live';
  const scored = fixture.score.home + fixture.score.away;
  // Live: the desk has the same scoreboard, so it only disagrees about the
  // remaining goals. Pre-match: it shrinks the fixture towards the league.
  const priorTotalMean = live
    ? scored + 0.85 * Math.max(0, expectedTotal - scored)
    : 0.5 * expectedTotal + 0.5 * profile.total;
  const priorTotalSd = Math.max(0.35, Math.sqrt(Math.max(0.6, expectedTotal)));
  /** What a consensus desk would believe about a full-time total line. */
  const priorOver = (line: number, scale = 1) =>
    clamp(1 - normalCdf((line - priorTotalMean * scale) / (priorTotalSd * Math.max(0.4, scale))), 0.03, 0.97);
  /** Market view of a handicap: level line, standard margin volatility. */
  const priorCover = (line: number) => clamp(1 - normalCdf((-line - 0) / Math.max(0.6, profile.sdTotal * 0.62)), 0.02, 0.98);

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
    opts: { step: number; min?: number; count?: number; half?: boolean },
    scope: string
  ) => {
    const lines = safeLineSet(mean, sigma, opts.step, { min: opts.min, count: opts.count ?? 2, half: opts.half });
    const scoredSide = fixture.status === 'live'
      ? (side === 'home' ? fixture.score.home : fixture.score.away)
      : 0;
    const priorMean = fixture.status === 'live'
      ? scoredSide + 0.85 * Math.max(0, mean - scoredSide)
      : 0.55 * mean + 0.45 * profile.perTeam;
    for (const line of [...lines.over, ...lines.under]) {
      const over = clamp(1 - normalCdf((line - mean) / sigma), 0.02, 0.98);
      if (over < 0.12 || over > 0.9) continue;
      const prior = clamp(1 - normalCdf((line - priorMean) / Math.max(0.2, sigma)), 0.02, 0.98);
      markets.push(mk(fixture, `teamtotal-${side}-${Math.round(line * 10)}`, 'totals', `${label} ${fmtLine(line)}`, `${label} over / under`, [
        { label: `${scope} over ${fmtLine(line)}`, probability: over, prior },
        { label: `${scope} under ${fmtLine(line)}`, probability: 1 - over, prior: 1 - prior }
      ]));
    }
  };
  /**
   * Over/under markets quoted away from the mean, where the model is actually
   * confident, with the competition's own rate attached as the market prior.
   */
  const numericTotal = (
    idPrefix: string,
    label: string,
    description: string,
    mean: number,
    sigma: number,
    options: {
      step: number;
      min?: number;
      max?: number;
      count?: number;
      half?: boolean;
      /** League view of this period's mean, when the period is a slice of the match. */
      priorMean?: number;
      /** League view of this period's spread. */
      priorSd?: number;
    },
    scope = 'match'
  ) => {
    const lines = safeLineSet(mean, sigma, options.step, {
      min: options.min,
      max: options.max,
      count: options.count ?? 3,
      half: options.half
    });
    // A period's consensus view has to move with the same spread the model
    // quotes. Scaling the full-time prior down by a fixed share made an
    // sd mismatch look like a 13-point edge on a first-five-innings total.
    const periodPrior = (line: number) =>
      options.priorMean === undefined
        ? priorOver(line)
        : clamp(1 - normalCdf((line - options.priorMean) / (options.priorSd ?? sigma)), 0.03, 0.97);
    for (const line of [...lines.over, ...lines.under]) {
      const computed = clamp(1 - normalCdf((line - mean) / sigma), 0.02, 0.98);
      // A line the model "wins" 99% of the time is not a market — it is a
      // rounding error with a price attached. Keep the published band tight.
      if (computed < 0.14 || computed > 0.9) continue;
      const over = computed;
      markets.push(mk(fixture, `${idPrefix}${Math.round(line * 10)}`, 'totals', `${label} ${fmtLine(line)}`, description, [
        { label: `${scope} over ${fmtLine(line)}`, probability: over, prior: periodPrior(line) },
        { label: `${scope} under ${fmtLine(line)}`, probability: 1 - over, prior: 1 - periodPrior(line) }
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
    // Only quote a handicap the model is genuinely on the right side of: a
    // line inside the noise band is a coin flip wearing a handicap's clothes.
    const usable = lines.filter((line) => Math.abs(line + margin) >= 0.62 * Math.max(0.4, sigma));
    for (const line of usable.length ? usable : lines) {
      const homeCovers = clamp(1 - normalCdf((-line - margin) / Math.max(0.4, sigma)), 0.02, 0.98);
      markets.push(mk(fixture, `${idPrefix}${Math.round(Math.abs(line) * 10)}${line < 0 ? 'n' : 'p'}`, 'handicap', `${label} ${fmtLine(line)}`, description, [
        { label: `${hs} ${line > 0 ? '+' : ''}${fmtLine(line)}${unit}`, probability: homeCovers, prior: priorCover(line) },
        { label: `${as} ${-line > 0 ? '+' : ''}${fmtLine(-line)}${unit}`, probability: 1 - homeCovers, prior: 1 - priorCover(line) }
      ]));
    }
  };
  const periodMarkets = (periods: PeriodModel[]) => {
    for (const p of periods) {
      const specs: OutcomeSpec[] = [{ label: `${hs} win`, probability: p.home }];
      if (p.draw > 0.04) specs.push({ label: 'Tie', probability: p.draw });
      specs.push({ label: `${as} win`, probability: p.away });
      markets.push(mk(fixture, p.id, 'period', p.label, `${p.label} result`, specs));
      // The period's own distribution is the prior: a quarter total is not a
      // share of the match prior, it is its own market.
      // A period total quoted on the period's own mean is a coin flip. Move
      // the line out to where the model has an opinion, and keep it on a half
      // point so it can never push.
      const periodSd = Math.max(0.9, Math.sqrt(Math.max(1, p.total)) * 1.05);
      const line = Math.max(0.5, halfLine(p.total + (p.over >= 0.5 ? 1 : -1) * 0.7 * periodSd));
      const over = clamp(1 - normalCdf((line - p.total) / periodSd), 0.02, 0.98);
      if (over < 0.13 || over > 0.9) return;
      const priorFor = (value: number) => clamp(1 - normalCdf((value - p.total) / periodSd), 0.03, 0.97);
      markets.push(mk(fixture, `${p.id}total`, 'period', `${p.label} total ${fmtLine(line)}`, `${p.label} combined score`, [
        { label: `${p.label.toLowerCase()} over ${fmtLine(line)}`, probability: over, prior: priorFor(line) },
        { label: `${p.label.toLowerCase()} under ${fmtLine(line)}`, probability: 1 - over, prior: 1 - priorFor(line) }
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

    // Full-time totals are quoted away from the mean, on both sides, so every
    // line published is one the model is actually confident about.
    const ftLines = safeLineSet(expectedTotal, Math.max(0.7, Math.sqrt(expectedTotal)), 0.5, { min: 0.5, count: 3 });
    for (const line of [...ftLines.over, ...ftLines.under]) {
      const t = overUnder(line);
      if (t.over < 0.12 || t.over > 0.92) continue;
      markets.push(mk(fixture, `ou${Math.round(line * 10)}`, 'totals', `Total goals — ${fmtLine(line)}`, 'Over / under goals', [
        { label: `match over ${fmtLine(line)}`, probability: t.over, prior: priorOver(line) },
        { label: `match under ${fmtLine(line)}`, probability: t.under, prior: 1 - priorOver(line) }
      ]));
    }
    exactTotals(7, 'Total goals — exact');

    // Asian handicap ladder around the projected margin.
    const margin = core.expected.home - core.expected.away;
    // Include the cushions a punter actually takes (+1.5, +2.5, -1.5), not only
    // the level ball the model happens to sit on.
    const ahCandidates = [2.5, 2, 1.5, 1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5];
    const ahLines = ahCandidates
      .filter((line) => Math.abs(line + margin) >= 0.55)
      .sort((a, b) => Math.abs(a + margin) - Math.abs(b + margin))
      .slice(0, 4);
    for (const line of ahLines) {
      gridHandicap(line, `Asian handicap ${hs}`, line === 0 ? 'Level ball; the draw is a push' : 'One-goal steps; whole lines push on the exact margin');
    }

    // First-half totals ladder from the half-time expectation.
    const firstHalf = core.periods[0];
    const halfCells = core.halves?.first ?? [];
    const halfOver = (line: number) =>
      halfCells.length
        ? clamp(halfCells.reduce((sum, c) => sum + (c.home + c.away > line ? c.probability : 0), 0), 0.02, 0.98)
        : clamp(1 - normalCdf((line - firstHalf.total) / Math.max(0.35, Math.sqrt(firstHalf.total))), 0.02, 0.98);
    const htLines = safeLineSet(firstHalf.total, Math.max(0.32, Math.sqrt(firstHalf.total) * 0.72), 0.5, { min: 0.5, count: 2 });
    for (const line of [...htLines.over, ...htLines.under]) {
      const over = halfOver(line);
      if (over < 0.12 || over > 0.92) continue;
      markets.push(mk(fixture, `htou${Math.round(line * 10)}`, 'period', `1st half total ${fmtLine(line)}`, 'Combined goals before the break', [
        { label: `1st half over ${fmtLine(line)}`, probability: over, prior: priorOver(line, 0.45) },
        { label: `1st half under ${fmtLine(line)}`, probability: 1 - over, prior: 1 - priorOver(line, 0.45) }
      ]));
    }

    // Half-time Asian handicap: the same cushion logic on the interval margin.
    const halfMargin = (core.periods[0].home - core.periods[0].away) * 0.9;
    const htAhLines = [1.5, 1, 0.5, 0, -0.5, -1, -1.5]
      .filter((line) => Math.abs(line + halfMargin) >= 0.5)
      .sort((a, b) => Math.abs(a + halfMargin) - Math.abs(b + halfMargin))
      .slice(0, 2);
    for (const line of htAhLines) {
      const homeCovers = clamp(1 - normalCdf((-line - halfMargin) / 0.95), 0.02, 0.98);
      markets.push(mk(fixture, `htah${Math.round(Math.abs(line) * 10)}${line < 0 ? 'n' : 'p'}`, 'handicap', `1st half Asian handicap ${hs} ${fmtLine(line)}`, 'First-half handicap; the interval draw can push', [
        { label: `${hs} ${line > 0 ? '+' : ''}${fmtLine(line)}`, probability: homeCovers, prior: priorCover(line) },
        { label: `${as} ${-line > 0 ? '+' : ''}${fmtLine(-line)}`, probability: 1 - homeCovers, prior: 1 - priorCover(line) }
      ]));
    }

    // Team totals around each side's own expectation.
    teamTotal('home', core.expected.home, Math.max(0.5, sd * 0.8), `${hs} goals`, { step: 0.5, min: 0.5, count: 2 }, hs);
    teamTotal('away', core.expected.away, Math.max(0.5, sd * 0.8), `${as} goals`, { step: 0.5, min: 0.5, count: 2 }, as);

    markets.push(scoreMarket('Top projected full-time scorelines'));
    periodMarkets(core.periods);
  }

  if (fixture.sport === 'basketball') {
    const spreadLine = core.spread?.line ?? 0;
    const totalMean = core.expected.home + core.expected.away;
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
    numericTotal('total', 'Total points', 'Combined points over / under including overtime', totalMean, pointSd * 1.15, { step: 4.5, min: 40, count: 3 }, 'match');

    // First-half totals around half the projection.
    numericTotal(
      'h1total',
      '1st half points',
      'Combined points in the first half',
      totalMean / 2.02,
      (pointSd * 1.15) / 1.9,
      { step: 4.5, min: 30, count: 2, priorMean: 0.5 * (totalMean / 2.02) + 0.5 * (profile.total / 2.02), priorSd: ((pointSd * 1.15) / 1.9) * 1.08 },
      '1st half'
    );

    teamTotal('home', core.expected.home, 9.6, `${hs} team total`, { step: 4.5, min: 30, count: 2 }, hs);
    teamTotal('away', core.expected.away, 9.6, `${as} team total`, { step: 4.5, min: 30, count: 2 }, as);

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
    const totalMean = core.expected.home + core.expected.away;
    markets.push(
      mk(fixture, '1x2', 'match', '60-minute result', 'Three-way result after regulation', [
        { label: `${hs} win`, probability: core.home }, { label: 'Draw after 60', probability: core.draw }, { label: `${as} win`, probability: core.away }
      ]),
      mk(fixture, 'ml', 'match', 'Moneyline (incl. OT)', 'Winner including overtime and shootout', [
        { label: hs, probability: core.moneyline?.home ?? core.home }, { label: as, probability: core.moneyline?.away ?? core.away }
      ])
    );
    numericHandicap('puck', 'Puck line', 'Final score with a 1.5-goal handicap', margin, goalSd, [-1.5, 1.5]);
    numericTotal('total', 'Total goals', 'Combined goals over / under', totalMean, goalSd, { step: 0.5, min: 2.5, count: 3 }, 'match');
    numericTotal(
      'p1total',
      '1st period goals',
      'Combined goals in the opening period',
      totalMean / 3.05,
      goalSd / 1.7,
      { step: 0.5, min: 0.5, count: 2, priorMean: 0.5 * (totalMean / 3.05) + 0.5 * (profile.total / 3.05), priorSd: (goalSd / 1.7) * 1.1 },
      '1st period'
    );
    exactTotals(8, 'Total goals — exact');
    teamTotal('home', core.expected.home, 1.8, `${hs} goals`, { step: 0.5, min: 0.5, count: 2 }, hs);
    teamTotal('away', core.expected.away, 1.8, `${as} goals`, { step: 0.5, min: 0.5, count: 2 }, as);
    markets.push(scoreMarket('Top projected scorelines after regulation'));
    periodMarkets(core.periods);
  }

  if (fixture.sport === 'baseball') {
    const marginSd = Math.max(1.2, core.sd);
    const margin = core.expected.home - core.expected.away;
    const totalMean = core.expected.home + core.expected.away;
    // Runs are not as dispersed as the run line implies: a 7.8-run game has a
    // total sd near 4, not the margin's 6. Using the margin spread as the total
    // spread quoted 16.5-run lines as if they were live markets.
    const totalSd = Math.max(1.8, Math.sqrt(Math.max(1, totalMean)) * 1.45);
    const f5Mean = totalMean * 0.56;
    const f5Sd = Math.max(1.3, Math.sqrt(Math.max(1, f5Mean)) * 1.15);
    markets.push(
      mk(fixture, 'ml', 'match', 'Moneyline', 'Outright winner including extra innings', [
        { label: hs, probability: core.home }, { label: as, probability: core.away }
      ])
    );
    // Run line in both directions around this fixture's own margin.
    numericHandicap('runline', 'Run line', 'Final score with a 1.5-run handicap', margin, marginSd, [-1.5, 1.5]);
    numericTotal('total', 'Total runs', 'Combined runs over / under', totalMean, totalSd, { step: 0.5, min: 5.5, count: 3 }, 'match');
    // First five innings is the standard baseball side market, priced on the
    // first five innings' own mean and spread rather than a slice of full time.
    numericTotal(
      'f5total',
      'First 5 innings runs',
      'Combined runs in the first five innings',
      f5Mean,
      f5Sd,
      { step: 0.5, min: 2.5, count: 2, priorMean: 0.5 * f5Mean + 0.5 * profile.total * 0.56, priorSd: f5Sd * 1.08 },
      'first 5 innings'
    );
    exactTotals(11, 'Total runs — exact');
    teamTotal('home', core.expected.home, 1.9, `${hs} runs`, { step: 0.5, min: 0.5, count: 2 }, hs);
    teamTotal('away', core.expected.away, 1.9, `${as} runs`, { step: 0.5, min: 0.5, count: 2 }, as);
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
    );
    // The opening-set games line is priced from the opening set's own
    // expectation and carries a consensus prior, like every other total.
    const firstSet = core.periods[0];
    const firstSetLine = Math.max(5.5, halfLine(firstSet.total));
    const firstSetSd = Math.max(1.4, Math.sqrt(Math.max(4, firstSet.total)) * 1.15);
    const firstSetOver = clamp(1 - normalCdf((firstSetLine - firstSet.total) / firstSetSd), 0.05, 0.95);
    markets.push(
      mk(fixture, 'set1games', 'sets', `First set games ${fmtLine(firstSetLine)}`, 'Games in the opening set', [
        { label: `first set over ${fmtLine(firstSetLine)}`, probability: firstSetOver, prior: firstSetOver },
        { label: `first set under ${fmtLine(firstSetLine)}`, probability: 1 - firstSetOver, prior: 1 - firstSetOver }
      ])
    );
    numericTotal('games', 'Total games', 'Games in the match', gamesMean, 3.6, { step: 1, min: 12.5, count: 2 }, 'match');
  }

  return markets;
}
