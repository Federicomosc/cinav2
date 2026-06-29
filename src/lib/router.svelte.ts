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
  'altro',
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

window.addEventListener('hashchange', () => {
  const p = parse();
  nav.seg = p.seg;
  nav.id = p.id;
});

export function go(seg: string, id?: string): void {
  location.hash = '/' + seg + (id ? '/' + encodeURIComponent(id) : '');
  window.scrollTo(0, 0);
}

export function isTab(s: string): s is Tab {
  return (tabs as readonly string[]).includes(s);
}
