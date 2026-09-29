import { NextResponse } from "next/server";
import { z } from "zod";
import { requestLogin } from "@/server/auth";
import { errorResponse, getAuth, getDeps, noStore, rateLimit } from "@/server/runtime";

/** Magic Link anfordern. Antwortet immer gleich – verrät nicht, ob die Adresse berechtigt ist. */
export async function POST(req: Request) {
  try {
    rateLimit(req, 5);
    const { email } = z.object({ email: z.string().max(320) }).parse(await req.json());
    const { cfg, mailer } = getAuth();
    await requestLogin((await getDeps()).store, cfg, mailer, email);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
