<script lang="ts">
  import { giorni, transports, itinerario } from '../lib/content';
  import { actId } from '../lib/acts';
  import { computeOggi } from '../lib/today';
  import { db, now } from '../db/dexie';
  import { liveQuery } from 'dexie';
  import { cityThemeByItalianName } from '../lib/city-theme';
  import { daySwipe } from '../lib/day-swipe';
  import { haptic } from '../lib/haptic';
  import ScreenHeader from '../components/ScreenHeader.svelte';
  import TripMeter from '../components/TripMeter.svelte';
  import DayChips from '../components/DayChips.svelte';
  import DaySheetCard from '../components/DaySheetCard.svelte';
  import DayOverview from '../components/DayOverview.svelte';
  import { showToast } from '../lib/toast.svelte';

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
  const meta = $derived(cityThemeByItalianName(day.city));
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
</script>

<div class="agenda" style="--day-accent: {meta.accent}">
  <ScreenHeader
    seal="程"
    eyebrow="Agenda · 20 giorni"
    title="Il viaggio"
    sub="Scorri la scheda o i chip per navigare giorno per giorno."
  />

  <TripMeter {giorni} {day} {focus} todayIso={oggi.todayIso} {tripPct} onPick={pick} />

  <DayChips {giorni} {focus} {focusReady} todayIso={oggi.todayIso} onPick={pick} onPrev={prev} onNext={next} />

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

    <DaySheetCard
      {day}
      {focus}
      todayIso={oggi.todayIso}
      {slideDir}
      {checkedActs}
      onToggleAct={toggleAct}
      onPrev={prev}
      onNext={next}
    />
  </div>

  <!-- Panoramica rapida (tutti i giorni, compatto) -->
  <DayOverview {giorni} {focus} todayIso={oggi.todayIso} onPick={pick} />
</div>

<style>
  .agenda { padding-bottom: 24px; }

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
</style>
