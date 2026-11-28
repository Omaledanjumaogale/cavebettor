import { describe, expect, it } from 'vitest';
import { getFixtures } from '../src/lib/engine/fixtures';
import { getPrediction } from '../src/lib/engine/predictions';
import { fixtureLeague } from '../src/lib/data/registry';
import { scoringProfile } from '../src/lib/engine/scoring';

const lineOf = (label: string): number | null => {
  const m = /\b(over|under|o|u)\s+([0-9]+(?:\.[0-9]+)?)/i.exec(label);
  return m ? Number(m[2]) : null;
};

// Over / under ladders only — exact totals and score bands are not lines.
const totals = (id: string) =>
  !id.includes('exact') &&
  !id.includes('band') &&
  (id.startsWith('total') || id.startsWith('h1total') || id.startsWith('p1total') ||
    id.startsWith('f5total') || id.startsWith('games') || id.endsWith('total'));

describe('totals and handicap markets', () => {
  const fixtures = getFixtures().filter((f) => f.status !== 'finished').slice(0, 64);

  it('never quotes a total inside the coin-flip band', () => {
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      for (const market of card.markets.filter((m) => totals(m.id))) {
        for (const outcome of market.outcomes) {
          expect(outcome.modelProbability).toBeLessThanOrEqual(0.93);
          expect(outcome.modelProbability).toBeGreaterThanOrEqual(0.07);
        }
      }
    }
  });

  it('quotes half lines only', () => {
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      for (const market of card.markets.filter((m) => totals(m.id))) {
        for (const outcome of market.outcomes) {
          const line = lineOf(outcome.label);
          if (line === null) continue;
          // .5 lines mean the market can never push.
          expect(Math.abs((line % 1) - 0.5)).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('prices every total against a competition prior', () => {
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      for (const market of card.markets.filter((m) => totals(m.id))) {
        for (const outcome of market.outcomes) {
          expect(typeof outcome.prior).toBe('number');
          expect(outcome.prior!).toBeGreaterThan(0);
          expect(outcome.prior!).toBeLessThan(1);
        }
      }
    }
  });

  it('keeps projected totals inside the fixture and the competition', () => {
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      const league = fixtureLeague(fixture);
      const profile = scoringProfile(fixture.sport, fixture.leagueId, `${league.name} ${league.country}`);
      const { home, away, total } = card.expectedGoals;
      expect(total).toBeCloseTo(home + away, 2);
      expect(total).toBeGreaterThan(0);
      if (fixture.status === 'scheduled') {
        expect(total).toBeLessThan(profile.total * 1.45);
        expect(total).toBeGreaterThan(profile.total * 0.55);
      }
    }
  });

  it('orders the ladder outward from the model mean', () => {
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      const mean = card.expectedGoals.total;
      const market = card.markets.find((m) => m.id.startsWith('total'));
      if (!market) continue;
      const quoted = market.outcomes
        .map((o) => ({ line: lineOf(o.label), p: o.modelProbability, label: o.label }))
        .filter((x): x is { line: number; p: number; label: string } => x.line !== null);
      for (const quote of quoted) {
        const distance = Math.abs(quote.line - mean);
        // No quote may sit on top of the model's own expectation.
        expect(distance).toBeGreaterThan(0.2);
      }
    }
  });

  it('never recommends both sides of one total', () => {
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      const keys = new Map<string, Set<string>>();
      for (const rec of card.recommendations) {
        const line = lineOf(rec.selection);
        if (line === null) continue;
        const side = /\bover\b/i.test(rec.selection) ? 'over' : 'under';
        const key = `${rec.marketId}|${line}`;
        const set = keys.get(key) ?? new Set<string>();
        set.add(side);
        keys.set(key, set);
      }
      for (const set of keys.values()) {
        expect(set.size).toBe(1);
      }
    }
  });

  it('only recommends totals with a live edge and a fair price', () => {
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      for (const rec of card.recommendations) {
        if (lineOf(rec.selection) === null) continue;
        if (!/total/i.test(rec.market)) continue;
        expect(rec.modelProbability).toBeGreaterThanOrEqual(0.66);
        expect(rec.modelProbability).toBeLessThanOrEqual(0.93);
        expect(rec.odds).toBeGreaterThanOrEqual(1.05);
      }
    }
  });

  it('takes interval markets off the board once the clock starts', () => {
    // A first-half line after the interval whistle is a settled market with a
    // price on it. Pricing it against the minutes that remain invented a
    // 40-point edge that then appeared on the board and in the ledger.
    for (const fixture of fixtures.filter((f) => f.status !== 'scheduled')) {
      const card = getPrediction(fixture);
      expect(card.markets.filter((m) => m.group === 'period' || m.group === 'sets')).toHaveLength(0);
      for (const rec of card.recommendations) {
        expect(/^(ht|h1|p[0-9]|q[0-9]|set1)/.test(rec.marketId ?? '')).toBe(false);
      }
    }
  });

  it('prices a published pick within reach of the market', () => {
    // A price more than twelve points away from the model is a modelling
    // mismatch, not a disagreement about the match.
    for (const fixture of fixtures) {
      for (const rec of getPrediction(fixture).recommendations) {
        expect(rec.modelProbability - 1 / rec.odds).toBeLessThanOrEqual(0.12);
      }
    }
  });

  it('keeps every period prior inside the model spread', () => {
    // A period total whose consensus view is built from a different spread than
    // the model quotes produces fake edges: the first-five-innings line once
    // read 83% against a 96% prior purely because the two standard deviations
    // disagreed. The gap must stay inside the model's own uncertainty.
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      // Before kick-off the model and the consensus must agree closely; the
      // bound is what catches a prior built from a different spread. In play a
      // scoreboard can legitimately carry the model a long way from a kick-off
      // line, so the in-play bound only has to catch the gross mismatch class
      // this test was written for (gaps of 55-73 points).
      const limit = fixture.status === 'scheduled' ? 0.18 : 0.6;
      for (const market of card.markets) {
        if (market.group !== 'totals') continue;
        for (const outcome of market.outcomes) {
          if (typeof outcome.prior !== 'number') continue;
          expect(Math.abs(outcome.modelProbability - outcome.prior)).toBeLessThanOrEqual(limit);
        }
      }
    }
  });

  it('ranks every board by model probability', () => {
    for (const fixture of fixtures) {
      const card = getPrediction(fixture);
      const probabilities = card.recommendations.map((r) => r.modelProbability);
      const sorted = [...probabilities].sort((a, b) => b - a);
      expect(probabilities).toEqual(sorted);
    }
  });
});
