/**
 * Auth gate (Next 16 proxy — formerly middleware): the studio and its APIs
 * require the demo session cookie. The landing page stays public; the cron
 * webhook and the login endpoint are excluded.
 */
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_TOKEN } from "@/lib/auth";

const PUBLIC_API = ["/api/auth/login", "/api/auth/logout", "/api/cron"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = request.cookies.get(AUTH_COOKIE)?.value === AUTH_TOKEN;

  // already signed in → keep them out of the login page
  if (pathname === "/login") {
    if (authed) return NextResponse.redirect(new URL("/studio", request.url));
    return NextResponse.next();
  }

  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (!authed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/studio") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/studio/:path*", "/api/:path*", "/login"],
};
