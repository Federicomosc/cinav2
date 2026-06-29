<script lang="ts">
  import PoiPhoto from './PoiPhoto.svelte';
  import { poiById } from '../lib/content';
  import { CAT_COLOR, CAT_LABEL } from '../lib/poi';

  interface Props {
    title: string;
    stopIds: string[];
    accent: string;
    badge?: string;
    walkHint?: string | null;
    custom?: boolean;
    onclick: () => void;
    onedit?: () => void;
    ondelete?: () => void;
    onduplicate?: () => void;
  }

  let {
    title,
    stopIds,
    accent,
    badge,
    walkHint = null,
    custom = false,
    onclick,
    onedit,
    ondelete,
    onduplicate,
  }: Props = $props();
</script>

<div class="itin-card-wrap">
  <button type="button" class="itin-card card-interactive" style="--accent: {accent}" {onclick}>
    <div class="itin-accent" aria-hidden="true"></div>
    <div class="itin-inner">
      <div class="itin-head">
        <span class="itin-title">{title}</span>
        <span class="itin-badge">{badge ?? `${stopIds.length} tappe`}</span>
      </div>
      <ol class="itin-timeline">
        {#each stopIds as s, i (s)}
          {@const poi = poiById.get(s)}
          {#if poi}
            <li class="itin-step">
              <span class="itin-dot-wrap">
                <span class="itin-dot">{i + 1}</span>
                {#if i < stopIds.length - 1}<span class="itin-line" aria-hidden="true"></span>{/if}
              </span>
              <PoiPhoto id={poi.id} category={poi.category} name={poi.name} variant="thumb" />
              <span class="itin-poi">
                <span class="itin-poi-name">{poi.name}</span>
                <span class="itin-poi-cat" style="--c: {CAT_COLOR[poi.category]}">{CAT_LABEL[poi.category]}</span>
              </span>
            </li>
          {/if}
        {/each}
      </ol>
      {#if walkHint}
        <p class="walk-hint">{walkHint}</p>
      {/if}
      <span class="itin-cta">◎ Apri sulla mappa</span>
    </div>
  </button>
  {#if !custom && onduplicate}
    <div class="itin-actions">
      <button type="button" class="itin-act" onclick={onduplicate}>Usa come base</button>
    </div>
  {:else if custom && (onedit || ondelete)}
    <div class="itin-actions">
      {#if onedit}
        <button type="button" class="itin-act" onclick={onedit}>Modifica</button>
      {/if}
      {#if ondelete}
        <button type="button" class="itin-act del" onclick={ondelete}>Elimina</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .itin-card-wrap { display: flex; flex-direction: column; gap: 6px; }
  .itin-card {
    position: relative;
    width: 100%;
    text-align: left;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: linear-gradient(155deg, var(--surface-hi) 0%, var(--surface) 100%);
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-sm);
    transition: transform 0.15s var(--ease), box-shadow 0.15s var(--ease);
  }
  .itin-card:active {
    transform: scale(0.985);
    box-shadow: var(--shadow-md);
  }
  .itin-accent {
    height: 3px;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 35%, transparent));
  }
  .itin-inner { padding: 16px 16px 14px; }
  .itin-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 14px;
  }
  .itin-title {
    font-family: var(--serif);
    font-size: 1.12rem;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.25;
  }
  .itin-badge {
    flex: none;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
    border-radius: var(--radius-pill);
    padding: 4px 10px;
  }
  .itin-timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .itin-step {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
  }
  .itin-dot-wrap {
    position: relative;
    flex: none;
    width: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .itin-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: var(--accent);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent);
    z-index: 1;
  }
  .itin-line {
    position: absolute;
    top: 24px;
    bottom: -8px;
    width: 2px;
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 20%, transparent));
    opacity: 0.55;
  }
  .itin-poi {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .itin-poi-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.3;
  }
  .itin-poi-cat {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--c);
  }
  .itin-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--cinabro-bright);
  }
  .walk-hint {
    margin: 10px 0 0;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--gold) 12%, var(--paper-2));
    border: 1px solid color-mix(in srgb, var(--gold) 35%, var(--line));
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .itin-actions {
    display: flex;
    gap: 8px;
    padding: 0 4px;
  }
  .itin-act {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink-soft);
  }
  .itin-act.del {
    color: var(--cinabro-bright);
    border-color: color-mix(in srgb, var(--cinabro) 35%, var(--line));
  }
</style>
