<script lang="ts">
  import { theme, toggleNightMode } from '../lib/theme.svelte';
  import { haptic } from '../lib/haptic';

  interface Props {
    class?: string;
  }
  let { class: className = '' }: Props = $props();

  function toggle() {
    haptic(6);
    toggleNightMode();
  }
</script>

<button
  type="button"
  class="theme-toggle {className}"
  class:on={theme.nightMode}
  onclick={toggle}
  aria-pressed={theme.nightMode}
  aria-label={theme.nightMode ? 'Attiva tema giorno' : 'Attiva tema notte'}
>
  {#if theme.nightMode}
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 3a1 1 0 0 1 1 1v1.06a7 7 0 1 1-7.06 7H5a1 1 0 0 1-1-1 9 9 0 1 0 9-9 1 1 0 0 1 1-1Z" />
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 18a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm0-14a1 1 0 0 1-1-1V2a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm7 7a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1ZM3 12a1 1 0 0 1-1-1H1a1 1 0 1 1 0 2h1a1 1 0 0 1 1-1Zm15.07 6.07a1 1 0 0 1 1.41 0l.71.71a1 1 0 0 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41ZM4.22 4.22a1 1 0 0 1 1.41 0l.71.71A1 1 0 0 1 4.93 6.34l-.71-.71a1 1 0 0 1 0-1.41Zm13.15-1.5a1 1 0 0 1 1.41 1.41l-.71.71a1 1 0 0 1-1.41-1.41l.71-.71ZM5.64 17.36a1 1 0 0 1 1.41 0l.71.71a1 1 0 0 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
    display: inline-grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: none;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: color-mix(in srgb, var(--surface-elevated) 80%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: var(--ink-soft);
    box-shadow: var(--shadow-sm);
    transition:
      background var(--duration-fast, 0.15s) var(--ease),
      border-color var(--duration-fast, 0.15s) var(--ease),
      color var(--duration-fast, 0.15s) var(--ease),
      transform var(--duration-fast, 0.15s) var(--ease);
  }
  .theme-toggle.on {
    color: var(--gold);
    background: color-mix(in srgb, var(--gold) 14%, var(--surface));
    border-color: color-mix(in srgb, var(--gold) 35%, var(--line-strong));
  }
  .theme-toggle:active {
    transform: scale(0.94);
  }
</style>
