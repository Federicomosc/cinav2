// Tipi del CONTENUTO STATICO (read-only), bundlato come JSON e versionato col deploy.
// Lo stato mutabile (foto, spese, ...) sta invece in IndexedDB — vedi src/db/dexie.ts.
// Regola d'oro: tutte le coordinate sono WGS-84 (mai GCJ-02).

export type CityId = 'chengdu' | 'chongqing' | 'zhangjiajie' | 'pechino' | 'shanghai';

export interface Itinerario {
  trip: {
    name: string;
    start: string; // ISO yyyy-mm-dd
    end: string;
    members: string[];
    cnyPerEur: number; // tasso pre-caricato per il convertitore offline
  };
  legs: Leg[];
}

export interface Leg {
  city: CityId;
  from: string; // ISO yyyy-mm-dd (primo giorno nella città)
  to: string; // ISO yyyy-mm-dd (ultimo giorno nella città)
}

export interface Alloggio {
  id: string;
  city: CityId;
  name: string;
  address?: string; // EN/pinyin
  addressLocal?: string; // 汉字, da mostrare al tassista
  phone?: string;
  checkIn: string; // ISO yyyy-mm-dd
  checkOut: string;
  confirmed: boolean; // false = da inserire/confermare
  notes?: string;
}

export type TransportType = 'flight' | 'train' | 'bus';

export interface Transport {
  id: string;
  type: TransportType;
  code: string; // es. "CA446" o "DA PRENOTARE"
  from: string; // luogo/codice partenza
  to: string; // luogo/codice arrivo
  departAt: string; // ISO datetime (locale)
  arriveAt?: string;
  confirmed: boolean; // false = placeholder da inserire dai biglietti reali
  notes?: string;
}

export type PoiCategory = 'storico' | 'moderno' | 'natura' | 'intrattenimento' | 'cibo';

export interface Poi {
  id: string;
  city: CityId;
  name: string;
  nameLocal?: string; // 汉字
  category: PoiCategory;
  lat: number; // WGS-84
  lng: number;
  price?: string;
  stars?: number; // 1..5
  booking?: string; // testo: obbligo/modalità di prenotazione
  blurb?: string;
}

export interface Citta {
  id: CityId;
  name: string;
  nameLocal: string; // 汉字
  center: { lat: number; lng: number }; // WGS-84, per centrare la mappa
  intro: string;
  highlights: string[];
  itineraries: { title: string; stops: string[] }[]; // itinerari alternativi
}

export interface ContentBlock {
  tag: 'h2' | 'h3' | 'h4' | 'p' | 'li';
  text: string;
}

export interface CityContent {
  id: CityId;
  blocks: ContentBlock[];
}

export interface Frase {
  cat: 'base' | 'taxi' | 'ristorante' | 'alloggio' | 'acquisti' | 'emergenze' | 'indicazioni';
  it: string;
  pinyin: string;
  hanzi: string;
  showBig?: boolean; // candidata per la "modalità tassista"
  audio?: string; // nome file in /phrases/, opzionale
}

export interface GiornoSchedule {
  mattino?: string;
  pranzo?: string;
  pomeriggio?: string;
  cena?: string;
  sera?: string;
  notte?: string;
}

export interface Giorno {
  n: number;
  date: string; // ISO yyyy-mm-dd
  city: string; // nome città (Chengdu, Chongqing, …) o "In viaggio"
  title: string;
  acts: { label: string; poi?: string }[];
  schedule?: GiornoSchedule;
  euroTotal?: number;
  euroPerPerson?: number;
}

export interface ViaggioMeta {
  nights: Record<string, number>;
  budgetTotalEuro: number;
  budgetPerPersonEuro: number;
}

export interface EmergContacts {
  cinesi: { label: string; number: string }[];
  consolari: ConsularContact[];
  disclaimer: string;
}

export interface ConsularContact {
  name: string;
  city: string;
  address?: string;
  addressLocal?: string; // 汉字, da mostrare al tassista
  phone?: string;
  emergency24h?: string;
  verified: boolean; // false = da confermare sul sito Farnesina prima di partire
}
