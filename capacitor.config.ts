import type { CapacitorConfig } from '@capacitor/cli';

// Wrapper Capacitor impostato fin dalla Fase 0 (vedi PLAN.md §3, §5).
// `webDir` punta alla build di Vite. Le piattaforme native si aggiungono con
//   npx cap add ios      (richiede Xcode — non installato su questa macchina)
//   npx cap add android  (richiede Android Studio / SDK)
// e poi `npm run build && npx cap sync`.
const config: CapacitorConfig = {
  appId: 'com.cinatour.app',
  appName: 'Cina Tour 2026',
  webDir: 'dist',
  backgroundColor: '#f6f3ec',
};

export default config;
