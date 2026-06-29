<script lang="ts">
  import { nav, go, isTab, type Tab } from '../lib/router.svelte';
  import { haptic } from '../lib/haptic';

  const items: { route: Tab; label: string }[] = [
    { route: 'oggi', label: 'Oggi' },
    { route: 'citta', label: 'Città' },
    { route: 'logistica', label: 'Viaggio' },
    { route: 'mappa', label: 'Mappa' },
    { route: 'album', label: 'Album' },
  ];

  const activeTab: Tab = $derived(
    nav.seg === 'poi'
      ? 'citta'
      : nav.seg === 'frasario' || nav.seg === 'spese' || nav.seg === 'emergenze' || nav.seg === 'documenti'
        ? 'oggi'
        : isTab(nav.seg)
          ? nav.seg
          : 'oggi',
  );

  const icons: Record<Tab, string> = {
    oggi: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm.5-13H11v6l5.2 3.15.8-1.23-4.5-2.67Z',
    citta: 'M12 2 2 7v2h20V7Zm0 2.18 6.5 3.25V11H5.5V7.43ZM4 13v7h6v-5h4v5h6v-7Z',
    logistica: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5Z',
    mappa: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z',
    frasario: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z',
    documenti: 'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-3 0H9V6a3 3 0 0 1 6 0Z',
    spese: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16Z',
    emergenze: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-7 14h-2v-2h2Zm0-4h-2V7h2Z',
    album: 'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5Z',
  };
</script>

<nav class="bottom-nav" aria-label="Navigazione principale">
  <div class="nav-inner">
    {#each items as item (item.route)}
      <button
        class="item"
        class:active={activeTab === item.route}
        aria-current={activeTab === item.route ? 'page' : undefined}
        onclick={() => { haptic(8); go(item.route); }}
      >
        <span class="ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path d={icons[item.route]} />
          </svg>
        </span>
        <span class="lbl">{item.label}</span>
        {#if activeTab === item.route}<span class="dot" aria-hidden="true"></span>{/if}
      </button>
    {/each}
  </div>
</nav>

<style>
  .bottom-nav {
    position: relative;
    flex: none;
    z-index: 50;
    width: 100%;
    display: flex;
    justify-content: center;
    padding: 6px 12px 0;
    background: linear-gradient(180deg, transparent 0%, var(--nav-shell-fade) 35%);
    pointer-events: none;
  }
  .nav-inner {
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    width: 100%;
    max-width: 456px;
    min-height: calc(var(--nav-h) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    background: var(--nav-shell-bar);
    backdrop-filter: saturate(1.6) blur(24px);
    -webkit-backdrop-filter: saturate(1.6) blur(24px);
    border: 1px solid var(--line-strong);
    border-bottom: none;
    border-radius: 22px 22px 0 0;
    box-shadow:
      var(--shadow-lg),
      inset 0 1px 0 var(--nav-shell-inset),
      0 -8px 32px color-mix(in srgb, var(--city-accent, var(--cinabro)) 10%, transparent);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .nav-inner::-webkit-scrollbar { display: none; }
  .item {
    position: relative;
    flex: 1;
    min-width: 54px;
    height: var(--nav-h);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 4px 8px;
    color: var(--ink-faint);
    transition: color 0.2s var(--ease);
  }
  .item.active { color: var(--city-accent, var(--cinabro-bright)); }
  .ic {
    position: relative;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    opacity: 0.7;
    transition: opacity 0.2s, transform 0.2s var(--ease);
  }
  .item.active .ic {
    opacity: 1;
    transform: scale(1.05);
  }
  .item.active .ic::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--city-accent, var(--cinabro)) 14%, transparent);
    box-shadow: 0 0 16px color-mix(in srgb, var(--city-accent, var(--cinabro)) 35%, transparent);
  }
  .item.active .ic :global(svg) {
    position: relative;
    z-index: 1;
  }
  .lbl {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .item.active .lbl { font-weight: 600; }
  .dot {
    position: absolute;
    bottom: 6px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--city-accent, var(--cinabro));
    box-shadow: 0 0 10px color-mix(in srgb, var(--city-accent, var(--cinabro)) 50%, transparent);
  }
</style>
