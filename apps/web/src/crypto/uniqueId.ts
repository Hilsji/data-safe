/**
 * Unique ID = geheimer Schlüssel des Schülers (docs/ARCHITEKTUR.md, 5.2).
 *
 *   seed (16 Zufallsbytes, 128 Bit) ──HKDF──► X25519-Privatschlüssel ──► öffentlicher Schlüssel (geht an den Server)
 *                                   └─HKDF──► retrievalId (80 Bit, geht an den Server)
 *
 * Angezeigt wird der seed in Crockford-Base32 (26 Zeichen, gruppiert). Der Server bekommt ihn nie.
 * Wer die ID hat, kann das Ergebnis entschlüsseln – deshalb wie ein Passwort behandeln.
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

export const SEED_BYTES = 16;
const utf8 = (s: string) => new TextEncoder().encode(s);
const SALT = utf8("guide-me/unique-id/v1");

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string, byteLength: number): Uint8Array {
  // Crockford: Groß/Klein egal, O→0, I/L→1, Bindestriche und Leerzeichen ignorieren
  const clean = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  const out = new Uint8Array(byteLength);
  let bits = 0;
  let value = 0;
  let idx = 0;
  for (const ch of clean) {
    const v = CROCKFORD.indexOf(ch);
    if (v < 0) throw new Error(`Ungültiges Zeichen in der ID: ${ch}`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      if (idx >= byteLength) throw new Error("ID ist zu lang");
      out[idx++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }
  if (idx !== byteLength) throw new Error("ID ist unvollständig");
  return out;
}

export interface UniqueIdentity {
  /** zum Anzeigen/Notieren, z. B. "7Q2M-4K9D-…" */
  displayId: string;
  seed: Uint8Array;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  /** öffentlicher Abruf-Schlüssel für den Server */
  retrievalId: string;
}

export function formatDisplayId(seed: Uint8Array): string {
  return base32Encode(seed).match(/.{1,4}/g)!.join("-");
}

export function deriveIdentity(seed: Uint8Array): UniqueIdentity {
  if (seed.length !== SEED_BYTES) throw new RangeError(`seed muss ${SEED_BYTES} Bytes lang sein`);
  const privateKey = hkdf(sha256, seed, SALT, utf8("x25519"), 32);
  const publicKey = x25519.getPublicKey(privateKey);
  const retrievalId = base32Encode(hkdf(sha256, seed, SALT, utf8("retrieval"), 10));
  return { displayId: formatDisplayId(seed), seed, privateKey, publicKey, retrievalId };
}

export function createIdentity(random: (n: number) => Uint8Array = defaultRandom): UniqueIdentity {
  return deriveIdentity(random(SEED_BYTES));
}

export function identityFromDisplayId(displayId: string): UniqueIdentity {
  return deriveIdentity(base32Decode(displayId, SEED_BYTES));
}

function defaultRandom(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}
