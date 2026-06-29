<script lang="ts">
  import { poiImageSrc } from '../lib/poiImage';
  import { CAT_COLOR, CAT_ICON } from '../lib/poi';
  import type { PoiCategory } from '../data/types';

  interface Props {
    id: string;
    category: PoiCategory;
    name: string;
    variant?: 'hero' | 'thumb';
  }

  let { id, category, name, variant = 'hero' }: Props = $props();

  const color = $derived(CAT_COLOR[category]);
  const icon = $derived(CAT_ICON[category]);

  let loaded = $state(false);
  let failed = $state(false);

  $effect(() => {
    id;
    loaded = false;
    failed = false;
  });
</script>

<div class="frame" class:thumb={variant === 'thumb'} class:hero={variant === 'hero'}>
  <div class="placeholder" style="--c:{color}" aria-hidden="true">
    <span class="ic">{icon}</span>
  </div>
  {#if !failed}
    <img
      src={poiImageSrc(id)}
      alt=""
      class:show={loaded}
      loading="lazy"
      decoding="async"
      onload={() => (loaded = true)}
      onerror={() => (failed = true)}
    />
  {/if}
</div>

<style>
  .frame {
    position: relative;
    overflow: hidden;
    flex: none;
  }
  .frame.hero {
    width: 100%;
    aspect-ratio: 16 / 9;
    max-height: 220px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    margin-bottom: 14px;
  }
  .frame.thumb {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    border: 1px solid var(--line-strong);
  }
  .placeholder {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--c) 30%, var(--surface-hi)) 0%,
      var(--surface) 100%
    );
  }
  .frame img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.2s var(--ease);
  }
  .frame img.show {
    opacity: 1;
  }
  .frame.thumb .ic {
    font-size: 1.5rem;
    line-height: 1;
  }
  .frame.hero .ic {
    font-size: 2.4rem;
    line-height: 1;
    opacity: 0.85;
  }
</style>
