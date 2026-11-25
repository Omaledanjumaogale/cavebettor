import { wireCounts } from '#lib/server/feed';
import { env as privateEnv } from '$env/dynamic/private';
import { ECOSYSTEM, hubUrl } from '#lib/ecosystem';
import { DEMO_USER, SUBSCRIPTION_PLANS } from '#lib/data/catalog';

/** The super admin never pays: full platform and admin console, free forever. */
const OWNER_PLAN = SUBSCRIPTION_PLANS.find((plan) => plan.id === 'owner') ?? SUBSCRIPTION_PLANS[1];
import type { LayoutServerLoad } from './$types';

/**
 * Shell counts.
 *
 * These come from the collected feed in the isolate memo, so the navigation
 * badge numbers are the real ones and no Convex query, R2 read or provider
 * call happens on a page view.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
  const counts = await wireCounts().catch(() => ({ fixtures: 0, live: 0, upcoming: 0, competitions: 0, sports: 0, updatedAt: null }));

  return {
    counts: {
      live: counts.live,
      upcoming: counts.upcoming,
      fixtures: counts.fixtures,
      competitions: counts.competitions,
      sports: counts.sports,
      updatedAt: counts.updatedAt
    },
    user: locals.user
      ? {
          ...DEMO_USER,
          name: locals.user.name,
          email: locals.user.email,
          avatar: locals.user.avatar,
          role: locals.user.role,
          provider: locals.user.provider,
          plan: locals.user.role === 'super_admin' ? OWNER_PLAN : SUBSCRIPTION_PLANS[1],
          planStatus: 'active',
          renewsAt: null,
          isSuperAdmin: locals.user.role === 'super_admin'
        }
      : DEMO_USER,
    // The shell needs the hub link and the app id; both are public.
    ecosystem: {
      appId: ECOSYSTEM.id,
      hubUrl: hubUrl(privateEnv.EWIN_SITE_URL),
      sso: Boolean(privateEnv.EWIN_CONVEX_SITE_URL || process.env.EWIN_CONVEX_SITE_URL),
      descriptor: '/.well-known/ewin-app.json'
    }
  };
};
