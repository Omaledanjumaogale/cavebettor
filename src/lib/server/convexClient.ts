import { env as publicEnv } from '$env/dynamic/public';
import { ConvexHttpClient } from 'convex/browser';

/**
 * Shared Convex HTTP client.
 *
 * The Convex deployment stays a thin control plane: accounts, entitlements,
 * budget counters and small metadata records. Bulk payloads (fixtures, odds,
 * training archives) live in Cloudflare R2 and are served from there.
 */

const url = publicEnv.PUBLIC_CONVEX_URL || process.env.PUBLIC_CONVEX_URL || '';
const demoMode = (publicEnv.PUBLIC_DEMO_MODE || process.env.PUBLIC_DEMO_MODE || 'false') === 'true';

let client: ConvexHttpClient | null = null;

export function convexConfigured(): boolean {
  return Boolean(url) && !demoMode;
}

export function convexClient(): ConvexHttpClient {
  if (!client) {
    if (!convexConfigured()) throw new Error('Convex is not configured.');
    client = new ConvexHttpClient(url);
  }
  return client;
}

/** Run a Convex call with a hard timeout so a slow backend never blocks a page. */
export async function withTimeout<T>(promise: Promise<T>, ms = 2600): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Convex request timed out')), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
