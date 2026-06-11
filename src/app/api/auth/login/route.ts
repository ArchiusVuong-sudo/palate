/** POST /api/auth/login — demo credential check, sets the session cookie. */
import { NextResponse } from "next/server";
import { AUTH_USER, AUTH_PASS, AUTH_COOKIE, AUTH_TOKEN } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (email !== AUTH_USER.toLowerCase() || password !== AUTH_PASS) {
    return NextResponse.json({ error: "That email/password combination doesn't match." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, AUTH_TOKEN, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
