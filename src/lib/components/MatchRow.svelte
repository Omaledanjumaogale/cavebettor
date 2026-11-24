<script lang="ts">
  import { awayTeam, fixtureLeague, homeTeam } from '#lib/data/registry';
  import type { Fixture } from '#lib/types';
  import type { PredictionCard } from '#lib/snapshot';
  import { formatKickoff } from '#lib/format';
  import { ChevronRight, MapPin, Radio } from '@lucide/svelte';
  import TeamBadge from './TeamBadge.svelte';
  import TeamNameLink from './TeamNameLink.svelte';

  let { fixture, prediction }: { fixture: Fixture; prediction: PredictionCard } = $props();

  const league = $derived(fixtureLeague(fixture));
  const home = $derived(homeTeam(fixture));
  const away = $derived(awayTeam(fixture));
  const live = $derived(fixture.status === 'live' || fixture.status === 'halftime');
  const finished = $derived(fixture.status === 'finished');
  const pick = $derived(prediction.valueBets[0]);
  const kickoffDate = $derived(new Date(fixture.kickoff));
  const dayLabel = $derived(kickoffDate.toLocaleDateString('en-NG', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }));
  const timeLabel = $derived(kickoffDate.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false }));
</script>

<!--
  Fixture card. The row itself is not a link: the team names link to their
  profile and carry a copy button, so the card cannot nest interactive
  elements. The whole card is still clickable via the details affordance.
-->
<div class={`group relative grid grid-cols-[46px_1fr_auto] items-start gap-2.5 border-b border-white/[0.045] px-3 py-3 transition hover:bg-white/[0.03] sm:grid-cols-[72px_1fr_150px_auto] sm:gap-3`}>
  <!-- Date / status column -->
  <div class="min-w-0">
    {#if live}
      <div class="flex items-center gap-1 text-[10px] font-bold text-mint"><span class="live-dot h-1.5 w-1.5 rounded-full bg-mint"></span>LIVE</div>
      <div class="num mt-0.5 text-[11px] text-white/85">{fixture.minute ? `${fixture.minute}′` : (fixture.period || '—')}</div>
      {#if fixture.score}<div class="num mt-0.5 text-[11px] font-bold text-lime">{fixture.score.home}–{fixture.score.away}</div>{/if}
    {:else if finished}
      <div class="text-[10px] font-semibold uppercase tracking-wide text-fog-dim">FT</div>
      <div class="num mt-0.5 text-[11.5px] font-bold text-white/80">{fixture.score.home}–{fixture.score.away}</div>
    {:else}
      <div class="num text-[12px] font-bold text-white">{timeLabel}</div>
      <div class="mt-0.5 text-[9px] leading-tight text-fog-dim">{dayLabel}</div>
    {/if}
  </div>

  <!-- Competition + teams -->
  <div class="min-w-0">
    <div class="mb-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9.5px] uppercase tracking-[0.08em] text-fog-dim">
      <span class="h-2 w-1 shrink-0 rounded-full" style={`background:${league?.colour}`}></span>
      <span class="truncate font-semibold text-fog">{league?.name ?? fixture.leagueId}</span>
      {#if league?.country}<span class="shrink-0">· {league.country}</span>{/if}
      {#if fixture.round}<span class="hidden shrink-0 md:inline">· {fixture.round}</span>{/if}
    </div>

    <div class="grid gap-1">
      <div class="flex min-w-0 items-center justify-between gap-2">
        <span class="flex min-w-0 items-center gap-1.5">
          <TeamBadge team={home} size={20} />
          <TeamNameLink team={home} />
        </span>
        {#if live || finished}<span class="num shrink-0 text-[12.5px] font-bold text-white">{fixture.score.home}</span>{/if}
      </div>
      <div class="flex min-w-0 items-center justify-between gap-2">
        <span class="flex min-w-0 items-center gap-1.5">
          <TeamBadge team={away} size={20} />
          <TeamNameLink team={away} />
        </span>
        {#if live || finished}<span class="num shrink-0 text-[12.5px] font-bold text-white">{fixture.score.away}</span>{/if}
      </div>
    </div>

    <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] text-fog-dim">
      <span class="inline-flex items-center gap-0.5"><MapPin size={9} /> {fixture.venue}</span>
      {#if live}<span class="inline-flex items-center gap-0.5 text-mint"><Radio size={9} /> in play</span>{/if}
    </div>
  </div>

  <!-- Probability bar (desktop) -->
  <div class="hidden items-center sm:flex">
    <div class="w-full">
      <div class="mb-1 flex justify-between gap-1 text-[9.5px] text-fog-dim">
        <span class="truncate">{home.name}</span><span class="truncate text-right">{away.name}</span>
      </div>
      <div class="flex h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div class="h-full bg-lime" style={`width:${prediction.probabilities.home * 100}%`}></div>
        <div class="h-full bg-white/20" style={`width:${prediction.probabilities.draw * 100}%`}></div>
        <div class="h-full bg-sky" style={`width:${prediction.probabilities.away * 100}%`}></div>
      </div>
      <div class="num mt-1 flex justify-between text-[10px] text-white/70">
        <span>{(prediction.probabilities.home * 100).toFixed(0)}%</span>
        <span class="text-fog-dim">M {prediction.confidence}</span>
        <span>{(prediction.probabilities.away * 100).toFixed(0)}%</span>
      </div>
    </div>
  </div>

  <!-- Top model call + details -->
  <div class="flex items-center gap-2">
    <div class="min-w-[68px] text-right sm:min-w-[92px]">
      {#if pick}
        <div class="truncate text-[9px] font-semibold uppercase tracking-wide text-fog-dim" title={pick.selection}>{pick.selection}</div>
        <div class="num text-[13px] font-bold text-lime">{pick.odds.toFixed(2)}</div>
        <div class="num text-[10px] font-semibold text-mint">{(pick.modelProbability * 100).toFixed(0)}% · +{(pick.edge * 100).toFixed(1)}%</div>
      {:else}
        <div class="text-[9px] font-semibold uppercase tracking-wide text-fog-dim">Model pick</div>
        <div class="num text-[13px] font-bold text-white">{prediction.recommended.odds.toFixed(2)}</div>
        <div class="num text-[10px] text-fog-dim">{(prediction.recommended.modelProbability * 100).toFixed(0)}%</div>
      {/if}
    </div>
    <a
      href={`/fixtures/${fixture.id}`}
      class="btn-icon !h-8 !w-8 shrink-0"
      aria-label={`Open analysis for ${home.name} versus ${away.name}`}
    >
      <ChevronRight size={14} />
    </a>
  </div>
</div>
