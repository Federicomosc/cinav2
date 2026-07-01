<script lang="ts">
  import { cityThemeByItalianName } from '../lib/city-theme';
  import { shortDate } from '../lib/format';
  import type { Giorno } from '../data/types';

  interface Props {
    giorni: Giorno[];
    focus: number;
    focusReady: boolean;
    todayIso: string;
    onPick: (n: number) => void;
    onPrev: () => void;
    onNext: () => void;
  }
  let { giorni, focus, focusReady, todayIso, onPick, onPrev, onNext }: Props = $props();

  let chipRow: HTMLDivElement | undefined = $state();

  // scroll chip attivo al centro
  $effect(() => {
    if (!focusReady || !chipRow) return;
    const el = chipRow.querySelector(`[data-n="${focus}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
</script>

<nav class="day-nav" aria-label="Navigazione giorni">
  <button class="nav-btn" onclick={onPrev} disabled={focus <= 1} aria-label="Giorno precedente">‹</button>

  <div class="day-chips" bind:this={chipRow}>
    {#each giorni as g (g.n)}
      {@const cm = cityThemeByItalianName(g.city)}
      {@const isT = g.date === todayIso}
      <button
        class="day-chip"
        class:on={focus === g.n}
        class:today={isT}
        data-n={g.n}
        style="--c:{cm.accent}"
        onclick={() => onPick(g.n)}
        aria-current={focus === g.n ? 'step' : undefined}
        aria-label="Giorno {g.n}, {shortDate(g.date)}"
      >
        <span class="day-chip-n">{g.n}</span>
        <span class="day-chip-dm">{shortDate(g.date)}</span>
        {#if isT}<span class="day-chip-dot" aria-hidden="true"></span>{/if}
      </button>
    {/each}
  </div>

  <button class="nav-btn" onclick={onNext} disabled={focus >= 20} aria-label="Giorno successivo">›</button>
</nav>

<style>
  .day-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--surface-elevated) 88%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
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
</style>
