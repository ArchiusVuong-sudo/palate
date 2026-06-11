/**
 * POST /api/knowledge — human create/update of a knowledge file.
 * Body: { path, title?, content, change_note? }
 * DELETE /api/knowledge?path=… — remove a file.
 */
import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { getActiveBrand } from "@/lib/brand";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const path = String(body.path ?? "").trim();
  const content = String(body.content ?? "");
  if (!/^[a-z0-9-_/.]+\.md$/i.test(path)) return NextResponse.json({ error: "bad path" }, { status: 400 });
  const brand = await getActiveBrand();
  const updated = await one<{ id: string; version: number }>(
    `insert into knowledge_files (brand_id, path, title, content, updated_by, change_note)
     values ($1,$2,$3,$4,'human',$5)
     on conflict (brand_id, path) do update
       set content=$4, title=coalesce($3, knowledge_files.title), version=knowledge_files.version+1,
           updated_by='human', change_note=$5, updated_at=now()
     returning id, version`,
    [brand.id, path, body.title ?? null, content, body.change_note ?? "Edited in studio"]
  );
  await q(
    `insert into knowledge_revisions (file_id, version, content, updated_by, change_note)
     values ($1,$2,$3,'human',$4)`,
    [updated!.id, updated!.version, content, body.change_note ?? "Edited in studio"]
  );
  return NextResponse.json({ ok: true, version: updated!.version });
}

export async function DELETE(req: Request) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });
  const brand = await getActiveBrand();
  await q(`delete from knowledge_files where brand_id=$1 and path=$2`, [brand.id, path]);
  return NextResponse.json({ ok: true });
}
