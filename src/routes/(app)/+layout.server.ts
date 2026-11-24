import { wireCounts } from '#lib/server/feed';
import { DEMO_USER, SUBSCRIPTION_PLANS } from '#lib/data/catalog';
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
          role: locals.user.role === 'super_admin' ? 'owner' : locals.user.role,
          provider: locals.user.provider,
          plan: SUBSCRIPTION_PLANS[1]
        }
      : DEMO_USER
  };
};
