<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import PageHeader from '../components/PageHeader.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import { db, uid, type Photo } from '../db/dexie';
  import { parsePhotoMeta } from '../lib/photo-meta';
  import { cittaById } from '../lib/content';
  import { shortDate } from '../lib/format';
  import { cityTheme } from '../lib/city-theme';
  import type { CityId } from '../data/types';

  let photos = $state<Photo[]>([]);
  let urls = $state<Map<string, string>>(new Map());
  let importing = $state(false);

  interface PhotoSection {
    key: string;
    label: string;
    accent?: string;
    items: Photo[];
  }

  const sections = $derived.by((): PhotoSection[] => {
    const byKey = new Map<string, Photo[]>();

    for (const p of photos) {
      let key: string;
      if (p.city && p.day) key = `${p.city}|${p.day}`;
      else if (p.city) key = `${p.city}|`;
      else if (p.day) key = `|${p.day}`;
      else key = '|';
      const list = byKey.get(key) ?? [];
      list.push(p);
      byKey.set(key, list);
    }

    const out: PhotoSection[] = [];
    for (const [key, items] of byKey) {
      const [cityId, day] = key.split('|');
      const city = cityId ? (cityId as CityId) : undefined;
      const label =
        city && day
          ? `${cittaById.get(city)?.name ?? city} · ${shortDate(day)}`
          : city
            ? (cittaById.get(city)?.name ?? city)
            : day
              ? shortDate(day)
              : 'Senza data';
      out.push({
        key,
        label,
        accent: city ? cityTheme(city).accent : undefined,
        items: items.sort((a, b) => b.takenAt - a.takenAt),
      });
    }

    out.sort((a, b) => {
      const ta = a.items[0]?.takenAt ?? 0;
      const tb = b.items[0]?.takenAt ?? 0;
      return tb - ta;
    });
    return out;
  });

  function setPhotoUrls(list: Photo[]) {
    for (const u of urls.values()) URL.revokeObjectURL(u);
    if (list.length === 0) {
      if (urls.size > 0) urls = new Map();
      return;
    }
    const next = new Map<string, string>();
    for (const p of list) {
      next.set(p.id, URL.createObjectURL(p.thumb ?? p.blob));
    }
    urls = next;
  }

  onMount(() => {
    const sub = liveQuery(() => db.photos.orderBy('takenAt').reverse().toArray()).subscribe((v) => {
      photos = v;
      setPhotoUrls(v);
    });
    return () => {
      sub.unsubscribe();
      for (const u of urls.values()) URL.revokeObjectURL(u);
    };
  });

  async function onPick(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;
    importing = true;
    try {
      for (const file of files) {
        const meta = await parsePhotoMeta(file);
        await db.photos.add({
          id: uid(),
          blob: file,
          takenAt: meta.takenAt,
          lat: meta.lat,
          lng: meta.lng,
          day: meta.day,
          city: meta.city,
        });
      }
    } finally {
      importing = false;
      input.value = '';
    }
  }

  async function remove(id: string) {
    await db.photos.delete(id);
  }
</script>

<PageHeader
  eyebrow="◫ diario di bordo"
  title="Album"
  sub="Importa dalla galleria: data e città dal EXIF e dal calendario del viaggio."
/>

{#if photos.length === 0}
  <EmptyState icon="📷" title="Nessuna foto ancora" hint="Le foto restano solo su questo dispositivo.">
    <label class="btn-primary pick-btn">
      {importing ? 'Importo…' : 'Scegli foto'}
      <input type="file" accept="image/*" multiple onchange={onPick} hidden disabled={importing} />
    </label>
  </EmptyState>
{:else}
  <div class="toolbar">
    <span class="count">{photos.length} foto · {sections.length} gruppi</span>
    <label class="add-btn">
      {importing ? '…' : '+ Aggiungi'}
      <input type="file" accept="image/*" multiple onchange={onPick} hidden disabled={importing} />
    </label>
  </div>

  {#each sections as sec (sec.key)}
    <section class="group">
      <h2 class="group-title" style={sec.accent ? `--c:${sec.accent}` : undefined}>
        <span class="group-bar" aria-hidden="true"></span>
        {sec.label}
        <span class="group-n">{sec.items.length}</span>
      </h2>
      <div class="grid">
        {#each sec.items as p (p.id)}
          <figure class="cell">
            <img src={urls.get(p.id)} alt={p.caption ?? 'Foto viaggio'} loading="lazy" />
            <button type="button" class="del" aria-label="Elimina foto" onclick={() => remove(p.id)}>✕</button>
          </figure>
        {/each}
      </div>
    </section>
  {/each}
{/if}

<style>
  .pick-btn { display: block; width: 100%; text-align: center; cursor: pointer; }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
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
  .group { margin-bottom: 22px; }
  .group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--serif);
    font-size: 1rem;
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 10px;
  }
  .group-bar {
    width: 3px;
    height: 1em;
    border-radius: 2px;
    background: var(--c, var(--cinabro));
  }
  .group-n {
    margin-left: auto;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    color: var(--ink-faint);
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
