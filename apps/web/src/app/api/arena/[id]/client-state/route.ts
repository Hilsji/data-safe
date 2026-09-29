import { NextResponse } from "next/server";
import { updateClientState } from "@/server/arena";
import { errorResponse, getDeps, noStore, rateLimit } from "@/server/runtime";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(req);
    const { id } = await params;
    await updateClientState(await getDeps(), id, await req.json());
    return new NextResponse(null, { status: 204, headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
