# Ablenker-Bank für den Wiedererkennungstest

Standbilder, die garantiert in keiner Schüler-Runde vorkamen („nicht gesehen“).

- Eigene Aufnahmen des Projektteams im Kurzvideo-Stil oder lizenziertes Material – **keine Screenshots fremder Accounts**.
- Keine erkennbaren Personen ohne Einwilligung, keine Nutzernamen, kein sexualisiertes oder politisches Material.
- Format: JPEG, Hochkant, ca. 240 px breit.
- Eintrag in `manifest.json`: `{ "id": "d001", "category": "food", "image": "/distractors/d001.jpg" }`
  (Kategorien wie in `src/engine/types.ts`).

Solange die Bank leer ist, entfällt der Wiedererkennungs-Teil des Quiz. Die Runde wird dann als
„eingeschränkt vergleichbar“ markiert. **TODO:** mindestens 60 Bilder, verteilt über die häufigen Kategorien.
