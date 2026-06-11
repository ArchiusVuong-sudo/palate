"use client";

/**
 * AgentDock — floating live-run widget. Shows active agent runs anywhere in
 * the studio; expand to watch the stream and answer approval cards inline.
 * Also raises global "agent needs you" alerts (toast + title badge).
 */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, MessageSquareWarning, Radio, X } from "lucide-react";
import { useRunStream } from "@/components/agent/use-run-stream";
import { RunConsole } from "@/components/agent/run-console";
import { fireConfetti } from "@/components/ui/confetti";
import { cn } from "@/lib/format";

type ActiveRun = { id: string; workflow: string; status: string; started_at: string };

export function AgentDock() {
  const router = useRouter();
  const [runs, setRuns] = React.useState<ActiveRun[]>([]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const lastAlertRef = React.useRef<string | null>(null);
  const { state, attach, decide, reset } = useRunStream({
    onDone: ({ status }) => {
      router.refresh();
      if (status === "completed") fireConfetti(90, window.innerHeight - 90);
    },
  });

  // follow-up on the expanded (finished) run — resumes the same SDK session
  const followUp = React.useCallback(async (text: string) => {
    if (!expandedId) return;
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followUpRunId: expandedId, prompt: text }),
    });
    if (!res.ok) {
      toast.error("Couldn't start the follow-up run");
      return;
    }
    const { runId, workflow } = await res.json();
    window.dispatchEvent(new CustomEvent("palate:run-started", {
      detail: { runId, workflow: workflow ?? runs.find((r) => r.id === expandedId)?.workflow ?? "copilot" },
    }));
  }, [expandedId, runs]);

  // poll active runs + pending approvals
  React.useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const [runsRes, apprRes] = await Promise.all([
          fetch("/api/runs/active").then((r) => r.json()),
          fetch("/api/approvals/pending").then((r) => r.json()),
        ]);
        if (!alive) return;
        setRuns(runsRes.runs ?? []);

        const pending = apprRes.count ?? 0;
        document.title = pending > 0
          ? `(${pending}) Palate — decision needed`
          : "Palate — AI marketing studio for restaurants";
        const newestId = apprRes.newest?.id ?? null;
        if (newestId && newestId !== lastAlertRef.current) {
          if (lastAlertRef.current !== null) {
            toast(`Agent needs a decision`, {
              description: String(apprRes.newest.question ?? "").slice(0, 110),
              icon: <MessageSquareWarning className="h-4 w-4 text-amber" />,
              duration: 12000,
              action: { label: "Review", onClick: () => router.push("/studio/review") },
            });
          }
          lastAlertRef.current = newestId;
        }
        if (pending === 0) lastAlertRef.current = lastAlertRef.current ?? null;
      } catch { /* offline — ignore */ }
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => { alive = false; clearInterval(interval); };
  }, [router]);

  // instant pickup of palette-launched runs
  React.useEffect(() => {
    const onStart = (e: Event) => {
      const { runId, workflow } = (e as CustomEvent).detail ?? {};
      if (!runId) return;
      setDismissed(false);
      setRuns((r) => [{ id: runId, workflow, status: "running", started_at: new Date().toISOString() }, ...r.filter((x) => x.id !== runId)]);
      setExpandedId(runId);
      reset();
      attach(runId);
    };
    window.addEventListener("palate:run-started", onStart);
    return () => window.removeEventListener("palate:run-started", onStart);
  }, [attach, reset]);

  const expand = (runId: string) => {
    setExpandedId(runId);
    reset();
    attach(runId);
  };
  const collapse = () => setExpandedId(null);

  const awaiting = runs.some((r) => r.status === "awaiting_approval");
  const showPill = (runs.length > 0 || expandedId) && !dismissed;
  if (!showPill) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[70]">
      <AnimatePresence mode="popLayout">
        {expandedId ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.21, 0.8, 0.32, 1] }}
            className="glass rounded-2xl w-[400px] h-[480px] flex flex-col overflow-hidden border-line-strong shadow-2xl"
          >
            <div className="flex items-center gap-2 px-3.5 h-11 border-b border-line shrink-0">
              <Radio className={cn("h-3.5 w-3.5", state.status === "awaiting_approval" ? "text-amber" : "text-eucalyptus")} />
              <span className="text-xs text-cream font-medium">
                {runs.find((r) => r.id === expandedId)?.workflow ?? "agent"} run
              </span>
              <span className={cn(
                "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border",
                state.status === "awaiting_approval"
                  ? "text-amber border-[rgba(232,160,98,0.4)] bg-[rgba(196,99,58,0.1)]"
                  : state.status === "completed"
                    ? "text-good border-[rgba(90,212,142,0.3)]"
                    : "text-eucalyptus border-[rgba(111,191,148,0.3)]"
              )}>
                {state.status === "idle" ? "connecting" : state.status.replaceAll("_", " ")}
              </span>
              <button onClick={collapse} className="ml-auto p-1 text-cream-faint hover:text-cream rounded-lg hover:bg-[rgba(244,237,227,0.06)]">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-3.5">
              <RunConsole
                state={state}
                onDecide={decide}
                dense
                className="h-full"
                onFollowUp={["completed", "failed", "cancelled"].includes(state.status) ? followUp : undefined}
              />
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="pill"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={() => runs[0] && expand(runs[0].id)}
            className={cn(
              "glass glass-hover rounded-full pl-3.5 pr-2 h-11 flex items-center gap-2.5 shadow-2xl",
              awaiting && "accent-ring"
            )}
          >
            <span className={cn("dot dot-pulse", awaiting ? "bg-amber" : "bg-eucalyptus")} />
            <span className="text-xs text-cream">
              {awaiting ? "Agent needs you" : `${runs.length} agent run${runs.length > 1 ? "s" : ""} live`}
            </span>
            <span className="flex gap-1">
              {runs.slice(0, 3).map((r) => (
                <span key={r.id} className="rounded-full bg-[rgba(244,237,227,0.07)] border border-line px-2 py-0.5 text-[9px] uppercase tracking-wider text-cream-muted">
                  {r.workflow}
                </span>
              ))}
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
              className="p-1 rounded-full text-cream-faint hover:text-cream hover:bg-[rgba(244,237,227,0.08)]"
            >
              <X className="h-3 w-3" />
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
