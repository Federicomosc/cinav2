<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte';
  import ChecklistCard from '../components/ChecklistCard.svelte';
  import VaultCard from '../components/VaultCard.svelte';
  import BackupCard from '../components/BackupCard.svelte';
  import { go } from '../lib/router.svelte';
</script>

<div class="docs-page">
  <PageHeader
    eyebrow="🔒 cifrato sul telefono"
    title="Documenti"
    sub="Checklist pre-partenza e cassaforte per passaporto, visti e biglietti."
    backLabel="Oggi"
    onback={() => go('oggi')}
  />

  <ChecklistCard />
  <VaultCard />
  <BackupCard />
</div>

<style>
  .docs-page { padding-bottom: 12px; }
</style>
