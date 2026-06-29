<script lang="ts">
  import { online, isFullyOfflineReady } from '../lib/online.svelte';

  const show = $derived(!online.network);
  const detail = $derived.by(() => {
    const parts: string[] = [];
    if (online.mapTiles) parts.push('mappa');
    if (online.routingTiles) parts.push('percorsi');
    if (online.phraseAudio) parts.push('audio frasi');
    return parts.length ? parts.join(' · ') : 'solo dati salvati in app';
  });
</script>

{#if show}
  <div class="offline-bar" role="status" aria-live="polite">
    <span class="ic" aria-hidden="true">✈</span>
    <span class="txt">
      <strong>Sei offline</strong>
      {#if online.checked}
        — {detail}
        {#if isFullyOfflineReady()}
          <span class="ok">· tutto pronto per il viaggio</span>
        {/if}
      {/if}
    </span>
  </div>
{/if}

<style>
  .offline-bar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: -4px -4px 12px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--surface-elevated) 94%, transparent);
    border: 1px solid color-mix(in srgb, var(--cinabro) 40%, var(--line-strong));
    border-radius: var(--radius-md);
    font-size: 0.78rem;
    line-height: 1.4;
    color: var(--ink-soft);
    backdrop-filter: saturate(1.4) blur(12px);
    -webkit-backdrop-filter: saturate(1.4) blur(12px);
    box-shadow:
      var(--shadow-sm),
      0 0 24px color-mix(in srgb, var(--cinabro) 12%, transparent);
  }
  .ic { font-size: 14px; flex: none; }
  .txt strong { color: var(--cinabro-bright); font-weight: 600; }
  .ok { color: var(--jade-bright); }
</style>
