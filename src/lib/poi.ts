import type { PoiCategory } from '../data/types';

export const CAT_COLOR: Record<PoiCategory, string> = {
  storico: '#b08431',
  moderno: '#1f6b5c',
  natura: '#3f8f3a',
  intrattenimento: '#c0392b',
  cibo: '#d98c5f',
};

export const CAT_LABEL: Record<PoiCategory, string> = {
  storico: 'Storico',
  moderno: 'Moderno',
  natura: 'Natura',
  intrattenimento: 'Intrattenimento',
  cibo: 'Cibo',
};

// "immaginina" per categoria, usata come icona del marker sulla mappa
export const CAT_ICON: Record<PoiCategory, string> = {
  storico: '🏛️',
  moderno: '🏙️',
  natura: '🏞️',
  intrattenimento: '🎭',
  cibo: '🍜',
};

export function stars(n: number | undefined): string {
  if (!n) return '';
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}
