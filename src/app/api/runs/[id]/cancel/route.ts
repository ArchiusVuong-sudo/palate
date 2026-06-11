/** POST /api/runs/[id]/cancel — abort a running agent. */
import { NextResponse } from "next/server";
import { cancelRun } from "@/lib/agent/run";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = cancelRun(id);
  return NextResponse.json({ ok });
}
