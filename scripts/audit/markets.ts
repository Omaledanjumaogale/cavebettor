/**
 * Market board audit.
 *
 * The board makes a promise: a published selection is likely to win, is priced
 * above the consensus view, and never sits on a coin flip. This walks the whole
 * fixture universe and fails when that promise breaks, so a regression is
 * caught before it reaches a punter rather than after a losing weekend.
 *
 *   npm run audit:markets
 *   npm run audit:markets -- --verbose
 */
import { getPaperBets } from '../../src/lib/engine/analytics';
import { getFixtures } from '../../src/lib/engine/fixtures';
import { getPrediction } from '../../src/lib/engine/predictions';
import { fixtureLeague } from '../../src/lib/data/registry';
import { scoringProfile } from '../../src/lib/engine/scoring';

const verbose = process.argv.includes('--verbose');

interface Failure {
  gate: string;
  detail: string;
}

const failures: Failure[] = [];
const stats = {
  fixtures: 0,
  selected: 0,
  totals: 0,
  handicaps: 0,
  probability: [] as number[],
  odds: [] as number[],
  edge: [] as number[],
  bySport: new Map<string, { picks: number; probability: number; odds: number; edge: number }>()
};

const lineOf = (label: string): number | null => {
  const match = /\b(over|under)\s+([0-9]+(?:\.[0-9]+)?)/i.exec(label);
  return match ? Number(match[2]) : null;
};

for (const fixture of getFixtures()) {
  const card = getPrediction(fixture);
  stats.fixtures += 1;
  const league = fixtureLeague(fixture);
  const profile = scoringProfile(fixture.sport, fixture.leagueId, `${league.name} ${league.country ?? ''}`);
  const mean = card.expectedGoals.total;

  // ── Every quoted total must be an informative, half-point line ────────────
  for (const market of card.markets) {
    if (!/total|games/.test(market.id) || /exact|band/.test(market.id)) continue;
    for (const outcome of market.outcomes) {
      const line = lineOf(outcome.label);
      if (line === null) continue;
      stats.totals += 1;
      if (Math.abs((line % 1) - 0.5) > 1e-9) {
        failures.push({ gate: 'half-line', detail: `${fixture.id} ${outcome.label} is a whole line` });
      }
      if (outcome.modelProbability < 0.07 || outcome.modelProbability > 0.93) {
        failures.push({
          gate: 'band',
          detail: `${fixture.id} ${outcome.label} quotes ${(outcome.modelProbability * 100).toFixed(1)}%`
        });
      }
      if (typeof outcome.prior !== 'number') {
        failures.push({ gate: 'prior', detail: `${fixture.id} ${outcome.label} has no consensus prior` });
      }
    }
  }

  // ── The published board ──────────────────────────────────────────────────
  let previous = 1;
  for (const rec of card.recommendations) {
    stats.selected += 1;
    stats.probability.push(rec.modelProbability);
    stats.odds.push(rec.odds);
    stats.edge.push(rec.edge ?? 0);
    const bucket = stats.bySport.get(fixture.sport) ?? { picks: 0, probability: 0, odds: 0, edge: 0 };
    bucket.picks += 1;
    bucket.probability += rec.modelProbability;
    bucket.odds += rec.odds;
    bucket.edge += rec.edge ?? 0;
    stats.bySport.set(fixture.sport, bucket);

    if (rec.modelProbability > previous + 1e-9) {
      failures.push({ gate: 'ranking', detail: `${fixture.id} board is not ordered by probability` });
    }
    previous = rec.modelProbability;

    if (rec.modelProbability < 0.64) {
      failures.push({
        gate: 'floor',
        detail: `${fixture.id} ${rec.selection} publishes ${(rec.modelProbability * 100).toFixed(1)}%`
      });
    }
    if ((rec.edge ?? 0) < 0) {
      failures.push({ gate: 'edge', detail: `${fixture.id} ${rec.selection} publishes a negative edge` });
    }
    // A price more than twelve points away from the model is not a
    // disagreement about the match; it is a market that was modelled against
    // the wrong distribution. Those used to appear as 35-point 'edges' on
    // first-half lines that the interval whistle had already settled.
    const implied = 1 / rec.odds;
    if (rec.modelProbability - implied > 0.12) {
      failures.push({
        gate: 'price',
        detail: `${fixture.id} ${rec.selection} at ${rec.odds.toFixed(2)} implies ${(implied * 100).toFixed(0)}% against a ${(rec.modelProbability * 100).toFixed(0)}% model`
      });
    }

    const totals = lineOf(rec.selection);
    if (totals !== null && /total/i.test(rec.market)) {
      if (rec.modelProbability < 0.66 || rec.modelProbability > 0.93) {
        failures.push({ gate: 'totals-band', detail: `${fixture.id} ${rec.selection} at ${(rec.modelProbability * 100).toFixed(1)}%` });
      }
      if (fixture.status !== 'live' && Math.abs(totals - mean) < 0.2) {
        failures.push({ gate: 'totals-centre', detail: `${fixture.id} ${rec.selection} sits on the projection (${mean.toFixed(1)})` });
      }
    }

    if (/^(ah|spread|puck|runline|sethcp)/.test(rec.marketId ?? '')) {
      stats.handicaps += 1;
      const cushion = /([+\-−–])\s*([0-9]+(?:\.[0-9]+)?)/.exec(rec.selection);
      const unit = fixture.sport === 'basketball' ? 4 : 1;
      const value = cushion ? Number(cushion[2]) : 0;
      if (value < unit * 0.9 && rec.modelProbability < 0.8) {
        failures.push({ gate: 'handicap-cushion', detail: `${fixture.id} ${rec.selection} has no cushion at ${(rec.modelProbability * 100).toFixed(1)}%` });
      }
    }
  }

  // ── Never both sides of one line ─────────────────────────────────────────
  const sides = new Map<string, Set<string>>();
  for (const rec of card.recommendations) {
    const line = lineOf(rec.selection);
    if (line === null) continue;
    const key = `${rec.marketId}|${line}`;
    const set = sides.get(key) ?? new Set<string>();
    set.add(/\bover\b/i.test(rec.selection) ? 'over' : 'under');
    sides.set(key, set);
  }
  for (const [key, set] of sides) {
    if (set.size > 1) failures.push({ gate: 'compatibility', detail: `${fixture.id} publishes both sides of ${key}` });
  }

  // ── A projection can never leave its competition's envelope ──────────────
  if (fixture.status === 'scheduled') {
    if (card.expectedGoals.total > profile.total * 1.5) {
      failures.push({ gate: 'envelope', detail: `${fixture.id} projects ${card.expectedGoals.total.toFixed(1)} in a ${profile.total} competition` });
    }
  }
}

