#!/usr/bin/env node
/**
 * Test "modalità aereo": prova che l'app funzioni davvero offline.
 *
 * Cosa fa:
 *  1. serve `dist/` (vite preview) e apre l'app in Chromium (Playwright);
 *  2. online, registra il service worker e aspetta che la precache sia pronta
 *     (mappa pmtiles, glyph, tile routing, audio, app shell);
 *  3. passa OFFLINE (context.setOffline) e attraversa TUTTE le route;
 *  4. fallisce se: una richiesta di rete dell'app fallisce, una route logga un
 *     errore, oppure la mappa non carica i tile dal pmtiles in cache.
 *
 * Prerequisiti: `npm run build` (dist aggiornato) + Chromium di Playwright
 *   (una tantum, con rete): `npx playwright install chromium`.
 * Uso: `npm run test:offline`  (fa il build da solo se manca dist/sw.js)
 */
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4318;
const BASE = `http://localhost:${PORT}`;

// Route da verificare offline (hash router). Include i dettagli città/POI.
const ROUTES = [
  '/#/oggi',
  '/#/citta',
  '/#/citta/chengdu',
  '/#/poi/panda-base',
  '/#/logistica',
  '/#/mappa',
  '/#/frasario',
  '/#/documenti',
  '/#/spese',
  '/#/emergenze',
  '/#/album',
];

// Errori console innocui offline (ambiente di test senza GPS, ecc.).
const BENIGN = [
  /CoreLocation/i,
  /kCLError/i,
  /Geolocation/i,
  /user denied/i,
  /permission/i,
];

const log = (...a) => console.log(...a);
const ok = (m) => log(`  ✓ ${m}`);
const bad = (m) => log(`  ✗ ${m}`);

function ensureBuild() {
  if (!fs.existsSync(path.join(root, 'dist/sw.js'))) {
    log('dist/ mancante: eseguo npm run build…');
    const r = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}

async function waitServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(BASE + '/');
      if (r.ok) return;
    } catch {
      /* non ancora pronto */
    }
    await sleep(300);
  }
  throw new Error('server di preview non raggiungibile');
}

async function main() {
  ensureBuild();

  const server = spawn('npm', ['run', 'preview', '--', '--port', String(PORT)], {
    cwd: root,
    stdio: 'ignore',
  });

  const failures = [];
  let browser;
  try {
    await waitServer();
    browser = await chromium.launch();
    // Simula una posizione GPS reale (Chengdu) per verificare che il puntino
    // compaia sulla mappa OFFLINE: la geolocalizzazione è un'API del dispositivo,
    // non dipende dalla rete.
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 30.6571, longitude: 104.0657 },
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__E2E = true;
    });

    // --- Fase online: registra SW + popola la precache --------------------
    log('\n● Online: registro il service worker e scarico gli asset offline…');
    await page.goto(BASE + '/', { waitUntil: 'load' });

    const cachedTarget = [
      '/index.html',
      '/tiles/cina.pmtiles',
      '/tiles/routing/tilejson.json',
      '/fonts/Noto Sans Regular/0-255.pbf',
      '/phrases/01-%E4%BD%A0%E5%A5%BD.m4a',
    ];
    const deadline = Date.now() + 240000;
    let ready = false;
    let lastMissing = [];
    while (Date.now() < deadline) {
      const status = await page.evaluate(async (urls) => {
        const reg = await navigator.serviceWorker.getRegistration();
        const active = !!reg?.active;
        const missing = [];
        for (const u of urls) {
          if (!(await caches.match(u, { ignoreSearch: true }))) missing.push(u);
        }
        let total = 0;
        for (const n of await caches.keys()) total += (await (await caches.open(n)).keys()).length;
        return { active, missing, total };
      }, cachedTarget);
      lastMissing = status.missing;
      if (status.active && status.missing.length === 0) { ready = true; break; }
      process.stdout.write(`\r    …precache ${status.total} file, SW ${status.active ? 'attivo' : 'in install'}, mancano ${status.missing.length}   `);
      await sleep(1500);
    }
    process.stdout.write('\n');
    if (!ready) throw new Error(`precache non completata — mancano: ${lastMissing.join(', ')}`);
    ok('precache pronta (mappa, routing, glyph, audio, app shell)');

    // --- Passa OFFLINE ----------------------------------------------------
    log('\n● Offline (modalità aereo): attraverso tutte le route…');
    await context.setOffline(true);

    for (const route of ROUTES) {
      const errors = [];
      const failedReq = [];
      const onConsole = (msg) => {
        if (msg.type() === 'error') {
          const t = msg.text();
          if (!BENIGN.some((re) => re.test(t))) errors.push(t);
        }
      };
      const onFailed = (req) => {
        const u = req.url();
        if (u.startsWith(BASE) && !BENIGN.some((re) => re.test(u))) {
          failedReq.push(`${u} (${req.failure()?.errorText ?? '?'})`);
        }
      };
      page.on('console', onConsole);
      page.on('requestfailed', onFailed);

      await page.goto(BASE + route, { waitUntil: 'load' });
      await sleep(route.includes('mappa') ? 4000 : 800);

      // Controllo specifico mappa: i tile del pmtiles devono caricarsi dalla cache.
      if (route.includes('mappa')) {
        const mapOk = await page
          .waitForFunction(
            () => {
              const m = window.__cinaMap;
              return !!m && m.isSourceLoaded && m.isSourceLoaded('protomaps');
            },
            null,
            { timeout: 15000, polling: 500 },
          )
          .then(() => true)
          .catch(() => false);
        const features = await page.evaluate(() => {
          const m = window.__cinaMap;
          if (!m || !m.queryRenderedFeatures) return 0;
          return m.queryRenderedFeatures().length;
        });
        if (mapOk && features > 0) ok(`mappa: tile pmtiles caricati offline (${features} feature renderizzate)`);
        else { bad(`mappa: tile NON caricati offline (sourceLoaded=${mapOk}, feature=${features})`); failures.push('mappa tiles'); }

        // Posizione GPS (mockata): il puntino utente deve comparire OFFLINE.
        const dotOk = await page
          .waitForFunction(() => !!document.querySelector('.user-dot'), null, {
            timeout: 20000,
            polling: 500,
          })
          .then(() => true)
          .catch(() => false);
        const dotAt = await page.evaluate(() => {
          const m = window.__cinaMap;
          const md = m?._markers?.find?.((mk) => mk.getElement()?.className?.includes('user-dot'));
          const ll = md?.getLngLat?.();
          return ll ? { lng: +ll.lng.toFixed(4), lat: +ll.lat.toFixed(4) } : null;
        });
        if (dotOk) ok(`mappa: posizione GPS mostrata offline (puntino${dotAt ? ` a ${dotAt.lat},${dotAt.lng}` : ''})`);
        else { bad('mappa: posizione GPS NON mostrata offline'); failures.push('posizione GPS'); }
      }

      page.off('console', onConsole);
      page.off('requestfailed', onFailed);

      if (errors.length || failedReq.length) {
        bad(`${route}`);
        for (const e of errors) log(`      console: ${e}`);
        for (const f of failedReq) log(`      richiesta fallita: ${f}`);
        failures.push(route);
      } else {
        ok(`${route}`);
      }
    }
  } catch (e) {
    bad(`errore inatteso: ${e.message}`);
    failures.push(e.message);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }

  log('');
  if (failures.length) {
    log(`✗ OFFLINE TEST FALLITO — ${failures.length} problemi: ${failures.join(', ')}`);
    process.exit(1);
  }
  log('✓ OFFLINE TEST SUPERATO — l\'app funziona in modalità aereo.');
}

main();
