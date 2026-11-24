'use node';

import { v } from 'convex/values';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { internal } from './_generated/api';
import { action } from './_generated/server';

/**
 * Password key derivation (control plane).
 *
 * PBKDF2-HMAC-SHA256 with 210,000 iterations costs far more CPU than a
 * Cloudflare Worker invocation is allowed, so the work happens here and the
 * Worker only sees a boolean. The verifier and its parameters live in Convex;
 * the plain-text password is never stored, logged or returned.
 */

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded + '='.repeat((4 - (padded.length % 4)) % 4), 'base64');
}

function derive(password: string, salt: string, iterations: number): string {
  return base64url(pbkdf2Sync(password.normalize('NFKC'), fromBase64url(salt), iterations, KEY_LENGTH, DIGEST));
}

function requireSecret(secret: string) {
  const expected = process.env.CAVEBETTOR_SYNC_SECRET;
  if (!expected || expected.length < 24) throw new Error('Cloud password hashing is not configured.');
  let diff = expected.length ^ secret.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (secret.charCodeAt(i) || 0);
  if (diff !== 0) throw new Error('Unauthorized.');
}

/** Create or replace a password credential. */
export const register = action({
  args: {
    email: v.string(),
    name: v.string(),
    password: v.string(),
    role: v.string(),
    secret: v.string()
  },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    if (args.password.length < 8) return { ok: false as const, error: 'Use at least 8 characters.' };

    const salt = base64url(randomBytes(16));
    const hash = derive(args.password, salt, ITERATIONS);

    const result: { created: boolean } = await ctx.runMutation(internal.credentials.write, {
      email: args.email,
      name: args.name,
      hash,
      salt,
      iterations: ITERATIONS,
      role: args.role,
      secret: args.secret
    });
    return { ok: true as const, created: result.created };
  }
});

/** Verify a password and record the attempt. */
export const verify = action({
  args: { email: v.string(), password: v.string(), secret: v.string() },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const row = await ctx.runQuery(internal.credentials.get, { email: args.email, secret: args.secret });
    if (!row) return { ok: false as const, reason: 'missing' as const };

    if (row.lockedUntil && row.lockedUntil > Date.now()) {
      return { ok: false as const, reason: 'locked' as const, lockedUntil: row.lockedUntil };
    }

    const candidate = derive(args.password, row.salt, row.iterations);
    const expected = Buffer.from(row.hash, 'utf8');
    const actual = Buffer.from(candidate, 'utf8');
    const matched = expected.length === actual.length && timingSafeEqual(expected, actual);

    await ctx.runMutation(internal.credentials.noteAttempt, {
      email: args.email,
      ok: matched,
      secret: args.secret
    });

    if (!matched) return { ok: false as const, reason: 'mismatch' as const };
    return {
      ok: true as const,
      name: row.name,
      role: row.role,
      createdAt: row.createdAt,
      lastLoginAt: row.lastLoginAt
    };
  }
});

/** Rotate a password (owner console or self-service reset). */
export const rotate = action({
  args: { email: v.string(), password: v.string(), secret: v.string() },
  handler: async (ctx, args) => {
    requireSecret(args.secret);
    const row = await ctx.runQuery(internal.credentials.get, { email: args.email, secret: args.secret });
    if (!row) return { ok: false as const, error: 'No such account.' };

    const salt = base64url(randomBytes(16));
    const hash = derive(args.password, salt, ITERATIONS);
    await ctx.runMutation(internal.credentials.write, {
      email: args.email,
      name: row.name,
      hash,
      salt,
      iterations: ITERATIONS,
      role: row.role,
      secret: args.secret
    });
    return { ok: true as const };
  }
});
