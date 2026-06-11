/** GET /api/runs/active — runs currently running or awaiting approval (for the agent dock). */
import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const runs = await q<{ id: string; workflow: string; status: string; started_at: string }>(
    `select id, workflow, status, started_at from agent_runs
     where status in ('running','awaiting_approval')
     order by started_at desc limit 6`
  );
  return NextResponse.json({ runs });
}
