import { NextResponse } from "next/server";
import { detectClis, isSimpleMode, pinnedDefaultCli } from "@/lib/clis";

export const dynamic = "force-dynamic";

// Detects which agnostic AI tools are installed on THIS machine (local-first).
// The web delegates career-ops to one of these in headless mode, on the user's
// own auth/tokens — no API key needed. When CAREER_OPS_DEFAULT_CLI is set, the
// picker is pinned and clients should hide the choice UI.
export async function GET() {
  const pinned = pinnedDefaultCli();
  return NextResponse.json({
    clis: detectClis(),
    defaultCli: pinned,
    pinned: Boolean(pinned),
    simple: isSimpleMode(),
  });
}
