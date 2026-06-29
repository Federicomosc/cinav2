<script lang="ts">
  import { liveQuery } from 'dexie';
  import PageHeader from '../components/PageHeader.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import { db, uid, now, type Expense } from '../db/dexie';
  import { itinerario } from '../lib/content';
  import { netBalances, settle } from '../lib/spese';
  import { cny, shortDate, toIsoDay } from '../lib/format';

  const members = itinerario.trip.members;
  const rate = itinerario.trip.cnyPerEur;

  let expenses = $state<Expense[]>([]);
  $effect(() => {
    const sub = liveQuery(() => db.expenses.orderBy('date').reverse().toArray()).subscribe(
      (v) => (expenses = v),
    );
    return () => sub.unsubscribe();
  });

  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  let amount = $state<number | null>(null);
  let paidBy = $state(members[0]);
  let split = $state<string[]>([...members]);
  let desc = $state('');
  let date = $state(toIsoDay(new Date()));

  function resetForm() {
    editingId = null;
    amount = null;
    desc = '';
    paidBy = members[0];
    split = [...members];
    date = toIsoDay(new Date());
    showForm = false;
  }

  function toggleSplit(m: string) {
    split = split.includes(m) ? split.filter((x) => x !== m) : [...split, m];
  }

  function startEdit(e: Expense) {
    editingId = e.id;
    amount = e.amount;
    paidBy = e.paidBy;
    split = [...e.splitWith];
    desc = e.description;
    date = e.date;
    showForm = true;
  }

  async function saveExpense() {
    if (!amount || amount <= 0 || split.length === 0) return;
    const payload = {
      amount,
      paidBy,
      splitWith: [...split],
      description: desc.trim() || 'Spesa',
      date,
      updatedAt: now(),
    };
    if (editingId) await db.expenses.update(editingId, payload);
    else await db.expenses.add({ id: uid(), ...payload });
    resetForm();
  }

  const balances = $derived(netBalances(expenses, members));
  const settlements = $derived(settle(balances));
  const total = $derived(expenses.reduce((s, e) => s + e.amount, 0));
  const maxBal = $derived(Math.max(...[...balances.values()].map((v) => Math.abs(v)), 1));

  let cnyVal = $state<number | null>(null);
  let eurVal = $state<number | null>(null);
  function fromCny() {
    eurVal = cnyVal == null ? null : Math.round((cnyVal / rate) * 100) / 100;
  }
  function fromEur() {
    cnyVal = eurVal == null ? null : Math.round(eurVal * rate * 100) / 100;
  }
</script>

<PageHeader eyebrow="¥ utility da campo" title="Spese & Valuta" sub="Converti al volo e tieni il saldo del gruppo." />

<section class="card conv accent-card">
  <div class="block-head conv-head">
    <h2 class="block-title">Convertitore</h2>
    <span class="block-sub">1€ ≈ {rate} ¥</span>
  </div>
  <div class="conv-row">
    <label>
      <span>¥ CNY</span>
      <input type="number" inputmode="decimal" bind:value={cnyVal} oninput={fromCny} placeholder="0" />
    </label>
    <span class="eq">⇄</span>
    <label>
      <span>€ EUR</span>
      <input type="number" inputmode="decimal" bind:value={eurVal} oninput={fromEur} placeholder="0" />
    </label>
  </div>
</section>

