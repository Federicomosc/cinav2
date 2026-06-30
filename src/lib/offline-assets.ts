// Rileva se un asset offline è disponibile SENZA dipendere dalla rete.
//
// Il problema: le sonde con `fetch(..., { method: 'HEAD' })` NON vengono servite
// dalla cache del service worker (Workbox intercetta solo le GET). In modalità
// aereo (origine irraggiungibile) ogni HEAD dà ERR_CONNECTION_REFUSED → l'app
// concludeva, erroneamente, che mappa/routing/audio non fossero installati e
// ripiegava sui fallback remoti (mappa rotta offline).
//
// La fonte di verità per "è disponibile offline?" è la Cache API: se l'asset è
// in una cache (precache o runtime) è servibile offline, punto. Si interroga
// `caches.match` (zero rete). Solo in dev (nessun SW) si ricade su una sonda di
// rete, dove comunque l'origine è raggiungibile.

/** Vero se `url` è in una qualsiasi cache del SW (quindi servibile offline). */
export async function isAssetCached(url: string): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    // ignoreSearch: Workbox indicizza la precache con ?__WB_REVISION__=...
    const hit = await caches.match(url, { ignoreSearch: true });
    return !!hit;
  } catch {
    return false;
  }
}

/**
 * Vero se l'asset offline è pronto: prima la cache (offline-safe), poi — solo
 * se non c'è un SW attivo (dev) — una sonda di rete che esclude il fallback SPA.
 */
export async function isOfflineAssetReady(url: string): Promise<boolean> {
  if (await isAssetCached(url)) return true;

  // Nessun SW che controlla la pagina (es. dev): l'origine è online, sonda diretta.
  const noServiceWorker =
    typeof navigator === 'undefined' || !navigator.serviceWorker?.controller;
  if (noServiceWorker) {
    try {
      const r = await fetch(url, { method: 'HEAD' });
      const ct = r.headers.get('content-type') ?? '';
      return r.ok && !ct.includes('text/html');
    } catch {
      return false;
    }
  }
  return false;
}
