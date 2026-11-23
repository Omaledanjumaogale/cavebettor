<script lang="ts">
  let {
    home,
    draw = 0,
    away,
    homeLabel = 'Home',
    drawLabel = 'Draw',
    awayLabel = 'Away',
    compact = false
  }: {
    home: number;
    draw?: number;
    away: number;
    homeLabel?: string;
    drawLabel?: string;
    awayLabel?: string;
    compact?: boolean;
  } = $props();
  const hasDraw = $derived(draw > 0.001);
  const h = $derived(home * 100);
  const d = $derived(draw * 100);
  const a = $derived(away * 100);
</script>

<div class="w-full">
  <div class={`flex w-full overflow-hidden rounded-full bg-white/[0.05] ${compact ? 'h-1.5' : 'h-2.5'}`}>
    <div class="h-full bg-gradient-to-r from-lime to-lime-soft transition-all duration-500" style={`width:${h}%`} title={`${homeLabel} ${h.toFixed(1)}%`}></div>
    {#if hasDraw}
      <div class="h-full bg-white/25" style={`width:${d}%`} title={`${drawLabel} ${d.toFixed(1)}%`}></div>
    {/if}
    <div class="h-full bg-gradient-to-r from-sky/70 to-sky transition-all duration-500" style={`width:${a}%`} title={`${awayLabel} ${a.toFixed(1)}%`}></div>
  </div>
  {#if !compact}
    <div class="mt-2 flex justify-between gap-2 text-[11px]">
      <span class="min-w-0 truncate text-lime">{homeLabel} <span class="num font-semibold text-lime">{h.toFixed(0)}%</span></span>
      {#if hasDraw}<span class="shrink-0 text-fog">{drawLabel} <span class="num font-semibold text-white/80">{d.toFixed(0)}%</span></span>{/if}
      <span class="min-w-0 truncate text-right text-sky">{awayLabel} <span class="num font-semibold text-sky">{a.toFixed(0)}%</span></span>
    </div>
  {/if}
</div>
