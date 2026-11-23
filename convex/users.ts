import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';

async function identify(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query('users')
    .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
    .unique();
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject))
      .unique();
    if (!user) return null;
    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .first();
    const settings = await ctx.db.query('settings').withIndex('by_user', (q) => q.eq('userId', user._id)).unique();
    return { user, subscription, settings };
  }
});

export const ensure = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    workspace: v.string(),
    role: v.optional(v.union(v.literal('owner'), v.literal('analyst'), v.literal('viewer'), v.literal('admin')))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const existing = identity
      ? await ctx.db.query('users').withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject)).unique()
      : await ctx.db.query('users').withIndex('by_email', (q) => q.eq('email', args.email)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: Date.now(), name: args.name, workspace: args.workspace });
      return existing._id;
    }
    const avatar = args.name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
    const userId = await ctx.db.insert('users', {
      tokenIdentifier: identity?.subject,
      name: args.name,
      email: args.email,
      role: args.role ?? 'owner',
      workspace: args.workspace,
      timezone: 'Africa/Lagos',
      currency: 'NGN',
      avatar,
      createdAt: Date.now(),
      lastSeenAt: Date.now()
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
      actor: args.email,
      action: 'Created workspace',
      detail: `${args.workspace} · ${args.name}`,
      entity: 'users',
      entityId: userId,
      createdAt: Date.now()
    });
    return userId;
  }
});

export const updateProfile = mutation({
  args: { name: v.optional(v.string()), workspace: v.optional(v.string()), timezone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await identify(ctx);
    if (!user) throw new Error('Not authenticated');
    await ctx.db.patch(user._id, args);
  }
});

export const updateSettings = mutation({
  args: {
    oddsFormat: v.optional(v.union(v.literal('decimal'), v.literal('american'), v.literal('fractional'))),
    staking: v.optional(v.union(v.literal('quarter'), v.literal('half'), v.literal('flat'))),
    minEdgePct: v.optional(v.number()),
    maxStakePct: v.optional(v.number()),
    notifyValue: v.optional(v.boolean()),
    notifyResults: v.optional(v.boolean()),
    notifyDrift: v.optional(v.boolean()),
    dailyBrief: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const user = await identify(ctx);
    if (!user) throw new Error('Not authenticated');
    const settings = await ctx.db.query('settings').withIndex('by_user', (q) => q.eq('userId', user._id)).unique();
    if (!settings) throw new Error('Settings not initialised');
    await ctx.db.patch(settings._id, args);
  }
});

export const listMembers = query({
  args: { workspace: v.string() },
  handler: async (ctx, { workspace }) => {
    const users = await ctx.db.query('users').collect();
    return users.filter((u) => u.workspace === workspace).map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      lastSeenAt: u.lastSeenAt
    }));
  }
});
