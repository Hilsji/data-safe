import type { Metadata } from "next";
import { Alert, Card } from "@/components/ui";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: "Datenschutz · Guide me on the right way." };

export default function DatenschutzPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Datenschutz</h1>
      <Alert>
        Entwurf: Die vollständige Datenschutzerklärung wird nach der Prüfung durch die Schule bzw. den Schulträger hier
        veröffentlicht. Bis dahin gelten die folgenden Grundsätze.
      </Alert>
      <Card>
        <ul className="list-disc space-y-2 pl-5">
          {de.arena.consent.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
          <li>Die Fakten-Karten und der Vergleichs-Rechner speichern nichts – alles bleibt in deinem Browser.</li>
          <li>Kein Tracking, keine Werbung, keine Weitergabe an Dritte, keine KI von Drittanbietern.</li>
        </ul>
      </Card>
    </div>
  );
}
