<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { BrainCircuit, RefreshCw, ChevronDown, ChevronUp, Play, CheckCircle2, AlertTriangle, ShieldCheck, Database, Cpu, GitBranch, Activity, ArrowUpRight } from '@lucide/svelte';
  import LineChart from '#lib/components/LineChart.svelte';
  import Sparkline from '#lib/components/Sparkline.svelte';
  import Gauge from '#lib/components/Gauge.svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import BarChart from '#lib/components/BarChart.svelte';
  import { pct } from '#lib/engine/core';
  import { relativeTime, formatDate } from '#lib/format';

  let { data } = $props();
  let expanded = $state<string | null>(null);
  let selected = $state(untrack(() => data.models[0].id));
  let queuing = $state<string | null>(null);
  let message = $state('');
  let runs = $state(untrack(() => data.runs));

  const activeModel = $derived(data.models.find((m: any) => m.id === selected) ?? data.models[0]);

  async function retrain(modelId: string) {
    queuing = modelId;
    message = '';
    try {
      const res = await fetch('/api/models/train', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ modelId })
      });
      const body = await res.json();
      if (res.ok) {
        runs = [body.run, ...runs];
        message = `${body.run.modelId} queued. Champion remains live until validation passes.`;
      } else {
        message = body.message ?? 'Training could not be queued.';
      }
    } catch {
      message = 'Training endpoint unreachable.';
    } finally {
      queuing = null;
      setTimeout(() => (message = ''), 6000);
    }
  }

  function selectModel(id: string) {
    selected = id;
  }

  const statusChip = (status: string) =>
    status === 'production' ? 'chip-mint' : status === 'shadow' ? 'chip-sky' : status === 'training' ? 'chip-amber' : 'chip';
</script>

<svelte:head><title>Model laboratory — CaveBettor</title></svelte:head>

