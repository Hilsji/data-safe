/**
 * ECIES über X25519 + HKDF-SHA256 + AES-256-GCM.
 * Der Worker (Python, apps/worker/guide_worker/crypto.py) verschlüsselt mit genau diesem Verfahren;
 * tests/fixtures/ecies-vector.json sichert die Kompatibilität beider Seiten ab.
 *
 *   shared = X25519(ephemeralPriv, recipientPub)
 *   key    = HKDF(shared, salt = ephemeralPub ‖ recipientPub, info = "guide-me/result/v1", 32 Bytes)
 *   blob   = AES-256-GCM(key, iv(12 Bytes), plaintext)   // ciphertext enthält den 16-Byte-Tag
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

export const ECIES_INFO = "guide-me/result/v1";

export interface EncryptedBlob {
  schemaVersion: 1;
  ephemeralPublicKey: string;
  iv: string;
  ciphertext: string;
}

export const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function aesKey(raw: Uint8Array, usage: KeyUsage): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey("raw", raw as BufferSource, "AES-GCM", false, [usage]);
}

function deriveKey(shared: Uint8Array, ephemeralPub: Uint8Array, recipientPub: Uint8Array): Uint8Array {
  return hkdf(sha256, shared, concat(ephemeralPub, recipientPub), new TextEncoder().encode(ECIES_INFO), 32);
}

export async function eciesEncrypt(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
  opts: { ephemeralPrivateKey?: Uint8Array; iv?: Uint8Array } = {},
): Promise<EncryptedBlob> {
  const ephPriv = opts.ephemeralPrivateKey ?? x25519.utils.randomSecretKey();
  const ephPub = x25519.getPublicKey(ephPriv);
  const shared = x25519.getSharedSecret(ephPriv, recipientPublicKey);
  const key = await aesKey(deriveKey(shared, ephPub, recipientPublicKey), "encrypt");
  const iv = opts.iv ?? globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext as BufferSource));
  return { schemaVersion: 1, ephemeralPublicKey: toB64(ephPub), iv: toB64(iv), ciphertext: toB64(ct) };
}

export async function eciesDecrypt(blob: EncryptedBlob, recipientPrivateKey: Uint8Array): Promise<Uint8Array> {
  if (blob.schemaVersion !== 1) throw new Error(`Unbekannte Schema-Version ${blob.schemaVersion}`);
  const ephPub = fromB64(blob.ephemeralPublicKey);
  const recipientPub = x25519.getPublicKey(recipientPrivateKey);
  const shared = x25519.getSharedSecret(recipientPrivateKey, ephPub);
  const key = await aesKey(deriveKey(shared, ephPub, recipientPub), "decrypt");
  const pt = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(blob.iv) as BufferSource },
    key,
    fromB64(blob.ciphertext) as BufferSource,
  );
  return new Uint8Array(pt);
}

export async function encryptJson(value: unknown, recipientPublicKey: Uint8Array): Promise<EncryptedBlob> {
  return eciesEncrypt(new TextEncoder().encode(JSON.stringify(value)), recipientPublicKey);
}

export async function decryptJson<T>(blob: EncryptedBlob, recipientPrivateKey: Uint8Array): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await eciesDecrypt(blob, recipientPrivateKey))) as T;
}
