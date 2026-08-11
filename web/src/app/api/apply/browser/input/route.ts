import { userBrowserInput, type BrowserInput } from "@/lib/apply/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { sessionId?: string; input?: BrowserInput };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.sessionId || !body.input || !["click", "scroll", "text", "key"].includes(body.input.type)) {
    return Response.json({ error: "sessionId and valid input are required" }, { status: 400 });
  }
  try {
    await userBrowserInput(body.sessionId, body.input);
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "input failed";
    return Response.json({ error: message }, { status: message.includes("controlled by the agent") ? 409 : 400 });
  }
}
