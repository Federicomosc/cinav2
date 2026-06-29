import type { Tab } from './router.svelte';
import { db, type AirplaneTestItem } from '../db/dexie';

export interface AirplaneTestStep {
  id: string;
  label: string;
  hint: string;
  route?: Tab;
  order: number;
}

export type { AirplaneTestItem };

export const AIRPLANE_STEPS: AirplaneTestStep[] = [
  {
    id: 'prep-build',
    label: 'Build offline sul telefono',
    hint: 'Da Mac: npm run offline:prepare. Poi apri l’URL sul telefono e “Aggiungi a Home”.',
    order: 0,
  },
  {
    id: 'prep-airplane',
    label: 'Modalità aereo attiva',
    hint: 'Disattiva Wi‑Fi e dati mobili. L’app deve mostrare “Sei offline”.',
    order: 1,
  },
  {
    id: 'screen-oggi',
    label: 'Oggi — countdown, programma, scorciatoie',
    hint: 'Apri Oggi: date, prossimo spostamento e strumenti visibili.',
    route: 'oggi',
    order: 2,
  },
  {
    id: 'screen-viaggio',
    label: 'Viaggio — giorni, attività spuntabili',
    hint: 'Scorri i giorni, apri orari (dropdown), spunta un’attività.',
    route: 'logistica',
    order: 3,
  },
  {
    id: 'screen-citta',
    label: 'Città — guida e POI',
    hint: 'Apri una città, entra in un POI, torna indietro.',
    route: 'citta',
    order: 4,
  },
  {
    id: 'screen-mappa',
    label: 'Mappa — tile locali + marker',
    hint: 'Vedi “Mappa locale installata”. Zoom e tap su un POI.',
    route: 'mappa',
    order: 5,
  },
  {
    id: 'screen-frasario',
    label: 'Frasario — audio offline',
    hint: 'Tocca una frase con 🔊 offline: deve suonare senza rete.',
    route: 'frasario',
    order: 6,
  },
  {
    id: 'screen-documenti',
    label: 'Documenti — checklist e cassaforte',
    hint: 'Apri la cassaforte (password) o verifica la checklist.',
    route: 'documenti',
    order: 7,
  },
  {
    id: 'screen-spese',
    label: 'Spese — convertitore ¥/€',
    hint: 'Converti un importo; saldi leggibili.',
    route: 'spese',
    order: 8,
  },
  {
    id: 'screen-emergenze',
    label: 'Emergenze — numeri SOS',
    hint: 'Numeri grandi e schede mediche apribili.',
    route: 'emergenze',
    order: 9,
  },
];

const SEED_KEY = 'airplane-test-seeded';
const CHECKLIST_LABEL = 'TEST in modalità aereo superato';

export async function ensureAirplaneTest(): Promise<void> {
  if (await db.meta.get(SEED_KEY)) return;
  await db.airplaneTests.bulkAdd(
    AIRPLANE_STEPS.map((s) => ({ ...s, done: false, note: '' })),
  );
  await db.meta.put({ key: SEED_KEY, value: true });
}

/** Aggiorna la voce nella checklist pre-partenza quando tutto è verde. */
export async function syncAirplaneChecklist(items: AirplaneTestItem[]): Promise<void> {
  const allDone = items.length > 0 && items.every((i) => i.done);
  const row = (await db.checklist.toArray()).find((c) => c.label === CHECKLIST_LABEL);
  if (row && row.done !== allDone) {
    await db.checklist.update(row.id, { done: allDone });
  }
}
