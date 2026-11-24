/**
 * CaveBettor provider-collection worker.
 *
 * Runs a few times a day (not on user traffic) and asks the app to refresh
 * the paid provider feeds. The app checks the budget ledger before every
 * outbound call, so the API-Football 100/day ceiling, The Odds API
 * 250/month ceiling and Odd-API 500 credits/month ceiling are respected.
 *
 * Fixtures are written to the R2 data plane, not to Convex.
 */
interface Env {
  CAVEBETTOR_SYNC_SECRET: string;
  APP_URL?: string;
  COLLECT_URL?: string;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const base = env.APP_URL || 'https://cavebettor.ewinproject.org';
    const url = env.COLLECT_URL || `${base}/api/providers/refresh`;
    const run = fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cavebettor-sync-secret': env.CAVEBETTOR_SYNC_SECRET
      }
    }).then(async (response) => {
      if (!response.ok) throw new Error(`CaveBettor provider collection failed with ${response.status}`);
      return response.json();
    });
    ctx.waitUntil(run);
  }
};
