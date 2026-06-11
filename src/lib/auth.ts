/**
 * Demo authentication — a single hard-coded team login (override via env).
 * This is intentionally simple for the take-home: one shared credential,
 * an opaque httpOnly session cookie, and a proxy gate in front of the studio.
 */
export const AUTH_USER = process.env.AUTH_USER ?? "owner@marlowandsage.com";
export const AUTH_PASS = process.env.AUTH_PASS ?? "palate2026";

export const AUTH_COOKIE = "palate_session";
// opaque static session token — rotating it logs everyone out
export const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "palate-demo-session-v1-7f3a";

export function isValidSession(cookieValue: string | undefined): boolean {
  return cookieValue === AUTH_TOKEN;
}
