<script lang="ts">
  import { cityThemeByItalianName } from '../lib/city-theme';
  import type { Giorno } from '../data/types';

  interface Props {
    giorni: Giorno[];
    day: Giorno;
    focus: number;
    todayIso: string;
    tripPct: number;
    onPick: (n: number) => void;
  }
  let { giorni, day, focus, todayIso, tripPct, onPick }: Props = $props();

  const meta = $derived(cityThemeByItalianName(day.city));
</script>

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
      {@const cm = cityThemeByItalianName(g.city)}
      <button
        type="button"
        class="trip-dot"
        class:on={focus === g.n}
        class:today={g.date === todayIso}
        style="--c:{cm.accent}"
        onclick={() => onPick(g.n)}
        aria-label="Giorno {g.n}"
      ></button>
    {/each}
  </div>
</div>

<style>
  .trip-meter {
    margin-bottom: 14px;
    padding: 16px 18px 14px;
    background: color-mix(in srgb, var(--surface-elevated) 85%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
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
</style>
