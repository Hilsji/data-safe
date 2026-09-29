# Guide me on the right way.

Präventions-App gegen Doomscrolling für Schulen (Schülerinnen und Schüler 12–19 J., Lehrkräfte).
Kernbotschaft: **Je weniger Doomscrolling, desto mehr bleibt hängen – und desto mehr Zeit bleibt für Produktiveres.**

| Dokument | Inhalt |
|---|---|
| [`docs/ARCHITEKTUR.md`](docs/ARCHITEKTUR.md) | Architektur und Datenmodell. **Abschnitt „v3“ ist verbindlich** |
| [`docs/DATENSCHUTZ-ENTWURF.md`](docs/DATENSCHUTZ-ENTWURF.md) | Datenschutzerklärung (Entwurf) |
| [`docs/EINWILLIGUNG-VORLAGE.md`](docs/EINWILLIGUNG-VORLAGE.md) | Elternbrief und Einwilligung (Vorlage) |
| [`docs/quellen/…Analyse.docx`](docs/quellen/Kurzvideo_Filterblasen_OnlyFans_Analyse.docx) | Arbeitspapier (Datengrundlage) |

---

## Was die App kann

| Bereich | Route | Kurz |
|---|---|---|
| Modul 1 – Daten-Story | `/wissen` | acht wischbare Karten, jede Zahl mit Quelle (ⓘ), jede Aussage mit Handlung |
| Modul 2 – Vergleichs-Falle | `/vergleich` | Aufwärtsvergleich, Survivorship Bias, Zeitrechner, Zukunfts-Ich |
| Modul 3 – Scroll-Arena | `/arena` | ab 14 J.: Einwilligung → Unique ID → Gedächtnis-Check → Merkaufgabe → Scrollen in der eigenen App mit Bildschirmaufnahme → Upload |
| Feed-Bericht | `/bericht` | Abruf per ID in der Folgestunde → Quiz (Inhalt, Wiedererkennen, Reihenfolge, Merkaufgabe) → „So viel ist hängen geblieben“ → Blasen-Profil, Verengungskurve, Politik-Feed-Profil (nur lokal), „Blase platzen lassen“ |
| Modul 4 – Lehrkräfte | `/lehrkraft` | Magic Link, Klassen-Session mit Gruppen/Dauern, Beamer-Countdown, Berichte freigeben, anonyme Ergebnisse ab 5 je Gruppe, PDF-Export und Arbeitsblatt |
| Projektteam | `/admin` | Kalibrieraufnahmen taggen (zwei Rater, unabhängig), Kappa-Bericht, Freigabe der Politik-Richtung nach E6 |

### Datenschutz in einem Satz je Baustein
- **Aufnahme:** wird nur auf der Schul-Box (bzw. Strato) ausgewertet und danach sofort gelöscht, spätestens nach 24 h.
- **Schwärzung zuerst:** DMs, Profil, Einstellungen, Tastatur und andere Apps werden verworfen. Nutzernamen, PII und der eigene Account werden geschwärzt, bevor irgendetwas weiterverarbeitet wird.
- **Bericht:** Ende-zu-Ende-verschlüsselt mit der Unique ID. Der Server kann ihn nicht lesen.
- **Politik:** nur mit gesonderter Einwilligung (Art. 9) **und** für eine im Admin-Tool freigegebene Modellversion. Das Profil wird nur im Browser berechnet, nie übertragen und nie gespeichert.
- **Lehrkraft:** nur Zähler, keine Einzeldatensätze. Anzeige erst nach Rundenende und ab 5 Beiträgen je Gruppe. Danach werden keine Beiträge mehr angenommen.
- **Keine Drittanbieter-KI:** OCR (PaddleOCR), Spracherkennung (faster-whisper) und Sprachmodell (Ollama) laufen lokal.

---

## Aufbau

