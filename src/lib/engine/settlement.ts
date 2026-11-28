/**
 * Market settlement.
 *
 * Pure functions that answer one question: did this selection win? They are
 * shared by the learning loop and by the settlement archive, so a pick graded
 * at full time is graded by exactly the same rules that train the models
 * weeks later. Nothing here touches the network, the cache or the clock.
 */
import { resolveTeam } from '#lib/data/registry';
import type { Fixture } from '#lib/types';

export type Settlement = true | false | null;

/** Did this market outcome settle? Only markets whose result is unambiguous. */
export function settleSelection(fixture: Fixture, marketId: string, selection: string): Settlement {
  const home = fixture.score.home;
  const away = fixture.score.away;
  const total = home + away;
  const margin = home - away;
  const label = selection.toLowerCase().trim();
  // Engine fixtures carry ids, not embedded team objects; resolve the names so
  // a moneyline is graded instead of silently returning null (a null used to
  // count as a loss and made every 1X2/DC/ML pick look like a loser).
  const homeName = (fixture.homeTeam?.name ?? resolveTeam(fixture.homeId, fixture.leagueId).name).toLowerCase();
  const awayName = (fixture.awayTeam?.name ?? resolveTeam(fixture.awayId, fixture.leagueId).name).toLowerCase();

  if (marketId === '1x2' || marketId === 'ml') {
    if (label === 'draw') return margin === 0;
    if (homeName && label.includes(homeName)) return margin > 0;
    if (awayName && label.includes(awayName)) return margin < 0;
    return null;
  }

  if (marketId === 'btts') return label.startsWith('yes') ? home > 0 && away > 0 : !(home > 0 && away > 0);

  if (marketId === 'dc') {
    if (label.includes(' or draw') && label.includes('/')) return null;
    if (label.includes(' or ')) {
      if (label.startsWith('draw')) return margin <= 0;
      if (homeName && label.startsWith(homeName)) return margin >= 0;
      return margin <= 0;
    }
    return null;
  }

  // Double chance written as "Home or Draw".
  if (marketId === 'dnb') {
    if (margin === 0) return null;
    if (homeName && label.includes(homeName)) return margin > 0;
    if (awayName && label.includes(awayName)) return margin < 0;
    return null;
  }

  // Asian handicap: a whole line can push.
  if (/^(ah|handicap|spread|puck|runline|sethcp)/.test(marketId)) {
    // Labels use both ASCII and typographic minus signs.
    const line = /([+\-−–])\s*([0-9]+(?:\.[0-9]+)?)/.exec(selection);
    if (!line) return null;
    const value = Number(line[2]) * (line[1] === '+' ? 1 : -1);
    const side = homeName && label.includes(homeName) ? margin : awayName && label.includes(awayName) ? -margin : null;
    if (side === null) return null;
    const adjusted = side + value;
    if (adjusted === 0) return null;
    return adjusted > 0;
  }

  // Totals: "match over 2.5", "1st half under 1.5", "quarter 2 over 58.5".
  const totals = /(?:over|under)\s+([0-9]+(?:\.[0-9]+)?)/i.exec(selection);
  if (totals && /(ou|total|games)/.test(marketId)) {
    const line = Number(totals[1]);
    const isOver = /\bover\b/i.test(selection);
    // Period totals only settle against the period, which the archive keeps.
    const periodLabel = /^(first half|1st half|second half|2nd half|period \d|quarter \d|set \d|1st period|\d+th inning)/i.exec(label);
    if (periodLabel) {
      const wanted = periodLabel[0].toLowerCase();
      const period = fixture.periods?.find((p) => p.label.toLowerCase().startsWith(wanted.slice(0, 6)) || p.label.toLowerCase() === wanted);
      if (!period) return null;
      const periodTotal = period.home + period.away;
      if (periodTotal === line) return null;
      return isOver ? periodTotal > line : periodTotal < line;
    }
    // Tennis scores are sets won, not games. The games line only makes sense
    // against the sum of the set scores kept in periods.
    const tennisGames = fixture.sport === 'tennis' || marketId.startsWith('games');
    const games = tennisGames ? (fixture.periods ?? []).reduce((sum, p) => sum + p.home + p.away, 0) : total;
    if (tennisGames && games === 0) return null;
    if (games === line) return null;
    return isOver ? games > line : games < line;
  }

  return null;
}

/** A single graded pick, small enough to keep in the archive for months. */
export interface GradedPick {
  marketId: string;
  market: string;
  selection: string;
  probability: number;
  odds: number;
  won: boolean;
}
