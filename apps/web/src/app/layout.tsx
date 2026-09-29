import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Guide me on the right way.",
  description: "Präventions-App gegen Doomscrolling für Schulen: Was bleibt von deiner Scroll-Zeit hängen?",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
          Zum Inhalt springen
        </a>
        <header className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold tracking-wide" style={{ color: "var(--accent)" }}>
            Guide me on the right way.
          </p>
        </header>
        <main id="main" className="mx-auto max-w-2xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
