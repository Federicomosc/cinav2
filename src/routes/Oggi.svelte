<script lang="ts">
  import {
    itinerario,
    transports,
    cittaById,
    poisOfCity,
    giorni,
  } from '../lib/content';
  import { computeOggi } from '../lib/today';
  import { longDate, hhmm, shortDate, daysBetween } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { actId } from '../lib/acts';
  import { db, now } from '../db/dexie';
  import { liveQuery } from 'dexie';
  import { onMount } from 'svelte';
  import type { CityId } from '../data/types';
  import { cityTheme, cityCoverSrc } from '../lib/city-theme';
  import ScreenHeader from '../components/ScreenHeader.svelte';
  import ShortcutIcon from '../components/ShortcutIcon.svelte';
  import { haptic } from '../lib/haptic';
  import { showToast } from '../lib/toast.svelte';

  const info = computeOggi(itinerario, transports);
  const city = $derived(info.leg ? cittaById.get(info.leg.city) : undefined);
  const nt = info.nextTransport;
  const typeLabel: Record<string, string> = { flight: 'Volo', train: 'Treno', bus: 'Bus' };

  const accent = $derived(info.leg ? cityTheme(info.leg.city).accent : '#e84828');
  const theme = $derived(info.leg ? cityTheme(info.leg.city) : null);
  const coverSrc = $derived(info.leg ? cityCoverSrc(info.leg.city) : '');

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
  const visibleActs = $derived(todayProgram?.acts.slice(0, 4) ?? []);
  const moreActs = $derived(
    todayProgram && todayProgram.acts.length > 4 ? todayProgram.acts.length - 4 : 0,
  );

  const bookings = $derived(
    info.leg ? poisOfCity(info.leg.city).filter((p) => p.booking && /obblig/i.test(p.booking)) : [],
  );

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
    else {
      await db.actChecks.put({ id, checkedAt: now() });
      haptic(10);
      showToast('Attività completata');
    }
  }

  const todayProgress = $derived(
    todayProgram?.acts.length
      ? todayProgram.acts.filter((a) => checkedActs.has(actId(todayProgram.n, a.label))).length
      : 0,
  );
  const todayAllDone = $derived(
    !!todayProgram?.acts.length && todayProgress === todayProgram.acts.length,
  );

  const shortcuts = [
    { route: 'frasario' as const, label: 'Frasario', desc: 'Al tassista', hue: 'c' },
    { route: 'spese' as const, label: 'Valuta', desc: 'Converti', hue: 'g' },
    { route: 'emergenze' as const, label: 'Salute', desc: 'SOS', hue: 'j' },
    { route: 'mappa' as const, label: 'Mappa', desc: 'GPS', hue: 'b' },
    { route: 'documenti' as const, label: 'Documenti', desc: 'Cassaforte', hue: 'p' },
    { route: 'logistica' as const, label: 'Viaggio', desc: '20 giorni', hue: 'r' },
  ];

  function legIndex(cityId: CityId): number {
    return itinerario.legs.findIndex((l) => l.city === cityId) + 1;
  }
</script>

