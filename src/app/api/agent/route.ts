/**
 * POST /api/agent — start an agent run.
 * Body: { workflow, prompt?, params?, threadId?, newThread? }
 * Returns { runId, threadId? } immediately; stream events from /api/runs/[id]/stream.
 */
import { NextResponse } from "next/server";
import { startAgentRun } from "@/lib/agent/run";
import { missionPrompt } from "@/lib/agent/workflows";
import type { Workflow } from "@/lib/agent/system";
import { getActiveBrand } from "@/lib/brand";
import { one, q } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel hobby ceiling

const WORKFLOWS: Workflow[] = ["listening", "briefing", "creative", "review", "copilot", "pipeline", "connect"];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const workflow = (body.workflow ?? "copilot") as Workflow;
  if (!WORKFLOWS.includes(workflow)) {
    return NextResponse.json({ error: `unknown workflow ${workflow}` }, { status: 400 });
  }

  // the connection wizard drives a local Chrome window — meaningless on a server
  if (workflow === "connect" && process.env.VERCEL) {
    return NextResponse.json(
      { error: "The connection wizard opens a Chrome window on your machine — run Palate locally to use it." },
      { status: 400 }
    );
  }

  // Follow-up on a finished run — same SDK session, full context retained.
  if (body.followUpRunId) {
    const prev = await one<{ session_id: string | null; workflow: Workflow; status: string }>(
      `select session_id, workflow, status from agent_runs where id=$1`, [body.followUpRunId]);
    if (!prev) return NextResponse.json({ error: "run not found" }, { status: 404 });
    const userMessage = String(body.prompt ?? "").trim();
    if (!userMessage) return NextResponse.json({ error: "prompt required for a follow-up" }, { status: 400 });
    const { runId } = await startAgentRun({
      workflow: prev.workflow,
      prompt: userMessage,
      trigger: "manual",
      resumeSessionId: prev.session_id ?? undefined,
    });
    return NextResponse.json({ runId, workflow: prev.workflow });
  }

  let threadId: string | undefined = body.threadId;
  let resumeSessionId: string | undefined;
  let prompt: string;

  if (workflow === "copilot") {
    const userMessage = String(body.prompt ?? "").trim();
    if (!userMessage) return NextResponse.json({ error: "prompt required for copilot" }, { status: 400 });
    const brand = await getActiveBrand();
    if (!threadId) {
      const t = await one<{ id: string }>(
        `insert into chat_threads (brand_id, title) values ($1, $2) returning id`,
        [brand.id, userMessage.slice(0, 80)]
      );
      threadId = t!.id;
    } else {
      const t = await one<{ session_id: string | null }>(
        `select session_id from chat_threads where id=$1`, [threadId]);
      resumeSessionId = t?.session_id ?? undefined;
    }
    await q(`insert into chat_messages (thread_id, role, content) values ($1,'user',$2)`, [threadId, userMessage]);
    prompt = userMessage;
  } else {
    prompt = body.prompt?.trim() || missionPrompt(workflow, body.params ?? {});
  }

  const { runId } = await startAgentRun({
    workflow,
    prompt,
    trigger: workflow === "copilot" ? "chat" : "manual",
    threadId,
    resumeSessionId,
  });

  return NextResponse.json({ runId, threadId });
}
