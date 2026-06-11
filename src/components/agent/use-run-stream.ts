"use client";

/**
 * useRunStream — start agent runs and consume their SSE event stream as a
 * clean timeline state machine for the UI.
 */
import * as React from "react";

export type ApprovalRequest = {
  approval_id: string;
  subject_type: string;
  subject_id?: string;
  question: string;
  context: Record<string, unknown>;
  options: string[];
  resolved?: { decision: string; note?: string };
};

export type TimelineSegment =
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "tool"; name: string; input?: unknown; resultSummary?: string; isError?: boolean; done: boolean }
  | { id: string; kind: "status"; note: string }
  | { id: string; kind: "block"; blockKind: string; title?: string; payload: Record<string, unknown> }
  | { id: string; kind: "asset"; assetKind: string; url?: string; format?: string; variant?: string }
  | { id: string; kind: "approval"; approval: ApprovalRequest };

export type RunState = {
  runId?: string;
  status: "idle" | "starting" | "running" | "awaiting_approval" | "completed" | "failed" | "cancelled";
  segments: TimelineSegment[];
  liveText: string;
  thinking: string;
  pendingApprovals: ApprovalRequest[];
  summary?: string;
  costUsd?: number;
  error?: string;
};

const initialState: RunState = {
  status: "idle",
  segments: [],
  liveText: "",
  thinking: "",
  pendingApprovals: [],
};

let idCounter = 0;
const nid = () => `seg-${++idCounter}`;

export function useRunStream(opts?: {
  onDone?: (state: { status: string; summary?: string }) => void;
  onEvent?: (type: string, payload: Record<string, unknown>) => void;
}) {
  const [state, setState] = React.useState<RunState>(initialState);
  const esRef = React.useRef<EventSource | null>(null);
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  const attach = React.useCallback((runId: string) => {
    esRef.current?.close();
    const es = new EventSource(`/api/runs/${runId}/stream`);
    esRef.current = es;
    setState((s) => ({ ...s, runId, status: "running" }));

    es.onmessage = (msg) => {
      let data: { type?: string; payload?: Record<string, unknown> };
      try { data = JSON.parse(msg.data); } catch { return; }
      const type = data.type;
      const p = (data.payload ?? {}) as Record<string, unknown>;
      if (!type || type === "ping") return;
      optsRef.current?.onEvent?.(type, p);

      setState((s) => {
        const next = { ...s, segments: [...s.segments] };
        switch (type) {
          case "status": {
            const note = String(p.note ?? "");
            if (note && !note.startsWith("calling")) {
              next.segments.push({ id: nid(), kind: "status", note });
            }
            break;
          }
          case "text": {
            next.liveText = s.liveText + String(p.text ?? "");
            next.thinking = "";
            break;
          }
          case "thinking": {
            next.thinking = (s.thinking + String(p.text ?? "")).slice(-160);
            break;
          }
          case "text_block": {
            next.segments.push({ id: nid(), kind: "text", text: String(p.text ?? "") });
            next.liveText = "";
            next.thinking = "";
            break;
          }
          case "tool_call": {
            next.segments.push({
              id: String(p.tool_use_id ?? nid()),
              kind: "tool",
              name: String(p.name ?? "tool"),
              input: p.input,
              done: false,
            });
            next.liveText = "";
            break;
          }
          case "tool_result": {
            const idx = next.segments.findIndex(
              (seg) => seg.kind === "tool" && seg.id === String(p.tool_use_id)
            );
            if (idx >= 0) {
              const seg = next.segments[idx] as Extract<TimelineSegment, { kind: "tool" }>;
              next.segments[idx] = { ...seg, done: true, isError: Boolean(p.is_error), resultSummary: String(p.summary ?? "") };
            }
            break;
          }
          case "block": {
            next.segments.push({
              id: String(p.block_id ?? nid()),
              kind: "block",
              blockKind: String(p.kind ?? "markdown"),
              title: p.title ? String(p.title) : undefined,
              payload: (p.payload ?? {}) as Record<string, unknown>,
            });
            break;
          }
          case "asset": {
            next.segments.push({
              id: String(p.asset_id ?? nid()),
              kind: "asset",
              assetKind: String(p.kind ?? "image"),
              url: p.public_url ? String(p.public_url) : undefined,
              format: p.format ? String(p.format) : undefined,
              variant: p.variant_label ? String(p.variant_label) : undefined,
            });
            break;
          }
          case "approval_request": {
            const approval: ApprovalRequest = {
              approval_id: String(p.approval_id),
              subject_type: String(p.subject_type ?? "other"),
              subject_id: p.subject_id ? String(p.subject_id) : undefined,
              question: String(p.question ?? "Approve?"),
              context: (p.context ?? {}) as Record<string, unknown>,
              options: Array.isArray(p.options) ? (p.options as string[]) : ["approve", "reject"],
            };
            next.segments.push({ id: approval.approval_id, kind: "approval", approval });
            next.pendingApprovals = [...s.pendingApprovals, approval];
            next.status = "awaiting_approval";
            break;
          }
          case "approval_resolved": {
            const id = String(p.approval_id);
            next.pendingApprovals = s.pendingApprovals.filter((a) => a.approval_id !== id);
            next.segments = next.segments.map((seg) =>
              seg.kind === "approval" && seg.approval.approval_id === id
                ? { ...seg, approval: { ...seg.approval, resolved: { decision: String(p.decision ?? ""), note: p.note ? String(p.note) : undefined } } }
                : seg
            );
            if (next.status === "awaiting_approval") next.status = "running";
            break;
          }
          case "error": {
            next.error = String(p.message ?? "agent error");
            break;
          }
          case "done": {
            next.status = (String(p.status ?? "completed") as RunState["status"]) || "completed";
            next.summary = p.summary ? String(p.summary) : s.summary;
            next.costUsd = typeof p.cost_usd === "number" ? p.cost_usd : s.costUsd;
            next.liveText = "";
            next.thinking = "";
            break;
          }
        }
        return next;
      });

      if (type === "done") {
        es.close();
        optsRef.current?.onDone?.({ status: String(p.status ?? "completed"), summary: p.summary ? String(p.summary) : undefined });
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do (replay handles gaps).
    };
  }, []);

  const start = React.useCallback(
    async (body: { workflow?: string; prompt?: string; params?: Record<string, string>; threadId?: string; followUpRunId?: string }) => {
      setState({ ...initialState, status: "starting", segments: [] });
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setState((s) => ({ ...s, status: "failed", error: err.error ?? `HTTP ${res.status}` }));
        return null;
      }
      const { runId, threadId } = await res.json();
      attach(runId);
      return { runId, threadId } as { runId: string; threadId?: string };
    },
    [attach]
  );

  const decide = React.useCallback(async (approvalId: string, decision: string, note?: string) => {
    await fetch(`/api/approvals/${approvalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    });
  }, []);

  const cancel = React.useCallback(async () => {
    const runId = esRef.current ? state.runId : undefined;
    if (runId) await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
  }, [state.runId]);

  const reset = React.useCallback(() => {
    esRef.current?.close();
    setState(initialState);
  }, []);

  React.useEffect(() => () => esRef.current?.close(), []);

  const busy = state.status === "starting" || state.status === "running" || state.status === "awaiting_approval";
  return { state, start, attach, decide, cancel, reset, busy };
}
