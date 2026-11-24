<script lang="ts">
  /**
   * Lightweight brand motion graphic: an animated ambient field of drifting
   * nodes and connecting lines, rendered entirely with SVG and CSS so it stays
   * a few kilobytes and never blocks the critical path.
   *
   * It pauses automatically when the visitor prefers reduced motion.
   */
  let {
    variant = 'grid',
    class: className = ''
  }: { variant?: 'grid' | 'flow' | 'pulse'; class?: string } = $props();

  const nodes = [
    { x: 12, y: 22 }, { x: 28, y: 62 }, { x: 44, y: 30 }, { x: 58, y: 74 },
    { x: 70, y: 18 }, { x: 82, y: 52 }, { x: 38, y: 84 }, { x: 90, y: 30 },
    { x: 18, y: 76 }, { x: 64, y: 44 }, { x: 50, y: 12 }, { x: 76, y: 86 }
  ];
</script>

<div class="motion-root {className}" aria-hidden="true">
  {#if variant === 'grid'}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 h-full w-full">
      <defs>
        <pattern id="cb-grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M10 0H0V10" fill="none" stroke="rgba(201,255,77,0.08)" stroke-width="0.25" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#cb-grid)" />
      <g class="drift">
        {#each nodes as node, i}
          <circle cx={node.x} cy={node.y} r="0.55" fill="#c9ff4d" opacity={0.25 + (i % 4) * 0.15} />
        {/each}
      </g>
    </svg>
  {:else if variant === 'flow'}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 h-full w-full">
      <g stroke="#35e7a1" stroke-opacity="0.16" fill="none" stroke-width="0.3">
        {#each nodes as node, i}
          {@const next = nodes[(i + 1) % nodes.length]}
          <path d={`M${node.x} ${node.y} Q${(node.x + next.x) / 2} ${Math.max(4, Math.min(96, (node.y + next.y) / 2 - 8))} ${next.x} ${next.y}`} />
        {/each}
      </g>
      <g class="drift">
        {#each nodes as node, i}
          <circle cx={node.x} cy={node.y} r="0.7" fill="#35e7a1" opacity={0.3 + (i % 3) * 0.2} />
        {/each}
      </g>
    </svg>
  {:else}
    <svg viewBox="0 0 100 100" class="absolute inset-0 h-full w-full">
      <g fill="none" stroke="#c9ff4d">
        <circle class="ring ring-1" cx="50" cy="50" r="18" stroke-opacity="0.35" />
        <circle class="ring ring-2" cx="50" cy="50" r="18" stroke-opacity="0.25" />
        <circle class="ring ring-3" cx="50" cy="50" r="18" stroke-opacity="0.18" />
      </g>
      <circle cx="50" cy="50" r="4" fill="#c9ff4d" opacity="0.7" />
    </svg>
  {/if}
</div>

<style>
  .motion-root {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .drift {
    animation: cb-drift 26s linear infinite;
    transform-origin: center;
  }

  .ring {
    transform-origin: 50% 50%;
    animation: cb-pulse 5.5s ease-out infinite;
  }
  .ring-2 {
    animation-delay: 1.8s;
  }
  .ring-3 {
    animation-delay: 3.6s;
  }

  @keyframes cb-drift {
    0% {
      transform: translate3d(0, 0, 0);
    }
    50% {
      transform: translate3d(-3%, 2%, 0);
    }
    100% {
      transform: translate3d(0, 0, 0);
    }
  }

  @keyframes cb-pulse {
    0% {
      transform: scale(0.6);
      opacity: 0.6;
    }
    100% {
      transform: scale(2.6);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drift,
    .ring {
      animation: none;
    }
  }
</style>
