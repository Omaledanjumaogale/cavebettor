<script lang="ts">
  import { onMount } from 'svelte';
  import { countdown } from '#lib/format';

  /**
   * Real-time kick-off indicator for a fixture that has not started yet.
   *
   * It renders nothing on the server and starts ticking on mount, so the
   * board never hydrates a stale countdown and a tab left open overnight still
   * counts down against the real clock.
   */
  let { kickoff, tone = 'mint', showLabel = false }: { kickoff: string; tone?: 'mint' | 'amber'; showLabel?: boolean } = $props();

  let now = $state(0);
  onMount(() => {
    now = Date.now();
    const timer = setInterval(() => (now = Date.now()), 15_000);
    return () => clearInterval(timer);
  });

  const diff = $derived(now ? new Date(kickoff).getTime() - now : Number.POSITIVE_INFINITY);
  // Past kick-off the fixture is live or finished; the countdown disappears
  // rather than claiming a match that is already under way is "kicking off".
  const text = $derived(
    !now || !Number.isFinite(diff)
      ? ''
      : diff > 0
        ? `in ${countdown(kickoff)}`
        : diff > -5 * 60_000
          ? 'kicking off'
          : ''
  );
  const soon = $derived(now > 0 && diff > 0 && diff <= 45 * 60_000);
  // Static class names: Tailwind only generates utilities it can see.
  const dotColour = $derived(soon || tone === 'amber' ? 'bg-amber' : 'bg-mint');
  const textColour = $derived(soon || tone === 'amber' ? 'text-amber' : 'text-mint');
</script>

{#if text}
  <span class={`inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold tabular-nums ${textColour}`} title="Kick-off countdown">
    <span class={`live-dot h-1.5 w-1.5 rounded-full ${dotColour}`}></span>
    {#if showLabel}<span class="font-medium uppercase tracking-[0.08em] text-fog-dim">Starts</span>{/if}
    {text}
  </span>
{/if}