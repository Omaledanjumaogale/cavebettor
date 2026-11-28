import { json } from '@sveltejs/kit';
import { getPaperBets } from '#lib/engine/analytics';
import type { PaperBet } from '#lib/types';
import type { RequestHandler } from './$types';

export const prerender = false;

const HEADER = [
  'id',
  'fixture_id',
  'fixture',
  'selection',
  'market',
  'odds',
  'stake_ngn',
  'model_probability',
  'edge',
  'status',
  'placed_at',
  'settled_at',
  'pnl_ngn'
];

const cell = (value: string | number | undefined) => {
  if (value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const row = (bet: PaperBet) => [
  bet.id,
  bet.fixtureId,
  bet.fixtureLabel,
  bet.selection,
  bet.market,
  bet.odds,
  bet.stakeNgn,
  bet.modelProbability,
  bet.edge,
  bet.status,
  bet.placedAt,
  bet.settledAt,
  bet.pnlNgn
];

/**
 * GET /api/paper/export — the paper ledger as CSV (or `?format=json`).
 *
 * Every row is a call the board published, so an export can be diffed against
 * the value board it came from.
 */
export const GET: RequestHandler = ({ url }) => {
  const bets = getPaperBets();

  if (url.searchParams.get('format') === 'json') {
    return json({ count: bets.length, bets });
  }

  const csv = [HEADER, ...bets.map(row)].map((line) => line.map(cell).join(',')).join('\n');
  return new Response(`${csv}\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="cavebettor-paper-ledger.csv"',
      'cache-control': 'no-store'
    }
  });
};