import { describe, it, expect } from 'vitest';
import { toIsoDay, daysBetween, isoToDate, hhmm, cny } from './format';

describe('toIsoDay / isoToDate', () => {
  it('round-trip su una data locale', () => {
    const d = new Date(2026, 6, 30); // 30 luglio 2026
    expect(toIsoDay(d)).toBe('2026-07-30');
    expect(toIsoDay(isoToDate('2026-07-30'))).toBe('2026-07-30');
  });
});

describe('daysBetween', () => {
  it('è la durata reale del viaggio', () => {
    expect(daysBetween('2026-07-30', '2026-08-18')).toBe(19);
  });

  it('è negativo quando la seconda data precede la prima', () => {
    expect(daysBetween('2026-08-05', '2026-08-01')).toBe(-4);
  });

  it('è zero sullo stesso giorno', () => {
    expect(daysBetween('2026-08-01', '2026-08-01')).toBe(0);
  });
});

describe('hhmm', () => {
  it('estrae ore:minuti da un datetime ISO', () => {
    expect(hhmm('2026-07-30T13:05')).toBe('13:05');
  });

  it('è vuoto senza orario', () => {
    expect(hhmm('2026-07-30')).toBe('');
  });
});

describe('cny', () => {
  // Niente numeri >= 1000 qui: il separatore delle migliaia di it-IT dipende
  // dai dati ICU disponibili nell'ambiente Node dei test, non solo dal browser.
  it('formatta senza decimali con il simbolo ¥', () => {
    expect(cny(50)).toBe('¥ 50');
  });

  it('arrotonda via i decimali', () => {
    expect(cny(12.7)).toBe('¥ 13');
  });
});
