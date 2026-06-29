<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import PageHeader from '../components/PageHeader.svelte';
  import { db, uid, now, type ChecklistItem, type SecureDoc } from '../db/dexie';
  import { deriveKey, makeVerifier, checkVerifier, encryptBytes, decryptBytes, randomBytes } from '../lib/crypto';

  interface Vault {
    salt: Uint8Array;
    vIv: Uint8Array;
    vCipher: ArrayBuffer;
  }

  // ── Checklist (non cifrata) ──────────────────────────────────────────
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
  let checklist = $state<ChecklistItem[]>([]);
  const doneCount = $derived(checklist.filter((c) => !/modalità aereo/i.test(c.label)).filter((c) => c.done).length);
  const checklistVisible = $derived(checklist.filter((c) => !/modalità aereo/i.test(c.label)));

  // ── Vault cifrato ────────────────────────────────────────────────────
  type VaultState = 'loading' | 'setup' | 'locked' | 'unlocked';
  let vstate = $state<VaultState>('loading');
  let vault: Vault | null = null;
  let key: CryptoKey | null = null;
  let pw = $state('');
  let pw2 = $state('');
  let err = $state('');
  let busy = $state(false);

  let docs = $state<SecureDoc[]>([]);

  // add-doc form
  let title = $state('');
  let kind = $state<SecureDoc['kind']>('passport');
  let fileInput = $state<HTMLInputElement | null>(null);

  // preview overlay
  let preview = $state<{ url: string; mime: string; title: string } | null>(null);

  onMount(() => {
    void ensureChecklist();
    void loadVault();
    const subC = liveQuery(() => db.checklist.orderBy('order').toArray()).subscribe(
      (v) => (checklist = v),
    );
    const subD = liveQuery(() => db.documents.toArray()).subscribe((v) => (docs = v));
    return () => {
      subC.unsubscribe();
      subD.unsubscribe();
    };
  });

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
      } else {
        err = 'Password errata.';
      }
    } finally {
      busy = false;
    }
  }

  async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !key || !vault) return;
    busy = true;
    try {
      const { iv, cipher } = await encryptBytes(key, await file.arrayBuffer());
      await db.documents.add({
        id: uid(),
        title: title.trim() || file.name,
        kind,
        iv,
        salt: vault.salt,
        cipher,
        mime: file.type || 'application/octet-stream',
        addedAt: now(),
      });
      title = '';
      if (fileInput) fileInput.value = '';
    } finally {
      busy = false;
    }
  }

  async function openDoc(doc: SecureDoc) {
    if (!key) return;
    const buf = await decryptBytes(key, doc.iv, doc.cipher);
    const blob = new Blob([buf], { type: doc.mime });
    preview = { url: URL.createObjectURL(blob), mime: doc.mime, title: doc.title };
  }
  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    preview = null;
  }
</script>

<PageHeader eyebrow="🔒 cifrato lato client" title="Documenti" />

