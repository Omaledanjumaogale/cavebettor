import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/** Same shared secret the live-sync worker already uses. */
function requireSecret(secret: string) {
  const expected = process.env.CAVEBETTOR_SYNC_SECRET;
  if (!expected || expected.length < 24) throw new Error('Budget ledger is not configured.');
  let diff = expected.length ^ secret.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (secret.charCodeAt(i) || 0);
  if (diff !== 0) throw new Error('Unauthorized.');
}

/**
 * Provider budget ledger (control plane).
 *
 * One tiny document per provider+period. Reserve before an outbound call,
 * commit after a billable response, release if the call failed. This is the
 * only place provider usage is recorded — no bulk payloads, no scans.
 */

export const read = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db.query('providerBudgets').withIndex('by_key', (q) => q.eq('key', key)).unique();
    if (!row) return null;
    return { key: row.key, used: row.used, reserved: row.reserved, limit: row.limit, updatedAt: row.updatedAt };
  }
});

export const all = query({
  args: {},
  handler: async (ctx) => ctx.db.query('providerBudgets').take(50)
});

/** Reserve units against a provider's ceiling. Returns exhausted when the cap is hit. */
export const reserve = mutation({
  args: { key: v.string(), units: v.number(), limit: v.number(), secret: v.string() },
  handler: async (ctx, { key, units, limit, secret }) => {
    requireSecret(secret);
    const existing = await ctx.db.query('providerBudgets').withIndex('by_key', (q) => q.eq('key', key)).unique();
    const used = existing?.used ?? 0;
    const reserved = existing?.reserved ?? 0;
    if (used + reserved + units > limit) {
      return { used, reserved, exhausted: true as const };
    }
    const row = { key, used, reserved: reserved + units, limit, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert('providerBudgets', row);
    return { used, reserved: reserved + units, exhausted: false as const };
  }
});

/** Release a reservation (the call failed and was not billable). */
export const release = mutation({
  args: { key: v.string(), units: v.number(), secret: v.string() },
  handler: async (ctx, { key, units, secret }) => {
    requireSecret(secret);
    const existing = await ctx.db.query('providerBudgets').withIndex('by_key', (q) => q.eq('key', key)).unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      reserved: Math.max(0, existing.reserved - units),
      updatedAt: Date.now()
    });
    return { released: units };
  }
});

/** Record a completed, billable call. */
export const commit = mutation({
  args: { key: v.string(), units: v.number(), secret: v.string() },
  handler: async (ctx, { key, units, secret }) => {
    requireSecret(secret);
    const existing = await ctx.db.query('providerBudgets').withIndex('by_key', (q) => q.eq('key', key)).unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      used: existing.used + units,
      reserved: Math.max(0, existing.reserved - units),
      updatedAt: Date.now()
    });
    return { used: existing.used + units };
  }
});

/** Public surface used by the pipeline control room. */
export const snapshot = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('providerBudgets').take(50);
    return rows.map((r) => ({
      provider: r.key.split(':')[0],
      key: r.key,
      limit: r.limit,
      used: r.used,
      reserved: r.reserved,
      remaining: Math.max(0, r.limit - r.used - r.reserved),
      updatedAt: r.updatedAt
    }));
  }
});
