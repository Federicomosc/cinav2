<script lang="ts">
  import { giorni, transports, itinerario, alloggi } from '../lib/content';
  import { go } from '../lib/router.svelte';
  import { actId } from '../lib/acts';
  import { shortDate, weekdayShort, hhmm } from '../lib/format';
  import { computeOggi } from '../lib/today';
  import { db, now } from '../db/dexie';
  import { liveQuery } from 'dexie';
  import type { Giorno, GiornoSchedule } from '../data/types';
  import { cityThemeByItalianName } from '../lib/city-theme';

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

  const CITY = (name: string) => cityThemeByItalianName(name);

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
  const meta = $derived(CITY(day.city));
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
    <div class="top-deco" aria-hidden="true">
      <span class="top-line"></span>
      <span class="top-seal">程</span>
      <span class="top-line"></span>
    </div>
    <p class="eyebrow">Agenda · 20 giorni</p>
    <h1>Il viaggio</h1>
    <p class="hint prose-lead">Un giorno alla volta — scorri i numeri o usa le frecce.</p>
  </header>

  <!-- Navigazione giorno -->
  <nav class="day-nav" aria-label="Navigazione giorni">
    <button class="nav-btn" onclick={prev} disabled={focus <= 1} aria-label="Giorno precedente">‹</button>

    <div class="day-chips" bind:this={chipRow}>
      {#each giorni as g (g.n)}
        {@const cm = CITY(g.city)}
        {@const isT = g.date === oggi.todayIso}
        <button
          class="day-chip"
          class:on={focus === g.n}
          class:today={isT}
          data-n={g.n}
          style="--c:{cm.accent}"
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
    <article class="day-sheet" style="--c:{meta.accent}">
      <div class="sheet-accent" aria-hidden="true"></div>

      <header class="sheet-head">
        <span class="sheet-wm" aria-hidden="true">{meta.hanzi}</span>
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
          <div class="plan-bar" aria-hidden="true">
            <div
              class="plan-bar-fill"
              style="width: {Math.round((dayProgress / day.acts.length) * 100)}%"
            ></div>
          </div>
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
    <summary>
      <span>Vedi tutti i 20 giorni</span>
      <span class="ov-chev" aria-hidden="true">▾</span>
    </summary>
    <div class="ov-list">
      {#each giorni as g (g.n)}
        {@const cm = CITY(g.city)}
        <button class="ov-row" style="--c:{cm.accent}" onclick={() => pick(g.n)}>
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

  .top { margin-bottom: 20px; }
  .top-deco {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .top-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--line-strong) 25%,
      color-mix(in srgb, var(--cinabro) 25%, transparent) 50%,
      var(--line-strong) 75%,
      transparent
    );
  }
  .top-seal {
    flex: none;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    font-family: var(--hanzi);
    font-size: 13px;
    font-weight: 600;
    color: var(--cinabro-bright);
    background: var(--cinabro-soft);
    border: 1px solid rgba(232, 72, 40, 0.28);
    border-radius: 6px;
    box-shadow: 0 0 14px var(--cinabro-glow);
  }
  h1 {
    font-size: 2.15rem;
    margin: 4px 0 8px;
    font-family: var(--serif);
    letter-spacing: -0.02em;
    background: linear-gradient(135deg, var(--ink) 0%, var(--ink-soft) 90%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hint {
    max-width: 34ch;
    font-size: 0.92rem;
  }

  .schedule {
    margin: 0 20px 16px;
    background: linear-gradient(160deg, var(--paper-2) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }
  .schedule-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 16px;
    cursor: pointer;
    list-style: none;
    transition: background 0.15s;
  }
  .schedule-toggle:active { background: color-mix(in srgb, var(--c) 6%, var(--surface)); }
  .schedule-toggle::-webkit-details-marker { display: none; }
  .schedule-title {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--c);
    flex: none;
  }
  .schedule-hint {
    flex: 1;
    min-width: 0;
    font-size: 0.86rem;
    font-weight: 500;
    color: var(--ink-body);
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .schedule-chev {
    flex: none;
    font-size: 0.75rem;
    color: var(--ink-faint);
    transition: transform 0.22s var(--ease);
  }
  .schedule[open] .schedule-chev { transform: rotate(180deg); }
  .schedule .timeline {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 4px 16px 14px 20px;
    border-top: 1px solid var(--line);
    position: relative;
  }
  .schedule .timeline::before {
    content: '';
    position: absolute;
    left: 27px;
    top: 12px;
    bottom: 14px;
    width: 2px;
    border-radius: 1px;
    background: linear-gradient(
      180deg,
      var(--c),
      color-mix(in srgb, var(--c) 30%, var(--line-strong))
    );
    opacity: 0.55;
  }
  .tl-row {
    display: flex;
    gap: 14px;
    font-size: 0.86rem;
    padding: 8px 0 8px 22px;
    position: relative;
  }
  .tl-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 8px color-mix(in srgb, var(--c) 50%, transparent);
    border: 2px solid var(--surface);
  }
  .tl-time {
    flex: none;
    width: 72px;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-faint);
    padding-top: 2px;
  }
  .tl-val { color: var(--ink-body); font-weight: 500; line-height: 1.4; }

  /* Day nav */
  .day-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding: 10px 12px;
    background: linear-gradient(160deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }
  .nav-btn {
    flex: none;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    font-size: 1.35rem;
    color: var(--ink-soft);
    display: grid;
    place-items: center;
    line-height: 1;
    transition: transform 0.15s var(--ease), border-color 0.15s, color 0.15s;
    box-shadow: var(--shadow-sm);
  }
  .nav-btn:active:not(:disabled) {
    transform: scale(0.94);
    border-color: var(--cinabro);
    color: var(--ink);
  }
  .nav-btn:disabled { opacity: 0.28; }
  .day-chips {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: nowrap;
    gap: 7px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 2px 4px;
    mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
  }
  .day-chips::-webkit-scrollbar { display: none; }
  .day-chip {
    position: relative;
    flex: none;
    min-width: 48px;
    padding: 7px 6px 8px;
    border-radius: 12px;
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    transition: transform 0.18s var(--ease), border-color 0.18s, background 0.18s, box-shadow 0.18s;
  }
  .day-chip:active { transform: scale(0.96); }
  .day-chip.on {
    background: linear-gradient(155deg, color-mix(in srgb, var(--c) 92%, #fff) 0%, var(--c) 100%);
    border-color: color-mix(in srgb, var(--c) 80%, #fff);
    box-shadow:
      0 4px 16px color-mix(in srgb, var(--c) 42%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
    transform: scale(1.04);
  }
  .day-chip.on .day-chip-n,
  .day-chip.on .day-chip-dm { color: #fff; }
  .day-chip.on .day-chip-n { font-weight: 700; }
  .day-chip.today:not(.on) {
    border-color: color-mix(in srgb, var(--cinabro) 55%, var(--line-strong));
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--cinabro) 20%, transparent);
  }
  .day-chip-n {
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
    color: var(--ink-soft);
  }
  .day-chip-dm {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 500;
    letter-spacing: 0.03em;
    line-height: 1;
    color: var(--ink-faint);
    white-space: nowrap;
  }
  .day-chip-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--cinabro);
    box-shadow: 0 0 8px var(--cinabro-glow);
  }
  .day-chip.on .day-chip-dot {
    background: #fff;
    box-shadow: none;
  }

  /* Day sheet */
  .day-sheet {
    position: relative;
    background: linear-gradient(
      168deg,
      color-mix(in srgb, var(--surface-hi) 85%, var(--c)) 0%,
      var(--surface) 38%,
      color-mix(in srgb, var(--surface) 94%, var(--paper)) 100%
    );
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 0;
    overflow: hidden;
    box-shadow:
      var(--shadow-md),
      0 0 48px color-mix(in srgb, var(--c) 14%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    animation: sheetIn 0.32s var(--ease) both;
  }
  .day-sheet::after {
    content: '';
    position: absolute;
    top: -40px;
    right: -40px;
    width: 160px;
    height: 160px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--c) 18%, transparent) 0%, transparent 70%);
    pointer-events: none;
  }
  @keyframes sheetIn {
    from { opacity: 0; transform: translateY(10px) scale(0.99); }
    to { opacity: 1; transform: none; }
  }
  .sheet-accent {
    height: 4px;
    background: linear-gradient(
      90deg,
      var(--c),
      color-mix(in srgb, var(--c) 50%, var(--cinabro-bright)),
      color-mix(in srgb, var(--c) 25%, transparent)
    );
  }
  .sheet-head {
    position: relative;
    padding: 22px 20px 18px;
    overflow: hidden;
  }
  .sheet-wm {
    position: absolute;
    right: 8px;
    top: 4px;
    font-family: var(--hanzi);
    font-size: 4.5rem;
    font-weight: 600;
    line-height: 1;
    color: color-mix(in srgb, var(--c) 10%, transparent);
    pointer-events: none;
    user-select: none;
  }
  .sheet-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    position: relative;
    z-index: 1;
  }
  .sheet-n {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--c);
  }
  .sheet-today {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #fff;
    background: linear-gradient(135deg, var(--cinabro-bright), var(--cinabro));
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    box-shadow: 0 2px 10px var(--cinabro-glow);
  }
  .sheet-city {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    color: var(--ink-body);
    margin-bottom: 10px;
    position: relative;
    z-index: 1;
  }
  .city-icon {
    font-size: 1.15rem;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
  }
  .city-hanzi {
    font-family: var(--hanzi);
    font-size: 1.1rem;
    color: var(--c);
    margin-left: 2px;
    text-shadow: 0 0 20px color-mix(in srgb, var(--c) 35%, transparent);
  }
  .sheet-title {
    font-family: var(--serif);
    font-size: 1.62rem;
    font-weight: 600;
    line-height: 1.18;
    color: var(--ink);
    letter-spacing: -0.015em;
    position: relative;
    z-index: 1;
    max-width: 85%;
  }

  .travel-banner {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin: 0 20px 16px;
    padding: 14px 16px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--cinabro) 14%, var(--paper-2)) 0%,
      var(--cinabro-soft) 100%
    );
    border: 1px solid rgba(232, 72, 40, 0.28);
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    color: var(--ink-body);
    box-shadow: var(--shadow-sm);
    position: relative;
    z-index: 1;
  }
  .travel-banner b { color: var(--ink); font-weight: 600; }
  .tb-ic {
    flex: none;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    font-size: 1.2rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
  }
  .tb-time {
    display: block;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    margin-top: 4px;
    letter-spacing: 0.02em;
  }

  .plan {
    padding: 0 20px 18px;
    position: relative;
    z-index: 1;
  }
  .plan-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .plan-label {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .plan-label::before {
    content: '';
    width: 3px;
    height: 0.9em;
    border-radius: 2px;
    background: var(--c);
    box-shadow: 0 0 8px color-mix(in srgb, var(--c) 45%, transparent);
  }
  .plan-progress {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 28%, transparent);
    border-radius: var(--radius-pill);
    padding: 3px 10px;
  }
  .plan-bar {
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--line);
    margin-bottom: 14px;
    overflow: hidden;
  }
  .plan-bar-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--c), var(--jade-bright));
    transition: width 0.35s var(--ease);
    box-shadow: 0 0 10px color-mix(in srgb, var(--c) 40%, transparent);
  }
  .acts { list-style: none; display: flex; flex-direction: column; gap: 9px; }
  .act-row {
    display: flex;
    align-items: stretch;
    gap: 0;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--line-strong);
    background: linear-gradient(155deg, var(--paper-2) 0%, var(--surface) 100%);
    box-shadow: var(--shadow-sm);
    transition: border-color 0.15s, transform 0.15s var(--ease);
  }
  .act-row:active { transform: scale(0.995); }
  .act-row.done { opacity: 0.68; }
  .act-check-btn {
    flex: none;
    display: grid;
    place-items: center;
    width: 50px;
    border-right: 1px solid var(--line);
    background: color-mix(in srgb, var(--c) 5%, var(--surface));
  }
  .act-check {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    border: 2px solid color-mix(in srgb, var(--c) 70%, var(--line-strong));
    background: color-mix(in srgb, var(--c) 10%, transparent);
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    transition: background 0.18s, border-color 0.18s, transform 0.15s var(--ease);
  }
  .act-check.on {
    background: var(--jade);
    border-color: var(--jade);
    box-shadow: 0 2px 8px var(--jade-soft);
    transform: scale(1.05);
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
  .act-poi:active { background: color-mix(in srgb, var(--c) 10%, var(--paper-2)); }
  .act-row.done .act-text {
    text-decoration: line-through;
    color: var(--ink-faint);
  }
  .act-text {
    flex: 1;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.4;
    letter-spacing: 0.01em;
  }
  .act-go {
    color: var(--c);
    font-size: 1.25rem;
    flex: none;
    opacity: 0.85;
  }
  .free {
    font-size: 0.92rem;
    color: var(--ink-faint);
    font-style: italic;
    padding: 10px 14px;
    background: var(--paper-2);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    text-align: center;
  }

  .hotel {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 20px 18px;
    padding: 12px 16px;
    font-size: 0.88rem;
    color: var(--ink-body);
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    position: relative;
    z-index: 1;
  }
  .hotel-link {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--jade-bright);
    padding: 4px 8px;
    border-radius: var(--radius-pill);
    background: var(--jade-soft);
    border: 1px solid color-mix(in srgb, var(--jade) 30%, transparent);
  }

  .sheet-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 16px;
    border-top: 1px solid var(--line);
    background: linear-gradient(180deg, var(--paper-2) 0%, color-mix(in srgb, var(--paper-2) 80%, var(--paper)) 100%);
    position: relative;
    z-index: 1;
  }
  .foot-btn {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-faint);
    padding: 9px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    transition: transform 0.15s var(--ease), border-color 0.15s, color 0.15s;
  }
  .foot-btn:active:not(:disabled) { transform: scale(0.97); }
  .foot-btn.primary {
    color: #fff;
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 90%, #fff), var(--c));
    border-color: var(--c);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--c) 35%, transparent);
  }
  .foot-btn:disabled { opacity: 0.32; }
  .foot-count {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-faint);
    letter-spacing: 0.04em;
  }

  /* Overview */
  .overview {
    margin-top: 26px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: linear-gradient(160deg, var(--surface-hi) 0%, var(--surface) 100%);
    box-shadow: var(--shadow-sm);
  }
  .overview summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 15px 18px;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--ink-soft);
    cursor: pointer;
    list-style: none;
    transition: background 0.15s, color 0.15s;
  }
  .overview summary:active { background: var(--paper-2); color: var(--ink); }
  .overview summary::-webkit-details-marker { display: none; }
  .ov-chev {
    font-size: 0.8rem;
    color: var(--ink-faint);
    transition: transform 0.22s var(--ease);
  }
  .overview[open] .ov-chev { transform: rotate(180deg); }
  .ov-list {
    border-top: 1px solid var(--line);
    max-height: 320px;
    overflow-y: auto;
  }
  .ov-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 13px 18px;
    border-bottom: 1px solid var(--line);
    border-left: 3px solid var(--c);
    background: transparent;
    transition: background 0.15s;
  }
  .ov-row:active { background: color-mix(in srgb, var(--c) 8%, var(--surface)); }
  .ov-row:last-child { border-bottom: none; }
  .ov-n {
    font-family: var(--serif);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--c);
    width: 30px;
    flex: none;
    line-height: 1;
  }
  .ov-body { flex: 1; min-width: 0; }
  .ov-title {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }
  .ov-sub {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    margin-top: 2px;
    display: block;
  }
  .ov-preview {
    flex: none;
    max-width: 88px;
    font-size: 0.7rem;
    color: var(--ink-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
    font-style: italic;
  }
</style>
