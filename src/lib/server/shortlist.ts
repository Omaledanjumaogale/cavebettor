/**
 * The shortlist board.
 *
 * A deliberately small, auto-generated set of selections the model is willing
 * to stand behind. It is built from the whole day's fixture universe, then cut
 * down to calls that clear every gate at once:
 *
 *   - the model probability is high enough to be a bet, not a hunch;
 *   - the price is still playable (a 1.03 "certainty" pays nothing);
 *   - the market family has a result that cannot be argued with;
 *   - the competition has not been misread by the model (learning table);
 *   - one selection per fixture, so the board is not five views of one game.
 *
 * Anything that does not clear every gate is simply not published. The board is
 * cached per day, so each day's shortlist accumulates in R2 as an archive.
 */
import type { Fixture, Prediction, Recommendation } from '#lib/types';
import { fixtureLeague, homeTeam, awayTeam } from '#lib/data/registry';
import { getPrediction } from '#lib/engine/predictions';
import { readCache, writeCache } from '#lib/server/cache';
import { pageFixtureUniverse } from './feed';
import { leagueAccuracy, readLearning } from './learning';

const MEMO_MS = 20 * 60_000;
const ARCHIVE_DAYS = 21;

export interface ShortlistPick {
  fixtureId: string;
  sport: string;
  leagueId: string;
  league: string;
  country: string;
  home: string;
  away: string;
  kickoff: string;
  status: string;
  score?: { home: number; away: number };
  periods?: { label: string; home: number; away: number }[];
  marketId: string;
  market: string;
  marketGroup: string;
  selection: string;
  modelProbability: number;
  odds: number;
  edge: number;
  confidence: number;
  stakeNgn: number;
  /** Why this survived: the gate it cleared. */
  reason: string;
  tier: 'banker' | 'strong' | 'steady';
}

export interface ShortlistBoard {
  date: string;
  generatedAt: string;
  picks: ShortlistPick[];
  scanned: number;
  considered: number;
  rejected: { reason: string; count: number }[];
  learning: { settled: number; accuracy: number } | null;
}

const SAFE_FAMILIES = /^(dc|dnb|ah|spread|puck|runline|ou|htou|p1ou|p2ou|p3ou|q1total|q2total|q3total|q4total|h1total|total|btts|tt|teamtotal)/;

const MARKET_GATE: Record<string, { min: number; label: string }> = {
  dc: { min: 0.7, label: 'double chance' },
  dnb: { min: 0.7, label: 'draw no bet' },
  btts: { min: 0.72, label: 'both teams to score' },
  ml: { min: 0.74, label: 'moneyline' },
  '1x2': { min: 0.74, label: 'match result' }
};

function familyOf(marketId: string): string {
  if (/^(dc)$/.test(marketId)) return 'dc';
  if (/^(dnb)$/.test(marketId)) return 'dnb';
  if (/^(btts)$/.test(marketId)) return 'btts';
  if (/^(ml|1x2)$/.test(marketId)) return 'match';
  if (/^(ah|spread|puck|runline|sethcp)/.test(marketId)) return 'handicap';
  if (/^(ou|total|h1total|q\d|p\d)/.test(marketId)) return 'totals';
  if (/^tt|teamtotal/.test(marketId)) return 'team-total';
  return 'other';
}

/** How much of a cushion a handicap gives, in the sport's own scoring unit. */
function handicapCushion(selection: string): number {
  const match = /([+-])\s*([0-9]+(?:\.[0-9]+)?)/.exec(selection);
  if (!match) return 0;
  const value = Number(match[2]);
  return match[1] === '+' ? value : -value;
}

function qualifies(pick: Recommendation, fixture: Fixture): { ok: boolean; reason: string; tier: ShortlistPick['tier'] } {
  const family = familyOf(pick.marketId ?? '');
  if (!SAFE_FAMILIES.test(pick.marketId ?? '')) return { ok: false, reason: 'market family not publishable', tier: 'steady' };

  const gate = MARKET_GATE[pick.marketId ?? ''];
  const floor = gate?.min ?? 0.68;
  if (pick.modelProbability < floor) return { ok: false, reason: `probability below the ${Math.round(floor * 100)}% floor`, tier: 'steady' };
  if (pick.odds < 1.12) return { ok: false, reason: 'price too short to be worth a stake', tier: 'steady' };
  if (pick.odds > 2.7) return { ok: false, reason: 'price too long for a banker board', tier: 'steady' };

  if (family === 'handicap') {
    const cushion = handicapCushion(pick.selection);
    const unit = fixture.sport === 'football' ? 1 : fixture.sport === 'basketball' ? 4 : 1;
    if (cushion < unit * 0.9 && pick.modelProbability < 0.78) {
      return { ok: false, reason: 'handicap cushion too thin', tier: 'steady' };
    }
  }

  const tier: ShortlistPick['tier'] = pick.modelProbability >= 0.8 ? 'banker' : pick.modelProbability >= 0.72 ? 'strong' : 'steady';
  const reason =
    family === 'totals'
      ? 'line sits clear of the model total'
      : family === 'handicap'
        ? 'cushion covers the projected margin'
        : family === 'dc' || family === 'dnb'
          ? 'two-way cover instead of a straight win'
          : gate
            ? gate.label
            : 'clears every gate';

  return { ok: true, reason, tier };
}

