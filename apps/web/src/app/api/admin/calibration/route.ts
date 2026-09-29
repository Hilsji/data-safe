import { NextResponse } from "next/server";
import { listForRater, uploadCalibration } from "@/server/calibration";
import { errorResponse, getDeps, noStore, requireRole, requireSameOrigin } from "@/server/runtime";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req, "rater");
    return NextResponse.json(await listForRater(await getDeps(), user.userId), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Upload der Worker-Ausgabe `python -m guide_worker.calibrate` (nur Aufnahmen mit Test-Accounts). */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireRole(req, "admin");
    const id = await uploadCalibration(await getDeps(), user.userId, await req.json());
    return NextResponse.json({ id }, { status: 201, headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
