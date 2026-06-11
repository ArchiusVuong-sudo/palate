"use client";

/**
 * RunConsole — live agent activity: streaming prose, tool timeline,
 * inline canvas blocks, generated assets, and human approval cards.
 */
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2, ChevronDown, CircleDashed, CornerDownLeft, Database, FileText, Image as ImageIcon,
  Mail, MessageSquareWarning, Search, Sparkles, Video, Wrench, XCircle, BookOpen, BarChart3,
} from "lucide-react";
import type { RunState, TimelineSegment, ApprovalRequest } from "@/components/agent/use-run-stream";
import { BlockRenderer, type CanvasBlock } from "@/components/blocks/block-renderer";
import { Badge, Button, WorkingDots } from "@/components/ui/primitives";
import { fireConfetti } from "@/components/ui/confetti";
import { cn, fmtUsd } from "@/lib/format";

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  db_query: Database, list_social_items: Search, update_social_item: Wrench,
  save_insight: Sparkles, propose_action: Sparkles,
  save_brief: FileText, update_brief: FileText,
  knowledge_list: BookOpen, knowledge_read: BookOpen, knowledge_write: BookOpen, knowledge_append: BookOpen,
  push_block: BarChart3, request_approval: MessageSquareWarning, send_email: Mail,
  generate_image: ImageIcon, edit_image: ImageIcon, annotate_image: ImageIcon,
  generate_video: Video, save_caption: FileText,
  save_review: CheckCircle2, save_post: FileText, update_post: FileText,
  WebSearch: Search, WebFetch: Search,
};

const TOOL_LABELS: Record<string, string> = {
  db_query: "Querying data", list_social_items: "Reading social inbox", update_social_item: "Tagging item",
  save_insight: "Saving insight", propose_action: "Proposing action",
  save_brief: "Writing brief", update_brief: "Updating brief",
  knowledge_list: "Browsing knowledge", knowledge_read: "Reading knowledge", knowledge_write: "Updating knowledge", knowledge_append: "Recording lesson",
  push_block: "Publishing chart", request_approval: "Asking for your decision", send_email: "Sending email",
  generate_image: "Generating image", edit_image: "Retouching image", annotate_image: "Annotating image",
  generate_video: "Rendering video", save_caption: "Saving caption",
  save_review: "Saving review", save_post: "Assembling post", update_post: "Updating post",
  WebSearch: "Searching the web", WebFetch: "Reading a page",
};

export function RunConsole({
  state,
  onDecide,
  className,
  dense,
  onFollowUp,
}: {
  state: RunState;
  onDecide: (approvalId: string, decision: string, note?: string) => Promise<void> | void;
  className?: string;
  dense?: boolean;
  /** When set, a follow-up composer appears once the run finishes — the next run resumes this session. */
  onFollowUp?: (text: string) => Promise<void> | void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = React.useState(true);

  React.useEffect(() => {
    if (pinned && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.segments.length, state.liveText, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5"
      >
        <AnimatePresence initial={false}>
          {state.segments.map((seg) => (
            <motion.div
              key={seg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Segment seg={seg} onDecide={onDecide} dense={dense} />
            </motion.div>
          ))}
        </AnimatePresence>

        {state.liveText && (
          <div className="prose-palate stream-caret">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.liveText}</ReactMarkdown>
          </div>
        )}

        {!state.liveText && state.thinking && (
          <p className="text-xs thinking-shimmer truncate">{state.thinking}</p>
        )}

        {(state.status === "starting" || (state.status === "running" && !state.liveText && !state.thinking)) && (
          <WorkingDots label={state.status === "starting" ? "waking the agent…" : "working…"} />
        )}

        {state.error && (
          <div className="rounded-xl border border-[rgba(207,75,59,0.3)] bg-[rgba(207,75,59,0.08)] px-3 py-2 text-xs text-bad">
            {state.error}
          </div>
        )}
      </div>

      {(state.status === "completed" || state.status === "failed" || state.status === "cancelled") && (
        <div className="mt-2 shrink-0 border-t border-line pt-2">
          <div className="flex items-center gap-2 text-[11px] text-cream-faint">
            {state.status === "completed" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-good" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-bad" />
            )}
            run {state.status}
            {state.costUsd !== undefined && <span className="font-mono">· {fmtUsd(state.costUsd)}</span>}
          </div>
          {onFollowUp && <FollowUpBox onSend={onFollowUp} />}
        </div>
      )}
    </div>
  );
}

function FollowUpBox({ onSend }: { onSend: (text: string) => Promise<void> | void }) {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const send = async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      await onSend(message);
      setText("");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-line bg-[rgba(43,34,26,0.04)] focus-within:border-[rgba(63,146,104,0.45)] transition-colors pl-2.5 pr-1 py-1">
      <Sparkles className="h-3 w-3 text-eucalyptus shrink-0" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } }}
        placeholder="Follow up — the agent keeps this run's context…"
        disabled={sending}
        className="flex-1 min-w-0 bg-transparent text-xs text-cream placeholder:text-cream-faint outline-none py-1"
      />
      <Button size="sm" variant="ghost" loading={sending} disabled={!text.trim()} onClick={() => void send()} className="h-6 w-6 p-0 rounded-lg">
        <CornerDownLeft className="h-3 w-3" />
      </Button>
    </div>
  );
}

