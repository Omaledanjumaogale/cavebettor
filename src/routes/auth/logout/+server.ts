import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, revokeMirror, sessionFromCookies } from '#lib/server/auth';
import type { RequestHandler } from './$types';

const logout: RequestHandler = async ({ cookies }) => {
  await revokeMirror(sessionFromCookies(cookies));
  clearSessionCookie(cookies);
  redirect(303, '/auth/login');
};

export const GET = logout;
export const POST = logout;
