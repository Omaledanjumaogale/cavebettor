<script lang="ts">
  let {
    segments,
    size = 148,
    thickness = 13,
    centerLabel = '',
    centerValue = '',
    centerSub = ''
  }: {
    segments: { label: string; value: number; colour: string }[];
    size?: number;
    thickness?: number;
    centerLabel?: string;
    centerValue?: string;
    centerSub?: string;
  } = $props();
  const total = $derived(segments.reduce((a, s) => a + s.value, 0) || 1);
  const r = $derived((size - thickness) / 2);
  const c = $derived(2 * Math.PI * r);
  let acc = 0;
  const arcs = $derived(
    segments.map((s) => {
      const frac = s.value / total;
      const dash = `${frac * c} ${c}`;
      const offset = -acc * c;
      acc += frac;
      return { ...s, dash, offset, frac };
    })
  );
</script>

<div class="flex items-center gap-5">
  <div class="relative shrink-0" style={`width:${size}px;height:${size}px`}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} class="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(147,169,160,0.09)" stroke-width={thickness} />
      {#each arcs as a}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={a.colour}
          stroke-width={thickness}
          stroke-dasharray={a.dash}
          stroke-dashoffset={a.offset}
          stroke-linecap="round"
          opacity="0.95"
        />
      {/each}
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
      <span class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fog-dim">{centerLabel}</span>
      <span class="display num mt-0.5 text-[24px] font-bold leading-none text-white">{centerValue}</span>
      {#if centerSub}<span class="mt-1 text-[10px] text-fog">{centerSub}</span>{/if}
    </div>
  </div>
  <div class="flex min-w-0 flex-col gap-2">
    {#each arcs as a}
      <div class="flex items-center gap-2 text-[11.5px]">
        <span class="h-2 w-2 shrink-0 rounded-full" style={`background:${a.colour}`}></span>
        <span class="truncate text-fog">{a.label}</span>
        <span class="num ml-auto font-semibold text-white">{(a.frac * 100).toFixed(1)}%</span>
      </div>
    {/each}
  </div>
</div>
