// Sorgente pmtiles offline-first.
//
// Problema: pmtiles legge l'archivio con richieste HTTP Range (byte serving).
// La precache del service worker restituisce però la risposta 200 INTERA senza
// onorare l'header Range: pmtiles vede un content-length che eccede il range
// richiesto e lancia "Server returned no content-length... HTTP Byte Serving",
// lasciando la mappa NERA in modalità aereo.
//
// Soluzione: invece di passare l'URL (che userebbe FetchSource → Range HTTP),
// si fornisce a pmtiles un Source che ritaglia i byte direttamente dalla
// risposta già in cache. `Blob.slice(offset, offset+length)` è backed dallo
// storage del SW: legge solo i byte richiesti, senza caricare i 100 MB in RAM.
// Se l'archivio non è in cache (es. primo avvio online), si ricade su
// FetchSource con richieste Range via rete.

import { FetchSource, type RangeResponse, type Source } from 'pmtiles';

export class CachedRangeSource implements Source {
  /** Chiave dell'archivio: DEVE combaciare con l'URL nello style (`pmtiles://<key>`)
   *  e con la voce in cache del SW (path relativo all'origine). */
  private readonly key: string;
  private readonly fallback: FetchSource;
  private blobPromise: Promise<Blob | null> | null = null;

  constructor(key: string) {
    this.key = key;
    this.fallback = new FetchSource(key);
  }

  getKey(): string {
    return this.key;
  }

  private cachedBlob(): Promise<Blob | null> {
    if (!this.blobPromise) {
      this.blobPromise = (async () => {
        if (typeof caches === 'undefined') return null;
        try {
          // ignoreSearch: Workbox indicizza con ?__WB_REVISION__=...
          const r = await caches.match(this.key, { ignoreSearch: true });
          if (!r || !r.ok) return null;
          return await r.blob();
        } catch {
          return null;
        }
      })();
    }
    return this.blobPromise;
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    const blob = await this.cachedBlob();
    if (blob && blob.size > 0) {
      const data = await blob.slice(offset, offset + length).arrayBuffer();
      return { data };
    }
    // Non in cache: richieste Range via rete (funziona solo online).
    return this.fallback.getBytes(offset, length, signal, etag);
  }
}
