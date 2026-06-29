<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import PageHeader from '../components/PageHeader.svelte';
  import { db, uid, now, type ChecklistItem, type SecureDoc } from '../db/dexie';
  import { deriveKey, makeVerifier, checkVerifier, encryptBytes, decryptBytes, randomBytes } from '../lib/crypto';
  import { portal } from '../lib/portal';

  interface Vault {
    salt: Uint8Array;
    vIv: Uint8Array;
    vCipher: ArrayBuffer;
  }

  const DEFAULTS = [
    'eSIM installata (non attivata)',
    'SIM di casa mantenuta (per SMS verifica)',
    'Visto / visa-free verificato',
    'Passaporto valido 6+ mesi',
    'Foto passaporto + visto caricate (cifrate)',
    'QR dei biglietti salvati',
    'Assicurazione viaggio',
    '~100 RMB contanti di backup',
    'App cinesi installate (Alipay/WeChat/DiDi)',
  ];

  const KIND_LABEL: Record<SecureDoc['kind'], string> = {
    passport: 'Passaporto',
    visa: 'Visto',
    insurance: 'Assicurazione',
    ticket: 'Biglietto',
    other: 'Altro',
  };

  /** Auto-spunta checklist quando carichi un documento del tipo corrispondente */
  const KIND_CHECKLIST: Partial<Record<SecureDoc['kind'], RegExp>> = {
    passport: /passaporto.*visto.*caricate/i,
    visa: /passaporto.*visto.*caricate/i,
    ticket: /QR dei biglietti/i,
    insurance: /Assicurazione viaggio/i,
  };

  const LOCK_IDLE_MS = 3 * 60 * 1000;

  let checklist = $state<ChecklistItem[]>([]);
  const checklistVisible = $derived(checklist.filter((c) => !/modalità aereo/i.test(c.label)));
  const doneCount = $derived(checklistVisible.filter((c) => c.done).length);
  const chkPct = $derived(
    checklistVisible.length ? Math.round((doneCount / checklistVisible.length) * 100) : 0,
  );

  type VaultState = 'loading' | 'setup' | 'locked' | 'unlocked';
  let vstate = $state<VaultState>('loading');
  let vault: Vault | null = null;
  let key: CryptoKey | null = null;
  let pw = $state('');
  let pw2 = $state('');
  let err = $state('');
  let busy = $state(false);

  let docs = $state<SecureDoc[]>([]);
  let title = $state('');
  let kind = $state<SecureDoc['kind']>('passport');
  let preview = $state<{ url: string; mime: string; title: string } | null>(null);
  let deleteTarget = $state<SecureDoc | null>(null);
  let showResetConfirm = $state(false);
  let resetConfirmOpening = false;

  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    void ensureChecklist();
    void loadVault();

    const onVis = () => {
      if (document.visibilityState === 'hidden') lockVault();
    };
    const onAct = () => resetIdleLock();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerdown', onAct, { passive: true });
    window.addEventListener('keydown', onAct);

    const subC = liveQuery(() => db.checklist.orderBy('order').toArray()).subscribe(
      (v) => (checklist = v),
    );
    const subD = liveQuery(() => db.documents.toArray()).subscribe((v) => {
      docs = v;
      if (vstate === 'unlocked') void syncChecklistFromDocs(v);
    });

    return () => {
      subC.unsubscribe();
      subD.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerdown', onAct);
      window.removeEventListener('keydown', onAct);
      clearIdleLock();
    };
  });

  function clearIdleLock() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = undefined;
  }

  function resetIdleLock() {
    if (vstate !== 'unlocked') return;
    clearIdleLock();
    idleTimer = setTimeout(() => lockVault(), LOCK_IDLE_MS);
  }

  function lockVault() {
    clearIdleLock();
    key = null;
    closePreview();
    if (vault) vstate = 'locked';
    pw = '';
    err = '';
  }

  async function ensureChecklist() {
    if (await db.meta.get('checklist-seeded')) return;
    await db.checklist.bulkAdd(
      DEFAULTS.map((label, i) => ({ id: uid(), label, done: false, order: i })),
    );
    await db.meta.put({ key: 'checklist-seeded', value: true });
  }

  async function loadVault() {
    const rec = await db.meta.get('vault');
    if (rec) {
      vault = rec.value as Vault;
      vstate = 'locked';
    } else {
      vstate = 'setup';
    }
  }

  async function setupVault() {
    err = '';
    if (pw.length < 4) return (err = 'Password troppo corta (min 4).');
    if (pw !== pw2) return (err = 'Le password non coincidono.');
    busy = true;
    try {
      const salt = randomBytes(16);
      const k = await deriveKey(pw, salt);
      const { iv, cipher } = await makeVerifier(k);
      vault = { salt, vIv: iv, vCipher: cipher };
      await db.meta.put({ key: 'vault', value: vault });
      key = k;
      vstate = 'unlocked';
      pw = pw2 = '';
      resetIdleLock();
      await syncChecklistFromDocs(docs);
    } finally {
      busy = false;
    }
  }

  async function unlock() {
    err = '';
    if (!vault) return;
    busy = true;
    try {
      const k = await deriveKey(pw, vault.salt);
      if (await checkVerifier(k, vault.vIv, vault.vCipher)) {
        key = k;
        vstate = 'unlocked';
        pw = '';
        resetIdleLock();
        await syncChecklistFromDocs(docs);
      } else {
        err = 'Password errata.';
      }
    } finally {
      busy = false;
    }
  }

  async function syncChecklistForKind(docKind: SecureDoc['kind']) {
    const pattern = KIND_CHECKLIST[docKind];
    if (!pattern) return;
    const items = await db.checklist.filter((c) => pattern.test(c.label)).toArray();
    await Promise.all(
      items.filter((c) => !c.done).map((c) => db.checklist.update(c.id, { done: true })),
    );
  }

  async function syncChecklistFromDocs(list: SecureDoc[]) {
    const kinds = new Set(list.map((d) => d.kind));
    for (const k of kinds) await syncChecklistForKind(k);
  }

  async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !key || !vault) return;
    busy = true;
    try {
      const { iv, cipher } = await encryptBytes(key, await file.arrayBuffer());
      const docKind = kind;
      await db.documents.add({
        id: uid(),
        title: title.trim() || file.name,
        kind: docKind,
        iv,
        salt: vault.salt,
        cipher,
        mime: file.type || 'application/octet-stream',
        addedAt: now(),
      });
      title = '';
      await syncChecklistForKind(docKind);
      resetIdleLock();
    } finally {
      busy = false;
      (e.target as HTMLInputElement).value = '';
    }
  }

  async function openDoc(doc: SecureDoc) {
    if (!key) return;
    resetIdleLock();
    const buf = await decryptBytes(key, doc.iv, doc.cipher);
    const blob = new Blob([buf], { type: doc.mime });
    preview = { url: URL.createObjectURL(blob), mime: doc.mime, title: doc.title };
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    preview = null;
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await db.documents.delete(deleteTarget.id);
    deleteTarget = null;
    resetIdleLock();
  }

  function openResetConfirm(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    resetConfirmOpening = true;
    showResetConfirm = true;
    setTimeout(() => {
      resetConfirmOpening = false;
    }, 400);
  }

  function closeResetConfirm(e: MouseEvent) {
    if (resetConfirmOpening) return;
    if (e.target !== e.currentTarget) return;
    showResetConfirm = false;
  }

  async function resetVault() {
    busy = true;
    try {
      await db.documents.clear();
      await db.meta.delete('vault');
      clearIdleLock();
      key = null;
      vault = null;
      closePreview();
      pw = pw2 = '';
      err = '';
      vstate = 'setup';
      showResetConfirm = false;

      const patterns = Object.values(KIND_CHECKLIST).filter(Boolean) as RegExp[];
      const items = await db.checklist.toArray();
      await Promise.all(
        items
          .filter((c) => c.done && patterns.some((p) => p.test(c.label)))
          .map((c) => db.checklist.update(c.id, { done: false })),
      );
    } finally {
      busy = false;
    }
  }
