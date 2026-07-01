<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import { db, uid, type ChecklistItem } from '../db/dexie';

  const DEFAULTS = [
    'eSIM installata (non attivata)',
    'SIM di casa mantenuta (per SMS verifica)',
    'Visto / visa-free verificato',
    'Passaporto valido 6+ mesi',
    'Foto passaporto + visto caricate (cifrate)',
    'QR dei biglietti salvati',
    'Assicurazione viaggio',
    '~100 RMB contanti di backup',
    'App cinesi installate (Alipay/WeChat/DiDi)',
  ];

  let checklist = $state<ChecklistItem[]>([]);
  const checklistVisible = $derived(checklist.filter((c) => !/modalità aereo/i.test(c.label)));
  const doneCount = $derived(checklistVisible.filter((c) => c.done).length);
  const chkPct = $derived(
    checklistVisible.length ? Math.round((doneCount / checklistVisible.length) * 100) : 0,
  );

  async function ensureChecklist() {
    if (await db.meta.get('checklist-seeded')) return;
    await db.checklist.bulkAdd(
      DEFAULTS.map((label, i) => ({ id: uid(), label, done: false, order: i })),
    );
    await db.meta.put({ key: 'checklist-seeded', value: true });
  }

  onMount(() => {
    void ensureChecklist();
    const sub = liveQuery(() => db.checklist.orderBy('order').toArray()).subscribe(
      (v) => (checklist = v),
    );
    return () => sub.unsubscribe();
  });
</script>

<section class="block">
  <div class="block-head">
    <h2 class="block-title">Checklist</h2>
    <span class="block-sub" class:done-chip={chkPct === 100 && checklistVisible.length > 0}>
      {#if chkPct === 100 && checklistVisible.length}
        Completa ✓
      {:else}
        {doneCount}/{checklistVisible.length}
      {/if}
    </span>
  </div>
  <div class="card panel-card">
    {#if checklistVisible.length}
      <div class="chk-bar" aria-hidden="true">
        <div class="chk-bar-fill" style="width: {chkPct}%"></div>
      </div>
    {/if}
    <ul class="chk-list">
      {#each checklistVisible as c (c.id)}
        <li class="chk-row" class:done={c.done}>
          <button
            type="button"
            class="chk-btn"
            onclick={() => db.checklist.update(c.id, { done: !c.done })}
          >
            <span class="chk-box" class:on={c.done}>{#if c.done}✓{/if}</span>
            <span class="chk-lbl">{c.label}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .block { margin-bottom: 22px; }
  .block-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
    padding-left: 2px;
  }
  .block-title {
    font-family: var(--serif);
    font-size: 1.12rem;
    font-weight: 600;
    color: var(--ink);
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }
  .block-title::before {
    content: '';
    width: 3px;
    height: 0.95em;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--cinabro-bright), var(--gold));
    box-shadow: 0 0 8px var(--cinabro-glow);
    flex: none;
  }
  .block-sub {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-faint);
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    padding: 3px 10px;
  }
  .block-sub.done-chip {
    color: var(--jade-bright);
    background: var(--jade-soft);
    border-color: color-mix(in srgb, var(--jade) 35%, transparent);
  }

  .panel-card { padding: 14px 16px 12px; overflow: hidden; }
  .chk-bar {
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--line);
    margin-bottom: 12px;
    overflow: hidden;
  }
  .chk-bar-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--jade), var(--jade-bright));
    transition: width 0.35s var(--ease);
    box-shadow: 0 0 10px var(--jade-soft);
  }
  .chk-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chk-row { border-radius: var(--radius-sm); overflow: hidden; }
  .chk-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    text-align: left;
    background: linear-gradient(155deg, var(--paper-2) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s var(--ease);
  }
  .chk-btn:active { transform: scale(0.995); }
  .chk-row.done { opacity: 0.72; }
  .chk-box {
    flex: none;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    border: 2px solid var(--line-strong);
    background: var(--paper-2);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    transition: background 0.15s, border-color 0.15s;
  }
  .chk-box.on {
    background: var(--jade);
    border-color: var(--jade);
    box-shadow: 0 2px 8px var(--jade-soft);
  }
  .chk-lbl {
    flex: 1;
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.4;
  }
  .chk-row.done .chk-lbl {
    text-decoration: line-through;
    color: var(--ink-faint);
  }
</style>