<div class="oggi" style={info.phase === 'during' && city ? `--accent:${accent}` : undefined}>
  {#if info.phase === 'before'}
    <ScreenHeader seal="今" eyebrow="Pre-partenza" title="Oggi" sub={longDate(info.todayIso)} compact />

    <section class="pre card">
      <div class="pre-bar" aria-hidden="true"></div>
      <span class="pre-wm" aria-hidden="true">行</span>
      <div class="pre-body">
        <div class="pre-ring-wrap">
          <svg class="pre-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-bg" cx="60" cy="60" r="52" />
            <circle
              class="ring-fg"
              cx="60"
              cy="60"
              r="52"
              style="stroke-dasharray: 326; stroke-dashoffset: {326 - (326 * Math.min(info.daysToStart, 30)) / 30}"
            />
          </svg>
          <div class="pre-count">
            <span class="pre-num">{info.daysToStart}</span>
            <span class="pre-lbl">giorni</span>
          </div>
        </div>
        <p class="pre-date">Partenza <strong>{shortDate(itinerario.trip.start)}</strong></p>
        <div class="pre-btns">
          <button type="button" class="btn-fill" onclick={() => go('documenti')}>Documenti</button>
          <button type="button" class="btn-ghost" onclick={() => go('logistica')}>Itinerario</button>
        </div>
      </div>
    </section>

  {:else}
    <ScreenHeader seal="今" title="Oggi" compact>
      {#snippet actions()}
        {#if info.phase === 'during'}
          <span class="pill live">
            <span class="live-dot" aria-hidden="true"></span>
            {tripDay}/{tripTotalDays}
          </span>
        {:else}
          <span class="pill">Concluso</span>
        {/if}
        <time class="pill muted" datetime={info.todayIso}>{shortDate(info.todayIso)}</time>
      {/snippet}
    </ScreenHeader>

    {#if info.phase === 'during'}
      <div class="trip-bar" aria-label="Avanzamento {tripPct}%">
        <div class="trip-fill" style="width:{tripPct}%"></div>
      </div>
    {/if}

    {#if info.phase === 'after'}
      <section class="done card">
        <span class="done-seal" aria-hidden="true">✦</span>
        <h2 class="done-h">Viaggio concluso</h2>
        <p class="done-p">{itinerario.legs.length} tappe · {tripTotalDays} giorni</p>
        <button type="button" class="btn-fill" onclick={() => go('album')}>Apri Album</button>
      </section>

    {:else if city && theme}
      <section class="city card" style="--accent:{accent}">
        <div class="city-cover">
          <img src={coverSrc} alt="" loading="lazy" decoding="async" />
          <div class="city-scrim" aria-hidden="true"></div>
          <div class="city-line" aria-hidden="true"></div>
          <span class="city-wm" aria-hidden="true">{city.nameLocal}</span>
          <div class="city-titles">
            <span class="city-tag">Tappa {legIndex(city.id)}</span>
            <h2 class="city-name">{city.name}</h2>
            <span class="city-cn">{city.nameLocal}</span>
          </div>
        </div>
        <div class="city-foot">
          {#if bookings.length}
            <span class="city-warn">{bookings.length} da prenotare</span>
          {/if}
          <div class="city-btns">
            <button type="button" class="btn-fill sm" onclick={() => go('citta', city.id)}>Guida</button>
            <button type="button" class="btn-ghost sm" onclick={() => go('mappa')}>Mappa</button>
          </div>
        </div>
      </section>

      {#if todayProgram}
        <section class="program card">
          <div class="program-head">
            <h3 class="program-title">{todayProgram.title}</h3>
            <span class="program-stat" class:ok={todayAllDone}>
              {#if todayAllDone}
                Fatto
              {:else if todayProgram.acts.length}
                {todayProgress}/{todayProgram.acts.length}
              {:else}
                Libero
              {/if}
            </span>
          </div>

          {#if todayProgram.acts.length}
            <div class="program-track" aria-hidden="true">
              <div
                class="program-fill"
                class:ok={todayAllDone}
                style="width:{Math.round((todayProgress / todayProgram.acts.length) * 100)}%"
              ></div>
            </div>
            <ul class="acts">
              {#each visibleActs as act, i (act.label)}
                {@const done = checkedActs.has(actId(todayProgram.n, act.label))}
                <li class="act" class:done>
                  <button
                    type="button"
                    class="check"
                    class:on={done}
                    aria-label={done ? 'Segna da fare' : 'Segna fatto'}
                    aria-pressed={done}
                    onclick={() => toggleAct(todayProgram.n, act.label)}
                  >{#if done}✓{/if}</button>
                  {#if act.poi}
                    <button type="button" class="act-body" onclick={() => go('poi', act.poi!)}>
                      <span class="act-n">{i + 1}</span>
                      <span class="act-txt">{act.label}</span>
                      <span class="act-go" aria-hidden="true">›</span>
                    </button>
                  {:else}
                    <div class="act-body plain">
                      <span class="act-n">{i + 1}</span>
                      <span class="act-txt">{act.label}</span>
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if moreActs > 0}
              <button type="button" class="program-more" onclick={() => go('logistica')}>
                +{moreActs} attività · Itinerario ›
              </button>
            {:else}
              <button type="button" class="program-more" onclick={() => go('logistica')}>
                Itinerario completo ›
              </button>
            {/if}
          {:else}
            <p class="program-free">Giornata libera</p>
          {/if}
        </section>
      {/if}
    {/if}
  {/if}

  {#if nt}
    <button type="button" class="move card accent-card card-interactive" onclick={() => go('logistica')}>
      <div class="move-body">
        <span class="move-lbl">Prossimo spostamento</span>
        <span class="move-route">{nt.from} → {nt.to}</span>
        <span class="move-meta">
          {typeLabel[nt.type]}
          · {shortDate(nt.departAt)}
          {#if hhmm(nt.departAt)} · {hhmm(nt.departAt)}{/if}
        </span>
      </div>
      <span class="move-go" aria-hidden="true">›</span>
    </button>
  {/if}

  <section class="tools">
    <h2 class="tools-h">Strumenti</h2>
    <div class="shortcut-grid">
      {#each shortcuts as s (s.route)}
        <button type="button" class="shortcut-btn hue-{s.hue} pressable" onclick={() => go(s.route)}>
          <span class="sc-icon"><ShortcutIcon id={s.route} size={20} /></span>
          <span class="sc-label">{s.label}</span>
          <span class="sc-desc">{s.desc}</span>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .oggi {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 12px;
  }

  /* Pills header */
  .pill {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 5px 10px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink-soft);
  }
  .pill.live {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--accent, var(--cinabro-bright));
    background: color-mix(in srgb, var(--accent, var(--cinabro)) 12%, transparent);
    border-color: color-mix(in srgb, var(--accent, var(--cinabro)) 28%, transparent);
  }
  .pill.muted { color: var(--ink-faint); }
  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent, var(--cinabro-bright));
    box-shadow: 0 0 6px color-mix(in srgb, var(--accent, var(--cinabro)) 50%, transparent);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .trip-bar {
    height: 3px;
    margin: -4px 0 2px;
    border-radius: var(--radius-pill);
    background: var(--line);
    overflow: hidden;
  }
  .trip-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent, var(--cinabro)), var(--jade));
    border-radius: inherit;
    transition: width 0.45s var(--ease);
  }

  /* Buttons */
  .btn-fill, .btn-ghost {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    transition: transform 0.15s var(--ease);
  }
  .btn-fill:active, .btn-ghost:active { transform: scale(0.97); }
  .btn-fill {
    color: #fff;
    background: linear-gradient(135deg, var(--cinabro-bright), var(--cinabro));
    border: 1px solid color-mix(in srgb, var(--cinabro) 40%, transparent);
    box-shadow: 0 4px 14px var(--cinabro-glow);
  }
  .btn-fill.sm {
    background: linear-gradient(135deg, var(--accent, var(--cinabro-bright)), var(--accent, var(--cinabro)));
    border-color: color-mix(in srgb, var(--accent, var(--cinabro)) 40%, transparent);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--accent, var(--cinabro)) 30%, transparent);
  }
  .btn-ghost {
    color: var(--ink-soft);
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
  }

  /* Pre-partenza */
  .pre {
    position: relative;
    overflow: hidden;
    padding: 0;
    border-color: color-mix(in srgb, var(--cinabro) 22%, var(--line-strong));
    background: linear-gradient(
      168deg,
      color-mix(in srgb, var(--cinabro) 9%, var(--surface-hi)) 0%,
      var(--surface) 100%
    );
    box-shadow: var(--shadow-md), 0 0 36px color-mix(in srgb, var(--cinabro) 10%, transparent);
  }
  .pre-bar {
    height: 3px;
    background: linear-gradient(90deg, var(--cinabro-bright), var(--gold), transparent);
    box-shadow: 0 2px 12px var(--cinabro-glow);
  }
  .pre-wm {
    position: absolute;
    right: 8px;
    top: 20px;
    font-family: var(--hanzi);
    font-size: 4.5rem;
    font-weight: 600;
    line-height: 1;
    color: color-mix(in srgb, var(--cinabro) 12%, transparent);
    pointer-events: none;
    user-select: none;
  }
  .pre-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
    padding: 20px 18px 22px;
  }
  .pre-ring-wrap {
    position: relative;
    width: 100px;
    height: 100px;
  }
  .pre-ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
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
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--ink);
  }
  .pre-lbl {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .pre-date {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-soft);
    margin: 0;
  }
  .pre-date strong { color: var(--ink); }
  .pre-btns {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 260px;
  }
  .pre-btns .btn-fill,
  .pre-btns .btn-ghost { flex: 1; }

  /* Viaggio concluso */
  .done {
    text-align: center;
    padding: 28px 20px;
  }
  .done-seal {
    font-size: 1.5rem;
    color: var(--gold);
    line-height: 1;
  }
  .done-h {
    font-family: var(--serif);
    font-size: 1.6rem;
    margin: 10px 0 4px;
    color: var(--ink);
  }
  .done-p {
    font-size: 0.88rem;
    color: var(--ink-faint);
    margin: 0 0 16px;
  }

  /* Città hero */
  .city {
    padding: 0;
    overflow: hidden;
    border-color: color-mix(in srgb, var(--accent) 26%, var(--line-strong));
    box-shadow:
      var(--shadow-md),
      0 16px 40px color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .city-cover {
    position: relative;
    height: 132px;
    overflow: hidden;
  }
  .city-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(1.15) contrast(1.05);
  }
  .city-scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(125deg, color-mix(in srgb, var(--accent) 15%, #000) 0%, transparent 45%),
      linear-gradient(180deg, transparent 20%, color-mix(in srgb, #000 75%, transparent) 100%);
  }
  .city-line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), transparent);
    box-shadow: 0 -6px 20px color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .city-wm {
    position: absolute;
    right: 4px;
    top: 0;
    font-family: var(--hanzi);
    font-size: 4rem;
    font-weight: 600;
    line-height: 1;
    color: color-mix(in srgb, #fff 8%, var(--accent));
    opacity: 0.5;
    pointer-events: none;
    user-select: none;
  }
  .city-titles {
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 12px;
    z-index: 2;
  }
  .city-tag {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, #fff 90%, var(--accent));
    opacity: 0.9;
  }
  .city-name {
    font-family: var(--serif);
    font-size: 1.65rem;
    font-weight: 600;
    line-height: 1.05;
    color: #fff;
    margin: 4px 0 0;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  }
  .city-cn {
    display: block;
    font-family: var(--hanzi);
    font-size: 1.1rem;
    color: color-mix(in srgb, #fff 85%, var(--accent));
    text-shadow: 0 0 20px color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .city-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px 12px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 5%, var(--surface)) 0%, var(--surface) 100%);
  }
  .city-warn {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--cinabro-bright);
  }
  .city-btns {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }
  .city-btns .btn-fill.sm,
  .city-btns .btn-ghost.sm {
    padding: 7px 12px;
    font-size: 9px;
  }

  /* Programma */
  .program {
    padding: 14px 14px 12px;
    border-color: color-mix(in srgb, var(--accent, var(--line-strong)) 20%, var(--line-strong));
  }
  .program-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }
  .program-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--ink);
    margin: 0;
    line-height: 1.3;
  }
  .program-stat {
    flex: none;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-faint);
    padding: 4px 8px;
    border-radius: var(--radius-pill);
    background: var(--paper-2);
    border: 1px solid var(--line);
  }
  .program-stat.ok {
    color: var(--jade-bright);
    background: var(--jade-soft);
    border-color: color-mix(in srgb, var(--jade) 35%, transparent);
  }
  .program-track {
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--line);
    overflow: hidden;
    margin-bottom: 10px;
  }
  .program-fill {
    height: 100%;
    background: var(--accent, var(--cinabro));
    border-radius: inherit;
    transition: width 0.35s var(--ease);
  }
  .program-fill.ok { background: var(--jade); }
  .acts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .act {
    display: flex;
    align-items: stretch;
    gap: 8px;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .check {
    flex: none;
    width: 32px;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 700;
    color: transparent;
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .check.on {
    color: #fff;
    background: var(--jade);
    border-color: var(--jade);
  }
  .act-body {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 10px;
    text-align: left;
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
  }
  .act-body.plain { background: transparent; border-color: transparent; }
  button.act-body:active { background: color-mix(in srgb, var(--accent, var(--cinabro)) 8%, var(--paper-2)); }
  .act.done .act-txt {
    text-decoration: line-through;
    color: var(--ink-faint);
  }
  .act-n {
    flex: none;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    color: var(--accent, var(--ink-faint));
    background: color-mix(in srgb, var(--accent, var(--paper-2)) 10%, var(--paper-2));
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--accent, var(--line)) 30%, var(--line));
  }
  .act-txt {
    flex: 1;
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.3;
  }
  .act-go {
    color: var(--accent, var(--cinabro-bright));
    font-size: 1.1rem;
  }
  .program-more {
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 8px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-faint);
    text-align: center;
  }
  .program-free {
    font-size: 0.88rem;
    color: var(--ink-faint);
    margin: 0;
    padding: 8px 0;
  }

  /* Trasporto */
  .move {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px 12px 18px;
    text-align: left;
  }
  .move-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .move-lbl {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .move-route {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .move-meta {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--ink-faint);
  }
  .move-go {
    flex: none;
    color: var(--ink-faint);
    font-size: 1.15rem;
    line-height: 1;
  }

  /* Strumenti */
  .tools-h {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin: 4px 0 0;
  }
  .tools .shortcut-grid { margin-top: 8px; }
</style>