<section class="card">
  <div class="block-head">
    <h2 class="block-title">Saldo gruppo</h2>
    <span class="block-sub">{cny(total)}</span>
  </div>
  {#if expenses.length === 0}
    <EmptyState icon="¥" title="Nessuna spesa ancora" hint="Registra cene, taxi e acquisti per dividere al volo." />
  {:else}
    <div class="bal-list">
      {#each [...balances] as [m, v] (m)}
        <div class="bal-row">
          <div class="bal-top">
            <span class="bal-name">{m}</span>
            <b class:pos={v > 0.01} class:neg={v < -0.01}>
              {v > 0.01 ? '+' : ''}{cny(Math.round(v))}
            </b>
          </div>
          <div class="bal-bar" aria-hidden="true">
            <div
              class="bal-fill"
              class:pos={v > 0.01}
              class:neg={v < -0.01}
              style="width: {Math.round((Math.abs(v) / maxBal) * 100)}%"
            ></div>
          </div>
        </div>
      {/each}
    </div>
    {#if settlements.length}
      <div class="settle">
        <p class="settle-lbl">Chi paga chi</p>
        {#each settlements as s (s.from + s.to)}
          <div class="s-row"><b>{s.from}</b> → <b>{s.to}</b> <span>{cny(Math.round(s.amount))}</span></div>
        {/each}
      </div>
    {:else}
      <p class="muted small settle-ok">Tutti pari ✓</p>
    {/if}
  {/if}
</section>

<div class="add-bar">
  <h3 class="section-cat" style="margin:0">Movimenti</h3>
  <button class="add" onclick={() => (showForm ? resetForm() : (showForm = true))}>
    {showForm ? 'Annulla' : '+ Aggiungi'}
  </button>
</div>

{#if showForm}
  <section class="card form">
    <div class="form-title">{editingId ? 'Modifica spesa' : 'Nuova spesa'}</div>
    <div class="frow">
      <input type="number" inputmode="decimal" placeholder="Importo ¥" bind:value={amount} />
      <input type="date" bind:value={date} />
    </div>
    <input type="text" placeholder="Descrizione (es. Cena hotpot)" bind:value={desc} />
    <label class="fl">Pagato da
      <select bind:value={paidBy}>
        {#each members as m}<option value={m}>{m}</option>{/each}
      </select>
    </label>
    <div class="split">
      <span class="muted small">Dividi tra:</span>
      <div class="split-row">
        {#each members as m}
          <button type="button" class="chip" class:on={split.includes(m)} onclick={() => toggleSplit(m)}>{m}</button>
        {/each}
      </div>
    </div>
    <button class="save btn-primary" onclick={saveExpense}>{editingId ? 'Salva modifiche' : 'Salva spesa'}</button>
  </section>
{/if}

<div class="list">
  {#each expenses as e (e.id)}
    <div class="exp card-interactive">
      <div class="ex-main">
        <b>{e.description}</b>
        <span class="muted small">{shortDate(e.date)} · {e.paidBy} · ÷{e.splitWith.length}</span>
      </div>
      <span class="amt">{cny(e.amount)}</span>
      <button class="icon-btn" aria-label="Modifica" onclick={() => startEdit(e)}>✎</button>
      <button class="icon-btn del" aria-label="Elimina" onclick={() => db.expenses.delete(e.id)}>✕</button>
    </div>
  {/each}
</div>

<style>
  .small { font-size: 0.82rem; }
  .conv { margin-bottom: 14px; }
  .conv-head { margin-bottom: 4px; }
  .accent-card {
    border-color: color-mix(in srgb, var(--gold) 28%, var(--line-strong));
    background: linear-gradient(168deg, var(--surface-hi) 0%, var(--surface) 100%);
  }
  .conv-row { display: flex; align-items: flex-end; gap: 12px; margin-top: 10px; }
  .conv-row label { flex: 1; display: flex; flex-direction: column; gap: 5px; font-family: var(--mono); font-size: 10px; color: var(--ink-faint); letter-spacing: 0.04em; }
  .eq { font-family: var(--mono); font-size: 1.2rem; padding-bottom: 10px; color: var(--gold); }
  input, select { width: 100%; padding: 11px 14px; }
  section.card { margin-bottom: 14px; }
  .bal-list { display: flex; flex-direction: column; gap: 12px; margin-top: 6px; }
  .bal-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 6px; }
  .bal-name { font-weight: 500; }
  .bal-top b.pos { color: var(--jade-bright); }
  .bal-top b.neg { color: var(--cinabro-bright); }
  .bal-bar { height: 4px; border-radius: var(--radius-pill); background: var(--line); overflow: hidden; }
  .bal-fill { height: 100%; border-radius: inherit; background: var(--ink-faint); opacity: 0.5; }
  .bal-fill.pos { background: linear-gradient(90deg, var(--jade), var(--jade-bright)); opacity: 1; }
  .bal-fill.neg { background: linear-gradient(90deg, var(--cinabro), var(--cinabro-bright)); opacity: 1; }
  .settle { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
  .settle-lbl { font-family: var(--mono); font-size: 9px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 8px; }
  .settle-ok { margin-top: 10px; text-align: center; }
  .s-row { font-size: 0.9rem; display: flex; gap: 6px; align-items: baseline; margin-bottom: 4px; }
  .s-row span { margin-left: auto; font-family: var(--mono); font-weight: 500; }
  .add-bar { display: flex; justify-content: space-between; align-items: center; margin: 8px 0 12px; }
  .add { font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--jade-bright); padding: 8px 4px; min-height: 44px; }
  .form { display: flex; flex-direction: column; gap: 12px; }
  .form-title { font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); }
  .frow { display: flex; gap: 10px; }
  .fl { display: flex; flex-direction: column; gap: 5px; font-family: var(--mono); font-size: 10px; color: var(--ink-faint); }
  .split-row { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
  .chip {
    font-family: var(--mono);
    font-size: 11px;
    padding: 8px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink-faint);
  }
  .chip.on { background: var(--jade-soft); border-color: var(--jade); color: var(--jade-bright); }
  .list { display: flex; flex-direction: column; gap: 8px; }
  .exp {
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    box-shadow: var(--shadow-sm);
  }
  .ex-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .amt { font-family: var(--mono); font-weight: 600; font-size: 0.95rem; flex: none; }
  .icon-btn { color: var(--ink-faint); font-size: 14px; padding: 8px; min-width: 36px; min-height: 36px; opacity: 0.7; flex: none; }
  .icon-btn.del { opacity: 0.5; }
  .save { margin-top: 4px; }
</style>
