// Stato rete + risorse offline installate (mappa, routing, frasi).

import { isOfflineAssetReady } from './offline-assets';

export const online = $state({
  network: typeof navigator !== 'undefined' ? navigator.onLine : true,
  mapTiles: false,
  routingTiles: false,
  phraseAudio: false,
  checked: false,
});

/** Ricontrolla la disponibilità degli asset offline (cache del SW). */
export async function refreshOfflineAssets(): Promise<void> {
  const [map, routing, phrases] = await Promise.all([
    isOfflineAssetReady('/tiles/cina.pmtiles'),
    isOfflineAssetReady('/tiles/routing/tilejson.json'),
    isOfflineAssetReady('/phrases/01-%E4%BD%A0%E5%A5%BD.m4a'),
  ]);
  online.mapTiles = map;
  online.routingTiles = routing;
  online.phraseAudio = phrases;
  online.checked = true;
}

if (typeof window !== 'undefined') {
  const sync = () => (online.network = navigator.onLine);
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);

  // La precache del SW può completarsi dopo il primo paint: ricontrolla quando
  // un nuovo SW prende il controllo, così i badge "offline pronto" si aggiornano.
  navigator.serviceWorker?.addEventListener?.('controllerchange', () => {
    void refreshOfflineAssets();
  });

  void refreshOfflineAssets();
}

export function isFullyOfflineReady(): boolean {
  return online.checked && online.mapTiles && online.routingTiles && online.phraseAudio;
}
