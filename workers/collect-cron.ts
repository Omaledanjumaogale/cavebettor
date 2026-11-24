/**
 * CaveBettor provider-collection worker.
 *
 * Runs every 15 minutes (not on user traffic) and asks the app to refresh the
 * paid provider feeds. The app decides per tick whether to spend on a live
 * sweep or a full window refresh, pacing the API-Football 100/day ceiling
 * across the whole day. The Odds API 250/month and Odd-API 500 credits/month
 * ceilings are enforced by the same ledger right before each outbound call.
 *
 * Each sport is collected from its own request: the free Workers plan caps
 * subrequests per invocation, and a five-sport window refresh needs more than
 * that. One invocation per sport keeps every run comfortably inside the cap.
 */
const SPORTS = ['football', 'basketball', 'icehockey', 'nba', 'baseball'] as const;

interface Env {
  CAVEBETTOR_SYNC_SECRET: string;
  APP_URL?: string;
  COLLECT_URL?: string;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const base = env.APP_URL || 'https://cavebettor.ewinproject.org';
    const url = env.COLLECT_URL || `${base}/api/providers/refresh`;

    const run = (async () => {
      const results: { sport: string; ok: boolean; mode?: string; reason?: string; status?: number }[] = [];
      for (const sport of SPORTS) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-cavebettor-sync-secret': env.CAVEBETTOR_SYNC_SECRET
            },
            body: JSON.stringify({ sport })
          });
          const body = response.ok ? ((await response.json()) as { mode?: string; reason?: string }) : null;
          results.push({ sport, ok: response.ok, mode: body?.mode, reason: body?.reason, status: response.status });
        } catch (error) {
          results.push({ sport, ok: false, reason: String(error) });
        }
      }
      const failed = results.filter((row) => !row.ok);
      if (failed.length) console.warn('CaveBettor collection issues', JSON.stringify(failed));
      return results;
    })();

    ctx.waitUntil(run);
  }
};
