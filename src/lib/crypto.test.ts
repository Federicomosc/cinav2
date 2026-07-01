import { describe, it, expect } from 'vitest';
import { randomBytes, deriveKey, encryptBytes, decryptBytes, makeVerifier, checkVerifier } from './crypto';

// Web Crypto è disponibile in Node/Vitest tramite globalThis.crypto — nessun mock.

describe('deriveKey + encrypt/decrypt', () => {
  it('round-trip: decifra esattamente ciò che è stato cifrato', async () => {
    const salt = randomBytes(16);
    const key = await deriveKey('password-corretta', salt);
    const plaintext = new TextEncoder().encode('documento segreto');
    const { iv, cipher } = await encryptBytes(key, plaintext);
    const out = await decryptBytes(key, iv, cipher);
    expect(new TextDecoder().decode(out)).toBe('documento segreto');
  });

  it('rifiuta la decifratura con la password sbagliata', async () => {
    const salt = randomBytes(16);
    const goodKey = await deriveKey('corretta', salt);
    const badKey = await deriveKey('sbagliata', salt);
    const { iv, cipher } = await encryptBytes(goodKey, new TextEncoder().encode('segreto'));
    await expect(decryptBytes(badKey, iv, cipher)).rejects.toThrow();
  });

  it('due salt diversi producono chiavi diverse dalla stessa password', async () => {
    const keyA = await deriveKey('stessa-password', randomBytes(16));
    const keyB = await deriveKey('stessa-password', randomBytes(16));
    const plaintext = new TextEncoder().encode('x');
    const { iv, cipher } = await encryptBytes(keyA, plaintext);
    await expect(decryptBytes(keyB, iv, cipher)).rejects.toThrow();
  });
});

describe('makeVerifier / checkVerifier', () => {
  it('accetta la password giusta', async () => {
    const key = await deriveKey('cassaforte', randomBytes(16));
    const { iv, cipher } = await makeVerifier(key);
    expect(await checkVerifier(key, iv, cipher)).toBe(true);
  });

  it('rifiuta una chiave derivata da password sbagliata senza lanciare', async () => {
    const salt = randomBytes(16);
    const goodKey = await deriveKey('cassaforte', salt);
    const badKey = await deriveKey('altra-password', salt);
    const { iv, cipher } = await makeVerifier(goodKey);
    await expect(checkVerifier(badKey, iv, cipher)).resolves.toBe(false);
  });
});
