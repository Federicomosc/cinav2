<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    icon?: string;
    title: string;
    hint?: string;
    children?: Snippet;
  }
  let { icon = '○', title, hint, children }: Props = $props();
</script>

<div class="empty-state card">
  <span class="empty-icon" aria-hidden="true">{icon}</span>
  <p class="empty-title">{title}</p>
  {#if hint}<p class="empty-hint">{hint}</p>{/if}
  {#if children}
    <div class="empty-action">
      {@render children()}
    </div>
  {/if}
</div>
