<script lang="ts">
  import { onMount } from 'svelte';
  import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { pois, poiById, citta, itinerario, transports } from '../lib/content';
  import { computeOggi } from '../lib/today';
  import { go, nav } from '../lib/router.svelte';
  import {
    planPedestrianRoute,
    planItineraryRoute,
    formatDistanceM,
    formatDurationS,
    hasLocalRoutingTiles,
    AUTO_NAV_KEY,
    type NavPlan,
    type ItineraryPlan,
  } from '../lib/routing';
  import { resolveItineraryFromMapId } from '../lib/itinerary';
  import { longWalkSummary } from '../lib/walk-hints';
  import { CAT_COLOR, CAT_ICON, CAT_LABEL } from '../lib/poi';
  import { offlineMapStyle } from '../lib/mapStyle';
  import { online } from '../lib/online.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import PoiPhoto from '../components/PoiPhoto.svelte';
  import { cityTheme } from '../lib/city-theme';
  import type { CityId, PoiCategory } from '../data/types';

  const LEGEND: PoiCategory[] = ['storico', 'moderno', 'natura', 'intrattenimento', 'cibo'];

  let mapEl: HTMLDivElement;
  let map: MlMap | null = null;
  let userMarker: MlMarker | null = null;
  let watchId: number | null = null;

  let tilesAvailable = $state(false);
  let routingOffline = $state(false);
  let geoNote = $state('');
  let showRoute = $state(false);
  let hideNames = $state(false);
  let mapReady = $state(false);
  let focusedPin: HTMLElement | null = null;
  let userLngLat = $state<[number, number] | null>(null);
  let navPlan = $state<NavPlan | null>(null);
  let navLoading = $state(false);
  let navError = $state('');
  let navAbort: AbortController | null = null;
  let itinAbort: AbortController | null = null;
  let itinPlan = $state<ItineraryPlan | null>(null);
  let itinLoading = $state(false);
  let itinError = $state('');
  let itinExpanded = $state(false);
  let itinLegIdx = $state(0);

  const navDestPoi = $derived(
    nav.seg === 'mappa' && nav.id && !nav.id.startsWith('itin:')
      ? poiById.get(nav.id)
      : undefined,
  );
  const activeItin = $derived(
    nav.seg === 'mappa' && nav.id ? resolveItineraryFromMapId(nav.id) : null,
  );
  const itinWalkHint = $derived(
    activeItin ? longWalkSummary(activeItin.stops.map((p) => p.id)) : null,
  );

  // città iniziale: POI richiesto, altrimenti tappa corrente, altrimenti la prima
  const oggi = computeOggi(itinerario, transports);
  const initialFocusId = nav.seg === 'mappa' ? nav.id : undefined;
  const initialPoi = initialFocusId ? poiById.get(initialFocusId) : undefined;
  let activeCity = $state<CityId>(initialPoi?.city ?? oggi.leg?.city ?? citta[0].id);

  function center(c: CityId) {
    return citta.find((x) => x.id === c)!.center;
  }

  function clearPoiFocus() {
    focusedPin?.classList.remove('focused');
    focusedPin = null;
  }

  function focusPoi(poiId: string) {
    const p = poiById.get(poiId);
    if (!p || !map) return;
    activeCity = p.city;
    clearPoiFocus();
    const pin = mapEl?.querySelector(`[data-poi="${poiId}"]`) as HTMLElement | null;
    if (pin) {
      pin.classList.add('focused');
      focusedPin = pin;
    }
    map.flyTo({ center: [p.lng, p.lat], zoom: 15, duration: 900 });
  }

  // auto-navigazione quando arrivi da «Come arrivare» nel dettaglio POI
  $effect(() => {
    if (!mapReady || !navDestPoi) return;
    try {
      if (sessionStorage.getItem(AUTO_NAV_KEY) === navDestPoi.id) {
        sessionStorage.removeItem(AUTO_NAV_KEY);
        void startNavigation();
      }
    } catch { /* ignore */ }
  });

  function getUserLngLat(): [number, number] | null {
    if (userLngLat) return userLngLat;
    const ll = userMarker?.getLngLat();
    return ll ? [ll.lng, ll.lat] : null;
  }

  function drawNavRoute(coords: [number, number][]) {
    if (!map) return;
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: coords },
    };
    const src = map.getSource('nav-route');
    if (src && 'setData' in src) {
      (src as { setData: (d: unknown) => void }).setData(data);
      return;
    }
    map.addSource('nav-route', { type: 'geojson', data });
    map.addLayer({
      id: 'nav-route-outline',
      type: 'line',
      source: 'nav-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#0a0f0c', 'line-width': 7, 'line-opacity': 0.35 },
    });
    map.addLayer({
      id: 'nav-route-line',
      type: 'line',
      source: 'nav-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#3d9a6a', 'line-width': 5, 'line-opacity': 0.95 },
    });
  }

  function clearNavRoute() {
    navPlan = null;
    navError = '';
    navAbort?.abort();
    navAbort = null;
    if (!map) return;
    if (map.getLayer('nav-route-line')) map.removeLayer('nav-route-line');
    if (map.getLayer('nav-route-outline')) map.removeLayer('nav-route-outline');
    if (map.getSource('nav-route')) map.removeSource('nav-route');
  }

  function clearItinHighlights() {
    for (const id of itinHighlighted) {
      const pin = mapEl?.querySelector(`[data-poi="${id}"]`) as HTMLElement | null;
      pin?.classList.remove('itin-active');
      pin?.querySelector('.poi-badge')?.removeAttribute('data-step');
    }
    itinHighlighted = [];
  }

  let itinHighlighted: string[] = [];

  function highlightItinStops(ids: string[]) {
    clearItinHighlights();
    itinHighlighted = ids;
    for (let i = 0; i < ids.length; i++) {
      const pin = mapEl?.querySelector(`[data-poi="${ids[i]}"]`) as HTMLElement | null;
      if (!pin) continue;
      pin.classList.add('itin-active');
      const badge = pin.querySelector('.poi-badge') as HTMLElement | null;
      if (badge) badge.dataset.step = String(i + 1);
    }
  }

  /** Mostra solo i POI del percorso; null = tutti visibili. */
  function setPoiVisibility(visibleIds: string[] | null) {
    if (!mapEl) return;
    for (const pin of mapEl.querySelectorAll('.poi-pin')) {
      const id = (pin as HTMLElement).dataset.poi;
      if (!id) continue;
      pin.classList.toggle('pin-hidden', visibleIds !== null && !visibleIds.includes(id));
    }
  }

  function drawItinRoute(coords: [number, number][]) {
    if (!map || coords.length < 2) return;
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: coords },
    };
    const src = map.getSource('itin-route');
    if (src && 'setData' in src) {
      (src as { setData: (d: unknown) => void }).setData(data);
      map.setLayoutProperty('itin-route-line', 'visibility', 'visible');
      map.setLayoutProperty('itin-route-outline', 'visibility', 'visible');
      return;
    }
    map.addSource('itin-route', { type: 'geojson', data });
    map.addLayer({
      id: 'itin-route-outline',
      type: 'line',
      source: 'itin-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.35 },
    });
    map.addLayer({
      id: 'itin-route-line',
      type: 'line',
      source: 'itin-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#e4572e', 'line-width': 6, 'line-opacity': 1 },
    });
  }

  function clearItinRoute() {
    itinPlan = null;
    itinError = '';
    itinLoading = false;
    itinExpanded = false;
    itinLegIdx = 0;
    itinAbort?.abort();
    itinAbort = null;
    clearItinHighlights();
    clearPoiFocus();
    if (!map) return;
    if (map.getLayer('itin-route-line')) map.setLayoutProperty('itin-route-line', 'visibility', 'none');
    if (map.getLayer('itin-route-outline')) map.setLayoutProperty('itin-route-outline', 'visibility', 'none');
    if (map.getSource('itin-route')) {
      const src = map.getSource('itin-route');
      if (src && 'setData' in src) {
        (src as { setData: (d: unknown) => void }).setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        });
      }
    }
  }

  async function loadItineraryOnMap(mapId: string) {
    const it = resolveItineraryFromMapId(mapId);
    if (!it || !map) return;
    clearNavRoute();
    activeCity = it.cityId;
    highlightItinStops(it.stops.map((p) => p.id));
    itinLoading = true;
    itinError = '';
    itinAbort?.abort();
    itinAbort = new AbortController();
    const coords = it.stops.map((p) => [p.lng, p.lat] as [number, number]);
    try {
      if (coords.length > 1) {
        const plan = await planItineraryRoute(coords, itinAbort.signal);
        if (nav.id !== mapId) return;
        itinPlan = plan;
        drawItinRoute(plan.coordinates);
        fitItinBounds(plan.coordinates);
      } else if (coords.length === 1) {
        itinPlan = { coordinates: coords, distanceM: 0, durationS: 0, fallback: false, legs: [] };
        map.flyTo({ center: coords[0], zoom: 15, duration: 900 });
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        itinError = 'Percorso non disponibile per questo itinerario.';
        itinPlan = null;
        fitItinBounds(coords);
      }
    } finally {
      itinLoading = false;
    }
  }

  function closeItinerary() {
    clearItinRoute();
    go('mappa');
  }

  function fitItinBounds(coords: [number, number][]) {
    if (!map || coords.length < 1) return;
    const bottom = itinExpanded ? 300 : 118;
    if (coords.length === 1) {
      map.flyTo({ center: coords[0], zoom: 14, duration: 800 });
      return;
    }
    let minLng = coords[0][0];
    let maxLng = coords[0][0];
    let minLat = coords[0][1];
    let maxLat = coords[0][1];
    for (const [lng, lat] of coords) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: { top: 56, bottom, left: 36, right: 36 }, duration: 900, maxZoom: 14 },
    );
  }

  function toggleItinExpanded() {
    itinExpanded = !itinExpanded;
    if (itinPlan?.coordinates.length) {
      requestAnimationFrame(() => fitItinBounds(itinPlan!.coordinates));
    }
  }

  function selectItinLeg(i: number) {
    itinLegIdx = i;
    const leg = itinPlan?.legs[i];
    if (leg?.coordinates.length) fitItinBounds(leg.coordinates);
  }

  function fitNavBounds(coords: [number, number][]) {
    if (!map || coords.length < 2) return;
    let minLng = coords[0][0];
    let maxLng = coords[0][0];
    let minLat = coords[0][1];
    let maxLat = coords[0][1];
    for (const [lng, lat] of coords) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: { top: 80, bottom: 160, left: 40, right: 40 }, duration: 800 },
    );
  }

  async function startNavigation() {
    const poi = navDestPoi;
    if (!poi || !map) return;
    const from = getUserLngLat();
    if (!from) {
      navError = 'Attiva il GPS per partire dalla tua posizione.';
      return;
    }
    navLoading = true;
    navError = '';
    navAbort?.abort();
    navAbort = new AbortController();
    try {
      const plan = await planPedestrianRoute(
        from,
        [poi.lng, poi.lat],
        navAbort.signal,
      );
      navPlan = plan;
      drawNavRoute(plan.coordinates);
      fitNavBounds(plan.coordinates);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        navError = 'Percorso non disponibile. Riprova con connessione o zoom sulla zona.';
      }
    } finally {
      navLoading = false;
    }
  }
  // quando arrivi da un POI (#/mappa/poi-id) centra il marker
  let prevMapId: string | undefined;
  $effect(() => {
    if (!mapReady || nav.seg !== 'mappa') return;
    const id = nav.id;
    if (prevMapId && id !== prevMapId) {
      clearNavRoute();
      if (!id?.startsWith('itin:')) clearItinRoute();
    }
    prevMapId = id;
    if (id?.startsWith('itin:')) return;
    if (id && poiById.has(id)) focusPoi(id);
    else clearPoiFocus();
  });

  $effect(() => {
    if (!mapReady || nav.seg !== 'mappa') return;
    const id = nav.id;
    if (id?.startsWith('itin:')) void loadItineraryOnMap(id);
    else clearItinRoute();
  });

  $effect(() => {
    if (!mapReady) return;
    if (activeItin) {
      setPoiVisibility(activeItin.stops.map((p) => p.id));
    } else if (navPlan && navDestPoi) {
      setPoiVisibility([navDestPoi.id]);
    } else {
      setPoiVisibility(null);
    }
  });

  $effect(() => {
    if (nav.seg === 'mappa' && !nav.id) {
      clearNavRoute();
      clearItinRoute();
    }
  });

  onMount(() => {
    let cleanupFns: (() => void)[] = [];
    void init().then((fn) => fn && cleanupFns.push(fn));
    return () => {
      cleanupFns.forEach((f) => f());
    };
  });

  async function init(): Promise<(() => void) | void> {
    // la mappa base (vie) richiede public/tiles/cina.pmtiles (vedi npm run tiles).
    // HEAD può dare falso positivo per il fallback SPA (200 text/html quando il file
    // non esiste): si esclude esplicitamente la risposta html di fallback.
    try {
      const head = await fetch('/tiles/cina.pmtiles', { method: 'HEAD' });
      const ct = head.headers.get('content-type') ?? '';
      const len = Number(head.headers.get('content-length') ?? 0);
      tilesAvailable =
        head.ok && !ct.includes('text/html') && (len === 0 || len > 10_000);
    } catch {
      tilesAvailable = false;
    }
    routingOffline = await hasLocalRoutingTiles();

    const ml = await import('maplibre-gl');

    if (tilesAvailable) {
      const { Protocol } = await import('pmtiles');
      const protocol = new Protocol();
      ml.addProtocol('pmtiles', protocol.tile);
    }

    const c = initialPoi ? { lat: initialPoi.lat, lng: initialPoi.lng } : center(activeCity);
    const style = tilesAvailable
      ? offlineMapStyle()
      : 'https://tiles.openfreemap.org/styles/liberty';
    map = new ml.Map({
      container: mapEl,
      style,
      center: [c.lng, c.lat],
      zoom: initialPoi ? 14 : 11,
    });

    map.on('load', () => {
      addRouteLayer();
      mapReady = true;
    });
    map.on('zoom', () => (hideNames = (map?.getZoom() ?? 11) < 8.5));

    // marker dei POI: badge con icona-categoria ("immaginina") + nome + colore
    for (const p of pois) {
      const el = document.createElement('div');
      el.className = 'poi-pin';
      el.dataset.poi = p.id;
      el.style.setProperty('--c', CAT_COLOR[p.category]);
      const badge = document.createElement('div');
      badge.className = 'poi-badge';
      badge.textContent = CAT_ICON[p.category];
      const label = document.createElement('div');
      label.className = 'pin-label';
      label.textContent = p.name;
      el.append(badge, label);
      el.title = p.name;
      el.addEventListener('click', () => go('poi', p.id));
      new ml.Marker({ element: el, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
    }

    startGeolocation(ml.Marker);

    return () => {
      navAbort?.abort();
      itinAbort?.abort();
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      map?.remove();
    };
  }

  function addRouteLayer() {
    if (!map) return;
    const coords = itinerario.legs.map((l) => {
      const ce = center(l.city);
      return [ce.lng, ce.lat];
    });
    map.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
    });
    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { visibility: showRoute ? 'visible' : 'none', 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#e4572e', 'line-width': 3, 'line-dasharray': [2, 1.5] },
    });
  }

  function startGeolocation(MarkerCtor: typeof import('maplibre-gl').Marker) {
    if (!('geolocation' in navigator)) {
      geoNote = 'GPS non disponibile su questo dispositivo.';
      return;
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        geoNote = '';
        const { longitude, latitude } = pos.coords;
        userLngLat = [longitude, latitude];
        if (!map) return;
        if (!userMarker) {
          const el = document.createElement('div');
          el.className = 'user-dot';
          userMarker = new MarkerCtor({ element: el }).setLngLat([longitude, latitude]).addTo(map);
        } else {
          userMarker.setLngLat([longitude, latitude]);
        }
      },
      () => (geoNote = 'Posizione non disponibile (permesso negato o offline).'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }

  function flyTo(c: CityId) {
    activeCity = c;
    const ce = center(c);
    map?.flyTo({ center: [ce.lng, ce.lat], zoom: 12 });
  }

  function recenter() {
    if (userMarker && map) map.flyTo({ center: userMarker.getLngLat(), zoom: 14 });
  }

  function toggleRoute() {
    showRoute = !showRoute;
    map?.setLayoutProperty('route', 'visibility', showRoute ? 'visible' : 'none');
  }
</script>

<div class="mappa-page" class:itin-mode={!!activeItin}>
<PageHeader eyebrow="◎ offline" title="Mappa" sub="POI, posizione GPS e percorsi a piedi." />

{#if !activeItin}
<div class="topbar">
  <div class="cities">
    {#each citta as c (c.id)}
      {@const th = cityTheme(c.id)}
      <button
        class="city"
        class:on={activeCity === c.id}
        style={activeCity === c.id ? `--c:${th.accent}` : undefined}
        onclick={() => flyTo(c.id)}
      >{th.icon} {c.name}</button>
    {/each}
  </div>
</div>
{/if}

<div class="map-wrap" class:has-itin={!!activeItin}>
  <div class="map" class:hide-names={hideNames} class:itin-open={!!activeItin} class:route-focus={!!activeItin || !!navPlan} bind:this={mapEl}></div>

  {#if activeItin}
    <aside class="itin-sheet" class:expanded={itinExpanded} aria-label="Itinerario {activeItin.title}">
      <button type="button" class="itin-grab" onclick={toggleItinExpanded} aria-expanded={itinExpanded}>
        <span class="itin-grab-bar" aria-hidden="true"></span>
        <span class="sr-only">{itinExpanded ? 'Comprimi pannello' : 'Espandi pannello'}</span>
      </button>
      <div class="itin-sheet-head">
        <button type="button" class="itin-head-main" onclick={toggleItinExpanded}>
          <span class="nav-label">Itinerario</span>
          <strong class="itin-sheet-title">{activeItin.title}</strong>
          {#if itinPlan && itinPlan.distanceM > 0}
            <p class="nav-meta">
              {formatDistanceM(itinPlan.distanceM)} · {formatDurationS(itinPlan.durationS)} a piedi
              {#if itinPlan.fallback}<span class="nav-fallback"> · stima</span>{/if}
            </p>
          {:else if itinLoading}
            <p class="nav-meta muted">Calcolo percorso…</p>
          {/if}
        </button>
        <button class="itin-close" onclick={closeItinerary} aria-label="Chiudi itinerario">×</button>
      </div>

      {#if itinExpanded}
        {#if itinPlan && itinPlan.legs.length > 1}
          <div class="itin-legs" role="tablist" aria-label="Tratti">
            {#each itinPlan.legs as _, i (i)}
              <button
                type="button"
                class="itin-leg-tab"
                class:on={itinLegIdx === i}
                role="tab"
                aria-selected={itinLegIdx === i}
                onclick={() => selectItinLeg(i)}
              >
                {i + 1}→{i + 2}
              </button>
            {/each}
          </div>
        {/if}

        {#if itinPlan?.legs[itinLegIdx]?.steps?.length}
          <ol class="itin-directions" aria-label="Indicazioni stradali">
            {#each itinPlan.legs[itinLegIdx].steps as step, i (i)}
              <li class="itin-dir">
                <span class="itin-dir-text">{step.instruction}</span>
                {#if step.distanceM > 0}
                  <span class="itin-dir-meta">{formatDistanceM(step.distanceM)}</span>
                {/if}
              </li>
            {/each}
          </ol>
        {:else if itinPlan && !itinLoading}
          <p class="itin-dir-empty muted">Indicazioni dettagliate non disponibili per questo tratto.</p>
        {/if}

        <ol class="itin-stops">
          {#each activeItin.stops as p, i (p.id)}
            <li>
              <button class="itin-stop" onclick={() => focusPoi(p.id)}>
                <span class="itin-stop-num">{i + 1}</span>
                <PoiPhoto id={p.id} category={p.category} name={p.name} variant="thumb" />
                <span class="itin-stop-body">
                  <span class="itin-stop-name">{p.name}</span>
                  <span class="itin-stop-cat" style="--c:{CAT_COLOR[p.category]}">{CAT_LABEL[p.category]}</span>
                </span>
                <span class="itin-stop-go" aria-hidden="true">›</span>
              </button>
            </li>
          {/each}
        </ol>
      {:else}
        <div class="itin-compact-stops" aria-hidden="true">
          {#each activeItin.stops as p, i (p.id)}
            <span class="itin-compact-dot" title={p.name}>{i + 1}</span>
            {#if i < activeItin.stops.length - 1}<span class="itin-compact-line"></span>{/if}
          {/each}
        </div>
        <p class="itin-expand-hint">Tocca per tappe e indicazioni stradali</p>
      {/if}

      {#if itinWalkHint}
        <p class="walk-hint-sheet">{itinWalkHint}</p>
      {/if}
      {#if itinError}<p class="nav-err">{itinError}</p>{/if}
      {#if itinPlan?.fallback && !itinError && activeItin.stops.length > 1}
        <p class="nav-hint">Alcuni tratti sono stime — serve connessione o tile routing locali.</p>
      {/if}
    </aside>
  {:else if navDestPoi}
    <aside class="nav-sheet" aria-label="Navigazione verso {navDestPoi.name}">
      <PoiPhoto id={navDestPoi.id} category={navDestPoi.category} name={navDestPoi.name} variant="hero" />
      <div class="nav-head">
        <span class="nav-label">Destinazione</span>
        <strong class="nav-name">{navDestPoi.name}</strong>
        {#if navPlan}
          <p class="nav-meta">
            {formatDistanceM(navPlan.distanceM)} · {formatDurationS(navPlan.durationS)} a piedi
            {#if navPlan.fallback}<span class="nav-fallback"> · stima</span>{/if}
          </p>
        {/if}
      </div>
      <div class="nav-actions">
        {#if navPlan}
          <button class="nav-btn ghost" onclick={clearNavRoute}>Chiudi</button>
          <button class="nav-btn" onclick={startNavigation} disabled={navLoading}>
            {navLoading ? '…' : 'Aggiorna'}
          </button>
        {:else}
          <button class="nav-btn" onclick={startNavigation} disabled={navLoading}>
            {navLoading ? 'Calcolo…' : 'Come arrivare'}
          </button>
        {/if}
      </div>
      {#if navError}<p class="nav-err">{navError}</p>{/if}
      {#if navPlan?.fallback && !navError}
        <p class="nav-hint">Percorso stimato — per strade reali apri la mappa online almeno una volta in questa zona.</p>
      {/if}
    </aside>
  {/if}

  <div class="controls" class:itin-controls={!!activeItin}>
    {#if !activeItin}<button class="ctrl" onclick={toggleRoute} class:on={showRoute}>Tappe</button>{/if}
    <button class="ctrl" onclick={recenter}>◎ Posizione</button>
  </div>
</div>

{#if !activeItin}
<div class="legend">
  {#each LEGEND as cat (cat)}
    <span class="lg"><span class="lg-ic" style="border-color:{CAT_COLOR[cat]}">{CAT_ICON[cat]}</span>{CAT_LABEL[cat]}</span>
  {/each}
</div>
{/if}

{#if !activeItin}
{#if tilesAvailable}
  <p class="banner ok">
    {#if !online.network}✈️ Offline · {:else}✓ {/if}
    Mappa locale installata
    {#if routingOffline} · percorsi pedonali offline{/if}
  </p>
{:else}
  <p class="banner warn">
    🌐 Mappa online — genera i tile con <code>npm run tiles:all</code> prima di partire.
  </p>
{/if}
{#if !routingOffline && tilesAvailable}
  <p class="banner hint">Percorsi stradali: esegui <code>npm run tiles:routing</code> per il routing offline.</p>
{/if}
{#if geoNote}<p class="banner">{geoNote}</p>{/if}
{/if}
</div>

<style>
  .mappa-page { margin-top: -8px; }
  .mappa-page.itin-mode :global(.ph) {
    margin-bottom: 6px;
  }
  .mappa-page.itin-mode :global(.ph .sub) {
    display: none;
  }
  .topbar { margin: -6px -4px 12px; }
  .cities { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
  .cities::-webkit-scrollbar { display: none; }
  .city {
    flex: none;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    padding: 7px 14px;
    background: var(--surface);
    color: var(--ink-faint);
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
  }
  .city.on {
    background: linear-gradient(135deg, color-mix(in srgb, var(--c, var(--jade)) 88%, #000) 0%, var(--c, var(--jade)) 100%);
    color: #fff;
    border-color: var(--c, var(--jade));
    box-shadow: 0 4px 12px color-mix(in srgb, var(--c, var(--jade)) 35%, transparent);
  }
  .city:active { transform: scale(0.97); }
  .map-wrap { position: relative; }
  .map-wrap.has-itin { margin-top: -4px; }
  .map {
    width: 100%;
    height: calc(100dvh - var(--safe-top) - var(--nav-total-h) - 200px);
    min-height: 300px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-md);
  }
  .map.itin-open {
    height: calc(100dvh - var(--safe-top) - var(--nav-total-h) - 108px);
    min-height: 340px;
  }
  .nav-sheet {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 5;
    background: rgba(14, 11, 8, 0.94);
    backdrop-filter: blur(12px);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    box-shadow: var(--shadow-lg);
  }
  .nav-label {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 4px;
  }
  .nav-name { font-size: 1rem; color: var(--ink); }
  .nav-meta {
    margin: 6px 0 0;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--jade-bright);
  }
  .nav-fallback { color: var(--ink-faint); }
  .nav-actions { display: flex; gap: 8px; margin-top: 12px; }
  .nav-btn {
    flex: 1;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-pill);
    padding: 10px 14px;
    border: 1px solid var(--jade);
    background: linear-gradient(135deg, var(--jade) 0%, #2d8a62 100%);
    color: #fff;
  }
  .nav-btn.ghost {
    flex: none;
    background: var(--surface);
    border-color: var(--line-strong);
    color: var(--ink-soft);
  }
  .nav-btn:disabled { opacity: 0.6; }
  .nav-err, .nav-hint {
    margin: 10px 0 0;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--cinabro-bright);
  }
  .nav-hint { color: var(--ink-faint); }

  .itin-sheet {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 6;
    display: flex;
    flex-direction: column;
    background: rgba(10, 8, 6, 0.94);
    backdrop-filter: blur(16px);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 6px 12px 10px;
    box-shadow: var(--shadow-lg);
    max-height: none;
  }
  .itin-sheet.expanded {
    max-height: min(46dvh, 360px);
    padding-bottom: 12px;
  }
  .itin-grab {
    display: flex;
    justify-content: center;
    width: 100%;
    padding: 6px 0 4px;
    border: none;
    background: transparent;
  }
  .itin-grab-bar {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--line-strong);
  }
  .itin-head-main {
    flex: 1;
    min-width: 0;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0;
  }
  .itin-compact-stops {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 4px 8px 2px;
  }
  .itin-compact-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: var(--cinabro);
    flex: none;
  }
  .itin-compact-line {
    flex: 1;
    height: 2px;
    min-width: 12px;
    max-width: 40px;
    background: linear-gradient(90deg, var(--cinabro), color-mix(in srgb, var(--cinabro) 30%, transparent));
    opacity: 0.7;
  }
  .itin-expand-hint {
    margin: 0;
    padding: 0 4px 2px;
    text-align: center;
    font-size: 0.72rem;
    color: var(--ink-faint);
  }
  .walk-hint-sheet {
    margin: 8px 0 0;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--gold) 14%, rgba(10, 8, 6, 0.9));
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--line));
    font-size: 0.76rem;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .itin-legs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 8px 0 4px;
  }
  .itin-legs::-webkit-scrollbar { display: none; }
  .itin-leg-tab {
    flex: none;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink-soft);
  }
  .itin-leg-tab.on {
    background: var(--cinabro);
    border-color: var(--cinabro);
    color: #fff;
  }
  .itin-directions {
    list-style: none;
    margin: 0;
    padding: 0 2px 8px;
    max-height: 120px;
    overflow-y: auto;
    border-bottom: 1px solid var(--line);
  }
  .itin-dir {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--ink-body);
  }
  .itin-dir:last-child { border-bottom: none; }
  .itin-dir-meta {
    flex: none;
    font-family: var(--mono);
    font-size: 9px;
    color: var(--ink-faint);
  }
  .itin-dir-empty {
    font-size: 0.78rem;
    margin: 0;
    padding: 4px 2px 8px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
  .itin-sheet-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .itin-sheet-title {
    display: block;
    font-family: var(--serif);
    font-size: 1.05rem;
    color: var(--ink);
    line-height: 1.25;
  }
  .itin-close {
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
    font-size: 1.25rem;
    line-height: 1;
  }
  .itin-stops {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-height: 0;
  }
  .itin-stop {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    text-align: left;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--paper-2);
  }
  .itin-stop-num {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: var(--cinabro);
  }
  .itin-stop-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .itin-stop-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.25;
  }
  .itin-stop-cat {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--c);
  }
  .itin-stop-go {
    flex: none;
    color: var(--ink-faint);
    font-size: 1.1rem;
  }

  .controls { display: flex; gap: 10px; margin-top: 8px; }
  .controls.itin-controls {
    position: absolute;
    left: 10px;
    top: 10px;
    z-index: 4;
    margin: 0;
  }
  .controls.itin-controls .ctrl {
    background: rgba(10, 8, 6, 0.88);
    backdrop-filter: blur(8px);
    box-shadow: var(--shadow-sm);
  }
  .ctrl {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    padding: 8px 14px;
    background: var(--surface);
    color: var(--ink-soft);
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .ctrl.on {
    background: var(--cinabro);
    color: #fff;
    border-color: var(--cinabro);
    box-shadow: 0 4px 12px var(--cinabro-glow);
  }
  .banner {
    margin-top: 10px;
    font-size: 0.78rem;
    color: var(--ink-faint);
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-xs);
    padding: 10px 12px;
    line-height: 1.5;
  }
  .banner.ok {
    color: var(--jade-bright);
    background: var(--jade-soft);
    border-color: rgba(61, 154, 106, 0.35);
  }
  .banner.warn { color: var(--cinabro-bright); background: var(--cinabro-soft); }
  .banner.hint { margin-top: 6px; }
  .banner code { font-family: var(--mono); font-size: 0.9em; color: var(--cinabro-bright); }

  .legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 12px; }
  .lg { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-soft); }
  .lg-ic {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid;
    background: var(--surface);
    display: inline-grid;
    place-items: center;
    font-size: 11px;
  }

  :global(.poi-pin) { position: relative; cursor: pointer; width: 0; height: 0; }
  :global(.poi-pin.pin-hidden) {
    visibility: hidden;
    pointer-events: none;
    opacity: 0;
  }
  :global(.poi-badge) {
    position: absolute; left: 0; top: 0; transform: translate(-50%, -50%);
    width: 30px; height: 30px; border-radius: 50%;
    background: #fff; border: 2.5px solid var(--c);
    display: grid; place-items: center; font-size: 15px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  }
  :global(.pin-label) {
    position: absolute; left: 0; top: 18px; transform: translateX(-50%);
    white-space: nowrap; font-family: var(--mono); font-size: 10px; font-weight: 600;
    color: #fff; background: rgba(12, 9, 7, 0.88); padding: 3px 8px; border-radius: 6px;
    pointer-events: none; border: 1px solid var(--c);
    backdrop-filter: blur(4px);
  }
  :global(.poi-pin.focused .poi-badge) {
    transform: translate(-50%, -50%) scale(1.15);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 45%, transparent), 0 4px 14px rgba(0, 0, 0, 0.5);
    z-index: 2;
  }
  :global(.poi-pin.itin-active .poi-badge) {
    transform: translate(-50%, -50%) scale(1.1);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--cinabro) 55%, transparent), 0 4px 12px rgba(0, 0, 0, 0.45);
    z-index: 1;
  }
  :global(.poi-pin.itin-active .poi-badge::after) {
    content: attr(data-step);
    position: absolute;
    right: -6px;
    top: -6px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--cinabro);
    color: #fff;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    display: grid;
    place-items: center;
    border: 1.5px solid #fff;
  }
  .map.hide-names :global(.pin-label) { display: none; }
  .map.hide-names :global(.poi-pin.focused .pin-label) { display: block; }
  :global(.user-dot) {
    width: 16px; height: 16px; border-radius: 50%;
    background: #3b8bff; border: 3px solid #fff;
    box-shadow: 0 0 0 4px rgba(59, 139, 255, 0.3);
  }
</style>
