import { liveQuery } from 'dexie';
import { db, uid, now, type CustomItinerary } from '../db/dexie';
import { poiById } from './content';
import type { CityId } from '../data/types';

const customItineraries = $state<CustomItinerary[]>([]);

if (typeof window !== 'undefined') {
  liveQuery(() => db.customItineraries.orderBy('order').toArray()).subscribe((v) => {
    customItineraries.length = 0;
    customItineraries.push(...v);
  });
}

export function customItinerariesForCity(city: CityId): CustomItinerary[] {
  return customItineraries.filter((i) => i.city === city);
}

export function getCustomItinerary(id: string): CustomItinerary | undefined {
  return customItineraries.find((i) => i.id === id);
}

export async function saveCustomItinerary(data: {
  id?: string;
  city: CityId;
  title: string;
  stops: string[];
}): Promise<string | null> {
  const title = data.title.trim() || 'Itinerario';
  const stops = data.stops.filter((id) => poiById.has(id));
  if (!stops.length) return null;

  if (data.id) {
    await db.customItineraries.update(data.id, { title, stops, updatedAt: now() });
    return data.id;
  }

  const id = uid();
  const order = customItineraries.filter((i) => i.city === data.city).length;
  await db.customItineraries.add({
    id,
    city: data.city,
    title,
    stops,
    order,
    updatedAt: now(),
  });
  return id;
}

export async function deleteCustomItinerary(id: string): Promise<void> {
  await db.customItineraries.delete(id);
}

export interface ItineraryExportFile {
  version: 1;
  exportedAt: string;
  items: { city: CityId; title: string; stops: string[] }[];
}

export async function buildItineraryExport(): Promise<ItineraryExportFile> {
  const items = await db.customItineraries.orderBy('order').toArray();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map(({ city, title, stops }) => ({ city, title, stops })),
  };
}

export function downloadItineraryExport(data: ItineraryExportFile): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cina-itinerari-${data.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Importa itinerari; ritorna il numero di elementi aggiunti. */
export async function importItineraryExport(raw: unknown): Promise<number> {
  const data = raw as ItineraryExportFile;
  if (!data || data.version !== 1 || !Array.isArray(data.items)) {
    throw new Error('File non valido');
  }
  let added = 0;
  for (const item of data.items) {
    if (!item.city || !item.title || !Array.isArray(item.stops)) continue;
    const stops = item.stops.filter((id) => poiById.has(id));
    if (!stops.length) continue;
    const order = customItineraries.filter((i) => i.city === item.city).length + added;
    await db.customItineraries.add({
      id: uid(),
      city: item.city,
      title: item.title.trim() || 'Itinerario',
      stops,
      order,
      updatedAt: now(),
    });
    added++;
  }
  return added;
}
