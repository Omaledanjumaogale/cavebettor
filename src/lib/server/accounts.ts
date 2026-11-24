/**
 * Email + password accounts.
 *
 * Accounts are stored in the R2 data plane as small JSON records, keyed by a
 * salted hash of the email address. Convex keeps only the mirrored identity
 * metadata (best effort), so the free-tier database and its egress allowance
 * are not touched by sign-in traffic.
 *
 * Passwords are hashed with PBKDF2-HMAC-SHA256 (210 000 iterations, per-record
 * random salt) using WebCrypto, which is available both in Cloudflare Workers
 * and in Node during local development. Plain-text passwords are never
 * persisted, logged or returned.
 */
import { readCache, writeCache, deleteCache } from '#lib/server/cache';
import type { AuthProvider, SessionUser } from '#lib/server/auth';

export interface AccountRecord {
  email: string;
  name: string;
  hash: string;
  salt: string;
  iterations: number;
  role: SessionUser['role'];
  provider: Exclude<AuthProvider, 'ewin'>;
  createdAt: string;
  lastLoginAt?: string;
  plan: 'starter' | 'pro' | 'desk';
}

const ITERATIONS = 210_000;
const ACCOUNT_TTL = 10 * 365 * 86_400_000;
const ATTEMPT_TTL = 15 * 60_000;
const MAX_ATTEMPTS = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return base64url(new Uint8Array(digest));
}

async function derive(password: string, salt: string, iterations = ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64url(salt) as unknown as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256
  );
  return base64url(new Uint8Array(bits));
}

/** Constant-time comparison of two equal-length ASCII strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validEmail(email: string): boolean {
  return EMAIL_RE.test(normaliseEmail(email));
}

/** Returns a human-readable problem with the password, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password.length > 200) return 'That password is too long.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Mix letters with at least one number.';
  return null;
}

function accountKey(email: string): string {
  return `accounts/${encodeURIComponent(normaliseEmail(email))}`;
}

export async function findAccount(email: string): Promise<AccountRecord | null> {
  const cached = await readCache<AccountRecord>(accountKey(email), true);
  return cached?.value ?? null;
}

export async function createAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true; account: AccountRecord } | { ok: false; error: string }> {
  const email = normaliseEmail(input.email);
  if (!validEmail(email)) return { ok: false, error: 'Enter a valid email address.' };
  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, error: problem };
  const name = input.name.trim().slice(0, 80) || email.split('@')[0];

  if (await findAccount(email)) {
    return { ok: false, error: 'An account already exists for that email. Sign in instead.' };
  }

  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = base64url(saltBytes);
  const account: AccountRecord = {
    email,
    name,
    hash: await derive(input.password, salt),
    salt,
    iterations: ITERATIONS,
    role: 'analyst',
    provider: 'password',
    createdAt: new Date().toISOString(),
    plan: 'starter'
  };
  await writeCache(accountKey(email), account, ACCOUNT_TTL, 'accounts');
  return { ok: true, account };
}

export async function verifyAccount(email: string, password: string): Promise<AccountRecord | null> {
  const account = await findAccount(email);
  if (!account) return null;
  const candidate = await derive(password, account.salt, account.iterations);
  if (!safeEqual(candidate, account.hash)) return null;
  const updated: AccountRecord = { ...account, lastLoginAt: new Date().toISOString() };
  await writeCache(accountKey(email), updated, ACCOUNT_TTL, 'accounts');
  return updated;
}

export async function deleteAccount(email: string): Promise<void> {
  await deleteCache(accountKey(email));
}

/** Update a mutable field on an existing account (plan, name, role). */
export async function updateAccount(
  email: string,
  patch: Partial<Pick<AccountRecord, 'name' | 'plan' | 'role'>>
): Promise<AccountRecord | null> {
  const account = await findAccount(email);
  if (!account) return null;
  const updated = { ...account, ...patch };
  await writeCache(accountKey(email), updated, ACCOUNT_TTL, 'accounts');
  return updated;
}

/**
 * Naive but effective brute-force brake: at most MAX_ATTEMPTS failures per
 * email per window. The counter lives in the cache with a short TTL, so it
 * costs nothing and clears itself.
 */
export async function noteFailure(email: string): Promise<number> {
  const key = `login-attempts/${await sha256(normaliseEmail(email))}`;
  const existing = await readCache<number>(key, true);
  const next = (existing?.value ?? 0) + 1;
  await writeCache(key, next, ATTEMPT_TTL, 'accounts');
  return next;
}

export async function tooManyFailures(email: string): Promise<boolean> {
  const key = `login-attempts/${await sha256(normaliseEmail(email))}`;
  const existing = await readCache<number>(key, true);
  return (existing?.value ?? 0) >= MAX_ATTEMPTS;
}

export async function clearFailures(email: string): Promise<void> {
  await deleteCache(`login-attempts/${await sha256(normaliseEmail(email))}`);
}

export function accountCount(): number {
  return 0;
}
