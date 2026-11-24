/**
 * Vitest setup — runs before every test file.
 *
 * Tests must never reach a real backend: the budget ledger, the feed and the
 * auth store all prefer Convex/R2 when the environment advertises them, which
 * would make the suite slow, flaky and able to spend real provider allowance.
 */
export const isolate = true;

delete process.env.PUBLIC_CONVEX_URL;
delete process.env.PUBLIC_CONVEX_SITE_URL;
delete process.env.CONVEX_DEPLOY_KEY;
delete process.env.CONVEX_HTTP_ACTIONS_URL;
delete process.env.R2_ENDPOINT;
delete process.env.CAVEBETTOR_SYNC_SECRET;
delete process.env.API_FOOTBALL_KEY;
delete process.env.THE_ODDS_API_KEY;
delete process.env.ODD_API_KEY;
