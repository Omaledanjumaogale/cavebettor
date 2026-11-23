<script lang="ts">
  let {
    value,
    size = 132,
    label = '',
    sub = '',
    colour = '#c9ff4d',
    track = 'rgba(147,169,160,0.12)'
  }: { value: number; size?: number; label?: string; sub?: string; colour?: string; track?: string } = $props();
  const r = $derived((size - 14) / 2);
  const c = $derived(Math.PI * r);
  const dash = $derived((Math.min(100, Math.max(0, value)) / 100) * c);
</script>

<div class="relative" style={`width:${size}px;height:${size * 0.72}px`}>
  <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`} class="overflow-visible">
    <path d={`M7,${size * 0.62} A${r},${r} 0 0 1 ${size - 7},${size * 0.62}`} fill="none" stroke={track} stroke-width="9" stroke-linecap="round" />
    <path
      d={`M7,${size * 0.62} A${r},${r} 0 0 1 ${size - 7},${size * 0.62}`}
      fill="none"
      stroke={colour}
      stroke-width="9"
      stroke-linecap="round"
      stroke-dasharray={`${dash} ${c}`}
    />
  </svg>
  <div class="absolute inset-x-0 bottom-1 flex flex-col items-center">
    <span class="display num text-[26px] font-bold leading-none text-white">{value.toFixed(0)}<span class="text-[12px] text-fog">%</span></span>
    {#if label}<span class="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fog-dim">{label}</span>{/if}
  </div>
  {#if sub}<div class="absolute -bottom-5 inset-x-0 text-center text-[10px] text-fog-dim">{sub}</div>{/if}
</div>
