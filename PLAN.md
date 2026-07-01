# Cina Tour 2026 · 中国之旅 — Piano di realizzazione (cinav2)

> App **standalone, offline-first** per il viaggio in Cina di un gruppo chiuso di 3–4 persone.
> Periodo reale: **30 Lug → 18 Ago 2026** (20 giorni). 5 tappe: Chengdu · Chongqing ·
> Zhangjiajie · Pechino · Shanghai.
>
> Fonti autoritative: `cina_tour_2026_progetto_v2.html` (cosa) e
> `cina_tour_2026_piano_tecnico.html` (come). Itinerario reale: `China Tour.xlsx`.
> Contenuto città: cartella `citta cina/` (5 guide HTML). Base di codice e asset:
> cartella `cinav1/` (PWA Svelte 5 già funzionante, ~80% della Fase 1).

---

## 0. Obiettivo e principi

L'app è un **compagno di viaggio offline al 100%**: tutto il contenuto (guida, itinerari,
mappe, frasario, logistica) è pre-caricato in Italia prima di partire; i dati personali
restano sul dispositivo. **Nessuna dipendenza da rete o cloud pubblico** — condizione
realistica dietro il Great Firewall e nelle zone montane (Zhangjiajie).

Principi guida (dal documento v2):
- **Offline-first reale**: l'app deve superare il test "modalità aereo per un giorno intero".
- **Privacy locale**: documenti sensibili cifrati lato client; niente backend obbligatorio.
- **Zero attrito sul campo**: la home ("Oggi") risponde alla domanda *cosa mi serve adesso?*
  senza navigare nei menu.
- **Onestà tecnica**: "cifrato" = AES-GCM client-side (forte quanto la password); tracking
  GPS continuo a schermo spento **non** affidabile su web → ridimensionato.

---

## 1. Analisi del progetto

### 1.1 Set di funzioni (dal documento v2.0)

| # | Funzione | Tipo dati | Fase |
|---|----------|-----------|------|
| ★ | **Tab "Oggi"** — home derivata da data+itinerario (dove sei, prossimo spostamento, agenda, scorciatoie) | derivata, 0 input | 1 |
| 1.a | **Hub documenti cifrato** + checklist condivisa | mutabile (cifrato) | 1 |
| 1.b | **Logistica/trasporti** — voli, treni, bus, pernottamenti in ordine cronologico | statico | 1 |
| 1.c | **Mappa offline** vettoriale WGS-84 + POI categorizzati + overlay tratte | asset + statico | 1 |
| 1.d | **Schede città + itinerari flessibili** (5–6 alternativi per città) | statico | 1 |
| 1.e | **Frasario cinese** it/pinyin/汉字 + "mostra al tassista" + preferiti | statico + mutabile | 1 |
| 1.f | **Utility da campo** — spese di gruppo (split) + convertitore CNY | mutabile | 1 |
| 1.g | **Emergenze & contatti** — numeri cinesi, rete consolare IT, schede mediche | statico + mutabile | 1 |
| 2.a | **Import foto** del gruppo (AirDrop/cartella → import) | mutabile | 2 |
| 2.b | **Smistamento spazio-temporale** (EXIF: data→città, GPS→posizione) | mutabile | 2 |
| 2.c | **Copertina generativa** (mappa + statistiche, stile Strava) | derivata | 2 |
| 2.d | **Recap a "stories"** (stile Spotify Wrapped) + Grand Recap finale | derivata | 2 |
| — | **Tracking GPS background continuo** + **export video pieno** | nativo | 3 |

**Rimosso rispetto alla v1**: la sincronizzazione P2P automatica via Wi-Fi Direct/BLE
(non realizzabile in modo affidabile). Sostituita da import foto manuale + smistamento auto.

### 1.2 Vincoli tecnici critici

- **GCJ-02**: la Cina impone uno sfasamento legale (50–500 m) tra GPS reale e mappe cinesi.
  → Si usa **esclusivamente OSM in WGS-84**, mai mischiata con basi cinesi. Tutte le coordinate
  nel DB sono WGS-84.
