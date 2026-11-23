<script lang="ts">
  let { value, showLabel = true, size = 'md' }: { value: number; showLabel?: boolean; size?: 'sm' | 'md' | 'lg' } = $props();
  const tone = $derived(value >= 80 ? '#35e7a1' : value >= 65 ? '#c9ff4d' : value >= 50 ? '#f6c453' : '#ff6478');
  const cls = $derived(size === 'lg' ? 'text-[28px]' : size === 'sm' ? 'text-[13px]' : 'text-[18px]');
</script>

<div class="flex items-center gap-2.5">
  <div class="relative" style={`width:${size === 'lg' ? 58 : size === 'sm' ? 26 : 38}px;height:${size === 'lg' ? 58 : size === 'sm' ? 26 : 38}px`}>
    <svg viewBox="0 0 40 40" class="h-full w-full -rotate-90">
      <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(147,169,160,0.13)" stroke-width="4" />
      <circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        stroke={tone}
        stroke-width="4"
        stroke-linecap="round"
        stroke-dasharray={`${(value / 100) * 100.5} 100.5`}
      />
    </svg>
    <span class={`absolute inset-0 flex items-center justify-center font-display font-bold num ${size === 'sm' ? 'text-[8.5px]' : size === 'lg' ? 'text-[15px]' : 'text-[10px]'}`} style={`color:${tone}`}>
      {Math.round(value)}
    </span>
  </div>
  {#if showLabel}
    <div class="leading-tight">
      <div class={`font-display font-bold num ${cls}`} style={`color:${tone}`}>{value.toFixed(0)}%</div>
      <div class="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-fog-dim">Confidence</div>
    </div>
  {/if}
</div>
