import { fail, redirect } from '@sveltejs/kit';
import { mirrorIdentity, mirrorSession, providerConfigured, safeNext, setSessionCookie } from '#lib/server/auth';
import { createAccount, normaliseEmail, passwordProblem, validEmail } from '#lib/server/accounts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.user) redirect(303, '/dashboard');
  return {
    next: safeNext(url.searchParams.get('next')),
    providers: {
      google: providerConfigured('google'),
      github: providerConfigured('github')
    }
  };
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim();
    const email = normaliseEmail(String(form.get('email') ?? ''));
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    const next = safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? '/dashboard'));

    if (!validEmail(email)) return fail(400, { name, email, error: 'Enter a valid email address.' });
    const problem = passwordProblem(password);
    if (problem) return fail(400, { name, email, error: problem });
    if (password !== confirm) return fail(400, { name, email, error: 'The two passwords do not match.' });

    const created = await createAccount({ name, email, password });
    if (!created.ok) return fail(400, { name, email, error: created.error });

    const session = setSessionCookie(cookies, {
      email: created.account.email,
      name: created.account.name,
      role: created.account.role,
      provider: 'password'
    });
    const mirrored = await mirrorIdentity({ email: created.account.email, name: created.account.name, provider: 'password' });
    await mirrorSession(session, {
      userAgent: request.headers.get('user-agent') ?? undefined,
      userId: mirrored?.userId
    });

    redirect(303, next);
  }
};
