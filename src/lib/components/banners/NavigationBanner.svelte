<script lang="ts">
  import { ArrowUpRight } from '@lucide/svelte';
  import type { NavigationBanner } from '#lib/config/navigation-banners';

  let { banner }: { banner: NavigationBanner } = $props();

  const palettes: Record<string, { ring: string; text: string; glow: string }> = {
    primary: { ring: 'border-lime/25', text: 'text-lime', glow: 'rgba(201,255,77,0.18)' },
    secondary: { ring: 'border-mint/25', text: 'text-mint', glow: 'rgba(53,231,161,0.18)' },
    amber: { ring: 'border-amber/25', text: 'text-amber', glow: 'rgba(246,196,83,0.16)' },
    violet: { ring: 'border-violet/25', text: 'text-violet', glow: 'rgba(169,155,255,0.16)' }
  };

  const palette = $derived(palettes[banner.theme] ?? palettes.primary);
</script>

<aside
  class="group relative overflow-hidden rounded-2xl border {palette.ring} bg-pitch-900/70 shadow-panel transition duration-300 hover:border-lime/40"
  style={`--glow:${palette.glow}`}
>
  <img
    src={banner.artwork}
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
    class="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45 transition duration-500 group-hover:opacity-70"
  />
  <div class="absolute inset-0 bg-gradient-to-r from-pitch-950/92 via-pitch-950/70 to-pitch-950/25"></div>

  <div class="relative flex flex-col gap-4 px-5 py-7 sm:px-8 sm:py-8 md:flex-row md:items-center md:justify-between">
    <div class="max-w-xl">
      <p class="text-[10px] font-semibold uppercase tracking-[0.24em] {palette.text}">CaveBettor</p>
      <h3 class="display mt-2 text-[20px] font-bold leading-tight tracking-tight text-white sm:text-[24px]">{banner.inscription}</h3>
      <p class="mt-2 text-[12px] leading-relaxed text-fog">{banner.subline}</p>
    </div>
    <a
      href={banner.href}
      class="btn btn-ghost shrink-0 !py-2.5 text-[11.5px] font-semibold transition group-hover:border-lime/40 group-hover:text-white"
    >
      {banner.cta} <ArrowUpRight size={14} />
    </a>
  </div>
</aside>
