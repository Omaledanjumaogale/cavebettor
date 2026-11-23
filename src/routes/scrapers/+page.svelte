<script lang="ts">
  import { Database, Play, ExternalLink, CheckCircle2, AlertTriangle, XCircle, KeyRound, RefreshCw, Clock, Server, Globe, GitBranch, Activity, ShieldCheck, ArrowUpRight, Terminal } from '@lucide/svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import Gauge from '#lib/components/Gauge.svelte';
  import Sparkline from '#lib/components/Sparkline.svelte';
  import { relativeTime, formatDate } from '#lib/format';
  import { pct } from '#lib/engine/core';

  let { data } = $props();
  let filter = $state('all');
  let running = $state<string | null>(null);
  let results = $state<any[]>([]);

  const kinds = ['all', 'scraper', 'api', 'repo', 'internal'];
  const shown = $derived(data.sources.filter((s: any) => filter === 'all' || s.kind === filter));

  const statusStyle = (status: string) =>
    status === 'healthy'
      ? { dot: 'bg-mint', text: 'text-mint', label: 'Healthy' }
      : status === 'degraded'
        ? { dot: 'bg-amber', text: 'text-amber', label: 'Degraded' }
        : status === 'needs-key'
          ? { dot: 'bg-sky', text: 'text-sky', label: 'Needs key' }
          : status === 'offline'
            ? { dot: 'bg-rose', text: 'text-rose', label: 'Offline' }
            : { dot: 'bg-fog-dim', text: 'text-fog-dim', label: 'Planned' };

  async function collect(sourceId: string) {
    running = sourceId;
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceId })
      });
      const body = await res.json();
      results = [body, ...results].slice(0, 4);
    } catch {
      results = [{ sourceId, status: 'failed', message: 'Could not reach the collection endpoint.', samples: [], warnings: [] }, ...results];
    } finally {
      running = null;
    }
  }

  const kindIcon = (kind: string) => (kind === 'repo' ? GitBranch : kind === 'api' ? Server : kind === 'internal' ? Activity : Globe);
</script>

