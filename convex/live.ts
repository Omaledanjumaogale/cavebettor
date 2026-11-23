import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/**
 * Live read model. The SvelteKit sync worker writes compact, page-shaped
 * snapshots here; the app reads these first and falls back to the local
 * deterministic engine only when Convex is unavailable or empty.
 */

function requireSyncSecret(secret: string) {
  const expected = process.env.CAVEBETTOR_SYNC_SECRET;
  if (!expected || expected.length < 24) throw new Error('Live sync is not configured.');
  // Constant-time comparison without exposing either value.
  let diff = expected.length ^ secret.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (secret.charCodeAt(i) || 0);
  if (diff !== 0) throw new Error('Unauthorized sync.');
}

export const snapshot = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db.query('liveSnapshots').withIndex('by_key', (q) => q.eq('key', key)).unique();
    if (!row) return null;
    return { key: row.key, payload: row.payload, counts: row.counts ?? null, generatedAt: row.generatedAt, updatedAt: row.updatedAt };
  }
});

export const prediction = query({
  args: { fixtureKey: v.string() },
  handler: async (ctx, { fixtureKey }) => {
    const row = await ctx.db.query('livePredictions').withIndex('by_fixture', (q) => q.eq('fixtureKey', fixtureKey)).unique();
    if (!row) return null;
    return { fixtureKey: row.fixtureKey, payload: row.payload, generatedAt: row.generatedAt };
  }
});

export const status = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query('syncState').withIndex('by_key', (q) => q.eq('key', 'current')).unique();
    const keys = await ctx.db.query('liveSnapshots').take(30);
    return {
      configured: Boolean(process.env.CAVEBETTOR_SYNC_SECRET),
      state,
      snapshots: keys.map((row) => ({ key: row.key, bytes: row.payload.length, generatedAt: row.generatedAt, counts: row.counts ?? null }))
    };
  }
});

export const pushSnapshot = mutation({
  args: {
    secret: v.string(),
    key: v.string(),
    payload: v.string(),
    counts: v.optional(v.any()),
    generatedAt: v.number()
  },
  handler: async (ctx, { secret, key, payload, counts, generatedAt }) => {
    requireSyncSecret(secret);
    if (!/^[a-z0-9:_-]{2,80}$/.test(key)) throw new Error('Invalid snapshot key.');
    if (payload.length > 900_000) throw new Error('Snapshot exceeds the safe document size.');
    const existing = await ctx.db.query('liveSnapshots').withIndex('by_key', (q) => q.eq('key', key)).unique();
    const doc = { key, payload, counts, generatedAt, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, doc);
    else await ctx.db.insert('liveSnapshots', doc);
    return { key, bytes: payload.length };
  }
});

export const pushPredictions = mutation({
  args: {
    secret: v.string(),
    items: v.array(v.object({ fixtureKey: v.string(), payload: v.string(), generatedAt: v.number() }))
  },
  handler: async (ctx, { secret, items }) => {
    requireSyncSecret(secret);
    if (items.length > 40) throw new Error('Batch too large.');
    let written = 0;
    for (const item of items) {
      if (!/^[A-Za-z0-9_-]{2,80}$/.test(item.fixtureKey)) throw new Error('Invalid fixture key.');
      if (item.payload.length > 900_000) throw new Error('Prediction exceeds the safe document size.');
      const existing = await ctx.db
        .query('livePredictions')
        .withIndex('by_fixture', (q) => q.eq('fixtureKey', item.fixtureKey))
        .unique();
      const doc = { fixtureKey: item.fixtureKey, payload: item.payload, generatedAt: item.generatedAt };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert('livePredictions', doc);
      written++;
    }
    return { written };
  }
});

export const finishSync = mutation({
  args: {
    secret: v.string(),
    fixtures: v.number(),
    predictions: v.number(),
    valueSelections: v.number(),
    version: v.string(),
    source: v.string(),
    detail: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    requireSyncSecret(args.secret);
    const { secret: _secret, ...doc } = args;
    const existing = await ctx.db.query('syncState').withIndex('by_key', (q) => q.eq('key', 'current')).unique();
    const row = { key: 'current', ...doc, lastSyncedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert('syncState', row);
    await ctx.db.insert('auditLogs', {
      actor: 'sync-worker',
      action: 'Live snapshot synchronised',
      detail: `${doc.fixtures} fixtures · ${doc.predictions} predictions · ${doc.valueSelections} value selections`,
      entity: 'sync',
      entityId: 'current',
      createdAt: Date.now()
    });
    return { ok: true, lastSyncedAt: row.lastSyncedAt };
  }
});

export const prune = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireSyncSecret(secret);
    const cutoff = Date.now() - 14 * 86_400_000;
    const stale = await ctx.db.query('livePredictions').take(200);
    let removed = 0;
    for (const row of stale) {
      if (row.generatedAt < cutoff) {
        await ctx.db.delete(row._id);
        removed++;
      }
    }
    return { removed };
  }
});
