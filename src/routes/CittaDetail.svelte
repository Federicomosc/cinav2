<script lang="ts">
  import { cittaById, cittaContentById, poisOfCity, legByCity } from '../lib/content';
  import { nav, go } from '../lib/router.svelte';
  import PoiPhoto from '../components/PoiPhoto.svelte';
  import { stars, CAT_LABEL, CAT_COLOR } from '../lib/poi';
  import { shortDate } from '../lib/format';
  import { cityTheme } from '../lib/city-theme';
  import { splitGuide, type GuideBlock } from '../lib/guide';
  import { builtinItineraryMapId, customItineraryMapId } from '../lib/itinerary';
  import {
    customItinerariesForCity,
    deleteCustomItinerary,
    buildItineraryExport,
    downloadItineraryExport,
    importItineraryExport,
  } from '../lib/custom-itineraries.svelte';
  import { longWalkSummary } from '../lib/walk-hints';
  import ItineraryCard from '../components/ItineraryCard.svelte';
  import ItineraryEditor from '../components/ItineraryEditor.svelte';
  import type { CustomItinerary } from '../db/dexie';
  import type { CityId } from '../data/types';

  const city = $derived(nav.id ? cittaById.get(nav.id as CityId) : undefined);
  const content = $derived(city ? cittaContentById.get(city.id) : undefined);
  const cityPois = $derived(city ? poisOfCity(city.id) : []);
  const leg = $derived(city ? legByCity.get(city.id) : undefined);
  const accent = $derived(city ? cityTheme(city.id).accent : '#e84828');
  const guide = $derived(content ? splitGuide(content.blocks) : { intro: [], sections: [] });
  const cityCustomItins = $derived(city ? customItinerariesForCity(city.id) : []);

  let editorOpen = $state(false);
  let editingItin = $state<CustomItinerary | null>(null);
  let editorDraft = $state<{ title: string; stops: string[] } | null>(null);

  function openCreateItin() {
    editingItin = null;
    editorDraft = null;
    editorOpen = true;
  }

  function openEditItin(it: CustomItinerary) {
    editingItin = it;
    editorDraft = null;
    editorOpen = true;
  }

  function duplicateBuiltin(title: string, stops: string[]) {
    editingItin = null;
    editorDraft = { title: `Copia di ${title}`, stops: [...stops] };
    editorOpen = true;
  }

  function closeEditor() {
    editorOpen = false;
    editingItin = null;
    editorDraft = null;
  }

  async function confirmDeleteItin(it: CustomItinerary) {
    if (!confirm(`Eliminare «${it.title}»?`)) return;
    await deleteCustomItinerary(it.id);
  }

  async function exportItins() {
    const data = await buildItineraryExport();
    if (!data.items.length) {
      alert('Nessun itinerario personalizzato da esportare.');
      return;
    }
    downloadItineraryExport(data);
  }

  async function onImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const n = await importItineraryExport(raw);
      alert(n ? `Importati ${n} itinerari.` : 'Nessun itinerario valido nel file.');
    } catch {
      alert('File non valido.');
    }
  }
</script>

