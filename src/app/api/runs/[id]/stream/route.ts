/**
 * GET /api/runs/[id]/stream?after=N — SSE stream of run events.
 * Replays persisted agent_events with seq > after, then attaches live.
 */
import { q, one } from "@/lib/db";
import { runBus, type RunEvent } from "@/lib/agent/bridge";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel hobby ceiling

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: runId } = await params;
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { closed = true; }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      };

      // 1. Replay persisted events
      const replay = await q<{ seq: number; type: string; payload: Record<string, unknown>; created_at: string }>(
        `select seq, type, payload, created_at from agent_events where run_id=$1 and seq > $2 order by seq`,
        [runId, after]
      );
      for (const e of replay) {
        send({ runId, seq: e.seq, type: e.type, payload: e.payload, at: e.created_at, replay: true });
      }

      // 2. If the run is already finished, send done and close.
      const run = await one<{ status: string; summary: string | null; cost_usd: number }>(
        `select status, summary, cost_usd from agent_runs where id=$1`, [runId]);
      if (!run) { send({ type: "error", payload: { message: "run not found" } }); finish(); return; }
      if (["completed", "failed", "cancelled"].includes(run.status)) {
        send({ type: "done", payload: { status: run.status, summary: run.summary, cost_usd: run.cost_usd }, replay: true });
        finish();
        return;
      }

      // 3. Live subscription
      unsubscribe = runBus.subscribe(runId, (e: RunEvent) => {
        send(e);
        if (e.type === "done") finish();
      });
      heartbeat = setInterval(() => send({ type: "ping" }), 15_000);

      req.signal.addEventListener("abort", finish);
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
