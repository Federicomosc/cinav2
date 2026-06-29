<script lang="ts">
  import { portal } from '../lib/portal';
  import PoiPhoto from './PoiPhoto.svelte';
  import { CAT_COLOR, CAT_LABEL } from '../lib/poi';
  import { saveCustomItinerary } from '../lib/custom-itineraries.svelte';
  import type { CustomItinerary } from '../db/dexie';
  import type { CityId, Poi } from '../data/types';

  interface Draft {
    title: string;
    stops: string[];
  }

  interface Props {
    cityId: CityId;
    cityPois: Poi[];
    accent: string;
    editing?: CustomItinerary | null;
    draft?: Draft | null;
    onclose: () => void;
    onsaved?: (id: string) => void;
  }

  let { cityId, cityPois, accent, editing = null, draft = null, onclose, onsaved }: Props = $props();

  let title = $state('');
  let stops = $state<string[]>([]);
  let pickerOpen = $state(false);
  let poiQuery = $state('');
  let saving = $state(false);
  let openedAt = 0;

  $effect(() => {
    if (editing) {
      title = editing.title;
      stops = [...editing.stops];
    } else if (draft) {
      title = draft.title;
      stops = [...draft.stops];
    } else {
      title = '';
      stops = [];
    }
    poiQuery = '';
    pickerOpen = false;
  });

  $effect(() => {
    openedAt = Date.now();
  });

  const availablePois = $derived(cityPois.filter((p) => !stops.includes(p.id)));

  const filteredPois = $derived.by(() => {
    const q = poiQuery.trim().toLowerCase();
    if (!q) return availablePois;
    return availablePois.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.nameLocal?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  });

  function close() {
    if (Date.now() - openedAt < 400) return;
    onclose();
  }

  function addStop(poiId: string) {
    if (!stops.includes(poiId)) stops = [...stops, poiId];
    pickerOpen = false;
  }

  function removeStop(idx: number) {
    stops = stops.filter((_, i) => i !== idx);
  }

  function moveStop(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= stops.length) return;
    const next = [...stops];
    [next[idx], next[j]] = [next[j], next[idx]];
    stops = next;
  }

  async function save() {
    if (!stops.length || saving) return;
    saving = true;
    try {
      const id = await saveCustomItinerary({
        id: editing?.id,
        city: cityId,
        title,
        stops,
      });
      if (id) {
        onsaved?.(id);
        onclose();
      }
    } finally {
      saving = false;
    }
  }
</script>

