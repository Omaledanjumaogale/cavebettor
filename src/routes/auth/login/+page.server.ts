import { fail, redirect } from '@sveltejs/kit';
import {
  adminCredentialsConfigured,
  mirrorIdentity,
  mirrorSession,
  providerConfigured,
  safeNext,
  setSessionCookie,
  verifyAdminPassword
} from '#lib/server/auth';
import { clearFailures, normaliseEmail, noteFailure, tooManyFailures, verifyAccount } from '#lib/server/accounts';
import type { Actions, PageServerLoad } from './$types';

const messages: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured on this deployment yet.',
  github_not_configured: 'GitHub sign-in is not configured on this deployment yet.',
  google_cancelled: 'Google sign-in was cancelled.',
  github_cancelled: 'GitHub sign-in was cancelled.',
  google_failed: 'Google could not verify that account. Try again.',
  github_failed: 'GitHub could not verify that account. Try again.',
  ewin_failed: 'E-WIN could not verify that sign-in ticket. Start again from the Hub.',
  signed_out: 'You have been signed out.',
  registered: 'Account created. Sign in with your email and password.'
};

export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
  const errorCode = url.searchParams.get('error') ?? '';
  return {
    next: safeNext(url.searchParams.get('next')),
    providers: {
      google: providerConfigured('google'),
      github: providerConfigured('github')
    },
    adminConfigured: adminCredentialsConfigured(),
    email: url.searchParams.get('email') ?? '',
    error: messages[errorCode] ?? (errorCode ? 'Sign-in did not complete. Try again.' : '')
  };
};

export const actions: Actions = {
  /** Email + password sign-in, including the owner (super-admin) account. */
  default: async ({ request, cookies, url }) => {
    const form = await request.formData();
    const email = normaliseEmail(String(form.get('email') ?? ''));
    const password = String(form.get('password') ?? '');
    const next = safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? '/dashboard'));

    if (!email || !password) {
      return fail(400, { email, error: 'Enter your email address and password.' });
    }

    if (verifyAdminPassword(email, password)) {
      const session = setSessionCookie(cookies, {
        email,
        name: 'Workspace owner',
        role: 'super_admin',
        provider: 'password'
      });
      await mirrorSession(session, { userAgent: request.headers.get('user-agent') ?? undefined });
      redirect(303, next === '/dashboard' ? '/admin' : next);
    }

    if (await tooManyFailures(email)) {
      return fail(429, { email, error: 'Too many attempts. Wait 15 minutes and try again.' });
    }

    const account = await verifyAccount(email, password);
    if (!account) {
      await noteFailure(email);
      // Give a generic answer so the form cannot be used to enumerate accounts.
      return fail(400, { email, error: 'That email and password combination did not match.' });
    }

    await clearFailures(email);
    const session = setSessionCookie(cookies, {
      email: account.email,
      name: account.name,
      role: account.role,
      provider: 'password'
    });
    const mirrored = await mirrorIdentity({ email: account.email, name: account.name, provider: 'password' });
    await mirrorSession(session, {
      userAgent: request.headers.get('user-agent') ?? undefined,
      userId: mirrored?.userId
    });
    redirect(303, next);
  }
};
