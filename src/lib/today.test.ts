import { describe, it, expect } from 'vitest';
import { computeOggi } from './today';
import type { Itinerario, Transport } from '../data/types';

const itinerario: Itinerario = {
  trip: { name: 'Cina 2026', start: '2026-07-30', end: '2026-08-18', members: ['A', 'B'], cnyPerEur: 8 },
  legs: [
    { city: 'chengdu', from: '2026-07-31', to: '2026-08-01' },
    { city: 'chongqing', from: '2026-08-02', to: '2026-08-04' },
    { city: 'shanghai', from: '2026-08-13', to: '2026-08-18' },
  ],
};

const transports: Transport[] = [
  { id: 't1', type: 'flight', code: 'CA446', from: 'MXP', to: 'TFU', departAt: '2026-07-30T13:00', confirmed: true },
  { id: 't2', type: 'train', code: 'AV1', from: 'chengdu', to: 'chongqing', departAt: '2026-08-02T09:00', confirmed: false },
];

describe('computeOggi', () => {
  it('è "before" prima della partenza, con countdown corretto', () => {
    const info = computeOggi(itinerario, transports, new Date(2026, 6, 25));
    expect(info.phase).toBe('before');
    expect(info.daysToStart).toBe(5);
    expect(info.leg).toBeUndefined();
  });

  it('è "during" con la tappa e il giorno corretti dentro una leg', () => {
    const info = computeOggi(itinerario, transports, new Date(2026, 7, 3));
    expect(info.phase).toBe('during');
    expect(info.leg?.city).toBe('chongqing');
    expect(info.dayInLeg).toBe(2);
    expect(info.legLength).toBe(3);
  });

  it('è "during" ma senza leg nei giorni di buco tra due tappe', () => {
    const info = computeOggi(itinerario, transports, new Date(2026, 7, 8));
    expect(info.phase).toBe('during');
    expect(info.leg).toBeUndefined();
  });

  it('è "after" dopo la fine del viaggio', () => {
    const info = computeOggi(itinerario, transports, new Date(2026, 7, 20));
    expect(info.phase).toBe('after');
  });

  it('trova il prossimo spostamento futuro più vicino', () => {
    const info = computeOggi(itinerario, transports, new Date(2026, 6, 30));
    expect(info.nextTransport?.code).toBe('CA446');
    expect(info.daysToNextTransport).toBe(0);
  });

  it('non propone spostamenti già passati', () => {
    const info = computeOggi(itinerario, transports, new Date(2026, 7, 3));
    expect(info.nextTransport).toBeUndefined();
  });
});
