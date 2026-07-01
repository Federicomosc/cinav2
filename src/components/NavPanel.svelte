<script lang="ts">
  import PoiPhoto from './PoiPhoto.svelte';
  import { formatDistanceM, formatDurationS, type NavPlan } from '../lib/routing';
  import { formatNavSummary, isOffRoute, type NavProgress } from '../lib/nav-guidance';
  import type { Poi } from '../data/types';

  interface Props {
    navDestPoi: Poi;
    navigating: boolean;
    navProgress: NavProgress | null;
    navPlan: NavPlan | null;
    navError: string;
    navLoading: boolean;
    tooFar: boolean;
    sampleRoute: boolean;
    navVoice: boolean;
    routingOffline: boolean;
    rerouteBusy: boolean;
    onToggleVoice: () => void;
    onStop: () => void;
    onRecenter: () => void;
    onClose: () => void;
    onStart: () => void;
    onPreviewSample: () => void;
    onBegin: () => void;
  }
  let {
    navDestPoi,
    navigating,
    navProgress,
    navPlan,
    navError,
    navLoading,
    tooFar,
    sampleRoute,
    navVoice,
    routingOffline,
    rerouteBusy,
    onToggleVoice,
    onStop,
    onRecenter,
    onClose,
    onStart,
    onPreviewSample,
    onBegin,
  }: Props = $props();
</script>