<div class="editor-backdrop" onclick={close} use:portal role="presentation">
  <div
    class="editor"
    style="--accent: {accent}"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="itin-editor-title"
  >
    <header class="editor-head">
      <h2 id="itin-editor-title">{editing ? 'Modifica itinerario' : 'Nuovo itinerario'}</h2>
      <button type="button" class="editor-x" onclick={onclose} aria-label="Chiudi">×</button>
    </header>

    <label class="field">
      <span class="lbl">Nome</span>
      <input type="text" bind:value={title} placeholder="Es. Giornata libera" maxlength="60" />
    </label>

    <div class="stops-block">
      <div class="stops-head">
        <span class="lbl">Tappe ({stops.length})</span>
        {#if availablePois.length}
          <button type="button" class="add-btn" onclick={() => (pickerOpen = !pickerOpen)}>
            {pickerOpen ? 'Chiudi' : '+ Aggiungi'}
          </button>
        {/if}
      </div>

      {#if pickerOpen}
        <label class="search-field">
          <span class="sr-only">Cerca luogo</span>
          <input
            type="search"
            bind:value={poiQuery}
            placeholder="Cerca per nome…"
            autocomplete="off"
          />
        </label>
        <div class="picker">
          {#if filteredPois.length === 0}
            <p class="picker-empty muted">Nessun luogo trovato.</p>
          {:else}
            {#each filteredPois as p (p.id)}
              <button type="button" class="pick-row" onclick={() => addStop(p.id)}>
                <PoiPhoto id={p.id} category={p.category} name={p.name} variant="thumb" />
                <span class="pick-name">{p.name}</span>
                <span class="pick-cat" style="--c:{CAT_COLOR[p.category]}">{CAT_LABEL[p.category]}</span>
              </button>
            {/each}
          {/if}
        </div>
      {/if}

      {#if stops.length === 0}
        <p class="empty muted">Aggiungi almeno un luogo dall'elenco della città.</p>
      {:else}
        <ol class="stop-list">
          {#each stops as sid, i (sid)}
            {@const poi = cityPois.find((p) => p.id === sid)}
            {#if poi}
              <li class="stop-row">
                <span class="stop-num">{i + 1}</span>
                <PoiPhoto id={poi.id} category={poi.category} name={poi.name} variant="thumb" />
                <span class="stop-name">{poi.name}</span>
                <div class="stop-actions">
                  <button type="button" class="icon-btn" disabled={i === 0} onclick={() => moveStop(i, -1)} aria-label="Su">↑</button>
                  <button type="button" class="icon-btn" disabled={i === stops.length - 1} onclick={() => moveStop(i, 1)} aria-label="Giù">↓</button>
                  <button type="button" class="icon-btn del" onclick={() => removeStop(i)} aria-label="Rimuovi">×</button>
                </div>
              </li>
            {/if}
          {/each}
        </ol>
      {/if}
    </div>

    <footer class="editor-foot">
      <button type="button" class="btn ghost" onclick={onclose}>Annulla</button>
      <button type="button" class="btn" disabled={!stops.length || saving} onclick={save}>
        {saving ? 'Salvo…' : 'Salva'}
      </button>
    </footer>
  </div>
</div>

<style>
  .editor-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1200;
    background: rgba(0, 0, 0, 0.65);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
  }
  .editor {
    width: 100%;
    max-width: 520px;
    max-height: min(92dvh, 640px);
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    box-shadow: var(--shadow-lg);
    padding: 16px 16px calc(16px + var(--safe-bottom));
  }
  .editor-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--line);
  }
  .editor-head h2 {
    font-family: var(--serif);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--ink);
  }
  .editor-x {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink-soft);
    font-size: 1.3rem;
    line-height: 1;
  }
  .field { display: block; margin-bottom: 16px; }
  .lbl {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 6px;
  }
  .field input {
    width: 100%;
    font-size: 1rem;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink);
  }
  .stops-block {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .stops-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .add-btn {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .picker {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--paper-2);
  }
  .search-field {
    display: block;
    margin-bottom: 8px;
  }
  .search-field input {
    width: 100%;
    font-size: 0.92rem;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink);
  }
  .picker-empty {
    font-size: 0.82rem;
    padding: 12px;
    margin: 0;
  }
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
  .pick-row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid var(--line);
  }
  .pick-row:last-child { border-bottom: none; }
  .pick-name {
    flex: 1;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--ink);
    min-width: 0;
  }
  .pick-cat {
    font-family: var(--mono);
    font-size: 8px;
    text-transform: uppercase;
    color: var(--c);
  }
  .empty {
    font-size: 0.88rem;
    padding: 12px 0;
  }
  .stop-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .stop-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
  }
  .stop-num {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: var(--accent);
  }
  .stop-name {
    flex: 1;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--ink);
    min-width: 0;
    line-height: 1.3;
  }
  .stop-actions {
    display: flex;
    gap: 4px;
    flex: none;
  }
  .icon-btn {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
    font-size: 12px;
    line-height: 1;
  }
  .icon-btn:disabled { opacity: 0.35; }
  .icon-btn.del { color: var(--cinabro-bright); }
  .editor-foot {
    display: flex;
    gap: 10px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .btn {
    flex: 1;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    padding: 12px 16px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--accent);
    background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 75%, #000));
    color: #fff;
  }
  .btn.ghost {
    flex: none;
    background: var(--surface);
    border-color: var(--line-strong);
    color: var(--ink-soft);
  }
  .btn:disabled { opacity: 0.5; }
</style>
