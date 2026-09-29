import type { Metadata } from "next";

export const metadata: Metadata = { title: "Was Social Media mit dir macht · Guide me on the right way." };

export default function WissenPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Was Social Media mit dir macht</h1>
      <p style={{ color: "var(--muted)" }}>Die Daten-Story (Modul 1) und die Vergleichs-Falle (Modul 2) folgen im nächsten Schritt.</p>
    </div>
  );
}
