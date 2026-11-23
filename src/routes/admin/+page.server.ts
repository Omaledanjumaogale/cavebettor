import { redirect } from '@sveltejs/kit';
import { DATA_SOURCES, MODELS } from '#lib/data/catalog';
import { getMetrics, getScrapeJobs, getTrainingRuns } from '#lib/engine/analytics';
import { convexAdminOverview, syncLiveData } from '#lib/server/live';
import { providerConfigured } from '#lib/server/auth';
import { env as privateEnv } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user || locals.user.role !== 'super_admin') redirect(303, '/auth/admin?next=/admin');
  const overview: any = await convexAdminOverview();
  const metrics = getMetrics();
  const users = [
    { name: 'Omale Danjuma', email: 'omale@cavebettor.ng', plan: 'Pro', status: 'active', workspace: 'Lagos Value Desk', joined: '2025-08-14', apiCalls: 18420 },
    { name: 'Amara Eze', email: 'amara@cavebettor.ng', plan: 'Trading Desk', status: 'active', workspace: 'Lagos Value Desk', joined: '2025-09-02', apiCalls: 9120 },
    { name: 'Tunde Balogun', email: 'tunde@cavebettor.ng', plan: 'Pro', status: 'active', workspace: 'Abuja Analytics', joined: '2025-10-11', apiCalls: 6420 },
    { name: 'Chidi Okonkwo', email: 'chidi@example.ng', plan: 'Pro', status: 'trialing', workspace: 'Port Harcourt Desk', joined: '2026-01-22', apiCalls: 2140 },
    { name: 'Fatima Bello', email: 'fatima@example.ng', plan: 'Starter', status: 'active', workspace: 'Kano Research', joined: '2026-02-03', apiCalls: 182 },
    { name: 'Kwame Mensah', email: 'kwame@example.gh', plan: 'Pro', status: 'past_due', workspace: 'Accra Value', joined: '2025-12-08', apiCalls: 3210 },
    { name: 'Zainab Musa', email: 'zainab@example.ng', plan: 'Trading Desk', status: 'active', workspace: 'Lagos Syndicate', joined: '2025-11-19', apiCalls: 24800 },
    { name: 'Segun Adeyemi', email: 'segun@example.ng', plan: 'Pro', status: 'cancelled', workspace: 'Ibadan Quant', joined: '2025-07-01', apiCalls: 440 }
  ];

  const liveUsers = overview?.users?.map((u: any) => ({
    name: u.name,
    email: u.email,
    plan: u.role === 'super_admin' ? 'Owner' : 'Pro',
    status: 'active',
    workspace: u.workspace,
    joined: new Date(u.createdAt).toISOString().slice(0, 10),
    apiCalls: 0
  }));
  const site = privateEnv.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://cavebettor.ewinproject.org';
  const integrations = [
    { id: 'google', label: 'Google OAuth', detail: 'OpenID · email · profile', status: providerConfigured('google') ? 'Configured' : 'Missing keys', callback: `${site}/auth/google/callback` },
    { id: 'github', label: 'GitHub OAuth', detail: 'read:user · user:email', status: providerConfigured('github') ? 'Configured' : 'Missing keys', callback: `${site}/auth/github/callback` },
    { id: 'ewin', label: 'E-WIN Hub SSO', detail: 'Single-use signed ticket', status: privateEnv.EWIN_CONVEX_SITE_URL ? 'Configured' : 'Missing keys', callback: `${site}/auth/ewin/callback` },
    { id: 'agnes', label: 'Agnes AI', detail: privateEnv.AGNES_MODEL || 'agnes-3.0-flash', status: privateEnv.AGNES_AI_KEY ? 'Live' : 'Missing key', callback: null },
    { id: 'convex', label: 'Convex live sync', detail: 'Snapshots with local fallback', status: overview ? 'Live' : 'Fallback', callback: null },
    { id: 'resend', label: 'Resend email', detail: privateEnv.RESEND_FROM_EMAIL || 'Not configured', status: privateEnv.RESEND_API_KEY ? 'Configured' : 'Missing key', callback: null }
  ];
  return {
    adminUser: locals.user,
    integrations,
    live: overview,
    metrics,
    users: liveUsers?.length ? liveUsers : users,
    revenue: [
      { month: 'Sep', mrr: 286_000, subscribers: 61, churn: 2.1 },
      { month: 'Oct', mrr: 334_000, subscribers: 72, churn: 1.8 },
      { month: 'Nov', mrr: 361_000, subscribers: 78, churn: 2.4 },
      { month: 'Dec', mrr: 412_000, subscribers: 88, churn: 1.5 },
      { month: 'Jan', mrr: 478_000, subscribers: 101, churn: 1.9 },
      { month: 'Feb', mrr: 524_000, subscribers: 112, churn: 1.2 }
    ],
    audit: [
      { actor: 'system', action: 'Promoted CaveBoost v5.1.2 to production', detail: 'Walk-forward ROI +6.2% over 8 windows', time: new Date(Date.now() - 42 * 60e3).toISOString() },
      { actor: 'omale@cavebettor.ng', action: 'Rotated API token', detail: 'cbt_live_••••2f8a', time: new Date(Date.now() - 3.2 * 3600e3).toISOString() },
      { actor: 'scheduler', action: 'Nightly retraining completed', detail: '5 models · 128,400 rows', time: new Date(Date.now() - 8.4 * 3600e3).toISOString() },
      { actor: 'amara@cavebettor.ng', action: 'Updated staking preference', detail: 'Half Kelly → Quarter Kelly', time: new Date(Date.now() - 22 * 3600e3).toISOString() },
      { actor: 'system', action: 'Rollback guard triggered', detail: 'Sequence model drift 4.4% — held in shadow mode', time: new Date(Date.now() - 2.1 * 864e5).toISOString() },
      { actor: 'paystack', action: 'Subscription payment received', detail: '₦5,000 · Lagos Value Desk', time: new Date(Date.now() - 2.6 * 864e5).toISOString() }
    ],
    sources: DATA_SOURCES.map((s) => ({ id: s.id, name: s.name, status: s.status, coverage: s.coverage, reliability: s.reliability })),
    jobs: getScrapeJobs().slice(0, 8),
    runs: getTrainingRuns().slice(0, 5),
    models: MODELS.filter((m) => m.status === 'production').map((m) => ({ id: m.id, name: m.name, accuracy: m.accuracy, roi: m.roi, drift: m.drift }))
  };
};


export const actions: Actions = {
  sync: async ({ locals }) => {
    if (!locals.user || locals.user.role !== 'super_admin') return { ok: false, message: 'Owner access required.' };
    try {
      const result = await syncLiveData();
      return { ok: true, message: `Synced ${result.fixtures} fixtures, ${result.predictions} predictions and ${result.valueSelections} value selections.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Sync failed.' };
    }
  }
};