async function build(date: string, force = false): Promise<ShortlistBoard> {
  const key = `shortlist/${date}`;
  const memoKey = `shortlist-memo:${date}`;
  const memo = memos.get(memoKey);
  if (!force && memo && Date.now() - memo.at < MEMO_MS) return memo.board;

  const cached = force ? null : (await readCache<ShortlistBoard>(key))?.value;
  if (cached && Date.now() - new Date(cached.generatedAt).getTime() < MEMO_MS) {
    memos.set(memoKey, { at: Date.now(), board: cached });
    return cached;
  }

  const [universe, learning] = await Promise.all([pageFixtureUniverse(), readLearning()]);
  const onDay = universe.fixtures.filter((fixture) => fixture.kickoff.slice(0, 10) === date);
  const rejected = new Map<string, number>();
  const picks: ShortlistPick[] = [];
  let considered = 0;

  for (const fixture of onDay) {
    if (fixture.status === 'finished') continue;
    considered += 1;
    let card: Prediction;
    try {
      card = getPrediction(fixture);
    } catch {
      continue;
    }

    const accuracy = leagueAccuracy(learning, fixture.leagueId);
    if (accuracy !== null && accuracy < 0.48) {
      rejected.set('competition the model has misread', (rejected.get('competition the model has misread') ?? 0) + 1);
      continue;
    }

    // Best single call per fixture, judged on probability first.
    const ranked = [...card.recommendations].sort((a, b) => b.modelProbability - a.modelProbability);
    let chosen: ShortlistPick | null = null;
    for (const pick of ranked) {
      const verdict = qualifies(pick, fixture);
      if (!verdict.ok) {
        rejected.set(verdict.reason, (rejected.get(verdict.reason) ?? 0) + 1);
        continue;
      }
      const league = fixtureLeague(fixture);
      chosen = {
        fixtureId: fixture.id,
        sport: fixture.sport,
        leagueId: fixture.leagueId,
        league: league.name,
        country: league.country ?? 'International',
        home: homeTeam(fixture).name,
        away: awayTeam(fixture).name,
        kickoff: fixture.kickoff,
        status: fixture.status,
        score: fixture.status === 'scheduled' ? undefined : fixture.score,
        periods: fixture.periods,
        marketId: pick.marketId ?? '',
        market: pick.market,
        marketGroup: familyOf(pick.marketId ?? ''),
        selection: pick.selection,
        modelProbability: pick.modelProbability,
        odds: pick.odds,
        edge: pick.edge,
        confidence: pick.confidence,
        stakeNgn: pick.stakeNgn,
        reason: verdict.reason,
        tier: verdict.tier
      };
      break;
    }
    if (chosen) picks.push(chosen);
  }

  const board: ShortlistBoard = {
    date,
    generatedAt: new Date().toISOString(),
    picks: picks.sort((a, b) => b.modelProbability - a.modelProbability || b.edge - a.edge).slice(0, 14),
    scanned: onDay.length,
    considered,
    rejected: [...rejected.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    learning: learning ? { settled: learning.settled, accuracy: learning.accuracy } : null
  };

  memos.set(memoKey, { at: Date.now(), board });
  if (memos.size > 24) memos.delete(memos.keys().next().value as string);
  await writeCache(key, board, 30 * 86_400_000).catch(() => undefined);
  await recordArchive(date).catch(() => undefined);
  return board;
}

const memos = new Map<string, { at: number; board: ShortlistBoard }>();

async function recordArchive(date: string): Promise<void> {
  const index = (await readCache<string[]>('shortlist/index'))?.value ?? [];
  const next = [...new Set([date, ...index])].sort().reverse().slice(0, ARCHIVE_DAYS);
  await writeCache('shortlist/index', next, 180 * 86_400_000);
}

export async function shortlistForDate(date: string, force = false): Promise<ShortlistBoard> {
  return build(date, force);
}

export async function shortlistArchive(): Promise<string[]> {
  return (await readCache<string[]>('shortlist/index'))?.value ?? [];
}

export function filterShortlist(
  board: ShortlistBoard,
  filters: { sport?: string; league?: string; market?: string; minProbability?: number; tier?: string; query?: string }
): ShortlistPick[] {
  const query = (filters.query ?? '').toLowerCase();
  return board.picks.filter((pick) => {
    if (filters.sport && filters.sport !== 'all' && pick.sport !== filters.sport) return false;
    if (filters.league && filters.league !== 'all' && pick.leagueId !== filters.league) return false;
    if (filters.market && filters.market !== 'all' && pick.marketGroup !== filters.market) return false;
    if (filters.tier && filters.tier !== 'all' && pick.tier !== filters.tier) return false;
    if (filters.minProbability && pick.modelProbability < filters.minProbability) return false;
    if (query && !`${pick.home} ${pick.away} ${pick.league} ${pick.country} ${pick.selection}`.toLowerCase().includes(query)) return false;
    return true;
  });
}
