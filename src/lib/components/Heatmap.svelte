<script lang="ts">
  let {
    cells,
    homeShort,
    awayShort,
    maxGoals = 5
  }: { cells: { home: number; away: number; probability: number }[]; homeShort: string; awayShort: string; maxGoals?: number } = $props();
  const lookup = $derived(new Map(cells.map((c) => [`${c.home}-${c.away}`, c.probability])));
  const max = $derived(Math.max(...cells.filter((c) => c.home <= maxGoals && c.away <= maxGoals).map((c) => c.probability), 0.0001));
  const range = $derived(Array.from({ length: maxGoals + 1 }, (_, i) => i));
  function prob(h: number, a: number) {
    return lookup.get(`${h}-${a}`) ?? 0;
  }
</script>

<div class="min-w-0">
  <div class="grid gap-1" style={`grid-template-columns: 26px repeat(${maxGoals + 1}, minmax(0,1fr))`}>
    <div></div>
    {#each range as a}
      <div class="pb-1 text-center text-[9.5px] font-semibold text-fog-dim">{a}</div>
    {/each}
    {#each range as h}
      <div class="flex items-center justify-end pr-1 text-[9.5px] font-semibold text-fog-dim">{h}</div>
      {#each range as a}
        {@const p = prob(h, a)}
        {@const intensity = p / max}
        <div
          class="num flex aspect-square items-center justify-center rounded-[4px] text-[9.5px] font-semibold transition hover:ring-1 hover:ring-lime/60"
          style={`background:rgba(201,255,77,${0.04 + intensity * 0.82});color:${intensity > 0.52 ? '#0b1408' : intensity > 0.16 ? 'rgba(255,255,255,0.85)' : 'rgba(147,169,160,0.55)'}`}
          title={`${homeShort} ${h}–${a} ${awayShort}: ${(p * 100).toFixed(2)}%`}
        >
          {#if p >= 0.005}{(p * 100).toFixed(p >= 0.1 ? 0 : 1)}{/if}
        </div>
      {/each}
    {/each}
  </div>
  <div class="mt-2 flex items-center justify-between text-[10px] text-fog-dim">
    <span>{homeShort} goals ↓</span>
    <span>{awayShort} goals →</span>
  </div>
</div>
