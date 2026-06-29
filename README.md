# Cina Tour 2026 · 中国之旅 (cinav2)

App **offline-first** (PWA + Capacitor) per il viaggio in Cina 30 Lug – 18 Ago 2026.
Costruita da zero secondo `../cina_tour_2026_progetto_v2.html` e
`../cina_tour_2026_piano_tecnico.html`. Roadmap completa: **[PLAN.md](PLAN.md)**.

## Stack

Svelte 5 · Vite · TypeScript · Dexie (IndexedDB) · MapLibre GL + PMTiles ·
vite-plugin-pwa (Workbox) · Capacitor · exifr · Web Crypto.

## Avvio

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build di produzione + service worker
npm run preview    # prova la build (con PWA attiva)
npm run check      # type-check (svelte-check + tsc)
npm run tiles:all   # mappa + font + routing offline (prima di partire, serve rete)
npm run tiles       # solo cina.pmtiles (~96 MB)
npm run tiles:glyphs
npm run tiles:routing
```

## Capacitor (app nativa)

Config in `capacitor.config.ts`. Le piattaforme native si aggiungono quando i toolchain
sono disponibili:

```bash
npm run build
npx cap add ios        # richiede Xcode (NON solo Command Line Tools)
npx cap add android    # richiede Android Studio / SDK
npx cap sync
```

## Struttura

```
src/
  data/        contenuto STATICO (JSON tipizzati): itinerario, transport, poi, citta,
               citta-content (guide), frasi, emergenze, alloggi
  db/          dexie.ts — STATO MUTABILE (foto, spese, checklist, documenti cifrati, schede mediche)
  lib/         router · today · format · content (loader) · crypto · spese · poi · speak
  routes/      Oggi · Citta · CittaDetail · PoiDetail · Logistica · Mappa · Frasario ·
               Documenti · Spese · Emergenze · Album
  components/  BottomNav · PageHeader · BigChars · Stub
public/
  tiles/       cina.pmtiles + routing/ (generati, non in git)
  fonts/       glyph mappa offline (Noto Sans)
  lib/mapStyle.ts  stile MapLibre dark offline
scripts/       build-pmtiles.sh · download-glyphs.mjs · download-routing-tiles.mjs
```

## Stato

**Fase 0 (scaffold)** ✅ · **Fase 1 (compagno di viaggio)** ✅ completa nel codice. **Tema scuro**
caldo (inchiostro + vermiglio). Navbar snella a 6 voci; Frasario, Valuta e Salute si aprono dalla Home.

- **Oggi** (Home): countdown/tappa/prossimo spostamento + agenda + scorciatoie (Frasario/Valuta/Salute/…)
- **Città → dettaglio città** (guida ricca) **→ dettaglio POI** (+ "mostra al tassista")
- **Viaggio**: itinerario con **mappa della Cina stilizzata** + città + timeline giorno-per-giorno
- **Mappa**: MapLibre + basemap OpenFreeMap (visibile, cachato) + POI + percorso + GPS
- **Frasario**: 3 livelli + tassista + preferiti + audio + indirizzi alloggi
- **Documenti** cifrati (AES-GCM) + checklist · **Spese** + split + convertitore · **Emergenze** + schede mediche

Da completare (contenuti/manuali, vedi PLAN.md §6): foto POI, file `cina.pmtiles` (offline totale),
codici treni e hotel reali, clip audio `.mp3`, test in modalità aereo. **Album** (Fase 2) è uno stub.
```
