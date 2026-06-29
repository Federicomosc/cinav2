<script lang="ts">
  import PageHeader from '../components/PageHeader.svelte';
  import { go } from '../lib/router.svelte';

  const links = [
    { route: 'frasario' as const, icon: '语', label: 'Frasario', desc: 'Mostra al tassista', hue: 'c' },
    { route: 'spese' as const, icon: '¥', label: 'Spese', desc: 'Valuta & gruppo', hue: 'g' },
    { route: 'emergenze' as const, icon: '✚', label: 'Emergenze', desc: 'SOS & salute', hue: 'r' },
    { route: 'album' as const, icon: '◫', label: 'Album', desc: 'Foto di viaggio', hue: 'p' },
  ];
</script>

<PageHeader eyebrow="strumenti" title="Altro" sub="Frasario, spese, emergenze e album — sempre offline." />

<div class="grid">
  {#each links as l (l.route)}
    <button class="tile card card-interactive hue-{l.hue}" onclick={() => go(l.route)}>
      <span class="tile-icon">{l.icon}</span>
      <span class="tile-label">{l.label}</span>
      <span class="tile-desc">{l.desc}</span>
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 18px 16px;
    text-align: left;
    min-height: 120px;
    position: relative;
    overflow: hidden;
  }
  .tile::before {
    content: '';
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: var(--tile-accent, var(--cinabro-bright));
    box-shadow: 0 0 10px color-mix(in srgb, var(--tile-accent, var(--cinabro)) 40%, transparent);
  }
  .hue-c { --tile-accent: var(--cinabro-bright); }
  .hue-g { --tile-accent: var(--jade-bright); }
  .hue-r { --tile-accent: var(--cinabro); }
  .hue-p { --tile-accent: var(--gold); }
  .tile-icon {
    font-family: var(--hanzi);
    font-size: 1.6rem;
    line-height: 1;
    color: var(--tile-accent, var(--cinabro-bright));
  }
  .tile-label {
    font-family: var(--serif);
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--ink);
  }
  .tile-desc {
    font-size: 0.78rem;
    color: var(--ink-faint);
    line-height: 1.35;
  }
</style>
