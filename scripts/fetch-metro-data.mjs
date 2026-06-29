#!/usr/bin/env node
/**
 * Scarica stazioni metro da OpenStreetMap (Overpass) → src/data/metro-osm.json
 * Uso: node scripts/fetch-metro-data.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'data', 'metro-osm.json');

/** bbox: [west, south, east, north] */
const CITIES = {
  chengdu: { west: 103.85, south: 30.45, east: 104.25, north: 30.85 },
  chongqing: { west: 106.35, south: 29.4, east: 106.7, north: 29.7 },
  pechino: { west: 116.15, south: 39.75, east: 116.65, north: 40.1 },
  shanghai: { west: 121.25, south: 31.05, east: 121.65, north: 31.45 },
};

const LINE_COLORS = {
  '1': '#C23A30',
  '2': '#009B6B',
  '3': '#F39800',
  '4': '#6C1D7D',
  '5': '#A61D7F',
  '6': '#D40068',
  '7': '#F5C700',
  '8': '#0094D8',
  '9': '#8FC31F',
  '10': '#C6AFD4',
  '11': '#871C2B',
  '12': '#007A5E',
  '13': '#E999C0',
  '14': '#626020',
  '15': '#BBA786',
  '16': '#98D1C0',
  '17': '#B6A014',
  '18': '#C4984F',
  '19': '#F7ACB7',
  '20': '#98D1C0',
};

function lineColor(ref) {
  const m = String(ref ?? '').match(/(\d+)/);
  if (!m) return '#e67e22';
  return LINE_COLORS[m[1]] ?? '#888';
}

async function queryOverpass(cityId, bbox) {
  const { west, south, east, north } = bbox;
  const q = `[out:json][timeout:120];
(
  node["station"="subway"]["name"](${south},${west},${north},${east});
  node["subway"="yes"]["name"](${south},${west},${north},${east});
  node["railway"="station"]["subway"="yes"]["name"](${south},${west},${north},${east});
);
out body;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let lastErr;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'POST', body: q });
      if (!res.ok) throw new Error(`${url} → ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function parseStations(elements) {
  const byLine = new Map();
  const stations = [];

  for (const el of elements) {
    if (el.type !== 'node' || !el.tags?.name) continue;
    const refs = (el.tags.ref || el.tags['railway:ref'] || '')
      .split(/[;,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const lineTags = [];
    if (el.tags.line) lineTags.push(...String(el.tags.line).split(/[;,|]/));
    if (el.tags['subway:line']) lineTags.push(...String(el.tags['subway:line']).split(/[;,|]/));

    const lineKeys = [...new Set([...refs, ...lineTags].map((x) => x.replace(/\D/g, '')).filter(Boolean))];
    if (!lineKeys.length) lineKeys.push('0');

    const station = {
      name: el.tags.name,
      nameLocal: el.tags['name:zh'] || el.tags['name:zh-Hans'] || el.tags.name,
      lat: el.lat,
      lng: el.lon,
      lines: lineKeys,
    };
    stations.push(station);

    for (const lk of lineKeys) {
      const arr = byLine.get(lk) ?? [];
      arr.push(station);
      byLine.set(lk, arr);
    }
  }

  const lines = [...byLine.entries()]
    .filter(([k]) => k !== '0')
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([num, st]) => ({
      id: `line-${num}`,
      number: num,
      name: `Linea ${num}`,
      nameLocal: `${num}号线`,
      color: lineColor(num),
      stations: st.sort((a, b) => a.lng - b.lng || a.lat - b.lat),
    }));

  return { stations, lines };
}

const result = { generatedAt: new Date().toISOString(), cities: {} };

for (const [cityId, bbox] of Object.entries(CITIES)) {
  process.stdout.write(`Fetching ${cityId}… `);
  try {
    const data = await queryOverpass(cityId, bbox);
    const parsed = parseStations(data.elements ?? []);
    result.cities[cityId] = { hasMetro: true, ...parsed };
    console.log(`${parsed.stations.length} stazioni, ${parsed.lines.length} linee`);
  } catch (e) {
    console.log(`errore: ${e.message}`);
    result.cities[cityId] = { hasMetro: true, stations: [], lines: [], error: e.message };
  }
}

result.cities.zhangjiajie = {
  hasMetro: false,
  note: 'Nessuna metropolitana — bus, taxi e funivie per Zhangjiajie e Wulingyuan.',
  stations: [],
  lines: [],
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(result, null, 2));
console.log(`\nScritto ${OUT}`);