<!-- Checklist -->
<section class="card">
  <div class="eyebrow">Checklist pre-partenza · {doneCount}/{checklistVisible.length}</div>
  <div class="checks">
    {#each checklistVisible as c (c.id)}
      <button class="check" class:done={c.done} onclick={() => db.checklist.update(c.id, { done: !c.done })}>
        <span class="box">{c.done ? '✓' : ''}</span>
        <span class="lbl">{c.label}</span>
      </button>
    {/each}
  </div>
</section>

<!-- Vault -->
<section class="card vault">
  {#if vstate === 'loading'}
    <p class="muted">…</p>
  {:else if vstate === 'setup'}
    <div class="eyebrow">Crea la cassaforte</div>
    <p class="muted small">Imposta una password locale per cifrare i documenti (AES-GCM). Non viene salvata da nessuna parte.</p>
    <input type="password" placeholder="Password" bind:value={pw} />
    <input type="password" placeholder="Ripeti password" bind:value={pw2} />
    {#if err}<p class="err">{err}</p>{/if}
    <button class="save btn-primary" disabled={busy} onclick={setupVault}>Crea cassaforte</button>
  {:else if vstate === 'locked'}
    <div class="eyebrow">Cassaforte bloccata</div>
    <input type="password" placeholder="Password" bind:value={pw} onkeydown={(e) => e.key === 'Enter' && unlock()} />
    {#if err}<p class="err">{err}</p>{/if}
    <button class="save btn-primary" disabled={busy} onclick={unlock}>Sblocca</button>
  {:else}
    <div class="eyebrow">Cassaforte aperta 🔓</div>
    <div class="add-doc">
      <input type="text" placeholder="Titolo (es. Passaporto Fede)" bind:value={title} />
      <select bind:value={kind}>
        <option value="passport">Passaporto</option>
        <option value="visa">Visto</option>
        <option value="insurance">Assicurazione</option>
        <option value="ticket">Biglietto/QR</option>
        <option value="other">Altro</option>
      </select>
      <label class="file-btn">
        {busy ? '…' : '+ Aggiungi file (foto)'}
        <input bind:this={fileInput} type="file" accept="image/*,application/pdf" onchange={onFile} hidden />
      </label>
    </div>

    {#if docs.length === 0}
      <p class="muted small">Nessun documento. Aggiungi le foto di passaporti, visti, biglietti.</p>
    {:else}
      <div class="doc-list">
        {#each docs as d (d.id)}
          <div class="doc">
            <span class="k">{d.kind}</span>
            <button class="d-open" onclick={() => openDoc(d)}>{d.title}</button>
            <button class="del" aria-label="Elimina" onclick={() => db.documents.delete(d.id)}>✕</button>
          </div>
        {/each}
      </div>
    {/if}
    <p class="muted note">⚠ La sicurezza dipende dalla forza della password e del dispositivo. Non è un caveau.</p>
  {/if}
</section>

{#if preview}
  <button class="overlay" onclick={closePreview} aria-label="Chiudi">
    {#if preview.mime.startsWith('image/')}
      <img src={preview.url} alt={preview.title} />
    {:else}
      <p>{preview.title}</p>
      <a href={preview.url} download={preview.title}>Scarica / apri</a>
    {/if}
    <span class="hint">tocca per chiudere</span>
  </button>
{/if}

<style>
  .small { font-size: 0.82rem; }
  section.card { margin-bottom: 14px; }
  .checks { display: flex; flex-direction: column; gap: 0; margin-top: 10px; }
  .check {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 4px;
    text-align: left;
    border-bottom: 1px solid var(--line);
    transition: opacity 0.15s;
  }
  .check:last-child { border-bottom: none; }
  .box {
    flex: none;
    width: 24px;
    height: 24px;
    border: 1.5px solid var(--line-strong);
    border-radius: 7px;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 13px;
    transition: background 0.15s, border-color 0.15s;
  }
  .check.done .box { background: var(--jade); border-color: var(--jade); box-shadow: 0 2px 8px var(--jade-soft); }
  .check.done .lbl { color: var(--ink-faint); text-decoration: line-through; opacity: 0.7; }
  .vault input, .vault select { width: 100%; padding: 11px 14px; margin-top: 10px; }
  .err { color: var(--cinabro-bright); font-size: 0.85rem; margin-top: 8px; }
  .save { margin-top: 12px; }
  .add-doc { display: flex; flex-direction: column; gap: 0; margin: 10px 0 14px; }
  .file-btn {
    margin-top: 10px;
    text-align: center;
    background: var(--paper-2);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 14px;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--jade-bright);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .file-btn:active { border-color: var(--jade); background: var(--jade-soft); }
  .doc-list { display: flex; flex-direction: column; gap: 8px; }
  .doc {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 11px 14px;
  }
  .k {
    font-family: var(--mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
    background: var(--surface);
    border-radius: 4px;
    padding: 3px 7px;
    border: 1px solid var(--line);
  }
  .d-open { flex: 1; text-align: left; color: var(--cinabro-bright); font-weight: 500; }
  .del { color: var(--ink-faint); opacity: 0.6; padding: 4px; }
  .note { font-size: 0.76rem; margin-top: 14px; line-height: 1.5; }
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
  .hint { position: absolute; bottom: calc(24px + var(--safe-bottom)); font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-faint); opacity: 0.7; }
</style>
