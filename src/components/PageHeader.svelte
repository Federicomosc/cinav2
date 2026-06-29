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
  .ph { margin-bottom: 26px; }
  .deco {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
  }
  .line {
    flex: 1;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--line-strong) 20%,
      color-mix(in srgb, var(--city-accent, var(--cinabro)) 35%, transparent) 50%,
      var(--line-strong) 80%,
      transparent
    );
  }
  .seal {
    flex: none;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    font-family: var(--hanzi);
    font-size: 15px;
    font-weight: 600;
    color: var(--city-accent, var(--cinabro-bright));
    background: color-mix(in srgb, var(--city-accent, var(--cinabro)) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--city-accent, var(--cinabro)) 30%, transparent);
    border-radius: 8px;
    box-shadow:
      0 0 20px color-mix(in srgb, var(--city-accent, var(--cinabro)) 25%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  h1 {
    font-size: 2.4rem;
    margin: 4px 0 6px;
    letter-spacing: -0.025em;
    line-height: 1.02;
    background: linear-gradient(
      135deg,
      var(--ink) 0%,
      color-mix(in srgb, var(--ink-soft) 85%, var(--city-accent, var(--cinabro))) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .sub {
    max-width: 36ch;
    margin-top: 4px;
    padding-left: 14px;
    border-left: 2px solid color-mix(in srgb, var(--city-accent, var(--cinabro)) 45%, transparent);
  }
</style>
