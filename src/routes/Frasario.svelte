<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import PageHeader from '../components/PageHeader.svelte';
  import BigChars from '../components/BigChars.svelte';
  import { frasi, alloggi } from '../lib/content';
  import { db, now } from '../db/dexie';
  import { speak, hasLocalAudio } from '../lib/speak';
  import type { Frase } from '../data/types';

  const catLabel: Record<Frase['cat'], string> = {
    base: 'Base & cortesia',
    taxi: 'Taxi & trasporti',
    ristorante: 'Ristorante',
    alloggio: 'Alloggio',
    acquisti: 'Acquisti',
    emergenze: 'Emergenze',
    indicazioni: 'Indicazioni',
  };

  let query = $state('');
  let onlyFav = $state(false);
  let big = $state<{ hanzi: string; it: string; pinyin?: string } | null>(null);

  // preferiti persistenti
  let favIds = $state<Set<string>>(new Set());
  onMount(() => {
    const sub = liveQuery(() => db.favorites.where('kind').equals('phrase').toArray()).subscribe(
      (v) => (favIds = new Set(v.map((f) => f.id))),
    );
    return () => sub.unsubscribe();
  });
  function toggleFav(f: Frase) {
    if (favIds.has(f.hanzi)) db.favorites.delete(f.hanzi);
    else db.favorites.add({ id: f.hanzi, kind: 'phrase', addedAt: now() });
  }

  const hotelsWithAddr = alloggi.filter((a) => a.addressLocal);

  const filtered = $derived(
    frasi.filter((f) => {
      if (onlyFav && !favIds.has(f.hanzi)) return false;
      if (!query.trim()) return true;
      return (f.it + f.pinyin + f.hanzi).toLowerCase().includes(query.toLowerCase());
    }),
  );

  const grouped = $derived.by(() => {
    const m = new Map<Frase['cat'], Frase[]>();
    for (const f of filtered) {
      const arr = m.get(f.cat) ?? [];
      arr.push(f);
      m.set(f.cat, arr);
    }
    return [...m.entries()];
  });
</script>

<PageHeader eyebrow="语 offline" title="Frasario" sub="Tocca una frase per mostrarla grande al tassista." />

<div class="search-bar">
  <input class="search" type="search" placeholder="Cerca frase, pinyin, hanzi…" bind:value={query} />
  <button class="fav-filter" class:on={onlyFav} onclick={() => (onlyFav = !onlyFav)} aria-pressed={onlyFav}>★</button>
</div>

{#if !query.trim() && !onlyFav && hotelsWithAddr.length}
  <h3 class="section-cat">Indirizzi alloggi</h3>
  <div class="list">
    {#each hotelsWithAddr as a (a.id)}
      <button class="frase" onclick={() => (big = { hanzi: a.addressLocal!, it: a.name })}>
        <div class="main">
          <div class="it">{a.name}</div>
          <div class="hanzi">{a.addressLocal}</div>
        </div>
      </button>
    {/each}
  </div>
{/if}

{#each grouped as [cat, list] (cat)}
  <h3 class="section-cat">{catLabel[cat]}</h3>
  <div class="list">
    {#each list as f (f.hanzi)}
      <div class="frase">
        <button class="main" onclick={() => (big = { hanzi: f.hanzi, it: f.it, pinyin: f.pinyin })}>
          <div class="it">{f.it}{#if f.showBig}<span class="tag">★ tassista</span>{/if}{#if hasLocalAudio(f)}<span class="tag audio">🔊 offline</span>{/if}</div>
          <div class="pinyin">{f.pinyin}</div>
          <div class="hanzi">{f.hanzi}</div>
        </button>
        <div class="actions">
          <button class="act" aria-label="Pronuncia" onclick={() => speak(f)}>🔊</button>
          <button class="act fav" class:on={favIds.has(f.hanzi)} aria-label="Preferito" onclick={() => toggleFav(f)}>
            {favIds.has(f.hanzi) ? '★' : '☆'}
          </button>
        </div>
      </div>
    {/each}
  </div>
{/each}

{#if filtered.length === 0}
  <p class="muted empty">{onlyFav ? 'Nessun preferito ancora.' : 'Nessun risultato.'}</p>
{/if}

{#if big}
  <BigChars hanzi={big.hanzi} it={big.it} pinyin={big.pinyin} onclose={() => (big = null)} />
{/if}

<style>
  .search { flex: 1; padding: 12px 16px; }
  .fav-filter {
    width: 48px;
    flex: none;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--ink-faint);
    font-size: 18px;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .fav-filter.on { background: var(--gold); color: #fff; border-color: var(--gold); box-shadow: 0 4px 12px var(--gold-soft); }
  .list { display: flex; flex-direction: column; gap: 10px; }
  .frase {
    display: flex;
    align-items: stretch;
    gap: 0;
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .main { flex: 1; text-align: left; padding: 14px 16px; }
  .it { font-weight: 600; color: var(--ink); font-size: 0.95rem; }
  .tag { font-family: var(--mono); font-size: 9px; color: var(--gold); margin-left: 8px; letter-spacing: 0.04em; }
  .tag.audio { color: var(--jade-bright); }
  .pinyin { font-family: var(--mono); font-size: 0.82rem; color: var(--ink-faint); margin: 3px 0; letter-spacing: 0.02em; }
  .hanzi { font-family: var(--hanzi); font-size: 1.6rem; color: var(--ink); line-height: 1.3; }
  .actions { display: flex; flex-direction: column; border-left: 1px solid var(--line); }
  .act { flex: 1; width: 50px; font-size: 17px; color: var(--ink-faint); transition: color 0.15s, background 0.15s; }
  .act:active { background: var(--paper-2); }
  .act + .act { border-top: 1px solid var(--line); }
  .act.fav.on { color: var(--gold); }
  .empty { text-align: center; margin-top: 32px; font-size: 0.92rem; }
</style>
