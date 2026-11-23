<script lang="ts">
  let {
    values,
    width = 120,
    height = 36,
    colour = '#c9ff4d',
    fill = true,
    strokeWidth = 2
  }: {
    values: number[];
    width?: number;
    height?: number;
    colour?: string;
    fill?: boolean;
    strokeWidth?: number;
  } = $props();

  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  const bounds = $derived.by(() => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.14 || 1;
    return { min: min - pad, max: max + pad };
  });
  const pts = $derived(
    values.map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * width;
      const y = height - ((v - bounds.min) / Math.max(0.0001, bounds.max - bounds.min)) * height;
      return [x, y] as const;
    })
  );
  const path = $derived(pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
  const area = $derived(`${path} L${width},${height} L0,${height} Z`);
  const last = $derived(pts[pts.length - 1] ?? [0, 0]);
</script>

<svg {width} {height} viewBox={`0 0 ${width} ${height}`} class="overflow-visible" aria-hidden="true">
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color={colour} stop-opacity="0.32" />
      <stop offset="100%" stop-color={colour} stop-opacity="0" />
    </linearGradient>
  </defs>
  {#if fill}
    <path d={area} fill={`url(#${id})`} />
  {/if}
  <path d={path} fill="none" stroke={colour} stroke-width={strokeWidth} stroke-linecap="round" stroke-linejoin="round" />
  <circle cx={last[0]} cy={last[1]} r="2.6" fill={colour} />
</svg>
