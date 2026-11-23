import { redirect } from '@sveltejs/kit';
import { providerConfig, providerConfigured, oauthStateCookie, safeNext } from '#lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url, cookies }) => {
  const provider = params.provider;
  if (provider !== 'google' && provider !== 'github') redirect(303, '/auth/login');
  if (!providerConfigured(provider)) redirect(303, `/auth/login?error=${provider}_not_configured`);
  const cfg = providerConfig(provider);
  const next = safeNext(url.searchParams.get('next'));
  const state = oauthStateCookie(cookies, provider, next);
  const authorize = new URL(cfg.authorizeUrl);
  authorize.searchParams.set('client_id', cfg.clientId);
  authorize.searchParams.set('redirect_uri', `${url.origin}/auth/${provider}/callback`);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', cfg.scope);
  authorize.searchParams.set('state', state.nonce);
  if (provider === 'google') {
    authorize.searchParams.set('access_type', 'online');
    authorize.searchParams.set('prompt', 'select_account');
  }
  redirect(302, authorize.toString());
};
