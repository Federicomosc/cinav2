<script lang="ts">
  import BigChars from '../components/BigChars.svelte';
  import PoiPhoto from '../components/PoiPhoto.svelte';
  import { poiById, cittaById } from '../lib/content';
  import { nav, go } from '../lib/router.svelte';
  import { AUTO_NAV_KEY } from '../lib/routing';
  import { CAT_COLOR, CAT_LABEL, stars } from '../lib/poi';

  const poi = $derived(nav.id ? poiById.get(nav.id) : undefined);
  const city = $derived(poi ? cittaById.get(poi.city) : undefined);
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

  <header class="head">
    <span class="cat" style="background:{CAT_COLOR[poi.category]}">{CAT_LABEL[poi.category]}</span>
    <PoiPhoto id={poi.id} category={poi.category} name={poi.name} variant="hero" />
    <h1>{poi.name}</h1>
    {#if poi.nameLocal}<p class="cn">{poi.nameLocal}</p>{/if}
    {#if poi.stars}<div class="stars">{stars(poi.stars)}</div>{/if}
  </header>

  {#if poi.blurb}<p class="blurb">{poi.blurb}</p>{/if}

  <div class="facts">
    {#if poi.price}<div class="fact"><span class="k">Prezzo</span><span class="v">{poi.price}</span></div>{/if}
    {#if poi.booking}
      <div class="fact" class:warn={bookingObbl}>
        <span class="k">Prenotazione</span><span class="v">{poi.booking}</span>
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
  .head { padding-top: 4px; }
  .cat {
    display: inline-block;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #fff;
    border-radius: var(--radius-pill);
    padding: 4px 12px;
    margin-bottom: 4px;
  }
  h1 { font-size: 2.1rem; margin: 10px 0 4px; }
  .cn { font-family: var(--hanzi); font-size: 1.4rem; color: var(--jade-bright); margin-top: 4px; }
  .stars { color: var(--gold); letter-spacing: 3px; margin-top: 8px; font-size: 14px; }
  .blurb { font-size: 0.98rem; margin: 16px 0; color: var(--ink-soft); line-height: 1.65; }
  .facts { display: flex; flex-direction: column; gap: 10px; margin: 16px 0; }
  .fact {
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 14px 16px;
    box-shadow: var(--shadow-sm);
  }
  .fact.warn { border-color: rgba(224, 74, 40, 0.4); background: var(--cinabro-soft); }
  .fact .k {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 4px;
  }
  .fact .v { font-size: 0.95rem; }
  .actions { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
  .btn-primary.nav {
    background: linear-gradient(135deg, var(--jade) 0%, #2d8a62 100%);
    border-color: var(--jade);
  }
  .link { color: var(--cinabro-bright); text-decoration: underline; }
</style>
