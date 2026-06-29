// Punto unico di accesso al contenuto statico: importa i JSON bundlati e li espone
// già tipizzati. Le viste fanno solo `import { itinerario, pois } from '../lib/content'`.
import type {
  Itinerario,
  Transport,
  Poi,
  Citta,
  Frase,
  EmergContacts,
  CityContent,
  CityId,
  Alloggio,
  Giorno,
  ViaggioMeta,
} from '../data/types';
import type { LessicoEntry } from '../data/lessico';

import itinerarioRaw from '../data/itinerario.json';
import transportRaw from '../data/transport.json';
import poiRaw from '../data/poi.json';
import cittaRaw from '../data/citta.json';
import frasiRaw from '../data/frasi.json';
import lessicoRaw from '../data/lessico.json';
import emergenzeRaw from '../data/emergenze.json';
import cittaContentRaw from '../data/citta-content.json';
import alloggiRaw from '../data/alloggi.json';
import giorniRaw from '../data/giorni.json';
import viaggioMetaRaw from '../data/viaggio-meta.json';

export const itinerario = itinerarioRaw as Itinerario;
export const transports = transportRaw as Transport[];
export const pois = poiRaw as Poi[];
export const citta = cittaRaw as Citta[];
export const frasi = frasiRaw as Frase[];
export const lessico = lessicoRaw as LessicoEntry[];
export const emergenze = emergenzeRaw as EmergContacts;
export const cittaContent = cittaContentRaw as CityContent[];
export const alloggi = alloggiRaw as Alloggio[];
export const giorni = giorniRaw as Giorno[];
export const viaggioMeta = viaggioMetaRaw as ViaggioMeta;

export const cittaById = new Map(citta.map((c) => [c.id, c]));
export const poiById = new Map(pois.map((p) => [p.id, p]));
export const cittaContentById = new Map(cittaContent.map((c) => [c.id, c]));
export const legByCity = new Map(itinerario.legs.map((l) => [l.city, l]));

export function poisOfCity(city: CityId): Poi[] {
  return pois.filter((p) => p.city === city);
}

export const alloggioByCity = new Map(alloggi.map((a) => [a.city, a]));
