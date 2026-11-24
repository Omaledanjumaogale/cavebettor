/**
 * League scoring profiles.
 *
 * A basketball total is not a universal number: an NBA game runs near 229
 * points, a EuroLeague game near 159, NCAA men near 143 and a women's
 * continental league near 128. Football behaves the same way — the Bundesliga
 * and Eredivisie score, Serie A, La Liga and the Argentine league do not.
 *
 * Every expectation in the engine is built from the profile below, so a
 * National League fixture can never be priced like an NBA game and a Serie A
 * fixture can never be priced like an Eredivisie one.
 */
import type { SportId } from '#lib/types';

export interface CalibrationBucket {
  from: number;
  to: number;
  n: number;
  predicted: number;
  observed: number;
  /** observed / predicted, clamped so one hot streak cannot dominate. */
  factor: number;
}

/**
 * Calibration table produced by the learning loop (`server/learning.ts`).
 * It lives here, in the pure maths module, so the engine can consult it
 * without importing server code.
 */
let learned: CalibrationBucket[] | null = null;

export function setLearnedCalibration(buckets: CalibrationBucket[] | null): void {
  learned = buckets && buckets.length ? buckets : null;
}

/** Correction for a raw probability, based on settled results. */
export function learnedFactor(probability: number): number {
  if (!learned) return 1;
  const bucket = learned.find((entry) => probability >= entry.from && probability < entry.to);
  // Small samples are not evidence: weight the correction by how much data
  // actually stands behind the bucket.
  if (!bucket || bucket.n < 10) return 1;
  const weight = Math.min(1, bucket.n / 60);
  return 1 + (bucket.factor - 1) * weight;
}

export interface ScoringProfile {
  /** Stable key used for caching and display. */
  key: string;
  /** Human label, e.g. "NBA" or "NCAA Division I". */
  label: string;
  sport: SportId;
  /** Expected goals/points/runs for an average team in this competition. */
  perTeam: number;
  /** Expected match total for two average teams. */
  total: number;
  /** Standard deviation of the match total. */
  sdTotal: number;
  /** Standard deviation of the winning margin. */
  sdMargin: number;
  gender: 'men' | 'women';
  tier: string;
}

type Entry = {
  key: string;
  label: string;
  total: number;
  sdTotal: number;
  sdMargin?: number;
  gender?: 'men' | 'women';
  tier?: string;
  match: RegExp;
};

function build(sport: SportId, entries: Entry[], fallback: Entry): (id: string, name?: string) => ScoringProfile {
  const all = [...entries, fallback];
  return (id: string, name?: string) => {
    const haystack = `${id} ${name ?? ''}`.toLowerCase().replace(/[_/]+/g, '-');
    const hit = all.find((entry) => entry.match.test(haystack)) ?? fallback;
    return {
      key: hit.key,
      label: hit.label,
      sport,
      perTeam: Number((hit.total / 2).toFixed(2)),
      total: hit.total,
      sdTotal: hit.sdTotal,
      sdMargin: hit.sdMargin ?? Number((hit.sdTotal * 0.62).toFixed(2)),
      gender: hit.gender ?? (/(women|wnba|femenina|femminile|damen|ladies)/.test(haystack) ? 'women' : 'men'),
      tier: hit.tier ?? 'standard'
    };
  };
}

