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

  const bookings = $derived(
    info.leg ? poisOfCity(info.leg.city).filter((p) => p.booking && /obblig/i.test(p.booking)) : [],
  );

  const shortcuts = [
    { route: 'frasario' as const, icon: '语', label: 'Frasario', desc: 'Mostra al tassista' },
    { route: 'spese' as const, icon: '¥', label: 'Valuta', desc: 'Converti & dividi' },
    { route: 'emergenze' as const, icon: '✚', label: 'Salute', desc: 'Numeri SOS' },
    { route: 'mappa' as const, icon: '◎', label: 'Mappa', desc: 'POI & GPS' },
    { route: 'documenti' as const, icon: '🔒', label: 'Documenti', desc: 'Cassaforte' },
    { route: 'logistica' as const, icon: '✈', label: 'Viaggio', desc: 'Timeline 20 gg' },
  ];

  function legIndex(cityId: CityId): number {
    return itinerario.legs.findIndex((l) => l.city === cityId) + 1;
  }
</script>

<div class="oggi">
  <!-- ── Intestazione ─────────────────────────────────────────────── -->
  <header class="masthead">
    <div class="mast-top">
      <time class="date" datetime={info.todayIso}>{longDate(info.todayIso)}</time>
      {#if info.phase === 'during'}
        <span class="trip-badge">Giorno {tripDay} / {tripTotalDays}</span>
      {:else if info.phase === 'before'}
        <span class="trip-badge muted-badge">Pre-partenza</span>
      {:else}
        <span class="trip-badge muted-badge">Concluso</span>
      {/if}
    </div>
  </header>

  {#if info.phase !== 'before' && info.phase !== 'after'}
    <div class="progress-block" aria-label="Avanzamento viaggio: {tripPct}%">
      <div class="progress-track">
        <div class="progress-fill" style="width:{tripPct}%; --accent:{accent}"></div>
      </div>
      <div class="progress-labels">
        <span>{shortDate(itinerario.trip.start)}</span>
        <span class="pct">{tripPct}%</span>
        <span>{shortDate(itinerario.trip.end)}</span>
      </div>
    </div>
  {/if}

  <!-- ── Hero per fase ────────────────────────────────────────────── -->
  {#if info.phase === 'before'}
    <section class="hero hero-countdown card">
      <div class="countdown-ring" aria-hidden="true">
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
        <div class="countdown-inner">
          <span class="count-num">{info.daysToStart}</span>
          <span class="count-lbl">giorni</span>
        </div>
      </div>
      <div class="countdown-copy">
        <h1>Manca poco</h1>
        <p class="muted">Partenza il <strong>{longDate(itinerario.trip.start)}</strong></p>
        <button class="cta" onclick={() => { try { sessionStorage.setItem('docs-scroll', 'airplane'); } catch { /* ignore */ } go('documenti'); }}>Test modalità aereo ›</button>
      </div>
    </section>

  {:else if info.phase === 'after'}
    <section class="hero hero-done card">
      <span class="done-glyph" aria-hidden="true">✦</span>
      <h1>Viaggio concluso</h1>
      <p class="muted">Hai attraversato {itinerario.legs.length} tappe in {tripTotalDays} giorni.</p>
      <button class="cta" onclick={() => go('album')}>Apri l'Album ›</button>
    </section>

  {:else if city}
    <section class="hero hero-city card" style="--accent:{accent}">
      <div class="hero-accent" aria-hidden="true"></div>
      <div class="hero-body">
        <div class="hero-meta">
          <span class="leg-tag">Tappa {legIndex(city.id)}</span>
          {#if info.dayInLeg && info.legLength}
            <span class="leg-day">giorno {info.dayInLeg} di {info.legLength}</span>
          {/if}
        </div>
        <h1 class="city-name">
          {city.name}
          <span class="cn">{city.nameLocal}</span>
        </h1>
        <p class="city-intro">{city.intro}</p>
        <div class="hero-actions">
          <button class="cta" onclick={() => go('citta', city.id)}>Guida & POI ›</button>
          <button class="cta ghost" onclick={() => go('mappa')}>Mappa</button>
        </div>
      </div>
    </section>
  {/if}

  <!-- ── Programma di oggi ───────────────────────────────────────── -->
  {#if todayProgram}
    <section class="block">
      <div class="block-head">
        <h2 class="block-title">Programma di oggi</h2>
        <span class="block-sub">
          {#if todayProgram.acts.length}
            {todayProgress}/{todayProgram.acts.length} · {todayProgram.title}
          {:else}
            {todayProgram.title}
          {/if}
        </span>
      </div>
      <div class="card program-card">
        {#if todayProgram.acts.length === 0}
          <p class="muted program-empty">Giornata libera — nessuna attività pianificata.</p>
        {:else}
          <ol class="acts">
            {#each todayProgram.acts as act, i (act.label)}
              {@const aid = actId(todayProgram.n, act.label)}
              {@const done = checkedActs.has(aid)}
              <li class="act-item" class:done>
                <button
                  type="button"
                  class="act-check-btn"
                  aria-label={done ? 'Segna da fare' : 'Segna fatto'}
                  aria-pressed={done}
                  onclick={() => toggleAct(todayProgram.n, act.label)}
                >
                  <span class="act-check" class:on={done}>{#if done}✓{/if}</span>
                </button>
                <span class="act-num" aria-hidden="true">{i + 1}</span>
                {#if act.poi}
                  <button class="act-btn" onclick={() => go('poi', act.poi!)}>
                    <span class="act-label">{act.label}</span>
                    <span class="act-chev" aria-hidden="true">›</span>
                  </button>
                {:else}
                  <div class="act-static">
                    <span class="act-label">{act.label}</span>
                  </div>
                {/if}
              </li>
            {/each}
          </ol>
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
      </div>
      <div class="card stay-card">
        <div class="stay-top">
          <span class="stay-icon" aria-hidden="true">🏨</span>
          <div class="stay-info">
            <b>{alloggio.name}</b>
            {#if alloggio.address}<p class="muted stay-addr">{alloggio.address}</p>{/if}
          </div>
          {#if !alloggio.confirmed}
            <span class="stay-warn">Da confermare</span>
          {/if}
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
      <button class="card transport-card card-interactive" onclick={() => go('logistica')}>
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
        <button class="tool" onclick={() => go(s.route)}>
          <span class="tool-icon">{s.icon}</span>
          <span class="tool-label">{s.label}</span>
          <span class="tool-desc">{s.desc}</span>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .oggi { display: flex; flex-direction: column; gap: 0; }

  /* ── Masthead ── */
  .masthead { margin-bottom: 14px; }
  .mast-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .date {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .trip-badge {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--cinabro-bright);
    background: var(--cinabro-soft);
    border: 1px solid rgba(224, 74, 40, 0.25);
    border-radius: var(--radius-pill);
    padding: 4px 10px;
    white-space: nowrap;
  }
  .muted-badge { color: var(--ink-faint); background: var(--paper-2); border-color: var(--line-strong); }

  /* ── Progress ── */
  .progress-block { margin-bottom: 18px; }
  .progress-track {
    height: 4px;
    background: var(--paper-2);
    border-radius: 2px;
    overflow: hidden;
    border: 1px solid var(--line);
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, var(--cinabro)));
    border-radius: 2px;
    transition: width 0.6s var(--ease);
  }
  .progress-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-family: var(--mono);
    font-size: 9px;
    color: var(--ink-faint);
    letter-spacing: 0.04em;
  }
  .pct { color: var(--ink-soft); font-weight: 600; }

  /* ── Hero variants ── */
  .hero { margin-bottom: 22px; position: relative; overflow: hidden; }
  .cta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 14px;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--cinabro-bright);
    padding: 8px 0;
    transition: opacity 0.15s;
  }
  .cta:active { opacity: 0.7; }
  .cta.ghost { color: var(--ink-soft); margin-left: 16px; }

  /* Countdown */
  .hero-countdown {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 22px 20px;
  }
  .countdown-ring {
    position: relative;
    width: 100px;
    height: 100px;
    flex: none;
  }
  .countdown-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .ring-bg { fill: none; stroke: var(--line-strong); stroke-width: 6; }
  .ring-fg { fill: none; stroke: var(--cinabro); stroke-width: 6; stroke-linecap: round; }
  .countdown-inner {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .count-num {
    font-family: var(--serif);
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1;
    color: var(--cinabro);
  }
  .count-lbl {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-top: 2px;
  }
  .countdown-copy h1 { font-size: 1.5rem; margin-bottom: 4px; }
  .countdown-copy strong { color: var(--ink-soft); font-weight: 500; }

  /* Done */
  .hero-done { text-align: center; padding: 32px 24px; }
  .done-glyph { font-size: 2.2rem; color: var(--gold); display: block; margin-bottom: 10px; }
  .hero-done h1 { font-size: 1.7rem; margin-bottom: 8px; }
  .hero-done .cta { margin-top: 18px; }

  /* City */
  .hero-city { padding: 0; }
  .hero-accent {
    height: 4px;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 40%, transparent));
  }
  .hero-body { padding: 20px 20px 22px; }
  .hero-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .leg-tag {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: var(--radius-pill);
    padding: 3px 9px;
  }
  .leg-day {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
  }
  .city-name {
    font-size: 2rem;
    line-height: 1.1;
    margin-bottom: 10px;
  }
  .city-name .cn {
    display: block;
    font-family: var(--hanzi);
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--accent);
    margin-top: 2px;
  }
  .city-intro {
    font-size: 0.88rem;
    color: var(--ink-soft);
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0 4px; }

  /* ── Blocks ── */
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
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--ink);
  }
  .block-sub, .block-when {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    letter-spacing: 0.03em;
  }
  .block-when { color: var(--cinabro-bright); font-weight: 600; }

  /* Program */
  .program-card { padding: 16px 18px; }
  .program-empty { font-size: 0.88rem; padding: 4px 0; }
  .acts { list-style: none; display: flex; flex-direction: column; gap: 0; }
  .act-item {
    display: flex;
    align-items: stretch;
    gap: 8px;
    border-bottom: 1px solid var(--line);
  }
  .act-item.done .act-label { text-decoration: line-through; color: var(--ink-faint); }
  .act-check-btn {
    flex: none;
    align-self: center;
    padding: 8px 0 8px 2px;
  }
  .act-check {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    border: 1.5px solid var(--line-strong);
    font-size: 12px;
    font-weight: 700;
    color: transparent;
    background: var(--paper-2);
  }
  .act-check.on {
    background: var(--jade);
    border-color: var(--jade);
    color: #fff;
  }
  .act-item:last-child { border-bottom: none; }
  .act-num {
    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 12px;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--ink-faint);
    background: var(--paper-2);
    border-radius: 50%;
    border: 1px solid var(--line-strong);
  }
  .act-btn, .act-static {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 0;
    text-align: left;
    min-width: 0;
  }
  .act-label { font-weight: 500; font-size: 0.92rem; }
  .act-chev { color: var(--ink-faint); font-size: 1.2rem; flex: none; }
  .program-link {
    display: block;
    width: 100%;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink-faint);
    text-align: center;
    transition: color 0.15s;
  }
  .program-link:active { color: var(--cinabro-bright); }

  /* Stay */
  .stay-card { padding: 16px 18px; }
  .stay-top { display: flex; align-items: flex-start; gap: 12px; }
  .stay-icon { font-size: 1.4rem; flex: none; line-height: 1; margin-top: 2px; }
  .stay-info { flex: 1; min-width: 0; }
  .stay-info b { font-size: 0.95rem; }
  .stay-addr { font-size: 0.8rem; margin-top: 3px; line-height: 1.4; }
  .stay-warn {
    flex: none;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gold);
    background: var(--gold-soft);
    border-radius: 4px;
    padding: 3px 7px;
    white-space: nowrap;
  }
  .stay-dates {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
  }
  .sep { opacity: 0.35; }
  .stay-zh {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    margin-top: 12px;
    padding: 10px 14px;
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    text-align: left;
    transition: border-color 0.15s;
  }
  .stay-zh:active { border-color: var(--jade); }
  .zh { font-family: var(--hanzi); font-size: 1.1rem; color: var(--ink); }
  .zh-hint { font-family: var(--mono); font-size: 10px; color: var(--jade-bright); white-space: nowrap; }

  /* Transport */
  .transport-card {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    text-align: left;
    padding: 16px 18px;
  }
  .transport-icon { font-size: 1.6rem; flex: none; line-height: 1; }
  .transport-body { flex: 1; min-width: 0; }
  .transport-route {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 0.98rem;
  }
  .transport-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    margin-top: 6px;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
  }
  .warn-tag {
    color: var(--gold);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 9px;
  }
  .transport-chev { color: var(--ink-faint); font-size: 1.4rem; flex: none; }

  /* Bookings */
  .bookings-card { padding: 4px 18px; }
  .booking-row {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 13px 0;
    border-bottom: 1px solid var(--line);
  }
  .booking-row:last-child { border-bottom: none; }
  .booking-star { color: var(--gold); font-size: 13px; flex: none; }
  .booking-main { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .booking-note { font-size: 0.78rem; }
  .booking-chev { color: var(--ink-faint); font-size: 1.2rem; }

  /* Tools */
  .tools-block { margin-bottom: 0; }
  .tools-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 12px 6px 10px;
    min-height: 0;
    background: linear-gradient(160deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    text-align: left;
    transition: transform 0.15s var(--ease), border-color 0.15s;
  }
  .tool:active { transform: scale(0.98); border-color: rgba(224, 74, 40, 0.35); }
  .tool-icon { font-size: 1.35rem; line-height: 1; }
  .tool-label { font-weight: 600; font-size: 0.78rem; color: var(--ink); text-align: center; }
  .tool-desc { font-size: 0.65rem; color: var(--ink-faint); line-height: 1.25; text-align: center; }
</style>
