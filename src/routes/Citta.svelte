<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte';
  import { citta, legByCity, poisOfCity } from '../lib/content';
  import { go } from '../lib/router.svelte';
  import { shortDate } from '../lib/format';
</script>

<PageHeader eyebrow="5 tappe" title="Città" sub="Tocca una tappa per guida, POI e itinerari." />

<div class="list-stack">
  {#each citta as c, i (c.id)}
    {@const leg = legByCity.get(c.id)}
    <button class="city-card card card-interactive" onclick={() => go('citta', c.id)}>
      <div class="num" aria-hidden="true">{i + 1}</div>
      <div class="body">
        <div class="head">
          <h2>{c.name} <span class="cn">{c.nameLocal}</span></h2>
          {#if leg}<span class="when">{shortDate(leg.from)} – {shortDate(leg.to)}</span>{/if}
        </div>
        <p class="intro">{c.intro}</p>
        <div class="foot">
          <div class="hl-row">
            {#each c.highlights.slice(0, 3) as h}<span class="chip">{h}</span>{/each}
          </div>
          <span class="count">{poisOfCity(c.id).length} POI ›</span>
        </div>
      </div>
    </button>
  {/each}
</div>

<style>
  .city-card {
    display: flex;
    gap: 16px;
    width: 100%;
    text-align: left;
    padding: 18px;
    position: relative;
    overflow: hidden;
  }
  .city-card::after {
    content: '';
    position: absolute;
    bottom: 0; right: 0;
    width: 80px; height: 80px;
    background: radial-gradient(circle at 100% 100%, var(--jade-soft) 0%, transparent 70%);
    pointer-events: none;
  }
  .num {
    flex: none;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    font-family: var(--serif);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--cinabro);
    background: var(--cinabro-soft);
    border-radius: 50%;
    border: 1px solid rgba(224, 74, 40, 0.2);
  }
  .body { flex: 1; min-width: 0; }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  h2 { font-size: 1.35rem; }
  .cn {
    color: var(--jade-bright);
    font-weight: 500;
    font-size: 0.95rem;
  }
  .when {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    white-space: nowrap;
    letter-spacing: 0.03em;
  }
  .intro {
    font-size: 0.9rem;
    margin: 10px 0 12px;
    color: var(--ink-soft);
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .hl-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .count {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 500;
    color: var(--cinabro-bright);
    white-space: nowrap;
  }
</style>
