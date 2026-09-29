import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifyLogin } from "@/server/auth";
import { getAuth, getDeps, rateLimit } from "@/server/runtime";

/** Link aus der Mail: Token einlösen, Sitzungs-Cookie setzen, weiter zum Dashboard. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { cfg } = getAuth();
  try {
    rateLimit(req, 20);
  } catch {
    return NextResponse.redirect(new URL("/lehrkraft?login=fehler", cfg.appUrl));
  }
  const result = await verifyLogin((await getDeps()).store, cfg, url.searchParams.get("token") ?? "");
  if (!result) return NextResponse.redirect(new URL("/lehrkraft?login=abgelaufen", cfg.appUrl));
  const res = NextResponse.redirect(new URL("/lehrkraft", cfg.appUrl));
  res.cookies.set(SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    secure: cfg.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: result.maxAgeSec,
  });
  return res;
}