```
apps/web      Next.js 16 (PWA-fähig, TypeScript strict)
  src/engine    Rechenkerne: d′, Entropie, Blasen-Profil, Politik-Profil, Kappa, Quiz, Aggregate, Validierung
  src/crypto    Unique ID (X25519/HKDF) und ECIES (AES-256-GCM)
  src/content   Quellen- und Zahlen-Registry (jede Zahl → Quelle), Kategorien
  src/server    Logik ohne Next.js: Arena, Klassen, Magic Link, Kalibrierung, Mongo-/Memory-Store
  src/i18n      alle Texte (Deutsch), Wording-Test gegen Diagnosen/Beschämung/Zahlen ohne Quelle
apps/worker   Python-Pipeline: Frames → Screen-Filter → Schwärzung → Segmentierung → Signale → OCR/ASR/LLM → Quiz → Verschlüsselung
deploy/       Caddyfile (Strato, HTTPS)
docker-compose.yml, compose.gpu.yml, compose.strato.yml
```

---

## Starten

### Schnell, ohne Docker (nur Oberfläche und API, keine Auswertung)
```bash
npm install
npm run dev                  # http://localhost:3000 – ohne MONGODB_URI mit In-Memory-Speicher
```
Magic Links erscheinen in der Entwicklung in der Konsole. Wer sich anmelden darf, steht in `TEACHER_EMAIL_DOMAINS`, `TEACHER_EMAILS`, `RATER_EMAILS` und `ADMIN_EMAILS` (siehe `.env.example`).

### Schul-Box (alles lokal)
```bash
cp .env.example .env         # AUTH_SECRET, APP_URL, Freigaben eintragen
docker compose up -d --build
docker compose run --rm ollama-init   # lädt die Sprachmodelle einmalig
# mit NVIDIA-GPU:  docker compose -f docker-compose.yml -f compose.gpu.yml up -d
```
- App: `http://<rechner-im-schulnetz>:3000` · Test-Postfach für Magic Links: `http://localhost:8025`
- Empfehlung: Docker-Datenverzeichnis auf einer **verschlüsselten Partition** (Upload-Dateien liegen bis zur Auswertung auf der Platte).
- Schulnetz mit TLS-Inspektion (Content-Filter): Zertifikat beim Bauen mitgeben, z. B. `EXTRA_CA_CERT=/pfad/schul-ca.crt docker compose build`.

### Strato (V-Server / Dedicated)
```bash
# in .env: DOMAIN=guide.meine-schule.de, APP_URL=https://guide.meine-schule.de, SMTP_URL=smtps://…@smtp.strato.de:465
docker compose -f docker-compose.yml -f compose.strato.yml up -d --build
```
Caddy holt das TLS-Zertifikat automatisch und speichert keine Zugriffsprotokolle mit IP-Adressen.

---

## Tests

```bash
npm test                                  # Unit-Tests (Vitest)
npm run typecheck && npm run lint
cd apps/web && npx playwright test        # E2E inkl. axe (WCAG 2.2 AA); vorinstalliertes Chromium: PW_CHROMIUM_PATH=…
cd apps/worker && python -m pytest -q     # Worker; ffmpeg nötig; mit MONGODB_TEST_URI auch gegen MongoDB
```

Stand dieses Commits: **Web 534 Unit-Tests, 14 E2E-Tests (alle mit axe), Worker 51 Tests (inkl. MongoDB-Integration)** – alle grün. Die CI (`.github/workflows/ci.yml`) führt Web- und Worker-Tests aus, die E2E-Tests bisher nicht (TODO).