<div class="space-y-4">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <div class="mb-1 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-lime"><BrainCircuit size={12} /> Model laboratory</div>
      <h1 class="display text-[22px] font-bold tracking-tight text-white sm:text-[26px]">Self-training, self-auditing.</h1>
      <p class="mt-1 max-w-2xl text-[12.5px] text-fog">
        {data.summary.production} production champions, {data.summary.shadow} challenger in shadow mode and {data.summary.features} engineered features. Every promotion must survive walk-forward validation.
      </p>
    </div>
    <button onclick={() => retrain(activeModel.id)} class="btn btn-primary w-full !py-2 text-[11.5px] sm:w-auto" disabled={queuing !== null}>
      <RefreshCw size={13} class={queuing ? 'animate-spin' : ''} /> Retrain {activeModel.name.split(' ')[0]}
    </button>
  </div>

  {#if message}
    <div class="rounded-xl border border-lime/25 bg-lime/[0.07] px-3.5 py-2 text-[11.5px] text-lime">{message}</div>
  {/if}

  <div class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
    {#each [
      { label: 'Production models', value: String(data.summary.production), sub: `${data.summary.total} total in registry`, colour: '#c9ff4d' },
      { label: 'Mean accuracy', value: `${(data.summary.avgAccuracy * 100).toFixed(1)}%`, sub: 'across active models', colour: '#35e7a1' },
      { label: 'Mean walk-forward ROI', value: `+${data.summary.avgRoi.toFixed(1)}%`, sub: 'before staking limits', colour: '#f6c453' },
      { label: 'Drift alerts', value: String(data.summary.driftAlerts), sub: 'above 2.5% threshold', colour: data.summary.driftAlerts ? '#ff6478' : '#6fc9ff' }
    ] as kpi}
      <div class="panel p-3.5">
        <div class="stat-label">{kpi.label}</div>
        <div class="display num mt-1.5 text-[18px] font-bold sm:text-[21px]" style={`color:${kpi.colour}`}>{kpi.value}</div>
        <div class="mt-0.5 text-[10px] text-fog-dim">{kpi.sub}</div>
      </div>
    {/each}
  </div>

  <div class="grid gap-4 xl:grid-cols-3">
    <div class="space-y-3 xl:col-span-2">
      {#each data.models as model}
        <div class={`panel overflow-hidden transition ${selected === model.id ? 'ring-1 ring-lime/25' : ''}`}>
          <button onclick={() => selectModel(model.id)} class="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left">
            <span class={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${model.family === 'machine-learning' ? 'border-lime/25 bg-lime/10 text-lime' : model.family === 'market' ? 'border-sky/25 bg-sky/10 text-sky' : model.family === 'llm' ? 'border-violet/25 bg-violet/10 text-violet' : 'border-mint/25 bg-mint/10 text-mint'}`}>
              {#if model.family === 'market'}<Activity size={16} />{:else if model.family === 'machine-learning'}<Cpu size={16} />{:else if model.family === 'llm'}<BrainCircuit size={16} />{:else}<GitBranch size={16} />{/if}
            </span>
            <span class="block min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="truncate text-[12.5px] font-semibold text-white">{model.name}</span>
                <span class={`chip !px-1.5 !py-0 !text-[8.5px] ${statusChip(model.status)}`}>{model.status}</span>
                {#if model.drift > 0.025}<span class="chip chip-amber !px-1.5 !py-0 !text-[8.5px]">drift</span>{/if}
              </span>
              <span class="mt-0.5 flex flex-wrap items-center gap-2 text-[9.5px] text-fog-dim">
                <span>{model.version}</span>
                <span class="capitalize">{model.family.replace('-', ' ')}</span>
                {#if model.sport !== 'multi'}<span class="capitalize">{model.sport.replace('icehockey', 'ice hockey')}</span>{/if}
                <span>{model.sampleSize.toLocaleString()} samples</span>
              </span>
            </span>
            <span class="hidden items-center gap-5 sm:flex">
              <span class="block text-right"><span class="block text-[8.5px] uppercase tracking-wider text-fog-dim">Accuracy</span><span class="num block text-[12px] font-bold text-white">{(model.accuracy * 100).toFixed(1)}%</span></span>
              <span class="block text-right"><span class="block text-[8.5px] uppercase tracking-wider text-fog-dim">Log loss</span><span class="num block text-[12px] font-bold text-white">{model.logLoss.toFixed(3)}</span></span>
              <span class="block text-right"><span class="block text-[8.5px] uppercase tracking-wider text-fog-dim">ROI</span><span class="num block text-[12px] font-bold text-mint">+{model.roi.toFixed(1)}%</span></span>
            </span>
            <span class="shrink-0">{#if expanded === model.id}<ChevronUp size={14} class="text-fog" />{:else}<ChevronDown size={14} class="text-fog" />{/if}</span>
          </button>

          {#if expanded === model.id}
            <div class="border-t border-white/[0.06] px-4 py-4">
              <div class="grid gap-4 md:grid-cols-3">
                <div>
                  <div class="stat-label mb-2">Walk-forward accuracy</div>
                  <LineChart series={[{ name: 'Accuracy', values: model.accuracySeries, colour: '#35e7a1', area: true }]} height={120} yFormat={(v) => `${(v * 100).toFixed(0)}%`} legend={false} min={Math.min(...model.accuracySeries) - 0.01} max={Math.max(...model.accuracySeries) + 0.01} />
                </div>
                <div>
                  <div class="stat-label mb-2">Top features</div>
                  <BarChart horizontal data={model.featureImportance.slice(0, 6).map((f: any) => ({ label: f.name, value: f.weight }))} format={(v) => `${(v * 100).toFixed(0)}%`} colour="#c9ff4d" />
                </div>
                <div>
                  <div class="stat-label mb-2">Calibration</div>
                  <div class="space-y-1.5">
                    {#each model.calibration as c}
                      <div class="flex items-center gap-2 text-[9.5px]">
                        <span class="w-12 shrink-0 text-fog-dim">{c.bucket}</span>
                        <div class="relative h-1.5 flex-1 rounded-full bg-white/[0.06]">
                          <div class="absolute inset-y-0 left-0 rounded-full bg-lime/30" style={`width:${c.predicted * 100}%`}></div>
                          <div class="absolute -top-0.5 h-2.5 w-0.5 rounded bg-white" style={`left:${c.observed * 100}%`}></div>
                        </div>
                        <span class="num w-8 text-right text-white/70">{(c.observed * 100).toFixed(0)}%</span>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
              <div class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                <p class="max-w-xl text-[10.5px] leading-relaxed text-fog">{model.description}</p>
                <div class="flex items-center gap-2">
                  <span class="text-[9.5px] text-fog-dim">Trained {relativeTime(model.trainedAt)}</span>
                  <button onclick={() => retrain(model.id)} class="btn btn-ghost !px-2.5 !py-1.5 text-[10px]" disabled={queuing !== null}>Queue training</button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="space-y-4">
      <div class="panel p-4">
        <SectionHeader title="Ensemble health" description="Champion calibration and confidence" eyebrow="Diagnostics" />
        <div class="flex flex-wrap items-center gap-4">
          <Gauge value={activeModel.calibration?.[0] ? activeModel.calibration[0].observed * 100 : activeModel.accuracy * 100} size={112} label="Observed" colour="#35e7a1" />
          <div class="space-y-2 text-[10.5px]">
            <div class="flex justify-between gap-4"><span class="text-fog">Brier</span><span class="num font-semibold text-white">{activeModel.brier}</span></div>
            <div class="flex justify-between gap-4"><span class="text-fog">Log loss</span><span class="num font-semibold text-white">{activeModel.logLoss}</span></div>
            <div class="flex justify-between gap-4"><span class="text-fog">Features</span><span class="num font-semibold text-white">{activeModel.features}</span></div>
            <div class="flex justify-between gap-4"><span class="text-fog">Drift</span><span class={`num font-semibold ${activeModel.drift > 0.025 ? 'text-amber' : 'text-mint'}`}>{(activeModel.drift * 100).toFixed(1)}%</span></div>
          </div>
        </div>
        <div class="mt-3 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-fog">
          {activeModel.name} is currently <span class="font-semibold text-white">{activeModel.status}</span>. {activeModel.status === 'shadow' ? 'It is being scored against live outcomes without affecting staking.' : 'It receives live weight in the production ensemble.'}
        </div>
      </div>

      <div class="panel p-4">
        <SectionHeader title="Self-training loop" description="From raw data to promoted champion" eyebrow="Pipeline" />
        <div class="space-y-2.5">
          {#each data.pipeline as step}
            <div class="flex gap-2.5">
              <span class="num flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-lime/20 bg-lime/[0.07] text-[9px] font-bold text-lime">{step.step}</span>
              <div>
                <div class="text-[11px] font-semibold text-white">{step.title}</div>
                <p class="text-[9.5px] leading-relaxed text-fog-dim">{step.detail}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="panel p-4">
        <SectionHeader title="Guardrails" description="Promotion is earned, never assumed" eyebrow="Safety" />
        <div class="space-y-2 text-[10px]">
          {#each [{ icon: ShieldCheck, text: 'Time-based splits only — no future leakage' }, { icon: AlertTriangle, text: 'Rollback if drift exceeds 4.2%' }, { icon: CheckCircle2, text: 'Champion must win all 8 windows' }, { icon: Database, text: 'Every run is reproducible from a data snapshot' }] as guard}
            <div class="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-black/15 px-2.5 py-2">
              <guard.icon size={12} class="shrink-0 text-mint" /> <span class="text-fog">{guard.text}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>

  <div class="panel overflow-hidden">
    <div class="flex items-center justify-between px-4 pb-1 pt-4">
      <SectionHeader title="Training runs" description="Recent jobs, walk-forward windows and promotion notes" eyebrow="Job history" />
      <a href="/api/models/train" target="_blank" class="btn btn-ghost !px-2.5 !py-1.5 text-[10px]">API <ArrowUpRight size={10} /></a>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Run</th><th>Model</th><th>Status</th><th class="text-right">Rows</th><th class="text-right">Accuracy</th><th class="text-right">ROI</th><th>Walk-forward</th></tr></thead>
        <tbody>
          {#each runs as run}
            <tr>
              <td><div class="num text-[10.5px] font-medium text-white/80">{run.id.slice(0, 12)}</div><div class="text-[9px] text-fog-dim">{relativeTime(run.startedAt)}</div></td>
              <td><div class="text-[10.5px] text-white/80">{data.models.find((m: any) => m.id === run.modelId)?.name ?? run.modelId}</div><div class="text-[9px] text-fog-dim">{run.epochs} epochs</div></td>
              <td>
                <span class={`chip !px-1.5 !py-0 !text-[8.5px] ${run.status === 'completed' ? 'chip-mint' : run.status === 'running' ? 'chip-sky' : run.status === 'failed' ? 'chip-rose' : 'chip-amber'}`}>{run.status}</span>
                {#if run.status === 'running'}<div class="mt-1 h-1 w-16 overflow-hidden rounded bg-white/10"><div class="h-full bg-sky" style={`width:${(run.currentEpoch / run.epochs) * 100}%`}></div></div>{/if}
              </td>
              <td class="num text-right text-[10px] text-fog">{run.trainRows.toLocaleString()}</td>
              <td class="num text-right text-[10.5px] font-semibold text-white">{(run.metrics.accuracy * 100).toFixed(1)}%</td>
              <td class="num text-right text-[10.5px] font-semibold text-mint">+{run.metrics.roi.toFixed(1)}%</td>
              <td><Sparkline values={run.walkForward.map((w: any) => w.roi)} width={80} height={20} colour={run.metrics.roi > 0 ? '#35e7a1' : '#ff6478'} strokeWidth={1.5} /></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
