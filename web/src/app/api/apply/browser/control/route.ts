import { setBrowserControl, type BrowserControl } from "@/lib/apply/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set<BrowserControl>(["agent", "user", "review"]);

export async function POST(req: Request) {
  let body: { sessionId?: string; control?: BrowserControl };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.sessionId || !body.control || !ALLOWED.has(body.control)) {
    return Response.json({ error: "sessionId and valid control are required" }, { status: 400 });
  }
  try {
    return Response.json({ control: setBrowserControl(body.sessionId, body.control) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "control change failed" }, { status: 404 });
  }
}
