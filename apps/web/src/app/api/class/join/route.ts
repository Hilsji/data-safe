import { NextResponse } from "next/server";
import { z } from "zod";
import { joinClass } from "@/server/classes";
import { errorResponse, getDeps, noStore, rateLimit } from "@/server/runtime";

export async function POST(req: Request) {
  try {
    rateLimit(req, 30);
    const { code } = z.object({ code: z.string() }).strict().parse(await req.json());
    return NextResponse.json(await joinClass(await getDeps(), code), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
