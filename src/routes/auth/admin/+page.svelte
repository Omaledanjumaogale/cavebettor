<script lang="ts">
  import { ShieldCheck, Mail, Lock, ArrowRight, KeyRound } from '@lucide/svelte';
  import { enhance } from '$app/forms';
  import BrandMark from '#lib/components/BrandMark.svelte';
  import type { ActionData } from './$types';

  let { data, form }: { data: { configured: boolean; next: string }; form: ActionData } = $props();
  let submitting = $state(false);
</script>

<svelte:head><title>Super admin — CaveBettor</title><meta name="robots" content="noindex,nofollow" /></svelte:head>

<div class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
  <a href="/" aria-label="CaveBettor home" class="mb-8"><BrandMark size={36} withWordmark /></a>
  <div class="panel p-6">
    <span class="chip chip-violet"><ShieldCheck size={11} /> Super admin</span>
    <h1 class="display mt-4 text-[22px] font-bold tracking-tight text-white sm:text-[26px]">Restricted console.</h1>
    <p class="mt-1.5 text-[12px] leading-relaxed text-fog">Password access for the platform owner. Every sign-in is mirrored to the Convex audit log.</p>

    {#if !data.configured}
      <div class="mt-5 rounded-xl border border-amber/30 bg-amber/10 p-3 text-[11.5px] text-amber">
        Admin credentials are missing. Set <span class="num">SUPER_ADMIN_EMAIL</span>, <span class="num">SUPER_ADMIN_PASSWORD</span> and <span class="num">ADMIN_SESSION_SECRET</span> before signing in.
      </div>
    {/if}

    {#if form?.error}
      <div role="alert" class="mt-4 rounded-xl border border-rose/30 bg-rose/10 p-3 text-[11.5px] text-rose">{form.error}</div>
    {/if}

    <form method="POST" class="mt-5 space-y-3" use:enhance={() => {
      submitting = true;
      return async ({ update }) => { await update(); submitting = false; };
    }}>
      <input type="hidden" name="next" value={data.next} />
      <div>
        <label class="label" for="admin-email">Admin email</label>
        <div class="relative">
          <Mail size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" />
          <input id="admin-email" name="email" type="email" class="input !py-2.5 pl-9" autocomplete="username" value={(form as any)?.email ?? ''} required />
        </div>
      </div>
      <div>
        <label class="label" for="admin-password">Password</label>
        <div class="relative">
          <Lock size={13} class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-dim" />
          <input id="admin-password" name="password" type="password" class="input !py-2.5 pl-9" autocomplete="current-password" required />
        </div>
      </div>
      <button class="btn btn-primary w-full justify-center !py-2.5" disabled={submitting || !data.configured}>
        {submitting ? 'Checking…' : 'Open console'} <ArrowRight size={13} />
      </button>
    </form>

    <div class="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[10.5px] text-fog-dim">
      <a href="/auth/login" class="hover:text-white">Member sign-in</a>
      <span class="flex items-center gap-1"><KeyRound size={11} /> HMAC session · 7 days</span>
    </div>
  </div>
</div>
