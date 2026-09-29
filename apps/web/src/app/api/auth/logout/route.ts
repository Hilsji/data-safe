import { NextResponse } from "next/server";
import { SESSION_COOKIE, sha256 } from "@/server/auth";
import { getDeps } from "@/server/runtime";

export async function POST(req: Request) {
  const token = /(?:^|;\s*)gm_session=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
  if (token) await (await getDeps()).store.deleteUserSession(sha256(decodeURIComponent(token)));
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
