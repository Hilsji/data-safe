import { NextResponse } from "next/server";
import { validationReport } from "@/server/calibration";
import { errorResponse, getDeps, noStore, requireRole } from "@/server/runtime";

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");
    return NextResponse.json(await validationReport(await getDeps()), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