</script>

<div class="docs-page">
  <PageHeader
    eyebrow="🔒 cifrato sul telefono"
    title="Documenti"
    sub="Checklist pre-partenza e cassaforte per passaporto, visti e biglietti."
  />

  <!-- Checklist -->
  <section class="block">
    <div class="block-head">
      <h2 class="block-title">Checklist</h2>
      <span class="block-sub" class:done-chip={chkPct === 100 && checklistVisible.length > 0}>
        {#if chkPct === 100 && checklistVisible.length}
          Completa ✓
        {:else}
          {doneCount}/{checklistVisible.length}
        {/if}
      </span>
    </div>
    <div class="card panel-card">
      {#if checklistVisible.length}
        <div class="chk-bar" aria-hidden="true">
          <div class="chk-bar-fill" style="width: {chkPct}%"></div>
        </div>
      {/if}
      <ul class="chk-list">
        {#each checklistVisible as c (c.id)}
          <li class="chk-row" class:done={c.done}>
            <button
              type="button"
              class="chk-btn"
              onclick={() => db.checklist.update(c.id, { done: !c.done })}
            >
              <span class="chk-box" class:on={c.done}>{#if c.done}✓{/if}</span>
              <span class="chk-lbl">{c.label}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </section>

  <!-- Cassaforte -->
  <section class="block">
    <div class="block-head">
      <h2 class="block-title">Cassaforte</h2>
      {#if vstate === 'unlocked'}
        <span class="block-sub open-chip">Aperta</span>
      {:else if vstate === 'locked'}
        <span class="block-sub">Bloccata</span>
      {/if}
    </div>

    <div class="card vault-card accent-card">
      <div class="vault-accent" aria-hidden="true"></div>

      {#if vstate === 'loading'}
        <p class="muted vault-pad">…</p>
      {:else if vstate === 'setup'}
        <div class="vault-pad">
          <p class="vault-lead">Crea una password per cifrare foto e PDF sul dispositivo (AES-GCM).</p>
          <p class="vault-warn">La password non viene salvata. Se la dimentichi, i file non si recuperano.</p>
          <input type="password" placeholder="Password" bind:value={pw} autocomplete="new-password" />
          <input type="password" placeholder="Ripeti password" bind:value={pw2} autocomplete="new-password" />
          {#if err}<p class="err">{err}</p>{/if}
          <button class="btn-primary vault-action" disabled={busy} onclick={setupVault}>
            {busy ? '…' : 'Crea cassaforte'}
          </button>
        </div>
      {:else if vstate === 'locked'}
        <div class="vault-pad">
          <p class="vault-lead">Inserisci la password per vedere e aggiungere documenti.</p>
          <input
            type="password"
            placeholder="Password"
            bind:value={pw}
            autocomplete="current-password"
            onkeydown={(e) => e.key === 'Enter' && unlock()}
          />
          {#if err}<p class="err">{err}</p>{/if}
          <button class="btn-primary vault-action" disabled={busy} onclick={unlock}>
            {busy ? '…' : 'Sblocca'}
          </button>
          {#if docs.length}
            <p class="vault-meta muted">{docs.length} documento{docs.length === 1 ? '' : 'i'} salvato{docs.length === 1 ? '' : 'i'}</p>
          {/if}
          <button type="button" class="forgot-link" onclick={openResetConfirm}>
            Password dimenticata?
          </button>
        </div>
      {:else}
        <div class="vault-pad">
          <div class="vault-toolbar">
            <span class="vault-open-lbl">Cassaforte aperta</span>
            <button type="button" class="lock-btn" onclick={lockVault}>Blocca</button>
          </div>

          <div class="add-form">
            <label class="field-lbl" for="doc-title">Titolo</label>
            <input id="doc-title" type="text" placeholder="es. Passaporto Fede" bind:value={title} />

            <label class="field-lbl" for="doc-kind">Tipo</label>
            <select id="doc-kind" bind:value={kind}>
              {#each Object.entries(KIND_LABEL) as [k, lbl] (k)}
                <option value={k}>{lbl}</option>
              {/each}
            </select>

            <div class="file-actions">
              <label class="file-btn primary">
                {busy ? '…' : '📷 Scatta foto'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onchange={onFile}
                  hidden
                  disabled={busy}
                />
              </label>
              <label class="file-btn">
                {busy ? '…' : '📁 Galleria / PDF'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onchange={onFile}
                  hidden
                  disabled={busy}
                />
              </label>
            </div>
          </div>

          {#if docs.length === 0}
            <p class="empty-docs">Nessun documento ancora. Scatta passaporto, visto o QR biglietti.</p>
          {:else}
            <ul class="doc-list">
              {#each docs as d (d.id)}
                <li class="doc-row">
                  <span class="doc-kind">{KIND_LABEL[d.kind]}</span>
                  <button type="button" class="doc-open" onclick={() => openDoc(d)}>{d.title}</button>
                  <button
                    type="button"
                    class="doc-del"
                    aria-label="Elimina {d.title}"
                    onclick={() => (deleteTarget = d)}
                  >✕</button>
                </li>
              {/each}
            </ul>
          {/if}

          <p class="vault-note">I file restano solo su questo telefono, cifrati. Blocco automatico dopo 3 min o in background.</p>
        </div>
      {/if}
    </div>
  </section>
</div>

{#if preview}
  <button class="overlay" onclick={closePreview} aria-label="Chiudi anteprima">
    {#if preview.mime.startsWith('image/')}
      <img src={preview.url} alt={preview.title} />
    {:else}
      <p class="preview-title">{preview.title}</p>
      <a class="preview-dl" href={preview.url} download={preview.title}>Scarica / apri</a>
    {/if}
    <span class="hint">tocca per chiudere</span>
  </button>
{/if}

{#if deleteTarget}
  <div class="confirm-backdrop" role="presentation" use:portal onclick={(e) => e.target === e.currentTarget && (deleteTarget = null)}>
    <div
      class="confirm-card"
      role="alertdialog"
      aria-labelledby="del-title"
      onclick={(e) => e.stopPropagation()}
    >
      <h3 id="del-title" class="confirm-title">Eliminare documento?</h3>
      <p class="confirm-body">
        <strong>{deleteTarget.title}</strong> verrà rimosso dalla cassaforte. L’operazione non si annulla.
      </p>
      <div class="confirm-actions">
        <button type="button" class="confirm-cancel" onclick={() => (deleteTarget = null)}>Annulla</button>
        <button type="button" class="confirm-delete" onclick={confirmDelete}>Elimina</button>
      </div>
    </div>
  </div>
{/if}

{#if showResetConfirm}
  <div class="confirm-backdrop" role="presentation" use:portal onclick={closeResetConfirm}>
    <div
      class="confirm-card"
      role="alertdialog"
      aria-labelledby="reset-title"
      onclick={(e) => e.stopPropagation()}
    >
      <h3 id="reset-title" class="confirm-title">Reimpostare la cassaforte?</h3>
      <p class="confirm-body">
        Senza la password <strong>non è possibile recuperare</strong> i documenti già salvati.
        Verranno eliminati definitivamente da questo telefono. Potrai crearne una nuova e ricaricare le foto.
      </p>
      <div class="confirm-actions">
        <button type="button" class="confirm-cancel" onclick={() => (showResetConfirm = false)}>Annulla</button>
        <button type="button" class="confirm-delete" disabled={busy} onclick={resetVault}>
          {busy ? '…' : 'Elimina e ricomincia'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .docs-page { padding-bottom: 12px; }

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
  .block-sub.done-chip,
  .open-chip {
    color: var(--jade-bright);
    background: var(--jade-soft);
    border-color: color-mix(in srgb, var(--jade) 35%, transparent);
  }

  .panel-card { padding: 14px 16px 12px; overflow: hidden; }
  .chk-bar {
    height: 3px;
    border-radius: var(--radius-pill);
    background: var(--line);
    margin-bottom: 12px;
    overflow: hidden;
  }
  .chk-bar-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--jade), var(--jade-bright));
    transition: width 0.35s var(--ease);
    box-shadow: 0 0 10px var(--jade-soft);
  }
  .chk-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chk-row { border-radius: var(--radius-sm); overflow: hidden; }
  .chk-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    text-align: left;
    background: linear-gradient(155deg, var(--paper-2) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s var(--ease);
  }
  .chk-btn:active { transform: scale(0.995); }
  .chk-row.done { opacity: 0.72; }
  .chk-box {
    flex: none;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    border: 2px solid var(--line-strong);
    background: var(--paper-2);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    transition: background 0.15s, border-color 0.15s;
  }
  .chk-box.on {
    background: var(--jade);
    border-color: var(--jade);
    box-shadow: 0 2px 8px var(--jade-soft);
  }
  .chk-lbl {
    flex: 1;
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--ink);
    line-height: 1.4;
  }
  .chk-row.done .chk-lbl {
    text-decoration: line-through;
    color: var(--ink-faint);
  }

  .vault-card {
    position: relative;
    padding: 0;
    overflow: hidden;
    background: linear-gradient(168deg, var(--surface-hi) 0%, var(--surface) 100%);
    border-color: color-mix(in srgb, var(--jade) 22%, var(--line-strong));
  }
  .vault-accent {
    height: 4px;
    background: linear-gradient(90deg, var(--jade-bright), var(--jade), color-mix(in srgb, var(--jade) 30%, transparent));
    box-shadow: 0 2px 12px var(--jade-soft);
  }
  .accent-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: linear-gradient(180deg, var(--jade-bright), color-mix(in srgb, var(--jade) 50%, transparent));
    box-shadow: 0 0 10px var(--jade-soft);
    z-index: 1;
  }
  .vault-pad {
    position: relative;
    z-index: 2;
    padding: 16px 18px 18px 22px;
  }
  .vault-lead {
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--ink-body);
    margin-bottom: 8px;
  }
  .vault-warn {
    font-size: 0.8rem;
    color: var(--gold);
    line-height: 1.45;
    margin-bottom: 12px;
  }
  .vault input,
  .vault-card input,
  .vault-card select {
    width: 100%;
    padding: 12px 14px;
    margin-top: 8px;
  }
  .vault-action { margin-top: 14px; }
  .vault-meta { font-size: 0.8rem; margin-top: 12px; text-align: center; }
  .forgot-link {
    display: block;
    width: 100%;
    margin-top: 16px;
    padding: 12px 8px;
    min-height: 44px;
    border: none;
    background: none;
    font-size: 0.88rem;
    color: var(--cinabro-bright);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .forgot-link:hover { color: var(--ink); }
  .err { color: var(--cinabro-bright); font-size: 0.85rem; margin-top: 8px; }

  .vault-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 16px;
  }
  .vault-open-lbl {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--jade-bright);
  }
  .lock-btn {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-soft);
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    padding: 7px 14px;
    transition: border-color 0.15s, color 0.15s;
  }
  .lock-btn:active { border-color: var(--cinabro); color: var(--ink); }

  .add-form { margin-bottom: 16px; }
  .field-lbl {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-top: 10px;
    margin-bottom: 4px;
  }
  .field-lbl:first-child { margin-top: 0; }

  .file-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 14px;
  }
  .file-btn {
    display: grid;
    place-items: center;
    min-height: 52px;
    text-align: center;
    background: var(--paper-2);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 10px 8px;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-soft);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .file-btn.primary {
    color: var(--jade-bright);
    border-style: solid;
    border-color: color-mix(in srgb, var(--jade) 35%, var(--line-strong));
    background: var(--jade-soft);
  }
  .file-btn:active { border-color: var(--jade); background: color-mix(in srgb, var(--jade) 12%, var(--paper-2)); }

  .empty-docs {
    font-size: 0.88rem;
    color: var(--ink-faint);
    font-style: italic;
    text-align: center;
    padding: 14px;
    background: var(--paper-2);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
  }

  .doc-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .doc-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: linear-gradient(155deg, var(--paper-2) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
  }
  .doc-kind {
    flex: none;
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--jade-bright);
    background: var(--jade-soft);
    border: 1px solid color-mix(in srgb, var(--jade) 28%, transparent);
    border-radius: 4px;
    padding: 4px 7px;
    max-width: 72px;
    text-align: center;
    line-height: 1.2;
  }
  .doc-open {
    flex: 1;
    min-width: 0;
    text-align: left;
    font-weight: 500;
    font-size: 0.92rem;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .doc-open:active { color: var(--cinabro-bright); }
  .doc-del {
    flex: none;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    color: var(--ink-faint);
    background: var(--paper-2);
    border: 1px solid var(--line);
    font-size: 14px;
    transition: border-color 0.15s, color 0.15s;
  }
  .doc-del:active { border-color: var(--cinabro); color: var(--cinabro-bright); }

  .vault-note {
    font-size: 0.74rem;
    color: var(--ink-faint);
    line-height: 1.5;
    margin-top: 14px;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(6, 5, 4, 0.96);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    animation: fadeIn 0.25s var(--ease) both;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .overlay img { max-width: 100%; max-height: 80vh; border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); }
  .preview-title { font-family: var(--serif); font-size: 1.1rem; }
  .preview-dl {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--cinabro-bright);
    padding: 10px 16px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
  }
  .hint {
    position: absolute;
    bottom: calc(24px + var(--safe-bottom));
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    opacity: 0.7;
  }

  .confirm-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(6, 5, 4, 0.75);
    display: grid;
    place-items: center;
    padding: 24px;
    animation: fadeIn 0.2s var(--ease) both;
  }
  .confirm-card {
    width: 100%;
    max-width: 340px;
    background: linear-gradient(168deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 20px 20px 18px;
    box-shadow: var(--shadow-lg);
  }
  .confirm-title {
    font-family: var(--serif);
    font-size: 1.2rem;
    margin-bottom: 10px;
  }
  .confirm-body {
    font-size: 0.9rem;
    color: var(--ink-body);
    line-height: 1.5;
    margin-bottom: 18px;
  }
  .confirm-body strong { color: var(--ink); }
  .confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
  .confirm-cancel,
  .confirm-delete {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    padding: 10px 16px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
  }
  .confirm-cancel {
    color: var(--ink-soft);
    background: var(--paper-2);
  }
  .confirm-delete {
    color: #fff;
    background: var(--cinabro);
    border-color: var(--cinabro);
  }
</style>
