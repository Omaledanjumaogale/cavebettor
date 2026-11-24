import type { Handle } from '@sveltejs/kit';
import { sessionFromCookies } from '#lib/server/auth';
import { registerCacheEnv } from '#lib/server/cache';

/**
 * Request hook.
 *
 * Provider collection deliberately does NOT happen here. Running a budgeted
 * collection inside a page request burned the isolate's CPU allowance and
 * turned ordinary navigation into 503s, so collection is owned exclusively by
 * the scheduled worker (`workers/collect-cron.ts` → /api/providers/refresh).
 * A page render now costs one in-isolate memo read, not a provider call.
 */
export const handle: Handle = async ({ event, resolve }) => {
  event.locals.user = sessionFromCookies(event.cookies);

  // Bind the Cloudflare R2 bucket (bulk data plane) for this request when
  // running on Workers/Pages. Pre-rendered routes expose no platform bindings —
  // the adapter throws for any platform.env access there, so it is guarded.
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
