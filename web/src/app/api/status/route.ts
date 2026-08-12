import { NextResponse } from "next/server";
import { TrackerStatusError, updateTrackerStatus } from "@/lib/core/tracker-status";

// Writeback: UPDATE the status cell of an EXISTING tracker row only. Never adds
// rows — per the core data contract, new rows go through the TSV + merge flow.
// HARDENED: validate against the canonical states (states.yml SSOT); reject any
// value with table-breaking chars (| \r \n **) that would scramble the row; detect
// the Status column from the header (8- and 9-col layouts); atomic write.
export async function POST(req: Request) {
  let body: { n?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const { n, status } = body;
  if (!n || typeof status !== "string") {
    return NextResponse.json({ error: "n and status required" }, { status: 400 });
  }
  try {
    const canon = updateTrackerStatus(String(n), status);
    return NextResponse.json({ ok: true, status: canon });
  } catch (error) {
    if (error instanceof TrackerStatusError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
}
