<script lang="ts">
  import { cittaById, cittaContentById, poisOfCity, legByCity, citta as allCitta } from '../lib/content';
  import { nav, go } from '../lib/router.svelte';
  import PoiPhoto from '../components/PoiPhoto.svelte';
  import { stars, CAT_LABEL, CAT_COLOR } from '../lib/poi';
  import { shortDate } from '../lib/format';
  import { cityTheme, cityCoverSrc } from '../lib/city-theme';
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
  const theme = $derived(city ? cityTheme(city.id) : undefined);
  const coverSrc = $derived(city ? cityCoverSrc(city.id) : '');
  const tappaN = $derived(city ? allCitta.findIndex((c) => c.id === city.id) + 1 : 0);
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

  <header class="city-hero" style="--accent: {accent}">
    <div class="hero-cover-wrap">
      {#if coverSrc}
        <img class="hero-cover" src={coverSrc} alt="" loading="eager" decoding="async" />
      {/if}
      <div class="hero-scrim" aria-hidden="true"></div>
      <div class="hero-accent-bar" aria-hidden="true"></div>
      <span class="hero-wm" aria-hidden="true">{city.nameLocal}</span>
      {#if theme}<span class="hero-icon" aria-hidden="true">{theme.icon}</span>{/if}

      <div class="hero-overlay">
        <div class="hero-meta">
          {#if theme}
            <span class="hero-badge">{theme.icon} Tappa {tappaN}</span>
          {/if}
          {#if leg}
            <span class="hero-when">{shortDate(leg.from)} – {shortDate(leg.to)}</span>
          {/if}
        </div>
        <h1>{city.name}</h1>
        <span class="hero-cn">{city.nameLocal}</span>
      </div>
    </div>

    <div class="hero-panel">
      <p class="hero-intro">{city.intro}</p>
      <div class="hero-stats">
        <div class="hero-stat">
          <span class="hero-stat-n">{cityPois.length}</span>
          <span class="hero-stat-l">luoghi</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-n">{guide.sections.length}</span>
          <span class="hero-stat-l">sezioni guida</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-n">{city.itineraries.length + cityCustomItins.length}</span>
          <span class="hero-stat-l">itinerari</span>
        </div>
      </div>
      <div class="hero-chips">
        {#each city.highlights as h (h)}
          <span class="hero-chip">{h}</span>
        {/each}
      </div>
    </div>
  </header>

  {#if content && (guide.intro.length || guide.sections.length)}
    <div class="section-deco" style="--accent: {accent}" aria-hidden="true">
      <span class="section-line"></span>
      <span class="section-seal">文</span>
      <span class="section-line"></span>
    </div>
    <div class="block-head block-head-premium">
      <h2 class="block-title">Guida</h2>
      <span class="block-sub">{guide.sections.length} capitoli</span>
    </div>

    {#if guide.intro.length}
      <article class="guide-intro prose-block" style="--prose-accent: {accent}">
        <span class="prose-label">In sintesi</span>
        <div class="guide-body guide-body-tight">
          {@render guideBlocks(guide.intro)}
        </div>
      </article>
    {/if}

    <div class="guide-sections">
      {#each guide.sections as sec, i (sec.title)}
        <details class="guide-fold card" style="--accent: {accent}" open={i === 0}>
          <summary class="guide-sum">
            <span class="guide-sum-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
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

  <div class="section-deco" style="--accent: {accent}" aria-hidden="true">
    <span class="section-line"></span>
    <span class="section-seal">景</span>
    <span class="section-line"></span>
  </div>
  <div class="block-head block-head-premium">
    <h2 class="block-title">Da vedere</h2>
    <span class="block-sub">{cityPois.length} luoghi</span>
  </div>
  <div class="poi-list list-stagger">
    {#each cityPois as p (p.id)}
      <button
        class="poi-row card-interactive"
        style="--c: {CAT_COLOR[p.category]}; --accent: {accent}"
        onclick={() => go('poi', p.id)}
      >
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

  <div class="section-deco" style="--accent: {accent}" aria-hidden="true">
    <span class="section-line"></span>
    <span class="section-seal">路</span>
    <span class="section-line"></span>
  </div>
  <div class="block-head block-head-premium">
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
  .city-hero {
    position: relative;
    margin-bottom: 32px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line-strong));
    box-shadow:
      var(--shadow-lg),
      0 0 0 1px color-mix(in srgb, var(--accent) 8%, transparent),
      0 28px 56px color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .hero-cover-wrap {
    position: relative;
    height: 220px;
    overflow: hidden;
  }
  .hero-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(1.18) contrast(1.06);
    transform: scale(1.03);
  }
  .hero-scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(135deg, color-mix(in srgb, #000 50%, transparent) 0%, transparent 45%),
      linear-gradient(180deg, transparent 0%, transparent 30%, color-mix(in srgb, #000 75%, transparent) 100%);
    pointer-events: none;
  }
  .hero-accent-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 25%, transparent) 80%, transparent);
    box-shadow: 0 -8px 28px color-mix(in srgb, var(--accent) 45%, transparent);
    z-index: 3;
  }
  .hero-wm {
    position: absolute;
    right: 8px;
    top: 4px;
    font-family: var(--hanzi);
    font-size: 5.5rem;
    font-weight: 600;
    line-height: 1;
    color: color-mix(in srgb, #fff 12%, var(--accent));
    opacity: 0.85;
    pointer-events: none;
    user-select: none;
    z-index: 1;
  }
  .hero-icon {
    position: absolute;
    right: 16px;
    top: 16px;
    font-size: 1.75rem;
    z-index: 4;
    filter: drop-shadow(0 2px 10px rgba(0, 0, 0, 0.5));
  }
  .hero-overlay {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 18px 20px 20px;
    z-index: 3;
  }
  .hero-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }
  .hero-badge {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #fff;
    padding: 5px 11px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--accent) 75%, #000);
    border: 1px solid color-mix(in srgb, #fff 22%, transparent);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .hero-when {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.75);
    white-space: nowrap;
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, #000 40%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  h1 {
    font-size: 2.35rem;
    line-height: 1.02;
    letter-spacing: -0.025em;
    color: #fff;
    text-shadow: 0 2px 20px rgba(0, 0, 0, 0.55);
    margin: 0;
  }
  .hero-cn {
    display: block;
    font-family: var(--hanzi);
    font-size: 1.5rem;
    font-weight: 500;
    color: color-mix(in srgb, #fff 90%, var(--accent));
    margin-top: 4px;
    text-shadow: 0 1px 14px rgba(0, 0, 0, 0.45);
  }

  .hero-panel {
    padding: 18px 20px 22px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent) 5%, var(--surface)) 0%,
      var(--surface) 100%
    );
  }
  .hero-intro {
    margin: 0 0 16px;
    font-size: 1.05rem;
    line-height: 1.7;
    color: var(--ink-soft);
    padding-left: 14px;
    border-left: 3px solid color-mix(in srgb, var(--accent) 55%, transparent);
  }
  .hero-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }
  .hero-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 12px 8px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--accent) 6%, var(--paper-2));
    border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .hero-stat-n {
    font-family: var(--serif);
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1;
    color: var(--accent);
  }
  .hero-stat-l {
    font-family: var(--mono);
    font-size: 7px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    text-align: center;
  }
  .hero-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .hero-chip {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-body);
    padding: 6px 11px;
    border-radius: var(--radius-pill);
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--line-strong));
    box-shadow: var(--shadow-sm);
  }

  .section-deco {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 28px 0 14px;
  }
  .section-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--line-strong) 20%,
      color-mix(in srgb, var(--accent) 35%, transparent) 50%,
      var(--line-strong) 80%,
      transparent
    );
  }
  .section-seal {
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    font-family: var(--hanzi);
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
    border-radius: 8px;
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 20%, transparent);
  }
  .block-head-premium {
    margin-bottom: 14px;
  }
  .block-head-premium .block-title::before {
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 40%, var(--gold)));
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 35%, transparent);
  }

  .guide-intro {
    margin-bottom: 14px;
  }
  .guide-body-tight .g-p:first-child { margin-top: 0; }
  .guide-sections {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 8px;
  }
  .guide-fold {
    padding: 0;
    overflow: hidden;
    border-color: color-mix(in srgb, var(--accent) 20%, var(--line-strong));
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    transition: border-color 0.25s var(--ease), box-shadow 0.25s var(--ease), transform 0.2s var(--ease);
  }
  .guide-fold[open] {
    border-color: color-mix(in srgb, var(--accent) 42%, var(--line-strong));
    box-shadow:
      var(--shadow-md),
      inset 4px 0 0 var(--accent),
      0 8px 24px color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .guide-sum {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    cursor: pointer;
    list-style: none;
    user-select: none;
  }
  .guide-sum::-webkit-details-marker { display: none; }
  .guide-sum-num {
    flex: none;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
    background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 65%, #000));
    border-radius: 10px;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .guide-sum-title {
    flex: 1;
    font-family: var(--serif);
    font-size: 1.12rem;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.3;
  }
  .guide-sum-chevron {
    flex: none;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    font-size: 1.1rem;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--line));
    transition: transform 0.22s var(--ease), background 0.22s var(--ease);
  }
  .guide-fold[open] .guide-sum-chevron {
    transform: rotate(90deg);
    background: color-mix(in srgb, var(--accent) 20%, transparent);
  }
  .guide-body {
    padding: 4px 18px 22px;
    border-top: 1px solid var(--line);
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 5%, transparent) 0%, transparent 56px);
  }
  .g-p {
    margin: 14px 0 0;
    font-size: 1rem;
    line-height: 1.78;
    color: var(--ink-body);
    text-wrap: pretty;
  }
  .g-p:first-child { margin-top: 14px; }
  .g-h4 {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--jade-bright);
    margin: 22px 0 8px;
  }
  .g-kicker {
    font-family: var(--serif);
    font-weight: 600;
    font-size: 1.02rem;
    color: var(--ink);
    margin: 18px 0 6px;
  }
  .g-li {
    position: relative;
    list-style: none;
    padding: 0 0 0 22px;
    margin: 12px 0 0;
    font-size: 0.98rem;
    line-height: 1.7;
    color: var(--ink-body);
  }
  .g-li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.55em;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent, var(--cinabro));
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 55%, transparent);
  }

  .poi-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 8px;
  }
  .poi-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 12px 14px 12px 18px;
    text-align: left;
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: transform 0.18s var(--ease), box-shadow 0.18s var(--ease), border-color 0.18s var(--ease);
  }
  .poi-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, var(--c), color-mix(in srgb, var(--c) 35%, transparent));
    border-radius: var(--radius-md) 0 0 var(--radius-md);
  }
  .poi-row::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 80px;
    height: 80px;
    background: radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--c) 8%, transparent), transparent 70%);
    pointer-events: none;
  }
  .poi-row:active {
    transform: scale(0.985);
    border-color: color-mix(in srgb, var(--c) 48%, var(--line-strong));
    box-shadow:
      var(--shadow-md),
      0 0 0 1px color-mix(in srgb, var(--c) 14%, transparent),
      0 12px 28px color-mix(in srgb, var(--c) 10%, transparent);
  }
  .poi-row :global(.frame.thumb) {
    box-shadow:
      0 0 0 2px color-mix(in srgb, var(--c) 25%, var(--line)),
      0 4px 12px color-mix(in srgb, var(--c) 15%, transparent);
  }
  .poi-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
    z-index: 1;
  }
  .poi-title {
    display: block;
    font-family: var(--serif);
    font-weight: 600;
    font-size: 1.08rem;
    line-height: 1.28;
    color: var(--ink);
  }
  .poi-blurb {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.84rem;
    line-height: 1.48;
    color: var(--ink-faint);
  }
  .poi-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
  .poi-cat {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--c);
    padding: 3px 9px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 30%, var(--line));
  }
  .st { font-size: 10px; color: var(--gold); letter-spacing: 0.5px; }
  .bk {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--cinabro-bright);
    padding: 3px 8px;
    border-radius: var(--radius-pill);
    background: var(--cinabro-soft);
    border: 1px solid color-mix(in srgb, var(--cinabro) 35%, var(--line));
  }
  .poi-go {
    flex: none;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    font-size: 1.2rem;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
    border-radius: 50%;
    line-height: 1;
    position: relative;
    z-index: 1;
    box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .itins {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-bottom: 8px;
  }
  .block-action {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--accent);
    padding: 7px 14px;
    border-radius: var(--radius-pill);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--line));
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 12%, transparent);
    transition: transform 0.15s var(--ease), box-shadow 0.15s;
  }
  .block-action:active {
    transform: scale(0.97);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 20%, transparent);
  }
  .itin-empty {
    font-size: 0.9rem;
    line-height: 1.55;
    margin: 0 0 16px;
    padding: 18px 20px;
    border-radius: var(--radius-md);
    border: 1px dashed color-mix(in srgb, var(--accent) 35%, var(--line-strong));
    background: linear-gradient(155deg, color-mix(in srgb, var(--accent) 6%, var(--paper-2)) 0%, var(--paper-2) 100%);
    text-align: center;
  }
  .itin-backup {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0 28px;
    padding: 14px;
    border-radius: var(--radius-md);
    background: var(--paper-2);
    border: 1px solid var(--line);
  }
  .backup-btn {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .backup-btn:active {
    border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
    color: var(--ink);
  }

  .link { color: var(--cinabro-bright); text-decoration: underline; }
</style>
