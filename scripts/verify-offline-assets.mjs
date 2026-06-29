#!/usr/bin/env node
/**
 * Verifica che gli asset offline siano presenti prima del build/deploy.
 * Uso: node scripts/verify-offline-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');

const checks = [
  {
    name: 'Mappa offline',
    path: 'tiles/cina.pmtiles',
    minBytes: 10_000_000,
  },
  {
    name: 'Routing tilejson',
    path: 'tiles/routing/tilejson.json',
    minBytes: 100,
  },
  {
    name: 'Font Noto Sans Regular',
    path: 'fonts/Noto Sans Regular',
    minBytes: 1000,
  },
];

let ok = 0;
let fail = 0;

for (const c of checks) {
  const full = path.join(publicDir, c.path);
  try {
    const st = fs.statSync(full);
    if (st.size < c.minBytes) throw new Error(`troppo piccolo (${st.size} B)`);
    const mb = st.isFile() ? `${(st.size / 1024 / 1024).toFixed(1)} MB` : 'ok';
    console.log(`✓ ${c.name} — ${c.path} (${mb})`);
    ok++;
  } catch (e) {
    console.error(`✗ ${c.name} — ${c.path}: ${e.message}`);
    fail++;
  }
}

const phrasesDir = path.join(publicDir, 'phrases');
const phrases = fs.existsSync(phrasesDir)
  ? fs.readdirSync(phrasesDir).filter((f) => f.endsWith('.m4a'))
  : [];
const frasiJson = JSON.parse(fs.readFileSync(path.join(root, 'src/data/frasi.json'), 'utf8'));
const expectedPhrases = frasiJson.length;
const withAudio = frasiJson.filter((f) => f.audio).length;
if (phrases.length >= expectedPhrases) {
  console.log(`✓ Audio frasi — ${phrases.length}/${expectedPhrases} clip in public/phrases/`);
  ok++;
} else if (phrases.length >= withAudio) {
  console.log(`⚠ Audio frasi — ${phrases.length}/${expectedPhrases} clip (${expectedPhrases - phrases.length} nuove frasi senza audio). Esegui: npm run phrases:audio`);
  ok++;
} else {
  console.error(`✗ Audio frasi — trovate ${phrases.length}/${withAudio} con audio definito. Esegui: npm run phrases:audio`);
  fail++;
}

const routingDir = path.join(publicDir, 'tiles/routing');
const routingPbfs = fs.existsSync(routingDir)
  ? fs.readdirSync(routingDir, { recursive: true }).filter((f) => String(f).endsWith('.pbf')).length
  : 0;
if (routingPbfs >= 100) {
  console.log(`✓ Tile routing — ${routingPbfs} file .pbf`);
  ok++;
} else {
  console.error(`✗ Tile routing — solo ${routingPbfs} .pbf. Esegui: npm run tiles:routing`);
  fail++;
}

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(indexHtml)) {
  console.error('✗ Font UI — index.html usa ancora Google Fonts CDN');
  fail++;
} else if (!fs.existsSync(path.join(root, 'src/fonts.css'))) {
  console.error('✗ Font UI — manca src/fonts.css');
  fail++;
} else {
  const uiFonts = [
    '@fontsource/figtree',
    '@fontsource/cormorant-garamond',
    '@fontsource/ibm-plex-mono',
    '@fontsource/noto-serif-sc',
  ];
  const missing = uiFonts.filter((p) => !fs.existsSync(path.join(root, 'node_modules', p)));
  if (missing.length) {
    console.error(`✗ Font UI — pacchetti mancanti: ${missing.join(', ')}. Esegui: npm install`);
    fail++;
  } else {
    console.log('✓ Font UI — self-hosted (@fontsource, nessun CDN)');
    ok++;
  }
}

console.log(`\n${ok} ok, ${fail} mancanti`);
if (fail > 0) {
  console.log('\nPrepara tutto con: npm run offline:prepare');
  process.exit(1);
}
