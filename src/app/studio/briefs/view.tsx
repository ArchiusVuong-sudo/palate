"use client";

/**
 * Briefs — daily content briefing. Generate a brief from the latest insights,
 * refine it with feedback, then hand it to the creative agent.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowUpRight, CalendarDays, ChevronDown, Clock, FileText, MessageSquarePlus, Palette, Sparkles, Users, X,
} from "lucide-react";
import {
  Badge, Button, Card, EmptyState, Input, Modal, SectionTitle, Textarea,
} from "@/components/ui/primitives";
import { RunConsole } from "@/components/agent/run-console";
import { useRunStream } from "@/components/agent/use-run-stream";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import type { Brief, CanvasBlockRow, Insight } from "@/lib/queries";
import { CHANNEL_LABELS, cn, fmtDate, timeAgo } from "@/lib/format";

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "info"> = {
  draft: "warn",
  in_review: "info",
  approved: "good",
  archived: "neutral",
};

function severityTone(severity: string): "bad" | "warn" | "good" | "info" {
  if (severity === "critical") return "bad";
  if (severity === "warning" || severity === "high") return "warn";
  if (severity === "opportunity" || severity === "positive") return "good";
  return "info";
}

const serif = { fontFamily: "var(--font-display), serif" };

/* ───────── chip helpers — distil long brief copy into scannable chips ───────── */

/** First ~5 words of the schedule hint, e.g. "Thursday 11:30am, just before…" */
function shortSchedule(hint: string): string {
  const words = hint.trim().split(/\s+/);
  return words.slice(0, 5).join(" ") + (words.length > 5 ? "…" : "");
}

/** Persona names quoted in the audience copy, e.g. "CBD lunch crowd" — max 3. */
function personaNames(audience: string | null): string[] {
  if (!audience) return [];
  const out: string[] = [];
  for (const m of audience.replace(/[“”]/g, '"').matchAll(/"([^"]+)"/g)) {
    if (m[1] && !out.includes(m[1])) out.push(m[1]);
    if (out.length === 3) break;
  }
  return out;
}

/** Short tone keywords — split on commas / dashes, keep the punchy ones, max 3. */
function toneKeywords(tone: string | null): string[] {
  if (!tone) return [];
  return tone
    .split(/,|—|–/)
    .map((t) => t.trim().replace(/\.$/, ""))
    .filter((t) => t.length > 0 && t.length <= 28 && t.split(/\s+/).length <= 3)
    .slice(0, 3);
}

/** Tiny pill for derived metadata — quieter than a Badge. */
function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-[rgba(43,34,26,0.03)] px-2 py-0.5 text-[10px] text-cream-muted",
        className
      )}
    >
      {children}
    </span>
  );
}