- **Background JS su iOS**: Safari sospende il JS a schermo spento → tracking GPS continuo
  solo in foreground (Fase 1/2) o con wrapper Capacitor (Fase 3).
- **TTS cinese offline**: inaffidabile nei browser → audio frasario opzionale (clip mp3 pre-bundlate).
- **Peso tile mappa**: da decine a 100+ MB a seconda di zoom/area → da misurare presto.

### 1.3 Itinerario reale (da `China Tour.xlsx`, confermato dal doc v2)

```
Chengdu      31 Lug – 1 Ago   (arrivo 31/07)
Chongqing     2 Ago – 4 Ago
Zhangjiajie   5 Ago – 7 Ago   (Wulingyuan + Tianmen)
Pechino       8 Ago – 12 Ago
Shanghai     13 Ago – 18 Ago  (+ gita Suzhou)
```

Voli (Air China):
- **CA446** MXP→TFU (Chengdu) — 30/07 ~13:00 → arrivo 31/07 ~05:40 locale. Andata.
- **CA8610** DYG (Zhangjiajie)→**PKX (Pechino-Daxing)** — 08/08 ~17:15 → ~19:40. Volo interno.
  ⚠️ Il doc v2 cita "DYG→PEK"; l'xlsx dice **PKX (Daxing)**, non PEK (Capital). Da confermare sul biglietto.
- **CA967** PVG (Shanghai)→MXP — 18/08 ~01:30 → ~08:05. Ritorno.

Treni AV (codici/orari **da inserire** dai biglietti reali — ora placeholder):
- Chengdu → Chongqing (giorno 3)
- Chongqing → Zhangjiajie (giorno 7)
- Pechino → Shanghai (giorno 15)

Pernottamenti: confermato **The Hidden House** (Chengdu, Taikoo Li). Hotel di Chongqing,
Zhangjiajie, Pechino, Shanghai **da inserire** (indirizzi anche in caratteri cinesi per il taxi).

### 1.4 Inventario asset già disponibili (riusabili)

Da **`cinav1/`** (PWA Svelte 5 + Vite + TS già buildante):
- Modello dati Dexie completo (`src/lib/db.ts`): Trip, Booking, Place, Day, ItineraryItem,
  Photo, Expense, Track, DocItem, Meta.
- ~60 schede POI con foto di riferimento in `public/places/*.jpg` (licenze CC/PD da Wikimedia).
- Mappa MapLibre funzionante con etichette in inglese + posizione live + **pre-download
  offline dei tile** via cache del service worker (9 aree, z9–14) — già verificato offline.
- Route optimization (TSP nearest-neighbor + 2-opt) in `geo.ts`, frasario base, scheda
  emergenze, "mostra indirizzo al tassista", export/import snapshot JSON.

Da **`citta cina/`**: 5 guide città ricche (storia, aneddoti, cibo, "un piano per i N giorni")
— ottimo testo sorgente per le schede città del doc 1.d.

Da **`China Tour.xlsx`**: itinerario reale 20 giorni, voli, hotel Chengdu, indirizzi/taxi.

---

## 2. Decisione architetturale chiave: come trattare cinav1

**Decisione presa: C — cinav2 da zero assoluto.** Codice e asset di `cinav1` non vengono
riusati. `cinav2` è un progetto nuovo che segue *alla lettera* l'architettura del piano
tecnico (contenuto statico in JSON bundlato + Dexie solo per lo stato mutabile), con la
massima pulizia possibile e nessun debito ereditato.

> **Precisazione importante.** "Da zero" riguarda il **codice e gli asset prodotti**: non
> si forka cinav1. I **fatti del viaggio** (itinerario reale, voli, hotel, lista POI, testi
> delle guide) restano presi dalle **fonti originali autoritative** — `China Tour.xlsx`,
> `citta cina/`, documento v2 — e ri-codificati puliti nei nuovi JSON. Va invece messo in
> conto, come lavoro di contenuto, **ri-procurare le foto dei POI** (in cinav1 erano ~60
> immagini CC/PD da Wikimedia): vanno riscaricate/verificate per licenza, non riprese da
> `cinav1/public/places/`.

---

## 3. Stack e architettura (decisi)

