import { NextResponse } from "next/server";
import { segmentsForRater } from "@/server/calibration";
import { errorResponse, getDeps, noStore, requireRole, requireSameOrigin } from "@/server/runtime";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireRole(req, "rater");
    return NextResponse.json(await segmentsForRater(await getDeps(), user.userId, (await params).id), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    requireSameOrigin(req);
    await requireRole(req, "admin");
    await (await getDeps()).store.deleteCalibration((await params).id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
