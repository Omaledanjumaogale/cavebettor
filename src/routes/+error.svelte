<script lang="ts">
  import { page } from '$app/state';
  import { ArrowLeft, Compass } from '@lucide/svelte';
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
  <div class="mt-5 flex items-center gap-2">
    <a href="/" class="btn btn-primary !py-2 text-[11.5px]"><ArrowLeft size={13} /> Command centre</a>
    <a href="/fixtures" class="btn btn-ghost !py-2 text-[11.5px]"><Compass size={13} /> Browse fixtures</a>
  </div>
  {#if page.error?.message}<div class="mt-4 max-w-lg rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-[9.5px] text-fog-dim">{page.error.message}</div>{/if}
</div>
