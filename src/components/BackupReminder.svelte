<script lang="ts">
  // Spese, documenti cifrati e checklist vivono solo su questo telefono
  // (vedi lib/backup.ts). Nessuno lo ricorda mai da solo: un piccolo nudge
  // periodico costa poco ed evita di scoprire di aver perso tutto sul campo.
  import { liveQuery } from 'dexie';
  import { db } from '../db/dexie';
  import { LAST_BACKUP_KEY } from '../lib/backup';
  import { go } from '../lib/router.svelte';

  const STALE_DAYS = 10;

  let lastBackupAt = $state<number | null>(null);
  let dismissed = $state(false);

  $effect(() => {
    const sub = liveQuery(() => db.meta.get(LAST_BACKUP_KEY)).subscribe((rec) => {
      lastBackupAt = typeof rec?.value === 'number' ? rec.value : null;
    });
    return () => sub.unsubscribe();
  });

  const daysAgo = $derived(
    lastBackupAt == null ? null : Math.floor((Date.now() - lastBackupAt) / 86_400_000),
  );
  const show = $derived(!dismissed && (daysAgo == null || daysAgo >= STALE_DAYS));
  const label = $derived(
    daysAgo == null ? 'Non hai ancora fatto un backup.' : `Ultimo backup ${daysAgo} giorni fa.`,
  );

  function goToBackup() {
    go('documenti');
  }
</script>

{#if show}
  <div class="backup-nudge" role="status" aria-live="polite">
    <div class="row">
      <span class="ic" aria-hidden="true">⛃</span>
      <span class="txt">{label} Spese e documenti stanno solo su questo telefono.</span>
    </div>
    <div class="actions">
      <button type="button" class="go" onclick={goToBackup}>Backup</button>
      <button type="button" class="dismiss" onclick={() => (dismissed = true)} aria-label="Ignora per ora">
        ✕
      </button>
    </div>
  </div>
{/if}

<style>
  /* Righe separate (testo sopra, azioni sotto a destra): il toggle tema è
     fixed in alto a destra e con un'unica riga i suoi 36px intercettano i
     click sui pulsanti del banner (verificato a runtime). */
  .backup-nudge {
    position: sticky;
    top: 0;
    z-index: 39;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: -4px -4px 12px;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--surface-elevated) 94%, transparent);
    border: 1px solid color-mix(in srgb, var(--cinabro) 30%, var(--line-strong));
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
  .go,
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
  .dismiss { padding: 4px 8px; }
</style>
