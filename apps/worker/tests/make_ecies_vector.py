"""Erzeugt tests/fixtures/ecies-vector.json – wird vom TypeScript-Test entschlüsselt (Interoperabilität)."""
import json
from pathlib import Path

from guide_worker.crypto import derive_identity, encrypt

seed = bytes(range(16))
ident = derive_identity(seed)
plaintext = '{"hinweis":"Testvektor – Ergebnis nur für die Unique ID lesbar","ümlaut":"äöü"}'
blob = encrypt(plaintext.encode("utf-8"), ident.public_key, ephemeral_private=bytes([42] * 32), iv=bytes(12))
out = Path(__file__).parent / "fixtures" / "ecies-vector.json"
out.write_text(json.dumps({"displayId": ident.display_id, "retrievalId": ident.retrieval_id,
                           "plaintext": plaintext, "blob": blob}, ensure_ascii=False, indent=2) + "\n",
               encoding="utf-8")
print(out)
