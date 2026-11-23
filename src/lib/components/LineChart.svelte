<script lang="ts">
  interface Series {
    name: string;
    values: number[];
    colour: string;
    dashed?: boolean;
    area?: boolean;
  }
  let {
    series,
    labels = [],
    height = 240,
    yFormat = (v: number) => String(Math.round(v)),
    min: forcedMin,
    max: forcedMax,
    legend = true,
    gridLines = 4,
    tooltipFormat
  }: {
    series: Series[];
    labels?: string[];
    height?: number;
    yFormat?: (v: number) => string;
    min?: number;
    max?: number;
    legend?: boolean;
    gridLines?: number;
    tooltipFormat?: (index: number) => string;
  } = $props();

  let width = $state(760);
  let hover = $state<number | null>(null);

  const PAD = { top: 14, right: 12, bottom: 24, left: 44 };
  const all = $derived(series.flatMap((s) => s.values));
  const bounds = $derived.by(() => {
    let lo = forcedMin ?? Math.min(...all);
    let hi = forcedMax ?? Math.max(...all);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.1;
    return { lo: forcedMin ?? lo - pad, hi: forcedMax ?? hi + pad };
  });
  const plotW = $derived(Math.max(10, width - PAD.left - PAD.right));
  const plotH = $derived(height - PAD.top - PAD.bottom);
  const count = $derived(Math.max(...series.map((s) => s.values.length), 2));
  const xAt = (i: number) => PAD.left + (i / (count - 1)) * plotW;
  const yAt = (v: number) => PAD.top + (1 - (v - bounds.lo) / (bounds.hi - bounds.lo)) * plotH;
  const ticks = $derived(Array.from({ length: gridLines + 1 }, (_, i) => bounds.lo + ((bounds.hi - bounds.lo) * i) / gridLines));

  function linePath(values: number[]) {
    return values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
      .join(' ');
  }
  function areaPath(values: number[]) {
    return `${linePath(values)} L${xAt(values.length - 1).toFixed(1)},${PAD.top + plotH} L${PAD.left},${PAD.top + plotH} Z`;
  }
  function onMove(e: MouseEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - PAD.left) / plotW) * (count - 1));
    hover = Math.max(0, Math.min(count - 1, i));
  }
  const uid = `lc-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="w-full">
  {#if legend}
    <div class="mb-3 flex flex-wrap items-center gap-4">
      {#each series as s}
        <span class="flex items-center gap-1.5 text-[11px] font-medium text-fog">
          <span class="h-1.5 w-3 rounded-full" style={`background:${s.colour}`}></span>{s.name}
        </span>
      {/each}
    </div>
  {/if}
  <div class="relative w-full" bind:clientWidth={width}>
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={`height:${height}px`}
      class="w-full touch-none"
      onmousemove={onMove}
      onmouseleave={() => (hover = null)}
      role="img"
      aria-label="Line chart"
    >
      <defs>
        {#each series as s, i}
          <linearGradient id={`${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={s.colour} stop-opacity="0.22" />
            <stop offset="100%" stop-color={s.colour} stop-opacity="0" />
          </linearGradient>
        {/each}
      </defs>
      {#each ticks as t}
        <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="rgba(147,169,160,0.1)" stroke-dasharray="3 5" />
        <text x={PAD.left - 8} y={yAt(t) + 3.5} text-anchor="end" fill="rgba(147,169,160,0.65)" font-size="9.5" font-family="Inter Variable, sans-serif">
          {yFormat(t)}
        </text>
      {/each}
      {#if labels.length}
        {#each labels as label, i}
          {#if i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1}
            <text x={xAt(i)} y={height - 6} text-anchor="middle" fill="rgba(147,169,160,0.6)" font-size="9.5" font-family="Inter Variable, sans-serif">
              {label}
            </text>
          {/if}
        {/each}
      {/if}
      {#each series as s, i}
        {#if s.area}
          <path d={areaPath(s.values)} fill={`url(#${uid}-${i})`} />
        {/if}
        <path
          d={linePath(s.values)}
          fill="none"
          stroke={s.colour}
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-dasharray={s.dashed ? '5 4' : undefined}
        />
      {/each}
      {#if hover !== null}
        <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="rgba(201,255,77,0.35)" stroke-width="1" />
        {#each series as s}
          {#if s.values[hover] !== undefined}
            <circle cx={xAt(hover)} cy={yAt(s.values[hover])} r="3.5" fill={s.colour} stroke="#07100c" stroke-width="1.5" />
          {/if}
        {/each}
      {/if}
    </svg>
    {#if hover !== null}
      <div
        class="pointer-events-none absolute top-2 z-10 min-w-[130px] rounded-xl border border-white/10 bg-pitch-950/95 px-3 py-2 shadow-xl backdrop-blur"
        style={`left:${Math.min(Math.max(8, (xAt(hover) / width) * 100), 72)}%`}
      >
        <div class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-fog-dim">{labels[hover] ?? `Point ${hover + 1}`}</div>
        {#each series as s}
          <div class="flex items-center justify-between gap-3 text-[11.5px]">
            <span class="flex items-center gap-1.5 text-fog"><span class="h-1.5 w-1.5 rounded-full" style={`background:${s.colour}`}></span>{s.name}</span>
            <span class="num font-semibold text-white">{yFormat(s.values[hover] ?? 0)}</span>
          </div>
        {/each}
        {#if tooltipFormat}<div class="mt-1 border-t border-white/10 pt-1 text-[10.5px] text-fog">{tooltipFormat(hover)}</div>{/if}
      </div>
    {/if}
  </div>
</div>
