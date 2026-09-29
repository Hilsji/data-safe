# Datenschutzerklärung – ENTWURF

> **Entwurf, nicht rechtsgeprüft.** Vor dem ersten Einsatz mit der/dem Datenschutzbeauftragten der Schule bzw. des Schulträgers abstimmen und an das jeweilige Landesrecht anpassen. Eine **Datenschutz-Folgenabschätzung (Art. 35 DSGVO)** ist erforderlich, weil politische Meinungen (besondere Kategorie, Art. 9) von Minderjährigen verarbeitet werden können. Platzhalter stehen in `[eckigen Klammern]`.

## 1. Verantwortliche Stelle
[Name der Schule / des Schulträgers], [Anschrift], [E-Mail]
Datenschutzbeauftragte/r: [Name, Kontakt]

## 2. Worum es geht
„Guide me on the right way.“ ist eine Lern-App für den Unterricht. Sie zeigt, wie Kurzvideo-Feeds funktionieren und wie viel von einer Scroll-Runde hängen bleibt. Die App läuft auf einem Rechner der Schule („Schul-Box“) oder bei [Hoster, z. B. Strato AG, Berlin] mit Auftragsverarbeitungsvertrag.

## 3. Welche Daten wir verarbeiten – und welche nicht

| Bereich | Was | Wo | Wie lange |
|---|---|---|---|
| **Module 1 und 2** (Fakten, Rechner) | nichts | nur im Browser | – |
| **Unique ID** | eine zufällige Kennung, die dein Gerät erzeugt. Der Server kennt nur einen daraus abgeleiteten Abruf-Schlüssel und einen öffentlichen Schlüssel, nie die ID selbst | Server | bis zur Löschung, höchstens 7 Tage |
| **Bildschirmaufnahme** | die Aufnahme deiner Scroll-Runde | Server der Schule | wird **sofort nach der Auswertung gelöscht**, spätestens nach 24 Stunden |
| **Auswertung („Feed-Bericht“)** | Themen der Videos, Sehdauer, Likes, Wiederholungen, Standbilder, Quizfragen; mit deiner Einwilligung auch die politische Richtung von Politik-Videos | Server, **nur verschlüsselt**. Lesen kann ihn nur, wer deine ID hat, nicht die Schule und nicht die Lehrkraft | bis zu deiner Löschung, höchstens 7 Tage |
| **Gedächtnis-Check, Merkwort** | dein Ausgangswert und das Merkwort | Server, verschlüsselt (wie oben) | wie oben |
| **Klassen-Beitritt** | ein generiertes Pseudonym (z. B. „Blauer Otter 42“) und die Gruppe | Server | 7 Tage |
| **Klassen-Auswertung** | freiwillig und anonym: grobe Werte (z. B. „etwa zwei Drittel richtig“), dein Top-Thema **ohne Politik**. Das wird nur zu Zählern addiert und nicht mit deinem Pseudonym verknüpft | Server | 7 Tage |
| **Lehrkräfte / Projektteam** | Hash der E-Mail-Adresse, Rolle, Sitzungs-Cookie | Server | Sitzung 10 Stunden |

**Nicht verarbeitet:** Klarnamen, Chats und Direktnachrichten, dein Profil, andere Apps, Benachrichtigungen. Solche Bildschirme erkennt die Auswertung und verwirft sie, bevor irgendetwas davon gespeichert wird. Nutzernamen, Telefonnummern, E-Mail-Adressen, Adressen und dein eigener Account-Name werden geschwärzt. Es gibt kein Tracking, keine Werbung und keine Weitergabe an Dritte. Es läuft keine KI eines Drittanbieters: Texterkennung, Spracherkennung und Sprachmodell laufen auf dem Server der Schule.

## 4. Zwecke und Rechtsgrundlagen (Entwurf)
- **Unterricht und Medienbildung:** Art. 6 Abs. 1 lit. e DSGVO i. V. m. [§ … Landesschulgesetz] **oder** Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO – [mit Datenschutzbeauftragter/m klären].
- **Auswertung der Bildschirmaufnahme:** Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), bei unter 16-Jährigen durch die Sorgeberechtigten (Art. 8 DSGVO).
- **Politische Richtung im Feed-Bericht:** ausdrückliche, gesonderte Einwilligung (Art. 9 Abs. 2 lit. a DSGVO). Ohne sie zeigt der Bericht nur, *wie viel* Politik dabei war. Die Einordnung wird außerdem nur genutzt, wenn das Modell vorher nachweislich zuverlässig und ausgewogen geprüft wurde.

## 5. Wer die Daten sieht
- **Du:** deinen vollständigen Bericht, mit deiner ID.
- **Lehrkraft:** Pseudonyme der Klasse, Fortschritt als Anzahlen, nach Rundenende Durchschnitte ab 5 Beiträgen je Gruppe, **nie** Politik und nie Einzelergebnisse.
- **Betrieb:** technisch Zugriff auf verschlüsselte Daten, aber keinen Schlüssel.

## 6. Speicherdauer und Löschung
Automatische Löschung nach den oben genannten Fristen (Datenbank-TTL). Du kannst deinen Bericht jederzeit selbst löschen („Bericht und alle Daten jetzt löschen“). Lehrkräfte können ihre Klassen-Session jederzeit löschen.

## 7. Deine Rechte
Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Widerruf einer Einwilligung mit Wirkung für die Zukunft, Beschwerde bei der Aufsichtsbehörde [Landesdatenschutzbehörde]. Weil der Server deine ID nicht kennt, kann die Schule deinen Bericht ohne deine ID nicht finden. Die Löschung geht deshalb am schnellsten selbst über die App.

## 8. Sicherheit
Ende-zu-Ende-Verschlüsselung des Berichts (X25519, AES-256-GCM), TLS bei Betrieb im Internet, Upload-Dateien nur für den Dienst lesbar, Empfehlung: verschlüsselte Festplatte der Schul-Box, keine IP-Speicherung in Protokollen.

## 9. Offene Punkte für die Prüfung
- [ ] Rechtsgrundlage für den Unterrichtseinsatz nach Landesrecht
- [ ] DSFA (Art. 35) inkl. Risiko „Aufnahme enthält trotz Anleitung private Inhalte“
- [ ] Verzeichnis von Verarbeitungstätigkeiten (Art. 30)
- [ ] AVV mit Hoster (bei Strato-Betrieb)
- [ ] Nutzungsbedingungen der Kurzvideo-Apps (Bildschirmaufnahme und Auswertung zu Bildungszwecken)
- [ ] Jugendschutz: Umgang mit belastenden Inhalten während der Scroll-Runde (Aufsicht, Abbruch)
