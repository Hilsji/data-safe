import { NextResponse } from "next/server";
import { createClass } from "@/server/classes";
import { errorResponse, getDeps, noStore, requireRole, requireSameOrigin } from "@/server/runtime";

export async function GET(req: Request) {
  try {
    const user = await requireRole(req, "teacher");
    const list = await (await getDeps()).store.listClasses(user.userId);
    return NextResponse.json(
      list.map((c) => ({ id: c._id, title: c.title, joinCode: c.joinCode, state: c.state, createdAt: c.createdAt })),
      { headers: noStore },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireRole(req, "teacher");
    const cls = await createClass(await getDeps(), user.userId, await req.json());
    return NextResponse.json({ id: cls._id, joinCode: cls.joinCode }, { status: 201, headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
