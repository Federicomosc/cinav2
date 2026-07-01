<script lang="ts">
  import { itinerario, transports, cittaById, poisOfCity } from '../lib/content';
  import { computeOggi } from '../lib/today';
  import { shortDate, hhmm, daysBetween } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { cityTheme, cityCoverSrc } from '../lib/city-theme';
  import ShortcutIcon from '../components/ShortcutIcon.svelte';
  import type { CityId } from '../data/types';

  const info = computeOggi(itinerario, transports);

  const tripTotalDays = daysBetween(itinerario.trip.start, itinerario.trip.end) + 1;
  const tripDay = $derived(
    info.phase === 'before'
      ? 0
      : info.phase === 'after'
        ? tripTotalDays
        : daysBetween(itinerario.trip.start, info.todayIso) + 1,
  );
  const tripPct = $derived(Math.round((tripDay / tripTotalDays) * 100));

  // 2a — carta d'imbarco del primo volo (andata).
  const firstFlight = transports.find((t) => t.type === 'flight');
  function splitPlace(s: string): { code: string; name: string } {
    const i = s.indexOf('·');
    return i === -1
      ? { code: s.trim(), name: '' }
      : { code: s.slice(0, i).trim(), name: s.slice(i + 1).trim() };
  }
  const dep = firstFlight ? splitPlace(firstFlight.from) : null;
  const arr = firstFlight ? splitPlace(firstFlight.to) : null;
  const flightDate = firstFlight
    ? `${shortDate(firstFlight.departAt).toUpperCase()} ${firstFlight.departAt.slice(0, 4)}`
    : '';
  const boardTime = firstFlight ? hhmm(firstFlight.departAt) : '';
  const arriveTime = firstFlight?.arriveAt ? hhmm(firstFlight.arriveAt) : '';
  const arrivePlusDay =
    !!firstFlight?.arriveAt &&
    firstFlight.arriveAt.slice(0, 10) > firstFlight.departAt.slice(0, 10);

  // 2b — tappa corrente.
  const city = $derived(info.leg ? cittaById.get(info.leg.city) : undefined);
  const accent = $derived(info.leg ? cityTheme(info.leg.city).accent : '#e84828');
  const coverSrc = $derived(info.leg ? cityCoverSrc(info.leg.city) : '');
  const bookings = $derived(
    info.leg
      ? poisOfCity(info.leg.city).filter((p) => p.booking && /obblig/i.test(p.booking))
      : [],
  );
  function legIndex(cityId: CityId): number {
    return itinerario.legs.findIndex((l) => l.city === cityId) + 1;
  }

  // Barra di avanzamento: 2a = ultimo mese di attesa; 2b = arco del viaggio.
  const progFrom = $derived(
    info.phase === 'before' ? info.todayIso : itinerario.trip.start,
  );
  const progTo = $derived(
    info.phase === 'before' ? itinerario.trip.start : itinerario.trip.end,
  );
  const progPct = $derived(
    info.phase === 'before'
      ? Math.min(100, Math.max(3, Math.round(((30 - info.daysToStart) / 30) * 100)))
      : info.phase === 'after'
        ? 100
        : tripPct,
  );

  const todayPill = `${shortDate(info.todayIso).toUpperCase()} ${info.todayIso.slice(0, 4)}`;

  const eyebrow = $derived(
    info.phase === 'before'
      ? 'Pre-partenza'
      : info.phase === 'after'
        ? 'Viaggio concluso'
        : `In viaggio${city ? ` · ${city.name}` : ''}`,
  );

  const tools = [
    { route: 'frasario' as const, label: 'Frasario', hue: 'c' },
    { route: 'spese' as const, label: 'Valuta', hue: 'g' },
    { route: 'emergenze' as const, label: 'Salute', hue: 'j' },
    { route: 'mappa' as const, label: 'Mappa', hue: 'b' },
  ];
</script>

