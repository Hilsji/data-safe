# Guide me on the right way.

Präventions-App gegen Doomscrolling für Schulen (Schüler 12–19 J., Lehrkräfte).
Kernbotschaft: **Je weniger Doomscrolling, desto mehr bleibt hängen – und desto mehr Zeit bleibt für Produktiveres.**

- Architektur & Datenmodell: [`docs/ARCHITEKTUR.md`](docs/ARCHITEKTUR.md) (v3 ist verbindlich)
- Datengrundlage: [`docs/quellen/Kurzvideo_Filterblasen_OnlyFans_Analyse.docx`](docs/quellen/Kurzvideo_Filterblasen_OnlyFans_Analyse.docx)

## Aufbau

| Pfad | Inhalt |
|---|---|
| `apps/web` | Next.js-PWA (UI + API), Rechenkerne in `src/engine`, Verschlüsselung in `src/crypto`, Quellen/Zahlen in `src/content` |
| `apps/worker` | Python-Pipeline für Bildschirmaufnahmen: Schwärzung, Segmentierung, Klassifikation, Fragen |

## Entwickeln

```bash
npm install               # im Repo-Wurzelverzeichnis
npm test                  # Unit-Tests (Vitest)
npm run dev               # http://localhost:3000

cd apps/worker
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]" numpy
python -m pytest -q
```

## Stand

| Baustein | Status |
|---|---|
| Rechenkerne: d′, Entropie, Engagement/Blasen-Profil, Politik-Feed-Profil (Bootstrap), Cohens Kappa, Quiz-Ziehung und -Auswertung, Baseline, Klassen-Aggregate, Zeitrechner | ✅ mit Unit-Tests |
| Unique ID + Ende-zu-Ende-Verschlüsselung (X25519/HKDF/AES-GCM), TypeScript ↔ Python kompatibel | ✅ mit Testvektor |
| Schwärzung (Screen-Filter, Statusleiste, Handles, PII im Text, eigener Account) | ✅ Logik + Tests; Layout-Zonen der Apps noch **nicht kalibriert** |
| Quellen- und Zahlen-Registry (Anhang A des Arbeitspapiers) | ✅ |
| Oberfläche, Ingest/Upload, Pipeline (Segmentierung, OCR, ASR, Klassifikation, Fragen), Lehrer-Dashboard, Docker Compose | ⏳ nächste Schritte |

## Vor dem Schuleinsatz fachlich zu prüfen

Siehe `status: "check"` in `apps/web/src/content/facts.ts` und `status: "todo"` in `equivalents.ts`:

- **D01** Altersangabe 278 min: „Volljährige“ (Text) vs. „18–19 J.“ (Anhang A)
- **D05** Cloes et al. 2026 ist ein nicht begutachteter Preprint
- **D06** DCU 2024: „misogyn“ (Zusammenfassung) vs. „toxisch“ (Tab. 5)
- **D10** Potsdam/Bertelsmann: neutrale Formulierung nach Beutelsbacher Konsens
- **Chiossi et al. 2023** (prospektives Gedächtnis): nicht im Arbeitspapier, Angabe prüfen
- **Nguyen et al. 2025**: nicht im Arbeitspapier; per PubMed geprüft (doi:10.1037/bul0000498) → ins Arbeitspapier aufnehmen
- **Modul-2-Äquivalente** (Führerschein-Theorie, Sprachkurs): Quellen fehlen, werden bis dahin nicht angezeigt
- **Datenschutz**: DSFA (Art. 35 DSGVO), Einwilligung zu Art.-9-Daten, Abstimmung mit der/dem Datenschutzbeauftragten, Nutzungsbedingungen der Kurzvideo-Apps
