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
    margin: -4px -4px 10px;
    padding: 9px 14px;
    background: rgba(20, 16, 12, 0.95);
    border: 1px solid rgba(224, 74, 40, 0.35);
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
    line-height: 1.4;
    color: var(--ink-soft);
    backdrop-filter: blur(8px);
  }
  .ic { font-size: 14px; flex: none; }
  .txt strong { color: var(--cinabro-bright); font-weight: 600; }
  .ok { color: var(--jade-bright); }
</style>
