<script lang="ts">
  import ScreenHeader from './ScreenHeader.svelte';

  interface Props {
    eyebrow?: string;
    title: string;
    sub?: string;
  }
  let { eyebrow, title, sub }: Props = $props();
</script>

<ScreenHeader seal="旅" {eyebrow} {title} {sub} />
