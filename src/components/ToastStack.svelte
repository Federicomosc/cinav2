<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { toastState } from '../lib/toast.svelte';
</script>

<div class="toast-stack" aria-live="polite" aria-atomic="false">
  {#each toastState.items as t (t.id)}
    <div class="toast toast-{t.kind}" in:fly={{ y: 12, duration: 280, easing: cubicOut }} out:fly={{ y: -8, duration: 200 }}>
      <span class="toast-dot" aria-hidden="true"></span>
      {t.msg}
    </div>
  {/each}
</div>

<style>
  .toast-stack {
    position: fixed;
    top: calc(var(--safe-top) + 12px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(420px, calc(100vw - 32px));
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 16px;
    border-radius: var(--radius-md);
    font-family: var(--mono);
    font-size: var(--text-xs, 10px);
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink);
    background: color-mix(in srgb, var(--surface-elevated) 92%, transparent);
    backdrop-filter: saturate(1.5) blur(20px);
    -webkit-backdrop-filter: saturate(1.5) blur(20px);
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-lg);
  }
  .toast-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex: none;
    background: var(--jade-bright);
    box-shadow: 0 0 8px var(--jade-soft);
  }
  .toast-info .toast-dot { background: var(--gold); box-shadow: 0 0 8px var(--gold-soft); }
  .toast-warn .toast-dot { background: var(--cinabro-bright); box-shadow: 0 0 8px var(--cinabro-glow); }
</style>
