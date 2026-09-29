import { Fact } from "@/components/Fact";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Was bleibt von deiner Scroll-Zeit hängen?</h1>
      <p style={{ color: "var(--muted)" }}>
        Jugendliche in Deutschland sind täglich <Fact id="D01" /> am Smartphone. In dieser App findest du heraus, was
        davon hängen bleibt – und wohin dich dein Feed lenkt.
      </p>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Entwicklungsstand: Rechenkerne und Verschlüsselung sind fertig. Die Oberfläche folgt.
      </p>
    </div>
  );
}
