import { NextResponse } from "next/server";
import { saveTag } from "@/server/calibration";
import { errorResponse, getDeps, requireRole, requireSameOrigin } from "@/server/runtime";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const user = await requireRole(req, "rater");
    await saveTag(await getDeps(), user.userId, (await params).id, await req.json());
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
