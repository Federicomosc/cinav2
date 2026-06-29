#!/usr/bin/env node
/**
 * Scarica foto POI da Wikimedia Commons → public/places/{id}.jpg
 * Usa Special:FilePath (no API) per evitare rate limit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../public/places');
const UA = 'CinaTour2026/1.0 (offline travel app)';
const DELAY_MS = 2500;

/** id POI → titolo file esatto su Wikimedia Commons */
const IMAGES = {
  'panda-base': 'Grosser_Panda.JPG',
  jinli: 'Jinli Street - Chengdu, China - DSC05404.jpg',
  wuhou: 'Chengdu Wuhou ci.jpg',
  kuanzhai: 'Wide and Narrow Alleys, Chengdu (20240905).jpg',
  'renmin-park': 'Teahouse in Peoples Park - Chengdu, China - DSC05348.jpg',
  'opera-sichuan': 'Bian lian 1.jpg',
  'chen-mapo': 'Billyfoodmabodofu3.jpg',
  'bobo-hotpot-cd': 'Chengdu hot pot.jpg',

  hongya: 'Hongyadong night lights Chongqing.jpg',
  raffles: 'Raffles City Chongqing from Jiangbeizui.jpg',
  liziba: 'A train of Chongqing Rail Transit Line 2 coming through a residential building at Liziba.jpg',
  'cableway-cq': 'Chongqing Changjiang Cableway.jpg',
  ciqikou: 'Street scene in Ciqikou, Chongqing.JPG',
  'cruise-cq': '重慶 朝天門 Chaotianmen in Chongqing.jpg',
  'pei-jie': 'Concentric hot pot in Chongqing (20180217165607).jpg',
  xiaoyadong: 'Concentric hot pot in Chongqing (20180217165607).jpg',
  bayi: 'HK YMT 佐敦 Jordan 南京街 Nanking Street shop 蔡記 重慶小食 Chongqing Snack Food November 2022 Px3 02.jpg',

  'avatar-park': 'Zhangjiajie National Forest Park.jpg',
  tianmen: 'Zhangjiajie from Tianmen Mountain 01.jpg',
  'glass-bridge': 'Glass Bridge in Zhangjiajie China.jpg',
  foxfairy: 'Zhangjiajie from Tianmen Mountain 01.jpg',
  'charming-xiangxi': 'Wulingyuan, Zhangjiajie, Hunan, China - panoramio (3).jpg',
  sanxiaguo: '1 tianzishan wulingyuan zhangjiajie 2012.jpg',

  'forbidden-city': 'The Forbidden City - View from Coal Hill.jpg',
  mutianyu: 'Great Wall of China July 2006.JPG',
  'temple-heaven': 'Temple of Heaven, Beijing, China - 010 edit.jpg',
  'summer-palace': 'Longevity Hill of the Summer Palace.jpg',
  'lama-temple': 'Lama Temple Beijing China (2007) - panoramio.jpg',
  '798': 'Beijing 798 Art District.jpg',
  acrobats: 'Chinese Contortion Acrobatics.jpg',
  'siji-minfu': 'Bianyifang Serving.jpg',
  dadong: 'Peking duck wrap 1.jpg',

  bund: 'Bund at night.jpg',
  'yu-garden': 'Pond in Yuyuan Garden, Shanghai Old City.jpg',
  'shanghai-tower': 'Shanghai - Shanghai Tower - 0002.jpg',
  'french-concession': 'Tianzifang, Shanghai.jpg',
  'huangpu-cruise': 'Shanghai night view from Bund-China - panoramio.jpg',
  suzhou: "Humble Administrator's Garden Suzhou November 2017 005.jpg",
  era: 'Shanghai Circus World.jpg',
  nanxiang: 'Xiaolongbao.jpg',
  yangs: 'Shengjian mantou.jpg',
};

fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isImage(buf) {
  if (buf.length < 4) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true; // jpeg
  if (buf[0] === 0x89 && buf[1] === 0x50) return true; // png
  if (buf[0] === 0x47 && buf[1] === 0x49) return true; // gif
  return false;
}

function thumbUrl(filename) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=640`;
}

async function download(id, filename, force = false) {
  const dest = path.join(OUT, `${id}.jpg`);
  if (!force && fs.existsSync(dest)) {
    const existing = fs.readFileSync(dest);
    if (existing.length > 5000 && isImage(existing)) return 'skip';
  }
  const res = await fetch(thumbUrl(filename), {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!isImage(buf) || buf.length < 5000) throw new Error('not a valid image');
  fs.writeFileSync(dest, buf);
  return filename;
}

const only = process.argv.slice(2);
const entries = only.length
  ? Object.entries(IMAGES).filter(([id]) => only.includes(id))
  : Object.entries(IMAGES);
const force = process.argv.includes('--force');

let ok = 0;
let skip = 0;
let fail = 0;
const failed = [];

for (const [id, file] of entries) {
  try {
    const r = await download(id, file, force);
    if (r === 'skip') {
      console.log(`· ${id}.jpg (già ok)`);
      skip++;
    } else {
      console.log(`✓ ${id}.jpg ← ${r}`);
      ok++;
    }
  } catch (e) {
    console.warn(`✗ ${id}: ${e.message}`);
    failed.push(id);
    fail++;
  }
  await sleep(DELAY_MS);
}

const manifest = Object.fromEntries(
  fs
    .readdirSync(OUT)
    .filter((f) => f.endsWith('.jpg'))
    .map((f) => [f.replace(/\.jpg$/, ''), true]),
);
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\n${ok} scaricati, ${skip} saltati, ${fail} errori → ${OUT}`);
if (failed.length) console.log('Mancanti:', failed.join(', '));
