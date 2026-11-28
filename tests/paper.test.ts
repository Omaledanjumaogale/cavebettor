import { describe, expect, it } from 'vitest';
import { getBankroll, getMetrics, getPaperBets } from '../src/lib/engine/analytics';

const bets = getPaperBets();

describe('paper ledger', () => {
  it('records only calls the board would publish', () => {
    expect(bets.length).toBeGreaterThan(0);
    for (const bet of bets) {
      expect(bet.modelProbability).toBeGreaterThanOrEqual(0.64);
      expect(bet.edge).toBeGreaterThanOrEqual(0.01);
      expect(bet.odds).toBeGreaterThan(1);
      expect(bet.stakeNgn).toBeGreaterThanOrEqual(1000);
      expect(bet.stakeNgn).toBeLessThanOrEqual(50_000);
    }
  });

  it('settles every closed bet against its own price', () => {
    const closed = bets.filter((bet) => bet.status !== 'open');
    expect(closed.length).toBeGreaterThan(0);
    for (const bet of closed) {
      expect(bet.settledAt).toBeTruthy();
      expect(bet.pnlNgn).toBe(
        bet.status === 'won' ? Math.round(bet.stakeNgn * (bet.odds - 1)) : -bet.stakeNgn
      );
    }
  });

  it('lists each call once and caps open exposure', () => {
    expect(new Set(bets.map((bet) => bet.id)).size).toBe(bets.length);
    expect(bets.filter((bet) => bet.status === 'open').length).toBeLessThanOrEqual(9);
  });

  it('keeps the paper bankroll solvent', () => {
    const curve = getBankroll();
    expect(curve).toHaveLength(91);
    expect(Math.min(...curve.map((point) => point.bankrollNgn))).toBeGreaterThan(0);
    expect(getMetrics().settledBets).toBe(bets.filter((bet) => bet.status !== 'open').length);
  });
});