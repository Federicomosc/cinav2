<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import PageHeader from '../components/PageHeader.svelte';
  import BigChars from '../components/BigChars.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import { frasi, alloggi, lessico } from '../lib/content';
  import { db, now } from '../db/dexie';
  import { speak, speakHanzi, hasLocalAudio } from '../lib/speak';
  import { translateOffline } from '../lib/translate-offline';
  import { go } from '../lib/router.svelte';
  import type { Frase, FraseCat } from '../data/types';

  type Mode = 'frasi' | 'traduci';

  const catLabel: Record<FraseCat, string> = {
    base: 'Base & cortesia',
    taxi: 'Taxi & trasporti',
    ristorante: 'Ristorante',
    alloggio: 'Alloggio',
    acquisti: 'Acquisti',
    emergenze: 'Emergenze',
    indicazioni: 'Indicazioni',
    aeroporto: 'Aeroporto',
    hotel: 'Hotel',
    metro: 'Metro',
    salute: 'Salute',
    turismo: 'Turismo',
    tecnologia: 'Tecnologia',
    tempo: 'Tempo & meteo',
    social: 'Social',
  };

  const catHue: Record<FraseCat, string> = {
    base: 'var(--jade-bright)',
    taxi: 'var(--gold)',
    ristorante: 'var(--cinabro-bright)',
    alloggio: '#9b6fd4',
    acquisti: '#4fc3c7',
    emergenze: 'var(--cinabro)',
    indicazioni: 'var(--ink-soft)',
    aeroporto: '#5c8fd6',
    hotel: '#8e6bb8',
    metro: '#e67e22',
    salute: '#e74c3c',
    turismo: '#27ae60',
    tecnologia: '#3498db',
    tempo: '#95a5a6',
    social: '#f39c12',
  };

  let mode = $state<Mode>('frasi');
  let query = $state('');
  let translateInput = $state('');
  let onlyFav = $state(false);
  let big = $state<{ hanzi: string; it: string; pinyin?: string } | null>(null);

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
    const m = new Map<FraseCat, Frase[]>();
    for (const f of filtered) {
      const arr = m.get(f.cat) ?? [];
      arr.push(f);
      m.set(f.cat, arr);
    }
    return [...m.entries()];
  });

  const translateHits = $derived(
    translateInput.trim() ? translateOffline(translateInput, frasi, lessico, 12) : [],
  );
</script>

<PageHeader
  eyebrow="语 offline"
  title="Frasario"
  sub={mode === 'frasi'
    ? 'Tocca una frase per mostrarla grande al tassista.'
    : 'Traduttore offline: cerca parole o frasi in italiano o hanzi.'}
  backLabel="Oggi"
  onback={() => go('oggi')}
/>

<div class="mode-tabs" role="tablist" aria-label="Modalità frasario">
  <button class="mode-tab" class:on={mode === 'frasi'} role="tab" aria-selected={mode === 'frasi'} onclick={() => (mode = 'frasi')}>
    Frasi
  </button>
  <button
    class="mode-tab"
    class:on={mode === 'traduci'}
    role="tab"
    aria-selected={mode === 'traduci'}
    onclick={() => (mode = 'traduci')}
  >
    Traduci <span class="offline-badge">offline</span>
  </button>
</div>

