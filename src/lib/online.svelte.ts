// Stato rete + risorse offline installate (mappa, routing, frasi).

export const online = $state({
  network: typeof navigator !== 'undefined' ? navigator.onLine : true,
  mapTiles: false,
  routingTiles: false,
  phraseAudio: false,
  checked: false,
});

if (typeof window !== 'undefined') {
  const sync = () => (online.network = navigator.onLine);
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);

  void (async () => {
    const [map, routing, phrases] = await Promise.all([
      fetch('/tiles/cina.pmtiles', { method: 'HEAD' })
        .then((r) => {
          const ct = r.headers.get('content-type') ?? '';
          const len = Number(r.headers.get('content-length') ?? 0);
          return r.ok && !ct.includes('text/html') && (len === 0 || len > 10_000);
        })
        .catch(() => false),
      fetch('/tiles/routing/tilejson.json', { method: 'HEAD' }).then((r) => r.ok).catch(() => false),
      fetch('/phrases/01-%E4%BD%A0%E5%A5%BD.m4a', { method: 'HEAD' }).then((r) => r.ok).catch(() => false),
    ]);
    online.mapTiles = map;
    online.routingTiles = routing;
    online.phraseAudio = phrases;
    online.checked = true;
  })();
}

export function isFullyOfflineReady(): boolean {
  return online.checked && online.mapTiles && online.routingTiles && online.phraseAudio;
}
