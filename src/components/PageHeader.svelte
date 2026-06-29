<script lang="ts">
  interface Props {
    eyebrow?: string;
    title: string;
    sub?: string;
  }
  let { eyebrow, title, sub }: Props = $props();
</script>

<header class="ph">
  <div class="deco" aria-hidden="true">
    <span class="line"></span>
    <span class="diamond"></span>
    <span class="line"></span>
  </div>
  {#if eyebrow}<div class="eyebrow">{eyebrow}</div>{/if}
  <h1>{title}</h1>
  {#if sub}<p class="muted sub">{sub}</p>{/if}
</header>

<style>
  .ph { margin-bottom: 24px; }
  .deco {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--line-strong), transparent);
  }
  .diamond {
    width: 7px;
    height: 7px;
    background: var(--cinabro);
    transform: rotate(45deg);
    box-shadow: 0 0 12px var(--cinabro-glow);
    flex: none;
  }
  h1 {
    font-size: 2.25rem;
    margin: 6px 0 4px;
    background: linear-gradient(135deg, var(--ink) 30%, var(--ink-soft) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sub {
    font-size: 0.92rem;
    line-height: 1.5;
    max-width: 32ch;
  }
</style>
