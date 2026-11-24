/**
 * Client-side betslip store.
 *
 * The same slip is shared by every surface: a "+" on a market in the fixture
 * analysis page, a "+" on the value board, or the builder itself all push into
 * this store, and the builder reads it back from localStorage on load.
 *
 * It never talks to a bookmaker. It is a research artefact: legs, prices,
 * model probabilities, stakes and a saved history.
 */

export interface SlipLeg {
  id: string;
  fixtureId: string;
  fixtureLabel: string;
  league: string;
  leagueId?: string;
  sport: string;
  kickoff: string;
  marketId: string;
  marketLabel: string;
  marketGroup?: string;
  outcomeId?: string;
  label: string;
  odds: number;
  probability: number;
  edge: number;
  bestBook?: string;
}

export interface SavedSlip {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  legs: SlipLeg[];
  stakeNgn: number;
  odds: number;
  probability: number;
}

const LIP = 'cavebettor.betslip.v1';
const LIP_HISTORY = 'cavebettor.betslip.history.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be blocked; the in-memory state still works this session */
  }
}

export function combinedOdds(legs: SlipLeg[]): number {
  return legs.reduce((acc, leg) => acc * leg.odds, 1);
}

export function combinedProbability(legs: SlipLeg[]): number {
  return legs.reduce((acc, leg) => acc * leg.probability, 1);
}

class BetslipStore {
  legs = $state<SlipLeg[]>([]);
  stake = $state(10_000);
  history = $state<SavedSlip[]>([]);
  loaded = $state(false);

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.legs = read<SlipLeg[]>(LIP, []);
      this.history = read<SavedSlip[]>(LIP_HISTORY, []);
      this.loaded = true;
    }
  }

  get odds(): number {
    return combinedOdds(this.legs);
  }

  get probability(): number {
    return combinedProbability(this.legs);
  }

  get count(): number {
    return this.legs.length;
  }

  has(id: string): boolean {
    return this.legs.some((leg) => leg.id === id);
  }

  add(leg: SlipLeg): 'added' | 'removed' {
    if (this.has(leg.id)) {
      this.remove(leg.id);
      return 'removed';
    }
    // One selection per market per fixture: two prices on the same market can
    // never both win, so they must not sit in one accumulator.
    const withoutConflict = this.legs.filter((existing) => !(existing.fixtureId === leg.fixtureId && existing.marketId === leg.marketId));
    this.legs = [...withoutConflict, leg];
    this.persist();
    return 'added';
  }

  remove(id: string): void {
    this.legs = this.legs.filter((leg) => leg.id !== id);
    this.persist();
  }

  toggle(leg: SlipLeg): 'added' | 'removed' {
    return this.add(leg);
  }

  clear(): void {
    this.legs = [];
    this.persist();
  }

  setStake(value: number): void {
    this.stake = Math.max(0, Math.round(value));
    this.persist();
  }

  load(saved: SavedSlip): void {
    this.legs = saved.legs;
    this.stake = saved.stakeNgn;
    this.persist();
  }

  save(title: string): SavedSlip | null {
    if (!this.legs.length) return null;
    const clean = title.trim() || `Accumulator · ${new Date().toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
    const existing = this.history.find((slip) => slip.title.toLowerCase() === clean.toLowerCase());
    const record: SavedSlip = {
      id: existing?.id ?? `slip_${Date.now().toString(36)}`,
      title: clean,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      legs: this.legs,
      stakeNgn: this.stake,
      odds: this.odds,
      probability: this.probability
    };
    this.history = [record, ...this.history.filter((slip) => slip.id !== record.id)].slice(0, 40);
    write(LIP_HISTORY, this.history);
    return record;
  }

  rename(id: string, title: string): void {
    this.history = this.history.map((slip) => (slip.id === id ? { ...slip, title: title.trim() || slip.title, updatedAt: new Date().toISOString() } : slip));
    write(LIP_HISTORY, this.history);
  }

  deleteSaved(id: string): void {
    this.history = this.history.filter((slip) => slip.id !== id);
    write(LIP_HISTORY, this.history);
  }

  private persist(): void {
    write(LIP, this.legs);
    write('cavebettor.betslip.stake', this.stake);
  }
}

export const betslip = new BetslipStore();

/** Encode a slip into a URL-safe string for sharing. */
export function encodeSlip(legs: SlipLeg[], stake: number): string {
  const payload = { l: legs.map((leg) => [leg.fixtureId, leg.marketId, leg.outcomeId ?? leg.label, leg.label, leg.odds, leg.probability]), s: stake };
  try {
    return btoa(encodeURIComponent(JSON.stringify(payload)));
  } catch {
    return '';
  }
}

export function decodeSlip(value: string): { legs: SlipLeg[]; stake: number } | null {
  try {
    const payload = JSON.parse(decodeURIComponent(atob(value))) as {
      l: [string, string, string, string, number, number][];
      s: number;
    };
    if (!Array.isArray(payload.l)) return null;
    const legs = payload.l.map(([fixtureId, marketId, outcomeId, label, odds, probability]) => ({
      id: `${fixtureId}:${marketId}:${outcomeId}`,
      fixtureId,
      fixtureLabel: '',
      league: '',
      sport: '',
      kickoff: new Date().toISOString(),
      marketId,
      marketLabel: '',
      outcomeId,
      label,
      odds,
      probability,
      edge: probability * odds - 1
    }));
    return { legs, stake: payload.s ?? 10_000 };
  } catch {
    return null;
  }
}
