import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { base32Decode, base32Encode, createIdentity, deriveIdentity, identityFromDisplayId } from "./uniqueId";
import { decryptJson, eciesDecrypt, encryptJson, fromB64, type EncryptedBlob } from "./ecies";

describe("Unique ID", () => {
  it("Base32 ist verlustfrei", () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, i) => i * 17);
    expect(base32Decode(base32Encode(bytes), 16)).toEqual(bytes);
  });

  it("Anzeige-ID lässt sich mit typischen Tippfehlern wieder einlesen", () => {
    const id = createIdentity();
    const typed = id.displayId.toLowerCase().replace(/0/g, "o").replace(/1/g, "l").replace(/-/g, " ");
    const back = identityFromDisplayId(typed);
    expect(back.retrievalId).toBe(id.retrievalId);
    expect(back.publicKey).toEqual(id.publicKey);
  });

  it("ist deterministisch und enthält den seed nicht in retrievalId oder publicKey", () => {
    const seed = new Uint8Array(16).fill(7);
    const a = deriveIdentity(seed);
    expect(deriveIdentity(seed).retrievalId).toBe(a.retrievalId);
    expect(a.retrievalId).toHaveLength(16);
    expect(a.displayId).toMatch(/^([0-9A-Z]{4}-){6}[0-9A-Z]{2}$/);
    expect(a.retrievalId).not.toContain(base32Encode(seed).slice(0, 8));
  });

  it("lehnt unvollständige IDs ab", () => {
    expect(() => identityFromDisplayId("ABCD-EFGH")).toThrow();
    expect(() => identityFromDisplayId("ABCD-EFGH-!!!!")).toThrow();
  });
});

describe("ECIES", () => {
  it("Round-Trip mit dem richtigen Schlüssel", async () => {
    const id = createIdentity();
    const payload = { segments: [{ category: "politics", spectrum: "left" }] };
    const blob = await encryptJson(payload, id.publicKey);
    expect(blob.ciphertext).not.toContain("politics");
    expect(await decryptJson(blob, id.privateKey)).toEqual(payload);
  });

  it("scheitert mit falschem Schlüssel", async () => {
    const blob = await encryptJson({ a: 1 }, createIdentity().publicKey);
    await expect(decryptJson(blob, createIdentity().privateKey)).rejects.toThrow();
  });

  it("erkennt Manipulation (GCM-Tag)", async () => {
    const id = createIdentity();
    const blob = await encryptJson({ a: 1 }, id.publicKey);
    const ct = fromB64(blob.ciphertext);
    ct[0]! ^= 1;
    const tampered: EncryptedBlob = { ...blob, ciphertext: btoa(String.fromCharCode(...ct)) };
    await expect(decryptJson(tampered, id.privateKey)).rejects.toThrow();
  });

  it("entschlüsselt den Testvektor des Python-Workers (Interoperabilität)", async () => {
    const path = fileURLToPath(new URL("../../../worker/tests/fixtures/ecies-vector.json", import.meta.url));
    const vector = JSON.parse(readFileSync(path, "utf8")) as { displayId: string; retrievalId: string; plaintext: string; blob: EncryptedBlob };
    const id = identityFromDisplayId(vector.displayId);
    expect(id.retrievalId).toBe(vector.retrievalId);
    const pt = new TextDecoder().decode(await eciesDecrypt(vector.blob, id.privateKey));
    expect(pt).toBe(vector.plaintext);
  });
});