function CollapsibleText({ text }: { text: string }) {
  const [open, setOpen] = React.useState(false);
  const isLong = text.length > 420;
  if (!isLong) {
    return (
      <div className="prose-palate">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }
  return (
    <div>
      <div className={cn("prose-palate relative overflow-hidden transition-all", !open && "max-h-28")}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        {!open && (
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#ffffff] to-transparent pointer-events-none" />
        )}
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-1 inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-[10px] text-cream-muted hover:text-cream hover:border-line-strong transition-colors"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        {open ? "Show less" : "Read full note"}
      </button>
    </div>
  );
}

function Segment({
  seg, onDecide, dense,
}: {
  seg: TimelineSegment;
  onDecide: (id: string, decision: string, note?: string) => Promise<void> | void;
  dense?: boolean;
}) {
  switch (seg.kind) {
    case "text":
      return <CollapsibleText text={seg.text} />;
    case "status":
      return (
        <p className="text-[11px] text-cream-faint flex items-center gap-1.5">
          <span className="dot bg-eucalyptus/70" /> {seg.note}
        </p>
      );
    case "tool":
      return <ToolRow seg={seg} />;
    case "block":
      return (
        <div className={dense ? "max-w-full" : "max-w-2xl"}>
          <BlockRenderer
            block={{ id: seg.id, kind: seg.blockKind as CanvasBlock["kind"], title: seg.title, payload: seg.payload }}
            compact
          />
        </div>
      );
    case "asset":
      return <AssetPreview url={seg.url} kind={seg.assetKind} format={seg.format} variant={seg.variant} />;
    case "approval":
      return <ApprovalCard approval={seg.approval} onDecide={onDecide} />;
  }
}

function ToolRow({ seg }: { seg: Extract<TimelineSegment, { kind: "tool" }> }) {
  const [open, setOpen] = React.useState(false);
  const Icon = TOOL_ICONS[seg.name] ?? Wrench;
  const label = TOOL_LABELS[seg.name] ?? seg.name;
  return (
    <div className="rounded-xl border border-line/70 bg-[rgba(43,34,26,0.025)] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[rgba(43,34,26,0.03)]"
      >
        {seg.done ? (
          seg.isError ? <XCircle className="h-3.5 w-3.5 text-bad shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 text-good shrink-0" />
        ) : (
          <CircleDashed className="h-3.5 w-3.5 text-amber animate-spin shrink-0" style={{ animationDuration: "2.4s" }} />
        )}
        <Icon className="h-3.5 w-3.5 text-cream-muted shrink-0" />
        <span className="text-xs text-cream">{label}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-cream-faint">{seg.name}</span>
          <ChevronDown className={cn("h-3 w-3 text-cream-faint transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2.5 grid gap-1.5 border-t border-line/50 pt-2">
          {seg.input !== undefined && (
            <pre className="text-[10px] font-mono text-cream-muted bg-[rgba(43,34,26,0.05)] rounded-lg p-2 overflow-x-auto max-h-36">
              {JSON.stringify(seg.input, null, 1)}
            </pre>
          )}
          {seg.resultSummary && (
            <pre className={cn("text-[10px] font-mono rounded-lg p-2 overflow-x-auto max-h-36 bg-[rgba(43,34,26,0.05)]", seg.isError ? "text-bad" : "text-eucalyptus")}>
              {seg.resultSummary}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function AssetPreview({ url, kind, format, variant }: { url?: string; kind: string; format?: string; variant?: string }) {
  if (!url && kind !== "caption") return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-block rounded-2xl overflow-hidden border border-line glass max-w-[260px]"
    >
      {kind === "image" && url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={variant ?? "generated asset"} className="w-full h-auto" loading="lazy" />
      )}
      {kind === "video" && url && (
        <video src={url} controls muted playsInline className="w-full h-auto" />
      )}
      <div className="px-2.5 py-1.5 flex items-center gap-2">
        {kind === "video" ? <Video className="h-3 w-3 text-amber" /> : <ImageIcon className="h-3 w-3 text-amber" />}
        <span className="text-[10px] text-cream-muted">{variant ?? kind}</span>
        {format && <span className="ml-auto font-mono text-[9px] text-cream-faint">{format}</span>}
      </div>
    </motion.div>
  );
}

export function ApprovalCard({
  approval, onDecide,
}: {
  approval: ApprovalRequest;
  onDecide: (id: string, decision: string, note?: string) => Promise<void> | void;
}) {
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState<string | null>(null);
  const resolved = approval.resolved;
  const ctx = approval.context ?? {};
  const imageUrls: string[] = [];
  for (const v of Object.values(ctx)) {
    if (typeof v === "string" && /^https?:\/\/.+\.(png|jpe?g|webp)/i.test(v)) imageUrls.push(v);
    if (Array.isArray(v)) for (const x of v) if (typeof x === "string" && /^https?:\/\/.+\.(png|jpe?g|webp)/i.test(x)) imageUrls.push(x);
  }
  const textEntries = Object.entries(ctx).filter(
    ([, v]) => typeof v === "string" && !/^https?:\/\//.test(v as string)
  ) as [string, string][];

  return (
    <div className={cn(
      "rounded-2xl border p-3.5 transition-colors",
      resolved
        ? "border-line bg-[rgba(43,34,26,0.02)]"
        : "border-[rgba(201,127,61,0.4)] bg-[rgba(196,99,58,0.06)] accent-ring"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquareWarning className={cn("h-4 w-4", resolved ? "text-cream-faint" : "text-amber")} />
        <span className="text-[11px] uppercase tracking-[0.14em] text-cream-faint">
          {resolved ? "decision recorded" : "agent needs your decision"}
        </span>
        <Badge tone={resolved ? "neutral" : "accent"} className="ml-auto">{approval.subject_type}</Badge>
      </div>
      <p className="text-sm text-cream leading-relaxed">{approval.question}</p>

      {imageUrls.length > 0 && (
        <div className="flex gap-2 mt-2.5 overflow-x-auto">
          {imageUrls.slice(0, 4).map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="context" className="h-28 rounded-lg border border-line object-cover" />
          ))}
        </div>
      )}
      {textEntries.length > 0 && (
        <div className="mt-2.5 grid gap-1">
          {textEntries.slice(0, 6).map(([k, v]) => (
            <div key={k} className="text-[11px] leading-relaxed">
              <span className="text-cream-faint">{k.replaceAll("_", " ")}: </span>
              <span className="text-cream-muted whitespace-pre-wrap">{v.length > 400 ? `${v.slice(0, 400)}…` : v}</span>
            </div>
          ))}
        </div>
      )}

      {resolved ? (
        <p className="mt-2.5 text-xs flex items-center gap-1.5">
          {/approve/i.test(resolved.decision) ? <CheckCircle2 className="h-3.5 w-3.5 text-good" /> : <XCircle className="h-3.5 w-3.5 text-bad" />}
          <span className="text-cream-muted">
            You chose <span className="text-cream font-medium">{resolved.decision}</span>
            {resolved.note ? <> — “{resolved.note}”</> : null}
          </span>
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for the agent (it learns from this)…"
            className="h-8 w-full rounded-lg bg-[rgba(43,34,26,0.04)] border border-line px-2.5 text-xs text-cream placeholder:text-cream-faint focus:border-[rgba(196,99,58,0.5)]"
          />
          <div className="flex flex-wrap gap-2">
            {approval.options.map((opt) => {
              const positive = /approve|yes|send|publish|go/i.test(opt);
              const negative = /reject|no|stop/i.test(opt);
              return (
                <Button
                  key={opt}
                  size="sm"
                  loading={submitting === opt}
                  variant={positive ? "primary" : negative ? "danger" : "outline"}
                  onClick={async (e) => {
                    const { clientX, clientY } = e;
                    setSubmitting(opt);
                    await onDecide(approval.approval_id, opt, note || undefined);
                    setSubmitting(null);
                    if (positive) fireConfetti(clientX, clientY);
                  }}
                >
                  {opt}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
