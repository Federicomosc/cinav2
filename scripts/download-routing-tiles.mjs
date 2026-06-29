#!/usr/bin/env node
/**
 * Scarica tile vettoriali OpenMapTiles (OpenFreeMap) per le 5 città.
 * Servono a omt-router per percorsi pedonali offline.
 * Output: public/tiles/routing/{z}/{x}/{y}.pbf + tilejson.json
 */
import { mkdir, writeFile, access, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'tiles', 'routing');

const PLANET_META = 'https://tiles.openfreemap.org/planet';
const ZOOM_MIN = 11;
const ZOOM_MAX = 14;
const CONCURRENCY = 8;

/** [minLon, minLat, maxLon, maxLat] — WGS-84, allineati a build-pmtiles.sh */
const BBOXES = {
  chengdu: [103.85, 30.55, 104.25, 30.8],
  chongqing: [106.4, 29.45, 106.65, 29.65],
  zhangjiajie: [110.35, 29.0, 110.6, 29.45],
  pechino: [116.05, 39.8, 116.65, 40.5],
  shanghai: [121.3, 31.1, 121.6, 31.3],
};

function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function lat2tile(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

function tilesForBbox([minLon, minLat, maxLon, maxLat], z) {
  const xs = [];
  const ys = [];
  const x0 = lon2tile(minLon, z);
  const x1 = lon2tile(maxLon, z);
  const y0 = lat2tile(maxLat, z);
  const y1 = lat2tile(minLat, z);
  for (let x = x0; x <= x1; x++) xs.push(x);
  for (let y = y0; y <= y1; y++) ys.push(y);
  const list = [];
  for (const x of xs) for (const y of ys) list.push({ z, x, y });
  return list;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchTemplate() {
  const meta = await fetch(PLANET_META).then((r) => r.json());
  const t = meta.tiles?.[0];
  if (!t) throw new Error('TileJSON OpenFreeMap senza URL tile');
  return t;
}

async function runPool(tasks, worker) {
  let i = 0;
  const results = { ok: 0, skip: 0, fail: 0, bytes: 0 };
  async function next() {
    while (i < tasks.length) {
      const idx = i++;
      const r = await worker(tasks[idx]);
      results[r]++;
      if (idx % 50 === 0) process.stdout.write('.');
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  return results;
}

const template = await fetchTemplate();
console.log('Template routing:', template);

const allTiles = new Map();
for (const [name, bbox] of Object.entries(BBOXES)) {
  for (let z = ZOOM_MIN; z <= ZOOM_MAX; z++) {
    for (const t of tilesForBbox(bbox, z)) {
      allTiles.set(`${t.z}/${t.x}/${t.y}`, t);
    }
  }
  console.log(`  ${name}: bbox ok`);
}

const tasks = [...allTiles.values()];
console.log(`Tile da scaricare (deduplicati): ${tasks.length}`);

const results = await runPool(tasks, async ({ z, x, y }) => {
  const rel = `${z}/${x}/${y}.pbf`;
  const dest = join(OUT, rel);
  if (await exists(dest)) {
    const s = await stat(dest);
    if (s.size > 100) return 'skip';
  }
  const url = template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  try {
    const res = await fetch(url);
    if (!res.ok) return 'fail';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 50) return 'fail';
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    return 'ok';
  } catch {
    return 'fail';
  }
});

const tilejson = {
  tilejson: '3.0.0',
  name: 'Cina Tour routing (offline)',
  tiles: ['/tiles/routing/{z}/{x}/{y}.pbf'],
  minzoom: ZOOM_MIN,
  maxzoom: ZOOM_MAX,
  vector_layers: [{ id: 'transportation' }],
};

await writeFile(join(OUT, 'tilejson.json'), JSON.stringify(tilejson, null, 2));

console.log(
  `\nRouting tiles: ${results.ok} ok, ${results.skip} skip, ${results.fail} fail → ${OUT}`,
);
