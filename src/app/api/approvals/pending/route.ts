/** GET /api/approvals/pending — count + newest pending approval (global alerts). */
import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = await q<{ id: string; question: string; subject_type: string; created_at: string }>(
    `select id, question, subject_type, created_at from approvals
     where status = 'pending' order by created_at desc limit 5`
  );
  return NextResponse.json({ count: rows.length, newest: rows[0] ?? null, items: rows });
}
