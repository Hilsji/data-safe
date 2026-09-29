import { NextResponse } from "next/server";
import { deleteArena, getStatus } from "@/server/arena";
import { errorResponse, getDeps, noStore, rateLimit } from "@/server/runtime";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    rateLimit(req);
    const { id } = await params;
    return NextResponse.json(await getStatus(await getDeps(), id), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    rateLimit(req);
    const { id } = await params;
    await deleteArena(await getDeps(), id);
    return new NextResponse(null, { status: 204, headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
