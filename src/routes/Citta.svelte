<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte';
  import { citta, legByCity, poisOfCity } from '../lib/content';
  import { go } from '../lib/router.svelte';
  import { shortDate } from '../lib/format';
  import { cityTheme, cityCoverSrc } from '../lib/city-theme';
  import type { CityId } from '../data/types';
</script>

<PageHeader eyebrow="5 tappe" title="Città" sub="Tocca una tappa per guida, POI e itinerari." />

<div class="list-stack">
  {#each citta as c, i (c.id)}
    {@const leg = legByCity.get(c.id)}
    {@const theme = cityTheme(c.id)}
    <button
      class="city-card card card-interactive"
      style="--accent: {theme.accent}"
      onclick={() => go('citta', c.id)}
    >
      <div class="cover-wrap" aria-hidden="true">
        <img class="cover" src={cityCoverSrc(c.id)} alt="" loading="lazy" decoding="async" />
        <div class="cover-fade"></div>
      </div>
      <div class="inner">
        <span class="wm" aria-hidden="true">{c.nameLocal}</span>
        <div class="top">
          <span class="step">{theme.icon} Tappa {i + 1}</span>
          {#if leg}<span class="when">{shortDate(leg.from)} – {shortDate(leg.to)}</span>{/if}
        </div>
        <h2 class="name">{c.name}</h2>
        <span class="cn">{c.nameLocal}</span>
        <p class="intro prose-lead">{c.intro}</p>
        <div class="foot">
          <p class="highlights">{c.highlights.slice(0, 3).join(' · ')}</p>
          <span class="count">{poisOfCity(c.id as CityId).length} POI ›</span>
        </div>
      </div>
    </button>
  {/each}
</div>

<style>
  .city-card {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0;
    position: relative;
    overflow: hidden;
  }
  .cover-wrap {
    position: relative;
    height: 108px;
    overflow: hidden;
  }
  .cover-wrap::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    z-index: 2;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 35%, transparent));
  }
  .cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.72;
    filter: saturate(1.1);
  }
  .cover-fade {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 20%, var(--surface) 100%);
  }
  .inner {
    padding: 16px 18px 18px;
    position: relative;
  }
  .wm {
    position: absolute;
    right: 10px;
    top: 4px;
    font-family: var(--hanzi);
    font-size: 3.2rem;
    font-weight: 600;
    color: color-mix(in srgb, var(--accent) 14%, transparent);
    line-height: 1;
    pointer-events: none;
    user-select: none;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }
  .step {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .when {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--ink-faint);
    white-space: nowrap;
  }
  .name {
    font-size: 1.5rem;
    line-height: 1.1;
    position: relative;
    z-index: 1;
  }
  .cn {
    display: block;
    font-family: var(--hanzi);
    font-size: 1.2rem;
    font-weight: 500;
    color: var(--accent);
    margin-top: 2px;
    position: relative;
    z-index: 1;
  }
  .intro {
    margin: 12px 0 14px;
    padding-left: 12px;
    border-left: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    position: relative;
    z-index: 1;
  }
  .foot {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    position: relative;
    z-index: 1;
  }
  .highlights {
    flex: 1;
    min-width: 0;
    font-size: 0.76rem;
    color: var(--ink-body);
    line-height: 1.45;
    letter-spacing: 0.01em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .count {
    flex: none;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--cinabro-bright);
    white-space: nowrap;
  }
</style>