{#snippet guideBlocks(blocks: GuideBlock[])}
  {#each blocks as b, i (i)}
    {#if b.tag === 'h3'}
      <h4 class="g-h4">{b.text}</h4>
    {:else if b.tag === 'h4'}
      <p class="g-kicker">{b.text}</p>
    {:else if b.tag === 'li'}
      <li class="g-li">{b.text}</li>
    {:else}
      <p class="g-p">{b.text}</p>
    {/if}
  {/each}
{/snippet}

{#if !city}
  <div class="card"><p>Città non trovata. <button class="link" onclick={() => go('citta')}>Torna alle città</button></p></div>
{:else}
  <button class="back-link" onclick={() => go('citta')}>Tutte le città</button>

  <header class="head" style="--accent: {accent}">
    <div class="head-bar" aria-hidden="true"></div>
    <div class="head-inner">
      {#if leg}<div class="when">{shortDate(leg.from)} – {shortDate(leg.to)}</div>{/if}
      <h1>{city.name}</h1>
      <span class="cn">{city.nameLocal}</span>
      <p class="intro">{city.intro}</p>
    </div>
  </header>

  {#if content && (guide.intro.length || guide.sections.length)}
    <div class="block-head">
      <h2 class="block-title">Guida</h2>
      <span class="block-sub">{guide.sections.length} sezioni</span>
    </div>

    {#if guide.intro.length}
      <article class="card guide-intro">
        <p class="guide-intro-lbl">In sintesi</p>
        <div class="guide-body">
          {@render guideBlocks(guide.intro)}
        </div>
      </article>
    {/if}

    <div class="guide-sections">
      {#each guide.sections as sec, i (sec.title)}
        <details class="guide-fold card" open={i === 0}>
          <summary class="guide-sum">
            <span class="guide-sum-title">{sec.title}</span>
            <span class="guide-sum-chevron" aria-hidden="true">›</span>
          </summary>
          <div class="guide-body">
            {@render guideBlocks(sec.blocks)}
          </div>
        </details>
      {/each}
    </div>
  {/if}

  <div class="block-head">
    <h2 class="block-title">Da vedere</h2>
    <span class="block-sub">{cityPois.length} luoghi</span>
  </div>
  <div class="poi-list">
    {#each cityPois as p (p.id)}
      <button class="poi-row card-interactive" onclick={() => go('poi', p.id)}>
        <PoiPhoto id={p.id} category={p.category} name={p.name} variant="thumb" />
        <div class="poi-body">
          <span class="poi-title">{p.name}</span>
          {#if p.blurb}<span class="poi-blurb">{p.blurb}</span>{/if}
          <span class="poi-meta">
            <span class="poi-cat" style="--c: {CAT_COLOR[p.category]}">{CAT_LABEL[p.category]}</span>
            {#if p.stars}<span class="st">{stars(p.stars)}</span>{/if}
            {#if p.booking && /obblig/i.test(p.booking)}<span class="bk">Prenota</span>{/if}
          </span>
        </div>
        <span class="poi-go" aria-hidden="true">›</span>
      </button>
    {/each}
  </div>

  <div class="block-head">
    <h2 class="block-title">Itinerari</h2>
    <button type="button" class="block-action" style="--accent: {accent}" onclick={openCreateItin}>
      + Crea
    </button>
  </div>

  {#if city.itineraries.length || cityCustomItins.length}
    <div class="itins">
      {#each cityCustomItins as it (it.id)}
        <ItineraryCard
          title={it.title}
          stopIds={it.stops}
          {accent}
          badge="Tuo · {it.stops.length} tappe"
          walkHint={longWalkSummary(it.stops)}
          custom
          onclick={() => go('mappa', customItineraryMapId(it.id))}
          onedit={() => openEditItin(it)}
          ondelete={() => confirmDeleteItin(it)}
        />
      {/each}
      {#each city.itineraries as it, idx (it.title)}
        <ItineraryCard
          title={it.title}
          stopIds={it.stops}
          {accent}
          walkHint={longWalkSummary(it.stops)}
          onclick={() => go('mappa', builtinItineraryMapId(city.id, idx))}
          onduplicate={() => duplicateBuiltin(it.title, it.stops)}
        />
      {/each}
    </div>
  {:else}
    <p class="itin-empty muted">Nessun itinerario ancora. Tocca <strong>+ Crea</strong> per scegliere le tappe.</p>
  {/if}
  <div class="itin-backup">
    <button type="button" class="backup-btn" onclick={exportItins}>Esporta i miei itinerari</button>
    <label class="backup-btn">
      Importa
      <input type="file" accept="application/json,.json" onchange={onImportFile} hidden />
    </label>
  </div>

  {#if editorOpen && city}
    <ItineraryEditor
      cityId={city.id}
      {cityPois}
      {accent}
      editing={editingItin}
      draft={editorDraft}
      onclose={closeEditor}
    />
  {/if}
{/if}

<style>
  .head {
    position: relative;
    margin-bottom: 20px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: linear-gradient(168deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-sm);
  }
  .head-bar {
    height: 3px;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 40%, transparent));
  }
  .head-inner { padding: 18px 20px 20px; }
  h1 {
    font-size: 2rem;
    line-height: 1.05;
    margin-top: 4px;
  }
  .cn {
    display: block;
    font-family: var(--hanzi);
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--accent);
    margin-top: 2px;
  }
  .when {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .intro {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
    font-size: 1.05rem;
    line-height: 1.65;
    color: var(--ink-soft);
  }

  .guide-intro {
    padding: 16px 18px 18px;
    margin-bottom: 10px;
    border-color: color-mix(in srgb, var(--accent) 22%, var(--line-strong));
  }
  .guide-intro-lbl {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--cinabro);
    margin-bottom: 10px;
  }
  .guide-sections {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }
  .guide-fold {
    padding: 0;
    overflow: hidden;
  }
  .guide-sum {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    cursor: pointer;
    list-style: none;
    user-select: none;
  }
  .guide-sum::-webkit-details-marker { display: none; }
  .guide-sum-title {
    font-family: var(--serif);
    font-size: 1.08rem;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.3;
  }
  .guide-sum-chevron {
    flex: none;
    font-size: 1.2rem;
    color: var(--ink-faint);
    transition: transform 0.2s var(--ease);
  }
  .guide-fold[open] .guide-sum-chevron { transform: rotate(90deg); }
  .guide-body {
    padding: 0 18px 18px;
    border-top: 1px solid var(--line);
  }
  .guide-fold[open] .guide-sum { border-bottom: none; }
  .g-p {
    margin: 14px 0 0;
    font-size: 1rem;
    line-height: 1.72;
    color: var(--ink-body);
  }
  .g-p:first-child { margin-top: 14px; }
  .g-h4 {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--jade-bright);
    margin: 18px 0 8px;
  }
  .g-kicker {
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--ink-soft);
    margin: 14px 0 6px;
  }
  .g-li {
    position: relative;
    list-style: none;
    padding: 0 0 0 18px;
    margin: 10px 0 0;
    font-size: 0.98rem;
    line-height: 1.65;
    color: var(--ink-body);
  }
  .g-li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.55em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent, var(--cinabro));
    opacity: 0.85;
  }

  .poi-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }
  .poi-row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 12px 14px 12px 12px;
    text-align: left;
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }
  .poi-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .poi-title {
    display: block;
    font-family: var(--serif);
    font-weight: 600;
    font-size: 1rem;
    line-height: 1.28;
    color: var(--ink);
  }
  .poi-blurb {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--ink-faint);
  }
  .poi-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
  }
  .poi-cat {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--c);
  }
  .st { font-size: 10px; color: var(--gold); letter-spacing: 0.5px; }
  .bk {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--cinabro-bright);
  }
  .poi-go {
    flex: none;
    font-size: 1.25rem;
    color: var(--ink-faint);
    line-height: 1;
  }

  .itins {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 8px;
  }
  .block-action {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--accent);
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .itin-empty {
    font-size: 0.9rem;
    line-height: 1.55;
    margin: 0 0 16px;
    padding: 14px 16px;
    border-radius: var(--radius-sm);
    border: 1px dashed var(--line-strong);
    background: var(--paper-2);
  }
  .itin-backup {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 4px 0 20px;
  }
  .backup-btn {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    padding: 8px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink-soft);
    cursor: pointer;
  }

  .link { color: var(--cinabro-bright); text-decoration: underline; }
</style>
