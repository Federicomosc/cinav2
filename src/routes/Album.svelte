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
  <EmptyState hanzi="图" title="Nessuna foto ancora" hint="Importa dalla galleria — le foto restano solo su questo dispositivo.">
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
          <figure class="cell pressable">
            <img src={urls.get(p.id)} alt={p.caption ?? 'Foto viaggio'} loading="lazy" />
            <div class="cell-shade" aria-hidden="true"></div>
            {#if p.day}
              <span class="cell-date">{shortDate(p.day)}</span>
            {/if}
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
    gap: 8px;
  }
  .cell {
    position: relative;
    aspect-ratio: 1;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    margin: 0;
    box-shadow:
      var(--shadow-sm),
      0 4px 12px rgba(0, 0, 0, 0.15);
    transform: rotate(-0.5deg);
    transition: transform 0.3s var(--ease), box-shadow 0.3s;
  }
  .cell:nth-child(even) { transform: rotate(0.5deg); }
  .cell:active {
    transform: scale(0.97) rotate(0deg);
    box-shadow: var(--shadow-md);
  }
  .cell img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.35s var(--ease);
  }
  .cell:active img { transform: scale(1.06); }
  .cell-shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 55%, rgba(0, 0, 0, 0.55) 100%);
    pointer-events: none;
  }
  .cell-date {
    position: absolute;
    left: 8px;
    bottom: 8px;
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.92);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
    z-index: 1;
  }
  .del {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--overlay) 72%, transparent);
    backdrop-filter: blur(6px);
    color: #fff;
    font-size: 12px;
    display: grid;
    place-items: center;
    z-index: 2;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
</style>
