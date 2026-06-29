<script lang="ts">
  import { nav, navMotion, isTab, type Tab } from './lib/router.svelte';
  import { itinerario, transports, poiById } from './lib/content';
  import { computeOggi } from './lib/today';
  import { cityTheme } from './lib/city-theme';
  import type { CityId } from './data/types';
  import BottomNav from './components/BottomNav.svelte';
  import OfflineBanner from './components/OfflineBanner.svelte';
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
</script>

<div class="app-shell" style="--city-accent: {cityAccent}">
  <div
    class="app-ambient"
    style="--city-accent: {cityAccent}"
    aria-hidden="true"
  ></div>

  <main
    class="screen"
    class:screen-tight={route.key === 'oggi'}
    class:screen-map={route.key === 'mappa'}
  >
    <OfflineBanner />
    {#key route.key}
      <div class="route-view {routeMotionClass}">
        <Comp />
      </div>
    {/key}
  </main>

  <BottomNav />
</div>
