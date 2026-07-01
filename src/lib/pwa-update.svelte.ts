// Aggiornamento PWA con gesto esplicito (registerType: 'prompt' in vite.config.ts).
// Il service worker nuovo resta in attesa finché l'utente non tocca "Aggiora":
// evita reload improvvisi che farebbero perdere un form non salvato sul campo.
import { registerSW } from 'virtual:pwa-register';

export const pwaUpdate = $state<{ needRefresh: boolean; offlineReady: boolean }>({
  needRefresh: false,
  offlineReady: false,
});

let apply: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function initPwaUpdate(): void {
  apply = registerSW({
    onNeedRefresh() {
      pwaUpdate.needRefresh = true;
    },
    onOfflineReady() {
      pwaUpdate.offlineReady = true;
    },
  });
}

export async function applyPwaUpdate(): Promise<void> {
  await apply?.(true);
}

export function dismissPwaUpdate(): void {
  pwaUpdate.needRefresh = false;
}
