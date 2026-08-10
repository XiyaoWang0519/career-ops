import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, verifySessionCookieValue } from "@/lib/auth";

/**
 * Request interceptor: when WEB_AUTH_PASSWORD is set, every page and API route
 * needs a valid signed session cookie. Unauthenticated browser hits → /login;
 * unauthenticated API hits → 401. Auth off → zero-config local use.
 */
export async function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";
  const isLoginApi = pathname === "/api/auth/login";
  const isPublicAsset =
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff2?)$/i.test(pathname);

  if (isLoginApi || isPublicAsset) return NextResponse.next();

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySessionCookieValue(cookie);

  if (ok) {
    // Already signed in — keep /login from being a dead-end.
    if (isLoginPage) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/";
      dest.search = "";
      return NextResponse.redirect(dest);
    }
    return NextResponse.next();
  }

  if (isLoginPage) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  const next = pathname + request.nextUrl.search;
  if (next && next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
