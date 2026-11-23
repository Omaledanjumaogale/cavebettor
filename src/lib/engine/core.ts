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
