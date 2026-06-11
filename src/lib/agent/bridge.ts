/**
 * In-process bridges between the agent runtime and the web UI:
 *  - RunBus: per-run event stream (SSE subscribers attach here; events also
 *    persist to agent_events for replay/audit).
 *  - ApprovalBridge: lets a running agent block on a human decision. The
 *    request_approval tool awaits a promise; the /api/approvals/[id] route
 *    resolves it when the human decides.
 */
import { EventEmitter } from "node:events";
import { q } from "@/lib/db";

export type RunEvent = {
  runId: string;
  seq: number;
  type:
    | "status"
    | "text"
    | "text_block"
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "block"
    | "asset"
    | "approval_request"
    | "approval_resolved"
    | "error"
    | "done";
  payload: Record<string, unknown>;
  at: string;
};

class RunBusImpl {
  private emitter = new EventEmitter();
  private seqs = new Map<string, number>();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  nextSeq(runId: string): number {
    const n = (this.seqs.get(runId) ?? 0) + 1;
    this.seqs.set(runId, n);
    return n;
  }

  /** Emit to live subscribers AND persist to DB (fire-and-forget). */
  emit(runId: string, type: RunEvent["type"], payload: Record<string, unknown>): RunEvent {
    const event: RunEvent = {
      runId,
      seq: this.nextSeq(runId),
      type,
      payload,
      at: new Date().toISOString(),
    };
    this.emitter.emit(`run:${runId}`, event);
    // Texts deltas are too chatty to persist row-per-delta; batch text into
    // larger chunks at the run layer. Everything else persists immediately.
    if (type !== "text" && type !== "thinking") {
      q(
        `insert into agent_events (run_id, seq, type, payload) values ($1,$2,$3,$4)`,
        [runId, event.seq, type, JSON.stringify(payload)]
      ).catch(() => {});
    }
    return event;
  }

  subscribe(runId: string, fn: (e: RunEvent) => void): () => void {
    const key = `run:${runId}`;
    this.emitter.on(key, fn);
    return () => this.emitter.off(key, fn);
  }
}

export type PendingApproval = {
  id: string;
  runId: string;
  resolve: (decision: { decision: string; note?: string }) => void;
};

class ApprovalBridgeImpl {
  private pending = new Map<string, PendingApproval>();

  register(id: string, runId: string): Promise<{ decision: string; note?: string }> {
    return new Promise((resolve) => {
      this.pending.set(id, { id, runId, resolve });
    });
  }

  /** Resolve a pending approval; returns true if a live waiter was found. */
  resolve(id: string, decision: string, note?: string): boolean {
    const p = this.pending.get(id);
    if (!p) return false;
    this.pending.delete(id);
    p.resolve({ decision, note });
    return true;
  }

  has(id: string): boolean {
    return this.pending.has(id);
  }
}

// Survive Next.js dev HMR by stashing on globalThis.
declare global {
  // eslint-disable-next-line no-var
  var __palateRunBus: RunBusImpl | undefined;
  // eslint-disable-next-line no-var
  var __palateApprovals: ApprovalBridgeImpl | undefined;
}

export const runBus: RunBusImpl = global.__palateRunBus ?? new RunBusImpl();
export const approvalBridge: ApprovalBridgeImpl = global.__palateApprovals ?? new ApprovalBridgeImpl();
global.__palateRunBus = runBus;
global.__palateApprovals = approvalBridge;
