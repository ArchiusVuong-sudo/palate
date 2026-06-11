/**
 * POST /api/actions/[id] — decide a proposed action.
 * Body: { status: "approved"|"dismissed"|"done" }
 * Approving a create_brief action auto-starts the briefing agent.
 */
import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { startAgentRun } from "@/lib/agent/run";
import { missionPrompt } from "@/lib/agent/workflows";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? "");
  if (!["approved", "dismissed", "done"].includes(status)) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  const action = await one<{ id: string; kind: string; title: string; rationale: string | null }>(
    `update proposed_actions set status=$2, decided_at=now() where id=$1 returning id, kind, title, rationale`,
    [id, status]
  );
  if (!action) return NextResponse.json({ error: "not found" }, { status: 404 });

  let runId: string | undefined;
  if (status === "approved" && action.kind === "create_brief") {
    const started = await startAgentRun({
      workflow: "briefing",
      prompt: missionPrompt("briefing", { focus: `${action.title} — ${action.rationale ?? ""}` }),
      trigger: "manual",
    });
    runId = started.runId;
  }
  return NextResponse.json({ ok: true, runId });
}
