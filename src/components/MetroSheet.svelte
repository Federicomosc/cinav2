<script lang="ts">
  import type { MetroCityData, MetroStation } from '../lib/metro';
  import type { MetroRoutePlan } from '../lib/metro-route';
  import type { Citta } from '../data/types';

  type MetroSheetTab = 'route' | 'list';

  interface Props {
    metroData: MetroCityData;
    activeCityMeta: Citta | undefined;
    metroSheetTab: MetroSheetTab;
    metroQuery: string;
    metroLineFilter: string;
    routeFromQ: string;
    routeToQ: string;
    routeFromId: string | null;
    routeToId: string | null;
    routeFromPicks: MetroStation[];
    routeToPicks: MetroStation[];
    metroRoutePlan: MetroRoutePlan | null;
    metroRouteSteps: string[];
    metroStationsFiltered: MetroStation[];
    onSetTab: (t: MetroSheetTab) => void;
    onSetLineFilter: (id: string) => void;
    onPickField: (f: 'from' | 'to') => void;
    onSelectStation: (field: 'from' | 'to', st: MetroStation) => void;
    onSwap: () => void;
    onFlyToStation: (st: MetroStation) => void;
    stationLineColor: (st: MetroStation) => string;
  }
  let {
    metroData,
    activeCityMeta,
    metroSheetTab,
    metroQuery = $bindable(),
    metroLineFilter,
    routeFromQ = $bindable(),
    routeToQ = $bindable(),
    routeFromId,
    routeToId,
    routeFromPicks,
    routeToPicks,
    metroRoutePlan,
    metroRouteSteps,
    metroStationsFiltered,
    onSetTab,
    onSetLineFilter,
    onPickField,
    onSelectStation,
    onSwap,
    onFlyToStation,
    stationLineColor,
  }: Props = $props();
</script>

