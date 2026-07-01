<script lang="ts">
  import PoiPhoto from './PoiPhoto.svelte';
  import { CAT_COLOR, CAT_LABEL } from '../lib/poi';
  import { formatDistanceM, formatDurationS, type ItineraryPlan } from '../lib/routing';
  import type { CityItineraryView } from '../lib/itinerary';

  interface Props {
    activeItin: CityItineraryView;
    itinPlan: ItineraryPlan | null;
    itinLoading: boolean;
    itinError: string;
    itinSheetH: number;
    itinHMin: number;
    itinCompact: boolean;
    itinLegIdx: number;
    itinDragging: boolean;
    itinWalkHint: string | null;
    maxItinSheetH: () => number;
    onDragStart: (e: PointerEvent) => void;
    onDragMove: (e: PointerEvent) => void;
    onDragEnd: (e: PointerEvent) => void;
    onSetSheetH: (h: number) => void;
    onSelectLeg: (i: number) => void;
    onClose: () => void;
    onFocusPoi: (id: string) => void;
  }
  let {
    activeItin,
    itinPlan,
    itinLoading,
    itinError,
    itinSheetH,
    itinHMin,
    itinCompact,
    itinLegIdx,
    itinDragging,
    itinWalkHint,
    maxItinSheetH,
    onDragStart,
    onDragMove,
    onDragEnd,
    onSetSheetH,
    onSelectLeg,
    onClose,
    onFocusPoi,
  }: Props = $props();
</script>

<aside
  class="itin-sheet"
  class:dragging={itinDragging}
  style="height: {itinSheetH}px"
  aria-label="Itinerario {activeItin.title}"
