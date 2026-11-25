<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, Smartphone, Share2, X, Check, RefreshCw, WifiOff } from '@lucide/svelte';
  import { pwa } from '#lib/pwa.svelte';

  /**
   * Install prompt.
   *
   * `bar` is the once-per-week strip on the dashboard; `card` is the permanent
   * row in Settings; `button` is the menu entry. All three talk to the same
   * store, so accepting an install anywhere updates every surface.
   */
  let { variant = 'card', class: extra = '' }: { variant?: 'bar' | 'card' | 'button'; class?: string } = $props();

  let mounted = $state(false);
  onMount(() => (mounted = true));

  const show = $derived(
    mounted && !pwa.standalone && (pwa.state === 'available' || pwa.state === 'ios-manual' || pwa.state === 'unsupported')
  );

  async function install() {
    await pwa.install();
  }

  /** iOS never fires beforeinstallprompt, so the manual path is the offer. */
  function isIosFallback(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
</script>

{#if variant === 'button'}
  <button
    class={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13px] text-white/70 transition hover:bg-white/5 ${extra}`}
    onclick={() => (pwa.state === 'available' ? install() : (pwa.state = pwa.state === 'dismissed' ? 'ios-manual' : pwa.state))}
  >
    <Download size={15} class="text-lime" />
    <span class="min-w-0 flex-1">
      Install app
      <span class="block text-[9.5px] text-fog-dim">{pwa.standalone ? 'Already installed' : 'Add CaveBettor to your home screen'}</span>
    </span>
  </button>
{:else if show && variant === 'bar'}
  <div class={`panel flex flex-wrap items-center gap-3 px-3.5 py-3 ${extra}`}>
    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-lime/25 bg-lime/[0.08] text-lime">
      <Smartphone size={16} />
    </span>
    <div class="min-w-0 flex-1">
      <div class="text-[12px] font-semibold text-white">Install CaveBettor</div>
      <div class="text-[10.5px] leading-snug text-fog">Full-screen on your phone, one tap from the home screen, works on a weak connection.</div>
    </div>
    <div class="flex items-center gap-1.5">
      {#if pwa.state === 'available'}
        <button class="btn btn-primary !py-1.5 text-[11px]" onclick={install}><Download size={12} /> Install</button>
      {:else}
        <span class="chip chip-lime !text-[9.5px]"><Share2 size={10} /> Share → Add to Home Screen</span>
      {/if}
      <button class="btn-icon !h-7 !w-7" aria-label="Dismiss install prompt" onclick={() => pwa.dismiss()}><X size={13} /></button>
    </div>
  </div>
{:else if show && variant === 'card'}
  <div class={`panel p-4 ${extra}`}>
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="text-[13px] font-semibold text-white">Install on this device</h3>
        <p class="mt-0.5 text-[10.5px] leading-relaxed text-fog">
          CaveBettor is a progressive web app: the same code runs in the browser and as an installed app, with no store,
          no update queue and no extra download.
        </p>
      </div>
      <span class="chip !text-[9px]">{pwa.standalone ? 'Installed' : pwa.swReady ? 'Ready' : 'Preparing'}</span>
    </div>

    <ul class="mt-3 space-y-1.5 text-[10.5px] text-fog">
      <li class="flex items-center gap-2"><Check size={12} class="text-mint" /> Opens full-screen, without browser chrome</li>
      <li class="flex items-center gap-2"><Check size={12} class="text-mint" /> Home-screen icon and quick shortcuts to Live, Value and Betslip</li>
      <li class="flex items-center gap-2"><Check size={12} class="text-mint" /> Cached shell, so the app opens on a weak or dropped connection</li>
      <li class="flex items-center gap-2"><WifiOff size={12} class="text-amber" /> Live scores and odds still need the network</li>
    </ul>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      {#if pwa.state === 'available'}
        <button class="btn btn-primary !py-2 text-[11px]" onclick={install}><Download size={12} /> Install app</button>
      {:else if pwa.state === 'ios-manual'}
        <span class="chip chip-lime"><Share2 size={11} /> iPhone: Share → Add to Home Screen</span>
      {:else if pwa.state === 'installed'}
        <span class="chip chip-mint">Running as an installed app</span>
      {:else if pwa.state === 'dismissed'}
        <button class="btn btn-ghost !py-2 text-[11px]" onclick={() => (pwa.state = isIosFallback() ? 'ios-manual' : 'available')}>Show install options</button>
      {:else}
        <span class="chip">Open this site in Chrome, Edge or Safari to install</span>
      {/if}
      {#if pwa.updateReady}
        <button class="btn btn-ghost !py-2 text-[11px]" onclick={() => pwa.applyUpdate()}><RefreshCw size={12} /> Update available — reload</button>
      {/if}
    </div>
  </div>
{/if}
