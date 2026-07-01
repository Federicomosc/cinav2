import { describe, it, expect } from 'vitest';
import { netBalances, settle } from './spese';
import type { Expense } from '../db/dexie';

function expense(partial: Partial<Expense>): Expense {
  return {
    id: crypto.randomUUID(),
    amount: 0,
    paidBy: '',
    splitWith: [],
    description: '',
    date: '2026-08-01',
    updatedAt: Date.now(),
    ...partial,
  };
}

describe('netBalances', () => {
  it('è zero per tutti se non ci sono spese', () => {
    const bal = netBalances([], ['A', 'B']);
    expect(bal.get('A')).toBe(0);
    expect(bal.get('B')).toBe(0);
  });

  it('mette chi paga in credito e chi condivide in debito, split equamente', () => {
    const bal = netBalances(
      [expense({ amount: 100, paidBy: 'A', splitWith: ['A', 'B'] })],
      ['A', 'B'],
    );
    expect(bal.get('A')).toBe(50);
    expect(bal.get('B')).toBe(-50);
  });

  it('senza splitWith esplicito divide tra tutti i membri', () => {
    const bal = netBalances([expense({ amount: 90, paidBy: 'A', splitWith: [] })], ['A', 'B', 'C']);
    expect(bal.get('A')).toBeCloseTo(60);
    expect(bal.get('B')).toBeCloseTo(-30);
    expect(bal.get('C')).toBeCloseTo(-30);
  });

  it('somma su più spese', () => {
    const bal = netBalances(
      [
        expense({ amount: 100, paidBy: 'A', splitWith: ['A', 'B'] }),
        expense({ amount: 40, paidBy: 'B', splitWith: ['A', 'B'] }),
      ],
      ['A', 'B'],
    );
    expect(bal.get('A')).toBeCloseTo(30);
    expect(bal.get('B')).toBeCloseTo(-30);
  });
});

describe('settle', () => {
  it('nessun trasferimento se i saldi sono a zero', () => {
    expect(settle(new Map([['A', 0], ['B', 0]]))).toEqual([]);
  });

  it('un solo trasferimento per un debito semplice tra due persone', () => {
    const out = settle(new Map([['A', -50], ['B', 50]]));
    expect(out).toEqual([{ from: 'A', to: 'B', amount: 50 }]);
  });

  it('il totale trasferito ripristina i saldi a zero (gruppo di 3)', () => {
    const bal = new Map([['A', 60], ['B', -30], ['C', -30]]);
    const out = settle(bal);
    // pagare riduce il debito di chi paga (+amount) e il credito di chi riceve (-amount).
    const netPaid = new Map<string, number>();
    for (const s of out) {
      netPaid.set(s.from, (netPaid.get(s.from) ?? 0) + s.amount);
      netPaid.set(s.to, (netPaid.get(s.to) ?? 0) - s.amount);
    }
    for (const [who, initial] of bal) {
      expect(initial + (netPaid.get(who) ?? 0)).toBeCloseTo(0);
    }
  });

  it('ignora scarti sotto 1 centesimo (arrotondamenti)', () => {
    expect(settle(new Map([['A', -0.005], ['B', 0.005]]))).toEqual([]);
  });
});
