import { describe, expect, it } from 'vitest';
import { devig, fairOdds, fmtNgn, kellyFraction, normalCdf, poissonPmf, round } from '../src/lib/engine/core';
import { generateFixtures } from '../src/lib/engine/fixtures';
import { buildPrediction } from '../src/lib/engine/predictions';
import { BOOKMAKERS } from '../src/lib/data/catalog';

const fixtures = generateFixtures(Date.now());
const football = fixtures.find((f) => f.sport === 'football' && f.status === 'scheduled')!;

describe('core probability maths', () => {
  it('normalises a Poisson pmf', () => {
    const total = Array.from({ length: 32 }, (_, k) => poissonPmf(1.7, k)).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('de-vigs a bookmaker overround', () => {
    const probs = devig([2.1, 3.4, 3.6]);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(probs[0]).toBeGreaterThan(probs[1]);
  });

  it('converts probability to fair odds', () => {
    expect(fairOdds(0.5)).toBe(2);
    expect(fairOdds(0)).toBe(999);
  });

  it('never returns a negative Kelly fraction', () => {
    expect(kellyFraction(0.3, 2)).toBe(0);
    expect(kellyFraction(0.7, 2)).toBeGreaterThan(0);
  });

  it('computes a normal CDF symmetric about the mean', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(2) + normalCdf(-2)).toBeCloseTo(1, 6);
  });

  it('formats Naira amounts', () => {
    expect(fmtNgn(1_250_000)).toContain('1,250,000');
    expect(fmtNgn(2_500_000, { compact: true })).toBe('₦2.50m');
  });
});

describe('fixture generation', () => {
  it('produces a broad multi-sport board', () => {
    expect(fixtures.length).toBeGreaterThan(40);
    expect(new Set(fixtures.map((f) => f.sport)).size).toBe(5);
    expect(new Set(fixtures.map((f) => f.leagueId)).size).toBeGreaterThan(10);
  });

  it('assigns unique ids and valid statuses', () => {
    const ids = new Set(fixtures.map((f) => f.id));
    expect(ids.size).toBe(fixtures.length);
    for (const fixture of fixtures) {
      expect(['scheduled', 'live', 'halftime', 'finished']).toContain(fixture.status);
      expect(fixture.homeId).not.toBe(fixture.awayId);
    }
  });
});

describe('prediction engine', () => {
  const prediction = buildPrediction(football);

  it('returns probabilities that sum to one', () => {
    const sum = prediction.probabilities.home + prediction.probabilities.draw + prediction.probabilities.away;
    expect(sum).toBeCloseTo(1, 3);
  });

  it('builds a normalised score grid', () => {
    const sum = prediction.scoreGrid.reduce((a, c) => a + c.probability, 0);
    expect(sum).toBeCloseTo(1, 3);
    expect(prediction.scoreGrid.length).toBeGreaterThan(20);
  });

  it('ranks scorelines by probability', () => {
    for (let i = 1; i < prediction.topScorelines.length; i++) {
      expect(prediction.topScorelines[i - 1].probability).toBeGreaterThanOrEqual(prediction.topScorelines[i].probability);
    }
  });

  it('prices every outcome consistently', () => {
    for (const market of prediction.markets) {
      expect(market.outcomes.length).toBeGreaterThanOrEqual(2);
      for (const outcome of market.outcomes) {
        expect(outcome.modelProbability).toBeGreaterThan(0);
        expect(outcome.bookOdds).toBeGreaterThan(1);
        expect(outcome.fairOdds).toBeCloseTo(1 / outcome.modelProbability, 0);
        // Displayed edge is clamped at +35%: anything above that is a state
        // mismatch rather than a market mistake.
        expect(outcome.edge).toBeCloseTo(
          Math.min(0.35, outcome.modelProbability * outcome.bookOdds - 1),
          2
        );
        expect(outcome.kelly).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('leads with the headline call, then ranks the rest by strike rate', () => {
    const board = prediction.recommendations;
    expect(board.length).toBeGreaterThan(0);
    // The headline is chosen for the best blend of strike rate and price, so
    // it can sit a fraction below the highest-probability supporting leg.
    // Everything after it is strictly probability-ranked.
    for (let i = 2; i < board.length; i++) {
      expect(board[i - 1].modelProbability).toBeGreaterThanOrEqual(board[i].modelProbability);
    }
    // Nothing on the board is a lottery ticket or a sub-1.05 stake.
    for (const rec of board) {
      expect(rec.odds).toBeGreaterThanOrEqual(1.05);
      expect(rec.odds).toBeLessThanOrEqual(9.5);
    }
  });

  it('never offers contradictory totals on the same board', () => {
    const totals = prediction.recommendations
      .map((rec) => /\b(over|under)\s+([0-9]+(?:\.[0-9]+)?)/i.exec(rec.selection))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => ({ direction: m[1].toLowerCase(), line: Number(m[2]) }));
    const over = totals.filter((t) => t.direction === 'over').sort((a, b) => a.line - b.line)[0];
    const under = totals.filter((t) => t.direction === 'under').sort((a, b) => b.line - a.line)[0];
    if (over && under) expect(under.line).toBeGreaterThan(over.line);
  });

  it('keeps one line per totals direction per scope', () => {
    const keys = new Set<string>();
    for (const rec of prediction.recommendations) {
      const match = /^(.*?)\b(over|under)\s+[0-9]/i.exec(rec.selection);
      if (!match) continue;
      const key = `${match[1].trim().toLowerCase()}|${match[2].toLowerCase()}`;
      expect(keys.has(key)).toBe(false);
      keys.add(key);
    }
  });

  it('keeps the value table consistent with the ranked board', () => {
    for (const bet of prediction.valueBets) {
      expect(bet.odds).toBeGreaterThanOrEqual(1.05);
      expect(bet.modelProbability).toBeGreaterThanOrEqual(0.3);
      expect(prediction.recommendations.some((rec) => rec.selection === bet.selection)).toBe(true);
    }
  });

  it('produces football-specific markets', () => {
    const ids = prediction.markets.map((m) => m.id);
    expect(ids).toContain('1x2');
    expect(ids).toContain('btts');
    expect(ids.some((id) => id.startsWith('total'))).toBe(true);
    expect(ids).toContain('cs');
  });

  it('weights model components to one', () => {
    const total = prediction.components.reduce((a, c) => a + c.weight, 0);
    expect(total).toBeCloseTo(1, 2);
  });

  it('uses all configured bookmakers', () => {
    expect(prediction.markets[0].bookmakerCount).toBe(BOOKMAKERS.length);
  });

  it('respects the confidence bounds', () => {
    expect(prediction.confidence).toBeGreaterThanOrEqual(45);
    expect(prediction.confidence).toBeLessThanOrEqual(96);
  });
});
