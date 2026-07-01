<script lang="ts">
  import { pwaUpdate, applyPwaUpdate, dismissPwaUpdate } from '../lib/pwa-update.svelte';

  let applying = $state(false);

  async function apply() {
    applying = true;
    await applyPwaUpdate();
  }
</script>

{#if pwaUpdate.needRefresh}
  <div class="update-bar" role="status" aria-live="polite">
    <div class="row">
      <span class="ic" aria-hidden="true">↻</span>
      <span class="txt">Nuova versione dell'app pronta.</span>
    </div>
    <div class="actions">
      <button type="button" class="apply" onclick={apply} disabled={applying}>
        {applying ? '…' : 'Aggiorna'}
      </button>
      <button type="button" class="dismiss" onclick={dismissPwaUpdate} aria-label="Ignora per ora">
        ✕
      </button>
    </div>
  </div>
{/if}

<style>
  /* Righe separate (testo sopra, azioni sotto a destra): il toggle tema è
     fixed in alto a destra e con un'unica riga i suoi 36px intercettano i
     click sui pulsanti del banner (verificato a runtime). */
  .update-bar {
    position: sticky;
    top: 0;
    z-index: 41;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: -4px -4px 12px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--surface-elevated) 94%, transparent);
    border: 1px solid color-mix(in srgb, var(--jade) 40%, var(--line-strong));
    border-radius: var(--radius-md);
    font-size: 0.78rem;
    line-height: 1.4;
    color: var(--ink-soft);
    backdrop-filter: saturate(1.4) blur(12px);
    -webkit-backdrop-filter: saturate(1.4) blur(12px);
  }
  .row { display: flex; align-items: center; gap: 8px; }
  .ic { font-size: 14px; flex: none; }
  .txt { flex: 1; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .apply,
  .dismiss {
    flex: none;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    padding: 4px 10px;
    cursor: pointer;
  }
  .apply { border-color: color-mix(in srgb, var(--jade) 50%, var(--line-strong)); }
  .dismiss { padding: 4px 8px; }
</style>
