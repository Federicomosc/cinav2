import type { CityId } from '../data/types';
import metroRaw from '../data/metro.json';

export interface MetroStation {
  id: string;
  name: string;
  nameLocal: string;
  lng: number;
  lat: number;
  lines: string[];
  /** POI vicino (se utile in viaggio). */
  nearPoi?: string;
}

export interface MetroLine {
  id: string;
  number: string;
  name: string;
  nameLocal: string;
  color: string;
  stationIds: string[];
}

export interface MetroCityData {
  hasMetro: boolean;
  systemName?: string;
  nameLocal?: string;
  note?: string;
  stations: MetroStation[];
  lines: MetroLine[];
}

export interface MetroGeoJSON {
  lines: { type: 'FeatureCollection'; features: object[] };
  stations: { type: 'FeatureCollection'; features: object[] };
}

interface MetroFile {
  cities: Record<CityId, MetroCityData>;
}

const metro = metroRaw as MetroFile;

export function metroForCity(city: CityId): MetroCityData {
  return (
    metro.cities[city] ?? {
      hasMetro: false,
      note: 'Dati metro non disponibili.',
      stations: [],
      lines: [],
    }
  );
}

export function metroGeoJSON(city: CityId, lineFilter?: string): MetroGeoJSON {
  const data = metroForCity(city);
  const stationById = new Map(data.stations.map((s) => [s.id, s]));
  const activeLines =
    lineFilter && lineFilter !== 'all'
      ? data.lines.filter((l) => l.id === lineFilter || l.number === lineFilter)
      : data.lines;

  const lineFeatures: object[] = [];
  for (const line of activeLines) {
    const coords: [number, number][] = [];
    for (const sid of line.stationIds) {
      const st = stationById.get(sid);
      if (st) coords.push([st.lng, st.lat]);
    }
    if (coords.length < 2) continue;
    lineFeatures.push({
      type: 'Feature',
      properties: {
        id: line.id,
        number: line.number,
        name: line.name,
        nameLocal: line.nameLocal,
        color: line.color,
      },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }

  const stationIds = new Set(activeLines.flatMap((l) => l.stationIds));
  const stationFeatures: object[] = data.stations
    .filter((s) => stationIds.has(s.id))
    .map((s) => {
      const lineColors = activeLines
        .filter((l) => l.stationIds.includes(s.id))
        .map((l) => l.color);
      return {
        type: 'Feature',
        properties: {
          id: s.id,
          name: s.name,
          nameLocal: s.nameLocal,
          color: lineColors[0] ?? '#e67e22',
          lines: s.lines.join(', '),
          nearPoi: s.nearPoi ?? '',
        },
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      };
    });

  return {
    lines: { type: 'FeatureCollection', features: lineFeatures },
    stations: { type: 'FeatureCollection', features: stationFeatures },
  };
}

export const metroCities = (Object.keys(metro.cities) as CityId[]).filter(
  (id) => metro.cities[id]?.hasMetro || metro.cities[id]?.note,
);
