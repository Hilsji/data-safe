import { NextResponse } from "next/server";
import { currentUser, noStore } from "@/server/runtime";

export async function GET(req: Request) {
  const user = await currentUser(req);
  return NextResponse.json(user ? { roles: user.roles } : { roles: [] }, { headers: noStore });
}