Geprüft wird unter anderem:
- Nichts Privates (DM-Text, eigener Account, Creator-Namen, Uhrzeit) erreicht Modell oder Ergebnis.
- Die Upload-Datei ist nach jedem Auftragsende gelöscht, und die DB enthält nur das Chiffrat.
- Web und Worker verschlüsseln kompatibel (gemeinsamer Testvektor).
- Das Quiz hat bei 15, 30 und 45 min immer dieselbe Anzahl Fragen, gleichmäßig aus Anfang, Mitte und Ende.
- Das Politik-Profil behandelt links und rechts symmetrisch, und ein einseitiger Feed wird erkannt.
- Klassen: keine Anzeige unter 5 und nicht vor dem Schließen, Tokens sind einmalig, Politik wird abgewiesen, gleichmäßige Gruppen auch bei gleichzeitigem Beitritt.
- Kein Text enthält „Diagnose“, „süchtig“, „Du bist links“ … und keine Zahl ohne Quelle.

---

## Offene TODOs

**Vor einem echten Einsatz zwingend**
1. **Worker-Image auf der Zielmaschine bauen und testen.** In der Entwicklungsumgebung war `deb.debian.org` gesperrt, deshalb ist das Image dort nie vollständig gebaut worden. Die Pipeline ist mit synthetischen Aufnahmen und echtem ffmpeg getestet, **nicht** mit PaddleOCR, faster-whisper und Ollama.
2. **Spikes S1–S3** (Architektur, Abschnitt 11):
   - Aufnahme und Upload auf echten Schul-iPads und Android-Geräten (Dateigrößen, Ton, Upload über WLAN)
   - Laufzeit der Pipeline mit und ohne GPU
   - wie sich TikTok, Reels, Shorts und Spotlight aktuell verhalten
3. **Layout-Zonen kalibrieren** (`apps/worker/guide_worker/redaction.py`, `segmentation.py`): Creator-Zone, Statusleiste und Herz-Symbol je App sind **geschätzt**. Bis dahin werden Likes als „unsicher“ gewertet (`calibrated=False`).
4. **Kalibrierung und Freigabe** im Admin-Tool mit ≥ 10 Konsens-Videos je politischer Richtung, zwei unabhängigen Ratern und politisch ausgewogenem Material. Ohne Freigabe zeigt die App nur den Politik-Anteil.
5. **Ablenker-Bank** für den Wiedererkennungs-Test anlegen (`apps/web/public/distractors/`, mind. 60 eigene Standbilder). Solange sie leer ist, entfällt dieser Quiz-Teil, und die Runde gilt als „eingeschränkt vergleichbar“.
6. **Rechtliches:** DSFA, Rechtsgrundlage nach Landesschulgesetz, Datenschutzerklärung finalisieren, AVV (Strato), Nutzungsbedingungen der Apps, Jugendschutzkonzept für die Scroll-Runde.

**Weitere**
- Native Begleit-App für echte Live-Übertragung auf iPad und Android (Option a aus F1). Die Schnittstelle ist vorbereitet.
- Web-Push-Hinweis am Ende der Scroll-Zeit (derzeit: Countdown am Beamer und angezeigte Endzeit)
- PWA-Manifest und Service Worker (Offline-Nutzung der Module 1 und 2)
- weitere Sprachen (Struktur in `src/i18n` vorbereitet), E2E-Tests in der CI
- „Like das erste Hunde-Video“ als zweite Merkaufgabe (die Erkennung `hasDog` liefert der Worker bereits)
- Modul-2-Äquivalente mit geprüften Quellen (Führerschein-Theorie, Sprachkurs)

---

## Vor dem Schuleinsatz fachlich zu prüfen

