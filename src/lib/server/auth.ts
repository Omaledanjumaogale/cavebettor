import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { ConvexHttpClient } from 'convex/browser';
import type { Cookies } from '@sveltejs/kit';

export type AuthProvider = 'google' | 'github' | 'ewin' | 'password';

export interface SessionUser {
  sid: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'analyst' | 'viewer';
  provider: AuthProvider;
  avatar: string;
  exp: number;
}

const SESSION_COOKIE = 'cb_session';
const OAUTH_COOKIE = 'cb_oauth';
const SESSION_MS = 7 * 86_400_000;

function secret() {
  return (
    privateEnv.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    privateEnv.SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    ''
  );
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

function signed(payload: unknown) {
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function unsign<T>(value: string | undefined): T | null {
  if (!value || !secret()) return null;
  const [body, signature] = value.split('.');
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function avatarFor(name: string, email: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || email.slice(0, 2).toUpperCase();
}

export function sessionFromCookies(cookies: Cookies): SessionUser | null {
  const user = unsign<SessionUser>(cookies.get(SESSION_COOKIE));
  if (!user || user.exp < Date.now() || !user.email) return null;
  return user;
}

export function setSessionCookie(
  cookies: Cookies,
  user: Omit<SessionUser, 'sid' | 'exp' | 'avatar'> & { avatar?: string }
) {
  const session: SessionUser = {
    ...user,
    sid: randomBytes(18).toString('base64url'),
    avatar: user.avatar ?? avatarFor(user.name, user.email),
    exp: Date.now() + SESSION_MS
  };
  cookies.set(SESSION_COOKIE, signed(session), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: (publicEnv.PUBLIC_SITE_URL || '').startsWith('https://'),
    maxAge: SESSION_MS / 1000
  });
  return session;
}

export function clearSessionCookie(cookies: Cookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function oauthStateCookie(cookies: Cookies, provider: string, next: string) {
  const payload = { provider, next, nonce: randomBytes(12).toString('base64url'), exp: Date.now() + 10 * 60_000 };
  cookies.set(OAUTH_COOKIE, signed(payload), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: (publicEnv.PUBLIC_SITE_URL || '').startsWith('https://'),
    maxAge: 600
  });
  return payload;
}

export function readOauthState(cookies: Cookies, provider: string) {
  const payload = unsign<{ provider: string; next: string; nonce: string; exp: number }>(cookies.get(OAUTH_COOKIE));
  cookies.delete(OAUTH_COOKIE, { path: '/' });
  if (!payload || payload.provider !== provider || payload.exp < Date.now()) return null;
  return payload;
}

export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export function adminCredentialsConfigured() {
  return Boolean(
    (privateEnv.SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL) &&
      (privateEnv.SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD) &&
      secret()
  );
}

export function verifyAdminPassword(email: string, password: string) {
  const expectedEmail = (privateEnv.SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || '').toLowerCase();
  const expectedPassword = privateEnv.SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || '';
  if (!expectedEmail || !expectedPassword) return false;
  const emailOk = email.trim().toLowerCase() === expectedEmail;
  const a = Buffer.from(password);
  const b = Buffer.from(expectedPassword);
  const passwordOk = a.length === b.length && timingSafeEqual(a, b);
  return emailOk && passwordOk;
}

export function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

/* Convex session mirror (best effort, never blocks sign-in) */

const convexUrl = publicEnv.PUBLIC_CONVEX_URL || process.env.PUBLIC_CONVEX_URL || '';
const syncSecret = privateEnv.CAVEBETTOR_SYNC_SECRET || process.env.CAVEBETTOR_SYNC_SECRET || '';
let client: ConvexHttpClient | null = null;

function convex() {
  if (!client && convexUrl) client = new ConvexHttpClient(convexUrl);
  return client;
}

async function bestEffort<T>(promise: Promise<T>, ms = 2500): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      })
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function mirrorIdentity(input: { email: string; name: string; provider: string; role?: string }) {
  const c = convex();
  if (!c || !syncSecret) return null;
  return bestEffort(
    c.mutation('auth:upsertExternal' as never, {
      secret: syncSecret,
      email: input.email,
      name: input.name,
      provider: input.provider,
      role: input.role
    } as never)
  ) as Promise<{ userId?: string; role?: string; created?: boolean } | null>;
}

export async function mirrorSession(session: SessionUser, meta: { userAgent?: string; ip?: string; userId?: string }) {
  const c = convex();
  if (!c || !syncSecret) return null;
  return bestEffort(
    c.mutation('auth:recordSession' as never, {
      secret: syncSecret,
      tokenHash: hashToken(session.sid),
      email: session.email,
      name: session.name,
      provider: session.provider,
      role: session.role,
      userId: meta.userId as never,
      userAgent: meta.userAgent?.slice(0, 240),
      ipHash: meta.ip ? hashToken(meta.ip).slice(0, 32) : undefined,
      expiresAt: session.exp
    } as never)
  );
}

export async function revokeMirror(session: SessionUser | null) {
  const c = convex();
  if (!session || !c || !syncSecret) return;
  await bestEffort(c.mutation('auth:revokeSession' as never, { secret: syncSecret, tokenHash: hashToken(session.sid) } as never));
}

/* Provider configuration */

export function providerConfig(provider: 'google' | 'github') {
  if (provider === 'google') {
    const clientId = privateEnv.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = privateEnv.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
    return {
      clientId,
      clientSecret,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile'
    };
  }
  const clientId = privateEnv.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '';
  const clientSecret = privateEnv.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '';
  return {
    clientId,
    clientSecret,
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email'
  };
}

export function providerConfigured(provider: 'google' | 'github') {
  const cfg = providerConfig(provider);
  return Boolean(cfg.clientId && cfg.clientSecret);
}

export interface OAuthProfile {
  email: string;
  name: string;
  avatar?: string;
}

export async function exchangeOAuth(provider: 'google' | 'github', code: string, redirectUri: string): Promise<OAuthProfile | null> {
  const cfg = providerConfig(provider);
  try {
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    if (!tokenRes.ok) return null;
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return null;

    if (provider === 'google') {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { authorization: `Bearer ${token.access_token}` }
      });
      if (!res.ok) return null;
      const p = (await res.json()) as { email?: string; name?: string; picture?: string; email_verified?: boolean };
      if (!p.email || p.email_verified === false) return null;
      return { email: p.email, name: p.name || p.email.split('@')[0], avatar: p.picture };
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        authorization: `Bearer ${token.access_token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'CaveBettor'
      }
    });
    if (!userRes.ok) return null;
    const user = (await userRes.json()) as { login?: string; name?: string; email?: string; avatar_url?: string };
    let email = user.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          authorization: `Bearer ${token.access_token}`,
          accept: 'application/vnd.github+json',
          'user-agent': 'CaveBettor'
        }
      });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[];
        email = emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email;
      }
    }
    if (!email) return null;
    return { email, name: user.name || user.login || email.split('@')[0], avatar: user.avatar_url };
  } catch {
    return null;
  }
}

/** Redeem a short-lived E-WIN SSO ticket at the Hub. */
export async function redeemEwinTicket(ticket: string) {
  const hub = privateEnv.EWIN_CONVEX_SITE_URL || process.env.EWIN_CONVEX_SITE_URL || '';
  if (!hub || !ticket) return null;
  try {
    const res = await fetch(`${hub.replace(/\/$/, '')}/sso/redeem`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1, platformId: 'cavebettor', ticket })
    });
    if (!res.ok) return null;
    return (await res.json()) as { subject: string; email: string; name: string; handle?: string; platformId: string };
  } catch {
    return null;
  }
}
