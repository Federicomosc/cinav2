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

  let failed = $state(false);
  const color = $derived(CAT_COLOR[category]);
  const icon = $derived(CAT_ICON[category]);
</script>

{#if !failed}
  <img
    class={variant}
    src={poiImageSrc(id)}
    alt=""
    loading="lazy"
    decoding="async"
    onerror={() => (failed = true)}
  />
{:else}
  <div class="placeholder {variant}" style="--c:{color}" aria-hidden="true">
    <span class="ic">{icon}</span>
    <span class="lbl">{name}</span>
  </div>
{/if}

<style>
  img.hero, .placeholder.hero {
    display: block;
    width: 100%;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    aspect-ratio: 16 / 9;
    max-height: 220px;
    margin-bottom: 14px;
  }
  img.thumb, .placeholder.thumb {
    display: block;
    width: 52px;
    height: 52px;
    flex: none;
    object-fit: cover;
    border-radius: 10px;
    border: 1px solid var(--line-strong);
  }
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: linear-gradient(145deg, color-mix(in srgb, var(--c) 22%, var(--surface)) 0%, var(--surface) 100%);
    overflow: hidden;
  }
  .placeholder.thumb { gap: 0; }
  .ic { font-size: 1.6rem; line-height: 1; }
  .placeholder.thumb .ic { font-size: 1.1rem; }
  .lbl {
    font-family: var(--mono);
    font-size: 8px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint);
    text-align: center;
    padding: 0 6px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .placeholder.thumb .lbl { display: none; }
</style>
