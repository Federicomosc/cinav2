// Prepara gli asset OCR *offline* in public/ocr/ così Tesseract.js non deve
// mai scaricare nulla dalla rete (requisito: funziona dietro il Great Firewall
// e in modalità aereo). Copia il worker + il core wasm da node_modules e
// scarica il modello lingua cinese semplificato (variante "fast", leggera).
//
//   node scripts/setup-ocr.mjs
//
// Rilanciarlo dopo un aggiornamento di tesseract.js per riallineare gli asset.
import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const outDir = fileURLToPath(new URL('../public/ocr/', import.meta.url));

// Modello lingua: "fast" (~1–3 MB gz) — buon compromesso peso/qualità su device.
const LANG = 'chi_sim';
const LANG_URL = `https://tessdata.projectnaptha.com/4.0.0_fast/${LANG}.traineddata.gz`;

async function main() {
  await mkdir(outDir, { recursive: true });

  // 1. Worker script
  const workerSrc = require.resolve('tesseract.js/dist/worker.min.js');
  await copyFile(workerSrc, join(outDir, 'worker.min.js'));

  // 2. Core wasm — variante LSTM (motore usato da Tesseract 5+). Copiamo la
  //    build SIMD (device moderni) + il fallback non-SIMD.
  const coreDir = dirname(require.resolve('tesseract.js-core/package.json'));
  //    Tesseract sceglie a runtime la build migliore supportata dal browser
  //    (relaxed-SIMD > SIMD > base): le portiamo tutte così l'asset scelto
  //    c'è sempre, anche offline.
  const coreFiles = [
    'tesseract-core-relaxedsimd-lstm.wasm',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-lstm.wasm',
    'tesseract-core-lstm.wasm.js',
  ];
  for (const f of coreFiles) {
    await copyFile(join(coreDir, f), join(outDir, f));
  }

  // 3. Modello lingua (scarica solo se manca)
  const langOut = join(outDir, `${LANG}.traineddata.gz`);
  let haveLang = false;
  try {
    await access(langOut);
    haveLang = true;
  } catch {
    /* manca: scarica */
  }
  if (!haveLang) {
    process.stdout.write(`↓ scarico ${LANG}.traineddata.gz … `);
    const res = await fetch(LANG_URL);
    if (!res.ok) throw new Error(`download lingua fallito: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(langOut, buf);
    console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  } else {
    console.log(`= ${LANG}.traineddata.gz già presente`);
  }

  console.log('✓ asset OCR pronti in public/ocr/');
}

main().catch((e) => {
  console.error('setup-ocr fallito:', e.message);
  process.exit(1);
});
