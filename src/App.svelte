<script lang="ts">
  import { nav, navMotion, isTab, type Tab } from './lib/router.svelte';
  import { itinerario, transports, poiById } from './lib/content';
  import { computeOggi } from './lib/today';
  import { cityTheme } from './lib/city-theme';
  import type { CityId } from './data/types';
  import BottomNav from './components/BottomNav.svelte';
  import OfflineBanner from './components/OfflineBanner.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import BackupReminder from './components/BackupReminder.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import ToastStack from './components/ToastStack.svelte';
  import Oggi from './routes/Oggi.svelte';
  import Citta from './routes/Citta.svelte';
  import CittaDetail from './routes/CittaDetail.svelte';
  import PoiDetail from './routes/PoiDetail.svelte';
  import Logistica from './routes/Logistica.svelte';
  import Mappa from './routes/Mappa.svelte';
  import Frasario from './routes/Frasario.svelte';
  import Documenti from './routes/Documenti.svelte';
  import Spese from './routes/Spese.svelte';
  import Emergenze from './routes/Emergenze.svelte';
  import Album from './routes/Album.svelte';
  import type { Component } from 'svelte';

  const tabViews: Record<Tab, Component> = {
    oggi: Oggi,
    citta: Citta,
    logistica: Logistica,
    mappa: Mappa,
    frasario: Frasario,
    documenti: Documenti,
    spese: Spese,
    emergenze: Emergenze,
    album: Album,
  };

  function resolve(): { comp: Component; key: string } {
    if (nav.seg === 'poi' && nav.id) return { comp: PoiDetail, key: 'poi/' + nav.id };
    if (nav.seg === 'citta' && nav.id) return { comp: CittaDetail, key: 'citta/' + nav.id };
    const tab: Tab = isTab(nav.seg) ? nav.seg : 'oggi';
    return { comp: tabViews[tab], key: tab };
  }

  const route = $derived(resolve());
  const Comp = $derived(route.comp);

  const oggiInfo = computeOggi(itinerario, transports);
  const cityAccent = $derived.by(() => {
    if (nav.seg === 'citta' && nav.id) return cityTheme(nav.id as CityId).accent;
    if (nav.seg === 'poi' && nav.id) {
      const poi = poiById.get(nav.id);
      if (poi) return cityTheme(poi.city).accent;
    }
    if (oggiInfo.leg) return cityTheme(oggiInfo.leg.city).accent;
    return '#e84828';
  });
  const routeMotionClass = $derived(
    navMotion.dir === 1 ? 'slide-forward' : navMotion.dir === -1 ? 'slide-back' : '',
  );

  // La Mappa è pesante (MapLibre + tile + marker): la montiamo alla prima
  // apertura e poi la teniamo VIVA, mostrandola/nascondendola, così le
  // riaperture sono istantanee invece di re-inizializzare tutto ogni volta.
  const isMap = $derived(route.key === 'mappa');
  let mapMounted = $state(false);
  $effect(() => {
    if (isMap) mapMounted = true;
  });

  let navCompact = $state(false);

  function onScreenScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    navCompact = el.scrollTop > 48;
  }
</script>

<div class="app-shell" style="--city-accent: {cityAccent}">
  <div
    class="app-ambient"
    style="--city-accent: {cityAccent}"
    aria-hidden="true"
  ></div>

  {#if !isMap}
    <ThemeToggle class="shell-theme" />
  {/if}

  <main
    class="screen"
    class:screen-tight={route.key === 'oggi'}
    class:screen-map={route.key === 'mappa'}
    onscroll={onScreenScroll}
  >
    <OfflineBanner />
    <UpdateBanner />
    <BackupReminder />
    <ToastStack />

    {#if mapMounted}
      <div class="route-view map-keepalive" class:map-hidden={!isMap} aria-hidden={!isMap}>
        <Mappa />
      </div>
    {/if}

    {#if !isMap}
      {#key route.key}
        <div class="route-view {routeMotionClass}">
          <Comp />
        </div>
      {/key}
    {/if}
  </main>

  <BottomNav compact={navCompact} />
</div>

<style>
  /* Toggle tema: in alto a destra, fuori dalla zona-pollice e dal contenuto
     (prima galleggiava in basso a sinistra sopra il testo). */
  :global(.shell-theme) {
    position: fixed;
    top: calc(var(--safe-top) + 8px);
    right: max(10px, calc(50% - 240px + 10px));
    z-index: 55;
  }
  @media (max-width: 480px) {
    :global(.shell-theme) {
      right: 10px;
    }
  }
  /* Mappa tenuta viva ma fuori dalla tab attiva */
  .map-keepalive { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .map-hidden { display: none; }
</style>
