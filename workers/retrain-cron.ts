/**
 * CaveBettor nightly retraining worker.
 *
 * Cloudflare calls scheduled() at 03:00 UTC, which is 04:00 Africa/Lagos.
 * The worker asks the app to run the nightly evaluation: it collects the
 * retained results, evaluates candidate models chronologically over
 * walk-forward windows and keeps the current champion unless a candidate
 * passes every improvement check.
 *
 * The run uses stored results and existing historical exports only — it never
 * consumes a paid sports or odds request.
 */
interface Env {
  CAVEBETTOR_SYNC_SECRET: string;
  APP_URL?: string;
  RETRAIN_URL?: string;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const base = env.APP_URL || 'https://cavebettor.ewinproject.org';
    const url = env.RETRAIN_URL || `${base}/api/models/retrain`;
    const run = fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-cavebettor-sync-secret': env.CAVEBETTOR_SYNC_SECRET
      }
    }).then(async (response) => {
      if (!response.ok) throw new Error(`CaveBettor retrain failed with ${response.status}`);
      return response.json();
    });
    ctx.waitUntil(run);
  }
};