<svelte:head><title>Data pipeline — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-mint"><Database size={12} /> Data pipeline</div>
      <h1 class="display text-[26px] font-bold tracking-tight text-white">Collect. Normalise. Improve.</h1>
      <p class="mt-1 max-w-2xl text-[12.5px] text-fog">
        {data.summary.total} harmonised sources: repository adapters, permission-aware collectors and licensed APIs. Every record is validated before it reaches the feature store.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <span class="chip chip-mint"><span class="live-dot h-1.5 w-1.5 rounded-full bg-mint"></span>Scheduler active</span>
      <a href="/api/scrape" target="_blank" class="btn btn-ghost !py-2 text-[11px]">Capabilities <ArrowUpRight size={11} /></a>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
    {#each [
      { label: 'Sources', value: String(data.summary.total), sub: `${data.summary.apis} API · ${data.summary.scrapers} web`, colour: '#c9ff4d' },
      { label: 'Healthy', value: `${data.summary.healthy}`, sub: `${data.summary.degraded} degraded`, colour: '#35e7a1' },
      { label: 'Rows today', value: `${(data.summary.records / 1000).toFixed(1)}k`, sub: 'normalised records', colour: '#6fc9ff' },
      { label: 'Avg coverage', value: `${data.summary.avgCoverage.toFixed(0)}%`, sub: 'of target fields', colour: '#f6c453' },
      { label: 'Reliability', value: `${(data.summary.avgReliability * 100).toFixed(1)}%`, sub: '30-day success rate', colour: '#a99bff' },
      { label: 'Markets', value: String(data.summary.markets), sub: 'per source ceiling', colour: '#ff6478' }
    ] as kpi}
      <div class="panel p-3.5">
        <div class="stat-label">{kpi.label}</div>
        <div class="display num mt-1.5 text-[21px] font-bold" style={`color:${kpi.colour}`}>{kpi.value}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">{kpi.sub}</div>
      </div>
    {/each}
  </div>

  <div class="flex flex-wrap items-center gap-1.5">
    {#each kinds as kind}
      <button onclick={() => (filter = kind)} class={`chip capitalize ${filter === kind ? '!border-lime/35 !bg-lime/10 !text-lime' : ''}`}>{kind}</button>
    {/each}
    <span class="ml-auto flex items-center gap-1.5 text-[10px] text-fog-dim"><ShieldCheck size={11} class="text-mint" /> robots.txt respected · rate-limited · no personal data</span>
  </div>

  <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {#each shown as source}
      {@const style = statusStyle(source.status)}
      <div class="panel panel-hover p-3.5">
        <div class="flex items-start justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-fog">
              {#if source.kind === 'repo'}<GitBranch size={14} />{:else if source.kind === 'api'}<Server size={14} />{:else if source.kind === 'internal'}<Activity size={14} />{:else}<Globe size={14} />{/if}
            </span>
            <div class="min-w-0">
              <div class="truncate text-[11.5px] font-semibold text-white">{source.name}</div>
              <div class="text-[9px] uppercase tracking-[0.12em] text-fog-dim">{source.kind} · {source.sport}</div>
            </div>
          </div>
          <span class={`flex shrink-0 items-center gap-1 text-[9px] font-semibold ${style.text}`}><span class={`h-1.5 w-1.5 rounded-full ${style.dot}`}></span>{style.label}</span>
        </div>

        <p class="mt-2 line-clamp-2 text-[10px] leading-relaxed text-fog">{source.note}</p>

        <div class="mt-2.5">
          <div class="mb-1 flex justify-between text-[9px] text-fog-dim"><span>Coverage</span><span class="num">{source.coverage}%</span></div>
          <div class="h-1 overflow-hidden rounded-full bg-white/[0.06]"><div class="h-full rounded-full" style={`width:${source.coverage}%;background:${source.status === 'healthy' ? '#35e7a1' : source.status === 'needs-key' ? '#6fc9ff' : '#f6c453'}`}></div></div>
        </div>

        <div class="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
          <div class="rounded-md bg-white/[0.03] py-1"><div class="num text-[10.5px] font-semibold text-white">{source.recordsToday.toLocaleString()}</div><div class="text-[8px] text-fog-dim">rows</div></div>
          <div class="rounded-md bg-white/[0.03] py-1"><div class="num text-[10.5px] font-semibold text-white">{source.latencyMs}ms</div><div class="text-[8px] text-fog-dim">latency</div></div>
          <div class="rounded-md bg-white/[0.03] py-1"><div class="num text-[10.5px] font-semibold text-white">{source.markets}</div><div class="text-[8px] text-fog-dim">markets</div></div>
        </div>

        <div class="mt-2.5 flex items-center gap-2">
          <button onclick={() => collect(source.id)} class="btn btn-ghost !px-2.5 !py-1.5 text-[9.5px]" disabled={running !== null}>
            <Play size={9} class={running === source.id ? 'animate-pulse' : ''} /> {running === source.id ? 'Collecting…' : 'Run collection'}
          </button>
          <a href={source.url} target="_blank" rel="noreferrer" class="btn-icon !h-7 !w-7" aria-label={`Open ${source.name}`}><ExternalLink size={11} /></a>
          <span class="ml-auto text-[8.5px] text-fog-dim">{relativeTime(source.lastChecked)}</span>
        </div>
      </div>
    {/each}
  </div>

  <div class="grid gap-4 xl:grid-cols-3">
    <div class="panel overflow-hidden xl:col-span-2">
      <div class="flex items-center justify-between px-4 pb-1 pt-4">
        <SectionHeader title="Recent collection jobs" description="Every run is logged with record counts and rejection reasons" eyebrow="Job history" />
        <span class="chip !text-[9px]">{data.jobs.length} jobs</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Source</th><th>Status</th><th class="text-right">Records</th><th class="text-right">Rejected</th><th class="text-right">Duration</th><th>Started</th></tr></thead>
          <tbody>
            {#each data.jobs as job}
              <tr>
                <td><div class="text-[10.5px] font-medium text-white/85">{data.sources.find((s: any) => s.id === job.sourceId)?.name ?? job.sourceId}</div><div class="max-w-[280px] truncate text-[9px] text-fog-dim">{job.message}</div></td>
                <td><span class={`chip !px-1.5 !py-0 !text-[8.5px] ${job.status === 'succeeded' ? 'chip-mint' : job.status === 'running' ? 'chip-sky' : job.status === 'failed' ? 'chip-rose' : 'chip-amber'}`}>{job.status}</span></td>
                <td class="num text-right text-[10px] text-white/80">{job.records.toLocaleString()}</td>
                <td class="num text-right text-[10px] text-fog">{job.rejected}</td>
                <td class="num text-right text-[10px] text-fog">{(job.durationMs / 1000).toFixed(1)}s</td>
                <td class="text-[9.5px] text-fog-dim">{relativeTime(job.startedAt)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="space-y-4">
      <div class="panel p-4">
        <SectionHeader title="API keys & secrets" description="Configured on the server, never exposed" eyebrow="Connections" />
        <div class="space-y-1.5">
          {#each [
            { key: 'API-Football', ok: data.keys.apiFootball, hint: 'API_FOOTBALL_KEY' },
            { key: 'The Odds API', ok: data.keys.oddsApi, hint: 'THE_ODDS_API_KEY' },
            { key: 'TheSportsDB', ok: data.keys.sportsdb, hint: 'SPORTSDB_KEY' },
            { key: 'BallDontLie', ok: data.keys.balldontlie, hint: 'BALLDONTLIE_KEY' },
            { key: 'LLM analyst', ok: data.keys.llm, hint: 'OPENAI_API_KEY' },
            { key: 'Paystack billing', ok: data.keys.paystack, hint: 'PAYSTACK_SECRET_KEY' }
          ] as row}
            <div class="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-1.5">
              {#if row.ok}<CheckCircle2 size={11} class="shrink-0 text-mint" />{:else}<KeyRound size={11} class="shrink-0 text-fog-dim" />{/if}
              <span class="text-[10.5px] text-white/80">{row.key}</span>
              <span class="ml-auto font-mono text-[8.5px] text-fog-dim">{row.ok ? 'configured' : row.hint}</span>
            </div>
          {/each}
        </div>
        <a href="/settings" class="mt-2.5 flex items-center gap-1 text-[10px] font-semibold text-lime hover:underline">Manage connections in settings <ArrowUpRight size={10} /></a>
      </div>

      <div class="panel p-4">
        <SectionHeader title="Collection schedule" description="Serverless cron and worker cadence" eyebrow="Automation" />
        <div class="space-y-2 text-[10px]">
          {#each [
            ['Live odds + scores', 'every 30 seconds'],
            ['Fixtures and team news', 'every 15 minutes'],
            ['Closing-line capture', 'at kick-off'],
            ['Model retraining', 'nightly 02:00 WAT'],
            ['Calibration audit', 'hourly'],
            ['Drift / rollback check', 'every 6 hours']
          ] as row}
            <div class="flex items-center justify-between border-b border-white/[0.05] pb-1.5">
              <span class="flex items-center gap-1.5 text-fog"><Clock size={9} />{row[0]}</span>
              <span class="font-mono text-[9px] text-white/70">{row[1]}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="panel p-4">
        <SectionHeader title="Collection result" description="Latest manual run" eyebrow="Console" />
        {#if results.length === 0}
          <div class="rounded-lg border border-white/[0.06] bg-black/25 p-3 font-mono text-[9.5px] leading-relaxed text-fog-dim">
            <div class="flex items-center gap-1.5 text-mint"><Terminal size={10} /> ready</div>
            <div class="mt-1">Select a source and run collection. Fixture mode validates the normaliser without contacting external sites.</div>
          </div>
        {:else}
          {#each results.slice(0, 2) as result}
            <div class="rounded-lg border border-white/[0.06] bg-black/25 p-3 font-mono text-[9px] leading-relaxed">
              <div class="flex items-center justify-between"><span class={result.status === 'succeeded' ? 'text-mint' : result.status === 'skipped' ? 'text-amber' : 'text-rose'}>{result.status}</span><span class="text-fog-dim">{result.records ?? 0} rows</span></div>
              <div class="mt-1 text-white/70">{result.message}</div>
              {#each (result.warnings ?? []).slice(0, 2) as warning}<div class="mt-1 text-fog-dim">› {warning}</div>{/each}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <div class="panel p-4">
    <SectionHeader title="From source to prediction" description="The harmonisation contract every connector must satisfy" eyebrow="Architecture" />
    <div class="grid gap-3 md:grid-cols-5">
      {#each [
        { step: 'Ingest', detail: 'Repo adapter, scraper worker or API client fetches raw payloads with retries and backoff.' },
        { step: 'Normalise', detail: 'Canonical team, league, fixture, market and price entities. Unknown fields are quarantined.' },
        { step: 'Validate', detail: 'Range checks, duplicate detection, stale-price rejection and overround sanity.' },
        { step: 'Store', detail: 'Convex tables plus a time-series odds store; immutable snapshots for reproducibility.' },
        { step: 'Learn', detail: 'Feature store feeds walk-forward training; closing lines score every prediction.' }
      ] as step, i}
        <div class="relative rounded-xl border border-white/[0.06] bg-black/15 p-3">
          <div class="num text-[9px] font-bold text-lime/70">STEP {i + 1}</div>
          <div class="mt-1 text-[11px] font-semibold text-white">{step.step}</div>
          <p class="mt-1 text-[9.5px] leading-relaxed text-fog">{step.detail}</p>
        </div>
      {/each}
    </div>
  </div>
</div>
