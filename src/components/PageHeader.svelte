<script lang="ts">
  import ScreenHeader from './ScreenHeader.svelte';

  interface Props {
    eyebrow?: string;
    title: string;
    sub?: string;
    backLabel?: string;
    onback?: () => void;
  }
  let { eyebrow, title, sub, backLabel, onback }: Props = $props();
</script>

<ScreenHeader seal="旅" {eyebrow} {title} {sub} {backLabel} {onback} />
