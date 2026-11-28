/** Deterministic maths used by the CaveBettor intelligence engine. */

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable pseudo-random number in [0,1) for an arbitrary key. */
export function seeded(key: string): number {
  return mulberry32(hashString(key))();
}

export function jitter(key: string, spread: number): number {
  return (seeded(key) - 0.5) * 2 * spread;
}

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const round = (v: number, dp = 2) => Number(v.toFixed(dp));

export function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function poissonPmf(lambda: number, k: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/** Normal CDF via Abramowitz & Stegun 7.1.26 (max error ~1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? p : 1 - p;
}

/** Inverse normal CDF (Acklam's approximation, |error| < 1.15e-9). */
export function normalQuantile(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  const clampP = Math.min(1 - 1e-12, Math.max(1e-12, p));

  if (clampP < plow) {
    const q = Math.sqrt(-2 * Math.log(clampP));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (clampP > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - clampP));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = clampP - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function normalPdf(x: number, mean: number, sd: number): number {
  const z = (x - mean) / sd;
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

export function impliedProbability(decimalOdds: number): number {
  return decimalOdds > 1 ? 1 / decimalOdds : 0;
}

/** Remove the bookmaker margin (proportional method). */
export function devig(odds: number[]): number[] {
  const raw = odds.map((o) => 1 / o);
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((p) => p / total);
}

export function fairOdds(probability: number): number {
  return probability > 0.0001 ? round(1 / probability, 2) : 999;
}

/**
 * How much to trust a single selection, on a 45–95 scale.
 *
 * Confidence tracks the selection's own win probability rather than the
 * match's entropy, so an 88% over 1.5 reads ~86 and a 66% handicap reads
 * ~63. Three adjustments keep it honest:
 *   - weak data quality lowers it;
 *   - a wide model-versus-price disagreement lowers it (the market is a
 *     second opinion, not an obstacle);
 *   - a genuine edge raises it slightly, while a sub-1.20 price is docked
 *     because the payout cannot justify the risk.
 */
export function confidenceFor(probability: number, odds: number, dataQuality = 0.9): number {
  const p = clamp(probability, 0.01, 0.99);
  const implied = 1 / Math.max(1.01, odds);
  const gap = Math.abs(p - implied);
  const edge = clamp(p * odds - 1, -1, 0.3);
  const qualityPenalty = (1 - clamp(dataQuality, 0.5, 1)) * 22;
  const disagreementPenalty = gap * 26;
  const edgeBonus = clamp(edge, 0, 0.25) * 12;
  const shortPricePenalty = odds < 1.2 ? (1.2 - odds) * 18 : 0;
  return Math.round(clamp(p * 100 - qualityPenalty - disagreementPenalty + edgeBonus - shortPricePenalty, 45, 95));
}

export function kellyFraction(probability: number, odds: number, fraction = 0.25): number {
  const b = odds - 1;
  if (b <= 0) return 0;
  const f = (probability * b - (1 - probability)) / b;
  return clamp(f * fraction, 0, 1);
}

export function americanToDecimal(american: number): number {
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

export function decimalToAmerican(decimal: number): number {
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

export function fmtNgn(value: number, opts: { compact?: boolean; decimals?: number } = {}): string {
  if (opts.compact && Math.abs(value) >= 1_000_000) {
    return `₦${(value / 1_000_000).toFixed(2)}m`;
  }
  if (opts.compact && Math.abs(value) >= 10_000) {
    return `₦${Math.round(value / 1000)}k`;
  }
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: opts.decimals ?? 0
  }).format(value);
}

export function pct(value: number, dp = 1): string {
  return `${(value * 100).toFixed(dp)}%`;
}

export function signed(value: number, dp = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(dp)}`;
}
