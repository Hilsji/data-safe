/**
 * Modul-2-Äquivalente („so viel Zeit wie …“). Das Arbeitspapier enthält dazu keine Zahlen.
 * Solange `status` nicht "verified" ist, zeigt die App das Äquivalent NICHT an (keine Schätzungen).
 */
export interface Equivalent {
  id: string;
  label: string;
  unit: string;
  hours: number | null;
  status: "verified" | "todo";
  source: string | null;
  note: string;
}

export const EQUIVALENTS: Equivalent[] = [
  {
    id: "driving_theory",
    label: "Führerschein-Theorieunterricht (Klasse B)",
    unit: "kompletter Theorieunterricht",
    hours: null,
    status: "todo",
    source: null,
    note: "TODO: Pflichtstunden laut Fahrschüler-Ausbildungsordnung (FahrschAusbO), Anlage 1 prüfen und eintragen.",
  },
  {
    id: "language_level",
    label: "Sprachkurs, eine GER-Niveaustufe (z. B. A1)",
    unit: "Niveaustufe",
    hours: null,
    status: "todo",
    source: null,
    note: "TODO: Unterrichtseinheiten je Niveau stark anbieterabhängig – eine konkrete, zitierfähige Quelle festlegen (z. B. Goethe-Institut).",
  },
  {
    id: "tutoring",
    label: "Nachhilfestunden (à 60 min)",
    unit: "Stunden",
    hours: 1,
    status: "verified",
    source: "Definitorisch: 1 Stunde = 60 min (keine externe Zahl)",
    note: "Reine Umrechnung, keine externe Zahl.",
  },
];
