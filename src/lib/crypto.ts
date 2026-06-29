// Cifratura lato client (AES-GCM 256 + PBKDF2). Web Crypto, zero dipendenze.
// Onestà: la sicurezza coincide con la forza della password — nessun backend.
// La password NON viene mai salvata; in IndexedDB finiscono solo salt, iv e cipher.

const enc = new TextEncoder();
const dec = new TextDecoder();
const VERIFIER = 'cina-tour-2026';
const ITERATIONS = 250_000;

// Copia i byte in un Uint8Array garantito su ArrayBuffer (non SharedArrayBuffer),
// così soddisfa il tipo BufferSource richiesto da Web Crypto (TS 6 / lib recenti).
function buf(x: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(x);
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', buf(enc.encode(password)), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(
  key: CryptoKey,
  data: BufferSource,
): Promise<{ iv: Uint8Array<ArrayBuffer>; cipher: ArrayBuffer }> {
  const iv = randomBytes(12);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv, cipher };
}

export async function decryptBytes(
  key: CryptoKey,
  iv: Uint8Array,
  cipher: BufferSource,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(iv) }, key, cipher);
}

/** Crea il token di verifica della password (cifrato con la chiave derivata). */
export function makeVerifier(key: CryptoKey) {
  return encryptBytes(key, buf(enc.encode(VERIFIER)));
}

/**
 * Verifica una password provando a decifrare il token. Un fallimento di
 * decrypt (OperationError) significa "password sbagliata": è il risultato
 * atteso, non un errore da nascondere.
 */
export async function checkVerifier(
  key: CryptoKey,
  iv: Uint8Array,
  cipher: BufferSource,
): Promise<boolean> {
  try {
    const out = await decryptBytes(key, iv, cipher);
    return dec.decode(out) === VERIFIER;
  } catch {
    return false;
  }
}
