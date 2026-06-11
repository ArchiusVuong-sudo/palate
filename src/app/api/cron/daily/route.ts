/**
 * POST/GET /api/cron/daily — scheduled morning trigger (Vercel cron, launchd,
 * or curl). Syncs fresh items then starts the listening sweep; pass
 * ?pipeline=1 to run the whole daily cycle instead.
 */
import { NextResponse } from "next/server";
import { startAgentRun } from "@/lib/agent/run";
import { missionPrompt } from "@/lib/agent/workflows";

export const runtime = "nodejs";
export const maxDuration = 800;

async function trigger(req: Request) {
  const url = new URL(req.url);
  const pipeline = url.searchParams.get("pipeline") === "1";
  // Drip in fresh demo items first (real deployments: connector polls here).
  await fetch(new URL("/api/ingest", url.origin), { method: "POST" }).catch(() => {});
  const workflow = pipeline ? "pipeline" : "listening";
  const { runId } = await startAgentRun({
    workflow,
    prompt: missionPrompt(workflow),
    trigger: "cron",
  });
  return NextResponse.json({ ok: true, runId, workflow });
}

export async function POST(req: Request) { return trigger(req); }
export async function GET(req: Request) { return trigger(req); }
