<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Menu, X, ArrowRight } from '@lucide/svelte';
  import BrandMark from '#lib/components/BrandMark.svelte';

  let { children }: { children: Snippet } = $props();
  let menuOpen = $state(false);

  const links = [
    { href: '/#platform', label: 'Platform' },
    { href: '/sports', label: 'Sports' },
    { href: '/models', label: 'Models' },
    { href: '/betslip', label: 'Betslip builder' },
    { href: '/pricing', label: 'Pricing' }
  ];
</script>

<div class="flex min-h-screen flex-col">
  <header class="sticky top-0 z-50 border-b border-white/[0.06] bg-pitch-950/85 backdrop-blur-xl">
    <div class="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
      <a href="/" aria-label="CaveBettor home"><BrandMark size={32} withWordmark /></a>

      <nav class="hidden items-center gap-6 md:flex" aria-label="Primary">
        {#each links as link}
          <a href={link.href} class="text-[12px] font-medium text-fog transition-colors hover:text-white">{link.label}</a>
        {/each}
      </nav>

      <div class="hidden items-center gap-2.5 md:flex">
        <a href="/auth/login" class="btn btn-ghost !py-2 text-[11.5px]">Sign in</a>
        <a href="/auth/register" class="btn btn-primary !py-2 text-[11.5px]">
          Start free <ArrowRight size={13} />
        </a>
      </div>

      <button
        type="button"
        class="btn btn-ghost !px-2 !py-1.5 md:hidden"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        onclick={() => (menuOpen = !menuOpen)}
      >
        {#if menuOpen}<X size={18} />{:else}<Menu size={18} />{/if}
      </button>
    </div>

    {#if menuOpen}
      <nav class="border-t border-white/[0.06] bg-pitch-950/95 px-4 py-3 md:hidden" aria-label="Mobile">
        {#each links as link}
          <a href={link.href} class="block rounded-lg px-3 py-2.5 text-[13px] text-fog hover:bg-white/5 hover:text-white" onclick={() => (menuOpen = false)}>
            {link.label}
          </a>
        {/each}
        <div class="mt-2 flex gap-2 border-t border-white/[0.06] pt-3">
          <a href="/auth/login" class="btn btn-ghost flex-1 !py-2 text-[12px]">Sign in</a>
          <a href="/auth/register" class="btn btn-primary flex-1 !py-2 text-[12px]">Start free</a>
        </div>
      </nav>
    {/if}
  </header>

  <main class="flex-1">
    {@render children()}
  </main>

  <footer class="border-t border-white/[0.06] bg-pitch-950/60">
    <div class="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
      <div class="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div class="max-w-xs">
          <BrandMark size={30} withWordmark />
          <p class="mt-3 text-[11.5px] leading-relaxed text-fog-dim">
            CaveBettor is a research and analytics workspace. It never accepts deposits, never places bets and never
            promises a return. 18+ · Nigeria.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-8 text-[11.5px] sm:gap-14">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-fog-dim">Product</div>
            <ul class="mt-3 space-y-2 text-fog">
              <li><a href="/fixtures" class="hover:text-white">Fixtures</a></li>
              <li><a href="/live" class="hover:text-white">Live desk</a></li>
              <li><a href="/predictions" class="hover:text-white">Value board</a></li>
              <li><a href="/odds" class="hover:text-white">Odds &amp; markets</a></li>
            </ul>
          </div>
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-fog-dim">Company</div>
            <ul class="mt-3 space-y-2 text-fog">
              <li><a href="/pricing" class="hover:text-white">Pricing</a></li>
              <li><a href="/auth/login" class="hover:text-white">Sign in</a></li>
              <li><a href="/auth/register" class="hover:text-white">Create account</a></li>
              <li><a href="https://ewinproject.org" rel="noreferrer noopener" target="_blank" class="hover:text-white">E-WIN ecosystem</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-col gap-2 border-t border-white/[0.06] pt-5 text-[10.5px] text-fog-dim sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 CaveBettor · Lagos, Nigeria</span>
        <span>Prices shown in Nigerian Naira (₦). Research use only.</span>
      </div>
    </div>
  </footer>
</div>
