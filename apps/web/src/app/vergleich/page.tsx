import type { Metadata } from "next";
import { Comparison } from "@/components/modules/Comparison";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: "Die Vergleichs-Falle · Guide me on the right way." };

export default function VergleichPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{de.comparison.title}</h1>
      <Comparison />
    </div>
  );
}
