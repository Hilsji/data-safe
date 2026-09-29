import { NextResponse } from "next/server";
import { approvePolitics } from "@/server/calibration";
import { errorResponse, getDeps, noStore, requireRole, requireSameOrigin } from "@/server/runtime";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireRole(req, "admin");
    return NextResponse.json({ approvedModelVersion: await approvePolitics(await getDeps(), user.userId) }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
