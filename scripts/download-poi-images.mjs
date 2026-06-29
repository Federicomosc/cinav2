#!/usr/bin/env node
/**
 * Scarica miniature Wikimedia Commons per i POI principali → public/places/{id}.jpg
 * Uso: node scripts/download-poi-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../public/places');
const UA = 'CinaTour2026/1.0 (offline travel companion; local build)';

/** id POI → nome file su Wikimedia Commons */
const IMAGES = {
  'panda-base': 'Grosser_Panda.JPG',
  'jinli': 'Jinli_Street,_Chengdu.jpg',
  'hongya': 'Hongyadong_at_night.jpg',
  'liziba': 'Liziba_Station,_Chongqing.jpg',
  'avatar-park': 'Zhangjiajie_National_Forest_Park.jpg',
  'tianmen': 'Tianmen_Mountain_National_Park.jpg',
  'forbidden-city': 'The_Forbidden_City_-_View_from_Coal_Hill.jpg',
  'mutianyu': 'Great_Wall_of_China_at_Mutianyu.jpg',
  'temple-heaven': 'Temple_of_Heaven_2018.jpg',
  'summer-palace': 'Summer_Palace_Beijing.jpg',
  'bund': 'The_Bund_Shanghai.jpg',
  'yu-garden': 'Yu_Garden_Shanghai.jpg',
  'shanghai-tower': 'Shanghai_Tower_2015.jpg',
  'glass-bridge': 'Zhangjiajie_Glass_Bridge.jpg',
  'ciqikou': 'Ciqikou_ancient_town.jpg',
  '798': '798_Art_District_Beijing.jpg',
};

fs.mkdirSync(OUT, { recursive: true });

async function thumbUrl(filename) {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.searchParams.set('action', 'query');
  api.searchParams.set('titles', `File:${filename}`);
  api.searchParams.set('prop', 'imageinfo');
  api.searchParams.set('iiprop', 'url');
  api.searchParams.set('iiurlwidth', '640');
  api.searchParams.set('format', 'json');
  const res = await fetch(api, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  const page = Object.values(json.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl) throw new Error('no thumb');
  return info.thumburl;
}

let ok = 0;
let fail = 0;

for (const [id, file] of Object.entries(IMAGES)) {
  const dest = path.join(OUT, `${id}.jpg`);
  try {
    const url = await thumbUrl(file);
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 3000) throw new Error('file too small');
    fs.writeFileSync(dest, buf);
    console.log(`✓ ${id}.jpg`);
    ok++;
  } catch (e) {
    console.warn(`✗ ${id}: ${e.message}`);
    fail++;
  }
}

console.log(`\n${ok} foto scaricate, ${fail} errori → ${OUT}`);
