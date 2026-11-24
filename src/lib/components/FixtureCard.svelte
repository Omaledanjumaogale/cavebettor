<script lang="ts">
  import { LEAGUE_MAP } from '#lib/data/catalog';
  import { awayTeam, fixtureLeague, homeTeam } from '#lib/data/registry';
  import type { Fixture } from '#lib/types';
  import type { PredictionCard } from '#lib/snapshot';
  import { countdown, formatKickoff, formatTime } from '#lib/format';
  import TeamBadge from './TeamBadge.svelte';
  import ProbabilityBar from './ProbabilityBar.svelte';
  import ConfidenceMeter from './ConfidenceMeter.svelte';

  let { fixture, prediction, compact = false }: { fixture: Fixture; prediction: PredictionCard; compact?: boolean } = $props();
  const league = $derived(fixtureLeague(fixture));
  const home = $derived(homeTeam(fixture));
  const away = $derived(awayTeam(fixture));
  const live = $derived(fixture.status === 'live' || fixture.status === 'halftime');
  const finished = $derived(fixture.status === 'finished');
  const topPick = $derived(prediction.valueBets[0]);
</script>

<a
  href={`/fixtures/${fixture.id}`}
  class="panel panel-hover group relative block overflow-hidden p-4"
  aria-label={`${home.name} vs ${away.name} analysis`}
>
  <div class="mb-3 flex items-center justify-between gap-2">
    <div class="flex min-w-0 items-center gap-2">
      <span class="h-4 w-1 shrink-0 rounded-full" style={`background:${league?.colour ?? '#c9ff4d'}`}></span>
      <span class="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fog">{league?.shortName}</span>
      <span class="hidden truncate text-[10px] text-fog-dim sm:inline">· {fixture.round}</span>
    </div>
    {#if live}
      <span class="chip chip-mint shrink-0 !py-0.5">
        <span class="live-dot h-1.5 w-1.5 rounded-full bg-mint"></span>
        {fixture.period} · {fixture.minute}′
      </span>
    {:else if finished}
      <span class="chip shrink-0 !py-0.5">Full time</span>
    {:else}
      <span class="shrink-0 text-right text-[10.5px] font-medium text-fog">{formatKickoff(fixture.kickoff)}</span>
    {/if}
  </div>

  <div class="space-y-2">
    <div class="flex items-center justify-between gap-3">
      <TeamBadge team={home} size={26} showName />
      <span class={`num shrink-0 text-[17px] font-bold ${finished || live ? 'text-white' : 'text-fog-dim'}`}>{finished || live ? fixture.score.home : ''}</span>
    </div>
    <div class="flex items-center justify-between gap-3">
      <TeamBadge team={away} size={26} showName />
      <span class={`num shrink-0 text-[17px] font-bold ${finished || live ? 'text-white' : 'text-fog-dim'}`}>{finished || live ? fixture.score.away : ''}</span>
    </div>
  </div>

  <div class="mt-3.5">
    <ProbabilityBar
      home={prediction.probabilities.home}
      draw={prediction.probabilities.draw}
      away={prediction.probabilities.away}
      homeLabel={home.shortName}
      awayLabel={away.shortName}
      compact={compact}
    />
  </div>

  <div class="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.055] pt-3">
    <div class="min-w-0">
      {#if topPick}
        <div class="truncate text-[11.5px] font-semibold text-white">{topPick.selection}</div>
        <div class="mt-0.5 flex items-center gap-1.5 text-[10px]">
          <span class="num font-semibold text-lime">{topPick.odds.toFixed(2)}</span>
          <span class="text-fog-dim">·</span>
          <span class="num font-semibold text-mint">+{(topPick.edge * 100).toFixed(1)}% edge</span>
        </div>
      {:else}
        <div class="truncate text-[11.5px] font-medium text-fog">{prediction.recommended.selection}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">No value above threshold</div>
      {/if}
    </div>
    <ConfidenceMeter value={prediction.confidence} size="sm" showLabel={false} />
  </div>
</a>
