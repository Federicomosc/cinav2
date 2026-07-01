<script lang="ts">
  import { onMount } from 'svelte';
  import { liveQuery } from 'dexie';
  import PageHeader from '../components/PageHeader.svelte';
  import { emergenze, itinerario } from '../lib/content';
  import { db, type MedicalCard } from '../db/dexie';
  import { go } from '../lib/router.svelte';

  const members = itinerario.trip.members;

  const EMG_ZH: Record<string, string> = {
    Polizia: '警察',
    Ambulanza: '急救',
    Pompieri: '火警',
    'Incidenti stradali': '交通事故',
    'Hotline turistica nazionale': '旅游热线',
  };

  const FIELDS: { key: keyof Omit<MedicalCard, 'member'>; it: string; zh: string }[] = [
    { key: 'bloodType', it: 'Gruppo sanguigno', zh: '血型' },
    { key: 'allergies', it: 'Allergie', zh: '过敏' },
    { key: 'meds', it: 'Farmaci', zh: '常用药物' },
    { key: 'conditions', it: 'Patologie', zh: '疾病史' },
  ];

  let cards = $state<Map<string, MedicalCard>>(new Map());
  let editing = $state<string | null>(null);
  let draft = $state<MedicalCard>({ member: '' });

  onMount(() => {
    const sub = liveQuery(() => db.medical.toArray()).subscribe(
      (v) => (cards = new Map(v.map((c) => [c.member, c]))),
    );
    return () => sub.unsubscribe();
  });

  function startEdit(member: string) {
    draft = { ...(cards.get(member) ?? { member }) };
    editing = member;
  }
  async function save() {
    await db.medical.put({ ...draft, member: editing! });
    editing = null;
  }
</script>

<PageHeader eyebrow="✚ sempre offline" title="Emergenze" sub="Numeri grandi e toccabili. Funziona senza rete." backLabel="Oggi" onback={() => go('oggi')} />

<div class="block-head">
  <h2 class="block-title">Emergenze cinesi</h2>
  <span class="block-sub">🇨🇳</span>
