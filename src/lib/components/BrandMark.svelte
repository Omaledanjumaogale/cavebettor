<script lang="ts">
  let { size = 36, withWordmark = false }: { size?: number; withWordmark?: boolean } = $props();
</script>

<span class="inline-flex items-center gap-2.5">
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="cave-tunnel" x1="8" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
        <stop stop-color="#1c3a2e" />
        <stop offset="1" stop-color="#0a1712" />
      </linearGradient>
      <linearGradient id="cave-accent" x1="16" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
        <stop stop-color="#e2ff9e" />
        <stop offset="0.55" stop-color="#c9ff4d" />
        <stop offset="1" stop-color="#35e7a1" />
      </linearGradient>
    </defs>
    <rect x="1.5" y="1.5" width="61" height="61" rx="17" fill="url(#cave-tunnel)" stroke="rgba(201,255,77,0.32)" stroke-width="1.5" />
    <path d="M17 46V32a15 15 0 0 1 30 0v14" stroke="url(#cave-accent)" stroke-width="4.2" stroke-linecap="round" />
    <path d="M25 46V33.5a7 7 0 0 1 14 0V46" stroke="rgba(53,231,161,0.45)" stroke-width="2.4" stroke-linecap="round" />
    <path d="M32 46V29" stroke="#f6c453" stroke-width="2.4" stroke-linecap="round" />
    <circle cx="32" cy="24.5" r="3.2" fill="#c9ff4d" />
    <path d="M13 50h38" stroke="rgba(201,255,77,0.22)" stroke-width="1.4" stroke-linecap="round" />
  </svg>
  {#if withWordmark}
    <span class="flex flex-col leading-none">
      <span class="display text-[17px] font-bold tracking-tight text-white">Cave<span class="text-lime">Bettor</span></span>
      <span class="mt-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-fog-dim">Sports intelligence</span>
    </span>
  {/if}
</span>
