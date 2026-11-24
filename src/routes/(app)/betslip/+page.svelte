<script lang="ts">
  import { Plus, Trash2, Download, Share2, Copy, Check, Search, Ticket, Wallet, Info, Save, Pencil, X, MessageCircle, FileText } from '@lucide/svelte';
  import SectionHeader from '#lib/components/SectionHeader.svelte';
  import AddToBetslip from '#lib/components/AddToBetslip.svelte';
  import { formatKickoff } from '#lib/format';
  import { fmtNgn } from '#lib/engine/core';
  import { betslip, encodeSlip, decodeSlip, type SlipLeg, type SavedSlip } from '#lib/betslip.svelte';

  let { data } = $props();

  type Selection = (typeof data.selections)[number];

  let query = $state('');
  let sportFilter = $state('all');
  let minProbability = $state(45);
  let title = $state('');
  let notice = $state('');
  let copied = $state(false);
  let editing = $state<string | null>(null);
  let renameValue = $state('');
  let showHistory = $state(true);

  const filtered = $derived(
    data.selections
      .filter((selection) => {
        if (sportFilter !== 'all' && selection.sport !== sportFilter) return false;
        if (selection.probability * 100 < minProbability) return false;
        if (!query.trim()) return true;
        const haystack = `${selection.fixtureLabel} ${selection.league} ${selection.marketLabel} ${selection.label}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      })
      .slice(0, 60)
  );

  const sports = $derived(
    [...new Map(data.selections.map((s) => [s.sport, s.sportLabel])).entries()].map(([id, label]) => ({ id, label }))
  );

  const odds = $derived(betslip.odds);
  const probability = $derived(betslip.probability);
  const stake = $derived(betslip.stake);
  const potentialReturn = $derived(stake * odds);
  const potentialProfit = $derived(potentialReturn - stake);

  const slipLeg = (selection: Selection): SlipLeg => ({
    id: selection.id,
    fixtureId: selection.fixtureId,
    fixtureLabel: selection.fixtureLabel,
    league: selection.league,
    leagueId: selection.leagueId,
    sport: selection.sport,
    kickoff: selection.kickoff,
    marketId: selection.marketId,
    marketLabel: selection.marketLabel,
    marketGroup: selection.marketGroup,
    outcomeId: selection.outcomeId,
    label: selection.label,
    odds: selection.odds,
    probability: selection.probability,
    edge: selection.edge,
    bestBook: selection.bestBook
  });

  function saveSlip() {
    if (!betslip.legs.length) {
      notice = 'Add at least one selection before saving.';
      return;
    }
    const saved = betslip.save(title);
    if (saved) {
      notice = `Saved “${saved.title}” to your betslip history.`;
      title = '';
    }
  }

  function deleteSlip(id: string) {
    betslip.deleteSaved(id);
    notice = 'Saved betslip deleted.';
  }

  function commitRename(id: string) {
    betslip.rename(id, renameValue);
    editing = null;
    notice = 'Betslip renamed.';
  }

  function shareWhatsApp() {
    if (!betslip.legs.length) return;
    const lines = [
      `CaveBettor accumulator · ${betslip.legs.length} leg${betslip.legs.length > 1 ? 's' : ''}`,
      ...betslip.legs.map((leg, i) => `${i + 1}. ${leg.fixtureLabel} — ${leg.label} @ ${leg.odds.toFixed(2)}`),
      ``,
      `Total odds ${odds.toFixed(2)} · stake ${fmtNgn(stake)} · potential return ${fmtNgn(potentialReturn)}`,
      `Model probability ${(probability * 100).toFixed(1)}% · research only, 18+`
    ];
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  }

  async function copyShareLink() {
    const encoded = encodeSlip(betslip.legs, stake);
    const url = `${window.location.origin}/betslip?slip=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1800);
      notice = 'Share link copied. Anyone who opens it loads this slip.';
    } catch {
      notice = url;
    }
  }

  async function downloadPdf() {
    if (!betslip.legs.length) {
      notice = 'Add at least one selection before downloading.';
      return;
    }
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const left = 48;
    let y = 64;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('CaveBettor', left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text('Research-only football intelligence · cavebettor.ewinproject.org', left, (y += 14));
    doc.setTextColor(20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Accumulator betslip', left, (y += 26));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated ${new Date().toLocaleString('en-NG')}`, left, (y += 13));

    // Identity block.
    y += 20;
    doc.setDrawColor(220);
    doc.setFillColor(247, 249, 245);
    doc.rect(left, y - 12, 499, 44, 'F');
    doc.setFontSize(9);
    doc.text(`User ID: ${data.user?.id ?? 'guest'}`, left + 10, y + 2);
    doc.text(`User: ${data.user?.name ?? 'Guest analyst'}`, left + 10, y + 16);
    doc.text(`Legs: ${betslip.legs.length}`, left + 300, y + 2);
    doc.text(`Model probability: ${(probability * 100).toFixed(1)}%`, left + 300, y + 16);

    // Selections table.
    y += 44;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Selection', left, y);
    doc.text('Market', left + 250, y);
    doc.text('Odds', left + 400, y);
    doc.text('Prob.', left + 445, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    y += 4;
    doc.setDrawColor(230);
    doc.line(left, y, left + 499, y);

    for (const leg of betslip.legs) {
      y += 16;
      if (y > 720) {
        doc.addPage();
        y = 64;
      }
      const fixture = doc.splitTextToSize(leg.fixtureLabel || leg.fixtureId, 190);
      doc.text(fixture, left, y);
      doc.text(doc.splitTextToSize(leg.label, 140), left, y + 10);
      doc.text(doc.splitTextToSize(leg.marketLabel || leg.marketId, 130), left + 250, y);
      doc.text(leg.odds.toFixed(2), left + 400, y);
      doc.text(`${(leg.probability * 100).toFixed(1)}%`, left + 445, y);
      y += 12;
    }

    // Money block.
    y += 22;
    doc.setDrawColor(210);
    doc.line(left, y, left + 499, y);
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Total odds: ${odds.toFixed(2)}`, left, y);
    doc.text(`Stake: ${fmtNgn(stake)}`, left + 250, y);
    y += 16;
    doc.text(`Potential return: ${fmtNgn(potentialReturn)}`, left, y);
    doc.text(`Potential profit: ${fmtNgn(potentialProfit)}`, left + 250, y);

    y += 30;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      doc.splitTextToSize(
        'CaveBettor is research software. It never accepts deposits, never places bets and never holds funds. Probabilities are model estimates, not guarantees. 18+. If you gamble, gamble responsibly.',
        470
      ),
      left,
      y
    );

    doc.save(`cavebettor-betslip-${new Date().toISOString().slice(0, 10)}.pdf`);
    notice = 'PDF downloaded.';
  }

  function loadSaved(slip: SavedSlip) {
    betslip.load(slip);
    notice = `Loaded “${slip.title}”.`;
  }

  $effect(() => {
    // Shared links load into the slip once on mount.
    if (typeof window === 'undefined' || !betslip.loaded) return;
    const encoded = new URLSearchParams(window.location.search).get('slip');
    if (!encoded) return;
    const decoded = decodeSlip(encoded);
    if (decoded?.legs.length) {
      betslip.legs = decoded.legs;
      betslip.stake = decoded.stake;
      notice = `Loaded a shared accumulator with ${decoded.legs.length} legs.`;
    }
  });
</script>

<svelte:head><title>Betslip builder — CaveBettor</title></svelte:head>

<div class="space-y-5">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <SectionHeader
      eyebrow="My workspace"
      title="Betslip builder"
      description={`${data.selections.length} priced options across ${data.fixtures} live and upcoming fixtures · research only, no stakes are placed`}
    />
    <div class="flex items-center gap-2 text-[10.5px] text-fog-dim">
      <span class="chip chip-lime"><Ticket size={10} /> {betslip.legs.length} in slip</span>
      <span class="chip"><Wallet size={10} /> {fmtNgn(stake)} stake</span>
    </div>
  </div>

  {#if notice}
    <div class="rounded-xl border border-mint/20 bg-mint/[0.06] px-3.5 py-2 text-[11.5px] text-mint">{notice}</div>
  {/if}

  <div class="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
    <!-- Available selections -->
    <div class="panel overflow-hidden">
      <div class="border-b border-white/[0.06] px-3.5 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
            <Search size={12} class="shrink-0 text-fog-dim" />
            <input
              class="min-w-0 flex-1 bg-transparent text-[11.5px] text-white outline-none placeholder:text-fog-dim"
              placeholder="Team, competition, market or selection"
              bind:value={query}
            />
          </div>
          <select class="input !w-auto !py-1.5 text-[11px]" bind:value={sportFilter}>
            <option value="all">All sports</option>
            {#each sports as sport}<option value={sport.id}>{sport.label}</option>{/each}
          </select>
          <label class="inline-flex items-center gap-1.5 text-[10.5px] text-fog">
            Min
            <input class="input !w-16 !py-1.5 text-[11px]" type="number" min="0" max="95" step="1" bind:value={minProbability} />
            %
          </label>
        </div>
        <div class="mt-1.5 text-[9.5px] text-fog-dim">
          Ranked by model probability · every market option has a “+” to add it to the slip
        </div>
      </div>

      <div class="max-h-[620px] overflow-y-auto">
        {#each filtered as selection (selection.id)}
          <div class="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2 last:border-0">
            <div class="min-w-0 flex-1">
              <div class="truncate text-[11px] font-medium text-white">{selection.fixtureLabel}</div>
              <div class="truncate text-[9.5px] text-fog-dim">
                {selection.league} · {selection.marketLabel} · {formatKickoff(selection.kickoff)}
              </div>
              <div class="truncate text-[10.5px] text-fog">{selection.label}</div>
            </div>
            <div class="shrink-0 text-right">
              <div class="num text-[11.5px] font-semibold text-lime">{selection.odds.toFixed(2)}</div>
              <div class="num text-[9.5px] text-fog-dim">{(selection.probability * 100).toFixed(1)}%</div>
            </div>
            <AddToBetslip leg={slipLeg(selection)} />
          </div>
        {/each}
        {#if !filtered.length}
          <div class="px-4 py-8 text-center text-[11px] text-fog">No selection matches those filters.</div>
        {/if}
      </div>
    </div>

    <!-- Current slip -->
    <div class="space-y-3">
      <div class="panel p-3.5">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-[12.5px] font-semibold text-white">Current slip</h3>
          {#if betslip.legs.length}
            <button class="btn-icon !h-7 !w-7" onclick={() => betslip.clear()} aria-label="Clear the slip"><Trash2 size={12} /></button>
          {/if}
        </div>

        {#if !betslip.legs.length}
          <p class="mt-3 text-[11px] leading-relaxed text-fog">
            Empty. Tap the <span class="text-lime">+</span> beside any market option — here, on a fixture analysis page or on the value board — to start an accumulator.
          </p>
        {:else}
          <div class="mt-2 space-y-2">
            {#each betslip.legs as leg (leg.id)}
              <div class="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="truncate text-[10.5px] font-semibold text-white">{leg.fixtureLabel || leg.fixtureId}</div>
                    <div class="truncate text-[10px] text-fog">{leg.label}</div>
                    <div class="truncate text-[9px] text-fog-dim">{leg.marketLabel || leg.marketId}</div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5">
                    <span class="num text-[11px] font-semibold text-lime">{leg.odds.toFixed(2)}</span>
                    <button class="btn-icon !h-6 !w-6" onclick={() => betslip.remove(leg.id)} aria-label={`Remove ${leg.label}`}>
                      <X size={11} />
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <div class="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
            <label class="flex items-center justify-between gap-2 text-[10.5px] text-fog">
              Stake
              <input
                class="input !w-28 !py-1.5 text-right text-[11.5px]"
                type="number"
                min="0"
                step="500"
                value={stake}
                oninput={(event) => betslip.setStake(Number(event.currentTarget.value) || 0)}
              />
            </label>
            <div class="flex items-center justify-between text-[10.5px] text-fog">
              <span>Total odds</span>
              <span class="num font-semibold text-white">{odds.toFixed(2)}</span>
            </div>
            <div class="flex items-center justify-between text-[10.5px] text-fog">
              <span>Model probability</span>
              <span class="num font-semibold text-white">{(probability * 100).toFixed(1)}%</span>
            </div>
            <div class="flex items-center justify-between text-[10.5px] text-fog">
              <span>Potential return</span>
              <span class="num font-semibold text-lime">{fmtNgn(potentialReturn)}</span>
            </div>
            <div class="flex items-center justify-between text-[10.5px] text-fog">
              <span>Potential profit</span>
              <span class={`num font-semibold ${potentialProfit >= 0 ? 'text-mint' : 'text-rose'}`}>{fmtNgn(potentialProfit)}</span>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-1.5">
            <button class="btn btn-ghost !py-1.5 text-[10.5px]" onclick={downloadPdf}><FileText size={11} /> Download PDF</button>
            <button class="btn btn-ghost !py-1.5 text-[10.5px]" onclick={shareWhatsApp}><MessageCircle size={11} /> WhatsApp</button>
            <button class="btn btn-ghost !py-1.5 text-[10.5px]" onclick={copyShareLink}>
              {#if copied}<Check size={11} /> Copied{:else}<Copy size={11} /> Share link{/if}
            </button>
          </div>
        {/if}
      </div>

      <div class="panel p-3.5">
        <h3 class="text-[12.5px] font-semibold text-white">Save this slip</h3>
        <div class="mt-2 flex gap-1.5">
          <input
            class="input min-w-0 flex-1 !py-1.5 text-[11px]"
            placeholder="Give it a title, e.g. Saturday bankers"
            bind:value={title}
            onkeydown={(event) => event.key === 'Enter' && saveSlip()}
          />
          <button class="btn btn-primary !py-1.5 text-[10.5px]" onclick={saveSlip}><Save size={11} /> Save</button>
        </div>
        <p class="mt-1.5 text-[9.5px] text-fog-dim">Saved slips stay in your browser history and can be edited, reloaded or deleted.</p>
      </div>

      <div class="panel overflow-hidden">
        <button class="flex w-full items-center justify-between px-3.5 py-2.5" onclick={() => (showHistory = !showHistory)}>
          <h3 class="text-[12.5px] font-semibold text-white">Betslip history</h3>
          <span class="text-[10px] text-fog-dim">{betslip.history.length} saved</span>
        </button>
        {#if showHistory}
          <div class="border-t border-white/[0.06]">
            {#if !betslip.history.length}
              <p class="px-3.5 py-4 text-[10.5px] text-fog">Nothing saved yet.</p>
            {:else}
              {#each betslip.history as saved (saved.id)}
                <div class="border-b border-white/[0.04] px-3.5 py-2 last:border-0">
                  <div class="flex items-center gap-2">
                    {#if editing === saved.id}
                      <input class="input min-w-0 flex-1 !py-1 text-[10.5px]" bind:value={renameValue} />
                      <button class="btn-icon !h-6 !w-6" onclick={() => commitRename(saved.id)} aria-label="Save name"><Check size={11} /></button>
                      <button class="btn-icon !h-6 !w-6" onclick={() => (editing = null)} aria-label="Cancel rename"><X size={11} /></button>
                    {:else}
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-[11px] font-medium text-white">{saved.title}</div>
                        <div class="text-[9px] text-fog-dim">
                          {saved.legs.length} legs · {saved.odds.toFixed(2)} odds · {fmtNgn(saved.stakeNgn)} · {new Date(saved.updatedAt).toLocaleDateString('en-NG')}
                        </div>
                      </div>
                      <button class="btn-icon !h-6 !w-6" onclick={() => loadSaved(saved)} aria-label={`Load ${saved.title}`}><Ticket size={11} /></button>
                      <button
                        class="btn-icon !h-6 !w-6"
                        onclick={() => {
                          editing = saved.id;
                          renameValue = saved.title;
                        }}
                        aria-label={`Rename ${saved.title}`}
                      ><Pencil size={11} /></button>
                      <button class="btn-icon !h-6 !w-6" onclick={() => deleteSlip(saved.id)} aria-label={`Delete ${saved.title}`}><Trash2 size={11} /></button>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <div class="rounded-xl border border-white/[0.07] bg-black/20 p-3 text-[9.5px] leading-relaxed text-fog-dim">
        <span class="inline-flex items-center gap-1"><Info size={10} /> Research only.</span>
        CaveBettor never accepts deposits and never places a bet. Odds shown are the best available quotes; stakes are paper amounts. 18+.
      </div>
    </div>
  </div>
</div>
