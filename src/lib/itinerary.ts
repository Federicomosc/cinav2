import { cittaById, poiById } from './content';
import { getCustomItinerary } from './custom-itineraries.svelte';
import type { CityId, Poi } from '../data/types';

export interface CityItineraryView {
  cityId: CityId;
  title: string;
  stops: Poi[];
  source: 'builtin' | 'custom';
  /** Per aprire sulla mappa */
  mapId: string;
  customId?: string;
  builtinIndex?: number;
}

export function builtinItineraryMapId(cityId: CityId, index: number): string {
  return `itin:${cityId}:${index}`;
}

export function customItineraryMapId(id: string): string {
  return `itin:u:${id}`;
}

/** @deprecated usa builtinItineraryMapId o customItineraryMapId */
export function itineraryMapId(cityId: CityId, index: number): string {
  return builtinItineraryMapId(cityId, index);
}

export function parseItineraryMapId(
  id: string,
): { type: 'builtin'; cityId: CityId; index: number } | { type: 'custom'; id: string } | null {
  const custom = /^itin:u:([a-f0-9-]+)$/i.exec(id);
  if (custom) return { type: 'custom', id: custom[1] };

  const builtin = /^itin:([^:]+):(\d+)$/.exec(id);
  if (!builtin) return null;
  const cityId = builtin[1] as CityId;
  const index = Number(builtin[2]);
  if (!cittaById.has(cityId) || Number.isNaN(index)) return null;
  return { type: 'builtin', cityId, index };
}

export function resolveBuiltinItinerary(cityId: CityId, index: number): CityItineraryView | null {
  const city = cittaById.get(cityId);
  const raw = city?.itineraries[index];
  if (!raw) return null;
  const stops = raw.stops
    .map((id) => poiById.get(id))
    .filter((p): p is Poi => !!p);
  if (!stops.length) return null;
  return {
    cityId,
    title: raw.title,
    stops,
    source: 'builtin',
    mapId: builtinItineraryMapId(cityId, index),
    builtinIndex: index,
  };
}

export function resolveCustomItinerary(id: string): CityItineraryView | null {
  const rec = getCustomItinerary(id);
  if (!rec) return null;
  const stops = rec.stops
    .map((pid) => poiById.get(pid))
    .filter((p): p is Poi => !!p);
  if (!stops.length) return null;
  return {
    cityId: rec.city,
    title: rec.title,
    stops,
    source: 'custom',
    mapId: customItineraryMapId(id),
    customId: id,
  };
}

export function resolveItineraryFromMapId(id: string): CityItineraryView | null {
  const parsed = parseItineraryMapId(id);
  if (!parsed) return null;
  if (parsed.type === 'custom') return resolveCustomItinerary(parsed.id);
  return resolveBuiltinItinerary(parsed.cityId, parsed.index);
}

/** @deprecated usa resolveBuiltinItinerary */
export function resolveCityItinerary(cityId: CityId, index: number): CityItineraryView | null {
  return resolveBuiltinItinerary(cityId, index);
}
