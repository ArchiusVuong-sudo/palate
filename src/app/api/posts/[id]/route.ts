/** POST /api/posts/[id] — human-driven post updates (status, schedule). */
import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";

export const runtime = "nodejs";
const STATUSES = ["draft", "in_review", "changes_requested", "approved", "scheduled", "published"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const post = await one<{ id: string }>(`select id from posts where id=$1`, [id]);
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

  const cols: string[] = ["updated_at = now()"];
  const vals: unknown[] = [id];
  if (body.status) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
    vals.push(body.status); cols.push(`status = $${vals.length}`);
    if (body.status === "published") cols.push("published_at = now()");
  }
  if (body.scheduled_at !== undefined) { vals.push(body.scheduled_at); cols.push(`scheduled_at = $${vals.length}`); }
  if (body.caption !== undefined) { vals.push(String(body.caption)); cols.push(`caption = $${vals.length}`); }
  await q(`update posts set ${cols.join(", ")} where id=$1`, vals);
  return NextResponse.json({ ok: true });
}