<aside class="metro-sheet" class:route-tab={metroSheetTab === 'route'} aria-label="Metro {activeCityMeta?.name}">
  {#if !metroData.hasMetro}
    <p class="metro-empty">{metroData.note}</p>
  {:else}
    <div class="metro-sheet-tabs" role="tablist" aria-label="Modalità metro">
      <button type="button" class="m-tab" class:on={metroSheetTab === 'route'} role="tab" aria-selected={metroSheetTab === 'route'} onclick={() => onSetTab('route')}>Percorso</button>
      <button type="button" class="m-tab" class:on={metroSheetTab === 'list'} role="tab" aria-selected={metroSheetTab === 'list'} onclick={() => onSetTab('list')}>Fermate</button>
    </div>

    {#if metroSheetTab === 'route'}
      <div class="route-fields">
        <label class="route-field">
          <span class="route-lbl">Da</span>
          <input
            class="metro-search"
            type="search"
            placeholder="Stazione di partenza…"
            bind:value={routeFromQ}
            onfocus={() => onPickField('from')}
          />
          {#if routeFromPicks.length}
            <ul class="route-picks">
              {#each routeFromPicks as st (st.id)}
                <li><button type="button" class="route-pick" onclick={() => onSelectStation('from', st)}>{st.nameLocal} · {st.name}</button></li>
              {/each}
            </ul>
          {/if}
        </label>
        <button type="button" class="route-swap" onclick={onSwap} aria-label="Inverti partenza e arrivo">⇅</button>
        <label class="route-field">
          <span class="route-lbl">A</span>
          <input
            class="metro-search"
            type="search"
            placeholder="Stazione di arrivo…"
            bind:value={routeToQ}
            onfocus={() => onPickField('to')}
          />
          {#if routeToPicks.length}
            <ul class="route-picks">
              {#each routeToPicks as st (st.id)}
                <li><button type="button" class="route-pick" onclick={() => onSelectStation('to', st)}>{st.nameLocal} · {st.name}</button></li>
              {/each}
            </ul>
          {/if}
        </label>
      </div>

      {#if routeFromId && routeToId && routeFromId === routeToId}
        <p class="route-err">Partenza e arrivo devono essere diverse.</p>
      {:else if routeFromId && routeToId && !metroRoutePlan}
        <p class="route-err">Nessun collegamento metro tra queste due fermate nei dati offline.</p>
      {:else if metroRoutePlan}
        <div class="route-summary">
          <span class="route-meta">{metroRoutePlan.stops} fermate{#if metroRoutePlan.transfers} · {metroRoutePlan.transfers} {metroRoutePlan.transfers === 1 ? 'cambio' : 'cambi'}{/if}</span>
        </div>
        <ol class="route-steps">
          {#each metroRouteSteps as step, i (i)}
            <li class="route-step">{step}</li>
          {/each}
        </ol>
      {:else}
        <p class="route-hint">Scegli due stazioni per sapere quali linee prendere.</p>
      {/if}
    {:else}
      <input class="metro-search" type="search" placeholder="Cerca fermata…" bind:value={metroQuery} />
      <div class="metro-line-row">
        <button type="button" class="m-line" class:on={metroLineFilter === 'all'} onclick={() => onSetLineFilter('all')}>Tutte</button>
        {#each metroData.lines as line (line.id)}
          <button
            type="button"
            class="m-line"
            class:on={metroLineFilter === line.id}
            style="--lc:{line.color}"
            onclick={() => onSetLineFilter(line.id)}
            title={line.nameLocal}
          >{line.number}</button>
        {/each}
      </div>
      <ul class="metro-rows">
        {#each metroStationsFiltered as st (st.id)}
          <li>
            <button type="button" class="m-row" onclick={() => onFlyToStation(st)}>
              <span class="m-dot" style="background:{stationLineColor(st)}"></span>
              <span class="m-label">
                <span class="m-hanzi">{st.nameLocal}</span>
                <span class="m-it">{st.name}</span>
              </span>
              {#if st.nearPoi}<span class="m-poi">POI</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</aside>

<style>
  .metro-sheet {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 5;
    max-height: 38%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--surface-elevated) 90%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
    border: 1px solid color-mix(in srgb, var(--map-accent) 22%, var(--line-strong));
    border-radius: var(--radius-md);
    box-shadow:
      var(--shadow-lg),
      0 0 24px color-mix(in srgb, var(--map-accent) 10%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .metro-sheet.route-tab {
    max-height: 52%;
  }
  :global(.map-stage.fullscreen) .metro-sheet {
    bottom: calc(14px + var(--safe-bottom));
  }
  .metro-sheet-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 3px;
    background: var(--paper-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    flex: none;
  }
  .m-tab {
    padding: 7px 8px;
    border: none;
    border-radius: calc(var(--radius-sm) - 2px);
    background: transparent;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-faint);
  }
  .m-tab.on {
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow-sm);
  }
  .route-fields {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 6px;
    align-items: start;
    flex: none;
  }
  .route-field {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .route-lbl {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .route-swap {
    align-self: end;
    width: 34px;
    height: 34px;
    margin-bottom: 2px;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
    font-size: 15px;
  }
  .route-picks {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(100% + 4px);
    z-index: 8;
    list-style: none;
    margin: 0;
    padding: 4px;
    background: var(--surface-elevated);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
    max-height: min(220px, 40vh);
    overflow-y: auto;
  }
  .route-pick {
    width: 100%;
    text-align: left;
    padding: 8px 8px;
    border: none;
    border-radius: var(--radius-xs);
    background: none;
    color: var(--ink);
    font-size: 0.8rem;
  }
  .route-pick:active { background: var(--paper-2); }
  .route-summary { flex: none; }
  .route-meta {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--gold);
    letter-spacing: 0.04em;
  }
  .route-steps {
    margin: 0;
    padding: 0 0 0 18px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
  .route-step {
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--ink-body);
    margin-bottom: 8px;
  }
  .route-hint, .route-err {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--ink-faint);
  }
  .route-err { color: var(--cinabro-bright); }
  .metro-empty {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.45;
    color: var(--ink-faint);
  }
  .metro-search {
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 0.88rem;
  }
  .metro-line-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    flex: none;
  }
  .metro-line-row::-webkit-scrollbar { display: none; }
  .m-line {
    flex: none;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    border-radius: var(--radius-pill);
    border: 2px solid var(--lc, var(--line-strong));
    background: color-mix(in srgb, var(--lc, var(--surface)) 20%, var(--surface));
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--ink);
  }
  .m-line.on {
    box-shadow: 0 0 0 2px var(--paper), 0 0 0 3px var(--lc, var(--gold));
  }
  .metro-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
  .m-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 4px;
    border: none;
    border-bottom: 1px solid var(--line);
    background: none;
    color: inherit;
    text-align: left;
  }
  .m-row:last-child { border-bottom: none; }
  .m-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
  }
  .m-label {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .m-hanzi {
    font-family: var(--hanzi);
    font-size: 1rem;
    color: var(--ink);
    line-height: 1.2;
  }
  .m-it {
    font-size: 0.78rem;
    color: var(--ink-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .m-poi {
    flex: none;
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--jade-bright);
  }
</style>
