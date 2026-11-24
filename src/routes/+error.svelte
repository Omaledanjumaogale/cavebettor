<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft, Compass, Home, LayoutDashboard } from '@lucide/svelte';
  import BrandMark from '#lib/components/BrandMark.svelte';
</script>

<svelte:head><title>{page.status} — CaveBettor</title></svelte:head>

<div class="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
  <BrandMark size={48} />
  <div class="mt-6 display num text-[64px] font-bold leading-none text-gradient">{page.status}</div>
  <h1 class="display mt-3 text-[22px] font-bold text-white">
    {page.status === 404 ? 'This fixture has moved.' : 'Something broke in the tunnel.'}
  </h1>
  <p class="mt-2 max-w-md text-[12.5px] leading-relaxed text-fog">
    {page.status === 404
      ? 'The page or fixture you are looking for is not on the board. Try the overview or search for a team.'
      : 'The engine could not complete that request. Your workspace data is safe. Try again, or return to the command centre.'}
  </p>

  {#if page.status === 404}
    <p class="mt-3 max-w-md rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-fog-dim">
      The public pages are served as static files, so they stay readable even when the backing service is busy. If a
      workspace page is unavailable right now, wait a moment and reload — the market data is cached in Cloudflare R2.
    </p>
  {/if}

  <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
    <a href="/dashboard" class="btn btn-primary !py-2 text-[11.5px]"><ArrowLeft size={13} /> Command centre</a>
    <a href="/fixtures" class="btn btn-ghost !py-2 text-[11.5px]"><Compass size={13} /> Browse fixtures</a>
    <a href="/" class="btn btn-ghost !py-2 text-[11.5px]"><Home size={13} /> Public site</a>
    <a href="/pricing" class="btn btn-ghost !py-2 text-[11.5px]"><LayoutDashboard size={13} /> Plans</a>
  </div>

  {#if page.error?.message}<div class="mt-4 max-w-lg rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-[9.5px] text-fog-dim">{page.error.message}</div>{/if}
</div>
