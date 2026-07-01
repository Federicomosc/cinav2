// Percorsi pedonali: tile OpenMapTiles (offline) → OSRM online → linea d'aria.

import { route } from 'omt-router';
import { buildStepsFromCoordinates } from './nav-guidance';
import { isOfflineAssetReady } from './offline-assets';

const REMOTE_TILE_JSON = 'https://tiles.openfreemap.org/planet';
const LOCAL_TILEJSON = '/tiles/routing/tilejson.json';
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';
/** Camminata turistica media — usata per il tempo quando i motori sottostimano (OSRM foot in Cina). */
const WALK_KMH = 5;
const WALK_MPS = WALK_KMH / 3.6;

let tileTemplatePromise: Promise<string | null> | null = null;

export interface RouteStep {
  instruction: string;
  distanceM: number;
  durationS: number;
}

export interface NavPlan {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
  /** true = stima diretta, senza grafo stradale */
  fallback: boolean;
  steps?: RouteStep[];
}

async function getTileTemplate(): Promise<string | null> {
  if (!tileTemplatePromise) {
    tileTemplatePromise = (async () => {
      try {
        const local = await fetch(LOCAL_TILEJSON).then((r) =>
          r.ok ? r.json() : null,
        );
        if (local?.tiles?.[0]) return local.tiles[0] as string;
      } catch {
        /* offline senza routing locale */
      }
      try {
        const remote = await fetch(REMOTE_TILE_JSON).then((r) =>
          r.ok ? r.json() : null,
        );
        return remote?.tiles?.[0] ?? null;
      } catch {
        return null;
      }
    })();
  }
  return tileTemplatePromise;
}

/** Distanza in linea d'aria (metri) tra due punti [lng,lat]. */
export function straightLineM(a: [number, number], b: [number, number]): number {
  return haversineM(a[1], a[0], b[1], b[0]);
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pathDistanceM(coords: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    d += haversineM(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return d;
}

function walkDurationS(distanceM: number): number {
  if (distanceM <= 0) return 0;
  return distanceM / WALK_MPS;
}

function straightLinePlan(from: [number, number], to: [number, number]): NavPlan {
  const distanceM = haversineM(from[1], from[0], to[1], to[0]);
  const coordinates: [number, number][] = [from, to];
  return {
    coordinates,
    distanceM,
    durationS: walkDurationS(distanceM),
    fallback: true,
    steps: buildStepsFromCoordinates(coordinates),
  };
}

function isStraightLine(coords: [number, number][]): boolean {
  return coords.length <= 2;
}

function autoRadiusM(distM: number): number {
  const km = distM / 1000;
  return Math.min(36, Math.max(12, Math.ceil(km * 0.55) + 6));
}

function osrmModifierIt(mod?: string): string {
  switch (mod) {
    case 'left':
      return 'a sinistra';
    case 'right':
      return 'a destra';
    case 'slight left':
      return 'leggermente a sinistra';
    case 'slight right':
      return 'leggermente a destra';
    case 'sharp left':
      return 'strettamente a sinistra';
    case 'sharp right':
      return 'strettamente a destra';
    case 'straight':
      return 'dritto';
    case 'uturn':
      return 'inversione a U';
    default:
      return mod ?? '';
  }
}

function osrmStepIt(step: {
  maneuver: { type: string; modifier?: string };
  name?: string;
  distance: number;
  duration: number;
}): string {
  const { type, modifier } = step.maneuver;
  const name = step.name?.trim();
  const mod = osrmModifierIt(modifier);
  const on = name ? ` su ${name}` : '';

  switch (type) {
    case 'depart':
      return mod ? `Parti ${mod}${on}` : `Parti${on}`;
    case 'arrive':
      return 'Sei arrivato';
    case 'turn':
      return mod ? `Svolta ${mod}${on}` : `Svolta${on}`;
    case 'continue':
    case 'new name':
      return mod ? `Prosegui ${mod}${on}` : `Prosegui${on}`;
    case 'end of road':
      return mod ? `Fine strada, ${mod}${on}` : `Fine strada${on}`;
    case 'fork':
      return mod ? `Biforcazione, tieni ${mod}${on}` : `Biforcazione${on}`;
    case 'roundabout':
    case 'rotary':
      return `Rotonda, esci ${mod || 'alla prima uscita'}${on}`;
    case 'merge':
      return `Immettiti${on}`;
    default:
      return mod ? `${type} ${mod}${on}` : `Prosegui${on}`;
  }
}

interface OsrmRouteResponse {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs: { steps: { maneuver: { type: string; modifier?: string }; name?: string; distance: number; duration: number }[] }[];
  }[];
}

async function planOsrmFootRoute(
  from: [number, number],
  to: [number, number],
  signal?: AbortSignal,
): Promise<NavPlan | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  const url =
    `${OSRM_BASE}/${from[0]},${from[1]};${to[0]},${to[1]}` +
    '?overview=full&geometries=geojson&steps=true&alternatives=false';

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as OsrmRouteResponse;
    const r = data.routes?.[0];
    if (data.code !== 'Ok' || !r?.geometry?.coordinates?.length) return null;

    const steps: RouteStep[] = [];
    for (const leg of r.legs) {
      for (const s of leg.steps) {
        if (s.maneuver.type === 'arrive' && s.distance < 1) continue;
        steps.push({
          instruction: osrmStepIt(s),
          distanceM: s.distance,
          durationS: walkDurationS(s.distance),
        });
      }
    }

    const distanceM = r.distance;
    return {
      coordinates: r.geometry.coordinates,
      distanceM,
      durationS: walkDurationS(distanceM),
      fallback: false,
      steps,
    };
  } catch {
    return null;
  }
}

