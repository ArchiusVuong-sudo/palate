/**
 * GET /api/knowledge/revisions?fileId=<uuid> — version history for one knowledge file.
 * Returns { revisions: [{ version, content, updated_by, change_note, created_at }] }
 * ordered newest first, capped at 20.
 */
import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const fileId = new URL(req.url).searchParams.get("fileId") ?? "";
  if (!UUID_RE.test(fileId)) {
    return NextResponse.json({ error: "fileId (uuid) required" }, { status: 400 });
  }
  const revisions = await q<{
    version: number;
    content: string;
    updated_by: string;
    change_note: string | null;
    created_at: string;
  }>(
    `select version, content, coalesce(updated_by, 'human') as updated_by, change_note, created_at
     from knowledge_revisions
     where file_id = $1
     order by version desc
     limit 20`,
    [fileId]
  );
  return NextResponse.json({ revisions });
}
