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
    <span class="seal">旅</span>
    <span class="line"></span>
  </div>
  {#if eyebrow}<div class="eyebrow">{eyebrow}</div>{/if}
  <h1>{title}</h1>
  {#if sub}<p class="sub prose-lead">{sub}</p>{/if}
</header>

<style>
  .ph { margin-bottom: 24px; }
  .deco {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--line-strong) 30%, var(--cinabro-soft) 50%, var(--line-strong) 70%, transparent);
  }
  .seal {
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    font-family: var(--hanzi);
    font-size: 14px;
    font-weight: 600;
    color: var(--cinabro-bright);
    background: var(--cinabro-soft);
    border: 1px solid rgba(232, 72, 40, 0.28);
    border-radius: 6px;
    box-shadow: 0 0 16px var(--cinabro-glow);
  }
  h1 {
    font-size: 2.25rem;
    margin: 6px 0 4px;
    background: linear-gradient(135deg, var(--ink) 0%, var(--ink-soft) 85%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sub {
    max-width: 34ch;
    margin-top: 2px;
  }
</style>
