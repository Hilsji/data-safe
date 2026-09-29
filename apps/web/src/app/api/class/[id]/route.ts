import { NextResponse } from "next/server";
import { classOverview, requireOwnClass } from "@/server/classes";
import { errorResponse, getDeps, noStore, requireRole, requireSameOrigin } from "@/server/runtime";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireRole(req, "teacher");
    return NextResponse.json(await classOverview(await getDeps(), user.userId, (await params).id), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    requireSameOrigin(req);
    const user = await requireRole(req, "teacher");
    const deps = await getDeps();
    const cls = await requireOwnClass(deps, user.userId, (await params).id);
    await deps.store.deleteClass(cls._id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
