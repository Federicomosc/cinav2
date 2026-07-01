<script lang="ts">
  import { exportBackup, importBackup } from '../lib/backup';

  let backupPw = $state('');
  let backupBusy = $state(false);
  let backupMsg = $state('');
  let backupErr = $state(false);
  let backupFileInput: HTMLInputElement | undefined = $state();

  const canShareFiles = typeof navigator !== 'undefined' && 'canShare' in navigator;

  // Condivisione diretta (AirDrop/WhatsApp/Telegram...) quando il browser la
  // supporta: il modello del gruppo è "un telefono principale" (vedi PLAN.md
  // §7) — questo è il ponte manuale per passare una copia a un secondo
  // telefono senza dover prima scaricare e poi cercare il file scaricato.
  async function shareOrDownload(blob: Blob, filename: string) {
    const file = new File([blob], filename, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Backup Cina Tour 2026' });
        return true;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return false; // utente ha annullato
        // fallback al download se la condivisione fallisce per altri motivi
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }

  async function doExportBackup() {
    if (backupPw.length < 6) {
      backupErr = true;
      backupMsg = 'Password troppo corta (min 6). Usa quella della cassaforte.';
      return;
    }
    backupBusy = true;
    backupErr = false;
    backupMsg = '';
    try {
      const { blob, counts } = await exportBackup(backupPw);
      const filename = `cina-tour-backup-${new Date().toISOString().slice(0, 10)}.cinabackup`;
      const done = await shareOrDownload(blob, filename);
      if (done) {
        backupMsg = `Backup creato · ${counts.total} elementi cifrati. Conservalo al sicuro.`;
      }
    } catch {
      backupErr = true;
      backupMsg = 'Errore durante l’export.';
    } finally {
      backupBusy = false;
    }
  }

  async function doImportBackup(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (backupPw.length < 6) {
      backupErr = true;
      backupMsg = 'Inserisci prima la password del backup.';
      return;
    }
    backupBusy = true;
    backupErr = false;
    backupMsg = '';
    try {
      const res = await importBackup(file, backupPw);
      backupMsg = `Backup ripristinato · ${res.total} elementi.`;
    } catch (ex) {
      backupErr = true;
      backupMsg = ex instanceof Error ? ex.message : 'Import fallito.';
    } finally {
      backupBusy = false;
    }
  }
</script>

<section class="block">
  <div class="block-head">
    <h2 class="block-title">Backup del viaggio</h2>
    <span class="block-sub">cifrato</span>
  </div>
  <div class="card panel-card backup-card">
    <p class="backup-lead">
      Salva spese, schede mediche, documenti cifrati, checklist e preferiti in
      <strong>un unico file cifrato</strong>. {canShareFiles ? 'Condividilo' : 'Conservalo o passalo'} a un altro telefono del gruppo:
      se perdi il tuo, non perdi nulla.
    </p>
    <input
      class="backup-pw"
      type="password"
      placeholder="Password del backup (come la cassaforte)"
      bind:value={backupPw}
      autocomplete="off"
    />
    <div class="backup-actions">
      <button type="button" class="backup-btn primary" onclick={doExportBackup} disabled={backupBusy}>
        {backupBusy ? '…' : canShareFiles ? '↗ Condividi backup' : '↓ Esporta backup'}
      </button>
      <button type="button" class="backup-btn" onclick={() => backupFileInput?.click()} disabled={backupBusy}>
        ↑ Importa backup
      </button>
      <input
        bind:this={backupFileInput}
        type="file"
        accept=".cinabackup,application/json"
        class="sr-only-file"
        onchange={doImportBackup}
      />
    </div>
    {#if backupMsg}
      <p class="backup-msg" class:err={backupErr}>{backupMsg}</p>
    {/if}
    <p class="vault-note">Le foto (Fase 2) non sono incluse. L’import fonde coi dati attuali (stesso elemento = sovrascritto).</p>
  </div>
</section>

<style>
  .block { margin-bottom: 22px; }
  .block-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
    padding-left: 2px;
  }
  .block-title {
    font-family: var(--serif);
    font-size: 1.12rem;
    font-weight: 600;
    color: var(--ink);
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }
  .block-title::before {
    content: '';
    width: 3px;
    height: 0.95em;
    border-radius: 2px;
    background: linear-gradient(180deg, var(--cinabro-bright), var(--gold));
    box-shadow: 0 0 8px var(--cinabro-glow);
    flex: none;
  }
  .block-sub {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-faint);
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    padding: 3px 10px;
  }

  .panel-card { padding: 14px 16px 12px; overflow: hidden; }

  .vault-note {
    font-size: 0.74rem;
    color: var(--ink-faint);
    line-height: 1.5;
    margin-top: 14px;
  }

  .backup-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
  }
  .backup-lead {
    font-size: 0.9rem;
    line-height: 1.55;
    color: var(--ink-body);
  }
  .backup-lead strong { color: var(--ink); }
  .backup-pw {
    width: 100%;
    padding: 11px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    font-size: 0.9rem;
  }
  .backup-pw:focus {
    border-color: color-mix(in srgb, var(--jade) 50%, var(--line-strong));
    box-shadow: 0 0 0 3px var(--jade-soft);
  }
  .backup-actions {
    display: flex;
    gap: 8px;
  }
  .backup-btn {
    flex: 1;
    padding: 11px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink-soft);
    font-weight: 600;
    font-size: 0.84rem;
    transition: transform 0.15s var(--ease);
  }
  .backup-btn:active { transform: scale(0.97); }
  .backup-btn:disabled { opacity: 0.55; }
  .backup-btn.primary {
    color: #fff;
    background: linear-gradient(135deg, var(--jade-bright), var(--jade));
    border-color: color-mix(in srgb, var(--jade) 45%, transparent);
  }
  .sr-only-file {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
  .backup-msg {
    font-size: 0.84rem;
    font-weight: 500;
    color: var(--jade-bright);
  }
  .backup-msg.err { color: var(--cinabro-bright); }
</style>