const basketball = build(
  'basketball',
  [
    { key: 'nba', label: 'NBA', total: 229, sdTotal: 19.6, sdMargin: 12.6, tier: 'nba', match: /\bnba\b(?!-?g-?league)/ },
    { key: 'gleague', label: 'NBA G League', total: 219, sdTotal: 20.5, sdMargin: 12.9, tier: 'nba', match: /g-?league/ },
    { key: 'wnba', label: 'WNBA', total: 161, sdTotal: 15.4, sdMargin: 9.9, gender: 'women', tier: 'wnba', match: /wnba/ },
    { key: 'euroleague', label: 'EuroLeague', total: 159, sdTotal: 15.1, sdMargin: 9.7, tier: 'euro', match: /euroleague|euro-league/ },
    { key: 'eurocup', label: 'EuroCup', total: 160, sdTotal: 15.3, sdMargin: 9.8, tier: 'euro', match: /euro-?cup/ },
    { key: 'acb', label: 'Liga ACB', total: 163, sdTotal: 15.2, sdMargin: 9.8, tier: 'euro', match: /\bacb\b|liga-acb/ },
    { key: 'ncaa', label: 'NCAA Division I', total: 143, sdTotal: 14.4, sdMargin: 9.3, tier: 'ncaa', match: /ncaa(?!.*women)/ },
    { key: 'ncaa-w', label: 'NCAA Women', total: 133, sdTotal: 13.6, sdMargin: 8.8, gender: 'women', tier: 'ncaa', match: /ncaa.*women|women.*ncaa/ },
    { key: 'nbl', label: 'NBL', total: 176, sdTotal: 16.2, sdMargin: 10.2, tier: 'standard', match: /\bnbl\b/ },
    { key: 'cba', label: 'CBA', total: 201, sdTotal: 17.8, sdMargin: 11.2, tier: 'standard', match: /\bcba\b/ },
    { key: 'bsl', label: 'Basketball Super League', total: 160, sdTotal: 15.1, sdMargin: 9.7, tier: 'euro', match: /\bbsl\b/ },
    { key: 'kbl', label: 'KBL', total: 156, sdTotal: 14.6, sdMargin: 9.4, tier: 'standard', match: /\bkbl\b/ },
    { key: 'liga-femenina', label: 'Liga Femenina', total: 127, sdTotal: 12.8, sdMargin: 8.2, gender: 'women', tier: 'euro', match: /femenina|femminile|damen|women/ }
  ],
  { key: 'basketball-default', label: 'Basketball', total: 148, sdTotal: 14.6, sdMargin: 9.3, tier: 'standard', match: /.*/ }
);

