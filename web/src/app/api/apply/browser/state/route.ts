import { browserSessionState } from "@/lib/apply/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("sessionId") || "";
  const state = id ? browserSessionState(id) : null;
  if (!state) return Response.json({ error: "browser session not found" }, { status: 404 });
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
