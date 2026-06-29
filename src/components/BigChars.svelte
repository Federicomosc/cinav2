<script lang="ts">
  interface Props {
    hanzi: string;
    it?: string;
    pinyin?: string;
    onclose: () => void;
  }
  let { hanzi, it, pinyin, onclose }: Props = $props();
</script>

<button class="overlay" onclick={onclose} aria-label="Chiudi">
  <div class="glow" aria-hidden="true"></div>
  <div class="content">
    <div class="hanzi">{hanzi}</div>
    {#if it}<div class="it">{it}</div>{/if}
    {#if pinyin}<div class="pinyin">{pinyin}</div>{/if}
  </div>
  <span class="hint">tocca per chiudere</span>
</button>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(6, 5, 4, 0.96);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    text-align: center;
    animation: fadeIn 0.3s var(--ease) both;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .glow {
    position: absolute;
    width: 60vmin;
    height: 60vmin;
    border-radius: 50%;
    background: radial-gradient(circle, var(--cinabro-soft) 0%, transparent 65%);
    pointer-events: none;
  }
  .content {
    position: relative;
    animation: scaleIn 0.4s var(--ease) 0.05s both;
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
  }
  .hanzi {
    font-family: var(--hanzi);
    font-size: clamp(3.5rem, 20vw, 8rem);
    line-height: 1.1;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-shadow: 0 0 60px var(--cinabro-glow);
  }
  .it {
    font-family: var(--serif);
    font-size: 1.5rem;
    font-style: italic;
    margin-top: 20px;
    color: var(--ink-soft);
  }
  .pinyin {
    font-family: var(--mono);
    font-size: 1.1rem;
    color: var(--gold);
    margin-top: 10px;
    letter-spacing: 0.08em;
  }
  .hint {
    position: absolute;
    bottom: calc(28px + var(--safe-bottom));
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
    opacity: 0.7;
  }
</style>
