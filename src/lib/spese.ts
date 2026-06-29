import type { Expense } from '../db/dexie';

// Saldo netto per membro: >0 = è in credito (ha anticipato), <0 = deve dare.
export function netBalances(expenses: Expense[], members: string[]): Map<string, number> {
  const bal = new Map<string, number>(members.map((m) => [m, 0]));
  for (const e of expenses) {
    const split = e.splitWith.length ? e.splitWith : members;
    const share = e.amount / split.length;
    bal.set(e.paidBy, (bal.get(e.paidBy) ?? 0) + e.amount);
    for (const m of split) bal.set(m, (bal.get(m) ?? 0) - share);
  }
  return bal;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

/** Minimizza i trasferimenti: chi deve dà a chi è in credito (greedy). */
export function settle(bal: Map<string, number>): Settlement[] {
  const debtors = [...bal.entries()].filter(([, v]) => v < -0.01).map(([m, v]) => ({ m, v }));
  const creditors = [...bal.entries()].filter(([, v]) => v > 0.01).map(([m, v]) => ({ m, v }));
  debtors.sort((a, b) => a.v - b.v); // più negativo prima
  creditors.sort((a, b) => b.v - a.v); // più positivo prima

  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(-debtors[i].v, creditors[j].v);
    out.push({ from: debtors[i].m, to: creditors[j].m, amount: pay });
    debtors[i].v += pay;
    creditors[j].v -= pay;
    if (Math.abs(debtors[i].v) < 0.01) i++;
    if (Math.abs(creditors[j].v) < 0.01) j++;
  }
  return out;
}
