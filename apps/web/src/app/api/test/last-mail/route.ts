import { NextResponse } from "next/server";

/** NUR FÜR AUTOMATISIERTE TESTS: letzte Entwicklungs-Mail (Magic Link). Nie in Produktion. */
export async function GET() {
  if (process.env.ENABLE_TEST_ROUTES !== "1" || process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({ text: (globalThis as { __guideMeLastMail?: string }).__guideMeLastMail ?? null });
}
