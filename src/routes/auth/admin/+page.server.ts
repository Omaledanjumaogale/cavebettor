import { fail, redirect } from '@sveltejs/kit';
import {
  adminCredentialsConfigured,
  mirrorIdentity,
  mirrorSession,
  safeNext,
  setSessionCookie,
  verifyAdminPassword
} from '#lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.user?.role === 'super_admin') redirect(303, safeNext(url.searchParams.get('next')) === '/' ? '/admin' : safeNext(url.searchParams.get('next')));
  return { configured: adminCredentialsConfigured(), next: safeNext(url.searchParams.get('next')) };
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const next = safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? '/admin'));
    if (!adminCredentialsConfigured()) return fail(503, { error: 'Admin credentials are not configured on this deployment.' });
    if (!verifyAdminPassword(email, password)) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return fail(401, { error: 'Email or password is incorrect.', email });
    }
    const identity = await mirrorIdentity({ email, name: 'Super Admin', provider: 'password', role: 'super_admin' });
    const session = setSessionCookie(cookies, {
      email,
      name: 'Super Admin',
      role: 'super_admin',
      provider: 'password'
    });
    await mirrorSession(session, { userId: identity?.userId, userAgent: request.headers.get('user-agent') ?? undefined });
    redirect(303, next);
  }
};
