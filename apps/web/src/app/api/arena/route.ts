import { NextResponse } from "next/server";
import { registerArena } from "@/server/arena";
import { errorResponse, getDeps, noStore, rateLimit } from "@/server/runtime";

export async function POST(req: Request) {
  try {
    rateLimit(req, 20);
    await registerArena(await getDeps(), await req.json());
    return NextResponse.json({ ok: true }, { status: 201, headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
