<script lang="ts">
  import ResponsiveImage from '../media/ResponsiveImage.svelte';

  export interface StoryStage {
    id: string;
    image: string;
    alt: string;
    label: string;
    title: string;
    body: string;
  }

  let { stages }: { stages: StoryStage[] } = $props();
</script>

<section aria-labelledby="story-heading" class="space-y-7">
  <div class="max-w-2xl">
    <span class="chip chip-lime">How the desk works</span>
    <h2 id="story-heading" class="display mt-4 text-[24px] font-bold leading-tight tracking-tight text-white sm:text-[30px]">
      You are the analyst. CaveBettor is the guide.
    </h2>
    <p class="mt-2.5 text-[13px] leading-relaxed text-fog">
      Six steps from raw fixture noise to a decision you can explain, price and record in Naira.
    </p>
  </div>

  <ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each stages as stage, i}
      <li class="panel panel-hover relative overflow-hidden">
        <div class="relative aspect-[16/10] overflow-hidden">
          <ResponsiveImage
            src={stage.image}
            alt={stage.alt}
            width={1248}
            height={832}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            class="absolute inset-0"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-pitch-950 via-pitch-950/25 to-transparent"></div>
          <span class="absolute left-3 top-3 rounded-lg border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-lime backdrop-blur-sm">
            {stage.label}
          </span>
        </div>
        <div class="px-4 py-4">
          <h3 class="text-[13.5px] font-semibold text-white">{stage.title}</h3>
          <p class="mt-1.5 text-[11.5px] leading-relaxed text-fog">{stage.body}</p>
        </div>
        <span class="pointer-events-none absolute -right-2 -top-4 display text-[64px] font-bold text-white/[0.04]">{i + 1}</span>
      </li>
    {/each}
  </ol>
</section>
