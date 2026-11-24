<script lang="ts">
  import { ArrowLeft, CalendarDays, ChevronRight, CircleDot, Radio, TrendingUp } from '@lucide/svelte';
  import TeamBadge from '#lib/components/TeamBadge.svelte';
  import { formatKickoff, relativeTime } from '#lib/format';

  let { data } = $props();
  const team = $derived(data.team);
  const league = $derived(data.league);
</script>

<svelte:head><title>{team.name} — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <a href="/fixtures" class="inline-flex items-center gap-1.5 text-[11.5px] text-fog hover:text-white"><ArrowLeft size={13} /> Back to fixtures</a>

  <div class="panel relative overflow-hidden p-4 sm:p-5">
    <div class="mesh pointer-events-none absolute inset-0 opacity-40"></div>
    <div class="relative flex flex-wrap items-start justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <TeamBadge team={team} size={52} />
        <div class="min-w-0">
          <h1 class="display truncate text-[20px] font-bold text-white sm:text-[26px]">{team.name}</h1>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-fog">
            {#if league}
              <span class="chip !px-2 !py-0.5 !text-[10px]"><span class="h-1.5 w-1.5 rounded-full" style={`background:${league.colour}`}></span>{league.name}</span>
              <span>{league.country}</span>
            {/if}
            <span class="chip !px-2 !py-0.5 !text-[10px]">{team.sport}</span>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        {#each [['Elo', Math.round(team.elo)], ['Attack', team.attack.toFixed(2)], ['Defence', team.defence.toFixed(2)]] as [label, value]}
          <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
            <div class="num text-[15px] font-bold text-lime">{value}</div>
            <div class="text-[9px] uppercase tracking-[0.12em] text-fog-dim">{label}</div>
          </div>
        {/each}
      </div>
    </div>

    <div class="relative mt-4 grid gap-2.5 sm:grid-cols-3">
      <div class="rounded-xl border border-white/[0.07] bg-black/15 p-3">
        <div class="stat-label">Recent form</div>
        <div class="mt-1.5 flex gap-1">
          {#each team.form as result}
            <span class={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold ${result === 'W' ? 'bg-mint/15 text-mint' : result === 'D' ? 'bg-white/10 text-white/70' : 'bg-rose/15 text-rose'}`}>{result}</span>
          {/each}
        </div>
      </div>
      <div class="rounded-xl border border-white/[0.07] bg-black/15 p-3">
        <div class="stat-label">Expected goals</div>
        <div class="num mt-1 text-[13px] text-white">{team.xgFor.toFixed(2)} <span class="text-fog-dim">for</span> · {team.xgAgainst.toFixed(2)} <span class="text-fog-dim">against</span></div>
      </div>
      <div class="rounded-xl border border-white/[0.07] bg-black/15 p-3">
        <div class="stat-label">Fixtures on file</div>
        <div class="num mt-1 text-[13px] text-white">{data.record.upcoming.length} upcoming · {data.record.finished.length} finished</div>
      </div>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-2">
    <div class="panel overflow-hidden">
      <div class="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
        <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"><CalendarDays size={12} class="text-lime" /> Upcoming</div>
        <span class="text-[10px] text-fog-dim">{data.meta.updatedAt ? `synced ${relativeTime(data.meta.updatedAt)}` : 'awaiting sync'}</span>
      </div>
      {#if data.record.upcoming.length}
        {#each data.record.upcoming as row}
          <a href={`/fixtures/${row.id}`} class="flex items-center justify-between gap-3 border-b border-white/[0.04] px-3.5 py-2.5 transition hover:bg-white/[0.03]">
            <div class="min-w-0">
              <div class="truncate text-[12px] text-white">{row.home} <span class="text-fog-dim">vs</span> {row.away}</div>
              <div class="truncate text-[10px] text-fog-dim">{row.league} · {row.country}</div>
            </div>
            <div class="shrink-0 text-right">
              <div class="num text-[11.5px] text-white">{formatKickoff(row.kickoff)}</div>
              <div class="text-[9.5px] text-fog-dim">{row.status}</div>
            </div>
            <ChevronRight size={12} class="shrink-0 text-fog-dim" />
          </a>
        {/each}
      {:else}
        <p class="px-3.5 py-4 text-[11.5px] text-fog">No upcoming fixture for this team in the current collection window.</p>
      {/if}
    </div>

    <div class="panel overflow-hidden">
      <div class="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
        <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"><CircleDot size={12} class="text-mint" /> Results &amp; in-play</div>
        <span class="text-[10px] text-fog-dim">{data.record.live.length} live</span>
      </div>
      {#if data.record.live.length || data.record.finished.length}
        {#each [...data.record.live, ...data.record.finished] as row}
          <a href={`/fixtures/${row.id}`} class="flex items-center justify-between gap-3 border-b border-white/[0.04] px-3.5 py-2.5 transition hover:bg-white/[0.03]">
            <div class="min-w-0">
              <div class="truncate text-[12px] text-white">{row.home} <span class="text-fog-dim">vs</span> {row.away}</div>
              <div class="truncate text-[10px] text-fog-dim">{row.league}</div>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              {#if row.status === 'live' || row.status === 'halftime'}
                <span class="chip chip-rose !px-1.5 !py-0.5 !text-[9px]"><Radio size={8} /> LIVE</span>
              {/if}
              <span class="num text-[13px] font-bold text-white">{row.homeScore}–{row.awayScore}</span>
            </div>
          </a>
        {/each}
      {:else}
        <p class="px-3.5 py-4 text-[11.5px] text-fog">No completed or in-play fixture for this team right now.</p>
      {/if}
    </div>
  </div>

  {#if data.record.prediction}
    <div class="panel p-4">
      <div class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"><TrendingUp size={12} class="text-lime" /> Next-fixture model read</div>
      <p class="text-[12px] leading-relaxed text-fog">{data.record.prediction}</p>
    </div>
  {/if}
</div>