const football = build(
  'football',
  [
    { key: 'bundesliga', label: 'Bundesliga', total: 3.18, sdTotal: 1.62, match: /bundesliga(?!.*2)/ },
    { key: 'bundesliga2', label: '2. Bundesliga', total: 3.05, sdTotal: 1.58, match: /bundesliga.*2|2.*bundesliga/ },
    { key: 'eredivisie', label: 'Eredivisie', total: 3.24, sdTotal: 1.64, match: /eredivisie/ },
    { key: 'premier-league', label: 'Premier League', total: 2.86, sdTotal: 1.56, match: /premier-league|epl\b/ },
    { key: 'championship', label: 'EFL Championship', total: 2.62, sdTotal: 1.48, match: /championship/ },
    { key: 'league-one', label: 'EFL League One', total: 2.72, sdTotal: 1.5, match: /league-one/ },
    { key: 'league-two', label: 'EFL League Two', total: 2.6, sdTotal: 1.46, match: /league-two/ },
    { key: 'scottish', label: 'Scottish Premiership', total: 2.95, sdTotal: 1.58, match: /scottish|spfl/ },
    { key: 'laliga', label: 'La Liga', total: 2.5, sdTotal: 1.44, match: /la-liga|laliga|la liga|primera-division/ },
    { key: 'laliga2', label: 'La Liga 2', total: 2.28, sdTotal: 1.38, match: /laliga2|segunda-division|primera-nacional/ },
    { key: 'serie-a', label: 'Serie A', total: 2.68, sdTotal: 1.48, match: /serie-a|seriea|serie a(?!.*basket)/ },
    { key: 'serie-b', label: 'Serie B', total: 2.5, sdTotal: 1.42, match: /serie-b/ },
    { key: 'ligue-1', label: 'Ligue 1', total: 2.78, sdTotal: 1.5, match: /ligue-1|ligue1|ligue 1/ },
    { key: 'ligue-2', label: 'Ligue 2', total: 2.42, sdTotal: 1.4, match: /ligue-2/ },
    { key: 'primeira-liga', label: 'Primeira Liga', total: 2.6, sdTotal: 1.46, match: /primeira-liga/ },
    { key: 'belgian', label: 'Belgian Pro League', total: 3.0, sdTotal: 1.56, match: /belgian|jupiler/ },
    { key: 'super-lig', label: 'Süper Lig', total: 2.95, sdTotal: 1.54, match: /super-lig|süper/ },
    { key: 'saudi', label: 'Saudi Pro League', total: 2.85, sdTotal: 1.52, match: /saudi/ },
    { key: 'mls', label: 'MLS', total: 3.05, sdTotal: 1.6, match: /\bmls\b/ },
    { key: 'liga-mx', label: 'Liga MX', total: 2.95, sdTotal: 1.56, match: /liga-mx/ },
    { key: 'brasileirao', label: 'Brasileirão Série A', total: 2.4, sdTotal: 1.4, match: /brasileir|brazil/ },
    { key: 'argentina', label: 'Liga Profesional Argentina', total: 2.15, sdTotal: 1.34, match: /argentina|lpf\b/ },
    { key: 'libertadores', label: 'Copa Libertadores', total: 2.45, sdTotal: 1.4, match: /libertadores/ },
    { key: 'champions-league', label: 'UEFA Champions League', total: 3.0, sdTotal: 1.6, match: /champions-league|\bucl\b/ },
    { key: 'europa-league', label: 'UEFA Europa League', total: 2.85, sdTotal: 1.55, match: /europa-league/ },
    { key: 'conference', label: 'UEFA Conference League', total: 2.9, sdTotal: 1.56, match: /conference-league/ },
    { key: 'npfl', label: 'Nigeria Premier Football League', total: 2.35, sdTotal: 1.38, match: /nigeria-premier|\bnpfl\b/ },
    { key: 'afcon', label: 'Africa Cup of Nations', total: 2.3, sdTotal: 1.36, match: /africa-cup|afcon/ },
    { key: 'womens', label: "Women's football", total: 3.1, sdTotal: 1.62, gender: 'women', match: /women|femenina|femminile|damen|ladies/ }
  ],
  { key: 'football-default', label: 'Football', total: 2.65, sdTotal: 1.48, match: /.*/ }
);

const icehockey = build(
  'icehockey',
  [
    { key: 'nhl', label: 'NHL', total: 6.2, sdTotal: 2.15, sdMargin: 2.3, match: /\bnhl\b/ },
    { key: 'khl', label: 'KHL', total: 5.2, sdTotal: 2.0, match: /\bkhl\b/ },
    { key: 'shl', label: 'SHL', total: 5.4, sdTotal: 2.05, match: /\bshl\b/ },
    { key: 'liiga', label: 'Liiga', total: 5.2, sdTotal: 2.0, match: /liiga/ },
    { key: 'del', label: 'DEL', total: 5.6, sdTotal: 2.1, match: /\bdel\b/ },
    { key: 'ahl', label: 'AHL', total: 5.9, sdTotal: 2.1, match: /\bahl\b/ },
    { key: 'womens-hockey', label: "Women's ice hockey", total: 4.4, sdTotal: 1.9, gender: 'women', match: /women|femenina/ }
  ],
  { key: 'hockey-default', label: 'Ice hockey', total: 5.5, sdTotal: 2.05, match: /.*/ }
);

const baseball = build(
  'baseball',
  [
    { key: 'mlb', label: 'MLB', total: 8.9, sdTotal: 4.5, match: /\bmlb\b/ },
    { key: 'npb', label: 'NPB', total: 8.0, sdTotal: 4.2, match: /\bnpb\b/ },
    { key: 'kbo', label: 'KBO', total: 9.5, sdTotal: 4.8, match: /\bkbo\b/ },
    { key: 'ncaa-baseball', label: 'NCAA Baseball', total: 11.2, sdTotal: 5.4, match: /ncaa/ }
  ],
  { key: 'baseball-default', label: 'Baseball', total: 9.0, sdTotal: 4.6, match: /.*/ }
);

