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
  import {
    computeNavProgress,
    formatNavSummary,
    isOffRoute,
    sliceRouteAt,
    type NavProgress,
  } from '../lib/nav-guidance';
  import { haptic } from '../lib/haptic';
  import { waitForPosition } from '../lib/gps';
  import { speakNavInstruction, resetNavSpeech } from '../lib/nav-speak';
  import { resolveItineraryFromMapId } from '../lib/itinerary';
  import { longWalkSummary } from '../lib/walk-hints';
  import { CAT_COLOR, CAT_ICON, CAT_LABEL } from '../lib/poi';
  import { offlineMapStyle } from '../lib/mapStyle';
  import { online } from '../lib/online.svelte';
  import { isOfflineAssetReady } from '../lib/offline-assets';
  import { CachedRangeSource } from '../lib/pmtiles-source';
  import PoiPhoto from '../components/PoiPhoto.svelte';
  import ScreenHeader from '../components/ScreenHeader.svelte';
  import { cityTheme } from '../lib/city-theme';
  import { metroForCity, metroGeoJSON, type MetroStation } from '../lib/metro';
  import {
    planMetroRoute,
    filterMetroStations,
    metroRouteInstructions,
    type MetroRoutePlan,
  } from '../lib/metro-route';
  import type { CityId, PoiCategory } from '../data/types';

  const LEGEND: PoiCategory[] = ['storico', 'moderno', 'natura', 'intrattenimento', 'cibo'];

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
    const from = await ensureUserPosition();
    if (!from) {
      navError = 'Impossibile ottenere il GPS. Attiva la posizione e riprova all’aperto.';
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
              onclick={() => flyTo(c.id)}
            >{c.name}</button>
          {/each}
        </div>

        <div class="layer-tabs" role="tablist" aria-label="Vista mappa">
          <button type="button" class="layer-tab" class:on={mapLayer === 'poi'} role="tab" aria-selected={mapLayer === 'poi'} onclick={() => setMapLayer('poi')}>POI</button>
          <button type="button" class="layer-tab" class:on={mapLayer === 'metro'} role="tab" aria-selected={mapLayer === 'metro'} onclick={() => setMapLayer('metro')}>Metro</button>
          <button type="button" class="layer-tab" class:on={mapLayer === 'route'} role="tab" aria-selected={mapLayer === 'route'} onclick={() => setMapLayer('route')}>Tappe</button>
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
    <aside
      class="itin-sheet"
      class:dragging={itinDragging}
      style="height: {itinSheetH}px"
      aria-label="Itinerario {activeItin.title}"
    >
      <div
        class="itin-grab"
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={itinSheetH}
        aria-valuemin={ITIN_H_MIN}
        aria-valuemax={maxItinSheetH()}
        aria-label="Trascina per ridimensionare il pannello"
        onpointerdown={onItinDragStart}
        onpointermove={onItinDragMove}
        onpointerup={onItinDragEnd}
        onpointercancel={onItinDragEnd}
      >
        <span class="itin-grab-bar" aria-hidden="true"></span>
      </div>
      <div class="itin-sheet-head">
        <div class="itin-head-main">
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
        </div>
        <div class="itin-size-btns" role="group" aria-label="Dimensione pannello">
          <button type="button" class="size-btn" class:on={itinSheetH <= ITIN_H_MIN + 12} onclick={() => setItinSheetH(ITIN_H_MIN)} title="Minimo">S</button>
          <button type="button" class="size-btn" class:on={itinSheetH > ITIN_H_MIN + 12 && itinSheetH < maxItinSheetH() - 40} onclick={() => setItinSheetH(220)} title="Medio">M</button>
          <button type="button" class="size-btn" class:on={itinSheetH >= maxItinSheetH() - 40} onclick={() => setItinSheetH(maxItinSheetH())} title="Massimo">L</button>
        </div>
        <button class="itin-close" onclick={closeItinerary} aria-label="Chiudi itinerario">×</button>
      </div>

      <div class="itin-sheet-scroll">
        {#if itinCompact}
          <div class="itin-compact-stops" aria-hidden="true">
            {#each activeItin.stops as p, i (p.id)}
              <span class="itin-compact-dot" title={p.name}>{i + 1}</span>
              {#if i < activeItin.stops.length - 1}<span class="itin-compact-line"></span>{/if}
            {/each}
          </div>
          <p class="itin-expand-hint">Trascina ↑ o tocca M / L per dettagli</p>
        {:else}
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
        {/if}

        {#if itinWalkHint && !itinCompact}
          <p class="walk-hint-sheet">{itinWalkHint}</p>
        {/if}
        {#if itinError}<p class="nav-err">{itinError}</p>{/if}
        {#if itinPlan?.fallback && !itinError && activeItin.stops.length > 1 && !itinCompact}
          <p class="nav-hint">Alcuni tratti sono stime — serve connessione o tile routing locali.</p>
        {/if}
      </div>
    </aside>
  {:else if navDestPoi}
    {#if navigating}
      <div class="nav-hud" aria-live="polite" aria-label="Navigazione attiva">
        {#if navProgress?.arrived}
          <p class="nav-hud-dist">◎</p>
          <p class="nav-hud-main">Sei arrivato</p>
          <p class="nav-hud-sub">{navDestPoi.name}</p>
        {:else if navProgress}
          <p class="nav-hud-dist">{formatDistanceM(navProgress.distanceToStepM)}</p>
          <p class="nav-hud-main">
            {navPlan?.steps?.[navProgress.stepIndex]?.instruction ?? 'Prosegui'}
          </p>
          <p class="nav-hud-sub">
            {formatNavSummary(navProgress.distanceRemainingM, navProgress.durationRemainingS)}
            {#if rerouteBusy} · ricalcolo…{:else if isOffRoute(navProgress.offRouteM)} · fuori percorso{/if}
          </p>
        {:else}
          <p class="nav-hud-main">Acquisizione GPS…</p>
        {/if}
        <div class="nav-hud-actions">
          <button
            type="button"
            class="nav-hud-btn"
            class:on={navVoice}
            onclick={() => (navVoice = !navVoice)}
            aria-pressed={navVoice}
          >
            {navVoice ? '🔊' : '🔇'}
          </button>
          <button type="button" class="nav-hud-btn stop" onclick={stopNavigation}>Stop</button>
          <button type="button" class="nav-hud-btn" onclick={recenter}>Centra</button>
        </div>
        {#if navPlan?.steps && navPlan.steps.length > 1 && !navProgress?.arrived}
          <ol class="nav-hud-steps" aria-label="Prossime indicazioni">
            {#each navPlan.steps.slice(navProgress?.stepIndex ?? 0, (navProgress?.stepIndex ?? 0) + 3) as step, i (i)}
              <li class:current={i === 0}>
                <span>{step.instruction}</span>
                {#if step.distanceM > 0 && i === 0}<em>{formatDistanceM(step.distanceM)}</em>{/if}
              </li>
            {/each}
          </ol>
        {/if}
      </div>
    {:else}
    <aside class="nav-sheet" aria-label="Navigazione verso {navDestPoi.name}">
      <PoiPhoto id={navDestPoi.id} category={navDestPoi.category} name={navDestPoi.name} variant="hero" />
      <div class="nav-head">
        <span class="nav-label">Destinazione</span>
        <strong class="nav-name">{navDestPoi.name}</strong>
        {#if navPlan}
          <p class="nav-meta">
            {formatDistanceM(navPlan.distanceM)} · {formatDurationS(navPlan.durationS)} a piedi
            {#if navPlan.fallback}<span class="nav-fallback"> · stima</span>{/if}
            {#if routingOffline && !navPlan.fallback}<span class="nav-offline"> · offline</span>{/if}
          </p>
        {/if}
      </div>
      {#if navPlan?.steps?.length && navPlan.steps.length > 1}
        <ol class="nav-directions" aria-label="Anteprima indicazioni">
          {#each navPlan.steps.slice(0, 4) as step, i (i)}
            <li class="nav-dir">
              <span>{step.instruction}</span>
              {#if step.distanceM > 0}<em>{formatDistanceM(step.distanceM)}</em>{/if}
            </li>
          {/each}
          {#if navPlan.steps.length > 4}
            <li class="nav-dir more">+{navPlan.steps.length - 4} passaggi</li>
          {/if}
        </ol>
      {/if}
      <div class="nav-actions">
        {#if navPlan}
          <button class="nav-btn ghost" onclick={closeNavSheet}>Chiudi</button>
          <button class="nav-btn secondary" onclick={() => startNavigation()} disabled={navLoading}>
            {navLoading ? '…' : 'Aggiorna'}
          </button>
          <button class="nav-btn primary wide" onclick={beginNavigation} disabled={navLoading || !navPlan}>
            Avvia navigazione
          </button>
        {:else}
          <button class="nav-btn primary wide" onclick={() => startNavigation()} disabled={navLoading}>
            {navLoading ? 'Calcolo percorso…' : 'Calcola percorso'}
          </button>
        {/if}
      </div>
      {#if navError}<p class="nav-err">{navError}</p>{/if}
      {#if navPlan?.fallback && !navError && !routingOffline}
        <p class="nav-hint">Percorso stimato — installa i tile routing (<code>npm run tiles:routing</code>) per strade reali offline.</p>
      {:else if navPlan && routingOffline && !navPlan.fallback}
        <p class="nav-hint ok-hint">Percorso pedonale offline sulle strade reali.</p>
      {/if}
    </aside>
    {/if}
  {/if}

  {#if !activeItin && !navDestPoi && mapLayer === 'metro'}
    <aside class="metro-sheet" class:route-tab={metroSheetTab === 'route'} aria-label="Metro {activeCityMeta?.name}">
      {#if !metroData.hasMetro}
        <p class="metro-empty">{metroData.note}</p>
      {:else}
        <div class="metro-sheet-tabs" role="tablist" aria-label="Modalità metro">
          <button type="button" class="m-tab" class:on={metroSheetTab === 'route'} role="tab" aria-selected={metroSheetTab === 'route'} onclick={() => (metroSheetTab = 'route')}>Percorso</button>
          <button type="button" class="m-tab" class:on={metroSheetTab === 'list'} role="tab" aria-selected={metroSheetTab === 'list'} onclick={() => (metroSheetTab = 'list')}>Fermate</button>
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
                onfocus={() => (pickField = 'from')}
              />
              {#if routeFromPicks.length}
                <ul class="route-picks">
                  {#each routeFromPicks as st (st.id)}
                    <li><button type="button" class="route-pick" onclick={() => selectRouteStation('from', st)}>{st.nameLocal} · {st.name}</button></li>
                  {/each}
                </ul>
              {/if}
            </label>
            <button type="button" class="route-swap" onclick={swapRouteEnds} aria-label="Inverti partenza e arrivo">⇅</button>
            <label class="route-field">
              <span class="route-lbl">A</span>
              <input
                class="metro-search"
                type="search"
                placeholder="Stazione di arrivo…"
                bind:value={routeToQ}
                onfocus={() => (pickField = 'to')}
              />
              {#if routeToPicks.length}
                <ul class="route-picks">
                  {#each routeToPicks as st (st.id)}
                    <li><button type="button" class="route-pick" onclick={() => selectRouteStation('to', st)}>{st.nameLocal} · {st.name}</button></li>
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
            <button type="button" class="m-line" class:on={metroLineFilter === 'all'} onclick={() => (metroLineFilter = 'all')}>Tutte</button>
            {#each metroData.lines as line (line.id)}
              <button
                type="button"
                class="m-line"
                class:on={metroLineFilter === line.id}
                style="--lc:{line.color}"
                onclick={() => (metroLineFilter = line.id)}
                title={line.nameLocal}
              >{line.number}</button>
            {/each}
          </div>
          <ul class="metro-rows">
            {#each metroStationsFiltered as st (st.id)}
              <li>
                <button type="button" class="m-row" onclick={() => flyToMetroStation(st)}>
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

  .mappa-page.navigating-mode .map-top,
  .mappa-page.navigating-mode .map-bottom {
    display: none;
  }
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
  /* Zona alta: ricerca + città + vista (controlli leggeri, niente cardone) */
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
  /* In fullscreen: città più strette (lasciano il pulsante × in alto a destra),
     e legenda/stato nascosti per una vista mappa pulita. */
  .map-stage.fullscreen .cities {
    width: calc(100% - 52px);
  }
  .map-stage.fullscreen .map-bottom {
    display: none;
  }
  /* Zona bassa: legenda + stato (solo modalità POI) */
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

  /* Stato (in alto, sotto le città): una riga compatta, mai a capo */
  .map-status-line {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
  }
  /* Legenda categorie (in basso, sopra il segmentato): centrata, scorrevole */
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
  /* In fullscreen la stage è fixed a 100dvh: il pannello va alzato sopra
     l'home indicator (il bottom assoluto è relativo al bordo schermo). */
  .map-stage.fullscreen .metro-sheet {
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
    top: calc(100% + 2px);
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
  .nav-sheet {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 5;
    background: color-mix(in srgb, var(--surface-elevated) 90%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
    border: 1px solid color-mix(in srgb, var(--jade) 28%, var(--line-strong));
    border-radius: var(--radius-md);
    padding: 14px 16px;
    box-shadow:
      var(--shadow-lg),
      0 0 28px color-mix(in srgb, var(--jade) 12%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
  .nav-offline { color: var(--jade-bright); }
  .nav-directions {
    list-style: none;
    margin: 10px 0 0;
    padding: 10px 0 0;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 120px;
    overflow-y: auto;
  }
  .nav-dir {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--ink-body);
  }
  .nav-dir em {
    font-style: normal;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    flex: none;
  }
  .nav-dir.more { color: var(--ink-faint); font-size: 0.78rem; }
  .nav-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .nav-btn {
    flex: 1;
    min-width: 0;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-pill);
    padding: 10px 12px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
  }
  .nav-btn.primary {
    flex: 1.4;
    border-color: var(--jade);
    background: linear-gradient(135deg, var(--jade) 0%, #2d8a62 100%);
    color: #fff;
    box-shadow: 0 4px 14px color-mix(in srgb, var(--jade) 30%, transparent);
  }
  .nav-btn.secondary {
    flex: none;
    border-color: color-mix(in srgb, var(--jade) 35%, var(--line));
    color: var(--jade-bright);
  }
  .nav-btn.wide { flex: 1 1 100%; }
  .nav-btn.ghost { flex: none; }
  .nav-btn:disabled { opacity: 0.6; }
  .nav-hud {
    position: absolute;
    left: 10px;
    right: 10px;
    top: 10px;
    z-index: 7;
    padding: 14px 16px 12px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--surface-elevated) 94%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
    border: 1px solid color-mix(in srgb, var(--jade) 35%, var(--line-strong));
    box-shadow: var(--shadow-lg), 0 0 32px color-mix(in srgb, var(--jade) 15%, transparent);
  }
  .nav-hud-dist {
    font-family: var(--serif);
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    color: var(--jade-bright);
    margin-bottom: 4px;
  }
  .nav-hud-main {
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--ink);
  }
  .nav-hud-sub {
    margin-top: 6px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-faint);
  }
  .nav-hud-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .nav-hud-btn {
    flex: 1;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    padding: 9px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
  }
  .nav-hud-btn.stop {
    color: var(--cinabro-bright);
    border-color: color-mix(in srgb, var(--cinabro) 35%, var(--line));
  }
  .nav-hud-btn.on {
    color: var(--jade-bright);
    border-color: color-mix(in srgb, var(--jade) 40%, var(--line));
    background: color-mix(in srgb, var(--jade) 12%, var(--surface));
  }
  .nav-hud-steps {
    list-style: none;
    margin: 12px 0 0;
    padding: 10px 0 0;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 88px;
    overflow-y: auto;
  }
  .nav-hud-steps li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.78rem;
    color: var(--ink-faint);
    line-height: 1.35;
  }
  .nav-hud-steps li.current {
    color: var(--ink);
    font-weight: 600;
  }
  .nav-hud-steps em {
    font-style: normal;
    font-family: var(--mono);
    font-size: 9px;
    flex: none;
  }
  .nav-err, .nav-hint {
    margin: 10px 0 0;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--cinabro-bright);
  }
  .nav-hint { color: var(--ink-faint); }
  .nav-hint.ok-hint { color: var(--jade-bright); }

  .itin-sheet {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 6;
    display: flex;
    flex-direction: column;
    background: var(--sheet-bg-solid);
    backdrop-filter: blur(8px);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 4px 12px 8px;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    transition: box-shadow 0.15s;
  }
  .itin-sheet.dragging {
    box-shadow: var(--shadow-lg), 0 0 0 1px var(--cinabro);
  }
  .itin-grab {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 10px 0 6px;
    cursor: ns-resize;
    touch-action: none;
    flex: none;
  }
  .itin-grab-bar {
    width: 40px;
    height: 5px;
    border-radius: 3px;
    background: var(--line-strong);
  }
  .itin-sheet.dragging .itin-grab-bar {
    background: var(--cinabro);
    width: 48px;
  }
  .itin-sheet-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .itin-size-btns {
    display: flex;
    gap: 4px;
    flex: none;
  }
  .size-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--ink-faint);
  }
  .size-btn.on {
    background: var(--cinabro);
    border-color: var(--cinabro);
    color: #fff;
  }
  .itin-head-main {
    flex: 1;
    min-width: 0;
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
    background: color-mix(in srgb, var(--gold) 14%, var(--sheet-bg-solid));
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
  .itin-sheet-head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 6px;
    flex: none;
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
