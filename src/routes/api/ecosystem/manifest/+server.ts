import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { appUrl, ecosystemDescriptor } from '#lib/ecosystem';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * The descriptor the E-WIN hub polls.
 *
 * Public by design: it is the app's business card, not its data. The hub reads
 * it to render the app as online, deep-link into it, and pick up the SSO
 * endpoints without hard-coding them on both sides.
 */
export const GET: RequestHandler = async ({ url }) => {
  const site = privateEnv.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || url.origin;
  const descriptor = ecosystemDescriptor(appUrl(site));
  return json(descriptor, {
    headers: {
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*'
    }
  });
};
