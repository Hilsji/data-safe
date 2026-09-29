import { NextResponse } from "next/server";
import { revokePolitics } from "@/server/calibration";
import { errorResponse, getDeps, requireRole, requireSameOrigin } from "@/server/runtime";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    await requireRole(req, "admin");
    await revokePolitics(await getDeps());
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
