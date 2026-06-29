// Logica della Tab "Oggi": funzione PURA e DERIVATA — incrocia l'orologio di sistema
// con l'itinerario pre-caricato. Zero rete, zero input dell'utente.
import type { Itinerario, Leg, Transport } from '../data/types';
import { toIsoDay, daysBetween } from './format';

export type TripPhase = 'before' | 'during' | 'after';

export interface OggiInfo {
  todayIso: string;
  phase: TripPhase;
  /** giorni mancanti alla partenza (solo se phase === 'before') */
  daysToStart: number;
  /** tappa corrente (solo se phase === 'during') */
  leg?: Leg;
  /** giorno corrente dentro la tappa, 1-based */
  dayInLeg?: number;
  /** durata totale della tappa in giorni */
  legLength?: number;
  /** prossimo spostamento futuro (o in corso oggi) */
  nextTransport?: Transport;
  /** giorni al prossimo spostamento */
  daysToNextTransport?: number;
}

export function computeOggi(
  it: Itinerario,
  transports: Transport[],
  now: Date = new Date(),
): OggiInfo {
  const todayIso = toIsoDay(now);
  const { start, end } = it.trip;

  let phase: TripPhase = 'during';
  if (todayIso < start) phase = 'before';
  else if (todayIso > end) phase = 'after';

  const info: OggiInfo = {
    todayIso,
    phase,
    daysToStart: daysBetween(todayIso, start),
  };

  if (phase === 'during') {
    const leg = it.legs.find((l) => todayIso >= l.from && todayIso <= l.to);
    if (leg) {
      info.leg = leg;
      info.legLength = daysBetween(leg.from, leg.to) + 1;
      info.dayInLeg = daysBetween(leg.from, todayIso) + 1;
    }
  }

  // prossimo spostamento: il primo con giorno di partenza >= oggi
  const upcoming = transports
    .filter((t) => t.departAt.slice(0, 10) >= todayIso)
    .sort((a, b) => a.departAt.localeCompare(b.departAt))[0];
  if (upcoming) {
    info.nextTransport = upcoming;
    info.daysToNextTransport = daysBetween(todayIso, upcoming.departAt.slice(0, 10));
  }

  return info;
}
