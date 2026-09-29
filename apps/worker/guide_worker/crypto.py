"""ECIES über X25519 + HKDF-SHA256 + AES-256-GCM – identisch zu apps/web/src/crypto/ecies.ts.

Der Worker kennt nur den öffentlichen Schlüssel des Schülers. Er verschlüsselt das Ergebnis und
verwirft danach den Klartext. Entschlüsseln kann nur das Gerät mit der Unique ID.
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

ECIES_INFO = b"guide-me/result/v1"
_ID_SALT = b"guide-me/unique-id/v1"
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _raw_public(key: X25519PublicKey) -> bytes:
    return key.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def _hkdf(ikm: bytes, salt: bytes, info: bytes, length: int) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=length, salt=salt, info=info).derive(ikm)


def encrypt(plaintext: bytes, recipient_public_key: bytes, *, ephemeral_private: bytes | None = None,
            iv: bytes | None = None) -> dict:
    """Verschlüsselt `plaintext` für den öffentlichen Schlüssel (32 Byte, raw) des Schülers."""
    eph = (X25519PrivateKey.from_private_bytes(ephemeral_private) if ephemeral_private
           else X25519PrivateKey.generate())
    eph_pub = _raw_public(eph.public_key())
    shared = eph.exchange(X25519PublicKey.from_public_bytes(recipient_public_key))
    key = _hkdf(shared, eph_pub + recipient_public_key, ECIES_INFO, 32)
    nonce = iv if iv is not None else os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, None)
    return {"schemaVersion": 1, "ephemeralPublicKey": _b64(eph_pub), "iv": _b64(nonce),
            "ciphertext": _b64(ciphertext)}


# --- Nur für Tests: Ableitung der Schüler-Identität (im Betrieb passiert das ausschließlich im Browser) ---

def base32_encode(data: bytes) -> str:
    bits = value = 0
    out = []
    for b in data:
        value = (value << 8) | b
        bits += 8
        while bits >= 5:
            out.append(_CROCKFORD[(value >> (bits - 5)) & 31])
            bits -= 5
    if bits:
        out.append(_CROCKFORD[(value << (5 - bits)) & 31])
    return "".join(out)


@dataclass(frozen=True)
class TestIdentity:
    display_id: str
    public_key: bytes
    private_key: bytes
    retrieval_id: str


def derive_identity(seed: bytes) -> TestIdentity:
    private = _hkdf(seed, _ID_SALT, b"x25519", 32)
    public = _raw_public(X25519PrivateKey.from_private_bytes(private).public_key())
    retrieval = base32_encode(_hkdf(seed, _ID_SALT, b"retrieval", 10))
    enc = base32_encode(seed)
    display = "-".join(enc[i:i + 4] for i in range(0, len(enc), 4))
    return TestIdentity(display, public, private, retrieval)


def decrypt(blob: dict, recipient_private_key: bytes) -> bytes:
    """Nur für Tests – im Betrieb entschlüsselt ausschließlich der Browser."""
    priv = X25519PrivateKey.from_private_bytes(recipient_private_key)
    eph_pub = base64.b64decode(blob["ephemeralPublicKey"])
    recipient_pub = _raw_public(priv.public_key())
    shared = priv.exchange(X25519PublicKey.from_public_bytes(eph_pub))
    key = _hkdf(shared, eph_pub + recipient_pub, ECIES_INFO, 32)
    return AESGCM(key).decrypt(base64.b64decode(blob["iv"]), base64.b64decode(blob["ciphertext"]), None)
