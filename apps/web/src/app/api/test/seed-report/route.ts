import { NextResponse } from "next/server";
import { encryptedBlobSchema, encryptedBlobSchemaFor } from "@/server/arena";
import { getDeps } from "@/server/runtime";

/**
 * NUR FÜR AUTOMATISIERTE TESTS: legt eine fertige Session mit verschlüsseltem Bericht an.
 * Existiert nur mit ENABLE_TEST_ROUTES=1 und nie in Produktion.
 */
export async function POST(req: Request) {
  if (process.env.ENABLE_TEST_ROUTES !== "1" || process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await req.json()) as { retrievalId: string; publicKey: string; result: unknown; clientState: unknown };
  const { store } = await getDeps();
  const now = new Date();
  await store.insertArena({
    _id: body.retrievalId,
    publicKey: body.publicKey,
    durationMin: 15,
    app: "tiktok",
    ageBand: "16+",
    consents: { analysis: true, politicsSpectrum: true, guardianConfirmed: false },
    classSessionId: null,
    status: "ready",
    upload: null,
    recordingEndedAt: new Date(now.getTime() - 3 * 3600_000),
    quizUnlockAt: new Date(now.getTime() - 60_000),
    progress: 1,
    failureReason: null,
    result: encryptedBlobSchemaFor(30_000_000).parse(body.result),
    clientState: body.clientState ? encryptedBlobSchema.parse(body.clientState) : null,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 86_400_000),
  });
  return NextResponse.json({ ok: true });
}
