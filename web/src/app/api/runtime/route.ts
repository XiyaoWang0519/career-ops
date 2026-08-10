import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { authEnabled, isLocalHost } from "@/lib/auth";
import { isSimpleMode, pinnedDefaultCli } from "@/lib/clis";

export const dynamic = "force-dynamic";

/** Client-facing flags: pinned agent, simple nav, local vs remote, auth. */
export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const pinned = pinnedDefaultCli();
  return NextResponse.json({
    defaultCli: pinned,
    pinned: Boolean(pinned),
    simple: isSimpleMode(),
    local: isLocalHost(host),
    authEnabled: authEnabled(),
  });
}