// ── The ledger records only what the board published ───────────────────────
// A paper desk that logs calls the board refused to print measures a
// different strategy than the one the product recommends.
const ledger = getPaperBets();
for (const bet of ledger) {
  if (bet.modelProbability < 0.64 || bet.edge < 0.01) {
    failures.push({
      gate: 'ledger',
      detail: `${bet.fixtureId} ${bet.selection} recorded at ${(bet.modelProbability * 100).toFixed(1)}% / edge ${(bet.edge * 100).toFixed(1)}%`
    });
  }
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

console.log(`Fixtures audited:      ${stats.fixtures}`);
console.log(`Totals lines checked:  ${stats.totals}`);
console.log(`Published selections:  ${stats.selected}`);
console.log(`  mean probability:    ${(average(stats.probability) * 100).toFixed(1)}%`);
console.log(`  mean price:          ${average(stats.odds).toFixed(2)}`);
console.log(`  mean edge:           ${(average(stats.edge) * 100).toFixed(1)}%`);
console.log(`  handicaps:           ${stats.handicaps}`);
console.log(`Paper ledger rows:     ${ledger.length}`);

if (verbose) {
  console.log('\nBy sport:');
  for (const [sport, bucket] of [...stats.bySport.entries()].sort((a, b) => b[1].picks - a[1].picks)) {
    console.log(
      `  ${sport.padEnd(11)} picks ${String(bucket.picks).padStart(4)} · p ${((bucket.probability / bucket.picks) * 100).toFixed(1)}% · odds ${(bucket.odds / bucket.picks).toFixed(2)} · edge ${((bucket.edge / bucket.picks) * 100).toFixed(1)}%`
    );
  }
}

if (failures.length) {
  const byGate = new Map<string, number>();
  for (const failure of failures) byGate.set(failure.gate, (byGate.get(failure.gate) ?? 0) + 1);
  console.error(`\n${failures.length} market audit failure(s):`);
  for (const [gate, count] of byGate) console.error(`  - ${gate}: ${count}`);
  for (const failure of failures.slice(0, 12)) console.error(`    · ${failure.detail}`);
  process.exit(1);
}

console.log('\nMarket audit passed.');
