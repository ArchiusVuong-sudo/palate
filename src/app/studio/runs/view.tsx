"use client";

/**
 * Agent runs — audit/ops view. Summary metrics, live runs you can watch
 * streaming, and an expandable card per historical run.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Activity, ChevronDown, Eye, Timer } from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, SectionTitle } from "@/components/ui/primitives";
import { HoverDetail, HoverRow } from "@/components/ui/hover-detail";
import { LazySentinel, ShowMoreButton } from "@/components/ui/lazy-list";
import { usePaged } from "@/components/ui/use-paged";
import { MetricCard } from "@/components/charts/charts";
import { RunConsole } from "@/components/agent/run-console";
import { useRunStream } from "@/components/agent/use-run-stream";
import type { AgentRun } from "@/lib/queries";
import { cn, fmtDateTime, fmtUsd, timeAgo } from "@/lib/format";

export type RunRow = AgentRun & { prompt: string | null };

type BadgeTone = "neutral" | "good" | "bad" | "warn" | "info" | "accent" | "agent";

const WORKFLOW_TONE: Record<string, BadgeTone> = {
  listening: "info",
  briefing: "accent",
  creative: "agent",
  review: "warn",
  pipeline: "neutral",
  copilot: "neutral",
};

const LIVE_STATUSES = new Set(["running", "awaiting_approval", "starting"]);

function StatusBadge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ");
  if (status === "completed") return <Badge tone="good">completed</Badge>;
  if (status === "failed") return <Badge tone="bad">failed</Badge>;
  if (status === "cancelled") return <Badge tone="neutral">cancelled</Badge>;
  if (LIVE_STATUSES.has(status))
    return (
      <Badge tone="warn">
        <span className="dot bg-warn dot-pulse" />
        {label}
      </Badge>
    );
  return <Badge tone="neutral">{label}</Badge>;
}

function fmtDuration(start: string, end: string | null): string | null {
  if (!end) return null;
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (s < 120) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export function RunsView({ runs }: { runs: RunRow[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [watching, setWatching] = React.useState<RunRow | null>(null);
  const { state, attach, decide, reset } = useRunStream({ onDone: () => router.refresh() });

  const live = runs.filter((r) => LIVE_STATUSES.has(r.status));
  const history = runs.filter((r) => !LIVE_STATUSES.has(r.status));
  /* live runs stay pinned above — only the history list pages */
  const pagedHistory = usePaged(history, 10, "");

  const totalSpend = runs.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const finished = runs.filter((r) => ["completed", "failed", "cancelled"].includes(r.status));
  const successRate = finished.length
    ? Math.round((100 * finished.filter((r) => r.status === "completed").length) / finished.length)
    : null;
  const avgTurns = runs.length
    ? Math.round((runs.reduce((s, r) => s + Number(r.turns || 0), 0) / runs.length) * 10) / 10
    : 0;

  const watch = (run: RunRow) => {
    setWatching(run);
    attach(run.id);
  };
  const closeWatch = () => {
    reset();
    setWatching(null);
  };

  return (
    <div>
      <SectionTitle
        title="Agent runs"
        subtitle="Every run, every tool call, fully audited"
        right={<Badge tone="neutral">{runs.length} runs</Badge>}
      />

      {/* ───── summary strip ───── */}
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total runs" value={runs.length} caption="across all workflows" index={0} />
        <MetricCard label="Total spend" value={fmtUsd(totalSpend)} caption="all time" index={1} />
        <MetricCard
          label="Success rate"
          value={successRate ?? "—"}
          suffix={successRate === null ? undefined : "%"}
          tone={successRate === null ? "neutral" : successRate >= 70 ? "good" : successRate >= 40 ? "neutral" : "bad"}
          caption="of finished runs"
          index={2}
        />
        <MetricCard label="Avg turns" value={avgTurns} caption="per run" index={3} />
      </div>

      {/* ───── live runs ───── */}
      {live.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-cream-faint flex items-center gap-2">
            <span className="dot bg-warn dot-pulse" /> live now
          </p>
          {live.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative"
            >
              <div
                aria-hidden
                className="absolute inset-0 rounded-2xl border-2 border-[rgba(232,185,79,0.45)] animate-pulse pointer-events-none"
              />
              <Card className="p-4 sm:p-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge tone={WORKFLOW_TONE[r.workflow] ?? "neutral"}>{r.workflow}</Badge>
                  <StatusBadge status={r.status} />
                  <p className="text-sm text-cream-muted line-clamp-1 flex-1 min-w-[200px]">
                    {r.summary ?? r.prompt ?? "Agent working…"}
                  </p>
                  <span className="text-[11px] text-cream-faint">{timeAgo(r.started_at)}</span>
                  <Button size="sm" variant="outline" onClick={() => watch(r)}>
                    <Eye className="h-3.5 w-3.5" /> Watch
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ───── run history ───── */}
      <div className="mt-6 grid grid-cols-1 gap-3">
        {history.length === 0 && live.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Activity />}
              title="No agent runs yet"
              hint="Kick off a listening sweep or the full pipeline from the studio pages — every run lands here with a complete audit trail."
            />
          </Card>
        ) : (
          pagedHistory.visible.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.05 }}
            >
              <RunCard run={r} expanded={expanded === r.id} onToggle={() => setExpanded(expanded === r.id ? null : r.id)} />
            </motion.div>
          ))
        )}
      </div>
      <ShowMoreButton
        className="mt-4"
        remaining={pagedHistory.remaining}
        onClick={pagedHistory.showMore}
        label={`Show ${Math.min(pagedHistory.remaining, 10)} more`}
      />
      <LazySentinel onVisible={pagedHistory.showMore} disabled={!pagedHistory.hasMore} />

      {/* ───── watch modal ───── */}
      <Modal open={watching !== null} onClose={closeWatch} wide>
        {watching && (
          <div className="p-5 h-[72vh] flex flex-col">
            <div className="flex items-center gap-3 pb-4 border-b border-line mb-4 shrink-0">
              <Badge tone={WORKFLOW_TONE[watching.workflow] ?? "neutral"}>{watching.workflow}</Badge>
              <StatusBadge status={state.status === "idle" ? watching.status : state.status} />
              <span className="font-mono text-[10px] text-cream-faint truncate">{watching.id}</span>
              <span className="ml-auto text-[11px] text-cream-faint shrink-0">started {timeAgo(watching.started_at)}</span>
            </div>
            <RunConsole state={state} onDecide={decide} className="flex-1" />
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ───── single historical run card ───── */

function RunCard({ run, expanded, onToggle }: { run: RunRow; expanded: boolean; onToggle: () => void }) {
  const dur = fmtDuration(run.started_at, run.finished_at);
  return (
    <HoverDetail
      side="left"
      width={380}
      content={
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={WORKFLOW_TONE[run.workflow] ?? "neutral"}>{run.workflow}</Badge>
            <StatusBadge status={run.status} />
          </div>
          {(run.summary ?? run.prompt) && (
            <p className="mt-2 text-[11px] leading-relaxed text-cream-muted whitespace-pre-wrap line-clamp-6">
              {run.summary ?? run.prompt}
            </p>
          )}
          <div className="mt-2 border-t border-line/60 pt-2">
            <HoverRow label="model">{run.model ?? "—"}</HoverRow>
            <HoverRow label="turns">{run.turns}</HoverRow>
            <HoverRow label="cost">{fmtUsd(run.cost_usd)}</HoverRow>
            <HoverRow label="duration">{dur ?? "—"}</HoverRow>
            <HoverRow label="started">{fmtDateTime(run.started_at)}</HoverRow>
          </div>
        </div>
      }
    >
    <Card hover className="overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Badge tone={WORKFLOW_TONE[run.workflow] ?? "neutral"}>{run.workflow}</Badge>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-sm text-cream-muted leading-relaxed line-clamp-2 flex-1 min-w-[180px]">
            {run.summary ?? run.prompt ?? "No summary recorded"}
          </p>
          <ChevronDown
            className={cn("h-4 w-4 text-cream-faint shrink-0 mt-0.5 transition-transform", expanded && "rotate-180")}
          />
        </div>
        <div className="mt-3 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[11px] text-cream-faint">
          <span className="font-mono rounded-md border border-line bg-[rgba(244,237,227,0.04)] px-2 py-0.5 text-[10px] text-cream-muted">
            {run.model ?? "—"}
          </span>
          <span className="font-mono">{run.turns} turns</span>
          <span className="font-mono text-amber/80">{fmtUsd(run.cost_usd)}</span>
          {dur && (
            <span className="font-mono inline-flex items-center gap-1">
              <Timer className="h-3 w-3" /> {dur}
            </span>
          )}
          <span className="ml-auto">{timeAgo(run.started_at)}</span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.21, 0.8, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 pt-4 border-t border-line grid grid-cols-1 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-cream-faint mb-1.5">Run summary</p>
                {run.summary ? (
                  <div className="prose-palate">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.summary}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs text-cream-faint">No summary was recorded for this run.</p>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-cream-faint mb-1.5">Mission prompt</p>
                {run.prompt ? (
                  <pre className="font-mono text-[11px] leading-relaxed text-cream-muted whitespace-pre-wrap bg-[rgba(0,0,0,0.3)] border border-line rounded-xl p-3 max-h-64 overflow-y-auto">
                    {run.prompt}
                  </pre>
                ) : (
                  <p className="text-xs text-cream-faint">No prompt stored.</p>
                )}
              </div>
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-cream-faint border-t border-line pt-3">
                <span className="font-mono">{run.id}</span>
                <Badge tone="neutral">{run.trigger}</Badge>
                <span>started {fmtDateTime(run.started_at)}</span>
                {run.finished_at && <span>finished {fmtDateTime(run.finished_at)}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
    </HoverDetail>
  );
}
