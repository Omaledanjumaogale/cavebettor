import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

function requireSyncSecret(secret: string) {
  const expected = process.env.CAVEBETTOR_SYNC_SECRET;
  if (!expected || expected.length < 24) throw new Error('Server authentication is not configured.');
  let diff = expected.length ^ secret.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (secret.charCodeAt(i) || 0);
  if (diff !== 0) throw new Error('Unauthorized.');
}

function avatarFor(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'CB'
  );
}

/** Upsert the signed-in identity (Google, GitHub, E-WIN SSO or admin). */
export const upsertExternal = mutation({
  args: {
    secret: v.string(),
    email: v.string(),
    name: v.string(),
    provider: v.string(),
    ewinSubject: v.optional(v.string()),
    role: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    requireSyncSecret(args.secret);
    const email = args.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('A valid email is required.');
    const superAdmin = (process.env.SUPER_ADMIN_EMAIL ?? '').toLowerCase();
    const role =
      email === superAdmin || args.role === 'super_admin'
        ? 'super_admin'
        : args.role === 'admin'
          ? 'admin'
          : 'analyst';
    const existing = await ctx.db.query('users').withIndex('by_email', (q) => q.eq('email', email)).unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name || existing.name,
        role: role as 'owner' | 'analyst' | 'viewer' | 'admin' | 'super_admin',
        avatar: avatarFor(args.name || existing.name),
        lastSeenAt: now
      });
      return { userId: existing._id, email, name: args.name || existing.name, role, created: false };
    }
    const userId = await ctx.db.insert('users', {
      name: args.name || email.split('@')[0],
      email,
      role: role as 'owner' | 'analyst' | 'viewer' | 'admin' | 'super_admin',
      workspace: 'Lagos Value Desk',
      timezone: 'Africa/Lagos',
      currency: 'NGN',
      avatar: avatarFor(args.name || email),
      createdAt: now,
      lastSeenAt: now
    });
    await ctx.db.insert('settings', {
      userId,
      oddsFormat: 'decimal',
      staking: 'quarter',
      minEdgePct: 2.5,
      maxStakePct: 5,
      notifyValue: true,
      notifyResults: true,
      notifyDrift: true,
      dailyBrief: true
    });
    await ctx.db.insert('auditLogs', {
      actor: email,
      action: 'Account created',
      detail: `Signed in with ${args.provider}`,
      entity: 'user',
      entityId: userId,
      createdAt: now
    });
    return { userId, email, name: args.name || email.split('@')[0], role, created: true };
  }
});

export const recordSession = mutation({
  args: {
    secret: v.string(),
    tokenHash: v.string(),
    email: v.string(),
    name: v.string(),
    provider: v.string(),
    role: v.string(),
    userId: v.optional(v.id('users')),
    userAgent: v.optional(v.string()),
    ipHash: v.optional(v.string()),
    expiresAt: v.number()
  },
  handler: async (ctx, args) => {
    requireSyncSecret(args.secret);
    const now = Date.now();
    const id = await ctx.db.insert('authSessions', {
      tokenHash: args.tokenHash,
      email: args.email.toLowerCase(),
      name: args.name,
      provider: args.provider,
      role: args.role,
      userId: args.userId,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: args.expiresAt,
      userAgent: args.userAgent,
      ipHash: args.ipHash
    });
    await ctx.db.insert('auditLogs', {
      actor: args.email,
      action: 'Signed in',
      detail: args.provider,
      entity: 'session',
      entityId: id,
      createdAt: now
    });
    return id;
  }
});

export const revokeSession = mutation({
  args: { secret: v.string(), tokenHash: v.string() },
  handler: async (ctx, { secret, tokenHash }) => {
    requireSyncSecret(secret);
    const row = await ctx.db.query('authSessions').withIndex('by_token', (q) => q.eq('tokenHash', tokenHash)).unique();
    if (row) {
      await ctx.db.delete(row._id);
      return { revoked: true };
    }
    return { revoked: false };
  }
});

export const sessions = query({
  args: { secret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { secret, limit }) => {
    requireSyncSecret(secret);
    return ctx.db.query('authSessions').order('desc').take(Math.min(limit ?? 30, 100));
  }
});

export const overview = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireSyncSecret(secret);
    const users = await ctx.db.query('users').take(500);
    const subscriptions = await ctx.db.query('subscriptions').take(500);
    const sessions = await ctx.db.query('authSessions').take(200);
    const audit = await ctx.db.query('auditLogs').order('desc').take(30);
    const sync = await ctx.db.query('syncState').withIndex('by_key', (q) => q.eq('key', 'current')).unique();
    const fixtures = await ctx.db.query('fixtures').take(500);
    const predictions = await ctx.db.query('predictions').take(500);
    const values = await ctx.db.query('valueSelections').take(500);
    return {
      counts: {
        users: users.length,
        activeSubscriptions: subscriptions.filter((s) => s.status === 'active').length,
        mrrNgn: subscriptions.filter((s) => s.status === 'active').reduce((a, s) => a + s.priceNgn, 0),
        sessions: sessions.filter((s) => s.expiresAt > Date.now()).length,
        fixtures: fixtures.length,
        predictions: predictions.length,
        valueSelections: values.length
      },
      users: users
        .sort((a, b) => (b.lastSeenAt ?? b.createdAt) - (a.lastSeenAt ?? a.createdAt))
        .slice(0, 40)
        .map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, workspace: u.workspace, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt })),
      subscriptions: subscriptions.slice(0, 40).map((s) => ({ id: s._id, planName: s.planName, status: s.status, priceNgn: s.priceNgn, renewsAt: s.renewsAt })),
      sessions: sessions.slice(0, 30).map((s) => ({ id: s._id, email: s.email, provider: s.provider, role: s.role, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt })),
      audit: audit.map((a) => ({ id: a._id, actor: a.actor, action: a.action, detail: a.detail, createdAt: a.createdAt })),
      sync
    };
  }
});
