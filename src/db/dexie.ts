import Dexie, { type EntityTable } from 'dexie';
import type { CityId } from '../data/types';

// STATO MUTABILE (IndexedDB). Il contenuto statico sta invece nei JSON (src/data).
// Le coordinate sono SEMPRE WGS-84.

export interface Photo {
  id: string;
  blob: Blob;
  thumb?: Blob;
  takenAt: number; // epoch ms (da EXIF DateTimeOriginal)
  lat?: number;
  lng?: number;
  city?: CityId; // assegnata dallo smistamento spazio-temporale
  day?: string; // ISO yyyy-mm-dd
  caption?: string;
}

export interface Expense {
  id: string;
  amount: number; // in CNY
  paidBy: string;
  splitWith: string[];
  description: string;
  date: string; // ISO yyyy-mm-dd
  updatedAt: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  order: number;
}

export interface Favorite {
  id: string; // chiave dell'elemento (es. id frase o id poi)
  kind: 'phrase' | 'poi';
  addedAt: number;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  t: number;
}
export interface Track {
  id: string; // `${date}` — un track per giorno
  date: string;
  distanceM: number;
  points: TrackPoint[];
}

/** Documento cifrato lato client (AES-GCM). Mai salvare la password. */
export interface SecureDoc {
  id: string;
  title: string;
  kind: 'passport' | 'visa' | 'insurance' | 'ticket' | 'other';
  iv: Uint8Array;
  salt: Uint8Array;
  cipher: ArrayBuffer; // file cifrato
  mime: string;
  addedAt: number;
}

/** Scheda medica personale (da mostrare al personale sanitario, anche in cinese). */
export interface MedicalCard {
  member: string; // chiave
  bloodType?: string;
  allergies?: string;
  meds?: string;
  conditions?: string;
}

export interface ActCheck {
  id: string; // `d{giorno}:{label}` — attività spuntata nell'agenda
  checkedAt: number;
}

export interface AirplaneTestItem {
  id: string;
  label: string;
  hint: string;
  route?: string;
  done: boolean;
  note: string;
  order: number;
}

/** Itinerario POI creato dall'utente (per città). */
export interface CustomItinerary {
  id: string;
  city: CityId;
  title: string;
  stops: string[]; // id POI in ordine
  order: number;
  updatedAt: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

const db = new Dexie('cina-tour-2026') as Dexie & {
  photos: EntityTable<Photo, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  checklist: EntityTable<ChecklistItem, 'id'>;
  favorites: EntityTable<Favorite, 'id'>;
  tracks: EntityTable<Track, 'id'>;
  documents: EntityTable<SecureDoc, 'id'>;
  medical: EntityTable<MedicalCard, 'member'>;
  actChecks: EntityTable<ActCheck, 'id'>;
  airplaneTests: EntityTable<AirplaneTestItem, 'id'>;
  customItineraries: EntityTable<CustomItinerary, 'id'>;
  meta: EntityTable<Meta, 'key'>;
};

db.version(1).stores({
  photos: 'id, takenAt, city, day',
  expenses: 'id, date',
  checklist: 'id, order',
  favorites: 'id, kind',
  tracks: 'id, date',
  documents: 'id, kind',
  meta: 'key',
});

db.version(2).stores({
  medical: 'member',
});

db.version(3).stores({
  actChecks: 'id',
});

db.version(4).stores({
  airplaneTests: 'id, order',
});

db.version(5).stores({
  customItineraries: 'id, city, order, updatedAt',
});

export { db };
export const uid = () => crypto.randomUUID();
export const now = () => Date.now();