>
  <div
    class="itin-grab"
    role="separator"
    aria-orientation="horizontal"
    aria-valuenow={itinSheetH}
    aria-valuemin={itinHMin}
    aria-valuemax={maxItinSheetH()}
    aria-label="Trascina per ridimensionare il pannello"
    onpointerdown={onDragStart}
    onpointermove={onDragMove}
    onpointerup={onDragEnd}
    onpointercancel={onDragEnd}
  >
    <span class="itin-grab-bar" aria-hidden="true"></span>
  </div>
  <div class="itin-sheet-head">
    <div class="itin-head-main">
      <span class="nav-label">Itinerario</span>
      <strong class="itin-sheet-title">{activeItin.title}</strong>
      {#if itinPlan && itinPlan.distanceM > 0}
        <p class="nav-meta">
          {formatDistanceM(itinPlan.distanceM)} · {formatDurationS(itinPlan.durationS)} a piedi
          {#if itinPlan.fallback}<span class="nav-fallback"> · stima</span>{/if}
        </p>
      {:else if itinLoading}
        <p class="nav-meta muted">Calcolo percorso…</p>
      {/if}
    </div>
    <div class="itin-size-btns" role="group" aria-label="Dimensione pannello">
      <button type="button" class="size-btn" class:on={itinSheetH <= itinHMin + 12} onclick={() => onSetSheetH(itinHMin)} title="Minimo">S</button>
      <button type="button" class="size-btn" class:on={itinSheetH > itinHMin + 12 && itinSheetH < maxItinSheetH() - 40} onclick={() => onSetSheetH(220)} title="Medio">M</button>
      <button type="button" class="size-btn" class:on={itinSheetH >= maxItinSheetH() - 40} onclick={() => onSetSheetH(maxItinSheetH())} title="Massimo">L</button>
    </div>
    <button class="itin-close" onclick={onClose} aria-label="Chiudi itinerario">×</button>
  </div>

  <div class="itin-sheet-scroll">
    {#if itinCompact}
      <div class="itin-compact-stops" aria-hidden="true">
        {#each activeItin.stops as p, i (p.id)}
          <span class="itin-compact-dot" title={p.name}>{i + 1}</span>
          {#if i < activeItin.stops.length - 1}<span class="itin-compact-line"></span>{/if}
        {/each}
      </div>
      <p class="itin-expand-hint">Trascina ↑ o tocca M / L per dettagli</p>
    {:else}
      {#if itinPlan && itinPlan.legs.length > 1}
        <div class="itin-legs" role="tablist" aria-label="Tratti">
          {#each itinPlan.legs as _, i (i)}
            <button
              type="button"
              class="itin-leg-tab"
              class:on={itinLegIdx === i}
              role="tab"
              aria-selected={itinLegIdx === i}
              onclick={() => onSelectLeg(i)}
            >
              {i + 1}→{i + 2}
            </button>
          {/each}
        </div>
      {/if}

      {#if itinPlan?.legs[itinLegIdx]?.steps?.length}
        <ol class="itin-directions" aria-label="Indicazioni stradali">
          {#each itinPlan.legs[itinLegIdx].steps as step, i (i)}
            <li class="itin-dir">
              <span class="itin-dir-text">{step.instruction}</span>
              {#if step.distanceM > 0}
                <span class="itin-dir-meta">{formatDistanceM(step.distanceM)}</span>
              {/if}
            </li>
          {/each}
        </ol>
      {:else if itinPlan && !itinLoading}
        <p class="itin-dir-empty muted">Indicazioni dettagliate non disponibili per questo tratto.</p>
      {/if}

      <ol class="itin-stops">
        {#each activeItin.stops as p, i (p.id)}
          <li>
            <button class="itin-stop" onclick={() => onFocusPoi(p.id)}>
              <span class="itin-stop-num">{i + 1}</span>
              <PoiPhoto id={p.id} category={p.category} name={p.name} variant="thumb" />
              <span class="itin-stop-body">
                <span class="itin-stop-name">{p.name}</span>
                <span class="itin-stop-cat" style="--c:{CAT_COLOR[p.category]}">{CAT_LABEL[p.category]}</span>
              </span>
              <span class="itin-stop-go" aria-hidden="true">›</span>
            </button>
          </li>
        {/each}
      </ol>
    {/if}

    {#if itinWalkHint && !itinCompact}
      <p class="walk-hint-sheet">{itinWalkHint}</p>
    {/if}
    {#if itinError}<p class="nav-err">{itinError}</p>{/if}
    {#if itinPlan?.fallback && !itinError && activeItin.stops.length > 1 && !itinCompact}
      <p class="nav-hint">Alcuni tratti sono stime — serve connessione o tile routing locali.</p>
    {/if}
  </div>
</aside>

<style>
  .nav-label {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 4px;
  }
  .nav-meta {
    margin: 6px 0 0;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--jade-bright);
  }
  .nav-fallback { color: var(--ink-faint); }
  .nav-err, .nav-hint {
    margin: 10px 0 0;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--cinabro-bright);
  }
  .nav-hint { color: var(--ink-faint); }

  .itin-sheet {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 6;
    display: flex;
    flex-direction: column;
    background: var(--sheet-bg-solid);
    backdrop-filter: blur(8px);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 4px 12px 8px;
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    transition: box-shadow 0.15s;
  }
  .itin-sheet.dragging {
    box-shadow: var(--shadow-lg), 0 0 0 1px var(--cinabro);
  }
  .itin-grab {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 10px 0 6px;
    cursor: ns-resize;
    touch-action: none;
    flex: none;
  }
  .itin-grab-bar {
    width: 40px;
    height: 5px;
    border-radius: 3px;
    background: var(--line-strong);
  }
  .itin-sheet.dragging .itin-grab-bar {
    background: var(--cinabro);
    width: 48px;
  }
  .itin-sheet-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .itin-size-btns {
    display: flex;
    gap: 4px;
    flex: none;
  }
  .size-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: var(--ink-faint);
  }
  .size-btn.on {
    background: var(--cinabro);
    border-color: var(--cinabro);
    color: #fff;
  }
  .itin-head-main {
    flex: 1;
    min-width: 0;
  }
  .itin-compact-stops {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 4px 8px 2px;
  }
  .itin-compact-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: var(--cinabro);
    flex: none;
  }
  .itin-compact-line {
    flex: 1;
    height: 2px;
    min-width: 12px;
    max-width: 40px;
    background: linear-gradient(90deg, var(--cinabro), color-mix(in srgb, var(--cinabro) 30%, transparent));
    opacity: 0.7;
  }
  .itin-expand-hint {
    margin: 0;
    padding: 0 4px 2px;
    text-align: center;
    font-size: 0.72rem;
    color: var(--ink-faint);
  }
  .walk-hint-sheet {
    margin: 8px 0 0;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--gold) 14%, var(--sheet-bg-solid));
    border: 1px solid color-mix(in srgb, var(--gold) 40%, var(--line));
    font-size: 0.76rem;
    line-height: 1.45;
    color: var(--ink-soft);
  }
  .itin-legs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 8px 0 4px;
  }
  .itin-legs::-webkit-scrollbar { display: none; }
  .itin-leg-tab {
    flex: none;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    padding: 5px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--paper-2);
    color: var(--ink-soft);
  }
  .itin-leg-tab.on {
    background: var(--cinabro);
    border-color: var(--cinabro);
    color: #fff;
  }
  .itin-directions {
    list-style: none;
    margin: 0;
    padding: 0 2px 8px;
    max-height: 120px;
    overflow-y: auto;
    border-bottom: 1px solid var(--line);
  }
  .itin-dir {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    padding: 7px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--ink-body);
  }
  .itin-dir:last-child { border-bottom: none; }
  .itin-dir-meta {
    flex: none;
    font-family: var(--mono);
    font-size: 9px;
    color: var(--ink-faint);
  }
  .itin-dir-empty {
    font-size: 0.78rem;
    margin: 0;
    padding: 4px 2px 8px;
  }
  .itin-sheet-head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 6px;
    flex: none;
  }
  .itin-sheet-title {
    display: block;
    font-family: var(--serif);
    font-size: 1.05rem;
    color: var(--ink);
    line-height: 1.25;
  }
  .itin-close {
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
    font-size: 1.25rem;
    line-height: 1;
  }
  .itin-stops {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-height: 0;
  }
  .itin-stop {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    text-align: left;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--paper-2);
  }
  .itin-stop-num {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: var(--cinabro);
  }
  .itin-stop-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .itin-stop-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.25;
  }
  .itin-stop-cat {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--c);
  }
  .itin-stop-go {
    flex: none;
    color: var(--ink-faint);
    font-size: 1.1rem;
  }
</style>
