import { v } from 'convex/values';
import { action, internalMutation, query } from './_generated/server';

/**
 * Provider collection (built-in fetching in Convex).
 *
 * Convex actions can call out to the network, so collection runs here as
 * well as in the Cloudflare worker. To respect the paid-provider ceilings
 * the action asks the app's budget ledger for permission before making a
 * request, and it never writes bulk payloads into Convex: rows are handed to
 * the app, which stores them in Cloudflare R2 and pushes back only a tiny
 * metadata record.
 */

const HOSTS: Record<string, string> = {
  football: 'v3.football.api-sports.io',
  basketball: 'v1.basketball.api-sports.io',
  icehockey: 'v1.hockey.api-sports.io',
  nba: 'v2.nba.api-sports.io',
  baseball: 'v1.baseball.api-sports.io'
};

export const budget = query({
  args: {},
  handler: async (ctx) => ctx.db.query('providerBudgets').take(20)
});

export const recordCollection = internalMutation({
  args: {
    source: v.string(),
    sport: v.string(),
    rows: v.number(),
    bytes: v.number(),
    status: v.union(v.literal('succeeded'), v.literal('skipped'), v.literal('failed')),
    detail: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('providerCollections', {
      source: args.source,
      sport: args.sport,
      rows: args.rows,
      bytes: args.bytes,
      status: args.status,
      detail: args.detail ?? '',
      collectedAt: Date.now()
    });
    return true;
  }
});

export const collections = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) =>
    ctx.db
      .query('providerCollections')
      .withIndex('by_collected')
      .order('desc')
      .take(limit ?? 20)
});

/**
 * Collect live fixtures for one sport.
 *
 * Budget check → provider call → hand the rows to the app for R2 storage.
 */
export const collect = action({
  args: { sport: v.string(), season: v.optional(v.number()) },
  handler: async (ctx, { sport, season }) => {
    const host = HOSTS[sport];
    if (!host) throw new Error(`Unsupported sport "${sport}".`);

    const apiKey = process.env.API_FOOTBALL_KEY;
    const appUrl = process.env.CAVEBETTOR_APP_URL;
    const secret = process.env.CAVEBETTOR_SYNC_SECRET;
    if (!apiKey || !appUrl || !secret) {
      return { ok: false, reason: 'Collection not configured (API key or app URL missing).' };
    }

    // Ask the app for budget permission first — the ceiling is enforced there.
    const permission = await fetch(`${appUrl}/api/providers/budget`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cavebettor-sync-secret': secret },
      body: JSON.stringify({ provider: 'api-football', units: 1 })
    });
    const permit = (await permission.json()) as { allowed?: boolean; remaining?: number };
    if (!permit.allowed) {
      return { ok: false, reason: `Daily API-Football allowance exhausted (${permit.remaining ?? 0} left).` };
    }

    const url = new URL(`https://${host}/fixtures`);
    url.searchParams.set('season', String(season ?? 2025));
    url.searchParams.set('timezone', 'Africa/Lagos');
    const res = await fetch(url, { headers: { 'x-apikey': apiKey } });
    if (!res.ok) {
      return { ok: false, reason: `Provider returned HTTP ${res.status}.` };
    }
    const payload = (await res.json()) as { response?: unknown[] };
    const rows = (payload.response ?? []) as unknown[];

    // Hand the rows to the app: R2 stores the payload, Convex keeps metadata.
    const ingest = await fetch(`${appUrl}/api/providers/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cavebettor-sync-secret': secret },
      body: JSON.stringify({ source: 'api-football', sport, rows })
    });

    await ctx.runMutation(internal.recordCollection, {
      source: 'api-football',
      sport,
      rows: rows.length,
      bytes: JSON.stringify(rows).length,
      status: ingest.ok ? 'succeeded' : 'failed',
      detail: ingest.ok ? 'Stored in R2 data plane.' : 'App ingest failed.'
    });

    return { ok: ingest.ok, rows: rows.length };
  }
});
