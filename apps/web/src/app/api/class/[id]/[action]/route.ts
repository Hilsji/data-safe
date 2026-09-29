import { NextResponse } from "next/server";
import { ArenaError } from "@/server/arena";
import { classAction, type ClassAction } from "@/server/classes";
import { errorResponse, getDeps, noStore, requireRole, requireSameOrigin } from "@/server/runtime";

const ACTIONS: ClassAction[] = ["start", "release", "close"];

/** start = Countdown starten · release = Berichte freigeben (Folgestunde) · close = Runde schließen, Ergebnisse anzeigen */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  try {
    requireSameOrigin(req);
    const user = await requireRole(req, "teacher");
    const { id, action } = await params;
    if (!ACTIONS.includes(action as ClassAction)) throw new ArenaError(404, "not_found", "Unbekannte Aktion.");
    const cls = await classAction(await getDeps(), user.userId, id, action as ClassAction);
    return NextResponse.json({ state: cls.state }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