</div>
<div class="grid list-stagger">
  {#each emergenze.cinesi as e (e.number)}
    <a class="num card card-interactive" href={`tel:${e.number}`}>
      <span class="num-ring" aria-hidden="true"></span>
      <span class="n">{e.number}</span>
      <span class="l">{e.label}</span>
      {#if EMG_ZH[e.label]}<span class="zh">{EMG_ZH[e.label]}</span>{/if}
    </a>
  {/each}
</div>

<div class="block-head">
  <h2 class="block-title">Rete consolare italiana</h2>
  <span class="block-sub">🇮🇹</span>
</div>
<div class="list list-stagger">
  {#each emergenze.consolari as c (c.name + c.city)}
    <article class="card cons accent-card" style="--accent: var(--gold)">
      <div class="ctop"><b>{c.name}</b><span class="city">{c.city}</span></div>
      {#if c.address}<p class="addr">{c.address}</p>{/if}
      {#if c.addressLocal}<p class="addr-cn">{c.addressLocal}</p>{/if}
      <div class="phones">
        {#if c.phone}<a href={`tel:${c.phone.replace(/\s/g, '')}`}>☎ {c.phone}</a>{/if}
        {#if c.emergency24h}<a class="sos" href={`tel:${c.emergency24h.replace(/\s/g, '')}`}>SOS 24h</a>{/if}
      </div>
      {#if !c.verified}<div class="warn">⚠ da confermare sul sito Farnesina</div>{/if}
    </article>
  {/each}
</div>

<div class="block-head">
  <h2 class="block-title">Schede mediche</h2>
</div>
<p class="muted hint">Da mostrare al personale sanitario — etichette anche in cinese.</p>
<div class="list">
  {#each members as m (m)}
    {@const card = cards.get(m)}
    <article class="card med">
      <div class="ctop">
        <b>{m}</b>
        <button class="edit" onclick={() => (editing === m ? (editing = null) : startEdit(m))}>
          {editing === m ? 'Annulla' : 'Modifica'}
        </button>
      </div>

      {#if editing === m}
        {#each FIELDS as f (f.key)}
          <label class="fl">{f.it} · {f.zh}
            <input type="text" bind:value={draft[f.key]} />
          </label>
        {/each}
        <button class="save btn-primary" onclick={save}>Salva</button>
      {:else}
        <div class="med-grid">
          {#each FIELDS as f (f.key)}
            <div class="mrow">
              <span class="mk">{f.zh} · {f.it}</span>
              <span class="mv" class:empty={!card?.[f.key]}>{card?.[f.key] || '—'}</span>
            </div>
          {/each}
        </div>
      {/if}
    </article>
  {/each}
</div>

<p class="disclaimer muted">{emergenze.disclaimer}</p>

<style>
  .hint { font-size: 0.82rem; margin: -6px 0 10px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 12px;
  }
  .num {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-decoration: none;
    color: var(--ink);
    padding: 22px 12px;
    min-height: 128px;
    border-color: color-mix(in srgb, var(--cinabro) 32%, var(--line-strong));
    background: linear-gradient(
      165deg,
      color-mix(in srgb, var(--cinabro) 6%, var(--surface-hi)) 0%,
      var(--surface) 100%
    );
    overflow: hidden;
  }
  .num-ring {
    position: absolute;
    inset: 12px;
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--cinabro) 18%, transparent);
    pointer-events: none;
  }
  .num:active {
    border-color: color-mix(in srgb, var(--cinabro) 55%, var(--line-strong));
    box-shadow: var(--shadow-md), 0 0 28px var(--cinabro-glow);
  }
  .num .n {
    position: relative;
    font-family: var(--serif);
    font-size: 2.75rem;
    font-weight: 700;
    color: var(--cinabro-bright);
    line-height: 1;
    text-shadow: 0 0 32px var(--cinabro-glow);
  }
  .num .l {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    text-align: center;
  }
  .num .zh {
    font-family: var(--hanzi);
    font-size: 1.1rem;
    color: var(--ink-soft);
    margin-top: 2px;
  }
  .list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; }
  .cons {
    border-color: color-mix(in srgb, var(--gold) 28%, var(--line-strong));
    padding-left: 22px;
  }
  .med {
    border-color: color-mix(in srgb, var(--jade) 22%, var(--line-strong));
    background: linear-gradient(165deg, color-mix(in srgb, var(--jade) 4%, var(--surface-hi)) 0%, var(--surface) 100%);
  }
  .ctop { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .city { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); letter-spacing: 0.04em; }
  .addr { font-size: 0.88rem; margin: 8px 0 0; color: var(--ink-soft); }
  .addr-cn { font-family: var(--hanzi); font-size: 1.15rem; margin: 4px 0 0; }
  .phones { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; font-family: var(--mono); font-size: 0.88rem; }
  .phones a { color: var(--jade-bright); padding: 4px 0; }
  .phones a.sos { color: var(--cinabro-bright); }
  .warn { margin-top: 10px; font-size: 0.78rem; color: var(--gold); }
  .edit { font-family: var(--mono); font-size: 11px; font-weight: 500; color: var(--jade-bright); padding: 8px 4px; min-height: 36px; }
  .med-grid { display: flex; flex-direction: column; gap: 0; margin-top: 10px; }
  .mrow { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .mrow:last-child { border-bottom: none; }
  .mk { font-size: 0.82rem; color: var(--ink-faint); }
  .mv { font-weight: 600; text-align: right; }
  .mv.empty { color: var(--ink-faint); font-weight: 400; opacity: 0.5; }
  .fl { display: flex; flex-direction: column; gap: 5px; font-family: var(--mono); font-size: 10px; color: var(--ink-faint); margin-top: 10px; }
  .fl input { padding: 11px 14px; font-family: var(--sans); font-size: 1rem; }
  .save { margin-top: 12px; }
  .disclaimer { font-size: 0.78rem; margin-top: 24px; line-height: 1.5; }
</style>
