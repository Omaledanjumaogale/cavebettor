import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';

/**
 * Email + password credentials (control plane).
 *
 * The hash is produced by the app with PBKDF2-HMAC-SHA256 and verified here, so
 * the Cloudflare Worker never pays the key-derivation CPU cost. Only the
 * verifier and its parameters are stored; the password itself is never logged,
 * echoed or kept.
 *
 * The `write` mutation is guarded by the shared sync secret because this
 * deployment has no end-user Convex auth for password sign-in.
 */

function requireSecret(secret: string) {
  const expected = process.env.CAVEBETTOR_SYNC_SECRET;
  if (!expected || expected.length < 24) throw new Error('Credential store is not configured.');
  let diff = expected.length ^ secret.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (secret.charCodeAt(i) || 0);
  if (diff !== 0) throw new Error('Unauthorized.');
}

export const get = internalQuery({
  args: { email: v.string(), secret: v.string() },
  handler: async (ctx, { email, secret }) => {
    requireSecret(secret);
    const row = await ctx.db
      .query('credentials')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    if (!row) return null;
    return {
      email: row.email,
      name: row.name,
      hash: row.hash,
      salt: row.salt,
      iterations: row.iterations,
      role: row.role,
      createdAt: row.createdAt,
      lastLoginAt: row.lastLoginAt ?? null,
      failedAttempts: row.failedAttempts ?? 0,
      lockedUntil: row.lockedUntil ?? null
    };
  }
});

export const write = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    hash: v.string(),
    salt: v.string(),
    iterations: v.number(),
    role: v.string(),
    secret: v.string()
  },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const existing = await ctx.db
      .query('credentials')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .unique();

    const row = {
      email: args.email,
      name: args.name,
      hash: args.hash,
      salt: args.salt,
      iterations: args.iterations,
      role: args.role,
      createdAt: existing?.createdAt ?? Date.now(),
      lastLoginAt: Date.now(),
      failedAttempts: 0,
      lockedUntil: null as number | null
    };

    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert('credentials', row);
    return { ok: true, created: !existing };
  }
});

export const noteAttempt = internalMutation({
  args: { email: v.string(), ok: v.boolean(), secret: v.string() },
  handler: async (ctx, { email, ok, secret }) => {
    requireSecret(secret);
    const row = await ctx.db
      .query('credentials')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    if (!row) return null;

    if (ok) {
      await ctx.db.patch(row._id, { failedAttempts: 0, lockedUntil: null, lastLoginAt: Date.now() });
      return { failedAttempts: 0, lockedUntil: null };
    }

    const failedAttempts = (row.failedAttempts ?? 0) + 1;
    const lockedUntil = failedAttempts >= 8 ? Date.now() + 15 * 60_000 : null;
    await ctx.db.patch(row._id, { failedAttempts, lockedUntil });
    return { failedAttempts, lockedUntil };
  }
});

export const remove = internalMutation({
  args: { email: v.string(), secret: v.string() },
  handler: async (ctx, { email, secret }) => {
    requireSecret(secret);
    const row = await ctx.db
      .query('credentials')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    if (!row) return false;
    await ctx.db.delete(row._id);
    return true;
  }
});
