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
    hasLocalRoutingTiles,
    straightLineM,
    AUTO_NAV_KEY,
    type NavPlan,
    type ItineraryPlan,
  } from '../lib/routing';
  import {
    computeNavProgress,
    isOffRoute,
    sliceRouteAt,
    type NavProgress,
  } from '../lib/nav-guidance';
  import { haptic } from '../lib/haptic';
  import { waitForPosition } from '../lib/gps';
  import { speakNavInstruction, resetNavSpeech } from '../lib/nav-speak';
  import { resolveItineraryFromMapId } from '../lib/itinerary';
  import { longWalkSummary } from '../lib/walk-hints';
  import { CAT_COLOR, CAT_ICON } from '../lib/poi';
  import { offlineMapStyle } from '../lib/mapStyle';
  import { isOfflineAssetReady } from '../lib/offline-assets';
  import { CachedRangeSource } from '../lib/pmtiles-source';
  import ScreenHeader from '../components/ScreenHeader.svelte';
  import MapTopChrome from '../components/MapTopChrome.svelte';
  import ItinerarySheet from '../components/ItinerarySheet.svelte';
  import NavPanel from '../components/NavPanel.svelte';
  import MetroSheet from '../components/MetroSheet.svelte';
  import { cityTheme } from '../lib/city-theme';
  import { metroForCity, metroGeoJSON, type MetroStation } from '../lib/metro';
  import {
    planMetroRoute,
    filterMetroStations,
    metroRouteInstructions,
    type MetroRoutePlan,
  } from '../lib/metro-route';
  import type { CityId } from '../data/types';

  let mapEl: HTMLDivElement;
  let map: MlMap | null = null;
  let userMarker: MlMarker | null = null;
  let MarkerCtor: typeof import('maplibre-gl').Marker | null = null;
  let watchId: number | null = null;

  let tilesAvailable = $state(false);
  let routingOffline = $state(false);
  let geoNote = $state('');
  type MapLayer = 'poi' | 'metro' | 'route';
  let mapLayer = $state<MapLayer>('poi');
  let metroLineFilter = $state<string>('all');
  let metroQuery = $state('');
  type MetroSheetTab = 'route' | 'list';
  let metroSheetTab = $state<MetroSheetTab>('route');
  let routeFromId = $state<string | null>(null);
  let routeToId = $state<string | null>(null);
  let routeFromQ = $state('');
  let routeToQ = $state('');
  let pickField = $state<'from' | 'to' | null>(null);
  let hideNames = $state(false);
  let mapReady = $state(false);
  let focusedPin: HTMLElement | null = null;
  let userLngLat = $state<[number, number] | null>(null);
  let navPlan = $state<NavPlan | null>(null);
  let navLoading = $state(false);
  let navError = $state('');
  let tooFar = $state(false);
  let sampleRoute = $state(false);
  let navigating = $state(false);
  let navProgress = $state<NavProgress | null>(null);
  let lastNavStepIdx = $state(-1);
  let rerouteBusy = $state(false);
  let lastRerouteMs = 0;
  let navVoice = $state(true);
  let wakeLock: WakeLockSentinel | null = null;
  let navAbort: AbortController | null = null;
  let itinAbort: AbortController | null = null;
  let itinPlan = $state<ItineraryPlan | null>(null);
  let itinLoading = $state(false);
  let itinError = $state('');
  let itinLegIdx = $state(0);
  let itinSheetH = $state(100);
  let mapWrapEl: HTMLDivElement | undefined;
  let mapFullscreen = $state(false);

  const ITIN_H_MIN = 92;
  const ITIN_H_COMPACT = 158;

  let itinDragStartY = 0;
  let itinDragStartH = 0;
  let itinDragging = $state(false);

  const itinCompact = $derived(itinSheetH < ITIN_H_COMPACT);

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

  const metroData = $derived(metroForCity(activeCity));

  const metroStationsFiltered = $derived.by(() => {
    if (!metroData.hasMetro) return [] as MetroStation[];
    let list: MetroStation[];
    if (metroLineFilter === 'all') list = metroData.stations;
    else {
      const line = metroData.lines.find((l) => l.id === metroLineFilter);
      if (!line) list = metroData.stations;
      else {
        const ids = new Set(line.stationIds);
        list = metroData.stations.filter((s) => ids.has(s.id));
      }
    }
    const q = metroQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nameLocal.includes(q) ||
        s.lines.some((n) => n.includes(q)),
    );
  });

  const activeCityMeta = $derived(citta.find((c) => c.id === activeCity));
  const mapAccent = $derived(cityTheme(activeCity).accent);

  const routeFromPicks = $derived(
    pickField === 'from' ? filterMetroStations(metroData.stations, routeFromQ) : [],
  );
  const routeToPicks = $derived(
    pickField === 'to' ? filterMetroStations(metroData.stations, routeToQ) : [],
  );

  const metroRoutePlan = $derived.by((): MetroRoutePlan | null => {
    if (!metroData.hasMetro || !routeFromId || !routeToId || routeFromId === routeToId) return null;
    return planMetroRoute(metroData, routeFromId, routeToId);
  });

  const metroRouteSteps = $derived(metroRoutePlan ? metroRouteInstructions(metroRoutePlan) : []);

  // Clearing a route search field deselects its station, so the planned
  // route (and the line drawn on the map) disappears with it.
  $effect(() => {
    if (routeFromId && routeFromQ.trim() === '') routeFromId = null;
  });
  $effect(() => {
    if (routeToId && routeToQ.trim() === '') routeToId = null;
  });

  function resetMetroRoute() {
    routeFromId = null;
    routeToId = null;
    routeFromQ = '';
    routeToQ = '';
    pickField = null;
    clearMetroPlannedRoute();
  }

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
  let pendingAutoNav = false;

  function getUserLngLat(): [number, number] | null {
    if (userLngLat) return userLngLat;
    const ll = userMarker?.getLngLat();
    return ll ? [ll.lng, ll.lat] : null;
  }

  function lineFeature(coords: [number, number][]) {
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: coords },
    };
  }

  function ensureNavRouteLayers() {
    if (!map || map.getSource('nav-route-remaining')) return;
    map.addSource('nav-route-done', {
      type: 'geojson',
      data: lineFeature([]),
    });
    map.addSource('nav-route-remaining', {
      type: 'geojson',
      data: lineFeature([]),
    });
    map.addLayer({
      id: 'nav-route-done-line',
      type: 'line',
      source: 'nav-route-done',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#6a7a72', 'line-width': 5, 'line-opacity': 0.55 },
    });
    map.addLayer({
      id: 'nav-route-outline',
      type: 'line',
      source: 'nav-route-remaining',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#0a0f0c', 'line-width': 7, 'line-opacity': 0.35 },
    });
    map.addLayer({
      id: 'nav-route-line',
      type: 'line',
      source: 'nav-route-remaining',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#3d9a6a', 'line-width': 5, 'line-opacity': 0.95 },
    });
  }

  function updateNavRouteDisplay(coords: [number, number][], traversedM: number) {
    if (!map) return;
    ensureNavRouteLayers();
    const { done, remaining } = sliceRouteAt(coords, traversedM);
    const doneSrc = map.getSource('nav-route-done');
    const remSrc = map.getSource('nav-route-remaining');
    if (doneSrc && 'setData' in doneSrc) {
      (doneSrc as { setData: (d: unknown) => void }).setData(lineFeature(done));
    }
    if (remSrc && 'setData' in remSrc) {
      (remSrc as { setData: (d: unknown) => void }).setData(lineFeature(remaining));
    }
  }

  function drawNavRoute(coords: [number, number][]) {
    updateNavRouteDisplay(coords, 0);
  }

  async function acquireWakeLock() {
    try {
      wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      /* ignore */
    }
  }

  function releaseWakeLock() {
    void wakeLock?.release();
    wakeLock = null;
  }

  function stopNavigation() {
    navigating = false;
    navProgress = null;
    lastNavStepIdx = -1;
    resetNavSpeech();
    releaseWakeLock();
    map?.easeTo({ pitch: 0, bearing: 0, duration: 450, padding: 0 });
    userMarker?.getElement()?.classList.remove('nav-active');
  }

  function clearNavRoute() {
    stopNavigation();
    navPlan = null;
    navError = '';
    navLoading = false;
    tooFar = false;
    sampleRoute = false;
    navAbort?.abort();
    navAbort = null;
    if (!map) return;
    for (const id of ['nav-route-line', 'nav-route-outline', 'nav-route-done-line']) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of ['nav-route-remaining', 'nav-route-done']) {
      if (map.getSource(id)) map.removeSource(id);
    }
  }

  /** Chiude pannello navigazione e torna alla mappa libera. */
  function closeNavSheet() {
    if (nav.seg === 'mappa' && nav.id && !nav.id.startsWith('itin:')) {
      go('mappa');
    }
    clearPoiFocus();
    clearNavRoute();
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
    itinLegIdx = 0;
    itinSheetH = 100;
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

  function maxItinSheetH(): number {
    const wrapH = mapWrapEl?.clientHeight ?? window.innerHeight * 0.55;
    return Math.round(Math.min(wrapH * 0.78, window.innerHeight * 0.58));
  }

  function clampItinSheetH(h: number): number {
    return Math.round(Math.min(maxItinSheetH(), Math.max(ITIN_H_MIN, h)));
  }

  function setItinSheetH(h: number, refit = true) {
    itinSheetH = clampItinSheetH(h);
    if (refit && itinPlan?.coordinates.length) {
      requestAnimationFrame(() => fitItinBounds(itinPlan!.coordinates));
    }
  }

  function fitItinBounds(coords: [number, number][]) {
    if (!map || coords.length < 1) return;
    const bottom = itinSheetH + 20;
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

  function onItinDragStart(e: PointerEvent) {
    itinDragging = true;
    itinDragStartY = e.clientY;
    itinDragStartH = itinSheetH;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onItinDragMove(e: PointerEvent) {
    if (!itinDragging) return;
    const dy = itinDragStartY - e.clientY;
    itinSheetH = clampItinSheetH(itinDragStartH + dy);
  }

  function onItinDragEnd(e: PointerEvent) {
    if (!itinDragging) return;
    itinDragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (itinPlan?.coordinates.length) fitItinBounds(itinPlan.coordinates);
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

  function followNavCamera(lng: number, lat: number, heading: number | null, bearing: number, instant = false) {
    if (!map) return;
    const bear =
      heading != null && !Number.isNaN(heading) && heading >= 0 ? heading : bearing;
    map.easeTo({
      center: [lng, lat],
      zoom: 17.5,
      bearing: bear,
      pitch: 52,
      duration: instant ? 0 : 750,
      essential: true,
      padding: { top: 168, bottom: 72, left: 28, right: 28 },
    });
  }

  function onNavGpsUpdate(lng: number, lat: number, heading: number | null) {
    if (!navigating || !navPlan || !navDestPoi) return;
    const prog = computeNavProgress(
      navPlan.coordinates,
      navPlan.steps,
      [lng, lat],
      [navDestPoi.lng, navDestPoi.lat],
    );
    navProgress = prog;
    updateNavRouteDisplay(navPlan.coordinates, prog.traversedM);

    if (prog.arrived) {
      if (lastNavStepIdx !== 999) {
        haptic(24);
        if (navVoice) speakNavInstruction('Sei arrivato');
        lastNavStepIdx = 999;
      }
      return;
    }

    const instr = navPlan.steps?.[prog.stepIndex]?.instruction;
    if (prog.stepIndex !== lastNavStepIdx && lastNavStepIdx >= 0 && instr && navVoice) {
      speakNavInstruction(instr);
    }
    if (prog.stepIndex !== lastNavStepIdx && lastNavStepIdx >= 0) {
      haptic(10);
    }
    lastNavStepIdx = prog.stepIndex;

    followNavCamera(lng, lat, heading, prog.mapBearing);

    if (isOffRoute(prog.offRouteM) && !rerouteBusy && Date.now() - lastRerouteMs > 10_000) {
      void rerouteNavigation();
    }
  }

  async function rerouteNavigation() {
    const poi = navDestPoi;
    const from = getUserLngLat();
    if (!poi || !from || rerouteBusy) return;
    rerouteBusy = true;
    lastRerouteMs = Date.now();
    try {
      navAbort?.abort();
      navAbort = new AbortController();
      const plan = await planPedestrianRoute(from, [poi.lng, poi.lat], navAbort.signal);
      navPlan = plan;
      drawNavRoute(plan.coordinates);
      lastNavStepIdx = -1;
    } catch {
      /* ignore */
    } finally {
      rerouteBusy = false;
    }
  }

  function beginNavigation() {
    if (!navPlan || !navDestPoi) return;
    if (!getUserLngLat()) {
      navError = 'Attiva il GPS per navigare.';
      return;
    }
    navError = '';
    navigating = true;
    lastNavStepIdx = -1;
    resetNavSpeech();
    haptic(12);
    void acquireWakeLock();
    userMarker?.getElement()?.classList.add('nav-active');
    const ll = getUserLngLat()!;
    onNavGpsUpdate(ll[0], ll[1], null);
    followNavCamera(ll[0], ll[1], null, navProgress?.mapBearing ?? 0, true);
    if (navVoice && navPlan.steps?.[0]?.instruction) {
      speakNavInstruction(navPlan.steps[0].instruction);
    }
  }

  async function ensureUserPosition(): Promise<[number, number] | null> {
    const cur = getUserLngLat();
    if (cur) return cur;
    const p = await waitForPosition();
    if (!p) return null;
    userLngLat = [p.lng, p.lat];
    if (map && MarkerCtor && !userMarker) {
      const el = document.createElement('div');
      el.className = 'user-dot';
      userMarker = new MarkerCtor({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    }
    return [p.lng, p.lat];
  }

  async function startNavigation(autoStart = false) {
    const poi = navDestPoi;
    if (!poi || !map) return;
    navLoading = true;
    navError = '';
    tooFar = false;
    sampleRoute = false;
    const from = await ensureUserPosition();
    if (!from) {
      navError = 'Impossibile ottenere il GPS. Attiva la posizione e riprova all’aperto.';
      navLoading = false;
      return;
    }
    // Gate distanza: oltre ~40 km il percorso a piedi non ha senso (es. sei in
    // Italia prima di partire). Niente calcolo assurdo: resta la scheda del POI.
    const asCrowM = straightLineM(from, [poi.lng, poi.lat]);
    if (asCrowM > 40_000) {
      navPlan = null;
      clearNavRoute();
      tooFar = true;
      navError = `Sei a ${formatDistanceM(asCrowM)} in linea d'aria: il percorso a piedi apparirà quando sarai in zona.`;
      navLoading = false;
      return;
    }
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
      if (autoStart) beginNavigation();
      else fitNavBounds(plan.coordinates);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        navError = 'Percorso non disponibile. Riprova con connessione o zoom sulla zona.';
      }
    } finally {
      navLoading = false;
    }
  }

  /**
   * Prova le indicazioni con una posizione SIMULATA vicino al POI: utile per
   * verificare il routing offline della città quando sei lontano (es. in Italia).
   * Parte da ~700 m dal luogo, sulle strade reali della città.
   */
  async function previewSampleRoute() {
    const poi = navDestPoi;
    if (!poi || !map) return;
    navLoading = true;
    navError = '';
    const start: [number, number] = [poi.lng + 0.006, poi.lat + 0.006];
    navAbort?.abort();
    navAbort = new AbortController();
    try {
      const plan = await planPedestrianRoute(start, [poi.lng, poi.lat], navAbort.signal);
      navPlan = plan;
      drawNavRoute(plan.coordinates);
      fitNavBounds(plan.coordinates);
      tooFar = false;
      sampleRoute = true;
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        navError = 'Percorso di esempio non disponibile per questa città.';
      }
    } finally {
      navLoading = false;
    }
  }
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
    if (id && poiById.has(id)) {
      try {
        if (sessionStorage.getItem(AUTO_NAV_KEY) === id) {
          sessionStorage.removeItem(AUTO_NAV_KEY);
          pendingAutoNav = true;
        }
      } catch { /* ignore */ }
      focusPoi(id);
      if (!navPlan && !navLoading && !navigating) {
        void startNavigation(pendingAutoNav);
        pendingAutoNav = false;
      }
    } else clearPoiFocus();
  });

  let prevItinLoadId: string | undefined;
  $effect(() => {
    if (!mapReady || nav.seg !== 'mappa') return;
    const id = nav.id;
    if (id?.startsWith('itin:')) {
      if (id !== prevItinLoadId) {
        itinSheetH = 100;
        itinLegIdx = 0;
        void loadItineraryOnMap(id);
      }
    } else {
      clearItinRoute();
    }
    prevItinLoadId = id?.startsWith('itin:') ? id : undefined;
  });

  $effect(() => {
    if (!mapReady) return;
    if (activeItin) {
      setPoiVisibility(activeItin.stops.map((p) => p.id));
    } else if (navPlan && navDestPoi) {
      setPoiVisibility([navDestPoi.id]);
    } else if (mapLayer === 'metro') {
      setPoiVisibility([]);
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

  // Mappa tenuta viva: quando torna visibile va ridimensionata (MapLibre non
  // misura da display:none) e il GPS riattivato; in pausa quando esci, per
  // non scaricare la batteria mentre sei su altre schede.
  $effect(() => {
    const onMap = nav.seg === 'mappa';
    if (!mapReady) return;
    if (onMap) {
      requestAnimationFrame(() => map?.resize());
      resumeGeo();
    } else {
      pauseGeo();
    }
  });

  onMount(() => {
    let cleanupFns: (() => void)[] = [];
    void init().then((fn) => fn && cleanupFns.push(fn));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitMapFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      syncMapFsChrome(false);
      cleanupFns.forEach((f) => f());
    };
  });

  async function init(): Promise<(() => void) | void> {
    // la mappa base (vie) richiede public/tiles/cina.pmtiles (vedi npm run tiles).
    // Si interroga la cache del SW (offline-safe): una HEAD di rete fallirebbe in
    // modalità aereo e farebbe ripiegare, a torto, sullo stile remoto.
    tilesAvailable = await isOfflineAssetReady('/tiles/cina.pmtiles');
    routingOffline = await hasLocalRoutingTiles();

    const ml = await import('maplibre-gl');
    MarkerCtor = ml.Marker;

    if (tilesAvailable) {
      const { Protocol, PMTiles } = await import('pmtiles');
      const protocol = new Protocol();
      // Archivio servito dalla cache del SW via Blob.slice (byte serving offline):
      // la chiave deve combaciare con `pmtiles://<key>` nello style.
      protocol.add(new PMTiles(new CachedRangeSource('/tiles/cina.pmtiles')));
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
      ensureMetroLayers();
      ensureMetroTripLayers();
      mapReady = true;
      // Hook per il test offline (scripts/test-offline.mjs): espone la mappa solo
      // se il test ha impostato il flag, per verificare il caricamento dei tile.
      if (typeof window !== 'undefined' && (window as unknown as { __E2E?: boolean }).__E2E) {
        (window as unknown as { __cinaMap?: unknown }).__cinaMap = map;
      }
    });
    map.on('click', () => {
      if (mapLayer !== 'metro' && !navigating) clearPoiFocus();
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
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        go('mappa', p.id);
      });
      new ml.Marker({ element: el, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(map);
    }

    startGeolocation(ml.Marker);

    return () => {
      navAbort?.abort();
      itinAbort?.abort();
      releaseWakeLock();
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
      layout: { visibility: mapLayer === 'route' ? 'visible' : 'none', 'line-cap': 'round', 'line-join': 'round' },
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
        const { longitude, latitude, heading } = pos.coords;
        userLngLat = [longitude, latitude];
        if (!map) return;
        if (!userMarker) {
          const el = document.createElement('div');
          el.className = 'user-dot';
          userMarker = new MarkerCtor({ element: el }).setLngLat([longitude, latitude]).addTo(map);
        } else {
          userMarker.setLngLat([longitude, latitude]);
        }
        if (navigating) onNavGpsUpdate(longitude, latitude, heading);
      },
      () => (geoNote = 'Posizione non disponibile (permesso negato o GPS senza segnale).'),
      { enableHighAccuracy: true, maximumAge: navigating ? 1000 : 5000 },
    );
  }

  /** Ferma il GPS quando la mappa non è visibile (la mappa resta viva). */
  function pauseGeo() {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }
  /** Riprende il GPS al ritorno sulla mappa. */
  function resumeGeo() {
    if (watchId == null && MarkerCtor) startGeolocation(MarkerCtor);
  }

  function flyTo(c: CityId) {
    activeCity = c;
    metroLineFilter = 'all';
    metroQuery = '';
    resetMetroRoute();
    const ce = center(c);
    map?.flyTo({ center: [ce.lng, ce.lat], zoom: 12 });
  }

  function recenter() {
    if (!userMarker || !map) return;
    const ll = userMarker.getLngLat();
    if (navigating && navProgress) {
      followNavCamera(ll.lng, ll.lat, null, navProgress.mapBearing, true);
    } else {
      map.flyTo({ center: ll, zoom: 14 });
    }
  }

  function ensureMetroLayers() {
    if (!map || map.getSource('metro-lines')) return;

    map.addSource('metro-lines', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'metro-lines-casing',
      type: 'line',
      source: 'metro-lines',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.28 },
    });
    map.addLayer({
      id: 'metro-lines',
      type: 'line',
      source: 'metro-lines',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 5 },
    });

    map.addSource('metro-stations', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'metro-stations-ring',
      type: 'circle',
      source: 'metro-stations',
      layout: { visibility: 'none' },
      paint: { 'circle-radius': 8, 'circle-color': '#ffffff', 'circle-opacity': 0.85 },
    });
    map.addLayer({
      id: 'metro-stations',
      type: 'circle',
      source: 'metro-stations',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 5.5,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      },
    });
    map.addLayer({
      id: 'metro-labels',
      type: 'symbol',
      source: 'metro-stations',
      layout: {
        visibility: 'none',
        'text-field': ['get', 'nameLocal'],
        'text-size': 10,
        'text-offset': [0, 1.15],
        'text-anchor': 'top',
        'text-max-width': 9,
        'text-font': ['Noto Sans Regular'],
      },
      paint: {
        'text-color': '#f6efe4',
        'text-halo-color': '#1a1410',
        'text-halo-width': 1.2,
      },
    });

    map.on('click', 'metro-stations', (e) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      const [lng, lat] = f.geometry.coordinates as [number, number];
      map?.flyTo({ center: [lng, lat], zoom: 15.5, duration: 700 });
    });
    map.on('mouseenter', 'metro-stations', () => {
      if (map) map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'metro-stations', () => {
      if (map) map.getCanvas().style.cursor = '';
    });
  }

  function setMetroVisibility(visible: boolean) {
    if (!map) return;
    const v = visible ? 'visible' : 'none';
    for (const id of [
      'metro-lines-casing',
      'metro-lines',
      'metro-stations-ring',
      'metro-stations',
      'metro-labels',
    ]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
    }
  }

  function setMapLayer(layer: MapLayer) {
    mapLayer = layer;
    if (layer !== 'metro') {
      metroLineFilter = 'all';
      metroQuery = '';
      pickField = null;
      clearMetroPlannedRoute();
    }
    map?.setLayoutProperty('route', 'visibility', layer === 'route' ? 'visible' : 'none');
    mapEl?.classList.toggle('metro-mode', layer === 'metro');
    refreshMetroLayers();
  }

  function selectRouteStation(field: 'from' | 'to', st: MetroStation) {
    if (field === 'from') {
      routeFromId = st.id;
      routeFromQ = `${st.nameLocal} · ${st.name}`;
    } else {
      routeToId = st.id;
      routeToQ = `${st.nameLocal} · ${st.name}`;
    }
    pickField = null;
  }

  function swapRouteEnds() {
    const fid = routeFromId;
    const tid = routeToId;
    const fq = routeFromQ;
    const tq = routeToQ;
    routeFromId = tid;
    routeToId = fid;
    routeFromQ = tq;
    routeToQ = fq;
  }

  function ensureMetroTripLayers() {
    if (!map || map.getSource('metro-trip')) return;
    const empty = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: [] as [number, number][] },
    };
    map.addSource('metro-trip', { type: 'geojson', data: empty });
    map.addLayer({
      id: 'metro-trip-casing',
      type: 'line',
      source: 'metro-trip',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.45 },
    });
    map.addLayer({
      id: 'metro-trip-line',
      type: 'line',
      source: 'metro-trip',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: { 'line-color': '#ffd54a', 'line-width': 5.5 },
    });
  }

  function drawMetroPlannedRoute(plan: MetroRoutePlan) {
    if (!map) return;
    ensureMetroTripLayers();
    const coords = plan.path.map((s) => [s.lng, s.lat] as [number, number]);
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: coords },
    };
    const src = map.getSource('metro-trip');
    if (src && 'setData' in src) (src as { setData: (d: unknown) => void }).setData(data);
    map.setLayoutProperty('metro-trip-casing', 'visibility', 'visible');
    map.setLayoutProperty('metro-trip-line', 'visibility', 'visible');

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
      { padding: { top: 48, bottom: 220, left: 36, right: 36 }, duration: 900, maxZoom: 14 },
    );
  }

  function clearMetroPlannedRoute() {
    if (!map) return;
    if (map.getSource('metro-trip')) {
      const src = map.getSource('metro-trip');
      if (src && 'setData' in src) {
        (src as { setData: (d: unknown) => void }).setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] },
        });
      }
    }
    if (map.getLayer('metro-trip-line')) map.setLayoutProperty('metro-trip-line', 'visibility', 'none');
    if (map.getLayer('metro-trip-casing')) map.setLayoutProperty('metro-trip-casing', 'visibility', 'none');
  }

  function stationLineColor(st: MetroStation): string {
    const line = metroData.lines.find((l) => l.stationIds.includes(st.id));
    return line?.color ?? '#888';
  }

  function refreshMetroLayers() {
    if (!map) return;
    ensureMetroLayers();
    if (mapLayer !== 'metro') {
      setMetroVisibility(false);
      return;
    }
    const geo = metroGeoJSON(activeCity, metroLineFilter);
    const linesSrc = map.getSource('metro-lines');
    const stSrc = map.getSource('metro-stations');
    if (linesSrc && 'setData' in linesSrc) {
      (linesSrc as { setData: (d: unknown) => void }).setData(geo.lines);
    }
    if (stSrc && 'setData' in stSrc) {
      (stSrc as { setData: (d: unknown) => void }).setData(geo.stations);
    }
    setMetroVisibility(true);
  }

  function syncMapFsChrome(on: boolean) {
    document.documentElement.classList.toggle('map-fs-active', on);
  }

  function toggleMapFullscreen() {
    haptic(8);
    mapFullscreen = !mapFullscreen;
    syncMapFsChrome(mapFullscreen);
    requestAnimationFrame(() => map?.resize());
  }

  function exitMapFullscreen() {
    if (!mapFullscreen) return;
    mapFullscreen = false;
    syncMapFsChrome(false);
    requestAnimationFrame(() => map?.resize());
  }

  function flyToMetroStation(st: MetroStation) {
    if (!map) return;
    if (mapLayer !== 'metro') setMapLayer('metro');
    map.flyTo({ center: [st.lng, st.lat], zoom: 15.5, duration: 800 });
  }

  $effect(() => {
    if (!mapReady || mapLayer !== 'metro') return;
    if (metroRoutePlan) drawMetroPlannedRoute(metroRoutePlan);
    else clearMetroPlannedRoute();
  });

  $effect(() => {
    if (!mapReady || !map) return;
    mapFullscreen;
    const t = setTimeout(() => map?.resize(), 150);
    return () => clearTimeout(t);
  });

  $effect(() => {
    if (!mapReady) return;
    activeCity;
    metroLineFilter;
    mapLayer;
    refreshMetroLayers();
  });
