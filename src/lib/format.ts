// Helper di formattazione data/ora/valuta. Tutto in italiano, nessuna dipendenza.

const DOW = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
const MON = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** "yyyy-mm-dd" locale (senza fuso) → Date a mezzanotte locale. */
export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Giorno ISO locale di una Date: "yyyy-mm-dd". */
export function toIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Differenza in giorni interi (b - a), sui soli giorni di calendario locali. */
export function daysBetween(aIso: string, bIso: string): number {
  const a = isoToDate(aIso).getTime();
  const b = isoToDate(bIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "SAB · 02 ago 2026" */
export function longDate(iso: string): string {
  const d = isoToDate(iso);
  return `${DOW[d.getDay()]} · ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}

/** "GIO" */
export function weekdayShort(iso: string): string {
  return DOW[isoToDate(iso).getDay()];
}

/** "02 ago" */
export function shortDate(iso: string): string {
  const d = isoToDate(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]}`;
}

/** "13:00" da una stringa ISO con orario. */
export function hhmm(isoDateTime: string): string {
  const m = isoDateTime.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

export function cny(amount: number): string {
  return `¥ ${amount.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;
}

export function eur(amount: number): string {
  return `€ ${amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
