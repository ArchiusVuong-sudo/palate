"use client";

/**
 * CopilotPanel — persistent chat with the Palate agent. Each user message
 * starts an agent run; the live timeline renders inline, then collapses to
 * the assistant's final message when done.
 */
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUp, RotateCcw, Square } from "lucide-react";
import { useRunStream } from "@/components/agent/use-run-stream";
import { RunConsole } from "@/components/agent/run-console";
import { Button, WorkingDots } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

type HistoryMessage = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should we worry about today?",
  "Which dish is trending this week?",
  "Draft a reply to the slow-service review",
  "What have you learned about our brand?",
];

export function CopilotPanel({
  onActivity,
  prefill,
}: {
  onActivity?: () => void;
  prefill?: { prompt: string; nonce: number } | null;
}) {
  const router = useRouter();
  const [threadId, setThreadId] = React.useState<string | undefined>(undefined);
  const [history, setHistory] = React.useState<HistoryMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [activePrompt, setActivePrompt] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // "Ask Palate" handoff — prefill the composer, human reviews then sends
  React.useEffect(() => {
    if (!prefill) return;
    setInput(prefill.prompt);
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(prefill.prompt.length, prefill.prompt.length);
    }, 360); // wait for the drawer slide-in
    return () => clearTimeout(t);
  }, [prefill]);

  const { state, start, decide, cancel, busy, reset } = useRunStream({
    onDone: ({ summary }) => {
      setActivePrompt(null);
      if (summary) {
        setHistory((h) => [...h, { id: `a-${Date.now()}`, role: "assistant", content: summary }]);
      }
      reset();
      router.refresh();
      onActivity?.();
    },
  });

  // restore thread
  React.useEffect(() => {
    const saved = localStorage.getItem("palate-thread");
    if (!saved) return;
    setThreadId(saved);
    fetch(`/api/threads/${saved}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => setHistory(
        (d.messages ?? [])
          .filter((m: { content: string | null }) => m.content)
          .map((m: { id: string; role: string; content: string }) => ({ id: m.id, role: m.role, content: m.content }))
      ))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history.length, state.segments.length, state.liveText]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setActivePrompt(message);
    setHistory((h) => [...h, { id: `u-${Date.now()}`, role: "user", content: message }]);
    const res = await start({ workflow: "copilot", prompt: message, threadId });
    if (res?.threadId && res.threadId !== threadId) {
      setThreadId(res.threadId);
      localStorage.setItem("palate-thread", res.threadId);
    }
  };

  const newChat = () => {
    localStorage.removeItem("palate-thread");
    setThreadId(undefined);
    setHistory([]);
    reset();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-line shrink-0">
        <span className="dot bg-eucalyptus dot-pulse" />
        <span className="text-sm text-cream" style={{ fontFamily: "var(--font-display), serif" }}>Palate copilot</span>
        <span className="ml-auto flex items-center gap-1">
          {busy && (
            <Button variant="ghost" size="sm" onClick={() => cancel()} title="Stop">
              <Square className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={newChat} title="New conversation">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {history.length === 0 && !busy && (
          <div className="pt-6">
            <p
              className="text-xl text-cream leading-snug"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              G&apos;day. I&apos;m across your reviews,<br />
              <em className="text-gradient not-italic">what would you like to know?</em>
            </p>
            <div className="mt-5 grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs text-cream-muted rounded-xl border border-line px-3 py-2.5 hover:border-line-strong hover:text-cream hover:bg-[rgba(244,237,227,0.03)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((m) =>
          m.role === "user" ? (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[rgba(196,99,58,0.16)] border border-[rgba(196,99,58,0.28)] px-3.5 py-2.5 text-sm text-cream whitespace-pre-wrap">
                {m.content}
              </div>
            </motion.div>
          ) : (
            <div key={m.id} className="prose-palate">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            </div>
          )
        )}

        {activePrompt && (
          <div className="border-l-2 border-[rgba(111,191,148,0.4)] pl-3">
            <RunConsole state={state} onDecide={decide} dense />
          </div>
        )}
      </div>

      <div className="p-3 border-t border-line shrink-0">
        <div className={cn(
          "flex items-end gap-2 rounded-2xl border bg-[rgba(244,237,227,0.04)] p-2 transition-colors",
          busy ? "border-line" : "border-line-strong focus-within:border-[rgba(196,99,58,0.55)]"
        )}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={Math.min(4, Math.max(1, input.split("\n").length))}
            placeholder={busy ? "Agent is working…" : "Ask, instruct, or correct me…"}
            disabled={busy}
            className="flex-1 bg-transparent text-sm text-cream placeholder:text-cream-faint resize-none px-2 py-1.5 max-h-32"
          />
          <Button size="sm" onClick={() => send()} disabled={!input.trim() || busy} className="rounded-xl h-8 w-8 p-0">
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
        {busy && <div className="mt-1.5 px-1"><WorkingDots label="thinking with your data…" /></div>}
      </div>
    </div>
  );
}
