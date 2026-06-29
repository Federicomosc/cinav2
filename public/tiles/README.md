# public/tiles/

File generati da `npm run tiles:all` (prima della partenza, con rete):

| File / cartella | Script | Uso |
|-----------------|--------|-----|
| `cina.pmtiles` | `npm run tiles` | Basemap vettoriale offline (5 città, WGS-84) |
| `routing/` | `npm run tiles:routing` | Tile stradali per percorsi pedonali offline |
| `../fonts/` | `npm run tiles:glyphs` | Etichette mappa (Noto Sans) |

I file sono **grandi** e non vanno in git (`.gitignore`). Dopo `npm run tiles:all`, esegui `npm run build`:
la PWA li precacha per l'uso in modalità aereo.

Lo stile mappa è generato in runtime da `src/lib/mapStyle.ts` (tema scuro Protomaps, etichette EN).
