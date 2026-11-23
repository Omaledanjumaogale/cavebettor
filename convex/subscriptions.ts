import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

const planPricing = { starter: 0, pro: 5000, desk: 5000 } as const;

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db.query('users').withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject)).unique();
    if (!user) return null;
    return ctx.db.query('subscriptions').withIndex('by_user', (q) => q.eq('userId', user._id)).order('desc').first();
  }
});

export const activate = mutation({
  args: {
    planId: v.union(v.literal('starter'), v.literal('pro'), v.literal('desk')),
    paystackReference: v.optional(v.string()),
    seats: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    const user = await ctx.db.query('users').withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject)).unique();
    if (!user) throw new Error('User not found');
    const seats = Math.max(1, args.seats ?? 1);
    const priceNgn = planPricing[args.planId] * seats;
    const existing = await ctx.db.query('subscriptions').withIndex('by_user', (q) => q.eq('userId', user._id)).order('desc').first();
    const renewsAt = Date.now() + 30 * 86_400_000;
    if (existing) {
      await ctx.db.patch(existing._id, {
        planId: args.planId,
        planName: args.planId === 'pro' ? 'CaveBettor Pro' : args.planId === 'desk' ? 'CaveBettor Trading Desk' : 'Starter',
        priceNgn,
        seats,
        status: 'active',
        renewsAt,
        paystackReference: args.paystackReference
      });
      return existing._id;
    }
    const id = await ctx.db.insert('subscriptions', {
      userId: user._id,
      planId: args.planId,
      planName: args.planId === 'pro' ? 'CaveBettor Pro' : args.planId === 'desk' ? 'CaveBettor Trading Desk' : 'Starter',
      priceNgn,
      interval: 'month',
      status: 'active',
      seats,
      startedAt: Date.now(),
      renewsAt,
      paystackReference: args.paystackReference
    });
    await ctx.db.insert('auditLogs', {
      actor: user.email,
      action: `Activated ${args.planId} plan`,
      detail: `₦${priceNgn.toLocaleString()} / month · ${seats} seat(s)`,
      entity: 'subscriptions',
      entityId: id,
      createdAt: Date.now()
    });
    return id;
  }
});

export const cancel = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    const user = await ctx.db.query('users').withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.subject)).unique();
    if (!user) throw new Error('User not found');
    const existing = await ctx.db.query('subscriptions').withIndex('by_user', (q) => q.eq('userId', user._id)).order('desc').first();
    if (!existing) return null;
    await ctx.db.patch(existing._id, { status: 'cancelled', cancelledAt: Date.now() });
    return existing._id;
  }
});

export const mrr = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db.query('subscriptions').withIndex('by_status', (q) => q.eq('status', 'active')).collect();
    const mrr = active.reduce((a, s) => a + s.priceNgn, 0);
    return { subscribers: active.length, mrr, arpu: active.length ? mrr / active.length : 0, seats: active.reduce((a, s) => a + s.seats, 0) };
  }
});
