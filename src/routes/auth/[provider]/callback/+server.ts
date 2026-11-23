import { redirect, error } from '@sveltejs/kit';
import {
  exchangeOAuth,
  mirrorIdentity,
  mirrorSession,
  readOauthState,
  setSessionCookie,
  type SessionUser
} from '#lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, cookies, request }) => {
  const provider = params.provider;
  if (provider !== 'google' && provider !== 'github') error(404, 'Unknown provider');
  const state = readOauthState(cookies, provider);
  if (!state || state.nonce !== url.searchParams.get('state')) error(400, 'Sign-in state expired. Start again.');
  const code = url.searchParams.get('code');
  if (!code) redirect(303, `/auth/login?error=${provider}_cancelled`);

  const profile = await exchangeOAuth(provider, code, `${url.origin}/auth/${provider}/callback`);
  if (!profile) redirect(303, `/auth/login?error=${provider}_failed`);

  const identity = await mirrorIdentity({ email: profile.email, name: profile.name, provider });
  const role = (identity?.role as SessionUser['role'] | undefined) ?? 'analyst';
  const session = setSessionCookie(cookies, {
    email: profile.email,
    name: profile.name,
    role,
    provider,
    avatar: profile.avatar
  });
  await mirrorSession(session, {
    userAgent: request.headers.get('user-agent') ?? undefined,
    ip:
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      undefined,
    userId: identity?.userId
  });
  redirect(303, state.next);
};
