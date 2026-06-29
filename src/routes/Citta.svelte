<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte';
  import { citta, legByCity, poisOfCity } from '../lib/content';
  import { go } from '../lib/router.svelte';
  import { shortDate } from '../lib/format';
  import { cityTheme, cityCoverSrc } from '../lib/city-theme';
  import type { CityId } from '../data/types';

  const totalPois = $derived(citta.reduce((n, c) => n + poisOfCity(c.id as CityId).length, 0));
</script>

<PageHeader
  eyebrow="Il viaggio"
  title="Città"
  sub="Cinque tappe, dalla Sichuan alla costa — guida, luoghi e itinerari per ognuna."
/>

<div class="journey-bar" aria-hidden="true">
  <span class="journey-stat">
    <span class="journey-num">5</span>
    <span class="journey-lbl">tappe</span>
  </span>
  <span class="journey-sep"></span>
  <span class="journey-stat">
    <span class="journey-num">{totalPois}</span>
    <span class="journey-lbl">luoghi</span>
  </span>
  <span class="journey-sep"></span>
  <span class="journey-stat">
    <span class="journey-num">西</span>
    <span class="journey-lbl">→ 东</span>
  </span>
</div>

<div class="city-list list-stagger">
  {#each citta as c, i (c.id)}
    {@const leg = legByCity.get(c.id)}
    {@const theme = cityTheme(c.id)}
    {@const poiCount = poisOfCity(c.id as CityId).length}
    <button
      class="city-card card-interactive"
      style="--accent: {theme.accent}"
      onclick={() => go('citta', c.id)}
    >
      <div class="cover-zone" aria-hidden="true">
        <img class="cover" src={cityCoverSrc(c.id)} alt="" loading="lazy" decoding="async" />
        <div class="cover-scrim"></div>
        <div class="cover-accent-line"></div>
        <span class="step-stamp">{String(i + 1).padStart(2, '0')}</span>
        <span class="cover-icon">{theme.icon}</span>
        <div class="cover-titles">
          <h2 class="name">{c.name}</h2>
          <span class="cn">{c.nameLocal}</span>
        </div>
      </div>

      <div class="card-body">
        <div class="meta-row">
          <span class="meta-tag">Tappa {i + 1}</span>
          {#if leg}
            <span class="meta-date">{shortDate(leg.from)} – {shortDate(leg.to)}</span>
          {/if}
        </div>

        <p class="intro prose-lead">{c.intro}</p>

        <div class="highlights">
          {#each c.highlights.slice(0, 3) as h (h)}
            <span class="hl-chip">{h}</span>
          {/each}
        </div>

        <div class="card-foot">
          <span class="poi-count">{poiCount} luoghi da vedere</span>
          <span class="cta" aria-hidden="true">Apri guida ›</span>
        </div>
      </div>
    </button>
  {/each}
</div>

<style>
  .journey-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin: -10px 0 22px;
    padding: 14px 18px;
    border-radius: var(--radius-md);
    background: linear-gradient(
      155deg,
      color-mix(in srgb, var(--city-accent, var(--cinabro)) 8%, var(--surface)) 0%,
      var(--surface) 50%,
      color-mix(in srgb, var(--jade) 5%, var(--surface)) 100%
    );
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .journey-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .journey-num {
    font-family: var(--serif);
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .journey-lbl {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }
  .journey-sep {
    flex: none;
    width: 1px;
    height: 28px;
    background: linear-gradient(180deg, transparent, var(--line-strong), transparent);
  }

  .city-list {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding-bottom: 8px;
  }

  .city-card {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0;
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--line-strong));
    background: var(--surface);
    box-shadow:
      var(--shadow-md),
      0 0 0 1px color-mix(in srgb, var(--accent) 6%, transparent),
      0 20px 40px color-mix(in srgb, var(--accent) 10%, transparent);
    transition: transform 0.22s var(--ease), box-shadow 0.22s var(--ease), border-color 0.22s;
  }
  .city-card:active {
    transform: scale(0.985);
    border-color: color-mix(in srgb, var(--accent) 42%, var(--line-strong));
    box-shadow:
      var(--shadow-lg),
      0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent),
      0 24px 48px color-mix(in srgb, var(--accent) 18%, transparent);
  }

  .cover-zone {
    position: relative;
    height: 168px;
    overflow: hidden;
  }
  .cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.02);
    filter: saturate(1.2) contrast(1.06);
    transition: transform 0.55s var(--ease), filter 0.3s;
  }
  .city-card:active .cover {
    transform: scale(1.08);
    filter: saturate(1.28) contrast(1.08);
  }
  .cover-scrim {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(125deg, color-mix(in srgb, #000 55%, transparent) 0%, transparent 48%),
      linear-gradient(180deg, transparent 0%, transparent 35%, color-mix(in srgb, #000 72%, transparent) 100%);
    pointer-events: none;
  }
  .cover-accent-line {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 30%, transparent) 75%, transparent);
    box-shadow: 0 -6px 20px color-mix(in srgb, var(--accent) 40%, transparent);
  }
  .step-stamp {
    position: absolute;
    left: 14px;
    top: 14px;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #fff;
    padding: 6px 10px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, #000 48%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }
  .cover-icon {
    position: absolute;
    right: 14px;
    top: 12px;
    font-size: 1.5rem;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
  }
  .cover-titles {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 16px;
    z-index: 2;
  }
  .name {
    font-family: var(--serif);
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.02em;
    color: #fff;
    text-shadow: 0 2px 16px rgba(0, 0, 0, 0.55);
    margin: 0;
  }
  .cn {
    display: block;
    font-family: var(--hanzi);
    font-size: 1.15rem;
    font-weight: 500;
    color: color-mix(in srgb, #fff 88%, var(--accent));
    margin-top: 2px;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.45);
  }

  .card-body {
    padding: 16px 18px 18px;
    position: relative;
  }
  .card-body::before {
    content: '';
    position: absolute;
    right: 6px;
    top: -12px;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent), transparent 70%);
    pointer-events: none;
  }

  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .meta-tag {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line));
  }
  .meta-date {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.05em;
    color: var(--ink-faint);
    white-space: nowrap;
  }

  .intro {
    margin: 0 0 14px;
    padding-left: 12px;
    border-left: 2px solid color-mix(in srgb, var(--accent) 50%, transparent);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.95rem;
    line-height: 1.62;
  }

  .highlights {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  .hl-chip {
    font-family: var(--mono);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-body);
    padding: 5px 9px;
    border-radius: var(--radius-pill);
    background: var(--paper-2);
    border: 1px solid var(--line);
  }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .poi-count {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink-faint);
  }
  .cta {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--accent);
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--line));
    box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 12%, transparent);
  }
</style>
