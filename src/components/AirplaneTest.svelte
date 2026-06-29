<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import { db } from '../db/dexie';
  import { go } from '../lib/router.svelte';
  import { online, isFullyOfflineReady } from '../lib/online.svelte';
  import {
    ensureAirplaneTest,
    syncAirplaneChecklist,
  } from '../lib/airplane-test';
  import type { AirplaneTestItem } from '../db/dexie';

  let items = $state<AirplaneTestItem[]>([]);
  const doneCount = $derived(items.filter((i) => i.done).length);
  const allDone = $derived(items.length > 0 && doneCount === items.length);

  onMount(() => {
    void ensureAirplaneTest();
    const sub = liveQuery(() => db.airplaneTests.orderBy('order').toArray()).subscribe((v) => {
      items = v;
      void syncAirplaneChecklist(v);
    });
    return () => sub.unsubscribe();
  });

  async function toggle(id: string) {
    const row = items.find((i) => i.id === id);
    if (!row) return;
    await db.airplaneTests.update(id, { done: !row.done });
  }

  async function saveNote(id: string, note: string) {
    await db.airplaneTests.update(id, { note });
  }

  const assets = $derived([
    { ok: online.mapTiles, label: 'Mappa (cina.pmtiles)' },
    { ok: online.routingTiles, label: 'Percorsi pedonali' },
    { ok: online.phraseAudio, label: 'Audio frasi' },
  ]);
</script>

<section class="card airplane" id="test-aereo">
  <div class="head-row">
    <div>
      <div class="eyebrow">Test modalità aereo · {doneCount}/{items.length}</div>
      <p class="lede">Prova ogni schermata <strong>senza rete</strong> e annota eventuali problemi.</p>
    </div>
    {#if allDone}
      <span class="badge-ok">Pronto ✓</span>
    {/if}
  </div>

  <div class="assets" aria-label="Risorse offline installate">
    <span class="assets-label">Pacchetto offline</span>
    <div class="asset-chips">
      {#each assets as a (a.label)}
        <span class="asset" class:ok={a.ok} class:wait={!online.checked}>
          {online.checked ? (a.ok ? '✓' : '✗') : '…'} {a.label}
        </span>
      {/each}
    </div>
    {#if online.checked && isFullyOfflineReady()}
      <p class="assets-note ok-txt">Tutto installato — puoi testare in aereo.</p>
    {:else if online.checked}
      <p class="assets-note warn-txt">Manca qualcosa. Da Mac esegui: <code>npm run offline:prepare</code></p>
    {/if}
  </div>

  <ol class="steps">
    {#each items as step (step.id)}
      <li class="step" class:done={step.done}>
        <button
          type="button"
          class="step-check"
          aria-pressed={step.done}
          onclick={() => toggle(step.id)}
        >
          <span class="box">{#if step.done}✓{/if}</span>
          <span class="step-body">
            <span class="step-label">{step.label}</span>
            <span class="step-hint">{step.hint}</span>
          </span>
        </button>
        {#if step.route}
          <button type="button" class="open" onclick={() => go(step.route!)}>Apri ›</button>
        {/if}
        <label class="note-field">
          <span class="sr-only">Note per {step.label}</span>
          <input
            type="text"
            placeholder="Note (cosa non ha funzionato?)"
            value={step.note}
            onchange={(e) => saveNote(step.id, e.currentTarget.value)}
          />
        </label>
      </li>
    {/each}
  </ol>

  <details class="howto">
    <summary>Come preparare il telefono (da Mac)</summary>
    <ol>
      <li>Nel progetto: <code>npm run offline:prepare</code></li>
      <li>Avvia il server: <code>npm run preview</code> (o carica su hosting HTTPS)</li>
      <li>Sul telefono: apri l’URL → Condividi → <strong>Aggiungi a Home</strong></li>
      <li>Apri la PWA, attendi il download (~170 MB la prima volta)</li>
      <li>Attiva modalità aereo e completa la lista sopra</li>
    </ol>
  </details>
</section>

<style>
  .airplane { margin-bottom: 14px; }
  .head-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .lede { font-size: 0.85rem; color: var(--ink-soft); margin-top: 6px; line-height: 1.45; }
  .lede strong { color: var(--ink); font-weight: 600; }
  .badge-ok {
    flex: none;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--jade-bright);
    background: var(--jade-soft);
    border: 1px solid rgba(63, 168, 122, 0.35);
    border-radius: var(--radius-pill);
    padding: 5px 10px;
  }
  .assets {
    padding: 10px 12px;
    margin-bottom: 12px;
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-xs);
  }
  .assets-label {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 8px;
  }
  .asset-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .asset {
    font-family: var(--mono);
    font-size: 9px;
    padding: 4px 8px;
    border-radius: var(--radius-pill);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    color: var(--cinabro-bright);
  }
  .asset.ok { color: var(--jade-bright); border-color: rgba(63, 168, 122, 0.35); }
  .asset.wait { color: var(--ink-faint); }
  .assets-note { font-size: 0.78rem; margin-top: 8px; line-height: 1.4; }
  .ok-txt { color: var(--jade-bright); }
  .warn-txt { color: var(--gold); }
  code { font-family: var(--mono); font-size: 0.85em; }
  .steps { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .step {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }
  .step:last-child { border-bottom: none; padding-bottom: 0; }
  .step-check {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    text-align: left;
    width: 100%;
  }
  .box {
    flex: none;
    width: 24px;
    height: 24px;
    margin-top: 2px;
    border: 1.5px solid var(--line-strong);
    border-radius: 7px;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 13px;
  }
  .step.done .box { background: var(--jade); border-color: var(--jade); }
  .step.done .step-label { color: var(--ink-faint); text-decoration: line-through; }
  .step-body { flex: 1; min-width: 0; }
  .step-label { display: block; font-weight: 500; font-size: 0.9rem; }
  .step-hint { display: block; font-size: 0.76rem; color: var(--ink-faint); margin-top: 2px; line-height: 1.35; }
  .open {
    align-self: flex-start;
    margin-left: 34px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--cinabro-bright);
    padding: 2px 0;
  }
  .note-field { margin-left: 34px; }
  .note-field input {
    width: 100%;
    padding: 8px 10px;
    font-size: 0.8rem;
  }
  .howto {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px dashed var(--line);
    font-size: 0.82rem;
    color: var(--ink-soft);
  }
  .howto summary {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-faint);
    cursor: pointer;
    list-style: none;
  }
  .howto summary::-webkit-details-marker { display: none; }
  .howto ol { margin: 10px 0 0 18px; display: flex; flex-direction: column; gap: 6px; line-height: 1.45; }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
</style>
