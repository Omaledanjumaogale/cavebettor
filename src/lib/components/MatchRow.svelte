<script lang="ts">
  import { LEAGUE_MAP, TEAM_MAP } from '#lib/data/catalog';
  import type { Fixture, Prediction } from '#lib/types';
  import { formatKickoff } from '#lib/format';
  import TeamBadge from './TeamBadge.svelte';

  let { fixture, prediction }: { fixture: Fixture; prediction: Prediction } = $props();
  const league = $derived(LEAGUE_MAP[fixture.leagueId]);
  const home = $derived(TEAM_MAP[fixture.homeId]);
  const away = $derived(TEAM_MAP[fixture.awayId]);
  const live = $derived(fixture.status === 'live' || fixture.status === 'halftime');
  const finished = $derived(fixture.status === 'finished');
  const pick = $derived(prediction.valueBets[0]);
</script>

<a href={`/fixtures/${fixture.id}`} class="group grid grid-cols-[64px_1fr_auto] items-center gap-3 border-b border-white/[0.045] px-3 py-3 transition hover:bg-white/[0.03] sm:grid-cols-[84px_1fr_190px_auto]">
  <div>
    {#if live}
      <div class="flex items-center gap-1.5 text-[10.5px] font-bold text-mint">
        <span class="live-dot h-1.5 w-1.5 rounded-full bg-mint"></span>LIVE
      </div>
      <div class="num mt-0.5 text-[11px] text-white/80">{fixture.minute}′</div>
    {:else if finished}
      <div class="text-[10.5px] font-semibold uppercase tracking-wide text-fog-dim">FT</div>
      <div class="num mt-0.5 text-[11px] text-white/60">{fixture.score.home}–{fixture.score.away}</div>
    {:else}
      <div class="num text-[11.5px] font-semibold text-white/85">{formatKickoff(fixture.kickoff).split(' ').slice(-1)}</div>
      <div class="mt-0.5 text-[9.5px] text-fog-dim">{new Date(fixture.kickoff).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })}</div>
    {/if}
  </div>

  <div class="min-w-0">
    <div class="mb-1 flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.1em] text-fog-dim">
      <span class="h-2 w-1 rounded-full" style={`background:${league?.colour}`}></span>{league?.shortName}
      <span class="hidden sm:inline">· {fixture.round}</span>
    </div>
    <div class="grid gap-1">
      <div class="flex items-center justify-between gap-2">
        <TeamBadge team={home} size={20} showName />
        {#if live || finished}<span class="num text-[12.5px] font-bold text-white">{fixture.score.home}</span>{/if}
      </div>
      <div class="flex items-center justify-between gap-2">
        <TeamBadge team={away} size={20} showName />
        {#if live || finished}<span class="num text-[12.5px] font-bold text-white">{fixture.score.away}</span>{/if}
      </div>
    </div>
  </div>

  <div class="hidden items-center gap-3 sm:flex">
    <div class="w-full">
      <div class="mb-1 flex justify-between text-[9.5px] text-fog-dim">
        <span>{home.shortName}</span><span>{away.shortName}</span>
      </div>
      <div class="flex h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div class="h-full bg-lime" style={`width:${prediction.probabilities.home * 100}%`}></div>
        <div class="h-full bg-white/20" style={`width:${prediction.probabilities.draw * 100}%`}></div>
        <div class="h-full bg-sky" style={`width:${prediction.probabilities.away * 100}%`}></div>
      </div>
      <div class="mt-1 flex justify-between text-[10px] num text-white/70">
        <span>{(prediction.probabilities.home * 100).toFixed(0)}%</span>
        <span class="text-fog-dim">M {prediction.confidence}</span>
        <span>{(prediction.probabilities.away * 100).toFixed(0)}%</span>
      </div>
    </div>
  </div>

  <div class="min-w-[92px] text-right">
    {#if pick}
      <div class="text-[10px] font-semibold uppercase tracking-wide text-fog-dim">Best edge</div>
      <div class="num text-[13px] font-bold text-lime">{pick.odds.toFixed(2)}</div>
      <div class="text-[10px] font-semibold text-mint">+{(pick.edge * 100).toFixed(1)}%</div>
    {:else}
      <div class="text-[10px] font-semibold uppercase tracking-wide text-fog-dim">Model pick</div>
      <div class="num text-[13px] font-bold text-white">{prediction.recommended.odds.toFixed(2)}</div>
      <div class="text-[10px] text-fog-dim">{prediction.confidence}% conf.</div>
    {/if}
  </div>
</a>
