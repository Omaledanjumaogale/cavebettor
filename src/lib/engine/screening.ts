/**
 * Decision screening.
 *
 * Adapted from PuntersEdge's decision screener, which was the strongest idea
 * in that codebase: a selection is publishable only when three things are true
 * at once -
 *
 *   1. the model's number is high enough to be a bet, not a hunch;
 *   2. the edge is large enough to pay for the margin, but not so large that
 *      the model and the price are clearly describing different matches;
 *   3. the model and the market agree within 15 percentage points.
 *
 * The gap rule is the important one. Every 'value' product can manufacture a
 * 40% edge by pricing a line with a model that has drifted away from reality;
 * that edge is a bug report, not a bet. PuntersEdge refuses those, and so does
 * this board.
 *
 * A whole-number handicap can land exactly on the line, so its probability is
 * discounted for the push before any of the gates are applied.
 */

/** Below this strike rate a call is not a pick. */
export const MIN_STRIKE = 0.64;
/** The bookmaker's margin and jitter make anything under 1% noise. */
export const MIN_EDGE = 0.01;
/** A 25% edge is the ceiling; beyond it something is stale, not mispriced. */
export const MAX_EDGE = 0.25;
/** Model and market must be talking about the same match. */
export const MAX_GAP = 0.15;

/** Chance a whole-number handicap lands exactly on the line. */
const PUSH_CHANCE = 0.045;

export interface ScreenInput {
  marketId: string;
  selection: string;
  probability: number;
  odds: number;
}

export interface ScreenResult {
  pass: boolean;
  reason?: 'strike' | 'edge' | 'gap';
  /** Probability after the push discount. */
  probability: number;
  edge: number;
  /** Model probability minus the best price's implied probability. */
  gap: number;
  push: number;
}

/** Is this a line the result can land on exactly? */
export function pushChance(marketId: string, selection: string): number {
  if (!/^(ah|handicap|spread|puck|runline|sethcp)/.test(marketId)) return 0;
  const line = /([+\-\u2212])\s*([0-9]+(?:\.[0-9]+)?)/.exec(selection);
  if (!line) return 0;
  return Number.isInteger(Number(line[2])) ? PUSH_CHANCE : 0;
}

export interface ScreenOptions {
  minStrike?: number;
  minEdge?: number;
  maxEdge?: number;
  maxGap?: number;
}

export function screenSelection(input: ScreenInput, options: ScreenOptions = {}): ScreenResult {
  const minStrike = options.minStrike ?? MIN_STRIKE;
  const minEdge = options.minEdge ?? MIN_EDGE;
  const maxEdge = options.maxEdge ?? MAX_EDGE;
  const maxGap = options.maxGap ?? MAX_GAP;
  const push = pushChance(input.marketId, input.selection);
  const probability = input.probability * (1 - push);
  const implied = 1 / Math.max(1.01, input.odds);
  const edge = probability * input.odds - 1;
  const gap = probability - implied;
  const base = { probability, edge, gap, push };

  if (probability < minStrike) return { ...base, pass: false, reason: 'strike' };
  if (edge < minEdge || edge > maxEdge) return { ...base, pass: false, reason: 'edge' };
  // The price is already the most generous one on the market, so this gap is
  // the smallest honest version of the model-versus-market disagreement.
  if (gap > maxGap) return { ...base, pass: false, reason: 'gap' };
  return { ...base, pass: true };
}
