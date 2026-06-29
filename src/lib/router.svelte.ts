// Router hash con runes Svelte 5. Supporta tab principali (#/oggi) e dettagli
// con parametro (#/citta/chengdu, #/poi/panda-base).

export const tabs = [
  'oggi',
  'citta',
  'logistica',
  'mappa',
  'frasario',
  'documenti',
  'spese',
  'emergenze',
  'album',
] as const;

export type Tab = (typeof tabs)[number];

export interface NavState {
  seg: string;
  id?: string;
}

function parse(): NavState {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { seg: parts[0] ?? 'oggi', id: parts[1] ? decodeURIComponent(parts[1]) : undefined };
}

export const nav = $state<NavState>(parse());

/** -1 = indietro, 0 = neutro, 1 = avanti (per transizioni tab) */
export const navMotion = $state<{ dir: -1 | 0 | 1 }>({ dir: 0 });

const TAB_ORDER: Record<string, number> = {
  oggi: 0,
  citta: 1,
  logistica: 2,
  mappa: 3,
  album: 4,
  frasario: 0,
  documenti: 0,
  spese: 0,
  emergenze: 0,
};

function tabIndex(seg: string, id?: string): number {
  if (seg === 'poi') return 1;
  if (seg === 'citta' && id) return 1;
  return TAB_ORDER[seg] ?? 0;
}

window.addEventListener('hashchange', () => {
  const p = parse();
  nav.seg = p.seg;
  nav.id = p.id;
});

export function go(seg: string, id?: string): void {
  const prev = tabIndex(nav.seg, nav.id);
  const next = tabIndex(seg, id);
  navMotion.dir = next > prev ? 1 : next < prev ? -1 : 0;
  nav.seg = seg;
  nav.id = id;
  location.hash = '/' + seg + (id ? '/' + encodeURIComponent(id) : '');
  window.scrollTo(0, 0);
}

export function isTab(s: string): s is Tab {
  return (tabs as readonly string[]).includes(s);
}
