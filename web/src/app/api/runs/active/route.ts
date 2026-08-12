import { NextResponse } from "next/server";
import { listKnownRuns } from "@/lib/core/active-runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** In-flight (and briefly retained finished) server-owned workers for reconnect. */
export async function GET() {
  return NextResponse.json({ runs: listKnownRuns() });
}
