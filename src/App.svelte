<script lang="ts">
  import { nav, isTab, type Tab } from './lib/router.svelte';
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
</script>

<div class="app-shell">
  <div class="app-ambient" aria-hidden="true"></div>

  <main class="screen">
    <OfflineBanner />
    {#key route.key}
      <div class="route-view">
        <Comp />
      </div>
    {/key}
  </main>

  <BottomNav />
</div>
