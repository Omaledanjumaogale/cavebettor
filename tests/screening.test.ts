import { describe, expect, it } from 'vitest';
import { MAX_GAP, pushChance, screenSelection } from '../src/lib/engine/screening';

describe('decision screening', () => {
  it('publishes a high-strike call the market agrees with', () => {
    const screen = screenSelection({ marketId: 'ou2.5', selection: 'match over 1.5', probability: 0.78, odds: 1.3 });
    expect(screen.pass).toBe(true);
    expect(screen.gap).toBeLessThan(0.05);
  });

  it('refuses a call the model and market disagree about by more than 15 points', () => {
    const screen = screenSelection({ marketId: '1x2', selection: 'Home win', probability: 0.99, odds: 1.2 });
    expect(screen.pass).toBe(false);
    expect(screen.reason).toBe('gap');
    expect(screen.gap).toBeGreaterThan(MAX_GAP);
  });

  it('refuses an edge so large it can only be a stale price', () => {
    const screen = screenSelection({ marketId: '1x2', selection: 'Home win', probability: 0.9, odds: 1.5 });
    expect(screen.pass).toBe(false);
    expect(screen.reason).toBe('edge');
  });

  it('refuses a call below the 64% strike floor', () => {
    const screen = screenSelection({ marketId: 'btts', selection: 'Yes', probability: 0.58, odds: 2.1 });
    expect(screen.pass).toBe(false);
    expect(screen.reason).toBe('strike');
  });

  it('discounts a whole-number handicap for the push but not a half line', () => {
    expect(pushChance('ah', 'Home -1')).toBeGreaterThan(0);
    expect(pushChance('ah', 'Home -1.5')).toBe(0);
    expect(pushChance('ou2.5', 'match over 1.5')).toBe(0);
    const push = screenSelection({ marketId: 'ah', selection: 'Home -1', probability: 0.66, odds: 1.7 });
    const clean = screenSelection({ marketId: 'ah', selection: 'Home -1.5', probability: 0.66, odds: 1.7 });
    expect(push.probability).toBeLessThan(clean.probability);
  });
});