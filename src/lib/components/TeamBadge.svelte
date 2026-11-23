<script lang="ts">
  import { LEAGUE_MAP } from '#lib/data/catalog';
  import type { Team } from '#lib/types';
  let { team, size = 30, showName = false }: { team: Team; size?: number; showName?: boolean } = $props();
  const league = $derived(LEAGUE_MAP[team.leagueId]);
  const bg = $derived(`linear-gradient(140deg, ${league?.colour ?? '#18332a'}, #0b1712)`);
</script>

<span class="inline-flex min-w-0 items-center gap-2">
  <span
    class="relative inline-flex shrink-0 items-center justify-center rounded-full border border-white/15 font-display font-bold tracking-tight text-white"
    style={`width:${size}px;height:${size}px;background:${bg};font-size:${Math.max(8, size * 0.32)}px`}
    title={team.name}
  >
    {team.shortName.slice(0, 3)}
    <span class="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-pitch-900" style={`background:${league?.colour ?? '#35e7a1'}`}></span>
  </span>
  {#if showName}<span class="truncate text-[12.5px] font-medium text-white/85">{team.name}</span>{/if}
</span>
