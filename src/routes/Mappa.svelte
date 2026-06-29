<script lang="ts">
  import { onMount } from 'svelte';
  import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { pois, poiById, citta, itinerario, transports } from '../lib/content';
  import { computeOggi } from '../lib/today';
  import { go, nav } from '../lib/router.svelte';
  import {
    planPedestrianRoute,
    formatDistanceM,
    formatDurationS,
    hasLocalRoutingTiles,
    AUTO_NAV_KEY,
    type NavPlan,
  } from '../lib/routing';
  import { CAT_COLOR, CAT_ICON, CAT_LABEL } from '../lib/poi';
  import { offlineMapStyle } from '../lib/mapStyle';
  import { online } from '../lib/online.svelte';
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

  const navDestPoi = $derived(nav.seg === 'mappa' && nav.id ? poiById.get(nav.id) : undefined);

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
  let prevPoiId: string | undefined;
  $effect(() => {
    if (!mapReady || nav.seg !== 'mappa') return;
    const id = nav.id;
    if (prevPoiId && id !== prevPoiId) clearNavRoute();
    prevPoiId = id;
    if (id && poiById.has(id)) focusPoi(id);
    else clearPoiFocus();
  });

  $effect(() => {
    if (nav.seg === 'mappa' && !nav.id) clearNavRoute();
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

<div class="topbar">
  <div class="cities">
    {#each citta as c (c.id)}
      <button class="city" class:on={activeCity === c.id} onclick={() => flyTo(c.id)}>{c.name}</button>
    {/each}
  </div>
</div>

<div class="map-wrap">
  <div class="map" class:hide-names={hideNames} bind:this={mapEl}></div>

  {#if navDestPoi}
    <aside class="nav-sheet" aria-label="Navigazione verso {navDestPoi.name}">
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
</div>

<div class="controls">
  <button class="ctrl" onclick={toggleRoute} class:on={showRoute}>Tappe</button>
  <button class="ctrl" onclick={recenter}>◎ Posizione</button>
</div>

<div class="legend">
  {#each LEGEND as cat (cat)}
    <span class="lg"><span class="lg-ic" style="border-color:{CAT_COLOR[cat]}">{CAT_ICON[cat]}</span>{CAT_LABEL[cat]}</span>
  {/each}
</div>

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

<style>
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
    background: linear-gradient(135deg, var(--jade) 0%, #2d8a62 100%);
    color: #fff;
    border-color: var(--jade);
    box-shadow: 0 4px 12px var(--jade-soft);
  }
  .city:active { transform: scale(0.97); }
  .map-wrap { position: relative; }
  .map {
    width: 100%;
    height: calc(100dvh - var(--safe-top) - var(--nav-total-h) - 200px);
    min-height: 300px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-md);
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
  .controls { display: flex; gap: 10px; margin-top: 12px; }
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
  .map.hide-names :global(.pin-label) { display: none; }
  .map.hide-names :global(.poi-pin.focused .pin-label) { display: block; }
  :global(.user-dot) {
    width: 16px; height: 16px; border-radius: 50%;
    background: #3b8bff; border: 3px solid #fff;
    box-shadow: 0 0 0 4px rgba(59, 139, 255, 0.3);
  }
</style>
