<script lang="ts">
  import { liveQuery } from 'dexie';
  import PageHeader from '../components/PageHeader.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import { db, uid, now, type Photo } from '../db/dexie';

  let photos = $state<Photo[]>([]);
  let urls = $state<Map<string, string>>(new Map());

  $effect(() => {
    const sub = liveQuery(() => db.photos.orderBy('takenAt').reverse().toArray()).subscribe((v) => {
      photos = v;
    });
    return () => sub.unsubscribe();
  });

  $effect(() => {
    const next = new Map<string, string>();
    for (const p of photos) {
      next.set(p.id, URL.createObjectURL(p.thumb ?? p.blob));
    }
    urls = next;
    return () => {
      for (const u of next.values()) URL.revokeObjectURL(u);
    };
  });

  async function onPick(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    for (const file of files) {
      await db.photos.add({
        id: uid(),
        blob: file,
        takenAt: file.lastModified || now(),
      });
    }
    input.value = '';
  }

  async function remove(id: string) {
    await db.photos.delete(id);
  }
</script>

<PageHeader eyebrow="◫ diario di bordo" title="Album" sub="Foto del viaggio salvate solo sul telefono." />

{#if photos.length === 0}
  <EmptyState icon="📷" title="Nessuna foto ancora" hint="Importa dalla galleria — restano offline su questo dispositivo.">
    <label class="btn-primary pick-btn">
      Scegli foto
      <input type="file" accept="image/*" multiple onchange={onPick} hidden />
    </label>
  </EmptyState>
{:else}
  <div class="toolbar">
    <span class="count">{photos.length} foto</span>
    <label class="add-btn">
      + Aggiungi
      <input type="file" accept="image/*" multiple onchange={onPick} hidden />
    </label>
  </div>
  <div class="grid">
    {#each photos as p (p.id)}
      <figure class="cell">
        <img src={urls.get(p.id)} alt={p.caption ?? 'Foto viaggio'} loading="lazy" />
        <button type="button" class="del" aria-label="Elimina foto" onclick={() => remove(p.id)}>✕</button>
      </figure>
    {/each}
  </div>
{/if}

<style>
  .pick-btn { display: block; width: 100%; text-align: center; cursor: pointer; }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .count {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .add-btn {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--jade-bright);
    padding: 8px 12px;
    min-height: 44px;
    cursor: pointer;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .cell {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    margin: 0;
  }
  .cell img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .del {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(6, 5, 4, 0.72);
    color: #fff;
    font-size: 12px;
    display: grid;
    place-items: center;
  }
</style>