| Layer | Scelta | Note |
|-------|--------|------|
| Build | **Vite + `vite-plugin-pwa`** (Workbox) | dev veloce, precache app shell |
| Linguaggio | **TypeScript** | modelli dati tipizzati |
| UI | **Svelte 5** (runes) | reattività per molte schermate, `liveQuery` Dexie |
| Wrapper | **Capacitor (da subito)** | app installabile + GPS background ed export nativi disponibili da F0 |
| Storage mutabile | **Dexie (IndexedDB)** | foto, spese, checklist, preferiti, tracce, documenti cifrati |
| Contenuto statico | **JSON bundlato** in `src/data/` | itinerario, POI, città, frasario, logistica |
| Mappa | **MapLibre GL + PMTiles** | file unico `.pmtiles` (WGS-84) ritagliato sulle 5 città |
| Crypto | **Web Crypto** (AES-GCM + PBKDF2) | nessuna dipendenza esterna |
| EXIF | **exifr** | data + GPS dalle foto (Fase 2) |
| Grafica | **Canvas 2D** + CSS | infografiche/copertine + "stories" (Fase 2) |
| Audio frasario | **clip `.mp3` pre-registrate** | pronuncia frasi-chiave, bundlate in `public/phrases/` |

> **Capacitor da subito**: si imposta il wrapper in Fase 0. Le Fasi 1–2 restano scritte come
> web app (stessa codebase), ma GPS background continuo, share e filesystem nativi sono
> disponibili senza un porting successivo. Si può comunque servire anche come PWA installabile.

### 3.1 I tre piani dei dati (dal piano tecnico §02)

1. **Contenuto statico (read-only)** — guida città, POI, itinerari, frasario, logistica.
   JSON bundlato, versionato col deploy. Non cambia durante il viaggio.
2. **Stato utente (mutabile, locale)** — foto, tracce GPS, spese, checklist, preferiti,
   documenti cifrati. Vive in IndexedDB.
3. **Asset pesanti (cache)** — tile mappa + immagini città. Precaricati e serviti dal SW.

### 3.2 Struttura del progetto (target)

```
cinav2/
├─ public/
│  ├─ tiles/        cina.pmtiles      # opzione PMTiles (o cache SW dei tile)
│  ├─ styles/       osm-en.json       # stile mappa, etichette EN
│  ├─ places/       *.jpg             # immagini POI (portate da cinav1)
│  └─ phrases/      *.mp3             # audio frasario (opzionale)
├─ src/
│  ├─ data/         itinerario.json transport.json poi.json citta.json
│  │                frasi.json emergenze.json   # contenuto statico
│  ├─ db/           dexie.ts                     # schema stato mutabile
│  ├─ lib/          today.ts geo.ts crypto.ts exif.ts format.ts
│  ├─ routes/       Oggi Citta Mappa Frasario Documenti Spese Emergenze Album
│  ├─ components/   BottomNav AddressCard Modal …
│  └─ app.ts router.svelte.ts
├─ vite.config.ts                     # vite-plugin-pwa
└─ manifest.webmanifest
```

---

## 4. Modello dati

**Statico (JSON in `src/data/`):**
- `itinerario.json` — `{ trip:{start,end,members}, legs:[{city,from,to}] }` (spina dorsale della Tab Oggi)
- `transport.json` — voli/treni/bus `{id,type,code,from,to,datetime,...}`
- `poi.json` — `{id,city,name,category,lat,lng,price,stars,booking}`
- `citta.json` — testo guida, aneddoti, itinerari alternativi per città
- `frasi.json` — `{cat,it,pinyin,hanzi,showBig}`
- `emergenze.json` — numeri cinesi + rete consolare italiana

**Mutabile (Dexie):** Photo, Expense (con `splitWith`), ChecklistItem, Favorite, Track,
DocItem (cifrato), Meta (tasso CNY, profilo membri). Riusare le interfacce di `cinav1/src/lib/db.ts`.

---

## 5. Roadmap a fasi

