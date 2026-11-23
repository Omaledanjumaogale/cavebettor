import { getDashboard } from '#lib/engine/analytics';
import { readSnapshot } from '#lib/server/live';
import { DEMO_USER, SUBSCRIPTION_PLANS } from '#lib/data/catalog';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const dashboard = getDashboard();
  const snap = await readSnapshot<{ counts: { live: number; upcoming: number; valueBets: number; fixtures: number } }>('dashboard');
  const counts = snap?.counts ?? dashboard.counts;
  return {
    counts: {
      live: counts.live,
      upcoming: counts.upcoming,
      value: counts.valueBets,
      fixtures: counts.fixtures
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
