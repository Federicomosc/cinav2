<script lang="ts">
  import { cittaById, cittaContentById, poisOfCity, poiById, legByCity } from '../lib/content';
  import { nav, go } from '../lib/router.svelte';
  import PoiPhoto from '../components/PoiPhoto.svelte';
  import { stars, CAT_LABEL, CAT_COLOR } from '../lib/poi';
  import { shortDate } from '../lib/format';
  import type { CityId } from '../data/types';

  const CITY_ACCENT: Record<string, string> = {
    chengdu: '#52b788',
    chongqing: '#e05252',
    zhangjiajie: '#4fc3c7',
    pechino: '#e0b552',
    shanghai: '#9b6fd4',
  };

  const city = $derived(nav.id ? cittaById.get(nav.id as CityId) : undefined);
  const content = $derived(city ? cittaContentById.get(city.id) : undefined);
  const cityPois = $derived(city ? poisOfCity(city.id) : []);
  const leg = $derived(city ? legByCity.get(city.id) : undefined);
  const accent = $derived(city ? (CITY_ACCENT[city.id] ?? '#e84828') : '#e84828');
</script>

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
      <p class="intro prose-lead">{city.intro}</p>
    </div>
  </header>

  <h2 class="section-title">Da vedere</h2>
  <div class="poi-list">
    {#each cityPois as p (p.id)}
      <button class="poi-row" onclick={() => go('poi', p.id)}>
        <PoiPhoto id={p.id} category={p.category} name={p.name} variant="thumb" />
        <div class="poi-body">
          <span class="poi-title">{p.name}</span>
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

  {#if city.itineraries.length}
    <h2 class="section-title">Itinerari</h2>
    <div class="itins">
      {#each city.itineraries as it (it.title)}
        <article class="card itin">
          <b>{it.title}</b>
          <div class="stops">
            {#each it.stops as s, i (s)}
              {@const poi = poiById.get(s)}
              {#if poi}<button class="stop" onclick={() => go('poi', poi.id)}>{i + 1}. {poi.name}</button>{/if}
            {/each}
          </div>
        </article>
      {/each}
    </div>
  {/if}

  {#if content}
    <h2 class="section-title">Guida</h2>
    <article class="card guide-card">
      <div class="prose-guide">
        {#each content.blocks as b, i (i)}
          {#if b.tag === 'h2'}
            <h3>{b.text}</h3>
          {:else if b.tag === 'h3' || b.tag === 'h4'}
            <h4>{b.text}</h4>
          {:else if b.tag === 'li'}
            <li>{b.text}</li>
          {:else}
            <p>{b.text}</p>
          {/if}
        {/each}
      </div>
    </article>
  {/if}
{/if}

<style>
  .head {
    position: relative;
    margin-bottom: 8px;
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
  }

  .poi-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
    transition: border-color 0.15s, background 0.15s, transform 0.15s var(--ease);
  }
  .poi-row:active {
    border-color: rgba(232, 72, 40, 0.3);
    background: var(--surface-hi);
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
    letter-spacing: -0.01em;
  }
  .poi-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
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

  .itins { display: flex; flex-direction: column; gap: 12px; }
  .itin b {
    display: block;
    font-family: var(--serif);
    font-size: 1.05rem;
    color: var(--ink);
    margin-bottom: 2px;
  }
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
  .guide-card { padding: 20px 20px 22px; }
  .link { color: var(--cinabro-bright); text-decoration: underline; }
</style>
