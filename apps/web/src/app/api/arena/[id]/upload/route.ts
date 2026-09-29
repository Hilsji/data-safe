import { NextResponse } from "next/server";
import { appendChunk, ArenaError, initUpload, uploadStatus } from "@/server/arena";
import { errorResponse, getDeps, noStore, rateLimit } from "@/server/runtime";

type Ctx = { params: Promise<{ id: string }> };

/** Upload starten bzw. wieder aufnehmen: { size, mimeType, recordingEndedAt } */
export async function POST(req: Request, { params }: Ctx) {
  try {
    rateLimit(req);
    const { id } = await params;
    return NextResponse.json(await initUpload(await getDeps(), id, await req.json()), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Aktuellen Stand abfragen (zum Fortsetzen nach Verbindungsabbruch) */
export async function GET(req: Request, { params }: Ctx) {
  try {
    rateLimit(req);
    const { id } = await params;
    return NextResponse.json(await uploadStatus(await getDeps(), id), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Ein Teil der Aufnahme; Header „Upload-Offset“ = Byte-Position */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const offset = Number(req.headers.get("upload-offset"));
    if (!Number.isInteger(offset) || offset < 0) throw new ArenaError(400, "offset", "Header Upload-Offset fehlt.");
    const chunk = new Uint8Array(await req.arrayBuffer());
    return NextResponse.json(await appendChunk(await getDeps(), id, offset, chunk), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
