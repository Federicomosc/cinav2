<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    seal?: string;
    eyebrow?: string;
    title: string;
    sub?: string;
    compact?: boolean;
    actions?: Snippet;
    class?: string;
  }
  let {
    seal = '旅',
    eyebrow,
    title,
    sub,
    compact = false,
    actions,
    class: className = '',
  }: Props = $props();
</script>

<header class="sh {className}" class:compact>
  <div class="deco" aria-hidden="true">
    <span class="line"></span>
    <span class="seal">{seal}</span>
    <span class="line"></span>
  </div>
  <div class="sh-row">
    <div class="sh-main">
      {#if eyebrow}<div class="eyebrow">{eyebrow}</div>{/if}
      <h1>{title}</h1>
      {#if sub}<p class="sub prose-lead">{sub}</p>{/if}
    </div>
    {#if actions}
      <div class="sh-actions">{@render actions()}</div>
    {/if}
  </div>
</header>

<style>
  .sh {
    margin-bottom: var(--space-5, 20px);
  }
  .sh.compact {
    margin-bottom: var(--space-3, 12px);
  }
  .deco {
    display: flex;
    align-items: center;
    gap: var(--space-3, 14px);
    margin-bottom: var(--space-4, 16px);
  }
  .sh.compact .deco {
    margin-bottom: var(--space-3, 12px);
  }
  .line {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--line-strong) 20%,
      color-mix(in srgb, var(--city-accent, var(--cinabro)) 35%, transparent) 50%,
      var(--line-strong) 80%,
      transparent
    );
  }
  .seal {
    flex: none;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    font-family: var(--hanzi);
    font-size: 15px;
    font-weight: 600;
    color: var(--city-accent, var(--cinabro-bright));
    background: color-mix(in srgb, var(--city-accent, var(--cinabro)) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--city-accent, var(--cinabro)) 30%, transparent);
    border-radius: var(--radius-xs, 8px);
    box-shadow:
      0 0 20px color-mix(in srgb, var(--city-accent, var(--cinabro)) 25%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .sh.compact .seal {
    width: 28px;
    height: 28px;
    font-size: 13px;
  }
  .sh-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4, 14px);
  }
  .sh-main {
    flex: 1;
    min-width: 0;
  }
  .sh-actions {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-2, 8px);
  }
  h1 {
    font-size: var(--text-hero, 2.4rem);
    margin: 4px 0 6px;
    letter-spacing: -0.025em;
    line-height: 1.02;
    background: linear-gradient(
      135deg,
      var(--ink) 0%,
      color-mix(in srgb, var(--ink-soft) 85%, var(--city-accent, var(--cinabro))) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sh.compact h1 {
    font-size: 2rem;
    margin: 2px 0 4px;
  }
  .sub {
    max-width: 36ch;
    margin-top: 4px;
    padding-left: var(--space-3, 14px);
    border-left: 2px solid color-mix(in srgb, var(--city-accent, var(--cinabro)) 45%, transparent);
  }
</style>
