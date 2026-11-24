import type { Handle } from '@sveltejs/kit';
import { sessionFromCookies } from '#lib/server/auth';
import { registerCacheEnv } from '#lib/server/cache';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = sessionFromCookies(event.cookies);

  // Bind the Cloudflare R2 bucket (bulk data plane) for this request when
  // running on Workers/Pages. Cached provider payloads live there so the
  // Convex database and its egress allowances are not touched on reads.
  // Pre-rendered routes expose no platform bindings — the adapter throws for
  // any platform.env access there, so the lookup is guarded.
  try {
    const platform = (event as unknown as { platform?: { env?: Record<string, unknown> } }).platform;
    const env = platform?.env;
    if (env) {
      const bucket = env.CAVEBETTOR_DATA ?? env.DATA ?? env.R2_BUCKET;
      if (bucket) registerCacheEnv({ R2: bucket as never });
    }
  } catch {
    /* pre-rendered route — no Cloudflare bindings available */
  }

  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  return response;
};
