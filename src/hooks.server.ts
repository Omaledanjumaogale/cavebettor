import type { Handle } from '@sveltejs/kit';
import { sessionFromCookies } from '#lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = sessionFromCookies(event.cookies);
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  return response;
};
