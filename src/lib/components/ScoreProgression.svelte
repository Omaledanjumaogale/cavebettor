<script lang="ts">
  import type { Fixture } from '#lib/types';

  let {
    fixture,
    compact = false,
    limit = 0
  }: { fixture: Fixture; compact?: boolean; limit?: number } = $props();

  const periods = $derived.by(() => {
    const rows = fixture.periods ?? [];
    // A live football fixture at half time has no half-time row yet.
    if (!rows.length) return [];
    return limit > 0 ? rows.slice(0, limit) : rows;
  });

  const live = $derived(fixture.status === 'live' || fixture.status === 'halftime');
  const finished = $derived(fixture.status === 'finished');
</script>

{#if periods.length && (live || finished)}
  <div
    class={`flex flex-wrap items-center gap-x-2.5 gap-y-1 ${compact ? 'text-[9.5px]' : 'text-[10.5px]'} text-fog-dim`}
    aria-label="Score progression"
  >
    {#each periods as period}
      <span class="inline-flex items-center gap-1">
        <span class="uppercase tracking-[0.06em]">{period.label}</span>
        <span class="num font-semibold text-fog">{period.home}–{period.away}</span>
      </span>
    {/each}
  </div>
{/if}
