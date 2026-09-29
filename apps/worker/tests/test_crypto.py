import json
from pathlib import Path

import pytest
from cryptography.exceptions import InvalidTag

from guide_worker.crypto import decrypt, derive_identity, encrypt


def test_roundtrip():
    ident = derive_identity(bytes(range(16)))
    blob = encrypt(b'{"a":1}', ident.public_key)
    assert decrypt(blob, ident.private_key) == b'{"a":1}'


def test_wrong_key_fails():
    a = derive_identity(bytes(16))
    b = derive_identity(bytes([1] * 16))
    blob = encrypt(b"geheim", a.public_key)
    with pytest.raises(InvalidTag):
        decrypt(blob, b.private_key)


def test_vector_is_stable():
    """Der Testvektor wird auch von apps/web/src/crypto/crypto.test.ts entschlüsselt."""
    vector = json.loads((Path(__file__).parent / "fixtures" / "ecies-vector.json").read_text(encoding="utf-8"))
    ident = derive_identity(bytes(range(16)))
    assert ident.display_id == vector["displayId"]
    assert ident.retrieval_id == vector["retrievalId"]
    assert decrypt(vector["blob"], ident.private_key).decode("utf-8") == vector["plaintext"]
    again = encrypt(vector["plaintext"].encode("utf-8"), ident.public_key, ephemeral_private=bytes([42] * 32), iv=bytes(12))
    assert again == vector["blob"]
