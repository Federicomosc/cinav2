<script lang="ts">
  import { cityThemeByItalianName } from '../lib/city-theme';
  import { shortDate } from '../lib/format';
  import type { Giorno } from '../data/types';

  interface Props {
    giorni: Giorno[];
    focus: number;
    todayIso: string;
    onPick: (n: number) => void;
  }
  let { giorni, focus, todayIso, onPick }: Props = $props();
</script>

<details class="overview">
  <summary>
    <span class="ov-sum-label">Panoramica</span>
    <span class="ov-sum-sub">Tutti i 20 giorni</span>
    <span class="ov-chev" aria-hidden="true">›</span>
  </summary>
  <div class="ov-list">
    {#each giorni as g (g.n)}
      {@const cm = cityThemeByItalianName(g.city)}
      <button
        class="ov-row"
        class:on={focus === g.n}
        class:today={g.date === todayIso}
        style="--c:{cm.accent}"
        onclick={() => onPick(g.n)}
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

<style>
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
