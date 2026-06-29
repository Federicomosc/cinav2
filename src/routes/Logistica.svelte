<script lang="ts">
  import { giorni, transports, itinerario, alloggi } from '../lib/content';
  import { go } from '../lib/router.svelte';
  import { actId } from '../lib/acts';
  import { shortDate, weekdayShort, hhmm } from '../lib/format';
  import { computeOggi } from '../lib/today';
  import { db, now } from '../db/dexie';
  import { liveQuery } from 'dexie';
  import type { CityId, Giorno, GiornoSchedule } from '../data/types';

  const SCHEDULE_SLOTS: { key: keyof GiornoSchedule; label: string }[] = [
    { key: 'mattino', label: 'Mattino' },
    { key: 'pranzo', label: 'Pranzo' },
    { key: 'pomeriggio', label: 'Pomeriggio' },
    { key: 'cena', label: 'Cena' },
    { key: 'sera', label: 'Sera' },
    { key: 'notte', label: 'Dormi a' },
  ];

  function scheduleEntries(day: Giorno) {
    if (!day.schedule) return [];
    return SCHEDULE_SLOTS.filter((s) => day.schedule![s.key]).map((s) => ({
      ...s,
      value: day.schedule![s.key]!,
    }));
  }

  const CITY: Record<string, { id?: CityId; color: string; hanzi: string; icon: string }> = {
    Chengdu: { id: 'chengdu', color: '#52b788', hanzi: '成都', icon: '🐼' },
    Chongqing: { id: 'chongqing', color: '#e05252', hanzi: '重庆', icon: '🌶️' },
    Zhangjiajie: { id: 'zhangjiajie', color: '#4fc3c7', hanzi: '张家界', icon: '⛰️' },
    Pechino: { id: 'pechino', color: '#e0b552', hanzi: '北京', icon: '🏯' },
    Shanghai: { id: 'shanghai', color: '#9b6fd4', hanzi: '上海', icon: '🌃' },
    'In viaggio': { color: '#8a7d6e', hanzi: '行', icon: '✈️' },
  };

  const oggi = computeOggi(itinerario, transports);
  const todayN = giorni.find((g) => g.date === oggi.todayIso)?.n ?? 1;
  const FOCUS_KEY = 'viaggio-focus';

  const clampDay = (n: number) => Math.min(Math.max(n, 1), 20);

  function readSavedFocus(): number {
    try {
      const s = sessionStorage.getItem(FOCUS_KEY);
      if (s) return clampDay(Number(s));
    } catch { /* ignore */ }
    return clampDay(todayN);
  }

  let focus = $state(readSavedFocus());
  let focusReady = $state(false);
  let chipRow: HTMLDivElement | undefined = $state();
  let checkedActs = $state<Set<string>>(new Set());

  // ripristina l'ultimo giorno visto
  $effect(() => {
    void db.meta.get(FOCUS_KEY).then((rec) => {
      const saved = rec?.value;
      if (typeof saved === 'number' && saved >= 1 && saved <= 20) {
        focus = saved;
        try { sessionStorage.setItem(FOCUS_KEY, String(saved)); } catch { /* ignore */ }
      }
      focusReady = true;
    });
  });

  // salva quando cambi giorno (dopo il ripristino iniziale)
  $effect(() => {
    if (!focusReady) return;
    const n = focus;
    try { sessionStorage.setItem(FOCUS_KEY, String(n)); } catch { /* ignore */ }
    void db.meta.put({ key: FOCUS_KEY, value: n });
  });

  $effect(() => {
    const sub = liveQuery(() => db.actChecks.toArray()).subscribe(
      (v) => (checkedActs = new Set(v.map((c) => c.id))),
    );
    return () => sub.unsubscribe();
  });


  async function toggleAct(dayN: number, label: string) {
    const id = actId(dayN, label);
    if (checkedActs.has(id)) await db.actChecks.delete(id);
    else await db.actChecks.put({ id, checkedAt: now() });
  }

  const day = $derived(giorni.find((g) => g.n === focus)!);
  const dayProgress = $derived(
    day.acts.length
      ? day.acts.filter((a) => checkedActs.has(actId(day.n, a.label))).length
      : 0,
  );
  const meta = $derived(CITY[day.city] ?? CITY['In viaggio']);
  const tr = $derived(transports.find((t) => t.departAt.slice(0, 10) === day.date));
  const hotel = $derived(meta.id ? alloggi.find((a) => a.city === meta.id) : undefined);
  const isToday = $derived(day.date === oggi.todayIso);
  const isFirstDayInCity = $derived(giorni.find((g) => g.city === day.city)?.n === day.n);
  const daySchedule = $derived(scheduleEntries(day));

  function prev() {
    if (focus > 1) focus = clampDay(focus - 1);
  }
  function next() {
    if (focus < 20) focus = clampDay(focus + 1);
  }

  function pick(n: number) {
    focus = clampDay(n);
  }

  // scroll chip attivo al centro
  $effect(() => {
    if (!focusReady || !chipRow) return;
    const el = chipRow.querySelector(`[data-n="${focus}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
</script>

<div class="agenda">
  <header class="top">
    <p class="eyebrow">Agenda · 20 giorni</p>
    <h1>Il viaggio</h1>
    <p class="hint">Un giorno alla volta — scorri i numeri o usa le frecce.</p>
  </header>

  <!-- Navigazione giorno -->
  <nav class="day-nav" aria-label="Navigazione giorni">
    <button class="nav-btn" onclick={prev} disabled={focus <= 1} aria-label="Giorno precedente">‹</button>

    <div class="day-chips" bind:this={chipRow}>
      {#each giorni as g (g.n)}
        {@const cm = CITY[g.city] ?? CITY['In viaggio']}
        {@const isT = g.date === oggi.todayIso}
        <button
          class="day-chip"
          class:on={focus === g.n}
          class:today={isT}
          data-n={g.n}
          style="--c:{cm.color}"
          onclick={() => pick(g.n)}
          aria-current={focus === g.n ? 'step' : undefined}
          aria-label="Giorno {g.n}, {shortDate(g.date)}"
        >
          <span class="day-chip-n">{g.n}</span>
          <span class="day-chip-dm">{shortDate(g.date)}</span>
          {#if isT}<span class="day-chip-dot" aria-hidden="true"></span>{/if}
        </button>
      {/each}
    </div>

    <button class="nav-btn" onclick={next} disabled={focus >= 20} aria-label="Giorno successivo">›</button>
  </nav>

  <!-- Scheda del giorno -->
  {#key focus}
    <article class="day-sheet" style="--c:{meta.color}">
      <div class="sheet-accent" aria-hidden="true"></div>

      <header class="sheet-head">
        <div class="sheet-meta">
          <span class="sheet-n">{weekdayShort(day.date)} · Giorno {day.n} · {shortDate(day.date)}</span>
          {#if isToday}<span class="sheet-today">Oggi</span>{/if}
        </div>
        <div class="sheet-city">
          <span class="city-icon" aria-hidden="true">{meta.icon}</span>
          <span>{day.city}</span>
          <span class="city-hanzi">{meta.hanzi}</span>
        </div>
        <h2 class="sheet-title">{day.title}</h2>
      </header>

      {#if tr}
        <div class="travel-banner">
          <span class="tb-ic" aria-hidden="true">{tr.type === 'flight' ? '✈' : tr.type === 'train' ? '🚄' : '🚌'}</span>
          <div>
            <b>{tr.code}</b> · {tr.from} → {tr.to}
            <span class="tb-time">
              {#if hhmm(tr.departAt)}{hhmm(tr.departAt)}{/if}
              {#if !tr.confirmed} · da prenotare{/if}
            </span>
          </div>
        </div>
      {/if}

      {#if daySchedule.length}
        <details class="schedule">
          <summary class="schedule-toggle">
            <span class="schedule-title">Orari giornata</span>
            <span class="schedule-hint">
              {daySchedule.find((s) => s.key === 'notte')?.value ?? daySchedule[daySchedule.length - 1].value}
            </span>
            <span class="schedule-chev" aria-hidden="true">▾</span>
          </summary>
          <div class="timeline">
            {#each daySchedule as slot (slot.key)}
              <div class="tl-row">
                <span class="tl-time">{slot.label}</span>
                <span class="tl-val">{slot.value}</span>
              </div>
            {/each}
          </div>
        </details>
      {/if}

      <section class="plan">
        <div class="plan-head">
          <h3 class="plan-label">Cosa facciamo</h3>
          {#if day.acts.length}
            <span class="plan-progress">{dayProgress}/{day.acts.length}</span>
          {/if}
        </div>
        {#if day.acts.length}
          <ul class="acts">
            {#each day.acts as act (act.label)}
              {@const aid = actId(day.n, act.label)}
              {@const done = checkedActs.has(aid)}
              <li class="act-row" class:done>
                <button
                  type="button"
                  class="act-check-btn"
                  aria-label={done ? 'Segna da fare' : 'Segna fatto'}
                  aria-pressed={done}
                  onclick={() => toggleAct(day.n, act.label)}
                >
                  <span class="act-check" class:on={done}>{#if done}✓{/if}</span>
                </button>
                {#if act.poi}
                  <button type="button" class="act act-poi" onclick={() => go('poi', act.poi!)}>
                    <span class="act-text">{act.label}</span>
                    <span class="act-go">›</span>
                  </button>
                {:else}
                  <div class="act act-plain">
                    <span class="act-text">{act.label}</span>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="free">Niente in programma — giornata libera.</p>
        {/if}
      </section>

      {#if hotel && isFirstDayInCity}
        <div class="hotel">
          <span aria-hidden="true">🏨</span>
          <span>{hotel.name}</span>
          {#if meta.id}
            <button class="hotel-link" onclick={() => go('citta', meta.id!)}>Guida ›</button>
          {/if}
        </div>
      {/if}

      <footer class="sheet-foot">
        <button class="foot-btn" onclick={prev} disabled={focus <= 1}>← Ieri</button>
        <span class="foot-count">{focus} / 20</span>
        <button class="foot-btn primary" onclick={next} disabled={focus >= 20}>Domani →</button>
      </footer>
    </article>
  {/key}

  <!-- Panoramica rapida (tutti i giorni, compatto) -->
  <details class="overview">
    <summary>Vedi tutti i 20 giorni</summary>
    <div class="ov-list">
      {#each giorni as g (g.n)}
        {@const cm = CITY[g.city] ?? CITY['In viaggio']}
        <button class="ov-row" style="--c:{cm.color}" onclick={() => pick(g.n)}>
          <span class="ov-n">{g.n}</span>
          <span class="ov-body">
            <span class="ov-title">{g.title}</span>
            <span class="ov-sub">{shortDate(g.date)} · {g.city}</span>
          </span>
          {#if g.acts[0]}<span class="ov-preview">{g.acts[0].label}</span>{/if}
        </button>
      {/each}
    </div>
  </details>
</div>

<style>
  .agenda { padding-bottom: 20px; }

  .top { margin-bottom: 18px; }
  h1 {
    font-size: 2rem;
    margin: 4px 0 6px;
    font-family: var(--serif);
  }
  .hint { font-size: 0.85rem; color: var(--ink-faint); }

  .schedule {
    margin-bottom: 16px;
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-xs);
    overflow: hidden;
  }
  .schedule-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    cursor: pointer;
    list-style: none;
  }
  .schedule-toggle::-webkit-details-marker { display: none; }
  .schedule-title {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    flex: none;
  }
  .schedule-hint {
    flex: 1;
    min-width: 0;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--ink-soft);
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .schedule-chev {
    flex: none;
    font-size: 0.75rem;
    color: var(--ink-faint);
    transition: transform 0.2s var(--ease);
  }
  .schedule[open] .schedule-chev { transform: rotate(180deg); }
  .schedule .timeline {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px 14px 12px;
    border-top: 1px solid var(--line);
  }
  .tl-row { display: flex; gap: 10px; font-size: 0.85rem; }
  .tl-time {
    flex: none;
    width: 76px;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint);
    padding-top: 2px;
  }
  .tl-val { color: var(--ink-soft); font-weight: 500; }

  /* Day nav */
  .day-nav {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 18px;
  }
  .nav-btn {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    font-size: 1.3rem;
    color: var(--ink-soft);
    display: grid;
    place-items: center;
    line-height: 1;
  }
  .nav-btn:disabled { opacity: 0.3; }
  .day-chips {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: nowrap;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 4px 2px;
  }
  .day-chips::-webkit-scrollbar { display: none; }
  .day-chip {
    position: relative;
    flex: none;
    min-width: 46px;
    padding: 6px 5px 7px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    transition: transform 0.15s, border-color 0.15s, background 0.15s;
  }
  .day-chip.on {
    background: var(--c);
    border-color: var(--c);
    transform: scale(1.06);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--c) 35%, transparent);
  }
  .day-chip.on .day-chip-n,
  .day-chip.on .day-chip-dm { color: #fff; }
  .day-chip.on .day-chip-n { font-weight: 700; }
  .day-chip.today:not(.on) { border-color: var(--cinabro); }
  .day-chip-n {
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    color: var(--ink-soft);
  }
  .day-chip-dm {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 500;
    letter-spacing: 0.02em;
    line-height: 1;
    color: var(--ink-faint);
    white-space: nowrap;
  }
  .day-chip-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--cinabro);
  }
  .day-chip.on .day-chip-dot { background: #fff; }

  /* Day sheet */
  .day-sheet {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 0 0 0 0;
    overflow: hidden;
    box-shadow: var(--shadow-md);
    animation: sheetIn 0.3s var(--ease) both;
  }
  @keyframes sheetIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  .sheet-accent {
    height: 5px;
    background: linear-gradient(90deg, var(--c), color-mix(in srgb, var(--c) 40%, var(--cinabro)));
  }
  .sheet-head { padding: 20px 20px 16px; }
  .sheet-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .sheet-n {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--c);
  }
  .sheet-today {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    background: var(--cinabro);
    padding: 3px 9px;
    border-radius: var(--radius-pill);
  }
  .sheet-city {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.88rem;
    color: var(--ink-soft);
    margin-bottom: 8px;
  }
  .city-icon { font-size: 1.1rem; }
  .city-hanzi { font-family: var(--hanzi); color: var(--c); margin-left: 2px; }
  .sheet-title {
    font-family: var(--serif);
    font-size: 1.55rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--ink);
  }

  .travel-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: 0 20px 16px;
    padding: 12px 14px;
    background: var(--cinabro-soft);
    border: 1px solid rgba(224, 74, 40, 0.25);
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
    color: var(--ink-soft);
  }
  .tb-ic { font-size: 1.3rem; flex: none; }
  .tb-time {
    display: block;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    margin-top: 3px;
  }

  .plan { padding: 0 20px 16px; }
  .plan-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .plan-label {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin: 0;
  }
  .plan-progress {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--c);
  }
  .acts { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .act-row {
    display: flex;
    align-items: stretch;
    gap: 0;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
  }
  .act-row.done { opacity: 0.72; }
  .act-check-btn {
    flex: none;
    display: grid;
    place-items: center;
    width: 48px;
    border-right: 1px solid var(--line);
    background: var(--surface);
  }
  .act-check {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    transition: background 0.15s, border-color 0.15s;
  }
  .act-check.on {
    background: var(--jade);
    border-color: var(--jade);
  }
  .act {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    text-align: left;
    padding: 14px 16px;
    font-size: 0.95rem;
    border: none;
    background: transparent;
  }
  .act-poi:active { background: color-mix(in srgb, var(--c) 8%, var(--paper-2)); }
  .act-row.done .act-text {
    text-decoration: line-through;
    color: var(--ink-faint);
  }
  .act-text { flex: 1; font-weight: 500; color: var(--ink); line-height: 1.35; }
  .act-go { color: var(--cinabro-bright); font-size: 1.2rem; flex: none; }
  .free {
    font-size: 0.9rem;
    color: var(--ink-faint);
    font-style: italic;
    padding: 8px 0;
  }

  .hotel {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 20px 16px;
    padding: 10px 14px;
    font-size: 0.85rem;
    color: var(--ink-soft);
    border-top: 1px solid var(--line);
    padding-top: 14px;
  }
  .hotel-link {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--jade-bright);
  }

  .sheet-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 16px;
    border-top: 1px solid var(--line);
    background: var(--paper-2);
  }
  .foot-btn {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-faint);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--surface);
  }
  .foot-btn.primary {
    color: #fff;
    background: var(--c);
    border-color: var(--c);
  }
  .foot-btn:disabled { opacity: 0.35; }
  .foot-count {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-faint);
  }

  /* Overview */
  .overview {
    margin-top: 24px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--surface);
  }
  .overview summary {
    padding: 14px 16px;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-soft);
    cursor: pointer;
    list-style: none;
  }
  .overview summary::-webkit-details-marker { display: none; }
  .ov-list { border-top: 1px solid var(--line); }
  .ov-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    border-left: 3px solid var(--c);
  }
  .ov-row:last-child { border-bottom: none; }
  .ov-n {
    font-family: var(--serif);
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--c);
    width: 28px;
    flex: none;
  }
  .ov-body { flex: 1; min-width: 0; }
  .ov-title {
    display: block;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ov-sub {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
  }
  .ov-preview {
    flex: none;
    max-width: 90px;
    font-size: 0.72rem;
    color: var(--ink-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
  }
</style>