async function planOmtFootRoute(
  from: [number, number],
  to: [number, number],
  signal?: AbortSignal,
): Promise<NavPlan | null> {
  const template = await getTileTemplate();
  if (!template) return null;

  const isLocal = template.startsWith('/');
  const distM = haversineM(from[1], from[0], to[1], to[0]);

  const attempts: { snap: number; radius: number }[] = [
    { snap: 280, radius: autoRadiusM(distM) },
    { snap: 420, radius: Math.min(48, autoRadiusM(distM) + 12) },
    { snap: 600, radius: Math.min(56, autoRadiusM(distM) + 20) },
  ];

  for (const { snap, radius } of attempts) {
    try {
      const result = await route(from, to, 'pedestrian', template, {
        costField: 'distance',
        signal,
        maxAcceptableSnapDistanceM: snap,
        maxAutoRadius: radius,
        engineId: 'bidirectional-astar',
      });

      if (result.found && result.coordinates.length > 2) {
        const distanceM = pathDistanceM(result.coordinates);
        const durationS = walkDurationS(distanceM);
        const steps = buildStepsFromCoordinates(result.coordinates);
        return {
          coordinates: result.coordinates,
          distanceM,
          durationS,
          fallback: !isLocal || !!result.partialGraph || !!result.hasMissingTiles,
          steps,
        };
      }
    } catch {
      /* tile mancanti — prova parametri più permissivi */
    }
  }

  return null;
}

/** Percorso pedonale da [lng,lat] a [lng,lat]. Preferisce tile locali (offline). */
export async function planPedestrianRoute(
  from: [number, number],
  to: [number, number],
  signal?: AbortSignal,
): Promise<NavPlan> {
  const omt = await planOmtFootRoute(from, to, signal);
  if (omt && !isStraightLine(omt.coordinates)) return omt;

  const online = typeof navigator === 'undefined' || navigator.onLine;
  if (online) {
    const osrm = await planOsrmFootRoute(from, to, signal);
    if (osrm) return osrm;
  }

  if (omt) return omt;
  return straightLinePlan(from, to);
}

export interface ItineraryLeg {
  from: [number, number];
  to: [number, number];
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
  fallback: boolean;
  steps?: RouteStep[];
}

export interface ItineraryPlan {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
  fallback: boolean;
  legs: ItineraryLeg[];
}

/** Percorso pedonale multi-tappa (collega ogni stop al successivo). */
export async function planItineraryRoute(
  stops: [number, number][],
  signal?: AbortSignal,
): Promise<ItineraryPlan> {
  if (stops.length === 0) {
    return { coordinates: [], distanceM: 0, durationS: 0, fallback: false, legs: [] };
  }
  if (stops.length === 1) {
    return { coordinates: stops, distanceM: 0, durationS: 0, fallback: false, legs: [] };
  }

  const legs: ItineraryLeg[] = [];
  const coordinates: [number, number][] = [];
  let distanceM = 0;
  let durationS = 0;
  let fallback = false;

  for (let i = 0; i < stops.length - 1; i++) {
    const plan = await planPedestrianRoute(stops[i], stops[i + 1], signal);
    legs.push({
      from: stops[i],
      to: stops[i + 1],
      coordinates: plan.coordinates,
      distanceM: plan.distanceM,
      durationS: plan.durationS,
      fallback: plan.fallback,
      steps: plan.steps,
    });
    distanceM += plan.distanceM;
    durationS += plan.durationS;
    if (plan.fallback) fallback = true;
    if (coordinates.length === 0) coordinates.push(...plan.coordinates);
    else coordinates.push(...plan.coordinates.slice(1));
  }

  return { coordinates, distanceM, durationS, fallback, legs };
}

export function formatDistanceM(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDurationS(s: number): string {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export const AUTO_NAV_KEY = 'mappa-auto-nav';

/** true se i tile routing locali sono installati (npm run tiles:routing). */
export async function hasLocalRoutingTiles(): Promise<boolean> {
  return isOfflineAssetReady(LOCAL_TILEJSON);
}
