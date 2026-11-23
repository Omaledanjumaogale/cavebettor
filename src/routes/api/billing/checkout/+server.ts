import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * NGN subscription checkout via Paystack.
 * The plan is ₦5,000 per month per seat. Without PAYSTACK_SECRET_KEY the
 * endpoint returns a clearly labelled demo response instead of contacting the
 * provider.
 */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email : 'owner@cavebettor.ng';
  const plan = body?.plan === 'desk' ? 'CaveBettor Trading Desk' : 'CaveBettor Pro';
  const amountNgn = 5000;
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    return json(
      {
        ok: false,
        mode: 'demo',
        message: 'Paystack is not configured. Set PAYSTACK_SECRET_KEY to enable live NGN checkout.',
        plan,
        amountNgn,
        interval: 'month',
        next: 'Configure the key in Settings → Connections, then retry.'
      },
      { status: 503 }
    );
  }

  try {
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: amountNgn * 100,
        currency: 'NGN',
        metadata: { product: 'CaveBettor', plan, seats: 1 },
        callback_url: `${new URL(request.url).origin}/settings?billing=success`
      }),
      signal: AbortSignal.timeout(12_000)
    });
    const data = await res.json();
    if (!res.ok) return json({ ok: false, message: data?.message ?? 'Paystack rejected the request.' }, { status: 502 });
    return json({ ok: true, mode: 'live', plan, amountNgn, authorizationUrl: data?.data?.authorization_url, reference: data?.data?.reference });
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : 'Checkout failed.' }, { status: 502 });
  }
};