</script>

<div
  class="mappa-page"
  class:map-fs={mapFullscreen}
  class:itin-mode={!!activeItin}
  class:navigating-mode={navigating}
  style="--map-accent: {mapAccent}"
>
{#if mapFullscreen}
  <button
    type="button"
    class="map-fs-backdrop"
    aria-label="Esci da schermo intero"
    onclick={exitMapFullscreen}
  ></button>
{/if}

{#if !mapFullscreen && !navigating && !activeItin}
  <ScreenHeader
    seal="图"
    eyebrow="◎ navigatore offline"
    title="Mappa"
    compact
    class="map-screen-head"
  >
    {#snippet actions()}
      <span class="header-pill">{activeCityMeta?.name ?? 'Cina'}</span>
    {/snippet}
  </ScreenHeader>
{/if}

<div
  class="map-stage"
  class:fullscreen={mapFullscreen}
  class:has-itin={!!activeItin}
  bind:this={mapWrapEl}
>
  <div class="map-frame">
    <div class="map-vignette" aria-hidden="true"></div>
    <div
      class="map"
      class:hide-names={hideNames || mapLayer === 'metro'}
      class:itin-open={!!activeItin}
      class:route-focus={!!activeItin || !!navPlan}
      class:metro-mode={mapLayer === 'metro'}
      bind:this={mapEl}
    ></div>
  </div>

  {#if mapFullscreen}
    <button type="button" class="fs-close" onclick={exitMapFullscreen} aria-label="Esci da schermo intero">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  {/if}

  {#if !navigating && !activeItin && !navDestPoi}
    <MapTopChrome
      {citta}
      {activeCity}
      {mapLayer}
      {tilesAvailable}
      {routingOffline}
      {geoNote}
      onFlyTo={flyTo}
      onSetLayer={setMapLayer}
    />
  {/if}

  {#if !navDestPoi && mapLayer !== 'metro'}
    <div class="map-fabs">
      {#if !navigating && !activeItin && !mapFullscreen}
        <button
          type="button"
          class="map-fab fs"
          onclick={toggleMapFullscreen}
          aria-label="Schermo intero"
        >⛶</button>
      {/if}
      <button type="button" class="map-fab gps" onclick={recenter} aria-label="Centra sulla posizione">◎</button>
    </div>
  {/if}

  {#if activeItin}
    <ItinerarySheet
      {activeItin}
      {itinPlan}
      {itinLoading}
      {itinError}
      {itinSheetH}
      itinHMin={ITIN_H_MIN}
      {itinCompact}
      {itinLegIdx}
      {itinDragging}
      {itinWalkHint}
      {maxItinSheetH}
      onDragStart={onItinDragStart}
      onDragMove={onItinDragMove}
      onDragEnd={onItinDragEnd}
      onSetSheetH={(h) => setItinSheetH(h)}
      onSelectLeg={selectItinLeg}
      onClose={closeItinerary}
      onFocusPoi={focusPoi}
    />
  {:else if navDestPoi}
    <NavPanel
      {navDestPoi}
      {navigating}
      {navProgress}
      {navPlan}
      {navError}
      {navLoading}
      {tooFar}
      {sampleRoute}
      {navVoice}
      {routingOffline}
      {rerouteBusy}
      onToggleVoice={() => (navVoice = !navVoice)}
      onStop={stopNavigation}
      onRecenter={recenter}
      onClose={closeNavSheet}
      onStart={() => startNavigation()}
      onPreviewSample={previewSampleRoute}
      onBegin={beginNavigation}
    />
  {/if}

  {#if !activeItin && !navDestPoi && mapLayer === 'metro'}
    <MetroSheet
      {metroData}
      {activeCityMeta}
      {metroSheetTab}
      bind:metroQuery
      {metroLineFilter}
      bind:routeFromQ
      bind:routeToQ
      {routeFromId}
      {routeToId}
      {routeFromPicks}
      {routeToPicks}
      {metroRoutePlan}
      {metroRouteSteps}
      {metroStationsFiltered}
      onSetTab={(t) => (metroSheetTab = t)}
      onSetLineFilter={(id) => (metroLineFilter = id)}
      onPickField={(f) => (pickField = f)}
      onSelectStation={selectRouteStation}
      onSwap={swapRouteEnds}
      onFlyToStation={flyToMetroStation}
      {stationLineColor}
    />
  {/if}
</div>
</div>

<style>
  .mappa-page {
    margin-top: -6px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }
  .mappa-page.map-fs {
    margin-top: 0;
    flex: 1;
    min-height: 0;
  }
  .map-fs-backdrop {
    position: fixed;
    inset: 0;
    z-index: 399;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background:
      radial-gradient(ellipse 80% 60% at 50% 40%, color-mix(in srgb, var(--map-accent) 8%, transparent), transparent 70%),
      rgba(0, 0, 0, 0.78);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: mapFsIn 0.28s var(--ease) both;
  }
  @keyframes mapFsIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── Header (ScreenHeader) ── */
  .mappa-page.navigating-mode :global(.map-screen-head),
  .mappa-page.itin-mode :global(.map-screen-head) { display: none; }

  .mappa-page.navigating-mode .map-stage {
    min-height: calc(100dvh - var(--safe-top) - var(--nav-total-h) - 24px);
  }

  /* ── Stage & frame ── */
  .map-stage {
    position: relative;
    flex: 1;
    min-height: 360px;
    display: flex;
    flex-direction: column;
  }
  .map-stage.has-itin { margin-top: -2px; }
  .map-stage.fullscreen {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: min(100%, 480px);
    height: 100dvh;
    z-index: 400;
    padding-top: var(--safe-top);
    padding-bottom: var(--safe-bottom);
    background: var(--paper);
    box-shadow: 0 0 80px rgba(0, 0, 0, 0.55);
  }
  .map-frame {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--map-accent) 28%, var(--line-strong));
    box-shadow:
      var(--shadow-lg),
      0 0 0 1px color-mix(in srgb, var(--map-accent) 8%, transparent),
      0 20px 48px color-mix(in srgb, var(--map-accent) 10%, transparent);
  }
  .map-stage.fullscreen .map-frame {
    border-radius: 0;
    border: none;
    box-shadow: none;
    height: 100%;
  }
  .map-vignette {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(0, 0, 0, 0.38) 0%, transparent 22%, transparent 78%, rgba(0, 0, 0, 0.28) 100%),
      radial-gradient(ellipse 90% 70% at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.12) 100%);
  }
  .map {
    width: 100%;
    height: 100%;
    min-height: 360px;
  }
  .map-stage.fullscreen .map {
    min-height: 100%;
  }
  .map.metro-mode :global(.poi-pin) {
    visibility: hidden;
    pointer-events: none;
  }

  /* ── Chrome flottante ── */
  /* .map-chrome vive in MapTopChrome.svelte (proprio wrapper interno). */
  /* Chiusura fullscreen: × compatto in alto a destra, fuori dal flusso del
     chrome (così città in alto e legenda in basso restano al loro posto). */
  .fs-close {
    position: absolute;
    top: calc(10px + var(--safe-top));
    right: 10px;
    z-index: 9;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: color-mix(in srgb, #000 52%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }
  .fs-close:active { transform: scale(0.94); }
  /* Stile città/legenda/stato in fullscreen: gestito in MapTopChrome.svelte
     (regole :global su .map-stage.fullscreen, l'ancestor vive qui). */

  /* ── FABs ── */
  .map-fabs {
    position: absolute;
    bottom: 72px;
    right: 12px;
    z-index: 8;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .map-stage.fullscreen .map-fabs {
    bottom: calc(30px + var(--safe-bottom));
    right: 12px;
  }
  .map-fab {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, #fff 18%, var(--line-strong));
    background: color-mix(in srgb, var(--surface-elevated) 88%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
    color: var(--ink-soft);
    font-size: 17px;
    line-height: 1;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition: transform 0.15s var(--ease), border-color 0.15s;
  }
  .map-fab:active { transform: scale(0.94); }
  .map-fab.gps {
    color: var(--jade-bright);
    border-color: color-mix(in srgb, var(--jade) 35%, var(--line));
    background: color-mix(in srgb, var(--jade) 14%, var(--surface-elevated));
    box-shadow:
      0 4px 16px color-mix(in srgb, var(--jade) 25%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
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
    color: #fff; background: var(--fab-bg); padding: 3px 8px; border-radius: 6px;
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
    transition: transform 0.3s var(--ease), box-shadow 0.3s;
  }
  :global(.user-dot.nav-active) {
    width: 20px; height: 20px;
    background: #2d8a62;
    box-shadow:
      0 0 0 5px color-mix(in srgb, var(--jade) 35%, transparent),
      0 0 20px color-mix(in srgb, var(--jade) 50%, transparent);
  }
</style>