| Aussage / Zahl | Stelle | Warum |
|---|---|---|
| 166 / 278 min Bildschirmzeit (D01) | Modul 1, Startseite | Arbeitspapier: im Text „Volljährige“, in Anhang A „18–19 J.“ |
| Riskantes Video-Streaming 25 % (D05) | Registry | nicht begutachteter Preprint (Cloes et al. 2026) |
| ≤ 23 / ≤ 26 min bis zu toxischen bzw. Manosphere-Inhalten (D06) | Modul 1 | Arbeitspapier nennt die 23 min einmal „misogyn“, einmal „toxisch“ |
| Parteivideos nach 11–12 min (D10) | Modul 1 | im Papier auf eine Partei bezogen; neutrale Formulierung nach Beutelsbacher Konsens prüfen |
| Nguyen et al. 2025 (r = −0,38 / −0,41) | Modul 1 | nicht im Arbeitspapier; über PubMed geprüft (doi:10.1037/bul0000498) → ins Papier aufnehmen |
| Chiossi et al. 2023 (prospektives Gedächtnis) | Konzept Modul 3 | nicht im Arbeitspapier, Angabe nicht geprüft |
| Schwellen Politik-Feed-Profil (15 % Anteil, ≥ 6 Videos, ≥ 60 % Engagement, Bootstrap 70/90 %) | `politicsProfile.ts` | Setzungen, keine validierten Grenzwerte |
| Schwellen E6 (κ ≥ 0,6, Recall ≥ 0,7, Schieflage ≤ 0,15) | `validation.ts` | Setzung, methodisch prüfen |
| Engagement-Gewichte (Verweildauer, Like, Loop, Skip) | `engagement.ts` | Setzung |
| Hinweis-Schwelle Manosphere/Anzügliches (≥ 3 Videos) | `FeedReport.tsx` | Setzung. Kein Schwellenwert für „Sucht“ (Arbeitspapier Kap. 12.4) |
| Texte zur Funnel-Aufklärung und „Blase platzen lassen“ | `de.ts` | inhaltlich nach Kap. 8 und 11.2 des Papiers. Menüpunkte der Apps ändern sich |
| Deutung „längere Runde → weniger behalten“ | Info-Kasten | Interferenz und Listenlänge sind der erwartete Effekt, **keine** Aussage über dauerhafte Schäden |

---

## Quellen

Aus dem Arbeitspapier „Vom 30-Sekunden-Video zur Pornosucht?“ (Stand 29.09.2026). Vollständige Angaben stehen in `apps/web/src/content/sources.ts`.

- Medienpädagogischer Forschungsverbund Südwest (2025). *JIM-Studie 2025.*
- DAK-Gesundheit (2026). *DAK-Mediensuchtstudie 2025/2026.*
- WHO Regional Office for Europe (2024). *Teens, screens and mental health (HBSC 2021/22).*
- Cloes, J.-O. et al. (2026). *Depression precedes problematic video streaming in adolescents* [Preprint].
- Baker, C., Ging, D., & Andreasen, M. B. (2024). *Recommending toxicity.* DCU Anti-Bullying Centre.
- Wall Street Journal & Edelson, L. (2024). Testreihe zu Instagram Reels.
- Amnesty International (2023). *Driven into darkness.*
- Bertelsmann Stiftung & Universität Potsdam (2025). *Digitalisiert, politisiert, polarisiert?*
- Hosseinmardi, H. et al. (2024). *PNAS*, 121(8).
- Gauthier, G. et al. (2026). *Nature*, 652, 416–423.
- Piccardi, T. et al. (2025). *Science*, 390(6776).
- Castelo, N. et al. (2025). *PNAS Nexus*, 4.
- Europäische Kommission (2026). Vorläufige Feststellung zu TikTok (DSA).
- TikTok (2023). *Unsere Einhaltung des Digital Services Act*; heise online (2026) zu OLG Bamberg.
- Grubbs, J. B. et al. (2019). *Archives of Sexual Behavior*, 48(2).

Zusätzlich, nicht im Arbeitspapier:
- Nguyen, L. et al. (2025). *Psychological Bulletin*, 151(9), 1125–1146. doi:10.1037/bul0000498 – über PubMed geprüft
- Chiossi, F. et al. (2023). CHI ’23 – **ungeprüft**
- Hautus, M. J. (1995). Korrektur für d′ – Methodenquelle, Angabe prüfen
- Landis, J. R. & Koch, G. G. (1977). Einordnung von Kappa – Methodenquelle
