import { redirect } from '@sveltejs/kit';
import { providerConfigured, safeNext } from '#lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
  const errorCode = url.searchParams.get('error') ?? '';
  const messages: Record<string, string> = {
    google_not_configured: 'Google sign-in is not configured on this deployment yet.',
    github_not_configured: 'GitHub sign-in is not configured on this deployment yet.',
    google_cancelled: 'Google sign-in was cancelled.',
    github_cancelled: 'GitHub sign-in was cancelled.',
    google_failed: 'Google could not verify that account. Try again.',
    github_failed: 'GitHub could not verify that account. Try again.',
    ewin_failed: 'E-WIN could not verify that sign-in ticket. Start again from the Hub.'
  };
  return {
    next: safeNext(url.searchParams.get('next')),
    providers: {
      google: providerConfigured('google'),
      github: providerConfigured('github')
    },
    error: messages[errorCode] ?? (errorCode ? 'Sign-in did not complete. Try again.' : '')
  };
};
