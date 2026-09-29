import { NextResponse } from "next/server";
import { contribute } from "@/server/classes";
import { errorResponse, getDeps, noStore, rateLimit } from "@/server/runtime";

/** Anonymer, gebucketeter Beitrag nach dem Quiz (ohne Politik). */
export async function POST(req: Request) {
  try {
    rateLimit(req, 30);
    await contribute(await getDeps(), await req.json());
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
