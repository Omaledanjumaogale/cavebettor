<script lang="ts">
  import { SPORT_MAP } from '#lib/data/catalog';
  import type { SportId } from '#lib/types';

  /**
   * The sport a fixture belongs to, as a glyph.
   *
   * Every board that lists a fixture renders this before the competition, so a
   * row of matches can be read by sport at a glance instead of by reading
   * five league names.
   */
  let {
    sport,
    size = 'sm',
    showLabel = false
  }: { sport: SportId; size?: 'xs' | 'sm' | 'md'; showLabel?: boolean } = $props();

  // Stored provider rows can carry a sport the catalogue does not know; fall
  // back to football rather than rendering an undefined badge.
  const meta = $derived(SPORT_MAP[sport] ?? SPORT_MAP.football);
  const box = $derived(
    size === 'xs' ? 'h-[18px] w-[18px] text-[10px]' : size === 'md' ? 'h-8 w-8 text-[16px]' : 'h-[22px] w-[22px] text-[12px]'
  );
</script>

<span class="inline-flex min-w-0 items-center gap-1.5">
  <span
    class={`inline-flex shrink-0 items-center justify-center rounded-md border border-white/[0.09] bg-white/[0.05] leading-none ${box}`}
    style={`color:${meta.accent}`}
    role="img"
    aria-label={meta.name}
    title={meta.name}
  >
    <span aria-hidden="true">{meta.icon}</span>
  </span>
  {#if showLabel}
    <span class="truncate text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fog">{meta.name}</span>
  {/if}
</span>