<script lang="ts">
  import {
    itinerario,
    transports,
    cittaById,
    poisOfCity,
    giorni,
    alloggioByCity,
  } from '../lib/content';
  import { computeOggi } from '../lib/today';
  import { longDate, hhmm, shortDate, daysBetween } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { actId } from '../lib/acts';
  import { db, now } from '../db/dexie';
  import { liveQuery } from 'dexie';
  import { onMount } from 'svelte';
  import type { CityId } from '../data/types';

  const info = computeOggi(itinerario, transports);
  const city = $derived(info.leg ? cittaById.get(info.leg.city) : undefined);
  const nt = info.nextTransport;
  const typeLabel: Record<string, string> = { flight: 'Volo', train: 'Treno', bus: 'Bus' };
  const typeIcon: Record<string, string> = { flight: '✈', train: '🚄', bus: '🚌' };

  const CITY_ACCENT: Record<string, string> = {
    chengdu: '#52b788',
    chongqing: '#e05252',
    zhangjiajie: '#4fc3c7',
    pechino: '#e0b552',
    shanghai: '#9b6fd4',
  };
  const CITY_ICON: Record<string, string> = {
    chengdu: '🐼',
    chongqing: '🌶️',
    zhangjiajie: '⛰️',
    pechino: '🏯',
    shanghai: '🌃',
  };
  const accent = $derived(info.leg ? (CITY_ACCENT[info.leg.city] ?? '#e04a28') : '#e04a28');

  const tripTotalDays = $derived(daysBetween(itinerario.trip.start, itinerario.trip.end) + 1);
  const tripDay = $derived(
    info.phase === 'before'
      ? 0
      : info.phase === 'after'
        ? tripTotalDays
        : daysBetween(itinerario.trip.start, info.todayIso) + 1,
  );
  const tripPct = $derived(Math.round((tripDay / tripTotalDays) * 100));

  const todayProgram = $derived(giorni.find((g) => g.date === info.todayIso));
  const alloggio = $derived(info.leg ? alloggioByCity.get(info.leg.city) : undefined);

  let checkedActs = $state<Set<string>>(new Set());
  onMount(() => {
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

  const todayProgress = $derived(
    todayProgram?.acts.length
      ? todayProgram.acts.filter((a) => checkedActs.has(actId(todayProgram.n, a.label))).length
      : 0,
  );
  const todayAllDone = $derived(
    !!todayProgram?.acts.length && todayProgress === todayProgram.acts.length,
  );
  const cityIcon = $derived(info.leg ? (CITY_ICON[info.leg.city] ?? '📍') : '📍');

  const bookings = $derived(
    info.leg ? poisOfCity(info.leg.city).filter((p) => p.booking && /obblig/i.test(p.booking)) : [],
  );

  const shortcuts = [
    { route: 'frasario' as const, icon: '语', label: 'Frasario', desc: 'Mostra al tassista', hue: 'c' },
    { route: 'spese' as const, icon: '¥', label: 'Valuta', desc: 'Converti & dividi', hue: 'g' },
    { route: 'emergenze' as const, icon: '✚', label: 'Salute', desc: 'Numeri SOS', hue: 'j' },
    { route: 'mappa' as const, icon: '◎', label: 'Mappa', desc: 'POI & GPS', hue: 'b' },
    { route: 'documenti' as const, icon: '🔒', label: 'Documenti', desc: 'Cassaforte', hue: 'p' },
    { route: 'logistica' as const, icon: '✈', label: 'Viaggio', desc: 'Timeline 20 gg', hue: 'r' },
  ];

  function legIndex(cityId: CityId): number {
    return itinerario.legs.findIndex((l) => l.city === cityId) + 1;
  }
</script>

<div class="oggi" style={info.phase === 'during' ? `--accent:${accent}` : undefined}>
  {#if info.phase === 'before'}
    <!-- Pre-partenza: un solo blocco hero compatto -->
    <header class="pre-launch card">
      <div class="pre-accent" aria-hidden="true"></div>
      <span class="pre-wm" aria-hidden="true">行</span>
      <div class="pre-inner">
        <div class="pre-meta">
          <time class="pre-today" datetime={info.todayIso}>{longDate(info.todayIso)}</time>
          <span class="pre-tag">Pre-partenza</span>
        </div>

        <div class="pre-count-wrap">
          <div class="pre-ring" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <circle class="ring-bg" cx="60" cy="60" r="52" />
              <circle
                class="ring-fg"
                cx="60"
                cy="60"
                r="52"
                style="stroke-dasharray: {326}; stroke-dashoffset: {326 - (326 * Math.min(info.daysToStart, 30)) / 30}"
              />
            </svg>
          </div>
          <div class="pre-count">
            <span class="pre-num">{info.daysToStart}</span>
            <span class="pre-unit">giorni alla partenza</span>
          </div>
        </div>

        <p class="pre-depart">
          <span class="pre-depart-ic" aria-hidden="true">✈</span>
          {longDate(itinerario.trip.start)}
        </p>

        <div class="pre-actions">
          <button class="pre-cta primary" onclick={() => go('documenti')}>Documenti</button>
          <button class="pre-cta ghost" onclick={() => go('logistica')}>Itinerario 20 gg</button>
        </div>
      </div>
    </header>
  {:else}
    <header class="mast-panel">
      <div class="mast-deco" aria-hidden="true">
        <span class="mast-line"></span>
        <span class="mast-seal">今</span>
        <span class="mast-line"></span>
      </div>
      <div class="mast-top">
        <div class="mast-titles">
          <p class="eyebrow">Dashboard</p>
          <h1 class="mast-h1">Oggi</h1>
        </div>
        <time class="date-pill" datetime={info.todayIso}>{longDate(info.todayIso)}</time>
      </div>
      <div class="mast-foot">
        {#if info.phase === 'during'}
          <span class="trip-badge live">
            <span class="live-dot" aria-hidden="true"></span>
            Giorno {tripDay} di {tripTotalDays}
          </span>
        {:else}
          <span class="trip-badge muted-badge">Viaggio concluso</span>
        {/if}
      </div>
    </header>
  {/if}

  {#if info.phase !== 'before' && info.phase !== 'after'}
    <div class="progress-block" aria-label="Avanzamento viaggio: {tripPct}%">
      <div class="progress-head">
        <span class="progress-label">Avanzamento viaggio</span>
        <span class="progress-pct">{tripPct}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:{tripPct}%"></div>
      </div>
      <div class="progress-labels">
        <span>{shortDate(itinerario.trip.start)}</span>
        <span class="progress-mid">giorno {tripDay}</span>
        <span>{shortDate(itinerario.trip.end)}</span>
      </div>
    </div>
  {/if}

  <!-- ── Hero per fase ────────────────────────────────────────────── -->
  {#if info.phase === 'after'}
    <section class="hero hero-done card">
      <span class="done-glyph" aria-hidden="true">✦</span>
      <h1>Viaggio concluso</h1>
      <p class="muted">Hai attraversato {itinerario.legs.length} tappe in {tripTotalDays} giorni.</p>
      <button class="cta-btn" onclick={() => go('album')}>Apri l'Album ›</button>
    </section>

  {:else if city}
    <section class="hero hero-city card" style="--accent:{accent}">
      <div class="hero-accent" aria-hidden="true"></div>
      <span class="hero-wm" aria-hidden="true">{city.nameLocal}</span>
      <div class="hero-body">
        <div class="hero-meta">
          <span class="city-emoji" aria-hidden="true">{cityIcon}</span>
          <span class="leg-tag">Tappa {legIndex(city.id)}</span>
          {#if info.dayInLeg && info.legLength}
            <span class="leg-day">giorno {info.dayInLeg} di {info.legLength}</span>
          {/if}
        </div>
        <h1 class="city-name">
          {city.name}
          <span class="cn">{city.nameLocal}</span>
        </h1>
        <div class="intro-wrap">
          <p class="city-intro prose-lead">{city.intro}</p>
        </div>
        <div class="hero-stats">
          <span class="stat-chip">{poisOfCity(city.id).length} POI</span>
          {#if bookings.length}<span class="stat-chip warn">{bookings.length} da prenotare</span>{/if}
        </div>
        <div class="hero-actions">
          <button class="hero-cta primary" onclick={() => go('citta', city.id)}>Guida & POI</button>
          <button class="hero-cta ghost" onclick={() => go('mappa')}>Mappa</button>
        </div>
      </div>
    </section>
  {/if}

  <!-- ── Programma di oggi ───────────────────────────────────────── -->
  {#if todayProgram}
    <section class="block block-program">
      <div class="block-head">
        <h2 class="block-title">Programma di oggi</h2>
        <span class="block-sub" class:done-chip={todayAllDone}>
          {#if todayAllDone}
            Tutto fatto ✓
          {:else if todayProgram.acts.length}
            {todayProgress}/{todayProgram.acts.length}
          {:else}
            Libero
          {/if}
        </span>
      </div>
      <div class="card program-card">
        <div class="program-head">
          <span class="program-day-title">{todayProgram.title}</span>
        </div>
        {#if todayProgram.acts.length}
          <div class="program-bar" aria-hidden="true">
            <div
              class="program-bar-fill"
              class:complete={todayAllDone}
              style="width: {Math.round((todayProgress / todayProgram.acts.length) * 100)}%"
            ></div>
          </div>
        {/if}
        {#if todayProgram.acts.length === 0}
          <p class="program-empty">Giornata libera — nessuna attività pianificata.</p>
        {:else}
          <ul class="acts" class:timeline={todayProgram.acts.length > 1}>
            {#each todayProgram.acts as act, i (act.label)}
              {@const aid = actId(todayProgram.n, act.label)}
              {@const done = checkedActs.has(aid)}
              <li class="act-row" class:done>
                <button
                  type="button"
                  class="act-check-btn"
                  aria-label={done ? 'Segna da fare' : 'Segna fatto'}
                  aria-pressed={done}
                  onclick={() => toggleAct(todayProgram.n, act.label)}
                >
                  <span class="act-check" class:on={done}>{#if done}✓{/if}</span>
                </button>
                {#if act.poi}
                  <button type="button" class="act act-poi" onclick={() => go('poi', act.poi!)}>
                    <span class="act-num" aria-hidden="true">{i + 1}</span>
                    <span class="act-label">{act.label}</span>
                    <span class="act-chev" aria-hidden="true">›</span>
                  </button>
                {:else}
                  <div class="act act-plain">
                    <span class="act-num" aria-hidden="true">{i + 1}</span>
                    <span class="act-label">{act.label}</span>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        <button class="program-link" onclick={() => go('logistica')}>Vedi tutto il viaggio ›</button>
      </div>
    </section>
  {/if}

  <!-- ── Alloggio ──────────────────────────────────────────────────── -->
  {#if alloggio && info.phase === 'during'}
    <section class="block">
      <div class="block-head">
        <h2 class="block-title">Dove dormiamo</h2>
        {#if !alloggio.confirmed}<span class="block-when">Da confermare</span>{/if}
      </div>
      <div class="card stay-card accent-card">
        <div class="stay-top">
          <span class="stay-icon" aria-hidden="true">🏨</span>
          <div class="stay-info">
            <b>{alloggio.name}</b>
            {#if alloggio.address}<p class="stay-addr">{alloggio.address}</p>{/if}
          </div>
        </div>
        <div class="stay-dates">
          <span>Check-in {shortDate(alloggio.checkIn)}</span>
          <span class="sep">→</span>
          <span>Check-out {shortDate(alloggio.checkOut)}</span>
        </div>
        {#if alloggio.addressLocal}
          <button
            class="stay-zh"
            onclick={() => go('frasario')}
            title="Apri nel frasario"
          >
            <span class="zh">{alloggio.addressLocal}</span>
            <span class="zh-hint">Mostra al tassista ›</span>
          </button>
        {/if}
      </div>
    </section>
  {/if}

  <!-- ── Prossimo spostamento ──────────────────────────────────────── -->
  {#if nt}
    <section class="block">
      <div class="block-head">
        <h2 class="block-title">Prossimo spostamento</h2>
        {#if info.daysToNextTransport !== undefined}
          <span class="block-when">
            {info.daysToNextTransport === 0 ? 'Oggi' : `Tra ${info.daysToNextTransport} gg`}
          </span>
        {/if}
      </div>
      <button class="card transport-card accent-card card-interactive" onclick={() => go('logistica')}>
        <div class="transport-icon" aria-hidden="true">{typeIcon[nt.type] ?? '→'}</div>
        <div class="transport-body">
          <div class="transport-route">
            <span class="tag-pill">{typeLabel[nt.type]}</span>
            <b>{nt.from} → {nt.to}</b>
          </div>
          <div class="transport-meta">
            <span>{nt.code}</span>
            {#if !nt.confirmed}<span class="warn-tag">da prenotare</span>{/if}
            <span class="sep">·</span>
            <span>{shortDate(nt.departAt)}</span>
            {#if hhmm(nt.departAt)}<span class="sep">·</span><span>{hhmm(nt.departAt)}</span>{/if}
          </div>
        </div>
        <span class="transport-chev" aria-hidden="true">›</span>
      </button>
    </section>
  {/if}

  <!-- ── Prenotazioni obbligatorie ─────────────────────────────────── -->
  {#if info.phase === 'during' && bookings.length}
    <section class="block">
      <div class="block-head">
        <h2 class="block-title">Da prenotare</h2>
        <span class="block-sub">{bookings.length} attività</span>
      </div>
      <div class="card bookings-card">
        {#each bookings as p (p.id)}
          <button class="booking-row" onclick={() => go('poi', p.id)}>
            <span class="booking-star" aria-hidden="true">★</span>
            <span class="booking-main">
              <b>{p.name}</b>
              <span class="muted booking-note">{p.booking}</span>
            </span>
            <span class="booking-chev" aria-hidden="true">›</span>
          </button>
        {/each}
      </div>
    </section>
  {/if}

  <!-- ── Strumenti rapidi ──────────────────────────────────────────── -->
  <section class="block tools-block">
    <div class="block-head">
      <h2 class="block-title">Strumenti</h2>
    </div>
    <div class="tools-grid">
      {#each shortcuts as s (s.route)}
        <button class="tool hue-{s.hue}" onclick={() => go(s.route)}>
          <span class="tool-icon">{s.icon}</span>
          <span class="tool-label">{s.label}</span>
          <span class="tool-desc">{s.desc}</span>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .oggi {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding-bottom: 12px;
  }

  /* ── Masthead panel ── */
  .mast-panel {
    margin-bottom: 18px;
    padding: 16px 18px 18px;
    background: linear-gradient(168deg, var(--surface-hi) 0%, var(--surface) 55%, color-mix(in srgb, var(--surface) 92%, var(--paper)) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    position: relative;
    overflow: hidden;
  }
  .mast-panel::after {
    content: '';
    position: absolute;
    top: 0;
    left: 14%;
    right: 14%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    pointer-events: none;
  }
  .mast-deco {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .mast-line {
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
  .mast-seal {
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    font-family: var(--hanzi);
    font-size: 14px;
    font-weight: 600;
    color: var(--cinabro-bright);
    background: var(--cinabro-soft);
    border: 1px solid rgba(232, 72, 40, 0.28);
    border-radius: 6px;
    box-shadow: 0 0 14px var(--cinabro-glow);
  }
  .mast-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 14px;
  }
  .mast-titles { min-width: 0; }
  .mast-h1 {
    font-family: var(--serif);
    font-size: 2.35rem;
    line-height: 1.02;
    letter-spacing: -0.025em;
    margin: 2px 0 0;
    background: linear-gradient(135deg, var(--ink) 0%, var(--ink-soft) 85%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .mast-foot { margin-top: 14px; }
  .date-pill {
    flex: none;
    max-width: 48%;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-body);
    text-align: right;
    line-height: 1.5;
    padding: 8px 11px;
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
  }
  .trip-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--cinabro-bright);
    background: var(--cinabro-soft);
    border: 1px solid rgba(232, 72, 40, 0.28);
    border-radius: var(--radius-pill);
    padding: 5px 12px;
    box-shadow: 0 2px 10px rgba(232, 72, 40, 0.12);
  }
  .trip-badge.live {
    color: var(--accent, var(--cinabro-bright));
    background: color-mix(in srgb, var(--accent, var(--cinabro)) 14%, transparent);
    border-color: color-mix(in srgb, var(--accent, var(--cinabro)) 32%, transparent);
    box-shadow: 0 2px 12px color-mix(in srgb, var(--accent, var(--cinabro)) 18%, transparent);
  }
  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent, var(--cinabro-bright));
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent, var(--cinabro)) 60%, transparent);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(0.88); }
  }
  .muted-badge {
    color: var(--ink-faint);
    background: var(--paper-2);
    border-color: var(--line-strong);
    box-shadow: none;
  }

  /* ── Progress ── */
  .progress-block {
    margin-bottom: 22px;
    padding: 15px 17px;
    background: linear-gradient(160deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }
  .progress-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .progress-label {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .progress-pct {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--accent, var(--cinabro-bright));
  }
  .progress-track {
    height: 6px;
    background: var(--paper-2);
    border-radius: var(--radius-pill);
    overflow: hidden;
    border: 1px solid var(--line);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent, var(--cinabro)), color-mix(in srgb, var(--accent, var(--jade)) 50%, var(--jade-bright)));
    border-radius: inherit;
    transition: width 0.7s var(--ease);
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent, var(--cinabro)) 45%, transparent);
    position: relative;
  }
  .progress-fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.22) 0%, transparent 55%);
    border-radius: inherit;
  }
  .progress-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 9px;
    font-family: var(--mono);
    font-size: 9px;
    color: var(--ink-faint);
    letter-spacing: 0.04em;
  }
  .progress-mid {
    color: var(--ink-body);
    font-weight: 600;
    font-size: 10px;
  }

  /* ── Hero variants ── */
  .hero {
    margin-bottom: 24px;
    position: relative;
    overflow: hidden;
    box-shadow: var(--shadow-md);
  }
  .cta-btn {
    display: inline-flex;
    align-items: center;
    margin-top: 16px;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: #fff;
    background: linear-gradient(135deg, var(--cinabro-bright), var(--cinabro));
    border: 1px solid rgba(232, 72, 40, 0.4);
    border-radius: var(--radius-sm);
    padding: 11px 18px;
    box-shadow: 0 4px 14px var(--cinabro-glow);
    transition: transform 0.15s var(--ease);
  }
  .cta-btn:active { transform: scale(0.97); }

  /* Pre-partenza — hero unificato */
  .pre-launch {
    position: relative;
    margin-bottom: 24px;
    padding: 0;
    overflow: hidden;
    background: linear-gradient(
      168deg,
      color-mix(in srgb, var(--cinabro) 10%, var(--surface-hi)) 0%,
      var(--surface) 45%,
      color-mix(in srgb, var(--surface) 94%, var(--paper)) 100%
    );
    border-color: color-mix(in srgb, var(--cinabro) 22%, var(--line-strong));
    box-shadow: var(--shadow-md), 0 0 40px rgba(232, 72, 40, 0.1);
    animation: rise 0.45s var(--ease) both;
  }
  .pre-accent {
    height: 4px;
    background: linear-gradient(90deg, var(--cinabro-bright), var(--gold), color-mix(in srgb, var(--cinabro) 20%, transparent));
    box-shadow: 0 2px 14px var(--cinabro-glow);
  }
  .pre-wm {
    position: absolute;
    right: 4px;
    top: 28px;
    font-family: var(--hanzi);
    font-size: 5.5rem;
    font-weight: 600;
    line-height: 1;
    color: color-mix(in srgb, var(--cinabro) 9%, transparent);
    pointer-events: none;
    user-select: none;
  }
  .pre-inner {
    position: relative;
    z-index: 1;
    padding: 18px 20px 22px;
    text-align: center;
  }
  .pre-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 20px;
  }
  .pre-today {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-body);
  }
  .pre-tag {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--cinabro-bright);
    background: var(--cinabro-soft);
    border: 1px solid rgba(232, 72, 40, 0.28);
    border-radius: var(--radius-pill);
    padding: 4px 10px;
  }
  .pre-count-wrap {
    position: relative;
    width: 148px;
    height: 148px;
    margin: 0 auto 18px;
  }
  .pre-ring {
    position: absolute;
    inset: 0;
  }
  .pre-ring svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
    filter: drop-shadow(0 4px 14px rgba(232, 72, 40, 0.25));
  }
  .ring-bg { fill: none; stroke: var(--line-strong); stroke-width: 4; }
  .ring-fg {
    fill: none;
    stroke: var(--cinabro-bright);
    stroke-width: 4;
    stroke-linecap: round;
  }
  .pre-count {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }
  .pre-num {
    font-family: var(--serif);
    font-size: 3.4rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--ink);
    background: linear-gradient(180deg, var(--ink) 30%, var(--cinabro-bright) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .pre-unit {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-faint);
    max-width: 80px;
    line-height: 1.35;
  }
  .pre-depart {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--ink-soft);
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    padding: 8px 16px;
    margin-bottom: 10px;
  }
  .pre-depart-ic { font-size: 0.95rem; line-height: 1; }
  .pre-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
  }
  .pre-cta {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    border-radius: var(--radius-sm);
    padding: 12px 16px;
    transition: transform 0.15s var(--ease);
  }
  .pre-cta:active { transform: scale(0.97); }
  .pre-cta.primary {
    flex: 1;
    max-width: 160px;
    color: #fff;
    background: linear-gradient(135deg, var(--cinabro-bright), var(--cinabro));
    border: 1px solid rgba(232, 72, 40, 0.4);
    box-shadow: 0 4px 14px var(--cinabro-glow);
  }
  .pre-cta.ghost {
    flex: 1;
    max-width: 140px;
    color: var(--ink-soft);
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
  }

  /* Done */
  .hero-done {
    text-align: center;
    padding: 36px 24px;
    background: linear-gradient(
      168deg,
      color-mix(in srgb, var(--gold-soft) 40%, var(--surface-hi)) 0%,
      var(--surface) 100%
    );
  }
  .done-glyph {
    font-size: 2.4rem;
    color: var(--gold);
    display: block;
    margin-bottom: 12px;
    text-shadow: 0 0 24px rgba(228, 176, 74, 0.4);
  }
  .hero-done h1 { font-size: 1.8rem; margin-bottom: 8px; }
  .hero-done .muted { font-size: 0.95rem; }

  /* City */
  .hero-city {
    padding: 0;
    background: linear-gradient(
      168deg,
      color-mix(in srgb, var(--surface-hi) 82%, var(--accent)) 0%,
      var(--surface) 42%,
      color-mix(in srgb, var(--surface) 94%, var(--paper)) 100%
    );
    box-shadow:
      var(--shadow-md),
      0 0 48px color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .hero-city::before {
    content: '';
    position: absolute;
    top: -30px;
    right: -30px;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 70%);
    pointer-events: none;
  }
  .hero-wm {
    position: absolute;
    right: 6px;
    top: 16px;
    font-family: var(--hanzi);
    font-size: 4rem;
    font-weight: 600;
    line-height: 1;
    color: color-mix(in srgb, var(--accent) 11%, transparent);
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }
  .hero-accent {
    height: 4px;
    background: linear-gradient(
      90deg,
      var(--accent),
      color-mix(in srgb, var(--accent) 50%, var(--cinabro-bright)),
      color-mix(in srgb, var(--accent) 20%, transparent)
    );
    box-shadow: 0 2px 16px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .hero-body {
    padding: 22px 20px 24px;
    position: relative;
    z-index: 1;
  }
  .hero-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .city-emoji {
    font-size: 1.15rem;
    line-height: 1;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
  }
  .leg-tag {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
    border-radius: var(--radius-pill);
    padding: 4px 10px;
  }
  .leg-day {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
  }
  .city-name {
    font-family: var(--serif);
    font-size: 2.05rem;
    line-height: 1.1;
    margin-bottom: 12px;
    letter-spacing: -0.015em;
    max-width: 82%;
  }
  .city-name .cn {
    display: block;
    font-family: var(--hanzi);
    font-size: 1.7rem;
    font-weight: 500;
    color: var(--accent);
    margin-top: 5px;
    text-shadow: 0 0 28px color-mix(in srgb, var(--accent) 38%, transparent);
  }
  .intro-wrap {
    position: relative;
    padding-left: 14px;
    margin-bottom: 12px;
    max-width: 92%;
  }
  .intro-wrap::before {
    content: '';
    position: absolute;
    left: 0;
    top: 3px;
    bottom: 3px;
    width: 3px;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 40%, transparent));
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .city-intro {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin: 0;
  }
  .hero-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 4px;
  }
  .stat-chip {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
    border-radius: var(--radius-pill);
    padding: 4px 10px;
  }
  .stat-chip.warn {
    color: var(--gold);
    background: var(--gold-soft);
    border-color: color-mix(in srgb, var(--gold) 30%, transparent);
  }
  .hero-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
  }
  .hero-cta {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;
    border-radius: var(--radius-sm);
    padding: 11px 18px;
    transition: transform 0.15s var(--ease), box-shadow 0.15s;
  }
  .hero-cta:active { transform: scale(0.97); }
  .hero-cta.primary {
    color: #fff;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent) 88%, #fff),
      var(--accent)
    );
    border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .hero-cta.ghost {
    color: var(--ink-soft);
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
  }

  /* ── Blocks ── */
  .block { margin-bottom: 24px; }
  .block-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 11px;
    padding-left: 2px;
  }
  .block-title {
    font-family: var(--serif);
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--ink);
    display: flex;
    align-items: center;
    gap: 9px;
    letter-spacing: -0.01em;
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
  .block-sub, .block-when {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-faint);
    letter-spacing: 0.03em;
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    padding: 3px 10px;
  }
  .block-when {
    color: var(--cinabro-bright);
    border-color: rgba(232, 72, 40, 0.22);
    background: var(--cinabro-soft);
  }

  .block-sub.done-chip,
  .done-chip {
    color: var(--jade-bright);
    background: var(--jade-soft);
    border-color: color-mix(in srgb, var(--jade) 35%, transparent);
  }

  /* Program */
  .block-program .program-card {
    padding: 0;
    overflow: hidden;
    border-color: color-mix(in srgb, var(--accent, var(--line-strong)) 35%, var(--line-strong));
    box-shadow: var(--shadow-md), 0 0 32px color-mix(in srgb, var(--accent, var(--cinabro)) 8%, transparent);
  }
  .program-head {
    padding: 14px 18px 12px;
    border-bottom: 1px solid var(--line);
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent, var(--surface-hi)) 8%, var(--surface-hi)) 0%, var(--surface) 100%);
  }
  .program-day-title {
    display: block;
    font-family: var(--serif);
    font-size: 1.12rem;
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.01em;
    line-height: 1.25;
  }
  .program-card .program-bar {
    margin: 14px 18px 0;
  }
  .program-card .acts,
  .program-card .program-empty {
    margin: 14px 18px 0;
  }
  .program-bar-fill.complete {
    background: linear-gradient(90deg, var(--jade), var(--jade-bright));
    box-shadow: 0 0 12px var(--jade-soft);
  }
  .program-bar {
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--line);
    margin-bottom: 14px;
    overflow: hidden;
  }
  .program-bar-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--accent, var(--cinabro)), var(--jade-bright));
    transition: width 0.35s var(--ease);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent, var(--cinabro)) 40%, transparent);
  }
  .program-empty {
    font-size: 0.92rem;
    color: var(--ink-faint);
    font-style: italic;
    padding: 12px 14px;
    text-align: center;
    background: var(--paper-2);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
  }
  .acts {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 9px;
    position: relative;
  }
  .acts.timeline::before {
    content: '';
    position: absolute;
    left: 24px;
    top: 28px;
    bottom: 28px;
    width: 2px;
    border-radius: 1px;
    background: linear-gradient(
      180deg,
      var(--accent, var(--line-strong)),
      color-mix(in srgb, var(--accent, var(--line)) 40%, var(--line))
    );
    opacity: 0.45;
    z-index: 0;
  }
  .act-row {
    display: flex;
    align-items: stretch;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--line-strong);
    background: linear-gradient(155deg, var(--paper-2) 0%, var(--surface) 100%);
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s var(--ease), border-color 0.15s;
    position: relative;
    z-index: 1;
  }
  .act-row:active { transform: scale(0.995); }
  .act-row.done { opacity: 0.68; }
  .act-check-btn {
    flex: none;
    display: grid;
    place-items: center;
    width: 50px;
    border-right: 1px solid var(--line);
    background: color-mix(in srgb, var(--accent, var(--jade)) 6%, var(--surface));
  }
  .act-check {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    border: 2px solid color-mix(in srgb, var(--accent, var(--jade)) 65%, var(--line-strong));
    background: color-mix(in srgb, var(--accent, var(--jade)) 10%, transparent);
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    transition: background 0.18s, border-color 0.18s, transform 0.15s;
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
    gap: 10px;
    min-width: 0;
    text-align: left;
    padding: 13px 14px 13px 4px;
    border: none;
    background: transparent;
  }
  .act-poi:active { background: color-mix(in srgb, var(--accent, var(--cinabro)) 8%, var(--paper-2)); }
  .act-row.done .act-label {
    text-decoration: line-through;
    color: var(--ink-faint);
  }
  .act-num {
    flex: none;
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--accent, var(--ink-faint));
    background: color-mix(in srgb, var(--accent, var(--paper-2)) 12%, var(--paper-2));
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--accent, var(--line-strong)) 35%, var(--line-strong));
  }
  .act-label {
    flex: 1;
    font-weight: 500;
    font-size: 0.94rem;
    color: var(--ink);
    line-height: 1.38;
    letter-spacing: 0.01em;
  }
  .act-chev {
    color: var(--accent, var(--cinabro-bright));
    font-size: 1.25rem;
    flex: none;
    opacity: 0.85;
  }
  .program-link {
    display: block;
    width: 100%;
    margin-top: 14px;
    padding: 13px 18px;
    border-top: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-faint);
    text-align: center;
    background: var(--paper-2);
    transition: color 0.15s, background 0.15s;
  }
  .program-link:active {
    color: var(--accent, var(--cinabro-bright));
    background: color-mix(in srgb, var(--accent, var(--cinabro)) 8%, var(--paper-2));
  }

  /* Accent cards (stay, transport) */
  .accent-card {
    position: relative;
    overflow: hidden;
  }
  .accent-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: linear-gradient(180deg, var(--accent, var(--jade-bright)), color-mix(in srgb, var(--accent, var(--jade)) 50%, transparent));
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent, var(--jade)) 30%, transparent);
  }
  .transport-card.accent-card::before {
    background: linear-gradient(180deg, var(--cinabro-bright), var(--gold));
    box-shadow: 0 0 10px var(--cinabro-glow);
  }

  /* Stay */
  .stay-card {
    padding: 18px 20px 18px 22px;
    background: linear-gradient(160deg, var(--surface-hi) 0%, var(--surface) 100%);
  }
  .stay-top { display: flex; align-items: flex-start; gap: 14px; }
  .stay-icon {
    flex: none;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    font-size: 1.25rem;
    background: var(--jade-soft);
    border: 1px solid color-mix(in srgb, var(--jade) 28%, transparent);
    border-radius: 12px;
    line-height: 1;
  }
  .stay-info { flex: 1; min-width: 0; }
  .stay-info b {
    font-family: var(--serif);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--ink);
  }
  .stay-addr {
    font-size: 0.82rem;
    margin-top: 4px;
    line-height: 1.45;
    color: var(--ink-body);
  }
  .stay-dates {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    letter-spacing: 0.02em;
  }
  .sep { opacity: 0.35; }
  .stay-zh {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    margin-top: 12px;
    padding: 12px 16px;
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
  }
  .stay-zh:active {
    border-color: var(--jade);
    background: color-mix(in srgb, var(--jade) 6%, var(--paper-2));
  }
  .zh {
    font-family: var(--hanzi);
    font-size: 1.15rem;
    color: var(--ink);
  }
  .zh-hint {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--jade-bright);
    white-space: nowrap;
  }

  /* Transport */
  .transport-card {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    text-align: left;
    padding: 16px 18px 16px 22px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--cinabro) 10%, var(--surface-hi)) 0%,
      var(--surface) 100%
    );
    border-color: color-mix(in srgb, var(--cinabro) 22%, var(--line-strong));
  }
  .transport-icon {
    flex: none;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    font-size: 1.35rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    line-height: 1;
  }
  .transport-body { flex: 1; min-width: 0; }
  .transport-route {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 0.96rem;
  }
  .transport-route b { color: var(--ink); font-weight: 600; }
  .transport-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-top: 7px;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    letter-spacing: 0.02em;
  }
  .warn-tag {
    color: var(--gold);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 9px;
    background: var(--gold-soft);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .transport-chev {
    color: var(--cinabro-bright);
    font-size: 1.4rem;
    flex: none;
    opacity: 0.8;
  }

  /* Bookings */
  .bookings-card { padding: 6px 18px; }
  .booking-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 14px 0;
    border-bottom: 1px solid var(--line);
    transition: opacity 0.15s;
  }
  .booking-row:active { opacity: 0.75; }
  .booking-row:last-child { border-bottom: none; }
  .booking-star {
    flex: none;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    color: var(--gold);
    font-size: 14px;
    background: var(--gold-soft);
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--gold) 25%, transparent);
  }
  .booking-main { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
  .booking-main b {
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--ink);
  }
  .booking-note {
    font-size: 0.78rem;
    color: var(--ink-body);
    line-height: 1.35;
  }
  .booking-chev {
    color: var(--ink-faint);
    font-size: 1.25rem;
    flex: none;
  }

  /* Tools */
  .tools-block { margin-bottom: 0; }
  .tools-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 15px 8px 13px;
    min-height: 0;
    background: linear-gradient(165deg, var(--surface-hi) 0%, var(--surface) 55%, color-mix(in srgb, var(--surface) 90%, var(--paper)) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    text-align: center;
    position: relative;
    overflow: hidden;
    transition: transform 0.18s var(--ease), border-color 0.18s, box-shadow 0.18s;
  }
  .tool::after {
    content: '';
    position: absolute;
    top: 0;
    left: 20%;
    right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.07), transparent);
    pointer-events: none;
  }
  .tool:active {
    transform: scale(0.96);
    border-color: rgba(232, 72, 40, 0.35);
    box-shadow: var(--shadow-md);
  }
  .tool-icon {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 11px;
    font-size: 1.2rem;
    line-height: 1;
    font-family: var(--hanzi);
    margin-bottom: 2px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .hue-c .tool-icon { background: var(--cinabro-soft); color: var(--cinabro-bright); }
  .hue-g .tool-icon { background: var(--gold-soft); color: var(--gold); }
  .hue-j .tool-icon { background: var(--jade-soft); color: var(--jade-bright); }
  .hue-b .tool-icon { background: rgba(79, 195, 199, 0.14); color: #4fc3c7; }
  .hue-p .tool-icon { background: rgba(155, 111, 212, 0.14); color: #b48fe0; }
  .hue-r .tool-icon { background: rgba(224, 82, 82, 0.14); color: #e87070; }
  .tool-label {
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--ink);
    text-align: center;
    letter-spacing: 0.01em;
  }
  .tool-desc {
    font-size: 0.67rem;
    color: var(--ink-faint);
    line-height: 1.3;
    text-align: center;
  }

  /* Staggered entrance */
  .mast-panel { animation: rise 0.4s var(--ease) both; }
  .progress-block { animation: rise 0.45s var(--ease) 0.04s both; }
  .hero { animation: rise 0.5s var(--ease) 0.08s both; }
  .block { animation: rise 0.5s var(--ease) both; }
  .block:nth-child(4) { animation-delay: 0.1s; }
  .block:nth-child(5) { animation-delay: 0.14s; }
  .block:nth-child(6) { animation-delay: 0.18s; }
  .block:nth-child(7) { animation-delay: 0.22s; }
  .tools-block { animation-delay: 0.26s; }
  @keyframes rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
</style>