{#if navigating}
  <div class="nav-hud" aria-live="polite" aria-label="Navigazione attiva">
    {#if navProgress?.arrived}
      <p class="nav-hud-dist">◎</p>
      <p class="nav-hud-main">Sei arrivato</p>
      <p class="nav-hud-sub">{navDestPoi.name}</p>
    {:else if navProgress}
      <p class="nav-hud-dist">{formatDistanceM(navProgress.distanceToStepM)}</p>
      <p class="nav-hud-main">
        {navPlan?.steps?.[navProgress.stepIndex]?.instruction ?? 'Prosegui'}
      </p>
      <p class="nav-hud-sub">
        {formatNavSummary(navProgress.distanceRemainingM, navProgress.durationRemainingS)}
        {#if rerouteBusy} · ricalcolo…{:else if isOffRoute(navProgress.offRouteM)} · fuori percorso{/if}
      </p>
    {:else}
      <p class="nav-hud-main">Acquisizione GPS…</p>
    {/if}
    <div class="nav-hud-actions">
      <button
        type="button"
        class="nav-hud-btn"
        class:on={navVoice}
        onclick={onToggleVoice}
        aria-pressed={navVoice}
      >
        {navVoice ? '🔊' : '🔇'}
      </button>
      <button type="button" class="nav-hud-btn stop" onclick={onStop}>Stop</button>
      <button type="button" class="nav-hud-btn" onclick={onRecenter}>Centra</button>
    </div>
    {#if navPlan?.steps && navPlan.steps.length > 1 && !navProgress?.arrived}
      <ol class="nav-hud-steps" aria-label="Prossime indicazioni">
        {#each navPlan.steps.slice(navProgress?.stepIndex ?? 0, (navProgress?.stepIndex ?? 0) + 3) as step, i (i)}
          <li class:current={i === 0}>
            <span>{step.instruction}</span>
            {#if step.distanceM > 0 && i === 0}<em>{formatDistanceM(step.distanceM)}</em>{/if}
          </li>
        {/each}
      </ol>
    {/if}
  </div>
{:else}
  <aside class="nav-sheet" aria-label="Navigazione verso {navDestPoi.name}">
    <PoiPhoto id={navDestPoi.id} category={navDestPoi.category} name={navDestPoi.name} variant="hero" />
    <div class="nav-head">
      <span class="nav-label">Destinazione</span>
      <strong class="nav-name">{navDestPoi.name}</strong>
      {#if navPlan}
        <p class="nav-meta">
          {formatDistanceM(navPlan.distanceM)} · {formatDurationS(navPlan.durationS)} a piedi
          {#if navPlan.fallback}<span class="nav-fallback"> · stima</span>{/if}
          {#if routingOffline && !navPlan.fallback}<span class="nav-offline"> · offline</span>{/if}
        </p>
      {/if}
    </div>
    {#if navPlan?.steps?.length && navPlan.steps.length > 1}
      <ol class="nav-directions" aria-label="Anteprima indicazioni">
        {#each navPlan.steps.slice(0, 4) as step, i (i)}
          <li class="nav-dir">
            <span>{step.instruction}</span>
            {#if step.distanceM > 0}<em>{formatDistanceM(step.distanceM)}</em>{/if}
          </li>
        {/each}
        {#if navPlan.steps.length > 4}
          <li class="nav-dir more">+{navPlan.steps.length - 4} passaggi</li>
        {/if}
      </ol>
    {/if}
    <div class="nav-actions">
      {#if navPlan && sampleRoute}
        <button class="nav-btn ghost" onclick={onClose}>Chiudi</button>
        <button class="nav-btn secondary wide" onclick={onPreviewSample} disabled={navLoading}>
          {navLoading ? '…' : 'Rigenera esempio'}
        </button>
      {:else if navPlan}
        <button class="nav-btn ghost" onclick={onClose}>Chiudi</button>
        <button class="nav-btn secondary" onclick={onStart} disabled={navLoading}>
          {navLoading ? '…' : 'Aggiorna'}
        </button>
        <button class="nav-btn primary wide" onclick={onBegin} disabled={navLoading || !navPlan}>
          Avvia navigazione
        </button>
      {:else if tooFar}
        <button class="nav-btn ghost" onclick={onClose}>Chiudi</button>
        <button class="nav-btn primary wide" onclick={onPreviewSample} disabled={navLoading}>
          {navLoading ? 'Calcolo…' : 'Vedi percorso di esempio'}
        </button>
      {:else}
        <button class="nav-btn primary wide" onclick={onStart} disabled={navLoading}>
          {navLoading ? 'Calcolo percorso…' : 'Calcola percorso'}
        </button>
      {/if}
    </div>
    {#if navError}<p class="nav-err">{navError}</p>{/if}
    {#if sampleRoute}
      <p class="nav-hint ok-hint">Percorso di esempio · posizione simulata a ~700 m dal luogo, per provare le indicazioni offline della città.</p>
    {:else if navPlan?.fallback && !navError && !routingOffline}
      <p class="nav-hint">Percorso stimato — installa i tile routing (<code>npm run tiles:routing</code>) per strade reali offline.</p>
    {:else if navPlan && routingOffline && !navPlan.fallback}
      <p class="nav-hint ok-hint">Percorso pedonale offline sulle strade reali.</p>
    {/if}
  </aside>
{/if}

<style>
  .nav-sheet {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 5;
    background: color-mix(in srgb, var(--surface-elevated) 90%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
    border: 1px solid color-mix(in srgb, var(--jade) 28%, var(--line-strong));
    border-radius: var(--radius-md);
    padding: 14px 16px;
    box-shadow:
      var(--shadow-lg),
      0 0 28px color-mix(in srgb, var(--jade) 12%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .nav-label {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    margin-bottom: 4px;
  }
  .nav-name { font-size: 1rem; color: var(--ink); }
  .nav-meta {
    margin: 6px 0 0;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--jade-bright);
  }
  .nav-fallback { color: var(--ink-faint); }
  .nav-offline { color: var(--jade-bright); }
  .nav-directions {
    list-style: none;
    margin: 10px 0 0;
    padding: 10px 0 0;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 120px;
    overflow-y: auto;
  }
  .nav-dir {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 0.82rem;
    line-height: 1.4;
    color: var(--ink-body);
  }
  .nav-dir em {
    font-style: normal;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-faint);
    flex: none;
  }
  .nav-dir.more { color: var(--ink-faint); font-size: 0.78rem; }
  .nav-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .nav-btn {
    flex: 1;
    min-width: 0;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    border-radius: var(--radius-pill);
    padding: 10px 12px;
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
  }
  .nav-btn.primary {
    flex: 1.4;
    border-color: var(--jade);
    background: linear-gradient(135deg, var(--jade) 0%, #2d8a62 100%);
    color: #fff;
    box-shadow: 0 4px 14px color-mix(in srgb, var(--jade) 30%, transparent);
  }
  .nav-btn.secondary {
    flex: none;
    border-color: color-mix(in srgb, var(--jade) 35%, var(--line));
    color: var(--jade-bright);
  }
  .nav-btn.wide { flex: 1 1 100%; }
  .nav-btn.ghost { flex: none; }
  .nav-btn:disabled { opacity: 0.6; }
  .nav-hud {
    position: absolute;
    left: 10px;
    right: 10px;
    top: 10px;
    z-index: 7;
    padding: 14px 16px 12px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--surface-elevated) 94%, transparent);
    backdrop-filter: saturate(1.4) blur(8px);
    -webkit-backdrop-filter: saturate(1.4) blur(8px);
    border: 1px solid color-mix(in srgb, var(--jade) 35%, var(--line-strong));
    box-shadow: var(--shadow-lg), 0 0 32px color-mix(in srgb, var(--jade) 15%, transparent);
  }
  .nav-hud-dist {
    font-family: var(--serif);
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    color: var(--jade-bright);
    margin-bottom: 4px;
  }
  .nav-hud-main {
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--ink);
  }
  .nav-hud-sub {
    margin-top: 6px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-faint);
  }
  .nav-hud-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .nav-hud-btn {
    flex: 1;
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    padding: 9px 12px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-soft);
  }
  .nav-hud-btn.stop {
    color: var(--cinabro-bright);
    border-color: color-mix(in srgb, var(--cinabro) 35%, var(--line));
  }
  .nav-hud-btn.on {
    color: var(--jade-bright);
    border-color: color-mix(in srgb, var(--jade) 40%, var(--line));
    background: color-mix(in srgb, var(--jade) 12%, var(--surface));
  }
  .nav-hud-steps {
    list-style: none;
    margin: 12px 0 0;
    padding: 10px 0 0;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 88px;
    overflow-y: auto;
  }
  .nav-hud-steps li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.78rem;
    color: var(--ink-faint);
    line-height: 1.35;
  }
  .nav-hud-steps li.current {
    color: var(--ink);
    font-weight: 600;
  }
  .nav-hud-steps em {
    font-style: normal;
    font-family: var(--mono);
    font-size: 9px;
    flex: none;
  }
  .nav-err, .nav-hint {
    margin: 10px 0 0;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--cinabro-bright);
  }
  .nav-hint { color: var(--ink-faint); }
  .nav-hint.ok-hint { color: var(--jade-bright); }
</style>