const tennis = build(
  'tennis',
  [
    // Best-of-five majors run far longer than a best-of-three tour match.
    { key: 'slam', label: 'Grand Slam (best of five)', total: 34.5, sdTotal: 7.4, sdMargin: 4.6, match: /grand\s*slam|wimbledon|roland|us open|australian open|major/i },
    { key: 'tennis', label: 'Tennis', total: 23.5, sdTotal: 4.6, sdMargin: 3.4, match: /.*/ }
  ],
  { key: 'tennis', label: 'Tennis', total: 23.5, sdTotal: 4.6, match: /.*/ }
);

const LOOKUP: Record<SportId, (id: string, name?: string) => ScoringProfile> = {
  football,
  basketball,
  icehockey,
  baseball,
  tennis
};

/** Profile for a competition, falling back to the sport default. */
export function scoringProfile(sport: SportId, leagueId: string, leagueName?: string): ScoringProfile {
  const fn = LOOKUP[sport] ?? football;
  return fn(leagueId ?? '', leagueName);
}

/**
 * Prize-money style calibration of a three-way market.
 *
 * Raw Poisson/Elo output is over-confident: it happily gives a 72% win
 * probability to a side that the market prices at 48%. Blending towards the
 * competition's own base rates, lifting the draw floor and capping the
 * favourite keeps the board honest.
 */
export function calibrateThreeWay(
  raw: { home: number; draw: number; away: number },
  profile: ScoringProfile,
  strength = 0.5
): { home: number; draw: number; away: number } {
  // Base rates: home advantage is smaller in neutral-total sports than in
  // football, where the draw is a real outcome.
  const drawBase = profile.sport === 'football' ? 0.26 : profile.sport === 'icehockey' ? 0.08 : 0;
  const homeBase = profile.sport === 'football' ? 0.44 : 0.53;
  const awayBase = 1 - homeBase - drawBase;

  // `strength` 0 keeps the base rates, 1 keeps the model. Even at full weight
  // we hold back a fifth of the model's confidence.
  const w = Math.min(0.82, 0.5 + strength * 0.32);

  // Correct the model leg with what settled results say about this probability
  // band, then blend towards the competition's base rates.
  const corrected = {
    home: raw.home * learnedFactor(raw.home),
    draw: raw.draw * learnedFactor(raw.draw),
    away: raw.away * learnedFactor(raw.away)
  };
  const correctedSum = corrected.home + corrected.draw + corrected.away || 1;
  const model = {
    home: corrected.home / correctedSum,
    draw: corrected.draw / correctedSum,
    away: corrected.away / correctedSum
  };

  let home = w * model.home + (1 - w) * homeBase;
  let draw = w * model.draw + (1 - w) * drawBase;
  let away = w * model.away + (1 - w) * awayBase;

  if (profile.sport === 'football') draw = Math.max(draw, 0.19);

  const sum = home + draw + away;
  home /= sum;
  draw /= sum;
  away /= sum;

  // A single side should never be presented as a near-certainty.
  const cap = profile.sport === 'football' ? 0.78 : 0.9;
  const top = Math.max(home, draw, away);
  if (top > cap) {
    const scale = cap / top;
    if (home === top) {
      const rest = home - cap;
      home = cap;
      draw += rest * 0.55;
      away += rest * 0.45;
    } else if (away === top) {
      const rest = away - cap;
      away = cap;
      draw += rest * 0.5;
      home += rest * 0.5;
    } else {
      draw = cap;
    }
  }

  const floor = 0.04;
  home = Math.max(floor, home);
  draw = Math.max(profile.sport === 'football' ? 0.12 : 0.01, draw);
  away = Math.max(floor, away);
  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}

/** Sanity band for a quoted total: lines outside it are not this league's game. */
export function totalBand(profile: ScoringProfile): { min: number; max: number } {
  const spread = profile.sdTotal * 2.6;
  return {
    min: Math.max(0.5, Number((profile.total - spread).toFixed(1))),
    max: Number((profile.total + spread).toFixed(1))
  };
}
