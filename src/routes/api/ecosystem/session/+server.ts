import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * Identity bridge for the hub.
 *
 * Returns the minimum the hub needs to show "signed in to CaveBettor" without
 * exposing the session token: whether there is a session, the display name and
 * the role. No CORS headers are sent on purpose — a browser on another origin
 * cannot read this, while the hub's server-side call can.
 */
export const GET: RequestHandler = ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return json({ platform: 'cavebettor', authenticated: false }, { headers: { 'cache-control': 'no-store' } });
  }
  return json(
    {
      platform: 'cavebettor',
      authenticated: true,
      name: user.name,
      email: user.email,
      role: user.role,
      provider: user.provider,
      sessionExpiresAt: user.exp ?? null
    },
    { headers: { 'cache-control': 'no-store', vary: 'Cookie' } }
  );
};
