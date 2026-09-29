import Link from "next/link";
import { Fact } from "@/components/Fact";
import { Card } from "@/components/ui";

const ENTRIES = [
  { href: "/wissen", title: "Was Social Media mit dir macht", text: "Acht Karten mit Fakten und Quellen." },
  { href: "/vergleich", title: "Die Vergleichs-Falle", text: "Warum der Feed dich kleiner fühlen lässt – und was in deiner Zeit steckt." },
  { href: "/arena", title: "Scroll-Arena", text: "Scroll in deiner App und finde heraus, was hängen bleibt. Ab 14 Jahren." },
  { href: "/bericht", title: "Dein Feed-Bericht", text: "Mit deiner ID abrufen – in der Stunde nach deiner Runde." },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Was bleibt von deiner Scroll-Zeit hängen?</h1>
      <p style={{ color: "var(--muted)" }}>
        Jugendliche in Deutschland haben ihr Smartphone täglich <Fact id="D01" /> an. Je weniger Doomscrolling, desto mehr
        bleibt hängen – und desto mehr Zeit bleibt für dich.
      </p>
      <nav aria-label="Module">
        <ul className="grid gap-3 sm:grid-cols-2">
          {ENTRIES.map((e) => (
            <li key={e.href}>
              <Link href={e.href} className="block h-full">
                <Card className="h-full">
                  <h2 className="text-lg font-semibold" style={{ color: "var(--accent)" }}>
                    {e.title}
                  </h2>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {e.text}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
