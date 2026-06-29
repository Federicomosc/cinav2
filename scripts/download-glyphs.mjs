#!/usr/bin/env node
/**
 * Scarica i glyph PBF per le etichette mappa (Noto Sans Regular/Bold).
 * Output: public/fonts/{fontstack}/{range}.pbf
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'fonts');
const BASE = 'https://protomaps.github.io/basemaps-assets/fonts';

const STACKS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
// Copertura latina + punteggiatura + numeri + estensioni comuni per nomi strade EN
const RANGES = [];
for (let i = 0; i <= 8448; i += 256) {
  RANGES.push(`${i}-${i + 255}`);
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  if (await exists(dest)) return 'skip';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  await mkdir(dirname(dest), { recursive: true });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return 'ok';
}

let ok = 0;
let skip = 0;
let fail = 0;

for (const stack of STACKS) {
  const enc = encodeURIComponent(stack);
  for (const range of RANGES) {
    const url = `${BASE}/${enc}/${range}.pbf`;
    const dest = join(OUT, stack, `${range}.pbf`);
    try {
      const r = await download(url, dest);
      if (r === 'ok') ok++;
      else skip++;
      process.stdout.write('.');
    } catch (e) {
      fail++;
      console.error(`\n✗ ${stack} ${range}: ${e.message}`);
    }
  }
}

console.log(`\nGlyph: ${ok} scaricati, ${skip} già presenti, ${fail} errori → ${OUT}`);