### Fase 0 — Setup (~1 giorno) · ✅ COMPLETATA (28/06/2026)
- [x] Scaffold Vite + Svelte 5 + TS + Dexie + vite-plugin-pwa + router. *Build + type-check puliti.*
- [~] **Init Capacitor**: deps + `capacitor.config.ts` pronti. ⚠️ `npx cap add ios` richiede
      **Xcode** (qui c'è solo Command Line Tools); `cap add android` richiede Android Studio.
      Da completare quando i toolchain sono disponibili.
- [x] App shell + bottom nav (8 sezioni) + manifest + icona PWA. *Verificato a runtime.*
- [x] Tipi del contenuto statico + JSON in `src/data/` con **itinerario reale** (date, voli CA446/CA8610/CA967, tappe).
- [x] Viste con dati reali: **Oggi** (countdown→tappa→prossimo spostamento), **Città**, **Frasario**
      (3 livelli + "mostra al tassista"), **Emergenze**. Mappa/Documenti/Spese/Album = stub per fase.
- [~] **Pipeline PMTiles**: `scripts/build-pmtiles.sh` + `osm-en.json` predisposti con i bounding
      box delle 5 città. Esecuzione rinviata: richiede la CLI `pmtiles` + un build Protomaps (rete).

### Fase 1 — Il compagno di viaggio (~10–14 gg) · **non negoziabile, pronto il 30/07**
- [x] **Tab Oggi** (★): logica data→tappa, countdown, prossimo spostamento (→ Viaggio), scorciatoie,
      **agenda del giorno** (POI con prenotazione obbligatoria della tappa corrente). *Verificato.*
- [x] **Schede città + POI** (1.d): lista città → **dettaglio città** (intro, POI per categoria,
      itinerari navigabili, **guida ricca estratta da `citta cina/`** in `citta-content.json`) →
      **dettaglio POI** (categoria, 汉字, stelle, prezzo, prenotazione evidenziata, "mostra al
      tassista", link mappa). Marker mappa cliccabili → POI. *Verificato.* Resta: foto dei POI
      (immagini da ri-procurare, vedi §6).
- [x] **Viaggio/itinerario** (1.b): tab **Viaggio** = copia della pagina *Itinerary* di cinav1 —
      **mappa della Cina stilizzata** con le 5 città numerate + route animata, pillole città, e
      **timeline giorno-per-giorno** (`giorni.json`, 20 giorni) raggruppata per tappa; le attività
      linkano al dettaglio POI. *Verificato.* I voli/treni compaiono come attività del giorno; gli
      indirizzi hotel "al tassista" sono nel Frasario. Resta: dati reali treni/hotel (§6).
- [x] **Mappa** (1.c): MapLibre (lazy-load) + basemap **OpenFreeMap** (WGS-84, visibile, cachato) +
      **41 POI dalla guida** (`guida-cina-2026.html`) come marker con **icona-categoria + nome +
      bordo colorato per categoria**, **legenda**, nomi nascosti a zoom basso, marker → dettaglio POI,
      selettore città, overlay percorso, posizione live. *Verificato (41 marker + click).* Resta:
      `cina.pmtiles` per l'offline totale (§6) e affinare alcune coordinate (ristoranti/spettacoli
      sono approssimate).
- [x] **Frasario** (1.e): 3 livelli (it/pinyin/汉字) + "modalità tassista" + ricerca + **preferiti
      persistenti** (filtro ★) + **audio** (mp3 se presente, fallback TTS zh-CN) + **indirizzi alloggi
      in cinese**. *Verificato.* Resta solo: registrare/bundlare le clip `.mp3` (§6).
- [x] **Documenti cifrati** (1.a): AES-GCM/PBKDF2 + checklist pre-partenza. *Verificato: file salvato
      cifrato in IndexedDB (non in chiaro) e decifrato all'apertura.*
- [x] **Spese di gruppo** (1.f): CRUD + split + saldo "chi deve quanto a chi". *Verificato col calcolo.*
- [x] **Convertitore CNY** (1.f): tasso pre-caricato, conversione bidirezionale offline. *Verificato.*
- [x] **Emergenze & contatti** (1.g): numeri cinesi + rete consolare IT (da confermare) + **schede
      mediche personali** per membro (editabili, persistenti, etichette bilingui IT/汉字). *Verificato.*
- [x] **Test modalità aereo** (cruciale) · ✅ COMPLETATO (30/06/2026). Test E2E automatico
      ripetibile: `npm run test:offline` (`scripts/test-offline.mjs`, Playwright). Registra il
      service worker, scarica la precache, poi va **offline reale** (`context.setOffline`) e
      attraversa tutte le route. *Verificato: 11/11 route senza errori di rete; la mappa carica i
      tile dal pmtiles in cache (770 feature renderizzate offline).* Due bug offline trovati e corretti:
  - **Rilevamento asset via HEAD** (`online.svelte.ts`, `Mappa.svelte`, `routing.ts`): le sonde
    `fetch HEAD` non sono servite dalla cache del SW (Workbox cacha solo GET) → in modalità aereo
    l'app credeva mappa/routing/audio non installati e ripiegava sui fallback remoti. Sostituite con
    un check su `caches.match` (`src/lib/offline-assets.ts`).
  - **Byte serving pmtiles** (`src/lib/pmtiles-source.ts`): pmtiles legge l'archivio con richieste
    HTTP Range, ma la precache restituisce il 200 intero → mappa nera offline. Risolto con un Source
    custom che ritaglia i byte dal Blob già in cache (`Blob.slice`, niente 100 MB in RAM).
  - Pulizia: manifest precache deduplicato (3803→3569 voci, era doppio per `includeAssets`+`globPatterns`);
    `svelte-check` pulito (0 errori, 0 warning); supporto tastiera (Esc) sulle modali.

  > Resta da fare a ridosso della partenza: **un giorno intero reale** in modalità aereo sul telefono
  > (il test automatico copre l'app servita; il device prova anche eviction storage e installazione PWA).

- [x] **Robustezza ingegneristica** · ✅ COMPLETATA (01/07/2026), non legata a una singola funzione:
  - **Aggiornamento PWA non distruttivo**: `registerType` passato da `autoUpdate` a `prompt`
    (`vite.config.ts`) + `lib/pwa-update.svelte.ts` + `UpdateBanner.svelte`. Prima un update del
    service worker poteva ricaricare la pagina mentre si compilava una spesa o un documento
    cifrato, perdendo l'input non salvato; ora l'utente decide quando aggiornare.
  - **Promemoria di backup**: `exportBackup` (lib/backup.ts) scrive `lastBackupAt` in `meta`;
    `BackupReminder.svelte` avvisa se non è mai stato fatto o è più vecchio di 10 giorni, con
    link diretto a Documenti. *Verificato a runtime: appare senza backup, sparisce subito dopo
    un export riuscito.* Riguarda spese/documenti/checklist — non copre ancora le foto (Fase 2,
    escluse di proposito perché pesanti: da ripensare quando arriva l'import foto).
  - **Test automatici**: prima c'era solo `test:offline` (E2E). Aggiunto Vitest con test unitari
    su `spese.ts` (saldi/settle), `today.ts` (fase viaggio/countdown), `crypto.ts` (round-trip
    AES-GCM, verifier) e `format.ts` (date/valuta) — 27 test, `npm test`.
  - **CI minima**: `.github/workflows/ci.yml` esegue `check` + `test` + `build` su push/PR
    (il repo aveva un remote GitHub ma nessuna CI).
  - Bug trovato e corretto durante la verifica: il toggle tema (fixed, in alto a destra)
    intercettava i click sui pulsanti dei nuovi banner — risolto mettendo testo e azioni su
    righe separate in `UpdateBanner`/`BackupReminder`.
  - Non toccato di proposito (richiede una decisione, non solo codice): sincronizzazione
    multi-dispositivo per il gruppo (oggi solo export/import manuale) e lo split dei componenti
    più grandi (`Mappa.svelte` 2747 righe, `Logistica.svelte` 1418, `Documenti.svelte` 1399).

### Fase 2 — I ricordi (~6–9 gg) · alto impatto, client-side
- [ ] **Import foto** (2.a): selezione file (proprie + ricevute), lettura EXIF con `exifr`.
- [ ] **Smistamento spazio-temporale** (2.b): data→città (incrocio itinerario), GPS→posizione;
      album ad albero città→giorno, timeline condivisa.
- [ ] **Tracking GPS**: foreground subito; **background continuo via plugin Capacitor**
      (disponibile perché il wrapper esiste già da F0).
- [ ] **Copertina-infografica** su canvas (mappa + km/luoghi/velocità).
- [ ] **Recap a "stories"** (2.d): sequenza animata CSS/canvas per tappa + Grand Recap finale.

### Fase 3 — Rifinitura avanzata (incerta) · solo se avanza tempo
- [ ] **Export video pieno** del Grand Recap (ffmpeg.wasm o render nativo via Capacitor).
- [ ] Ottimizzazioni: lazy-load MapLibre, splash screen, eviction-resilience dei blob.

---

## 6. Contenuto da preparare (in Italia, prima di partire)

- [ ] Codici/orari reali dei 3 treni AV (dai biglietti).
- [ ] Hotel Chongqing/Zhangjiajie/Pechino/Shanghai: nome, indirizzo EN + 汉字, telefono.
- [ ] Foto QR dei biglietti (come immagini cifrate o nel repository).
- [ ] Contatti consolari italiani: confermare indirizzi/numeri sul sito Farnesina.
- [ ] Tasso EUR/CNY del momento (per il convertitore).
- [ ] Schede mediche di ogni membro (gruppo sanguigno, allergie, farmaci) anche in cinese.
- [ ] **Generare `cina.pmtiles`** ritagliato sulle 5 città e misurarne il peso.
- [ ] **Procurare/registrare le clip audio `.mp3`** del frasario (frasi-chiave).
- [ ] **Ri-procurare le foto dei POI** (licenze CC/PD): potranno sostituire le icone-emoji nei
      badge dei marker e popolare le pagine di dettaglio.
- [ ] **Affinare le coordinate dei POI**: alcune (ristoranti, spettacoli) sono approssimate.

---

## 7. Decisioni prese (confermate il 28/06/2026)

1. **Trattamento di cinav1** → **C, da zero assoluto** (nessun riuso di codice/asset; fatti del viaggio dalle fonti originali).
2. **Framework** → **Svelte 5** (default; non riaperto in fase di decisione).
3. **Mappa offline** → **PMTiles** (file unico, richiede pipeline di tooling).
4. **Audio frasario** → **Sì, clip mp3** pre-registrate per le frasi-chiave.
5. **PWA/Capacitor** → **Capacitor da subito** (wrapper impostato in Fase 0).
6. **Modello multi-dispositivo del gruppo** (01/07/2026) → **un telefono principale**, non
   un'app per persona. L'architettura (Dexie singolo, membri come nomi in `itinerario.json`
   e non account, cassaforte con un'unica password) presume che spese/checklist/documenti
   siano gestiti da UN dispositivo condiviso o da chi si occupa dell'organizzazione — non da
   4 istanze separate dell'app che divergerebbero senza che nessuno se ne accorga. Se un
   secondo telefono serve (backup, o qualcuno vuole una copia personale), il ponte è
   l'export/import cifrato di `lib/backup.ts`, ora condivisibile direttamente (AirDrop/
   WhatsApp/Telegram) tramite Web Share API quando il browser la supporta — vedi
   `BackupCard.svelte`. Non è stata costruita una sincronizzazione P2P automatica: già
   scartata per v1 (§1.1) come non realizzabile in modo affidabile, e resterebbe vera anche
   per v2.

---

## 8. Checklist Cina (a ridosso della partenza)

- **eSIM** da viaggio installata (non attivata) PRIMA di partire → instrada fuori dal firewall.
- **SIM di casa** mantenuta (le eSIM data-only non ricevono gli SMS di verifica Alipay/WeChat/12306).
- **App cinesi** affiancate (la PWA non le sostituisce): Alipay/WeChat, DiDi, Amap/Apple Maps, Trip.com/12306, Pleco.
- **Visto**: Italia visa-free ≤30 giorni fino al 31/12/2026 (passaporto valido 6+ mesi). Riverificare.
- **Contanti**: ~100 RMB di backup; la Cina è quasi totalmente cashless via QR.
```
