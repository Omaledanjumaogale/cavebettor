/**
 * CaveBettor live-sync cron worker.
 *
 * Cloudflare calls scheduled() every 15 minutes. The worker asks the
 * production app to rebuild its deterministic snapshots and push them to
 * Convex. The app's /api/sync route validates the shared secret in constant
 * time, so the secret never appears in a URL or client bundle.
 */
interface Env {
  CAVEBETTOR_SYNC_SECRET: string;
  SYNC_URL?: string;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const url = env.SYNC_URL || 'https://cavebettor.ewinproject.org/api/sync';
    const run = fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cavebettor-sync-secret': env.CAVEBETTOR_SYNC_SECRET
      }
    }).then(async (response) => {
      if (!response.ok) throw new Error(`CaveBettor sync failed with ${response.status}`);
      return response.json();
    });
    ctx.waitUntil(run);
  }
};
