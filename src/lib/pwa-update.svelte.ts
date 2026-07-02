// Aggiornamento PWA automatico (registerType: 'autoUpdate' in vite.config.ts).
// Alla comparsa di un nuovo service worker la pagina si ricarica da sé: niente
// banner. Senza onNeedRefresh il virtual module gestisce da solo update+reload.
import { registerSW } from 'virtual:pwa-register';

export const pwaUpdate = $state<{ needRefresh: boolean; offlineReady: boolean }>({
  needRefresh: false,
  offlineReady: false,
});

let apply: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function initPwaUpdate(): void {
  apply = registerSW({
    immediate: true,
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
