const STORAGE_KEY = 'cinav2-night';

function readNight(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

/** true = tema scuro (notte), false = tema chiaro (giorno). */
export const theme = $state({ nightMode: readNight() });

function applyTheme(): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.dataset.theme = theme.nightMode ? 'night' : 'day';
  el.style.colorScheme = theme.nightMode ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.nightMode ? '#0c0907' : '#f5f0e8');
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme.nightMode ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function initTheme(): void {
  theme.nightMode = readNight();
  applyTheme();
}

export function toggleNightMode(): void {
  theme.nightMode = !theme.nightMode;
  persist();
  applyTheme();
}

export function setNightMode(on: boolean): void {
  theme.nightMode = on;
  persist();
  applyTheme();
}