<div class="oggi" style={info.phase === 'during' && city ? `--accent:${accent}` : undefined}>
  <div class="top">
    <span class="eyebrow">{eyebrow}</span>
    <span class="live"><span class="live-dot" aria-hidden="true"></span>{todayPill}</span>
  </div>

  <!-- Numero gigante: countdown (2a) o giorno di viaggio (2b) -->
  <div class="hero framed">
    <span class="hero-frame" aria-hidden="true"></span>
    <span class="hero-wm" aria-hidden="true">
      {info.phase === 'during' && city ? city.nameLocal : '行'}
    </span>
    <div class="hero-inner">
      {#if info.phase === 'before'}
        <span class="hero-kicker">Mancano</span>
        <span class="hero-num">{info.daysToStart}</span>
        <span class="hero-rule" aria-hidden="true"></span>
        <span class="hero-sub">Giorni al volo</span>
      {:else if info.phase === 'after'}
        <span class="hero-kicker">Durata</span>
        <span class="hero-num">{tripTotalDays}</span>
        <span class="hero-rule" aria-hidden="true"></span>
        <span class="hero-sub">Giorni in Cina</span>
      {:else}
        <span class="hero-kicker">Giorno</span>
        <span class="hero-num">{tripDay}</span>
        <span class="hero-rule" aria-hidden="true"></span>
        <span class="hero-sub">di {tripTotalDays}{city ? ` · ${city.name}` : ''}</span>
      {/if}
    </div>
  </div>

  <!-- Avanzamento -->
  <div class="prog">
    <span class="prog-end">{shortDate(progFrom).toUpperCase()}</span>
    <span class="prog-track"><span class="prog-fill" class:during={info.phase === 'during'} style="width:{progPct}%"></span></span>
    <span class="prog-end goal">{shortDate(progTo).toUpperCase()}</span>
  </div>

  <!-- ===== 2a · carta d'imbarco ===== -->
  {#if info.phase === 'before' && firstFlight && dep && arr}
    <section class="pass">
      <div class="pass-bar" aria-hidden="true"></div>
      <span class="pass-wm" aria-hidden="true">行</span>
      <div class="pass-head">
        <span class="pass-kind">Carta d'imbarco</span>
        <span class="pass-code">{firstFlight.code} · {flightDate}</span>
      </div>
      <div class="pass-route">
        <div class="pass-end">
          <span class="iata">{dep.code}</span>
          <span class="apt">{dep.name}</span>
        </div>
        <div class="pass-mid">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="var(--cinabro-bright)" style="transform:rotate(90deg)">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5Z" />
          </svg>
          {#if arrivePlusDay}<span class="pass-mid-lbl">arrivo +1</span>{/if}
        </div>
        <div class="pass-end right">
          <span class="iata">{arr.code}</span>
          <span class="apt">{arr.name}</span>
        </div>
      </div>
      <div class="pass-perf" aria-hidden="true"><span class="notch l"></span><span class="notch r"></span></div>
      <div class="pass-stats">
        <div class="stat">
          <span class="stat-lbl">Imbarco</span>
          <span class="stat-val">{boardTime}</span>
        </div>
        {#if arriveTime}
          <div class="stat">
            <span class="stat-lbl">Arrivo</span>
            <span class="stat-val">{arriveTime}</span>
          </div>
        {/if}
        <div class="stat">
          <span class="stat-lbl">Giorni</span>
          <span class="stat-val gold">{tripTotalDays}</span>
        </div>
        <svg class="barcode" width="44" height="22" viewBox="0 0 44 22" aria-hidden="true">
          <g fill="var(--ink-faint)">
            <rect x="0" width="2" height="22" /><rect x="3" width="1" height="22" /><rect x="6" width="3" height="22" /><rect x="11" width="1" height="22" /><rect x="14" width="2" height="22" /><rect x="18" width="1" height="22" /><rect x="21" width="3" height="22" /><rect x="26" width="2" height="22" /><rect x="30" width="1" height="22" /><rect x="33" width="2" height="22" /><rect x="37" width="3" height="22" /><rect x="42" width="1" height="22" />
          </g>
        </svg>
      </div>
    </section>

    <div class="pass-btns">
      <button type="button" class="btn fill" onclick={() => go('documenti')}>
        <ShortcutIcon id="documenti" size={17} /> Documenti
      </button>
      <button type="button" class="btn ghost" onclick={() => go('logistica')}>
        <ShortcutIcon id="logistica" size={17} /> Itinerario
      </button>
    </div>

  <!-- ===== 2b · carta città ===== -->
  {:else if info.phase === 'during' && city}
    <section class="city" style="--accent:{accent}">
      <div class="city-cover">
        {#if coverSrc}<img src={coverSrc} alt="" loading="lazy" decoding="async" />{/if}
        <div class="city-scrim" aria-hidden="true"></div>
        <span class="city-wm" aria-hidden="true">{city.nameLocal}</span>
        <div class="city-titles">
          <span class="city-tag">Tappa {legIndex(city.id)} · sei qui</span>
          <h2 class="city-name">{city.name}</h2>
          <span class="city-cn">{city.nameLocal}</span>
        </div>
        <div class="city-line" aria-hidden="true"></div>
      </div>
      <div class="city-foot">
        {#if bookings.length}
          <span class="city-warn">{bookings.length} da prenotare</span>
        {:else}
          <span class="city-warn ok">Tutto pronto</span>
        {/if}
        <div class="city-btns">
          <button type="button" class="btn fill sm" onclick={() => go('citta', city.id)}>Guida</button>
          <button type="button" class="btn ghost sm" onclick={() => go('mappa')}>Mappa</button>
        </div>
      </div>
    </section>

  <!-- ===== viaggio concluso ===== -->
  {:else if info.phase === 'after'}
    <section class="done">
      <span class="done-seal" aria-hidden="true">✦</span>
      <h2 class="done-h">Viaggio concluso</h2>
      <p class="done-p">{itinerario.legs.length} tappe · {tripTotalDays} giorni</p>
      <button type="button" class="btn fill" onclick={() => go('album')}>Apri Album</button>
    </section>
  {/if}

  <!-- Strumenti -->
  <section class="tools">
    <span class="tools-h">Strumenti</span>
    <div class="tools-grid">
      {#each tools as t (t.route)}
        <button type="button" class="tool hue-{t.hue}" onclick={() => go(t.route)}>
          <span class="tool-ic"><ShortcutIcon id={t.route} size={19} /></span>
          <span class="tool-lbl">{t.label}</span>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .oggi {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 6px 0 14px;
  }

  /* ── Top: eyebrow + data viva ── */
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 8px;
    /* lascia spazio al toggle tema fisso in alto a destra */
    padding-right: 46px;
  }
  .eyebrow {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--cinabro-bright);
  }
  .live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
    padding: 5px 11px;
    border: 1px solid color-mix(in srgb, var(--cinabro) 28%, transparent);
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--cinabro) 8%, transparent);
  }
  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--cinabro-bright);
    box-shadow: 0 0 8px var(--cinabro-bright);
    animation: live 2s ease-in-out infinite;
  }
  @keyframes live { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  /* ── Numero gigante — folio imperiale incorniciato ── */
  .hero {
    position: relative;
    text-align: center;
    margin: 26px 0 18px;
    padding: 34px 22px 26px;
  }
  .hero.framed {
    overflow: hidden;
    border-radius: var(--radius-lg);
    background:
      radial-gradient(120% 92% at 50% 4%, color-mix(in srgb, var(--accent, var(--cinabro)) 15%, transparent) 0%, transparent 60%),
      linear-gradient(180deg, color-mix(in srgb, var(--surface) 62%, transparent) 0%, color-mix(in srgb, var(--paper) 50%, transparent) 100%);
    box-shadow: 0 24px 60px -30px rgba(0, 0, 0, 0.7);
  }
  /* Doppio filo dorato + angoli: cornice da folio imperiale */
  .hero-frame {
    position: absolute;
    inset: 9px;
    border-radius: 17px;
    border: 1px solid color-mix(in srgb, var(--gold) 36%, transparent);
    box-shadow:
      inset 0 0 0 5px color-mix(in srgb, var(--gold) 7%, transparent),
      0 0 48px -20px rgba(228, 176, 74, 0.55);
    pointer-events: none;
  }
  .hero-frame::before,
  .hero-frame::after {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    border: 2px solid var(--gold-bright);
    filter: drop-shadow(0 0 6px rgba(228, 176, 74, 0.55));
  }
  .hero-frame::before {
    top: -1px;
    left: -1px;
    border-right: none;
    border-bottom: none;
    border-radius: 7px 0 0 0;
  }
  .hero-frame::after {
    bottom: -1px;
    right: -1px;
    border-left: none;
    border-top: none;
    border-radius: 0 0 7px 0;
  }
  .hero-wm {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-family: var(--hanzi);
    font-weight: 600;
    font-size: 7.2rem;
    line-height: 1;
    color: color-mix(in srgb, var(--gold) 7%, transparent);
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    z-index: 0;
  }
  .hero-inner { position: relative; z-index: 1; }
  .hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .hero-kicker::before,
  .hero-kicker::after {
    content: '';
    width: 18px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold));
  }
  .hero-kicker::after { transform: scaleX(-1); }
  /* Divisore a diamante dorato tra numero e sottotitolo */
  .hero-rule {
    position: relative;
    display: block;
    width: 66px;
    height: 1px;
    margin: 12px auto 12px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--gold-bright) 80%, transparent), transparent);
  }
  .hero-rule::before {
    content: '◆';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 7px;
    color: var(--gold-bright);
    text-shadow: 0 0 8px rgba(228, 176, 74, 0.7);
  }
  .hero-num {
    display: block;
    font-family: var(--serif);
    font-weight: 700;
    font-size: 7.6rem;
    line-height: 1;
    padding-top: 0.08em;
    letter-spacing: -0.04em;
    background: linear-gradient(155deg, #ffdca6 0%, var(--cinabro-bright) 32%, var(--cinabro) 62%, var(--gold-bright) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    filter:
      drop-shadow(0 6px 26px color-mix(in srgb, var(--cinabro) 45%, transparent))
      drop-shadow(0 2px 12px rgba(228, 176, 74, 0.32));
  }
  .hero-sub {
    display: block;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    color: var(--ink-soft);
    margin-top: 8px;
    padding-left: 0.34em;
  }

  /* ── Avanzamento ── */
  .prog {
    display: flex;
    align-items: center;
    gap: 11px;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }
  .prog-end.goal { color: var(--gold); }
  .prog-track {
    flex: 1;
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--line);
    overflow: hidden;
  }
  .prog-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--cinabro), var(--gold));
  }
  .prog-fill.during {
    background: linear-gradient(90deg, var(--cinabro), var(--jade));
  }

  /* ── Bottoni ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: var(--ui, var(--mono));
    font-size: 0.82rem;
    font-weight: 600;
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    transition: transform 0.15s var(--ease);
  }
  .btn:active { transform: scale(0.97); }
  .btn.fill {
    color: #fff;
    background: linear-gradient(135deg, var(--cinabro-bright), var(--cinabro));
    border: 1px solid color-mix(in srgb, var(--cinabro) 45%, transparent);
    box-shadow: 0 4px 14px var(--cinabro-glow);
  }
  .btn.ghost {
    color: var(--ink-soft);
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
  }
  .btn.sm { padding: 7px 13px; font-size: 0.72rem; border-radius: 11px; }
  .pass-btns { display: flex; gap: 10px; }
  .pass-btns .btn { flex: 1; }

  /* ── 2a · carta d'imbarco ── */
  .pass {
    position: relative;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: linear-gradient(158deg, var(--surface-hi), var(--surface) 60%, var(--paper-2));
    border: 1px solid color-mix(in srgb, var(--cinabro) 22%, var(--line-strong));
    box-shadow: var(--shadow-md), 0 0 50px -16px var(--cinabro-glow);
  }
  .pass-bar {
    height: 4px;
    background: linear-gradient(90deg, var(--cinabro), var(--cinabro-bright) 35%, var(--gold) 70%, var(--cinabro));
  }
  .pass-wm {
    position: absolute;
    right: 16px;
    bottom: 58px;
    font-family: var(--hanzi);
    font-size: 5.4rem;
    font-weight: 600;
    line-height: 1;
    color: color-mix(in srgb, var(--ink) 4%, transparent);
    pointer-events: none;
    user-select: none;
  }
  .pass-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 16px 0;
    font-family: var(--mono);
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .pass-kind { color: var(--gold); }
  .pass-route {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 6px;
    padding: 12px 16px 14px;
  }
  .pass-end { min-width: 0; }
  .pass-end.right { text-align: right; }
  .iata {
    display: block;
    font-family: var(--serif);
    font-size: 2.35rem;
    font-weight: 700;
    line-height: 0.85;
    color: var(--ink);
  }
  .apt {
    display: block;
    font-size: 9px;
    color: var(--ink-faint);
    margin-top: 5px;
    max-width: 86px;
    line-height: 1.3;
  }
  .pass-end.right .apt { margin-left: auto; }
  .pass-mid {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding-bottom: 20px;
  }
  .pass-mid-lbl {
    font-family: var(--mono);
    font-size: 7.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .pass-perf {
    position: relative;
    height: 1px;
    margin: 0 14px;
    border-top: 1.5px dashed var(--line-strong);
  }
  .notch {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--paper);
  }
  .notch.l { left: -23px; }
  .notch.r { right: -23px; }
  .pass-stats {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px 16px;
  }
  .stat-lbl {
    display: block;
    font-family: var(--mono);
    font-size: 7.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .stat-val {
    display: block;
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    margin-top: 3px;
  }
  .stat-val.gold { color: var(--gold); }
  .barcode { align-self: flex-end; opacity: 0.85; }

  /* ── 2b · carta città ── */
  .city {
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--line-strong));
    box-shadow: var(--shadow-md), 0 16px 44px -18px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .city-cover {
    position: relative;
    height: 150px;
    overflow: hidden;
    background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 28%, #1a120c), #1a120c 60%);
  }
  .city-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(1.12) contrast(1.04);
  }
  .city-scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(125deg, color-mix(in srgb, var(--accent) 18%, transparent), transparent 45%),
      linear-gradient(180deg, transparent 22%, rgba(0, 0, 0, 0.78));
  }
  .city-wm {
    position: absolute;
    right: 6px;
    top: -12px;
    font-family: var(--hanzi);
    font-size: 7.6rem;
    font-weight: 600;
    line-height: 1;
    color: rgba(255, 255, 255, 0.05);
    pointer-events: none;
    user-select: none;
  }
  .city-titles {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 13px;
    z-index: 2;
  }
  .city-tag {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: color-mix(in srgb, #fff 78%, var(--accent));
  }
  .city-name {
    font-family: var(--serif);
    font-size: 1.85rem;
    font-weight: 600;
    line-height: 1.02;
    color: #fff;
    margin: 3px 0 0;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  }
  .city-cn {
    display: block;
    font-family: var(--hanzi);
    font-size: 1rem;
    color: color-mix(in srgb, #fff 82%, var(--accent));
    text-shadow: 0 0 18px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .city-line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), transparent);
    box-shadow: 0 -6px 20px color-mix(in srgb, var(--accent) 45%, transparent);
    z-index: 3;
  }
  .city-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 14px 13px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 5%, var(--surface)), var(--surface));
  }
  .city-warn {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--cinabro-bright);
  }
  .city-warn.ok { color: var(--jade-bright); }
  .city-btns { display: flex; gap: 6px; margin-left: auto; }

  /* ── Viaggio concluso ── */
  .done {
    text-align: center;
    padding: 28px 20px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--line-strong);
    background: linear-gradient(168deg, var(--surface-hi), var(--surface));
  }
  .done-seal { font-size: 1.5rem; color: var(--gold); line-height: 1; }
  .done-h { font-family: var(--serif); font-size: 1.6rem; margin: 10px 0 4px; color: var(--ink); }
  .done-p { font-size: 0.88rem; color: var(--ink-faint); margin: 0 0 16px; }

  /* ── Strumenti ── */
  .tools { margin-top: 2px; }
  .tools-h {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 10px;
  }
  .tools-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    padding: 4px 2px;
  }
  .tool-ic {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: var(--cinabro-soft);
    color: var(--cinabro-bright);
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    transition: transform 0.15s var(--ease);
  }
  .tool:active .tool-ic { transform: scale(0.92); }
  .tool-lbl {
    font-size: 0.6rem;
    color: var(--ink-soft);
    line-height: 1.2;
    text-align: center;
  }
  .tool.hue-c .tool-ic { background: var(--cinabro-soft); color: var(--cinabro-bright); }
  .tool.hue-g .tool-ic { background: var(--gold-soft); color: var(--gold); }
  .tool.hue-j .tool-ic { background: var(--jade-soft); color: var(--jade-bright); }
  .tool.hue-b .tool-ic { background: var(--hue-teal-soft); color: var(--hue-teal); }
  .tool.hue-p .tool-ic { background: var(--hue-purple-soft); color: var(--hue-purple); }
</style>
