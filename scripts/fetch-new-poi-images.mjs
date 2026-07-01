#!/usr/bin/env node
/**
 * Scarica le foto dei NUOVI POI da Wikimedia Commons → public/places/{id}.jpg
 *
 * A differenza di download-poi-images.mjs (che usa filename esatti), qui per ogni
 * POI si interroga l'API di ricerca di Commons con una query e si prende il primo
 * risultato immagine (jpg/png), scalato a 1200px. Le immagini di Commons sono
 * CC/PD → coerente con la scelta del progetto. Rilanciabile: salta i file già
 * presenti.
 *
 *   node scripts/fetch-new-poi-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../public/places');
const UA = 'CinaTour2026/1.0 (offline travel app; contact: federico.mos06@gmail.com)';
const DELAY_MS = 1200;
const WIDTH = 1200;

// id POI → query di ricerca su Wikimedia Commons (namespace File)
const QUERIES = {
  // Chengdu
  'wenshu-monastery': 'Wenshu Monastery Chengdu',
  'jinsha-museum': 'Jinsha Site Museum Chengdu',
  'dufu-cottage': 'Du Fu Thatched Cottage Chengdu',
  'leshan-buddha': 'Leshan Giant Buddha',
  dujiangyan: 'Dujiangyan irrigation system',
  'taikoo-li': 'Chunxi Road Chengdu',
  // Chongqing
  'dazu-carvings': '大足石刻',
  'three-gorges-museum': '中国三峡博物馆',
  'great-hall-cq': 'Great Hall of the People Chongqing',
  shibati: '重庆十八梯',
  'nanshan-tree': 'Chongqing night skyline Yuzhong',
  'arhat-temple': 'Luohan Temple Chongqing',
  // Zhangjiajie
  'bailong-elevator': 'Bailong Elevator Zhangjiajie',
  'tianzi-mountain': 'Tianzi Mountain Zhangjiajie',
  'baofeng-lake': 'Baofeng Lake Zhangjiajie',
  'huanglong-cave': 'Yellow Dragon Cave Zhangjiajie',
  'furong-town': 'Furong Town Hunan waterfall',
  // Pechino
  'tiananmen-square': 'Tiananmen Square Beijing',
  'jingshan-park': 'Jingshan Park Beijing view Forbidden City',
  'beihai-park': 'Beihai Park Beijing White Pagoda',
  nanluoguxiang: 'Nanluoguxiang Beijing hutong',
  houhai: 'Houhai Beijing lake',
  'olympic-park': 'Beijing National Stadium Birds Nest',
  'national-museum': 'National Museum of China Beijing',
  // Shanghai
  'nanjing-road': 'Nanjing Road Shanghai pedestrian night',
  'jingan-temple': "Jing'an Temple Shanghai",
  'oriental-pearl': 'Oriental Pearl Tower Shanghai',
  xintiandi: 'Xintiandi Shanghai',
  'shanghai-museum': 'Shanghai Museum People Square',
  zhujiajiao: 'Zhujiajiao water town',
  'wukang-road': 'Wukang Mansion Shanghai',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchImageThumb(query) {
  // generator=search nel namespace File (6), prende imageinfo con thumb scalato
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6',
      gsrlimit: '8',
      prop: 'imageinfo',
      iiprop: 'url|mime|size',
      iiurlwidth: String(WIDTH),
    });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;
  // ordina per indice di ricerca e scegli la prima foto jpg/png in orizzontale
  const cands = Object.values(pages)
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .map((p) => p.imageinfo?.[0])
    .filter(Boolean)
    .filter((ii) => /image\/(jpeg|png)/.test(ii.mime || ''));
  const landscape = cands.find((ii) => (ii.thumbwidth || 0) >= (ii.thumbheight || 0));
  const pick = landscape || cands[0];
  return pick?.thumburl || null;
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const ids = Object.keys(QUERIES);
  let ok = 0;
  const failed = [];
  for (const id of ids) {
    const dest = path.join(OUT, `${id}.jpg`);
    if (fs.existsSync(dest)) {
      console.log(`= ${id} già presente`);
      continue;
    }
    try {
      const thumb = await searchImageThumb(QUERIES[id]);
      if (!thumb) throw new Error('nessuna immagine trovata');
      const bytes = await download(thumb, dest);
      console.log(`✓ ${id}  (${(bytes / 1024).toFixed(0)} KB)`);
      ok++;
    } catch (e) {
      console.warn(`✗ ${id}: ${e.message}`);
      failed.push(id);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\nScaricate ${ok}/${ids.length}.`);
  if (failed.length) console.log('Da rivedere a mano:', failed.join(', '));
}

main().catch((e) => {
  console.error('fetch-new-poi-images fallito:', e.message);
  process.exit(1);
});
