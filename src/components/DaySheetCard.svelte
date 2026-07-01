<script lang="ts">
  import { transports, alloggi, giorni } from '../lib/content';
  import { go } from '../lib/router.svelte';
  import { actId } from '../lib/acts';
  import { shortDate, weekdayShort, hhmm } from '../lib/format';
  import type { Giorno, GiornoSchedule } from '../data/types';
  import { cityThemeByItalianName, cityCoverSrc } from '../lib/city-theme';
  import { cubicOut } from 'svelte/easing';

  interface Props {
    day: Giorno;
    focus: number;
    todayIso: string;
    slideDir: number;
    checkedActs: Set<string>;
    onToggleAct: (dayN: number, label: string) => void;
    onPrev: () => void;
    onNext: () => void;
  }
  let { day, focus, todayIso, slideDir, checkedActs, onToggleAct, onPrev, onNext }: Props = $props();

  // Transizione carte-giorno (solo transform/opacity → fluida e composita).
  // Avanti: la nuova carta emerge "da dietro" (scala su + dissolvenza) mentre la
  // vecchia scorre via in avanti. Indietro: il mirror (la precedente rientra da
  // davanti, l'attuale arretra dietro).
  function cardIn(_n: Element, { dir }: { dir: number }) {
    return {
      duration: 500,
      easing: cubicOut,
      css: (t: number) => {
        const u = 1 - t;
        const base = 'will-change: transform, opacity;';
        return dir >= 0
          ? `${base} transform: translateY(${u * 12}px) scale(${1 - u * 0.1}); opacity: ${t}; z-index: 1;`
          : `${base} transform: translateX(${-u * 24}%) scale(${1 + u * 0.04}); opacity: ${t}; z-index: 2;`;
      },
    };
  }
  function cardOut(_n: Element, { dir }: { dir: number }) {
    return {
      duration: 440,
      easing: cubicOut,
      css: (t: number) => {
        const u = 1 - t;
        const base = 'will-change: transform, opacity;';
        return dir >= 0
          ? `${base} transform: translateX(${-u * 24}%) scale(${1 + u * 0.04}); opacity: ${t}; z-index: 2;`
          : `${base} transform: translateY(${u * 12}px) scale(${1 - u * 0.1}); opacity: ${t}; z-index: 1;`;
      },
    };
  }

  const SCHEDULE_SLOTS: { key: keyof GiornoSchedule; label: string }[] = [
    { key: 'mattino', label: 'Mattino' },
    { key: 'pranzo', label: 'Pranzo' },
    { key: 'pomeriggio', label: 'Pomeriggio' },
    { key: 'cena', label: 'Cena' },
    { key: 'sera', label: 'Sera' },
    { key: 'notte', label: 'Dormi a' },
  ];

  function scheduleEntries(d: Giorno) {
    if (!d.schedule) return [];
    return SCHEDULE_SLOTS.filter((s) => d.schedule![s.key]).map((s) => ({
      ...s,
      value: d.schedule![s.key]!,
    }));
  }

  const meta = $derived(cityThemeByItalianName(day.city));
  const tr = $derived(transports.find((t) => t.departAt.slice(0, 10) === day.date));
  const hotel = $derived(meta.id ? alloggi.find((a) => a.city === meta.id) : undefined);
  const isToday = $derived(day.date === todayIso);
  const isFirstDayInCity = $derived(giorni.find((g) => g.city === day.city)?.n === day.n);
  const daySchedule = $derived(scheduleEntries(day));
  const coverSrc = $derived(meta.id ? cityCoverSrc(meta.id) : '');
  const dayProgress = $derived(
    day.acts.length ? day.acts.filter((a) => checkedActs.has(actId(day.n, a.label))).length : 0,
  );
</script>

<div class="day-cards">
  {#key focus}
    <article
      class="day-sheet"
      style="--c:{meta.accent}"
      in:cardIn={{ dir: slideDir }}
      out:cardOut={{ dir: slideDir }}
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
                  onclick={() => onToggleAct(day.n, act.label)}
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
        <button class="foot-btn" onclick={onPrev} disabled={focus <= 1}>← Ieri</button>
        <span class="foot-count">{focus} / 20</span>
        <button class="foot-btn primary" onclick={onNext} disabled={focus >= 20}>Domani →</button>
      </footer>
    </article>
  {/key}
</div>

<style>
  /* Le carte (uscente + entrante) occupano la STESSA cella: si sovrappongono
     durante la transizione invece di impilarsi in verticale (niente salto di
     altezza → cambio fluido). */
  .day-cards {
    display: grid;
  }
  .day-cards > .day-sheet {
    grid-area: 1 / 1;
    align-self: start;
  }
  /* La card si anima con transform: i backdrop-filter INTERNI verrebbero
     ri-rasterizzati a ogni frame → scatti. Disattivati (sopra la card sono
     ininfluenti); il badge sul-foto compensa con sfondo più opaco. */
  .sheet-day-stamp,
  .travel-banner,
  .schedule,
  .hotel {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .sheet-day-stamp {
    background: color-mix(in srgb, #000 64%, transparent);
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
    backdrop-filter: saturate(1.3) blur(8px);
    -webkit-backdrop-filter: saturate(1.3) blur(8px);
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
</style>
