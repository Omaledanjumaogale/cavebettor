<script lang="ts">
  import { ArrowRight, Sparkles, ShieldCheck, CircleAlert, Network } from '@lucide/svelte';
  import BrandMark from '#lib/components/BrandMark.svelte';

  let { data } = $props();
  const nextQuery = $derived(data.next && data.next !== '/' ? `?next=${encodeURIComponent(data.next)}` : '');
</script>

<svelte:head><title>Sign in — CaveBettor</title></svelte:head>

<div class="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
  <div class="flex flex-col justify-between px-5 py-6 sm:px-10">
    <a href="/" aria-label="CaveBettor home"><BrandMark size={36} withWordmark /></a>
    <div class="mx-auto w-full max-w-sm py-10">
      <span class="chip chip-lime"><Sparkles size={10} /> Welcome back</span>
      <h1 class="display mt-4 text-[28px] font-bold tracking-tight text-white">Sign in to the desk.</h1>
      <p class="mt-1.5 text-[12px] leading-relaxed text-fog">Fixtures, models, paper ledger and research notes — exactly where you left them. One account also works across the E-WIN ecosystem.</p>

      {#if data.error}
        <div role="alert" class="mt-4 flex items-start gap-2 rounded-xl border border-rose/30 bg-rose/10 p-3 text-[11.5px] text-rose">
          <CircleAlert size={14} class="mt-0.5 shrink-0" /> {data.error}
        </div>
      {/if}

      <div class="mt-6 space-y-2.5">
        <a href={`/auth/google${nextQuery}`} class="btn w-full justify-center !py-3 text-[12px] font-semibold" class:opacity-50={!data.providers.google} aria-disabled={!data.providers.google}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/></svg>
          Continue with Google
        </a>
        <a href={`/auth/github${nextQuery}`} class="btn w-full justify-center !py-3 text-[12px] font-semibold" class:opacity-50={!data.providers.github} aria-disabled={!data.providers.github}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12A11.5 11.5 0 0 0 12 .5z"/></svg>
          Continue with GitHub
        </a>
        <a href="/auth/ewin" class="btn w-full justify-center !py-3 text-[12px] font-semibold border-violet/30 bg-violet/10 text-violet">
          <Network size={15} /> Continue with E-WIN
        </a>
      </div>

      <p class="mt-5 text-center text-[10.5px] leading-relaxed text-fog-dim">
        By continuing you agree to research-only use. CaveBettor never accepts deposits and never places bets. 18+.
      </p>

      <div class="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[10.5px] text-fog-dim">
        <a href="/pricing" class="hover:text-white">Plans from ₦5,000/month</a>
        <a href="/auth/admin" class="flex items-center gap-1 hover:text-rose"><ShieldCheck size={11} /> Super admin</a>
      </div>
    </div>
    <div class="text-[10px] text-fog-dim">© 2026 CaveBettor · Lagos, Nigeria</div>
  </div>

  <div class="relative hidden overflow-hidden border-l border-white/[0.06] bg-pitch-900 lg:block">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(201,255,77,0.14),transparent_55%),radial-gradient(circle_at_75%_70%,rgba(53,231,161,0.10),transparent_50%)]"></div>
    <div class="relative flex h-full flex-col justify-center px-12">
      <div class="display text-[30px] font-bold leading-tight text-white">The market moves.<br /><span class="text-gradient">Your process should not.</span></div>
      <p class="mt-4 max-w-md text-[13px] leading-relaxed text-fog">Live fixtures, eight-book pricing, calibrated probabilities and a paper ledger that keeps score — in plain English and Nigerian Naira.</p>
      <div class="mt-8 grid grid-cols-3 gap-3">
        {#each [['20', 'competitions'], ['5', 'sports'], ['8', 'bookmakers']] as [value, label]}
          <div class="rounded-xl border border-white/[0.08] bg-black/20 p-3">
            <div class="display num text-[22px] font-bold text-lime">{value}</div>
            <div class="text-[10px] uppercase tracking-[0.12em] text-fog-dim">{label}</div>
          </div>
        {/each}
      </div>
      <div class="mt-8 flex items-center gap-2 text-[11px] text-fog-dim"><ArrowRight size={13} class="text-mint" /> Google, GitHub and E-WIN single sign-on</div>
    </div>
  </div>
</div>
