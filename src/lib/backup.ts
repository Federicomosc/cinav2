// Backup/ripristino cifrato dello stato locale (IndexedDB/Dexie).
//
// Perché: spese, schede mediche, documenti cifrati, checklist e preferiti vivono
// SOLO sul telefono. Se lo perdi o iOS libera lo storage durante il viaggio,
// perdi tutto. Questo modulo esporta tutto in UN file cifrato (AES-GCM + PBKDF2,
// come la cassaforte) da salvare o passare a un secondo telefono del gruppo.
//
// Le FOTO (blob pesanti, Fase 2) sono escluse di proposito.

import { db } from '../db/dexie';
import { deriveKey, encryptBytes, decryptBytes, randomBytes } from './crypto';

const FORMAT = 'cina-tour-2026-backup';
const VERSION = 1;

// Tabelle salvate (photos escluse: blob grandi).
const TABLES = [
  'expenses',
  'checklist',
  'favorites',
  'tracks',
  'documents',
  'medical',
  'actChecks',
  'airplaneTests',
  'customItineraries',
  'meta',
] as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toB64(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const u = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

// I documenti cifrati hanno campi binari (iv/salt = Uint8Array, cipher =
// ArrayBuffer): vanno in base64 per stare nel JSON e ripristinati al tipo giusto.
type RawDoc = { iv: Uint8Array; salt: Uint8Array; cipher: ArrayBuffer } & Record<string, unknown>;
function serializeDoc(d: RawDoc) {
  return { ...d, iv: toB64(d.iv), salt: toB64(d.salt), cipher: toB64(d.cipher) };
}
function deserializeDoc(d: Record<string, unknown>): RawDoc {
  return {
    ...d,
    iv: fromB64(d.iv as string),
    salt: fromB64(d.salt as string),
    cipher: fromB64(d.cipher as string).buffer,
  } as RawDoc;
}

export interface BackupCounts {
  tables: Record<string, number>;
  total: number;
}

export const LAST_BACKUP_KEY = 'lastBackupAt';

/** Epoch ms dell'ultimo export riuscito, o null se non è mai stato fatto. */
export async function getLastBackupAt(): Promise<number | null> {
  const rec = await db.meta.get(LAST_BACKUP_KEY);
  return typeof rec?.value === 'number' ? rec.value : null;
}

/** Esporta tutto lo stato in un Blob cifrato scaricabile. */
export async function exportBackup(password: string): Promise<{ blob: Blob; counts: BackupCounts }> {
  const data: Record<string, unknown[]> = {};
  const tables: Record<string, number> = {};
  let total = 0;
  for (const t of TABLES) {
    const rows = await db.table(t).toArray();
    data[t] = t === 'documents' ? rows.map((r) => serializeDoc(r as RawDoc)) : rows;
    tables[t] = rows.length;
    total += rows.length;
  }

  const payload = JSON.stringify({
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data,
  });

  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  const { iv, cipher } = await encryptBytes(key, encoder.encode(payload));

  const envelope = {
    format: FORMAT,
    version: VERSION,
    salt: toB64(salt),
    iv: toB64(iv),
    cipher: toB64(cipher),
  };
  const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
  await db.meta.put({ key: LAST_BACKUP_KEY, value: Date.now() });
  return { blob, counts: { tables, total } };
}

/** Ripristina uno stato da un file di backup cifrato (upsert: fonde coi dati attuali). */
export async function importBackup(file: File | Blob, password: string): Promise<BackupCounts> {
  let envelope: { format?: string; salt?: string; iv?: string; cipher?: string };
  try {
    envelope = JSON.parse(await file.text());
  } catch {
    throw new Error('File di backup non leggibile.');
  }
  if (envelope.format !== FORMAT || !envelope.salt || !envelope.iv || !envelope.cipher) {
    throw new Error('Questo non sembra un backup di Cina Tour.');
  }

  const key = await deriveKey(password, fromB64(envelope.salt));
  let jsonBytes: ArrayBuffer;
  try {
    jsonBytes = await decryptBytes(key, fromB64(envelope.iv), fromB64(envelope.cipher));
  } catch {
    throw new Error('Password errata o file danneggiato.');
  }

  let payload: { data?: Record<string, unknown[]> };
  try {
    payload = JSON.parse(decoder.decode(jsonBytes));
  } catch {
    throw new Error('Contenuto del backup non valido.');
  }
  const src = payload.data ?? {};

  const tables: Record<string, number> = {};
  let total = 0;
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = Array.isArray(src[t]) ? src[t] : [];
      const toWrite = t === 'documents' ? rows.map((r) => deserializeDoc(r as Record<string, unknown>)) : rows;
      if (toWrite.length) await db.table(t).bulkPut(toWrite);
      tables[t] = toWrite.length;
      total += toWrite.length;
    }
  });
  return { tables, total };
}
