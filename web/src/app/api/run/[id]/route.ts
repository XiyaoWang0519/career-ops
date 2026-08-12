import { getActiveRun, subscribeActiveRun } from "@/lib/core/active-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/** Reattach to a server-owned worker: replay buffered NDJSON, then live-tail. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const id = decodeURIComponent(rawId || "").trim().slice(0, 120);
  if (!id) {
    return new Response(JSON.stringify({ error: "id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const snap = getActiveRun(id);
  if (!snap) {
    return new Response(JSON.stringify({ error: "Worker not found (it may have finished and been garbage-collected)" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const afterRaw = url.searchParams.get("after");
  const after = afterRaw ? Number.parseInt(afterRaw, 10) : 0;
  const stream = subscribeActiveRun(id, Number.isFinite(after) ? after : 0);
  if (!stream) {
    return new Response(JSON.stringify({ error: "Worker not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Career-Ops-Run-Id": id,
      "X-Career-Ops-Run-Status": snap.status,
    },
  });
}
