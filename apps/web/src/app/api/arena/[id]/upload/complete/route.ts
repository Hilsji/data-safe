import { NextResponse } from "next/server";
import { completeUpload } from "@/server/arena";
import { errorResponse, getDeps, noStore, rateLimit } from "@/server/runtime";

/** Streaming-Upload abschließen (Laptop-Aufnahme ohne vorher bekannte Größe). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req);
    const { id } = await params;
    return NextResponse.json(await completeUpload(await getDeps(), id), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
