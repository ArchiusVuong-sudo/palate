/**
 * POST /api/approvals/[id] — human decision on a pending approval.
 * Body: { decision: string, note?: string }
 * Resolves the in-process waiter so the blocked agent tool continues.
 */
import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { approvalBridge, runBus } from "@/lib/agent/bridge";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = String(body.decision ?? "").trim();
  const note = body.note ? String(body.note).slice(0, 1000) : undefined;
  if (!decision) return NextResponse.json({ error: "decision required" }, { status: 400 });

  const approval = await one<{ id: string; status: string; run_id: string | null; options: string[] }>(
    `select id, status, run_id, options from approvals where id=$1`, [id]);
  if (!approval) return NextResponse.json({ error: "approval not found" }, { status: 404 });
  if (approval.status !== "pending") {
    return NextResponse.json({ error: `approval already ${approval.status}` }, { status: 409 });
  }

  const normalized = decision.toLowerCase();
  const status = normalized.includes("approve") ? "approved" : normalized.includes("reject") ? "rejected" : "approved";
  await q(
    `update approvals set status=$2, decision=$3, note=$4, decided_by='human', decided_at=now() where id=$1`,
    [id, status, decision, note ?? null]
  );

  const resolvedLive = approvalBridge.resolve(id, decision, note);
  if (!resolvedLive && approval.run_id) {
    runBus.emit(approval.run_id, "approval_resolved", { approval_id: id, decision, note, late: true });
  }

  return NextResponse.json({ ok: true, decision, live: resolvedLive });
}
