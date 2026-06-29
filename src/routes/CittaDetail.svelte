<script lang="ts">
  import { cittaById, cittaContentById, poisOfCity, poiById, legByCity } from '../lib/content';
  import { nav, go } from '../lib/router.svelte';
  import PoiPhoto from '../components/PoiPhoto.svelte';
  import { stars } from '../lib/poi';
  import { shortDate } from '../lib/format';
  import type { CityId } from '../data/types';

  const city = $derived(nav.id ? cittaById.get(nav.id as CityId) : undefined);
  const content = $derived(city ? cittaContentById.get(city.id) : undefined);
  const cityPois = $derived(city ? poisOfCity(city.id) : []);
  const leg = $derived(city ? legByCity.get(city.id) : undefined);
</script>

{#if !city}
  <div class="card"><p>Città non trovata. <button class="link" onclick={() => go('citta')}>Torna alle città</button></p></div>
{:else}
  <button class="back-link" onclick={() => go('citta')}>Tutte le città</button>

  <header class="head">
    <h1>{city.name} <span class="cn">{city.nameLocal}</span></h1>
    {#if leg}<div class="when">{shortDate(leg.from)} – {shortDate(leg.to)}</div>{/if}
    <p class="intro">{city.intro}</p>
  </header>

  <!-- POI della città -->
  <h2 class="section-title">Da vedere</h2>
  <div class="poi-grid">
    {#each cityPois as p (p.id)}
      <button class="poi" onclick={() => go('poi', p.id)}>
        <PoiPhoto id={p.id} category={p.category} name={p.name} variant="thumb" />
        <span class="pn">{p.name}</span>
        {#if p.stars}<span class="st">{stars(p.stars)}</span>{/if}
        {#if p.booking && /obblig/i.test(p.booking)}<span class="bk">prenota</span>{/if}
      </button>
    {/each}
  </div>

  <!-- Itinerari alternativi -->
  {#if city.itineraries.length}
    <h2 class="section-title">Itinerari</h2>
    <div class="itins">
      {#each city.itineraries as it (it.title)}
        <article class="card itin">
          <b>{it.title}</b>
          <div class="stops">
            {#each it.stops as s, i (s)}
              {@const p = poiById.get(s)}
              {#if p}<button class="stop" onclick={() => go('poi', p.id)}>{i + 1}. {p.name}</button>{/if}
            {/each}
          </div>
        </article>
      {/each}
    </div>
  {/if}

  <!-- Guida (contenuto ricco dalle schede) -->
  {#if content}
    <h2 class="section-title">Guida</h2>
    <div class="guide">
      {#each content.blocks as b, i (i)}
        {#if b.tag === 'h2'}
          <h3 class="g-h">{b.text}</h3>
        {:else if b.tag === 'h3' || b.tag === 'h4'}
          <h4 class="g-sh">{b.text}</h4>
        {:else if b.tag === 'li'}
          <li class="g-li">{b.text}</li>
        {:else}
          <p class="g-p">{b.text}</p>
        {/if}
      {/each}
    </div>
  {/if}
{/if}

<style>
  .head { padding-top: 4px; margin-bottom: 8px; }
  h1 { font-size: 2.1rem; }
  .cn { color: var(--jade-bright); font-weight: 500; font-size: 1.15rem; }
  .when {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-top: 6px;
  }
  .intro { font-size: 0.95rem; margin-top: 12px; color: var(--ink-soft); line-height: 1.6; }
  .poi-grid { display: flex; flex-direction: column; gap: 8px; }
  .poi {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 13px 16px;
    text-align: left;
    box-shadow: var(--shadow-sm);
    transition: border-color 0.15s, transform 0.15s var(--ease);
  }
  .poi:active { transform: scale(0.99); border-color: rgba(224, 74, 40, 0.3); }
  .pn { flex: 1; font-weight: 500; }
  .st { font-size: 11px; color: var(--gold); letter-spacing: 1px; }
  .bk {
    font-family: var(--mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--cinabro-bright);
    background: var(--cinabro-soft);
    border-radius: 4px;
    padding: 3px 7px;
    border: 1px solid rgba(224, 74, 40, 0.2);
  }
  .itins { display: flex; flex-direction: column; gap: 12px; }
  .itin b { color: var(--ink); font-size: 1rem; }
  .stops { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
  .stop {
    font-family: var(--mono);
    font-size: 11px;
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    padding: 5px 12px;
    color: var(--ink-soft);
    transition: border-color 0.15s, color 0.15s;
  }
  .stop:active { border-color: var(--cinabro); color: var(--ink); }
  .guide { font-size: 0.95rem; }
  .g-h { font-size: 1.2rem; color: var(--jade-bright); margin: 24px 0 8px; }
  .g-sh {
    font-family: var(--sans);
    font-weight: 600;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin: 18px 0 6px;
  }
  .g-p { margin: 10px 0; color: var(--ink-soft); line-height: 1.65; }
  .g-li { position: relative; list-style: none; padding-left: 22px; margin: 8px 0; color: var(--ink-soft); line-height: 1.55; }
  .g-li::before { content: ''; position: absolute; left: 4px; top: 10px; width: 6px; height: 6px; border-radius: 50%; background: var(--cinabro); }
  .link { color: var(--cinabro-bright); text-decoration: underline; }
</style>
