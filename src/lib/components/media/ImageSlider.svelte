<script lang="ts">
  import { ChevronLeft, ChevronRight, ArrowRight } from '@lucide/svelte';
  import ResponsiveImage from './ResponsiveImage.svelte';

  export interface SliderSlide {
    id: string;
    image: string;
    alt: string;
    headline: string;
    subhead: string;
    keywords: string[];
    primary: { label: string; href: string };
    secondary: { label: string; href: string };
  }

  let { slides }: { slides: SliderSlide[] } = $props();

  let index = $state(0);

  const current = $derived(slides[index]);
  const count = $derived(slides.length);

  function go(next: number) {
    index = (next + count) % count;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    }
  }
</script>

<section
  class="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-pitch-950"
  aria-roledescription="carousel"
  aria-label="CaveBettor highlights"
>
  <div class="grid lg:grid-cols-[1.05fr_0.95fr]">
    <!-- Copy side -->
    <div class="relative z-10 flex flex-col justify-between gap-8 px-6 py-10 sm:px-10 sm:py-14">
      <div>
        <span class="chip chip-lime"><span class="h-1.5 w-1.5 rounded-full bg-lime"></span> Live intelligence</span>
        <h2 class="display mt-5 text-[26px] font-bold leading-[1.15] tracking-tight text-white sm:text-[34px]">
          {current.headline}
        </h2>
        <p class="mt-3 max-w-md text-[13px] leading-relaxed text-fog">{current.subhead}</p>

        <ul class="mt-5 flex flex-wrap gap-2">
          {#each current.keywords as keyword}
            <li class="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-medium text-fog">{keyword}</li>
          {/each}
        </ul>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <a href={current.primary.href} class="btn btn-primary !py-2.5 text-[11.5px] font-semibold">
          {current.primary.label} <ArrowRight size={14} />
        </a>
        <a href={current.secondary.href} class="btn btn-ghost !py-2.5 text-[11.5px]">{current.secondary.label}</a>
      </div>
    </div>

    <!-- Image side -->
    <div class="relative min-h-[240px] overflow-hidden lg:min-h-[420px]">
      {#each slides as slide, i}
        <div
          class="absolute inset-0 transition-opacity duration-500 {i === index ? 'opacity-100' : 'opacity-0'}"
          aria-hidden={i !== index}
        >
          <ResponsiveImage
            src={slide.image}
            alt={slide.alt}
            width={1248}
            height={832}
            sizes="(max-width: 1024px) 100vw, 48vw"
            eager={i === 0}
            class="absolute inset-0"
          />
          <div class="absolute inset-0 bg-gradient-to-r from-pitch-950 via-pitch-950/55 to-pitch-950/10"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-pitch-950/90 via-transparent to-transparent"></div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Controls -->
  <div class="relative z-10 flex items-center justify-between border-t border-white/[0.06] px-5 py-3 sm:px-10">
    <div class="flex items-center gap-2" role="tablist" aria-label="Choose a highlight">
      {#each slides as slide, i}
        <button
          type="button"
          role="tab"
          aria-selected={i === index}
          aria-label={`Show highlight ${i + 1}: ${slide.headline}`}
          class="h-1.5 rounded-full transition-all duration-300 {i === index ? 'w-7 bg-lime' : 'w-3 bg-white/20 hover:bg-white/40'}"
          onclick={() => go(i)}
        ></button>
      {/each}
    </div>

    <div class="flex items-center gap-2">
      <span class="sr-only" aria-live="polite">Slide {index + 1} of {count}</span>
      <button
        type="button"
        class="btn btn-ghost !px-2 !py-1.5"
        aria-label="Previous highlight"
        onkeydown={onKeydown}
        onclick={() => go(index - 1)}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        class="btn btn-ghost !px-2 !py-1.5"
        aria-label="Next highlight"
        onkeydown={onKeydown}
        onclick={() => go(index + 1)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  </div>
</section>

<style>
  @media (prefers-reduced-motion: reduce) {
    :global(.transition-opacity) {
      transition: none !important;
    }
  }
</style>
