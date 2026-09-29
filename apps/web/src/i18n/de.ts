/**
 * Deutsche Texte. Weitere Sprachen implementieren denselben Typ `Messages`.
 * Ton: sachlich, jugendnah, nie moralisierend (Arbeitspapier Kap. 12.1: Schamfreiheit, keine Diagnosen).
 * src/i18n/wording.test.ts prüft alle Texte auf verbotene Formulierungen.
 */
export const de = {
  common: {
    motto: "Guide me on the right way.",
    next: "Weiter",
    back: "Zurück",
    cancel: "Abbrechen",
    retry: "Nochmal versuchen",
    yes: "Ja",
    no: "Nein",
    minutes: "Minuten",
    loading: "Lädt …",
    deleteAll: "Alles löschen",
  },
  arena: {
    title: "Scroll-Arena",
    steps: ["Start", "Einwilligung", "Deine ID", "Gedächtnis-Check", "Einstellungen", "Scrollen", "Hochladen"],
    intro: {
      heading: "Was bleibt von deiner Scroll-Zeit hängen?",
      body: "Du scrollst 15, 30 oder 45 Minuten in deiner Kurzvideo-App – ganz normal, mit deinem Account. Dein Bildschirm wird dabei aufgenommen. In der nächsten Stunde bekommst du deinen Feed-Bericht: Womit hat dich der Feed gefüttert – und was davon ist hängen geblieben?",
      ageQuestion: "Wie alt bist du?",
      ageOptions: { u14: "unter 14", "14-15": "14 oder 15", "16+": "16 oder älter" },
      under14:
        "Der Scroll-Test ist ab 14 Jahren. Die Kurzvideo-Apps selbst erlauben Accounts erst ab 13, und manche Feeds zeigen schnell Inhalte, die nicht für dich gedacht sind. Du kannst aber alle anderen Teile der App nutzen.",
      toModules: "Zu „Was Social Media mit dir macht“",
    },
    consent: {
      heading: "Was mit deinen Daten passiert",
      points: [
        "Deine Aufnahme wird nur auf dem Rechner deiner Schule ausgewertet und danach sofort gelöscht.",
        "Bevor irgendetwas ausgewertet wird, werden Nutzernamen, Nachrichten, Benachrichtigungen und dein eigener Account geschwärzt. Chats, dein Profil und andere Apps werden gar nicht angeschaut.",
        "Dein Feed-Bericht wird verschlüsselt. Lesen kann ihn nur, wer deine ID hat – nicht deine Lehrkraft, nicht die Schule, nicht wir.",
        "Deine Lehrkraft sieht nur Klassen-Durchschnitte ab 5 Personen, nie Einzelergebnisse und nie Politik.",
        "Nach 7 Tagen wird alles automatisch gelöscht. Du kannst jederzeit früher löschen.",
      ],
      analysisLabel: "Ich bin einverstanden, dass meine Aufnahme wie beschrieben ausgewertet wird.",
      politicsHeading: "Freiwillig: Politik-Richtung im Feed",
      politicsBody:
        "Wenn dein Feed dir Politik-Videos zeigt, kann die App einordnen, in welche Richtung er sich verengt hat. Das sind besonders geschützte Daten (Art. 9 DSGVO). Das Ergebnis siehst nur du, es wird nicht übertragen und nach dem Bericht gelöscht. Ohne Häkchen zeigt der Bericht nur, wie viel Politik dabei war – ohne Richtung.",
      politicsLabel: "Ja, ordne auch die Richtung von Politik-Videos ein.",
      guardianHint:
        "Du bist unter 16: Deine Sorgeberechtigten müssen zugestimmt haben. Das organisiert deine Schule – du brauchst dafür den Klassen-Code deiner Lehrkraft.",
      classCodeLabel: "Klassen-Code (6 Zeichen, von deiner Lehrkraft)",
      classCodeOptional: "Klassen-Code (falls du in einer Klassen-Session bist)",
    },
    id: {
      heading: "Deine persönliche ID",
      body: "Mit dieser ID holst du in der nächsten Stunde deinen Feed-Bericht ab – auf jedem Gerät. Sie ist dein Schlüssel: Wer sie hat, kann deinen Bericht lesen. Behandle sie wie ein Passwort.",
      how: "Schreib sie ab oder fotografiere sie. Wir können sie nicht wiederherstellen.",
      copy: "Kopieren",
      copied: "Kopiert",
      confirm: "Ich habe meine ID notiert.",
    },
    baseline: {
      heading: "Gedächtnis-Check (2 Minuten)",
      intro: "Du siehst gleich 8 Wörter, jedes für ein paar Sekunden. Merk sie dir. Danach fragen wir, welche Wörter dabei waren. Das ist dein persönlicher Ausgangswert – verglichen wird nur mit dir selbst.",
      start: "Los geht’s",
      studyLabel: "Wort {n} von {total}",
      testQuestion: "War dieses Wort dabei?",
      testProgress: "{n} von {total}",
      done: "Danke! Dein Ausgangswert ist gespeichert.",
    },
    setup: {
      heading: "Deine Runde",
      durationLabel: "Wie lange willst du scrollen?",
      appLabel: "Welche App nutzt du am häufigsten?",
      apps: {
        tiktok: "TikTok",
        instagram_reels: "Instagram Reels",
        youtube_shorts: "YouTube Shorts",
        snapchat_spotlight: "Snapchat Spotlight",
        other: "Andere App",
      },
      otherAppHint: "Andere Apps werden nur grob ausgewertet – der Bericht wird ungenauer.",
      intentionHeading: "Eine Aufgabe für später",
      intentionBody:
        "Merk dir dieses Wort: Wenn du nach dem Scrollen in diese App zurückkommst, tippe als Erstes auf den Stern ☆ oben rechts und gib das Wort ein.",
      intentionConfirm: "Ich habe mir das Wort gemerkt.",
    },
    record: {
      heading: "So startest du die Aufnahme",
      platforms: { ios: "iPad / iPhone", android: "Android", desktop: "Laptop / PC" },
      prepare: "Vorher: Stell „Nicht stören“ bzw. den Fokus-Modus an. Dann tauchen keine Nachrichten in der Aufnahme auf.",
      ios: [
        "Öffne das Kontrollzentrum (von oben rechts nach unten wischen).",
        "Tippe auf den Aufnahme-Knopf ⏺. Nach 3 Sekunden läuft die Aufnahme.",
        "Tippe hier auf „App öffnen“ und scroll wie immer.",
        "Wenn die Zeit um ist: Kontrollzentrum öffnen und die Aufnahme stoppen. Sie landet in „Fotos“.",
        "Komm zurück in diese App.",
      ],
      android: [
        "Wisch von oben nach unten und öffne die Schnelleinstellungen.",
        "Tippe auf „Bildschirmaufzeichnung“ (evtl. musst du sie erst hinzufügen) und wähle „Mit Ton“, wenn möglich.",
        "Tippe hier auf „App öffnen“ und scroll wie immer.",
        "Wenn die Zeit um ist: Aufnahme in der Benachrichtigungsleiste stoppen. Sie landet in der Galerie.",
        "Komm zurück in diese App.",
      ],
      desktop: [
        "Tippe auf „Aufnahme starten“ und wähle den Tab bzw. das Fenster mit deiner Kurzvideo-App.",
        "Scroll in diesem Tab wie immer. Die Aufnahme wird nebenbei schon hochgeladen.",
        "Nach der gewählten Zeit endet die Aufnahme automatisch.",
      ],
      openApp: "App öffnen",
      startDesktop: "Aufnahme starten",
      stopDesktop: "Aufnahme beenden",
      endsAt: "Deine Zeit endet um {time} Uhr.",
      recordingSince: "Aufnahme läuft seit {min} min",
      desktopUnsupported: "Dein Browser kann den Bildschirm nicht aufnehmen. Nutze die Aufnahme deines Geräts und lade die Datei danach hoch.",
      ready: "Ich bin zurück",
    },
    star: {
      label: "Stern",
      prompt: "Welches Wort solltest du dir merken?",
      save: "Speichern",
      thanks: "Gespeichert.",
    },
    upload: {
      heading: "Aufnahme hochladen",
      body: "Wähle die Aufnahme aus deinen Fotos bzw. deiner Galerie. Bleib im WLAN und lass die App offen, bis der Upload fertig ist.",
      choose: "Aufnahme auswählen",
      progress: "{pct} % hochgeladen",
      resumed: "Verbindung weg – es geht automatisch an der richtigen Stelle weiter.",
      done: "Fertig! Deine Aufnahme wird jetzt ausgewertet und danach gelöscht.",
      reportFrom: "Dein Feed-Bericht ist ab {time} Uhr abrufbar – spätestens in der nächsten Stunde.",
      rememberId: "Deine ID:",
      toModules: "In der Zwischenzeit: „Was Social Media mit dir macht“",
      wrongType: "Das ist keine Videodatei.",
    },
    errors: {
      generic: "Das hat nicht geklappt. Bitte versuch es nochmal.",
      network: "Keine Verbindung zum Schul-Server.",
    },
  },
  report: {
    title: "Dein Feed-Bericht",
    enterId: "Gib deine ID ein",
    fetch: "Bericht abrufen",
    notFound: "Zu dieser ID gibt es nichts (mehr). Berichte werden nach 7 Tagen gelöscht.",
    processing: "Deine Aufnahme wird noch ausgewertet ({pct} %).",
    waiting: "Dein Bericht ist fertig und wird ab {time} Uhr freigeschaltet. Bis dahin: Kopf frei kriegen, das gehört zum Test.",
    failed: "Die Auswertung hat nicht geklappt: {reason}",
    deleteReport: "Bericht und alle Daten jetzt löschen",
    deleted: "Gelöscht. Es sind keine Daten mehr auf dem Server.",
  },
} as const;

type Widen<T> = T extends string ? string : T extends readonly (infer U)[] ? readonly Widen<U>[] : { [K in keyof T]: Widen<T[K]> };
export type Messages = Widen<typeof de>;

/** Platzhalter {name} ersetzen */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}
