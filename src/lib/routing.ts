// Percorsi pedonali: tile OpenMapTiles locali (offline) → fallback OpenFreeMap → linea d'aria.

import { route } from 'omt-router';

const REMOTE_TILE_JSON = 'https://tiles.openfreemap.org/planet';
const LOCAL_TILEJSON = '/tiles/routing/tilejson.json';
const WALK_MPS = 5 / 3.6;

let tileTemplatePromise: Promise<string | null> | null = null;

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

export interface NavPlan {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
  /** true = stima diretta, senza grafo stradale */
  fallback: boolean;
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

function straightLinePlan(from: [number, number], to: [number, number]): NavPlan {
  const distanceM = haversineM(from[1], from[0], to[1], to[0]);
  return {
    coordinates: [from, to],
    distanceM,
    durationS: distanceM / WALK_MPS,
    fallback: true,
  };
}

/** Percorso pedonale da [lng,lat] a [lng,lat]. */
export async function planPedestrianRoute(
  from: [number, number],
  to: [number, number],
  signal?: AbortSignal,
): Promise<NavPlan> {
  const template = await getTileTemplate();
  if (!template) return straightLinePlan(from, to);

  const isLocal = template.startsWith('/');

  try {
    const result = await route(from, to, 'pedestrian', template, {
      costField: 'travelTime',
      signal,
      maxAcceptableSnapDistanceM: 150,
      maxAutoRadius: 10,
    });

    if (result.found && result.coordinates.length > 1) {
      const distanceM = pathDistanceM(result.coordinates);
      const durationS =
        result.costField === 'travelTime' ? result.cost : distanceM / WALK_MPS;
      return {
        coordinates: result.coordinates,
        distanceM,
        durationS,
        fallback: !isLocal || !!result.partialGraph || !!result.hasMissingTiles,
      };
    }
  } catch {
    /* tile mancanti */
  }

  return straightLinePlan(from, to);
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
  try {
    const r = await fetch(LOCAL_TILEJSON, { method: 'HEAD' });
    return r.ok;
  } catch {
    return false;
  }
}
