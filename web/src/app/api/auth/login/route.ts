import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authEnabled,
  clearLoginAttempts,
  mintSessionCookieValue,
  rateLimitLogin,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  if (!authEnabled()) {
    return NextResponse.json({ error: "auth disabled" }, { status: 400 });
  }

  const ip = clientIp(req);
  const limited = rateLimitLogin(ip);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes." },
      { status: 429, headers: limited.retryAfterSec ? { "Retry-After": String(limited.retryAfterSec) } : undefined },
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  clearLoginAttempts(ip);
  const value = await mintSessionCookieValue();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, value, sessionCookieOptions());
  return res;
}
