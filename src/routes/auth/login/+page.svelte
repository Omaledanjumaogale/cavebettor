<script lang="ts">
  import { goto } from '$app/navigation';
  import { Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles, Mail, Lock, CircleAlert } from '@lucide/svelte';
  import BrandMark from '#lib/components/BrandMark.svelte';

  let email = $state('omale@cavebettor.ng');
  let password = $state('cavebettor-demo');
  let show = $state(false);
  let loading = $state(false);
  let error = $state('');

  async function submit(e: Event) {
    e.preventDefault();
    if (!email.includes('@')) {
      error = 'Enter a valid email address.';
      return;
    }
    loading = true;
    error = '';
    setTimeout(() => goto('/'), 650);
  }
</script>

<svelte:head><title>Sign in — CaveBettor</title></svelte:head>

<div class="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
  <div class="flex flex-col justify-between px-5 py-6 sm:px-10">
    <a href="/" aria-label="CaveBettor home"><BrandMark size={36} withWordmark /></a>
    <div class="mx-auto w-full max-w-sm py-10">
      <span class="chip chip-lime"><Sparkles size={10} /> Welcome back</span>
      <h1 class="display mt-4 text-[28px] font-bold tracking-tight text-white">Sign in to the desk.</h1>
      <p class="mt-1.5 text-[12px] leading-relaxed text-fog">Your fixtures, models, paper ledger and research notes — exactly where you left them.</p>

      <form class="mt-6 space-y-3" onsubmit={submit}>
        <div>
          <label class="label" for="email">Email</label>
          <div class="relative">
            <Mail size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" />
            <input id="email" class="input !py-2.5 pl-9" type="email" bind:value={email} autocomplete="email" />
          </div>
        </div>
        <div>
          <div class="mb-1.5 flex items-center justify-between">
            <label class="label !mb-0" for="password">Password</label>
            <a href="/auth/login" class="text-[10px] font-medium text-lime hover:underline">Forgot?</a>
          </div>
          <div class="relative">
            <Lock size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" />
            <input id="password" class="input !py-2.5 pl-9 pr-9" type={show ? 'text' : 'password'} bind:value={password} autocomplete="current-password" />
            <button type="button" onclick={() => (show = !show)} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-fog-dim hover:text-white" aria-label="Toggle password visibility">
              {#if show}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
            </button>
          </div>
        </div>
        {#if error}<div class="flex items-center gap-1.5 text-[10.5px] text-rose"><CircleAlert size={11} /> {error}</div>{/if}
        <label class="flex items-center gap-2 text-[10.5px] text-fog"><input type="checkbox" checked class="h-3.5 w-3.5 accent-[#c9ff4d]" /> Keep me signed in on this device</label>
        <button type="submit" class="btn btn-primary w-full !py-2.5" disabled={loading}>
          {loading ? 'Opening workspace…' : 'Sign in'} {#if !loading}<ArrowRight size={14} />{/if}
        </button>
      </form>

      <div class="my-4 flex items-center gap-3"><span class="h-px flex-1 bg-white/10"></span><span class="text-[9px] uppercase tracking-[0.16em] text-fog-dim">or continue with</span><span class="h-px flex-1 bg-white/10"></span></div>
      <div class="grid grid-cols-2 gap-2">
        <button class="btn btn-ghost !py-2 text-[11px]" onclick={() => goto('/')}>Google</button>
        <button class="btn btn-ghost !py-2 text-[11px]" onclick={() => goto('/')}>Microsoft</button>
      </div>

      <p class="mt-5 text-center text-[10.5px] text-fog">New to CaveBettor? <a href="/auth/register" class="font-semibold text-lime hover:underline">Create a workspace</a></p>
      <div class="mt-6 flex items-start gap-2 rounded-lg border border-sky/15 bg-sky/[0.05] p-2.5 text-[9.5px] leading-relaxed text-fog">
        <ShieldCheck size={11} class="mt-0.5 shrink-0 text-sky" />
        <span>Demo build: credentials are pre-filled and no real authentication is performed. Production uses Convex Auth with magic links, TOTP and role-based access.</span>
      </div>
    </div>
    <div class="text-[9.5px] text-fog-dim">© 2026 CaveBettor · 18+ · Research software, not a sportsbook.</div>
  </div>

  <div class="relative hidden overflow-hidden border-l border-white/[0.06] bg-pitch-900/50 lg:flex lg:flex-col lg:justify-between lg:p-10">
    <div class="mesh absolute inset-0 opacity-40"></div>
    <div class="absolute -right-20 top-10 h-80 w-80 rounded-full bg-lime/10 blur-3xl"></div>
    <div class="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-mint/10 blur-3xl"></div>
    <div class="relative">
      <span class="chip chip-mint"><span class="live-dot h-1.5 w-1.5 rounded-full bg-mint"></span>Engine online</span>
      <h2 class="display mt-6 max-w-md text-[30px] font-bold leading-tight text-white">The bookmakers have prices.<br /><span class="text-gradient">You have probabilities.</span></h2>
      <p class="mt-3 max-w-md text-[12px] leading-relaxed text-fog">Five sports, twenty competitions and eighty-four markets — harmonised into one transparent, Naira-first intelligence workspace.</p>
    </div>
    <div class="relative grid grid-cols-2 gap-3">
      {#each [
        { value: '5', label: 'Sports' },
        { value: '20', label: 'Leagues' },
        { value: '84', label: 'Markets' },
        { value: '₦5,000', label: 'Per month' }
      ] as stat}
        <div class="rounded-xl border border-white/[0.08] bg-black/20 p-3">
          <div class="display num text-[22px] font-bold text-lime">{stat.value}</div>
          <div class="text-[9.5px] uppercase tracking-[0.14em] text-fog-dim">{stat.label}</div>
        </div>
      {/each}
    </div>
    <div class="relative rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <div class="text-[11px] leading-relaxed text-white/80">“The value board and calibration audit replaced three spreadsheets. I can see exactly why a price is wrong.”</div>
      <div class="mt-2 text-[9.5px] text-fog-dim">Amara Eze · analyst, Lagos Value Desk</div>
    </div>
  </div>
</div>