{#if mode === 'traduci'}
  <div class="translate-panel">
    <input
      class="search translate-input"
      type="search"
      placeholder="Scrivi in italiano o incolla hanzi…"
      bind:value={translateInput}
      autocomplete="off"
      autocorrect="off"
    />
    <p class="translate-hint">
      Nessuna connessione richiesta — cerca tra {frasi.length} frasi e {lessico.length} parole del dizionario locale.
    </p>
    {#if translateInput.trim() && translateHits.length === 0}
      <EmptyState hanzi="译" title="Nessuna corrispondenza" hint="Prova una parola più semplice, o cerca nel tab Frasi." />
    {:else if translateHits.length}
      <div class="list">
        {#each translateHits as hit (hit.hanzi + hit.it)}
          <div class="frase">
            <button
              class="main card-interactive"
              onclick={() => (big = { hanzi: hit.hanzi, it: hit.it, pinyin: hit.pinyin })}
            >
              <div class="it">
                {hit.it}
                {#if hit.showBig}<span class="tag taxi">★ tassista</span>{/if}
                {#if hit.audio}<span class="tag audio">🔊 offline</span>{/if}
                <span class="tag src">{hit.source === 'frase' ? 'frase' : 'parola'}</span>
              </div>
              <div class="pinyin">{hit.pinyin}</div>
              <div class="hanzi">{hit.hanzi}</div>
            </button>
            <div class="actions">
              <button class="act" aria-label="Pronuncia" onclick={() => speakHanzi(hit.hanzi, hit.audio)}>🔊</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="search-bar">
    <input class="search" type="search" placeholder="Cerca frase, pinyin, hanzi…" bind:value={query} />
    <button class="fav-filter" class:on={onlyFav} onclick={() => (onlyFav = !onlyFav)} aria-pressed={onlyFav}>★</button>
  </div>

  {#if !query.trim() && !onlyFav && hotelsWithAddr.length}
    <div class="block-head">
      <h3 class="block-title">Indirizzi alloggi</h3>
    </div>
    <div class="list">
      {#each hotelsWithAddr as a (a.id)}
        <button class="frase card-interactive" onclick={() => (big = { hanzi: a.addressLocal!, it: a.name })}>
          <div class="main">
            <div class="it">{a.name}</div>
            <div class="hanzi">{a.addressLocal}</div>
          </div>
        </button>
      {/each}
    </div>
  {/if}

  {#each grouped as [cat, list] (cat)}
    <div class="block-head">
      <h3 class="block-title">{catLabel[cat]}</h3>
      <span class="cat-chip" style="--chip-fg: {catHue[cat]}">{list.length}</span>
    </div>
    <div class="list list-stagger" style="--cat: {catHue[cat]}">
      {#each list as f (f.hanzi)}
        <div class="frase">
          <button class="main card-interactive" onclick={() => (big = { hanzi: f.hanzi, it: f.it, pinyin: f.pinyin })}>
            <div class="it">
              {f.it}{#if f.showBig}<span class="tag taxi">★ tassista</span>{/if}{#if hasLocalAudio(f)}<span class="tag audio"
                  >🔊 offline</span
                >{/if}
            </div>
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
    <EmptyState
      hanzi={onlyFav ? '★' : '语'}
      title={onlyFav ? 'Nessun preferito ancora' : 'Nessun risultato'}
      hint={onlyFav ? 'Tocca ☆ su una frase per salvarla qui.' : 'Prova un altro termine di ricerca.'}
    />
  {/if}
{/if}

{#if big}
  <BigChars hanzi={big.hanzi} it={big.it} pinyin={big.pinyin} onclose={() => (big = null)} />
{/if}

<style>
  .offline-badge {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 500;
    color: var(--jade-bright);
    margin-left: 4px;
    letter-spacing: 0.04em;
  }
  .translate-panel { margin-bottom: 8px; }
  .translate-input { width: 100%; margin-bottom: 8px; }
  .translate-hint {
    font-size: 0.8rem;
    color: var(--ink-faint);
    margin: 0 0 14px;
    line-height: 1.45;
  }
  .tag.src { color: var(--ink-faint); }
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
  .list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
  .frase {
    position: relative;
    display: flex;
    align-items: stretch;
    gap: 0;
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }
  .frase::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, var(--cat, var(--jade-bright)), color-mix(in srgb, var(--cat, var(--jade)) 40%, transparent));
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    pointer-events: none;
  }
  .main { flex: 1; text-align: left; padding: 14px 16px 14px 18px; background: none; border: none; color: inherit; }
  .it { font-weight: 600; color: var(--ink); font-size: 0.95rem; }
  .tag { font-family: var(--mono); font-size: 9px; color: var(--gold); margin-left: 8px; letter-spacing: 0.04em; }
  .tag.taxi {
    color: var(--gold);
    background: var(--gold-soft);
    border: 1px solid color-mix(in srgb, var(--gold) 35%, transparent);
    border-radius: var(--radius-pill);
    padding: 2px 8px;
    font-weight: 700;
    box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 25%, transparent);
  }
  .tag.audio { color: var(--jade-bright); }
  .pinyin { font-family: var(--mono); font-size: 0.82rem; color: var(--ink-faint); margin: 3px 0; letter-spacing: 0.02em; }
  .hanzi {
    font-family: var(--hanzi);
    font-size: 1.85rem;
    color: var(--ink);
    line-height: 1.25;
    text-shadow: 0 0 20px color-mix(in srgb, var(--cat, var(--jade)) 12%, transparent);
  }
  .actions {
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--line);
    background: color-mix(in srgb, var(--paper-2) 50%, transparent);
  }
  .act { flex: 1; width: 52px; font-size: 17px; color: var(--ink-faint); transition: color 0.15s, background 0.15s; }
  .act:active { background: var(--paper-2); }
  .act + .act { border-top: 1px solid var(--line); }
  .act.fav.on { color: var(--gold); }
</style>