export function BriefsView({
  briefs,
  insights,
  blocks,
}: {
  briefs: Brief[];
  insights: Insight[];
  blocks: CanvasBlockRow[];
}) {
  const router = useRouter();
  const intentRef = React.useRef<"briefing" | "creative">("briefing");
  const { state, start, decide, reset, busy } = useRunStream({
    onDone: (done) => {
      router.refresh();
      if (done.status !== "completed") {
        toast.error(`Agent run ${done.status}`);
      } else if (intentRef.current === "creative") {
        toast.success("Creative package ready", {
          action: { label: "Open Creative studio", onClick: () => router.push("/studio/creative") },
        });
      } else {
        toast.success("Brief ready");
      }
    },
  });

  const [focus, setFocus] = React.useState("");
  const [feedback, setFeedback] = React.useState("");
  const [expanded, setExpanded] = React.useState<Brief | null>(null);
  const [showFullBrief, setShowFullBrief] = React.useState(false);

  const generate = async (withFocus: boolean) => {
    intentRef.current = "briefing";
    const f = focus.trim();
    await start({
      workflow: "briefing",
      ...(withFocus && f ? { params: { focus: f } } : {}),
    });
  };

  const refine = async (brief: Brief) => {
    const fb = feedback.trim();
    if (!fb) return;
    intentRef.current = "briefing";
    setFeedback("");
    await start({
      workflow: "briefing",
      prompt: `Refine brief ${brief.id}: ${fb}. Use update_brief, keep the same brief id, bump nothing else.`,
    });
  };

  const produceCreative = async (brief: Brief) => {
    intentRef.current = "creative";
    await start({ workflow: "creative", params: { briefId: brief.id } });
  };

  const [hero, ...older] = briefs;

  return (
    <div>
      <SectionTitle
        title="Content briefs"
        subtitle="From insight to a designer-ready brief in one run"
        right={
          <Button onClick={() => generate(true)} disabled={busy} loading={busy}>
            <FileText className="h-4 w-4" />
            Generate today&apos;s brief
          </Button>
        }
      />

      {/* optional focus phrase */}
      <form
        className="mt-3 flex items-center gap-2 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (focus.trim() && !busy) generate(true);
        }}
      >
        <Input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="Optional focus — e.g. the new winter menu at Fitzroy"
          className="h-8 text-xs"
        />
        <Button type="submit" variant="ghost" size="sm" disabled={busy || !focus.trim()} className="shrink-0">
          with focus
        </Button>
      </form>

      {/* live agent console */}
      {state.status !== "idle" && (
        <Card className="p-4 mt-5 max-h-[60vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">
              {intentRef.current === "creative" ? "creative agent" : "briefing agent"}
            </span>
            {!busy && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Dismiss
              </Button>
            )}
          </div>
          <RunConsole state={state} onDecide={decide} className="flex-1" />
        </Card>
      )}

      {/* hero brief */}
      {!hero ? (
        <Card className="mt-6">
          <EmptyState
            icon={<FileText />}
            title="No briefs yet"
            hint="Run the briefing agent to turn the latest listening insights into a designer-ready brief."
            action={
              <Button onClick={() => generate(true)} disabled={busy}>
                <FileText className="h-4 w-4" />
                Generate today&apos;s brief
              </Button>
            }
          />
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6 mt-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
              <div className="min-w-0">
                <h3 className="text-2xl text-cream leading-snug" style={serif}>
                  {hero.title}
                </h3>

                {/* chip row — the whole brief at a glance */}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <Badge tone={STATUS_TONE[hero.status] ?? "neutral"}>{hero.status.replaceAll("_", " ")}</Badge>
                  <Chip>
                    <CalendarDays className="h-3 w-3 text-cream-faint" />
                    {fmtDate(hero.for_date, { weekday: "long" })}
                  </Chip>
                  {hero.channels.map((c) => (
                    <Badge key={c} tone="neutral">
                      {CHANNEL_LABELS[c] ?? c}
                    </Badge>
                  ))}
                  <Chip className="font-mono">v{hero.version}</Chip>
                  {hero.schedule_hint && (
                    <Chip>
                      <Clock className="h-3 w-3 text-cream-faint" />
                      {shortSchedule(hero.schedule_hint)}
                    </Chip>
                  )}
                  {personaNames(hero.audience).map((p) => (
                    <Badge key={p} tone="info">
                      <Users className="h-3 w-3" />
                      {p}
                    </Badge>
                  ))}
                  {toneKeywords(hero.tone).map((t) => (
                    <Chip key={t} className="italic">
                      {t}
                    </Chip>
                  ))}
                </div>

                {/* the two blocks worth reading in full */}
                <dl className="mt-5 grid grid-cols-1 gap-4">
                  {hero.objective && <Field label="Objective">{hero.objective}</Field>}
                  {hero.key_message && (
                    <Field label="Key message">
                      <p
                        className="border-l-2 border-terracotta pl-3 text-[15px] italic text-cream leading-relaxed"
                        style={serif}
                      >
                        {hero.key_message}
                      </p>
                    </Field>
                  )}
                </dl>

                {/* everything else collapses behind a pill */}
                <button
                  type="button"
                  onClick={() => setShowFullBrief((v) => !v)}
                  aria-expanded={showFullBrief}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-[rgba(43,34,26,0.06)] px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-cream-muted hover:text-cream hover:border-line-strong transition-colors"
                >
                  Full brief
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showFullBrief && "rotate-180")} />
                </button>
                {showFullBrief && (
                  <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    {hero.audience && <CompactField label="Audience">{hero.audience}</CompactField>}
                    {hero.tone && <CompactField label="Tone">{hero.tone}</CompactField>}
                    {hero.angle && <CompactField label="Angle">{hero.angle}</CompactField>}
                    {hero.cta && <CompactField label="Call to action">{hero.cta}</CompactField>}
                    {hero.schedule_hint && (
                      <CompactField label="Schedule">
                        <span className="inline-flex items-start gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-cream-faint shrink-0 mt-0.5" />
                          {hero.schedule_hint}
                        </span>
                      </CompactField>
                    )}
                    {hero.feedback && (
                      <CompactField label="Latest feedback">
                        <span className="text-cream-faint italic">{hero.feedback}</span>
                      </CompactField>
                    )}
                  </dl>
                )}
              </div>

              <BriefSidePanel brief={hero} />
            </div>

            {/* actions */}
            <div className="mt-6 pt-4 border-t border-line flex flex-col md:flex-row gap-4 md:items-end">
              {(hero.status === "draft" || hero.status === "in_review") && (
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-cream-faint mb-1.5">
                    Not quite right?
                  </p>
                  <div className="flex gap-2 items-end">
                    <Textarea
                      rows={2}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="e.g. Lean harder on the lunch crowd, tighten the CTA…"
                      className="text-xs flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !feedback.trim()}
                      onClick={() => refine(hero)}
                      className="shrink-0"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      Refine with feedback
                    </Button>
                  </div>
                </div>
              )}
              <Button onClick={() => produceCreative(hero)} disabled={busy} className="shrink-0 md:ml-auto">
                <Palette className="h-4 w-4" />
                Produce creative
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* earlier briefs */}
      {older.length > 0 && (
        <section className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">Earlier briefs</p>
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            {older.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.5) }}
              >
                <button type="button" onClick={() => setExpanded(b)} className="text-left w-full h-full">
                  <Card hover className="p-4 h-full cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{b.status.replaceAll("_", " ")}</Badge>
                      <span className="ml-auto font-mono text-[10px] text-cream-faint">v{b.version}</span>
                    </div>
                    <p className="text-base text-cream mt-2 leading-snug truncate" style={serif}>
                      {b.title}
                    </p>
                    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                      <Chip>
                        <CalendarDays className="h-3 w-3 text-cream-faint" />
                        {fmtDate(b.for_date)}
                      </Chip>
                      {b.channels.slice(0, 2).map((c) => (
                        <Badge key={c} tone="neutral">
                          {CHANNEL_LABELS[c] ?? c}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* briefing canvas */}
      {blocks.length > 0 && (
        <section className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">Briefing canvas</p>
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            {blocks.map((b) => (
              <BlockRenderer key={b.id} block={b} />
            ))}
          </div>
        </section>
      )}

      {/* source insights */}
      {insights.length > 0 && (
        <section className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Source insights
          </p>
          <div className="grid grid-cols-1 gap-2 mt-3">
            {insights.map((ins, i) => (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                className="flex items-center gap-3 rounded-xl border border-line bg-[rgba(43,34,26,0.02)] px-3.5 py-2.5"
              >
                <Badge tone={severityTone(ins.severity)}>{ins.severity}</Badge>
                <p className="text-xs text-cream truncate flex-1">{ins.title}</p>
                <span className="text-[10px] text-cream-faint shrink-0">{timeAgo(ins.created_at)}</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-3">
            <Link
              href="/studio/listening"
              className="inline-flex items-center gap-1 text-[11px] text-cream-faint hover:text-cream transition-colors"
            >
              All listening insights <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </section>
      )}

      {/* expanded earlier brief */}
      <Modal open={expanded !== null} onClose={() => setExpanded(null)} wide>
        {expanded && (
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge tone={STATUS_TONE[expanded.status] ?? "neutral"}>
                    {expanded.status.replaceAll("_", " ")}
                  </Badge>
                  <span className="text-xs text-cream-faint">{fmtDate(expanded.for_date, { weekday: "long" })}</span>
                  <span className="font-mono text-[10px] text-cream-faint">v{expanded.version}</span>
                </div>
                <h3 className="text-2xl text-cream mt-2 leading-snug" style={serif}>
                  {expanded.title}
                </h3>
              </div>
              <button
                onClick={() => setExpanded(null)}
                className="text-cream-faint hover:text-cream p-1 rounded-lg hover:bg-[rgba(43,34,26,0.06)] shrink-0"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px] mt-5">
              <BriefFields brief={expanded} />
              <BriefSidePanel key={expanded.id} brief={expanded} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ───────── structured brief fields (shared by hero + modal) ───────── */

function BriefFields({ brief, className }: { brief: Brief; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-4", className)}>
      {brief.objective && <Field label="Objective">{brief.objective}</Field>}
      {brief.audience && <Field label="Audience">{brief.audience}</Field>}
      {brief.key_message && (
        <Field label="Key message">
          <p
            className="border-l-2 border-terracotta pl-3 text-[15px] italic text-cream leading-relaxed"
            style={serif}
          >
            {brief.key_message}
          </p>
        </Field>
      )}
      {brief.tone && <Field label="Tone">{brief.tone}</Field>}
      {brief.angle && <Field label="Angle">{brief.angle}</Field>}
      {brief.cta && <Field label="Call to action">{brief.cta}</Field>}
      {brief.channels.length > 0 && (
        <Field label="Channels">
          <span className="flex flex-wrap gap-1.5">
            {brief.channels.map((c) => (
              <Badge key={c} tone="neutral">
                {CHANNEL_LABELS[c] ?? c}
              </Badge>
            ))}
          </span>
        </Field>
      )}
      {brief.schedule_hint && (
        <Field label="Schedule">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-cream-faint shrink-0" />
            {brief.schedule_hint}
          </span>
        </Field>
      )}
      {brief.feedback && (
        <Field label="Latest feedback">
          <span className="text-cream-faint italic">{brief.feedback}</span>
        </Field>
      )}
    </dl>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-cream-faint">{label}</dt>
      <dd className="mt-1 text-sm text-cream-muted leading-relaxed">{children}</dd>
    </div>
  );
}

function CompactField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-cream-faint">{label}</dt>
      <dd className="mt-1 text-xs text-cream-muted leading-relaxed">{children}</dd>
    </div>
  );
}

/* ───────── side panel: visual direction + guardrails, clamped by default ───────── */

function BriefSidePanel({ brief }: { brief: Brief }) {
  const [showVisual, setShowVisual] = React.useState(false);
  const [showNotes, setShowNotes] = React.useState(false);
  const visual = brief.visual_direction;
  const notes = brief.copy_notes;
  const visualLong = (visual?.length ?? 0) > 280;
  const notesLong = !!notes && (notes.length > 300 || notes.split("\n").length > 8);

  return (
    <aside className="panel rounded-xl p-4 h-fit">
      <p className="text-[10px] uppercase tracking-[0.16em] text-cream-faint mb-2">Visual direction</p>
      <p
        className={cn("text-sm italic text-cream-muted leading-relaxed", !showVisual && "line-clamp-8")}
        style={serif}
      >
        {visual ?? "No visual direction recorded."}
      </p>
      {visualLong && (
        <button
          type="button"
          onClick={() => setShowVisual((v) => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-cream-faint hover:text-cream transition-colors"
        >
          {showVisual ? "Show less" : "Read all"}
          <ChevronDown className={cn("h-3 w-3 transition-transform", showVisual && "rotate-180")} />
        </button>
      )}
      {notes && (
        <>
          <div className="mt-4 mb-2">
            <Badge tone="warn">guardrails</Badge>
          </div>
          <p
            className={cn(
              "font-mono text-[11px] text-cream-muted leading-relaxed whitespace-pre-wrap",
              !showNotes && "line-clamp-8"
            )}
          >
            {notes}
          </p>
          {notesLong && (
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-cream-faint hover:text-cream transition-colors"
            >
              {showNotes ? "Show less" : "Read all"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", showNotes && "rotate-180")} />
            </button>
          )}
        </>
      )}
    </aside>
  );
}
