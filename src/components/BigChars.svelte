<script lang="ts">
  import { onMount } from 'svelte';
  import { portal } from '../lib/portal';

  interface Props {
    hanzi: string;
    it?: string;
    pinyin?: string;
    onclose: () => void;
  }
  let { hanzi, it, pinyin, onclose }: Props = $props();

  let closingGuard = $state(true);

  const sizeClass = $derived(
    hanzi.length > 32 ? 'size-s' : hanzi.length > 18 ? 'size-m' : hanzi.length > 10 ? 'size-ml' : 'size-l',
  );

  onMount(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      closingGuard = false;
    }, 350);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  });

  function onBackdrop(e: MouseEvent) {
    if (closingGuard) return;
    if (e.target !== e.currentTarget) return;
    onclose();
  }
</script>

<div class="big-backdrop" use:portal role="presentation" onclick={onBackdrop}>
  <div
    class="big-panel"
    class:long={hanzi.length > 18}
    role="dialog"
    aria-labelledby="big-hanzi"
    aria-modal="true"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="glow" aria-hidden="true"></div>
    <div class="content">
      <p id="big-hanzi" class="hanzi {sizeClass}">{hanzi}</p>
      {#if it}<p class="it">{it}</p>{/if}
      {#if pinyin}<p class="pinyin">{pinyin}</p>{/if}
    </div>
    <button type="button" class="big-close" onclick={onclose}>Chiudi</button>
    <span class="hint">Mostra al tassista · tocca fuori per chiudere</span>
  </div>
</div>

<style>
  .big-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1100;
    background: rgba(6, 5, 4, 0.96);
    display: grid;
    place-items: center;
    padding:
      calc(16px + var(--safe-top))
      16px
      calc(16px + var(--safe-bottom));
    animation: fadeIn 0.22s var(--ease) both;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .big-panel {
    position: relative;
    width: 100%;
    max-width: 440px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 28px 20px 16px;
    text-align: center;
    animation: scaleIn 0.32s var(--ease) 0.04s both;
  }
  .big-panel.long {
    justify-content: flex-start;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.94) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .glow {
    position: absolute;
    left: 50%;
    top: 42%;
    transform: translate(-50%, -50%);
    width: min(72vmin, 360px);
    height: min(72vmin, 360px);
    border-radius: 50%;
    background: radial-gradient(circle, var(--cinabro-soft) 0%, transparent 68%);
    pointer-events: none;
    z-index: 0;
  }
  .content {
    position: relative;
    z-index: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .hanzi {
    font-family: var(--hanzi);
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.04em;
    color: var(--ink);
    text-shadow: 0 0 48px var(--cinabro-glow);
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
    margin: 0;
  }
  .hanzi.size-l {
    font-size: clamp(3.2rem, 18vw, 7rem);
  }
  .hanzi.size-ml {
    font-size: clamp(2.6rem, 14vw, 5.5rem);
  }
  .hanzi.size-m {
    font-size: clamp(2rem, 10vw, 4rem);
    line-height: 1.35;
  }
  .hanzi.size-s {
    font-size: clamp(1.5rem, 7vw, 2.6rem);
    line-height: 1.45;
    letter-spacing: 0.02em;
  }
  .it {
    font-family: var(--serif);
    font-size: clamp(1.1rem, 4.5vw, 1.5rem);
    font-style: italic;
    color: var(--ink-soft);
    line-height: 1.35;
    max-width: 28ch;
    margin: 0;
  }
  .pinyin {
    font-family: var(--mono);
    font-size: clamp(0.95rem, 3.8vw, 1.15rem);
    color: var(--gold);
    letter-spacing: 0.06em;
    line-height: 1.4;
    max-width: 100%;
    margin: 0;
  }
  .big-close {
    position: relative;
    z-index: 1;
    flex: none;
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-soft);
    background: var(--paper-2);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-pill);
    padding: 12px 22px;
    min-height: 44px;
    touch-action: manipulation;
  }
  .big-close:active {
    border-color: var(--cinabro);
    color: var(--ink);
  }
  .hint {
    position: relative;
    z-index: 1;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-faint);
    opacity: 0.75;
    text-align: center;
    line-height: 1.4;
    max-width: 26ch;
  }
</style>
