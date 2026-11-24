<script lang="ts">
  import { Sparkles, Check, X, ArrowUpRight, ShieldCheck, Zap, Building2, CircleHelp, ChevronDown } from '@lucide/svelte';
  import { SUBSCRIPTION_PLANS } from '#lib/data/catalog';
  import { fmtNgn } from '#lib/engine/core';

  let { data } = $props();
  let annual = $state(false);
  let loading = $state(false);
  let message = $state('');
  let openFaq = $state<number | null>(0);

  const price = (ngn: number) => (annual ? ngn * 10 : ngn);

  async function checkout(planId: string) {
    if (planId === 'starter') {
      message = 'Starter is free. Create a workspace to begin exploring.';
      return;
    }
    loading = true;
    message = '';
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'owner@cavebettor.ng', plan: planId })
      });
      const body = await res.json();
      message = body.message ?? (res.ok ? 'Checkout ready.' : 'Checkout unavailable.');
      if (body.authorizationUrl) window.location.href = body.authorizationUrl;
    } catch {
      message = 'Could not reach the billing endpoint.';
    } finally {
      loading = false;
    }
  }

  const featureRows = [
    { label: 'Fixtures and public probabilities', starter: true, pro: true, desk: true },
    { label: 'Leagues tracked', starter: '3', pro: '20', desk: '20' },
    { label: 'Markets per fixture', starter: '1X2', pro: 'All 84', desk: 'All 84' },
    { label: 'Value board and Kelly staking', starter: false, pro: true, desk: true },
    { label: 'Live in-play probabilities', starter: false, pro: true, desk: true },
    { label: 'Odds comparison (8 books)', starter: 'Basic', pro: 'Full', desk: 'Full' },
    { label: 'Model lab and self-training', starter: false, pro: true, desk: true },
    { label: 'LLM match analyst', starter: '3 / month', pro: '1,000 / month', desk: '5,000 / month' },
    { label: 'Data pipeline console', starter: false, pro: true, desk: true },
    { label: 'API access', starter: '250 calls', pro: '25,000 calls', desk: '100,000 calls' },
    { label: 'Shared workspace and seats', starter: '1 seat', pro: '1 seat', desk: '5 seats' },
    { label: 'Webhooks and CSV export', starter: false, pro: true, desk: true },
    { label: 'Role-based access and audit log', starter: false, pro: false, desk: true },
    { label: 'Priority data-source slots', starter: false, pro: false, desk: true }
  ];

  const faqs = [
    { q: 'Is CaveBettor a betting platform?', a: 'No. It is research software. You cannot deposit money, place a bet, or open a wallet. CaveBettor generates probabilities, compares market prices and records paper selections so you can evaluate the model.' },
    { q: 'Why ₦5,000 per month?', a: 'One price unlocks every feature: all sports, all leagues, all markets, live probabilities, the model lab, the data pipeline and the analyst. Trading Desk adds five seats and collaboration for the same ₦5,000 per seat.' },
    { q: 'Do you guarantee winnings?', a: 'No, and any product that does is lying. Probabilities are estimates. Variance is real. CaveBettor publishes its calibration, ROI, yield and drawdown — including losing months — so you can judge the process.' },
    { q: 'Where does the data come from?', a: 'Public fixture and team data, licensed sports APIs when you supply keys, and permission-aware collectors. Each source has a health status and a coverage score in the pipeline console. Live scraping is opt-in.' },
    { q: 'Can I use it from outside Nigeria?', a: 'Yes. The interface is global, but the primary currency is the Nigerian Naira and the commercial plan is priced in NGN. You can change the display currency in Settings.' },
    { q: 'What happens if I cancel?', a: 'You keep access until the end of the paid month. Your notes and paper ledger remain exportable as JSON for 30 days.' }
  ];
</script>

<svelte:head><title>Pricing — CaveBettor</title></svelte:head>

