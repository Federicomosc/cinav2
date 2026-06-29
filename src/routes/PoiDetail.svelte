<script lang="ts">
  import BigChars from '../components/BigChars.svelte';
  import PoiPhoto from '../components/PoiPhoto.svelte';
  import { poiById, cittaById } from '../lib/content';
  import { nav, go } from '../lib/router.svelte';
  import { AUTO_NAV_KEY } from '../lib/routing';
  import { CAT_COLOR, CAT_LABEL, stars } from '../lib/poi';
  import { cityTheme } from '../lib/city-theme';

  const poi = $derived(nav.id ? poiById.get(nav.id) : undefined);
  const city = $derived(poi ? cittaById.get(poi.city) : undefined);
  const accent = $derived(poi ? cityTheme(poi.city).accent : '#e84828');
  const catColor = $derived(poi ? CAT_COLOR[poi.category] : '#888');
  const bookingObbl = $derived(!!poi?.booking && /obblig/i.test(poi.booking));

  let showTaxi = $state(false);

  function openMap() {
    go('mappa', poi!.id);
  }

  function navigateThere() {
    try { sessionStorage.setItem(AUTO_NAV_KEY, poi!.id); } catch { /* ignore */ }
    go('mappa', poi!.id);
  }
</script>

{#if !poi}
  <div class="card"><p>POI non trovato. <button class="link" onclick={() => go('citta')}>Torna alle città</button></p></div>
{:else}
  <button class="back-link" onclick={() => go('citta', poi.city)}>{city?.name ?? 'Indietro'}</button>

  <header class="poi-hero" style="--accent: {accent}; --cat: {catColor}">
    <div class="poi-photo-shell">
      <PoiPhoto id={poi.id} category={poi.category} name={poi.name} variant="hero" />
      <div class="poi-photo-fade" aria-hidden="true"></div>
      <span class="poi-tag">{CAT_LABEL[poi.category]}</span>
    </div>
    <div class="poi-hero-text">
      <h1>{poi.name}</h1>
      {#if poi.nameLocal}<p class="cn">{poi.nameLocal}</p>{/if}
      {#if poi.stars}<div class="stars">{stars(poi.stars)}</div>{/if}
    </div>
  </header>

  {#if poi.blurb}
    <aside class="prose-block" style="--prose-accent: {catColor}" aria-label="Descrizione">
      <span class="prose-label">In breve</span>
      <p class="prose-body">{poi.blurb}</p>
    </aside>
  {:else}
    <p class="no-blurb muted">Descrizione in arrivo — controlla la guida della città per più dettagli.</p>
  {/if}

  <div class="facts">
    {#if poi.price}
      <div class="fact">
        <span class="fact-ic" aria-hidden="true">¥</span>
        <div class="fact-inner">
          <span class="k">Prezzo</span>
          <span class="v">{poi.price}</span>
        </div>
      </div>
    {/if}
    {#if poi.booking}
      <div class="fact" class:warn={bookingObbl}>
        <span class="fact-ic" aria-hidden="true">◎</span>
        <div class="fact-inner">
          <span class="k">Prenotazione</span>
          <span class="v">{poi.booking}</span>
        </div>
      </div>
    {/if}
  </div>

  <div class="actions">
    {#if poi.nameLocal}
      <button class="btn-primary" onclick={() => (showTaxi = true)}>语 Mostra al tassista</button>
    {/if}
    <button class="btn-primary nav" onclick={navigateThere}>🧭 Come arrivare</button>
    <button class="btn-ghost" onclick={openMap}>◎ Apri nella mappa</button>
  </div>

  {#if showTaxi && poi.nameLocal}
    <BigChars hanzi={poi.nameLocal} it={poi.name} onclose={() => (showTaxi = false)} />
  {/if}
{/if}

<style>
  .poi-hero {
    margin-bottom: 20px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--cat) 30%, var(--line-strong));
    box-shadow:
      var(--shadow-md),
      0 0 0 1px color-mix(in srgb, var(--cat) 8%, transparent),
      0 20px 40px color-mix(in srgb, var(--cat) 10%, transparent);
  }
  .poi-photo-shell {
    position: relative;
  }
  .poi-photo-shell :global(.frame.hero) {
    margin-bottom: 0;
    max-height: 240px;
    border: none;
    border-radius: 0;
    aspect-ratio: 16 / 10;
  }
  .poi-photo-fade {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg, transparent 40%, color-mix(in srgb, var(--surface) 95%, transparent) 88%, var(--surface) 100%);
  }
  .poi-tag {
    position: absolute;
    left: 14px;
    top: 14px;
    z-index: 2;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #fff;
    border-radius: var(--radius-pill);
    padding: 5px 12px;
    background: color-mix(in srgb, var(--cat) 88%, #000);
    border: 1px solid color-mix(in srgb, #fff 25%, transparent);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--cat) 40%, transparent);
  }
  .poi-hero-text {
    padding: 16px 20px 20px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--cat) 4%, var(--surface)) 0%, var(--surface) 100%);
  }
  h1 {
    font-size: 2.1rem;
    margin: 0 0 4px;
    letter-spacing: -0.02em;
    line-height: 1.05;
  }
  .cn {
    font-family: var(--hanzi);
    font-size: 1.55rem;
    font-weight: 500;
    color: var(--accent);
    margin-top: 4px;
    text-shadow: 0 0 28px color-mix(in srgb, var(--accent) 22%, transparent);
  }
  .stars { color: var(--gold); letter-spacing: 3px; margin-top: 10px; font-size: 14px; }
  .no-blurb {
    font-size: 0.9rem;
    font-style: italic;
    margin: 12px 0 4px;
    padding: 14px 16px;
    background: var(--paper-2);
    border-radius: var(--radius-md);
    border: 1px dashed var(--line-strong);
  }
  .facts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 18px 0;
  }
  .fact {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    box-shadow: var(--shadow-sm);
  }
  .fact.warn {
    border-color: color-mix(in srgb, var(--cinabro) 45%, var(--line-strong));
    background: linear-gradient(155deg, var(--cinabro-soft) 0%, var(--surface) 100%);
  }
  .fact-ic {
    flex: none;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--accent) 25%, var(--line));
  }
  .fact.warn .fact-ic {
    color: var(--cinabro-bright);
    background: color-mix(in srgb, var(--cinabro) 15%, transparent);
    border-color: color-mix(in srgb, var(--cinabro) 30%, var(--line));
  }
  .fact-inner { flex: 1; min-width: 0; }
  .fact .k {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 4px;
  }
  .fact .v { font-size: 0.98rem; line-height: 1.45; }
  .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
  .btn-primary.nav {
    background: linear-gradient(135deg, var(--jade) 0%, #2d8a62 100%);
    border-color: var(--jade);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--jade) 30%, transparent);
  }
  .link { color: var(--cinabro-bright); text-decoration: underline; }
</style>
