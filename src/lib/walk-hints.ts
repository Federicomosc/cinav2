import { poiById } from './content';
import { formatDistanceM } from './routing';

/** Oltre questa distanza in linea d'aria tra due tappe, consigliare metro/taxi. */
export const LONG_WALK_LEG_M = 3_000;

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

export interface LongWalkLeg {
  fromName: string;
  toName: string;
  distanceM: number;
}

export function longWalkLegsFromStopIds(stopIds: string[]): LongWalkLeg[] {
  const legs: LongWalkLeg[] = [];
  for (let i = 0; i < stopIds.length - 1; i++) {
    const a = poiById.get(stopIds[i]);
    const b = poiById.get(stopIds[i + 1]);
    if (!a || !b) continue;
    const distanceM = haversineM(a.lat, a.lng, b.lat, b.lng);
    if (distanceM >= LONG_WALK_LEG_M) {
      legs.push({ fromName: a.name, toName: b.name, distanceM });
    }
  }
  return legs;
}

export function longWalkSummary(stopIds: string[]): string | null {
  const legs = longWalkLegsFromStopIds(stopIds);
  if (!legs.length) return null;
  if (legs.length === 1) {
    const l = legs[0];
    return `Tratto lungo (${formatDistanceM(l.distanceM)} ${l.fromName} → ${l.toName}): meglio metro o taxi, non a piedi.`;
  }
  const max = legs.reduce((a, b) => (a.distanceM > b.distanceM ? a : b));
  return `${legs.length} tratti oltre ${formatDistanceM(LONG_WALK_LEG_M)} — il più lungo è ${formatDistanceM(max.distanceM)} (${max.fromName} → ${max.toName}). Consigliato metro/taxi.`;
}
