<script lang="ts">
  import { goto } from '$app/navigation';
  import { Eye, EyeOff, ArrowRight, ShieldCheck, Check, Building2, User, Mail, Lock } from '@lucide/svelte';
  import BrandMark from '#lib/components/BrandMark.svelte';

  let name = $state('');
  let email = $state('');
  let workspace = $state('Lagos Value Desk');
  let password = $state('');
  let show = $state(false);
  let loading = $state(false);
  let error = $state('');

  async function submit(e: Event) {
    e.preventDefault();
    if (!name.trim() || !email.includes('@') || password.length < 8) {
      error = 'Enter your name, a valid email and a password of at least 8 characters.';
      return;
    }
    loading = true;
    error = '';
    setTimeout(() => goto('/'), 700);
  }
</script>

<svelte:head><title>Create your workspace — CaveBettor</title></svelte:head>

<div class="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
  <div class="relative hidden overflow-hidden border-r border-white/[0.06] bg-pitch-900/50 lg:flex lg:flex-col lg:justify-between lg:p-10">
    <div class="mesh absolute inset-0 opacity-40"></div>
    <div class="absolute -left-20 top-20 h-80 w-80 rounded-full bg-mint/10 blur-3xl"></div>
    <a href="/" class="relative" aria-label="CaveBettor home"><BrandMark size={36} withWordmark /></a>
    <div class="relative">
      <span class="chip chip-lime">₦5,000 / month · everything included</span>
      <h2 class="display mt-5 max-w-md text-[30px] font-bold leading-tight text-white">One workspace.<br /><span class="text-gradient">Every edge, measured.</span></h2>
      <div class="mt-5 space-y-2">
        {#each ['All 5 sports and 20 leagues', '84 markets with model probabilities', 'Live in-play re-pricing every 30 seconds', 'Model lab, calibration and drift alerts', 'Data pipeline with API key slots', 'Paper ledger with closing-line value'] as item}
          <div class="flex items-center gap-2 text-[11px] text-fog"><Check size={12} class="text-mint" /> {item}</div>
        {/each}
      </div>
    </div>
    <div class="relative rounded-xl border border-white/[0.08] bg-black/20 p-4 text-[9.5px] leading-relaxed text-fog-dim">
      Start on the free tier. Upgrade to Pro when you want the full value board, live probabilities and the model lab. Cancel anytime.
    </div>
  </div>

  <div class="flex flex-col px-5 py-6 sm:px-10">
    <div class="flex items-center justify-between lg:justify-end">
      <a href="/" class="lg:hidden" aria-label="CaveBettor home"><BrandMark size={34} /></a>
      <span class="text-[10.5px] text-fog">Already have an account? <a href="/auth/login" class="font-semibold text-lime hover:underline">Sign in</a></span>
    </div>
    <div class="mx-auto w-full max-w-sm py-8">
      <span class="chip chip-mint"><Building2 size={10} /> New workspace</span>
      <h1 class="display mt-3 text-[26px] font-bold tracking-tight text-white">Create your desk.</h1>
      <p class="mt-1 text-[12px] text-fog">Free to explore. No card required.</p>

      <form class="mt-5 space-y-3" onsubmit={submit}>
        <div>
          <label class="label" for="name">Full name</label>
          <div class="relative"><User size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" /><input id="name" class="input !py-2.5 pl-9" bind:value={name} autocomplete="name" placeholder="Omale Danjuma" /></div>
        </div>
        <div>
          <label class="label" for="email">Work email</label>
          <div class="relative"><Mail size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" /><input id="email" class="input !py-2.5 pl-9" type="email" bind:value={email} autocomplete="email" placeholder="you@desk.ng" /></div>
        </div>
        <div>
          <label class="label" for="workspace">Workspace name</label>
          <div class="relative"><Building2 size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" /><input id="workspace" class="input !py-2.5 pl-9" bind:value={workspace} /></div>
        </div>
        <div>
          <label class="label" for="password">Password</label>
          <div class="relative">
            <Lock size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" />
            <input id="password" class="input !py-2.5 pl-9 pr-9" type={show ? 'text' : 'password'} bind:value={password} autocomplete="new-password" placeholder="At least 8 characters" />
            <button type="button" onclick={() => (show = !show)} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-fog-dim hover:text-white" aria-label="Toggle password visibility">{#if show}<EyeOff size={14} />{:else}<Eye size={14} />{/if}</button>
          </div>
        </div>
        {#if error}<div class="text-[10.5px] text-rose">{error}</div>{/if}
        <button type="submit" class="btn btn-primary w-full !py-2.5" disabled={loading}>{loading ? 'Creating workspace…' : 'Create workspace'} {#if !loading}<ArrowRight size={14} />{/if}</button>
        <p class="text-[9px] leading-relaxed text-fog-dim">By continuing you agree to the terms of use and privacy policy. CaveBettor is research software for adults 18+. It does not accept deposits or place bets.</p>
      </form>
      <div class="mt-5 flex items-start gap-2 rounded-lg border border-sky/15 bg-sky/[0.05] p-2.5 text-[9.5px] leading-relaxed text-fog">
        <ShieldCheck size={11} class="mt-0.5 shrink-0 text-sky" />
        <span>Demo build: account creation is simulated and stored only in this browser session.</span>
      </div>
    </div>
  </div>
</div>
