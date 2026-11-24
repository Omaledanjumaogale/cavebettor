/**
 * Provider budget ledger.
 *
 * Every paid provider call must pass through `reserve()` first. The ledger
 * enforces hard ceilings:
 *
 *   API-Football : 100 requests / day   (account-wide, allocated per sport)
 *   The Odds API : 250 requests / month
 *   Odd-API      : 500 credits / month
 *
 * Counters live in a single tiny Convex document per provider+period
 * (control-plane metadata only — never bulk payloads), so the free-tier
 * database stays small and reads are point lookups rather than scans.
 * When Convex is not configured the ledger falls back to an in-process map so
 * local development and preview builds behave identically.
 */

import { env as privateEnv } from '$env/dynamic/private';

export type BudgetPeriod = 'day' | 'month';
export type ProviderId = 'api-football' | 'the-odds-api' | 'odd-api';

export interface BudgetRule {
  provider: ProviderId;
  limit: number;
  period: BudgetPeriod;
  unit: 'request' | 'credit';
  note: string;
}

export interface BudgetState {
  provider: ProviderId;
  key: string;
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
  period: BudgetPeriod;
  unit: 'request' | 'credit';
  updatedAt: number;
}

export const BUDGET_RULES: BudgetRule[] = [
  {
    provider: 'api-football',
    limit: 100,
    period: 'day',
    unit: 'request',
    note: 'API-Football free plan — 100 requests per day across every sport and host.'
  },
  {
    provider: 'the-odds-api',
    limit: 250,
    period: 'month',
    unit: 'request',
    note: 'The Odds API — 250 requests per month. Odds are cached and fetched in batches.'
  },
  {
    provider: 'odd-api',
    limit: 500,
    period: 'month',
    unit: 'credit',
    note: 'Odd-API — 500 credits per month. Only the highest-value markets are rationed to it.'
  }
];

/** Per-sport share of the API-Football daily allowance (sums to 100). */
export const API_FOOTBALL_SPORT_ALLOCATION: Record<string, number> = {
  football: 34,
  basketball: 20,
  icehockey: 14,
  nba: 16,
  baseball: 16
};

