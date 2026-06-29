#!/usr/bin/env node
/**
 * Genera clip audio offline per il frasario (voce Tingting, macOS).
 * Output: public/phrases/*.m4a + aggiorna audio in src/data/frasi.json
 */
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRASI_PATH = join(ROOT, 'src/data/frasi.json');
const OUT = join(ROOT, 'public/phrases');

function slug(hanzi) {
  return hanzi
    .replace(/[？?！!，,。.、\s]/g, '')
    .slice(0, 12)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase() || 'frase';
}

await mkdir(OUT, { recursive: true });
const frasi = JSON.parse(await readFile(FRASI_PATH, 'utf8'));

for (let i = 0; i < frasi.length; i++) {
  const f = frasi[i];
  const file = `${String(i + 1).padStart(2, '0')}-${slug(f.hanzi)}.m4a`;
  const aiff = join(OUT, '_tmp.aiff');
  const dest = join(OUT, file);
  const text = f.hanzi.replace(/"/g, '\\"');
  execSync(`say -v Tingting -o ${JSON.stringify(aiff)} ${JSON.stringify(f.hanzi)}`);
  execSync(`afconvert -f m4af -d aac ${JSON.stringify(aiff)} ${JSON.stringify(dest)}`);
  await unlink(aiff).catch(() => {});
  f.audio = file;
  process.stdout.write(`✓ ${file}  ${f.hanzi}\n`);
}

await writeFile(FRASI_PATH, JSON.stringify(frasi, null, 2) + '\n');
console.log(`\n${frasi.length} clip → ${OUT}`);
