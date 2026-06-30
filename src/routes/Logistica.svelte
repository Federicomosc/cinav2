<script lang="ts">
  import { giorni, transports, itinerario, alloggi } from '../lib/content';
  import { go } from '../lib/router.svelte';
  import { actId } from '../lib/acts';
  import { shortDate, weekdayShort, hhmm } from '../lib/format';
  import { computeOggi } from '../lib/today';
  import { db, now } from '../db/dexie';
  import { liveQuery } from 'dexie';
  import type { Giorno, GiornoSchedule } from '../data/types';
  import { cityThemeByItalianName, cityCoverSrc } from '../lib/city-theme';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { daySwipe } from '../lib/day-swipe';
  import { haptic } from '../lib/haptic';
  import ScreenHeader from '../components/ScreenHeader.svelte';
  import { showToast } from '../lib/toast.svelte';

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
  let swipeX = $state(0);
  let swiping = $state(false);
  let slideDir = $state(1);

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
    else {
      await db.actChecks.put({ id, checkedAt: now() });
      haptic(10);
      showToast('Attività completata');
    }
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
  const coverSrc = $derived(meta.id ? cityCoverSrc(meta.id) : '');
  const tripPct = $derived(Math.round((focus / 20) * 100));

  function goDay(delta: -1 | 1) {
    const n = clampDay(focus + delta);
    if (n === focus) return;
    slideDir = delta;
    focus = n;
    haptic(10);
  }

  function prev() {
    goDay(-1);
  }
  function next() {
    goDay(1);
  }

  function pick(n: number) {
    const clamped = clampDay(n);
    if (clamped === focus) return;
    slideDir = clamped > focus ? 1 : -1;
    haptic(8);
    focus = clamped;
  }

  function releaseSwipe(commit: 'next' | 'prev' | null) {
    if (commit) {
      slideDir = commit === 'next' ? 1 : -1;
      swiping = true;
      swipeX = 0;
      if (commit === 'next') next();
      else prev();
      requestAnimationFrame(() => {
        swiping = false;
      });
      return;
    }
    swiping = false;
    swipeX = 0;
  }

  // scroll chip attivo al centro
  $effect(() => {
    if (!focusReady || !chipRow) return;
    const el = chipRow.querySelector(`[data-n="${focus}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
</script>

<div class="agenda" style="--day-accent: {meta.accent}">
  <ScreenHeader
    seal="程"
    eyebrow="Agenda · 20 giorni"
    title="Il viaggio"
    sub="Scorri la scheda o i chip per navigare giorno per giorno."
  />

  <!-- Avanzamento viaggio -->
  <div class="trip-meter" aria-label="Giorno {focus} di 20, {tripPct}% del viaggio">
    <div class="trip-meter-head">
      <div class="trip-meter-title">
        <span class="trip-meter-city" style="--c:{meta.accent}">{meta.icon} {day.city}</span>
        <span class="trip-meter-lbl">Giorno {focus} di 20</span>
      </div>
      <span class="trip-meter-pct">{tripPct}%</span>
    </div>
    <div class="trip-meter-track">
      <div class="trip-meter-fill" style="width:{tripPct}%"></div>
    </div>
    <div class="trip-meter-dots" aria-hidden="true">
      {#each giorni as g (g.n)}
        {@const cm = CITY(g.city)}
        <button
          type="button"
          class="trip-dot"
          class:on={focus === g.n}
          class:today={g.date === oggi.todayIso}
          style="--c:{cm.accent}"
          onclick={() => pick(g.n)}
          aria-label="Giorno {g.n}"
        ></button>
      {/each}
    </div>
  </div>

  <!-- Selettore rapido -->
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

  <!-- Scheda del giorno (swipe) -->
  <div
    class="day-stage"
    class:swiping
    style="transform: translateX({swipeX}px)"
    use:daySwipe={{
      canNext: () => focus < 20,
      canPrev: () => focus > 1,
      onDrag: (dx) => {
        swiping = true;
        swipeX = dx;
      },
      onRelease: releaseSwipe,
    }}
  >
    <div class="swipe-hint" aria-hidden="true">
      <span class="swipe-arrow" class:off={focus <= 1}>‹</span>
      <span class="swipe-lbl">Scorri</span>
      <span class="swipe-arrow" class:off={focus >= 20}>›</span>
    </div>

    {#key focus}
      <article
        class="day-sheet"
        style="--c:{meta.accent}"
        in:fly={{ x: slideDir * 88, duration: 420, opacity: 0.96, easing: cubicOut }}
        out:fly={{ x: slideDir * -88, duration: 300, opacity: 0.92, easing: cubicOut }}
      >
      <div class="sheet-accent" aria-hidden="true"></div>

      <header class="sheet-head">
        <div class="sheet-cover-zone" class:has-img={!!coverSrc}>
          {#if coverSrc}
            <img class="sheet-cover" src={coverSrc} alt="" loading="lazy" decoding="async" />
          {:else}
            <div class="sheet-cover-fallback" aria-hidden="true"></div>
          {/if}
          <div class="sheet-scrim" aria-hidden="true"></div>
          <div class="sheet-accent-line" aria-hidden="true"></div>
          <span class="sheet-wm" aria-hidden="true">{meta.hanzi}</span>
          <span class="sheet-day-stamp">{String(day.n).padStart(2, '0')}</span>
          {#if isToday}<span class="sheet-today">Oggi</span>{/if}

          <div class="sheet-hero">
            <span class="sheet-n">{weekdayShort(day.date)} · Giorno {day.n} · {shortDate(day.date)}</span>
            <div class="sheet-city">
              <span class="city-icon" aria-hidden="true">{meta.icon}</span>
              <span class="city-name">{day.city}</span>
              <span class="city-hanzi">{meta.hanzi}</span>
            </div>
            <h2 class="sheet-title">{day.title}</h2>
          </div>
        </div>
      </header>

      {#if tr}
        <div class="travel-banner" class:unconfirmed={!tr.confirmed}>
          <span class="tb-ic" aria-hidden="true">{tr.type === 'flight' ? '✈' : tr.type === 'train' ? '🚄' : '🚌'}</span>
          <div class="tb-body">
            <span class="tb-type">{tr.type === 'flight' ? 'Volo' : tr.type === 'train' ? 'Treno' : 'Bus'}</span>
            <b class="tb-code">{tr.code}</b>
            <span class="tb-route">{tr.from} → {tr.to}</span>
            <span class="tb-time">
              {#if hhmm(tr.departAt)}{hhmm(tr.departAt)}{/if}
              {#if !tr.confirmed}<span class="tb-warn"> · da prenotare</span>{/if}
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
          <span class="hotel-ic" aria-hidden="true">🏨</span>
          <div class="hotel-body">
            <span class="hotel-lbl">Alloggio</span>
            <span class="hotel-name">{hotel.name}</span>
          </div>
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
  </div>

  <!-- Panoramica rapida (tutti i giorni, compatto) -->
  <details class="overview">
    <summary>
      <span class="ov-sum-label">Panoramica</span>
      <span class="ov-sum-sub">Tutti i 20 giorni</span>
      <span class="ov-chev" aria-hidden="true">›</span>
    </summary>
    <div class="ov-list">
      {#each giorni as g (g.n)}
        {@const cm = CITY(g.city)}
        <button
          class="ov-row"
          class:on={focus === g.n}
          class:today={g.date === oggi.todayIso}
          style="--c:{cm.accent}"
          onclick={() => pick(g.n)}
        >
          <span class="ov-n">{String(g.n).padStart(2, '0')}</span>
          <span class="ov-body">
            <span class="ov-title">{g.title}</span>
            <span class="ov-sub">{shortDate(g.date)} · {cm.icon} {g.city}</span>
          </span>
          {#if g.acts[0]}<span class="ov-preview">{g.acts[0].label}</span>{/if}
          <span class="ov-go" aria-hidden="true">›</span>
        </button>
      {/each}
    </div>
  </details>
</div>

<style>
  .agenda { padding-bottom: 24px; }

  /* Trip meter */
  .trip-meter {
    margin-bottom: 14px;
    padding: 16px 18px 14px;
    background: color-mix(in srgb, var(--surface-elevated) 85%, transparent);
    backdrop-filter: saturate(1.4) blur(16px);
    -webkit-backdrop-filter: saturate(1.4) blur(16px);
    border: 1px solid color-mix(in srgb, var(--day-accent) 22%, var(--line-strong));
    border-radius: var(--radius-lg);
    box-shadow:
      var(--shadow-md),
      0 12px 32px color-mix(in srgb, var(--day-accent) 8%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .trip-meter-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .trip-meter-title {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .trip-meter-city {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--c);
  }
  .trip-meter-lbl {
    font-family: var(--serif);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.01em;
  }
  .trip-meter-pct {
    flex: none;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--day-accent);
    letter-spacing: 0.06em;
    padding: 5px 10px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--day-accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--day-accent) 30%, var(--line));
  }
  .trip-meter-track {
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--line);
    overflow: hidden;
    margin-bottom: 14px;
  }
  .trip-meter-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--day-accent), var(--gold));
    box-shadow: 0 0 14px color-mix(in srgb, var(--day-accent) 45%, transparent);
    transition: width 0.45s var(--ease);
  }
  .trip-meter-dots {
    display: flex;
    gap: 3px;
    justify-content: space-between;
  }
  .trip-dot {
    flex: 1;
    height: 7px;
    min-width: 0;
    padding: 0;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--line-strong);
    transition: background 0.2s, transform 0.2s var(--ease), box-shadow 0.2s;
  }
  .trip-dot.on {
    background: var(--c, var(--cinabro));
    transform: scaleY(1.4);
    box-shadow: 0 0 12px color-mix(in srgb, var(--c, var(--cinabro)) 50%, transparent);
  }
  .trip-dot.today:not(.on) {
    background: color-mix(in srgb, var(--cinabro) 55%, var(--line-strong));
    box-shadow: 0 0 6px var(--cinabro-glow);
  }

  /* Swipe stage */
  .day-stage {
    position: relative;
    touch-action: pan-y;
    transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }
  .day-stage.swiping {
    transition: none;
  }
  .swipe-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin-bottom: 10px;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-faint);
    opacity: 0.85;
  }
  .swipe-lbl {
    padding: 5px 14px;
    border-radius: var(--radius-pill);
    border: 1px solid color-mix(in srgb, var(--day-accent) 25%, var(--line-strong));
    background: color-mix(in srgb, var(--day-accent) 6%, var(--surface));
    color: var(--ink-soft);
  }
  .swipe-arrow {
    font-size: 1rem;
    line-height: 1;
    color: var(--day-accent);
    transition: opacity 0.2s;
  }
  .swipe-arrow.off { opacity: 0.2; }

  .schedule {
    margin: 16px 18px;
    background: color-mix(in srgb, var(--surface-elevated) 88%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid color-mix(in srgb, var(--c) 20%, var(--line-strong));
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.04);
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
    width: 1px;
    border-radius: 1px;
    background: linear-gradient(
      180deg,
      var(--c),
      color-mix(in srgb, var(--c) 30%, var(--line-strong))
    );
    opacity: 0.65;
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
    left: -1px;
    top: 50%;
    transform: translateY(-50%);
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--c);
    box-shadow: 0 0 10px color-mix(in srgb, var(--c) 55%, transparent);
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
    margin-bottom: 16px;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--surface-elevated) 88%, transparent);
    backdrop-filter: saturate(1.4) blur(14px);
    -webkit-backdrop-filter: saturate(1.4) blur(14px);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .nav-btn {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--line-strong);
    font-size: 1.35rem;
    color: var(--ink-soft);
    display: grid;
    place-items: center;
    line-height: 1;
    transition: transform 0.15s var(--ease), border-color 0.15s, color 0.15s, box-shadow 0.15s;
    box-shadow: var(--shadow-sm);
  }
  .nav-btn:active:not(:disabled) {
    transform: scale(0.94);
    border-color: var(--day-accent);
    color: var(--ink);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--day-accent) 20%, transparent);
  }
  .nav-btn:disabled { opacity: 0.25; }
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
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--c) 28%, var(--line-strong));
    border-radius: var(--radius-lg);
    padding: 0;
    overflow: hidden;
    box-shadow:
      var(--shadow-lg),
      0 0 0 1px color-mix(in srgb, var(--c) 8%, transparent),
      0 28px 56px color-mix(in srgb, var(--c) 14%, transparent);
  }
  .sheet-accent {
    height: 4px;
    background: linear-gradient(
      90deg,
      var(--c),
      color-mix(in srgb, var(--c) 45%, var(--cinabro-bright)),
      color-mix(in srgb, var(--c) 15%, transparent)
    );
    box-shadow: 0 4px 20px color-mix(in srgb, var(--c) 40%, transparent);
  }
  .sheet-head { padding: 0; }
  .sheet-cover-zone {
    position: relative;
    height: 200px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .sheet-cover-zone:not(.has-img) .sheet-cover-fallback {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--c) 35%, var(--surface-hi)) 0%,
      var(--surface) 100%
    );
  }
  .sheet-cover {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(1.2) contrast(1.06);
    transform: scale(1.03);
  }
  .sheet-scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(125deg, color-mix(in srgb, #000 50%, transparent) 0%, transparent 42%),
      linear-gradient(180deg, transparent 0%, transparent 28%, color-mix(in srgb, #000 78%, transparent) 100%);
    pointer-events: none;
  }
  .sheet-accent-line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--c), color-mix(in srgb, var(--c) 30%, transparent) 80%, transparent);
    box-shadow: 0 -6px 20px color-mix(in srgb, var(--c) 45%, transparent);
    z-index: 3;
  }
  .sheet-wm {
    position: absolute;
    right: 6px;
    top: 2px;
    font-family: var(--hanzi);
    font-size: 5rem;
    font-weight: 600;
    line-height: 1;
    color: color-mix(in srgb, #fff 10%, var(--c));
    opacity: 0.7;
    pointer-events: none;
    user-select: none;
    z-index: 1;
  }
  .sheet-day-stamp {
    position: absolute;
    left: 14px;
    top: 14px;
    z-index: 4;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #fff;
    padding: 6px 11px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, #000 50%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }
  .sheet-today {
    position: absolute;
    right: 14px;
    top: 14px;
    z-index: 4;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #fff;
    background: linear-gradient(135deg, var(--cinabro-bright), var(--cinabro));
    padding: 5px 11px;
    border-radius: var(--radius-pill);
    box-shadow: 0 4px 14px var(--cinabro-glow);
  }
  .sheet-hero {
    position: relative;
    z-index: 3;
    padding: 16px 18px 20px;
  }
  .sheet-n {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.78);
    margin-bottom: 8px;
  }
  .sheet-city {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .city-icon {
    font-size: 1.2rem;
    filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.45));
  }
  .city-name {
    font-size: 0.92rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
  }
  .city-hanzi {
    font-family: var(--hanzi);
    font-size: 1.1rem;
    color: color-mix(in srgb, #fff 85%, var(--c));
    text-shadow: 0 1px 10px rgba(0, 0, 0, 0.35);
  }
  .sheet-title {
    font-family: var(--serif);
    font-size: 1.85rem;
    font-weight: 600;
    line-height: 1.12;
    color: #fff;
    letter-spacing: -0.02em;
    margin: 0;
    max-width: 95%;
    text-shadow: 0 2px 20px rgba(0, 0, 0, 0.55);
  }

  .travel-banner {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin: 16px 18px 0;
    padding: 14px 16px;
    background: color-mix(in srgb, var(--surface-elevated) 90%, transparent);
    backdrop-filter: saturate(1.3) blur(14px);
    -webkit-backdrop-filter: saturate(1.3) blur(14px);
    border: 1px solid color-mix(in srgb, var(--cinabro) 28%, var(--line-strong));
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    position: relative;
    z-index: 1;
  }
  .travel-banner.unconfirmed {
    border-color: color-mix(in srgb, var(--gold) 40%, var(--line-strong));
    background: linear-gradient(155deg, color-mix(in srgb, var(--gold) 8%, var(--surface)) 0%, var(--surface) 100%);
  }
  .tb-ic {
    flex: none;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    font-size: 1.25rem;
    background: color-mix(in srgb, var(--cinabro) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--cinabro) 28%, var(--line));
    border-radius: 12px;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--cinabro) 15%, transparent);
  }
  .tb-body { flex: 1; min-width: 0; }
  .tb-type {
    display: block;
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--cinabro-bright);
    margin-bottom: 4px;
  }
  .tb-code {
    display: block;
    font-family: var(--serif);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 2px;
  }
  .tb-route {
    display: block;
    font-size: 0.88rem;
    color: var(--ink-body);
    line-height: 1.4;
  }
  .tb-time {
    display: block;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    margin-top: 6px;
    letter-spacing: 0.03em;
  }
  .tb-warn { color: var(--gold); font-weight: 600; }

  .plan {
    padding: 18px 20px;
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
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--line-strong);
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    box-shadow: var(--shadow-sm);
    transition: border-color 0.15s, transform 0.15s var(--ease), box-shadow 0.15s;
  }
  .act-row:active {
    transform: scale(0.995);
    border-color: color-mix(in srgb, var(--c) 35%, var(--line-strong));
    box-shadow: var(--shadow-md);
  }
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
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 2px solid color-mix(in srgb, var(--c) 70%, var(--line-strong));
    background: color-mix(in srgb, var(--c) 10%, transparent);
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    transition: background 0.18s, border-color 0.18s, transform 0.15s var(--ease), box-shadow 0.18s;
  }
  .act-check.on {
    background: linear-gradient(135deg, var(--jade), #2d8a62);
    border-color: var(--jade);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--jade) 35%, transparent);
    transform: scale(1.06);
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
    flex: none;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    color: var(--c);
    font-size: 1.15rem;
    background: color-mix(in srgb, var(--c) 10%, transparent);
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--c) 25%, var(--line));
  }
  .free {
    font-size: 0.92rem;
    color: var(--ink-faint);
    font-style: italic;
    padding: 16px 18px;
    background: linear-gradient(155deg, color-mix(in srgb, var(--c) 5%, var(--paper-2)) 0%, var(--paper-2) 100%);
    border: 1px dashed color-mix(in srgb, var(--c) 30%, var(--line-strong));
    border-radius: var(--radius-md);
    text-align: center;
  }

  .hotel {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 0 18px 18px;
    padding: 14px 16px;
    background: color-mix(in srgb, var(--surface-elevated) 90%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid color-mix(in srgb, var(--jade) 28%, var(--line-strong));
    border-radius: var(--radius-md);
    position: relative;
    z-index: 1;
    box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .hotel-ic {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    font-size: 1.2rem;
    background: color-mix(in srgb, var(--jade) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--jade) 28%, var(--line));
    border-radius: 12px;
  }
  .hotel-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hotel-lbl {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--jade-bright);
  }
  .hotel-name {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.35;
  }
  .hotel-link {
    flex: none;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--jade-bright);
    padding: 7px 12px;
    border-radius: var(--radius-pill);
    background: var(--jade-soft);
    border: 1px solid color-mix(in srgb, var(--jade) 30%, transparent);
    box-shadow: 0 2px 10px color-mix(in srgb, var(--jade) 15%, transparent);
  }

  .sheet-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 16px;
    border-top: 1px solid var(--line);
    background: linear-gradient(180deg, color-mix(in srgb, var(--c) 4%, var(--paper-2)) 0%, var(--paper-2) 100%);
    position: relative;
    z-index: 1;
  }
  .foot-btn {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-faint);
    padding: 10px 14px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    transition: transform 0.15s var(--ease), border-color 0.15s, color 0.15s, box-shadow 0.15s;
  }
  .foot-btn:active:not(:disabled) { transform: scale(0.97); }
  .foot-btn.primary {
    color: #fff;
    background: linear-gradient(135deg, color-mix(in srgb, var(--c) 92%, #fff), var(--c));
    border-color: var(--c);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--c) 38%, transparent);
  }
  .foot-btn:disabled { opacity: 0.3; }
  .foot-count {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--c);
    letter-spacing: 0.06em;
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--c) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 25%, var(--line));
  }

  /* Overview */
  .overview {
    margin-top: 28px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: color-mix(in srgb, var(--surface-elevated) 88%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .overview summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 18px;
    cursor: pointer;
    list-style: none;
    transition: background 0.15s;
  }
  .overview summary:active { background: var(--paper-2); }
  .overview summary::-webkit-details-marker { display: none; }
  .ov-sum-label {
    font-family: var(--serif);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--ink);
  }
  .ov-sum-sub {
    flex: 1;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
    text-align: right;
  }
  .ov-chev {
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    font-size: 1.1rem;
    color: var(--cinabro-bright);
    background: color-mix(in srgb, var(--cinabro) 10%, transparent);
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--cinabro) 25%, var(--line));
    transition: transform 0.22s var(--ease);
  }
  .overview[open] .ov-chev { transform: rotate(90deg); }
  .ov-list {
    border-top: 1px solid var(--line);
    max-height: 360px;
    overflow-y: auto;
  }
  .ov-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 13px 16px;
    border-bottom: 1px solid var(--line);
    border-left: 4px solid color-mix(in srgb, var(--c) 50%, transparent);
    background: transparent;
    transition: background 0.15s, border-left-color 0.15s;
  }
  .ov-row.on {
    background: color-mix(in srgb, var(--c) 10%, var(--surface));
    border-left-color: var(--c);
  }
  .ov-row.today:not(.on) {
    border-left-color: color-mix(in srgb, var(--cinabro) 55%, var(--line));
  }
  .ov-row:active { background: color-mix(in srgb, var(--c) 12%, var(--surface)); }
  .ov-row:last-child { border-bottom: none; }
  .ov-n {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 700;
    color: var(--c);
    width: 28px;
    flex: none;
    line-height: 1;
    letter-spacing: 0.04em;
  }
  .ov-body { flex: 1; min-width: 0; }
  .ov-title {
    display: block;
    font-family: var(--serif);
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }
  .ov-sub {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--ink-faint);
    margin-top: 3px;
    display: block;
    letter-spacing: 0.03em;
  }
  .ov-preview {
    flex: none;
    max-width: 72px;
    font-size: 0.68rem;
    color: var(--ink-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
    font-style: italic;
  }
  .ov-go {
    flex: none;
    color: var(--c);
    font-size: 1.1rem;
    opacity: 0.7;
  }
</style>
