/**
 * Password auth for remote exposure. Activates only when WEB_AUTH_PASSWORD is
 * set — local single-user usage stays zero-config.
 *
 * Cookie: HttpOnly signed session `co_session=<exp>.<hmac>` (HMAC-SHA256 over
 * `exp` with WEB_AUTH_SECRET). Long-lived (30 days) so a friend logs in rarely.
 *
 * Uses Web Crypto so the same helpers work in the Edge proxy and Node routes.
 */

export const SESSION_COOKIE = "co_session";
const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 30 * DAY_MS;

export function authEnabled(): boolean {
  return Boolean(process.env.WEB_AUTH_PASSWORD?.trim());
}

function authSecret(): string {
  const secret = process.env.WEB_AUTH_SECRET?.trim();
  if (secret) return secret;
  // Convenience fallback so a one-var setup still signs cookies. Prefer setting
  // WEB_AUTH_SECRET explicitly in any shared/remote deployment.
  return `career-ops-web:${process.env.WEB_AUTH_PASSWORD || ""}`;
}

function expectedPassword(): string {
  return process.env.WEB_AUTH_PASSWORD?.trim() || "";
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const expected = expectedPassword();
  if (!expected) return false;
  return timingSafeEqual(password, expected);
}

export async function mintSessionCookieValue(now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_TTL_MS);
  const sig = await hmacHex(exp);
  return `${exp}.${sig}`;
}

export async function verifySessionCookieValue(value: string | undefined | null, now = Date.now()): Promise<boolean> {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const exp = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!/^\d+$/.test(exp) || !/^[0-9a-f]+$/i.test(sig)) return false;
  if (Number(exp) < now) return false;
  const expected = await hmacHex(exp);
  return timingSafeEqual(sig.toLowerCase(), expected.toLowerCase());
}

export function sessionCookieOptions(maxAgeSec = Math.floor(SESSION_TTL_MS / 1000)) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

/** True when the request is from the host machine (Apply's headed Chrome works). */
export function isLocalHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

// ─── In-memory login rate limit (per-process; fine for a single host) ────────
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function rateLimitLogin(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cur = attempts.get(ip);
  if (!cur || cur.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  cur.count += 1;
  if (cur.count > MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.ceil((cur.resetAt - now) / 1000) };
  }
  return { ok: true };
}

export function clearLoginAttempts(ip: string) {
  attempts.delete(ip);
}
