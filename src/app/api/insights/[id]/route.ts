/** POST /api/insights/[id] — acknowledge / action an insight. */
import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? "acknowledged");
  if (!["new", "acknowledged", "actioned"].includes(status)) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  await q(`update insights set status=$2 where id=$1`, [id, status]);
  return NextResponse.json({ ok: true });
}
