import { redirect, error } from '@sveltejs/kit';
import {
  mirrorIdentity,
  mirrorSession,
  redeemEwinTicket,
  setSessionCookie,
  type SessionUser
} from '#lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, request }) => {
  const ticket = url.searchParams.get('ewin_ticket') ?? url.searchParams.get('ticket');
  if (!ticket) error(400, 'Missing E-WIN sign-in ticket.');
  const audience = url.searchParams.get('ewin_platform');
  if (audience && audience !== 'cavebettor') error(400, 'This ticket belongs to another E-WIN application.');
  const identity = await redeemEwinTicket(ticket);
  if (!identity) redirect(303, '/auth/login?error=ewin_failed');
  const mirrored = await mirrorIdentity({
    email: identity.email,
    name: identity.name,
    provider: 'ewin'
  });
  const role = (mirrored?.role as SessionUser['role'] | undefined) ?? 'analyst';
  const session = setSessionCookie(cookies, {
    email: identity.email,
    name: identity.name,
    role,
    provider: 'ewin'
  });
  await mirrorSession(session, {
    userAgent: request.headers.get('user-agent') ?? undefined,
    userId: mirrored?.userId,
    ip: request.headers.get('cf-connecting-ip') ?? undefined
  });
  redirect(303, '/dashboard');
};