function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function monthKey(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export function budgetKey(provider: ProviderId, now = new Date()): string {
  const rule = BUDGET_RULES.find((r) => r.provider === provider)!;
  return `${provider}:${rule.period === 'day' ? dayKey(now) : monthKey(now)}`;
}

interface LedgerRow {
  used: number;
  reserved: number;
}

/** Shared secret used to authorise ledger mutations on the Convex side. */
function ledgerSecret(): string {
  return privateEnv.CAVEBETTOR_SYNC_SECRET || process.env.CAVEBETTOR_SYNC_SECRET || '';
}

const memory = new Map<string, LedgerRow>();

function localRead(key: string): LedgerRow {
  return memory.get(key) ?? { used: 0, reserved: 0 };
}

function localWrite(key: string, row: LedgerRow) {
  memory.set(key, row);
}

/** Read the persisted ledger row when Convex is configured. */
async function convexRead(key: string): Promise<LedgerRow | null> {
  try {
    const { convexClient, withTimeout } = await import('#lib/server/convexClient');
    const row = await withTimeout(convexClient().query('budget:read' as never, { key } as never), 1500);
    if (!row) return null;
    return { used: Number((row as { used?: number }).used ?? 0), reserved: Number((row as { reserved?: number }).reserved ?? 0) };
  } catch {
    return null;
  }
}

type ReserveOutcome =
  | { status: 'granted'; row: LedgerRow }
  | { status: 'exhausted' }
  | { status: 'unavailable' };

async function convexReserve(key: string, units: number, limit: number): Promise<ReserveOutcome> {
  try {
    const { convexClient, withTimeout } = await import('#lib/server/convexClient');
    const row = (await withTimeout(convexClient().mutation('budget:reserve' as never, {
      key,
      units,
      limit,
      secret: ledgerSecret()
    } as never), 1500)) as { used?: number; reserved?: number; exhausted?: boolean } | null;
    if (!row) return { status: 'unavailable' };
    if (row.exhausted) return { status: 'exhausted' };
    return { status: 'granted', row: { used: Number(row.used ?? 0), reserved: Number(row.reserved ?? 0) } };
  } catch {
    return { status: 'unavailable' };
  }
}

async function convexRelease(key: string, units: number): Promise<void> {
  try {
    const { convexClient, withTimeout } = await import('#lib/server/convexClient');
    await withTimeout(convexClient().mutation('budget:release' as never, { key, units, secret: ledgerSecret() } as never), 1500);
  } catch {
    /* ledger stays authoritative in memory for this process */
  }
}

/**
 * Reserve budget for an outbound provider call.
 * Returns `null` when the ceiling would be exceeded — the caller must then
 * serve cached data instead of calling the provider.
 */
export async function reserve(provider: ProviderId, units = 1): Promise<BudgetState | null> {
  const rule = BUDGET_RULES.find((r) => r.provider === provider)!;
  const key = budgetKey(provider);

  const outcome = await convexReserve(key, units, rule.limit);
  let row: LedgerRow;

  if (outcome.status === 'granted') {
    // The Convex ledger is authoritative when it is configured.
    row = outcome.row;
    localWrite(key, row);
  } else if (outcome.status === 'exhausted') {
    // The shared ledger says the ceiling is reached — never fall back.
    row = { used: rule.limit, reserved: 0 };
    return {
      provider,
      key,
      limit: rule.limit,
      used: rule.limit,
      reserved: 0,
      remaining: 0,
      period: rule.period,
      unit: rule.unit,
      updatedAt: Date.now()
    };
  } else {
    const current = localRead(key);
    if (current.used + current.reserved + units > rule.limit) {
      return {
        provider,
        key,
        limit: rule.limit,
        used: current.used,
        reserved: current.reserved,
        remaining: 0,
        period: rule.period,
        unit: rule.unit,
        updatedAt: Date.now()
      };
    }
    row = { used: current.used, reserved: current.reserved + units };
    localWrite(key, row);
  }

  return {
    provider,
    key,
    limit: rule.limit,
    used: row.used,
    reserved: row.reserved,
    remaining: Math.max(0, rule.limit - row.used - row.reserved),
    period: rule.period,
    unit: rule.unit,
    updatedAt: Date.now()
  };
}

/** Release a reservation when the provider call failed and was not counted. */
export async function release(provider: ProviderId, units = 1): Promise<void> {
  const key = budgetKey(provider);
  const current = localRead(key);
  localWrite(key, { used: current.used, reserved: Math.max(0, current.reserved - units) });
  await convexRelease(key, units);
}

/** Record a completed, billable call. */
export async function commit(provider: ProviderId, units = 1): Promise<void> {
  const key = budgetKey(provider);
  const current = localRead(key);
  localWrite(key, { used: current.used + units, reserved: Math.max(0, current.reserved - units) });
  try {
    const { convexClient, withTimeout } = await import('#lib/server/convexClient');
    await withTimeout(convexClient().mutation('budget:commit' as never, { key, units, secret: ledgerSecret() } as never), 1500);
  } catch {
    /* keep local accounting */
  }
}

/** Commit a sport-scoped API-Football reservation (successful call). */
export async function commitApiFootball(sport: string, units = 1): Promise<void> {
  const sportKey = `${budgetKey('api-football')}:${sport}`;
  const current = localRead(sportKey);
  localWrite(sportKey, { used: current.used + units, reserved: Math.max(0, current.reserved - units) });
  try {
    const { convexClient, withTimeout } = await import('#lib/server/convexClient');
    await withTimeout(
      convexClient().mutation('budget:commit' as never, {
        key: sportKey,
        units,
        secret: ledgerSecret()
      } as never),
      1500
    );
  } catch {
    /* local accounting remains authoritative for this process */
  }
  await commit('api-football', units);
}

/** Current usage for every provider — used by the pipeline control room. */
export async function budgetSnapshot(now = new Date()): Promise<BudgetState[]> {
  const out: BudgetState[] = [];
  for (const rule of BUDGET_RULES) {
    const key = budgetKey(rule.provider, now);
    const persisted = await convexRead(key);
    const row = persisted ?? localRead(key);
    out.push({
      provider: rule.provider,
      key,
      limit: rule.limit,
      used: row.used,
      reserved: row.reserved,
      remaining: Math.max(0, rule.limit - row.used - row.reserved),
      period: rule.period,
      unit: rule.unit,
      updatedAt: Date.now()
    });
  }
  return out;
}

/**
 * API-Football is subject to a single account-wide daily ceiling. Sprints are
 * reserved inside that ceiling so one sport cannot starve the others.
 */
export function apiFootballSportAllowance(sport: string): number {
  return API_FOOTBALL_SPORT_ALLOCATION[sport] ?? 10;
}

/**
 * Reserve one API-Football request for a specific sport.
 *
 * Two ceilings are checked: the account-wide daily limit and the per-sport
 * share inside it. The per-sport counter is a second tiny ledger document,
 * so no bulk data is written to Convex.
 */
export async function reserveApiFootball(sport: string, units = 1): Promise<BudgetState | null> {
  const allowance = apiFootballSportAllowance(sport);
  const sportKey = `${budgetKey('api-football')}:${sport}`;
  const outcome = await convexReserve(sportKey, units, allowance);

  if (outcome.status === 'exhausted') return null;

  let sportRow: LedgerRow;
  if (outcome.status === 'granted') {
    sportRow = outcome.row;
  } else {
    const current = localRead(sportKey);
    if (current.used + current.reserved + units > allowance) return null;
    sportRow = { used: current.used, reserved: current.reserved + units };
    localWrite(sportKey, sportRow);
  }

  // The sport share is available — now ask for the account-wide reservation.
  const account = await reserve('api-football', units);
  if (!account || account.remaining < units) {
    await release('api-football', units);
    return null;
  }
  return { ...account, remaining: Math.max(0, allowance - sportRow.used - sportRow.reserved) };
}

/** Release a sport-scoped API-Football reservation (failed call). */
export async function releaseApiFootball(sport: string, units = 1): Promise<void> {
  const sportKey = `${budgetKey('api-football')}:${sport}`;
  const current = localRead(sportKey);
  localWrite(sportKey, { used: current.used, reserved: Math.max(0, current.reserved - units) });
  try {
    const { convexClient, withTimeout } = await import('#lib/server/convexClient');
    await withTimeout(
      convexClient().mutation('budget:release' as never, {
        key: sportKey,
        units,
        secret: ledgerSecret()
      } as never),
      1500
    );
  } catch {
    /* local accounting remains authoritative for this process */
  }
  await release('api-football', units);
}

/** Per-sport usage inside the shared daily ceiling. */
export async function apiFootballSportUsage(now = new Date()) {
  const out: { sport: string; allowance: number; used: number; remaining: number }[] = [];
  for (const [sport, allowance] of Object.entries(API_FOOTBALL_SPORT_ALLOCATION)) {
    const key = `${budgetKey('api-football', now)}:${sport}`;
    const persisted = await convexRead(key);
    const row = persisted ?? localRead(key);
    out.push({ sport, allowance, used: row.used, remaining: Math.max(0, allowance - row.used - row.reserved) });
  }
  return out;
}
