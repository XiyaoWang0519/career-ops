import { NextResponse } from "next/server";
import { readWebShortlist, setPipelineReviewed, withTriageLock, writeWebShortlist, type SavedRole } from "@/lib/triage-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validItem(value: unknown): value is SavedRole {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedRole>;
  return typeof item.url === "string" && /^https?:\/\//i.test(item.url) && typeof item.company === "string" && typeof item.role === "string";
}

export async function GET() {
  return NextResponse.json({ shortlist: readWebShortlist() });
}

export async function POST(req: Request) {
  let body: { action?: string; item?: unknown; items?: unknown; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  return withTriageLock(() => {
    const current = readWebShortlist();
    if (body.action === "save") {
      const incoming = Array.isArray(body.items) ? body.items.filter(validItem) : validItem(body.item) ? [body.item] : [];
      if (!incoming.length) return NextResponse.json({ error: "valid item required" }, { status: 400 });
      writeWebShortlist([...current, ...incoming]);
    } else if (body.action === "remove") {
      if (typeof body.url !== "string") return NextResponse.json({ error: "url required" }, { status: 400 });
      writeWebShortlist(current.filter((item) => item.url !== body.url));
    } else if (body.action === "clear") {
      writeWebShortlist([]);
    } else if (body.action === "skip" || body.action === "restore") {
      if (typeof body.url !== "string" || !/^https?:\/\//i.test(body.url)) return NextResponse.json({ error: "valid url required" }, { status: 400 });
      setPipelineReviewed(body.url, body.action === "skip");
      if (body.action === "skip" && current.some((item) => item.url === body.url)) writeWebShortlist(current.filter((item) => item.url !== body.url));
    } else {
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, shortlist: readWebShortlist() });
  });
}
