import { NextResponse } from "next/server";
import { TrackerStatusError, updateTrackerStatus } from "@/lib/core/tracker-status";

const DECISION_STATUS = {
  pursue: "Pursuing",
  pass: "Discarded",
} as const;

type Decision = keyof typeof DECISION_STATUS;

export async function POST(req: Request) {
  let body: { n?: string; decision?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const n = typeof body.n === "string" ? body.n.trim() : "";
  const decision = body.decision as Decision;
  if (!n || !Object.hasOwn(DECISION_STATUS, decision)) {
    return NextResponse.json({ error: "n and a valid decision are required" }, { status: 400 });
  }

  try {
    const status = updateTrackerStatus(n, DECISION_STATUS[decision]);
    return NextResponse.json({ ok: true, decision, status });
  } catch (error) {
    if (error instanceof TrackerStatusError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "decision could not be saved" }, { status: 500 });
  }
}