<div class="space-y-8">
  <div class="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-pitch-800/60 to-pitch-950/60 px-5 py-10 text-center sm:px-10">
    <div class="mesh pointer-events-none absolute inset-0 opacity-40"></div>
    <div class="pointer-events-none absolute left-1/2 top-0 h-64 w-[560px] -translate-x-1/2 rounded-full bg-lime/10 blur-3xl"></div>
    <div class="relative mx-auto max-w-2xl">
      <span class="chip chip-lime"><Sparkles size={10} /> Simple, Naira-first pricing</span>
      <h1 class="display mt-4 text-[30px] font-bold leading-tight tracking-tight text-white sm:text-[38px]">One subscription.<br /><span class="text-gradient">Every market, every model.</span></h1>
      <p class="mx-auto mt-3 max-w-xl text-[12.5px] leading-relaxed text-fog">
        ₦5,000 per month unlocks the entire CaveBettor workspace. No per-market fees, no odds markup, no betting wallet. Cancel anytime.
      </p>
      <div class="mt-5 inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
        <button onclick={() => (annual = false)} class={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${!annual ? 'bg-white/10 text-white' : 'text-fog'}`}>Monthly</button>
        <button onclick={() => (annual = true)} class={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${annual ? 'bg-white/10 text-white' : 'text-fog'}`}>Annual <span class="text-[9px] text-lime">−2 months</span></button>
      </div>
    </div>
  </div>

  {#if message}
    <div class="rounded-xl border border-amber/20 bg-amber/[0.06] px-3.5 py-2 text-[11.5px] text-amber">{message}</div>
  {/if}

  <div class="grid gap-3 lg:grid-cols-3">
    {#each SUBSCRIPTION_PLANS as plan}
      <div class={`panel relative overflow-hidden p-5 ${plan.featured ? 'border-lime/30' : ''}`}>
        {#if plan.featured}
          <div class="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-lime to-transparent"></div>
          <span class="absolute right-4 top-4 chip chip-lime !text-[8.5px]">Most popular</span>
        {/if}
        <div class="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-fog-dim">{plan.tagline}</div>
        <h2 class="display mt-1.5 text-[19px] font-bold text-white">{plan.name}</h2>
        <div class="mt-3 flex items-baseline gap-1">
          <span class="display num text-[32px] font-bold text-white">{plan.priceNgn === 0 ? 'Free' : fmtNgn(price(plan.priceNgn))}</span>
          {#if plan.priceNgn > 0}<span class="text-[11px] text-fog">/ {annual ? 'year' : 'month'}</span>{/if}
        </div>
        <div class="mt-0.5 text-[9.5px] text-fog-dim">{plan.priceNgn === 0 ? 'Explore with public data' : annual ? `Equivalent to ${fmtNgn(plan.priceNgn)} / month` : 'Per seat, billed monthly in NGN'}</div>
        <button onclick={() => checkout(plan.id)} class={`mt-4 w-full ${plan.featured ? 'btn btn-primary' : 'btn btn-ghost'} !py-2.5 text-[11.5px]`} disabled={loading}>
          {plan.id === 'starter' ? 'Start free' : plan.featured ? 'Unlock everything — ₦5,000' : 'Choose Trading Desk'}
        </button>
        <div class="mt-4 space-y-2">
          {#each plan.features as feature}
            <div class="flex items-start gap-2 text-[10.5px] leading-relaxed text-fog"><Check size={11} class="mt-0.5 shrink-0 text-mint" /> {feature}</div>
          {/each}
        </div>
        <div class="mt-4 border-t border-white/[0.06] pt-3 text-[9px] text-fog-dim">
          {plan.limits.seats} seat{plan.limits.seats > 1 ? 's' : ''} · {plan.limits.apiCalls.toLocaleString()} API calls · {plan.limits.llmReports.toLocaleString()} analyst reports
        </div>
      </div>
    {/each}
  </div>

  <div class="panel overflow-hidden">
    <div class="px-4 pb-1 pt-4">
      <h2 class="text-[14px] font-semibold text-white">Compare every capability</h2>
      <p class="text-[10.5px] text-fog">The same engine powers every plan. Paid plans unlock depth, breadth and automation.</p>
    </div>
    <div class="table-wrap mt-2">
      <table class="data-table">
        <thead><tr><th>Capability</th><th class="text-center">Starter</th><th class="text-center text-lime">Pro</th><th class="text-center">Trading Desk</th></tr></thead>
        <tbody>
          {#each featureRows as row}
            <tr>
              <td class="text-[10.5px] text-white/80">{row.label}</td>
              {#each [row.starter, row.pro, row.desk] as value}
                <td class="text-center">
                  {#if value === true}<Check size={12} class="mx-auto text-mint" />{:else if value === false}<X size={12} class="mx-auto text-fog-dim/60" />{:else}<span class="text-[9.5px] text-fog">{value}</span>{/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    <div class="space-y-2">
      <h2 class="display text-[18px] font-bold text-white">Questions, answered.</h2>
      {#each faqs as faq, i}
        <div class="panel overflow-hidden">
          <button onclick={() => (openFaq = openFaq === i ? null : i)} class="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left">
            <span class="text-[11.5px] font-medium text-white">{faq.q}</span>
            <ChevronDown size={13} class={`shrink-0 text-fog transition ${openFaq === i ? 'rotate-180' : ''}`} />
          </button>
          {#if openFaq === i}<p class="border-t border-white/[0.06] px-3.5 py-3 text-[10.5px] leading-relaxed text-fog">{faq.a}</p>{/if}
        </div>
      {/each}
    </div>

    <div class="space-y-3">
      <div class="panel p-4">
        <div class="flex items-center gap-2"><ShieldCheck size={15} class="text-mint" /><h3 class="text-[12px] font-semibold text-white">What is always included</h3></div>
        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          {#each ['Aesthetic, responsive workspace', 'Naira-first formatting', 'Model calibration published', 'Paper ledger with CLV', 'Data source transparency', 'No deposit or bet placement', 'Cancel anytime', 'Export your data'] as item}
            <div class="flex items-start gap-1.5 text-[10px] text-fog"><Check size={10} class="mt-0.5 shrink-0 text-mint" />{item}</div>
          {/each}
        </div>
      </div>
      <div class="panel p-4">
        <div class="flex items-center gap-2"><Building2 size={15} class="text-sky" /><h3 class="text-[12px] font-semibold text-white">For syndicates and desks</h3></div>
        <p class="mt-1.5 text-[10.5px] leading-relaxed text-fog">Trading Desk includes five seats, a shared decision log, webhook exports, priority data-source slots and role-based access. Need more seats? ₦5,000 per seat per month, pro-rated.</p>
        <a href="/settings" class="mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-lime hover:underline">Talk to the desk <ArrowUpRight size={10} /></a>
      </div>
      <div class="rounded-xl border border-white/[0.07] bg-black/20 p-3 text-[9.5px] leading-relaxed text-fog-dim">
        CaveBettor is research software, not a sportsbook or financial adviser. 18+ only. Prices include VAT where applicable. Payments are processed by Paystack in Nigerian Naira.
      </div>
    </div>
  </div>
</div>
