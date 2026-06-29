<script lang="ts">
  import PageHeader from './PageHeader.svelte';
  interface Props {
    eyebrow: string;
    title: string;
    phase: string;
    points: string[];
  }
  let { eyebrow, title, phase, points }: Props = $props();
</script>

<PageHeader {eyebrow} {title} />

<div class="card stub">
  <div class="badge">{phase}</div>
  <p class="muted">Schermata predisposta nello scaffold. Verrà implementata con:</p>
  <ul>
    {#each points as p}<li>{p}</li>{/each}
  </ul>
</div>

<style>
  .stub { margin-top: 4px; position: relative; overflow: hidden; }
  .stub::before {
    content: '';
    position: absolute;
    top: -20px; right: -20px;
    width: 100px; height: 100px;
    background: radial-gradient(circle, var(--gold-soft) 0%, transparent 70%);
    pointer-events: none;
  }
  .badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--jade-bright);
    background: var(--jade-soft);
    border: 1px solid rgba(63, 168, 122, 0.25);
    border-radius: var(--radius-pill);
    padding: 4px 12px;
    margin-bottom: 12px;
  }
  ul { margin: 12px 0 0 0; list-style: none; }
  li {
    position: relative;
    padding-left: 20px;
    margin: 10px 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
    line-height: 1.5;
  }
  li::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 10px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--cinabro);
  }
</style>
