<script lang="ts">
  import { onMount } from 'svelte';
  import { WifiOff, RefreshCw, Radio, Sparkles } from '@lucide/svelte';

  // The page is prerendered as the offline notice, so the offline copy is the
  // one baked into the HTML. If the device turns out to be online, the mount
  // handler swaps in the "reconnecting" copy.
  let online = $state(false);

  onMount(() => {
    online = navigator.onLine;
    const up = () => (online = true);
    const down = () => (online = false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  });
</script>

<svelte:head>
  <title>Offline — CaveBettor</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-[100dvh] items-center justify-center px-5 py-10">
  <div class="w-full max-w-md">
    <div class="panel p-5">
      <div class="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog-dim">
        <WifiOff size={13} class="text-amber" /> {online ? 'Reconnecting' : 'No connection'}
      </div>
      <h1 class="display mt-2 text-[22px] font-bold tracking-tight text-white">
        {online ? 'Back online — fetching the board' : 'You are offline'}
      </h1>
      <p class="mt-2 text-[12.5px] leading-relaxed text-fog">
        CaveBettor keeps the pages you have already opened on this device. Live scores, odds and model probabilities
        always come from the wire, so they are the first thing to go when the network does.
      </p>

      <div class="mt-4 space-y-2">
        <button class="btn btn-primary w-full" onclick={() => location.reload()}>
          <RefreshCw size={13} /> Try again
        </button>
        <a href="/fixtures" class="btn btn-ghost w-full"><Radio size={13} /> Open cached fixtures</a>
        <a href="/predictions" class="btn btn-ghost w-full"><Sparkles size={13} /> Cached value board</a>
      </div>

      <p class="mt-4 text-[10.5px] leading-relaxed text-fog-dim">
        Results and settled markets are archived on the server, so nothing you saw is lost — reconnect and they will be
        back. Research only: CaveBettor never accepts deposits and never places bets. 18+.
      </p>
    </div>
  </div>
</div>
