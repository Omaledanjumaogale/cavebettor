import { redirect } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const hub = privateEnv.EWIN_SITE_URL || process.env.EWIN_SITE_URL || 'https://ewinproject.org';
  const back = `${url.origin}/auth/ewin/callback`;
  redirect(302, `${hub.replace(/\/$/, '')}/api/sso/start?platform=cavebettor&return=${encodeURIComponent(back)}`);
};
