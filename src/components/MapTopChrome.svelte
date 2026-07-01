<script lang="ts">
  import { cityTheme } from '../lib/city-theme';
  import { CAT_COLOR, CAT_ICON, CAT_LABEL } from '../lib/poi';
  import { online } from '../lib/online.svelte';
  import type { Citta, CityId, PoiCategory } from '../data/types';

  const LEGEND: PoiCategory[] = ['storico', 'moderno', 'natura', 'intrattenimento', 'cibo'];

  interface Props {
    citta: Citta[];
    activeCity: CityId;
    mapLayer: 'poi' | 'metro' | 'route';
    tilesAvailable: boolean;
    routingOffline: boolean;
    geoNote: string;
    onFlyTo: (c: CityId) => void;
    onSetLayer: (l: 'poi' | 'metro' | 'route') => void;
  }
  let { citta, activeCity, mapLayer, tilesAvailable, routingOffline, geoNote, onFlyTo, onSetLayer }: Props =
    $props();
</script>

<div class="map-chrome">
  <div class="map-top">
    <div class="cities" role="tablist" aria-label="Città">
      {#each citta as c (c.id)}
        {@const th = cityTheme(c.id)}
        <button
          type="button"
          class="city"
          class:on={activeCity === c.id}
          style={activeCity === c.id ? `--c:${th.accent}` : undefined}
          role="tab"
          aria-selected={activeCity === c.id}
          onclick={() => onFlyTo(c.id)}
        >{c.name}</button>
      {/each}
    </div>

    <div class="layer-tabs" role="tablist" aria-label="Vista mappa">
      <button type="button" class="layer-tab" class:on={mapLayer === 'poi'} role="tab" aria-selected={mapLayer === 'poi'} onclick={() => onSetLayer('poi')}>POI</button>
      <button type="button" class="layer-tab" class:on={mapLayer === 'metro'} role="tab" aria-selected={mapLayer === 'metro'} onclick={() => onSetLayer('metro')}>Metro</button>
      <button type="button" class="layer-tab" class:on={mapLayer === 'route'} role="tab" aria-selected={mapLayer === 'route'} onclick={() => onSetLayer('route')}>Tappe</button>
    </div>
  </div>

  {#if mapLayer === 'poi'}
    <div class="map-bottom">
      <div class="map-info-row">
        {#each LEGEND as cat (cat)}
          <span class="lg">
            <span class="lg-ic" style="border-color:{CAT_COLOR[cat]}; color:{CAT_COLOR[cat]}">{CAT_ICON[cat]}</span>
            {CAT_LABEL[cat]}
          </span>
        {/each}
      </div>
      <div class="map-status-line">
        {#if tilesAvailable}
          <span class="map-status ok">
            {#if !online.network}✈ Offline{:else}✓ Online{/if}
            · mappa{#if routingOffline} · routing{/if}
          </span>
        {:else}
          <span class="map-status warn">🌐 Mappa online</span>
        {/if}
        {#if geoNote}<span class="map-status geo">{geoNote}</span>{/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .map-chrome {
    position: absolute;
    inset: 0;
    z-index: 6;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 10px 10px 12px;
  }
  .map-chrome > * { pointer-events: auto; }
  .map-top {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .map-top .cities {
    width: 100%;
  }
  .map-top .layer-tabs {
    align-self: center;
  }
  :global(.map-stage.fullscreen) .map-top .cities {
    width: calc(100% - 52px);
  }
  :global(.map-stage.fullscreen) .map-bottom {
    display: none;
  }
  .map-bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .cities {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px 0;
  }
  .cities::-webkit-scrollbar { display: none; }
  .city {
    flex: none;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    padding: 6px 12px;
    background: color-mix(in srgb, var(--surface) 75%, transparent);
    color: var(--ink-faint);
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.12s;
  }
  .city.on {
    background: linear-gradient(135deg, color-mix(in srgb, var(--c, var(--jade)) 92%, #000), var(--c, var(--jade)));
    color: #fff;
    border-color: transparent;
    box-shadow: 0 4px 14px color-mix(in srgb, var(--c, var(--jade)) 35%, transparent);
  }
  .city:active { transform: scale(0.97); }

  .layer-tabs {
    display: inline-grid;
    grid-auto-flow: column;
    gap: 3px;
    padding: 4px;
    background: color-mix(in srgb, #000 50%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-pill);
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.32);
  }
  .layer-tab {
    padding: 7px 20px;
    border: none;
    border-radius: var(--radius-pill);
    background: transparent;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.62);
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
  }
  .layer-tab.on {
    background: #fff;
    color: #14110d;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
  }

  .map-status-line {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
  }
  .map-info-row {
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 1px;
  }
  .map-info-row::-webkit-scrollbar { display: none; }
  .map-status {
    flex: 0 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 5px 10px;
    border-radius: var(--radius-pill);
    backdrop-filter: blur(10px);
    border: 1px solid var(--line-strong);
    background: color-mix(in srgb, var(--surface-elevated) 88%, transparent);
    color: var(--ink-soft);
  }
  .map-status.ok { flex: none; }
  .map-status.ok {
    color: var(--jade-bright);
    border-color: color-mix(in srgb, var(--jade) 35%, var(--line));
    background: color-mix(in srgb, var(--jade) 12%, transparent);
  }
  .map-status.warn {
    color: var(--cinabro-bright);
    background: var(--cinabro-soft);
  }
  .map-status.geo { color: var(--gold); }

  .lg {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #fff;
    padding: 5px 10px 5px 6px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, #000 52%, transparent);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .lg-ic {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    font-size: 11px;
    border-radius: 7px;
    border: 1.5px solid;
    background: color-mix(in srgb, currentColor 15%, transparent);
  }
</style>
