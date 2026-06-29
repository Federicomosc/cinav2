<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    icon?: string;
    hanzi?: string;
    title: string;
    hint?: string;
    children?: Snippet;
  }
  let { icon = '○', hanzi, title, hint, children }: Props = $props();
</script>

<div class="empty-state card">
  {#if hanzi}
    <span class="empty-seal" aria-hidden="true">{hanzi}</span>
  {:else}
    <div class="empty-icon-wrap">
      <span class="empty-icon" aria-hidden="true">{icon}</span>
    </div>
  {/if}
  <p class="empty-title">{title}</p>
  {#if hint}<p class="empty-hint">{hint}</p>{/if}
  {#if children}
    <div class="empty-action">
      {@render children()}
    </div>
  {/if}
</div>
