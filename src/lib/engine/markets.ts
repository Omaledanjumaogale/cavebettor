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
  return {
    id, group, label, description,
    outcomes: specs.map((s, i) => priceOutcome(fixture, s, id, i)),
    bookmakerCount: BOOKMAKERS.length, updatedAt: new Date().toISOString()
  };
}

function htft(first: ScoreCell[], second: ScoreCell[]): number[] {
  const out = Array(9).fill(0);
  const idx = (h: number, a: number) => (h > a ? 0 : h === a ? 1 : 2);
  for (const f of first) for (const s of second) out[idx(f.home, f.away) * 3 + idx(f.home + s.home, f.away + s.away)] += f.probability * s.probability;
  return out;
}

export function buildMarkets(fixture: Fixture, core: MarketModel): Market[] {
  const markets: Market[] = [];
  const home = homeTeam(fixture);
  const away = awayTeam(fixture);
  const hs = home.shortName;
  const as = away.shortName;
  const cells = core.grid;
  const expectedTotal = core.expected.home + core.expected.away;

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
  const teamTotal = (side: 'home' | 'away', mean: number, sd: number, label: string) => {
    const line = Math.round(mean * 2) / 2;
    const over = clamp(1 - normalCdf((line - mean) / sd), 0.03, 0.97);
    markets.push(mk(fixture, `teamtotal-${side}`, 'totals', `${label} ${line}`, `${label} over / under`, [
      { label: `Over ${line}`, probability: over }, { label: `Under ${line}`, probability: 1 - over }
    ]));
  };
  const periodMarkets = (periods: PeriodModel[]) => {
    for (const p of periods) {
      const specs: OutcomeSpec[] = [{ label: `${hs} win`, probability: p.home }];
      if (p.draw > 0.04) specs.push({ label: 'Tie', probability: p.draw });
      specs.push({ label: `${as} win`, probability: p.away });
      markets.push(mk(fixture, p.id, 'period', p.label, `${p.label} result`, specs));
      markets.push(mk(fixture, `${p.id}total`, 'period', `${p.label} total ${p.line}`, `${p.label} combined score`, [
        { label: `Over ${p.line}`, probability: p.over }, { label: `Under ${p.line}`, probability: p.under }
      ]));
    }
  };
  const scoreMarket = (title: string, top = 7) => mk(fixture, 'cs', 'score', 'Correct score', title, [
    ...core.topScorelines.slice(0, top).map((c) => ({ label: `${c.home}–${c.away}`, probability: c.probability })),
    { label: 'Any other', probability: Math.max(0.001, 1 - core.topScorelines.slice(0, top).reduce((a, c) => a + c.probability, 0)) }
  ]);

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
    for (const line of [1.5, 2.5, 3.5]) {
      const t = overUnder(line);
      markets.push(mk(fixture, `ou${String(line).replace('.', '')}`, 'totals', `Total goals — ${line}`, 'Over / under goals', [
        { label: `Over ${line}`, probability: t.over }, { label: `Under ${line}`, probability: t.under }
      ]));
    }
    exactTotals(7, 'Total goals — exact');
    const ahHome = cells.reduce((sum, c) => sum + (c.home - c.away > 1 ? c.probability : 0), 0);
    const push = cells.reduce((sum, c) => sum + (c.home - c.away === 1 ? c.probability : 0), 0);
    const denom = Math.max(0.01, 1 - push);
    markets.push(
      mk(fixture, 'ah', 'handicap', `Asian handicap ${hs} −1`, 'One-goal handicap; a one-goal home win is a push', [
        { label: `${hs} −1`, probability: ahHome / denom }, { label: `${as} +1`, probability: (denom - ahHome) / denom }
      ]),
      mk(fixture, 'ah15', 'handicap', `Asian handicap ${hs} −1.5`, 'Home side must win by two or more', [
        { label: `${hs} −1.5`, probability: overUnder(1.5).over }, { label: `${as} +1.5`, probability: overUnder(1.5).under }
      ]),
      scoreMarket('Top projected full-time scorelines')
    );
    periodMarkets(core.periods);
  }

  if (fixture.sport === 'basketball') {
    const line = core.spread?.line ?? 0;
    const totalLine = core.totalLine?.line ?? Math.round(expectedTotal * 2) / 2;
    const cover = core.spread?.homeCover ?? 0.5;
    markets.push(
      mk(fixture, 'ml', 'match', 'Moneyline', 'Outright winner including overtime', [
        { label: hs, probability: core.home }, { label: as, probability: core.away }
      ]),
      mk(fixture, 'spread', 'handicap', `Points spread ${line > 0 ? '+' : ''}${line}`, 'Handicap including overtime; exact margin is a push', [
        { label: `${hs} ${line > 0 ? '+' : ''}${line}`, probability: cover },
        { label: `${as} ${-line > 0 ? '+' : ''}${-line}`, probability: 1 - cover }
      ]),
      mk(fixture, 'total', 'totals', `Total points ${totalLine}`, 'Combined points over / under including overtime', [
        { label: `Over ${totalLine}`, probability: core.totalLine?.over ?? 0.5 },
        { label: `Under ${totalLine}`, probability: core.totalLine?.under ?? 0.5 }
      ])
    );
    teamTotal('home', core.expected.home, 9.6, `${hs} team total`);
    teamTotal('away', core.expected.away, 9.6, `${as} team total`);
    const sd = Math.max(5, core.sd);
    const bands = [[1, 5], [6, 10], [11, 15], [16, 200], [-5, -1], [-10, -6], [-15, -11], [-200, -16]];
    markets.push(mk(fixture, 'margin', 'score', 'Winning margin', 'Final margin bands including overtime', bands.map(([lo, hi]) => ({
      label: `${lo > 0 ? hs : as} ${Math.abs(lo)}–${Math.abs(hi) === 200 ? '16+' : Math.abs(hi)}`,
      probability: normalCdf((hi + 0.5 - core.margin) / sd) - normalCdf((lo - 0.5 - core.margin) / sd)
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
    markets.push(
      mk(fixture, '1x2', 'match', '60-minute result', 'Three-way result after regulation', [
        { label: `${hs} win`, probability: core.home }, { label: 'Draw after 60', probability: core.draw }, { label: `${as} win`, probability: core.away }
      ]),
      mk(fixture, 'ml', 'match', 'Moneyline (incl. OT)', 'Winner including overtime and shootout', [
        { label: hs, probability: core.moneyline?.home ?? core.home }, { label: as, probability: core.moneyline?.away ?? core.away }
      ]),
      mk(fixture, 'puck', 'handicap', 'Puck line ±1.5', 'Final score with a 1.5-goal handicap', [
        { label: `${hs} −1.5`, probability: core.spread?.homeCover ?? 0.5 }, { label: `${as} +1.5`, probability: core.spread?.awayCover ?? 0.5 }
      ]),
      mk(fixture, 'total', 'totals', `Total goals ${core.totalLine?.line ?? 5.5}`, 'Combined goals over / under', [
        { label: `Over ${core.totalLine?.line ?? 5.5}`, probability: core.totalLine?.over ?? 0.5 },
        { label: `Under ${core.totalLine?.line ?? 5.5}`, probability: core.totalLine?.under ?? 0.5 }
      ])
    );
    exactTotals(8, 'Total goals — exact');
    teamTotal('home', core.expected.home, 1.8, `${hs} team total`);
    teamTotal('away', core.expected.away, 1.8, `${as} team total`);
    markets.push(scoreMarket('Top projected scorelines after regulation'));
    periodMarkets(core.periods);
  }

  if (fixture.sport === 'baseball') {
    markets.push(
      mk(fixture, 'ml', 'match', 'Moneyline', 'Outright winner including extra innings', [
        { label: hs, probability: core.home }, { label: as, probability: core.away }
      ]),
      mk(fixture, 'runline', 'handicap', 'Run line −1.5', 'Home side must win by two or more', [
        { label: `${hs} −1.5`, probability: core.spread?.homeCover ?? 0.5 }, { label: `${as} +1.5`, probability: core.spread?.awayCover ?? 0.5 }
      ]),
      mk(fixture, 'total', 'totals', `Total runs ${core.totalLine?.line ?? 8.5}`, 'Combined runs over / under', [
        { label: `Over ${core.totalLine?.line ?? 8.5}`, probability: core.totalLine?.over ?? 0.5 },
        { label: `Under ${core.totalLine?.line ?? 8.5}`, probability: core.totalLine?.under ?? 0.5 }
      ])
    );
    exactTotals(11, 'Total runs — exact');
    teamTotal('home', core.expected.home, 1.9, `${hs} team total`);
    teamTotal('away', core.expected.away, 1.9, `${as} team total`);
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
    const line = core.totalLine?.line ?? (bestOfFive ? 38.5 : 22.5);
    markets.push(
      mk(fixture, 'ml', 'match', 'Match winner', bestOfFive ? 'Best-of-five match' : 'Best-of-three match', [
        { label: home.shortName, probability: p }, { label: away.shortName, probability: 1 - p }
      ]),
      mk(fixture, 'sets', 'sets', 'Correct set score', 'Final set score', scores),
      mk(fixture, 'sethcp', 'handicap', `Set handicap ${home.shortName} −1.5`, 'Straight-set win covers the handicap', [
        { label: `${home.shortName} −1.5`, probability: cover }, { label: `${away.shortName} +1.5`, probability: 1 - cover }
      ]),
      mk(fixture, 'games', 'totals', `Total games ${line}`, 'Games in the match', [
        { label: `Over ${line}`, probability: core.totalLine?.over ?? 0.5 }, { label: `Under ${line}`, probability: core.totalLine?.under ?? 0.5 }
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
  }

  return markets;
}
