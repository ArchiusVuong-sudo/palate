"use client";

/**
 * Content calendar — the month at a glance. Briefs and posts land on their
 * days; approved/scheduled posts drag to reschedule (native HTML5 dnd, same
 * pattern as the review kanban), and an "Unscheduled" rail holds approved
 * posts waiting for a slot.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock, CalendarDays, ChevronLeft, ChevronRight, FileText, GripVertical,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { HoverDetail, HoverRow } from "@/components/ui/hover-detail";
import { AskPalateButton } from "@/components/agent/ask-palate";
import { CHANNEL_LABELS, cn, fmtDateTime } from "@/lib/format";
import type { Post } from "@/lib/queries";

/* ───────── types ───────── */

type CalendarPost = Post & { occurs_on: string };
type CalendarBrief = { id: string; title: string; status: string; channels: string[]; occurs_on: string };

/* ───────── channel + status maps ───────── */

const CHANNEL_META: Record<string, { label: string; chip: string }> = {
  instagram_story: {
    label: "IG Story",
    chip: "border-[rgba(196,99,58,0.4)] bg-[rgba(196,99,58,0.1)] text-terracotta",
  },
  instagram_feed: {
    label: "IG Feed",
    chip: "border-[rgba(63,146,104,0.4)] bg-[rgba(63,146,104,0.09)] text-eucalyptus",
  },
  facebook: {
    label: "FB",
    chip: "border-[rgba(79,135,173,0.4)] bg-[rgba(79,135,173,0.1)] text-info",
  },
};

const FALLBACK_CHANNEL = {
  label: "Post",
  chip: "border-line bg-[rgba(43,34,26,0.04)] text-cream-muted",
};

const STATUS_DOT: Record<string, string> = {
  draft: "rgba(43,34,26,0.3)",
  in_review: "#b98a23",
  changes_requested: "#b98a23",
  approved: "#2f9e63",
  scheduled: "#4f87ad",
  published: "#2f9e63",
};

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "info"> = {
  draft: "neutral",
  in_review: "warn",
  changes_requested: "warn",
  approved: "good",
  scheduled: "info",
  published: "good",
};

const BRIEF_TONE: Record<string, "neutral" | "good" | "warn" | "info"> = {
  draft: "neutral",
  approved: "good",
  in_progress: "info",
  done: "good",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ───────── date helpers (all in the day-string domain, no TZ drift) ───────── */

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" → local 18:00 that day, as ISO. */
function atSixPm(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 18, 0, 0, 0).toISOString();
}

function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

const isDraggable = (p: CalendarPost) => p.status === "approved" || p.status === "scheduled";

/* ───────── main view ───────── */

export function CalendarView({
  monthKey, days, todayISO, posts, briefs,
}: {
  monthKey: string;
  days: string[];
  todayISO: string;
  posts: CalendarPost[];
  briefs: CalendarBrief[];
}) {
  const router = useRouter();

  // Client copy for optimistic drag-to-reschedule moves.
  const [clientPosts, setClientPosts] = React.useState<CalendarPost[]>(posts);
  React.useEffect(() => setClientPosts(posts), [posts]);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [hoverDay, setHoverDay] = React.useState<string | null>(null);

  // Approved-but-unscheduled posts live in the rail, not on the grid.
  const unscheduled = clientPosts.filter((p) => p.status === "approved" && !p.scheduled_at);
  const gridPosts = clientPosts.filter((p) => !(p.status === "approved" && !p.scheduled_at));

  const byDay = React.useMemo(() => {
    const map = new Map<string, { posts: CalendarPost[]; briefs: CalendarBrief[] }>();
    const bucket = (day: string) => {
      let b = map.get(day);
      if (!b) { b = { posts: [], briefs: [] }; map.set(day, b); }
      return b;
    };
    for (const b of briefs) bucket(b.occurs_on).briefs.push(b);
    for (const p of gridPosts) bucket(p.occurs_on).posts.push(p);
    return map;
  }, [gridPosts, briefs]);

  const inMonth = (day: string) => day.startsWith(monthKey);
  const monthPostCount = clientPosts.filter((p) => inMonth(p.occurs_on)).length;
  const monthBriefCount = briefs.filter((b) => inMonth(b.occurs_on)).length;
  const emptyMonth = posts.length === 0 && briefs.length === 0;

  const goTo = (key: string | null) =>
    router.push(key ? `/studio/calendar?month=${key}` : "/studio/calendar");

  /** Native HTML5 drop — optimistic reschedule to 18:00 local, revert on failure. */
  const dropOnDay = async (e: React.DragEvent, day: string) => {
    e.preventDefault();
    setHoverDay(null);
    setDraggingId(null);
    const id = e.dataTransfer.getData("text/plain");
    const post = clientPosts.find((p) => p.id === id);
    if (!id || !post || !isDraggable(post)) return;
    if (post.scheduled_at && post.occurs_on === day) return;

    const scheduledISO = atSixPm(day);
    const previous = clientPosts;
    setClientPosts((cur) =>
      cur.map((p) => (p.id === id ? { ...p, scheduled_at: scheduledISO, occurs_on: day } : p))
    );
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: scheduledISO }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
      }
      toast.success(`Scheduled for ${dayLabel(day)} · 6:00 pm`);
      router.refresh();
    } catch (err) {
      setClientPosts(previous);
      toast.error(err instanceof Error ? err.message : "Couldn't reschedule the post");
    }
  };

  const askPrompt = `Look at our content calendar for ${monthLabel(monthKey)}. Where are the gaps and what should we schedule?`;

  return (
    <div>
      {/* ── header ── */}
      <SectionTitle
        title="Content calendar"
        subtitle="Briefs and posts on the month — drag approved or scheduled posts to reschedule"
        right={<AskPalateButton prompt={askPrompt} label="Ask Palate about gaps" />}
      />

      <div className="mt-5 grid grid-cols-1 gap-5">
        <Card className="p-4 animate-in-up">
          {/* month bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
              {monthLabel(monthKey)}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[rgba(43,34,26,0.03)] px-2.5 py-0.5 text-[11px] text-cream-muted">
              <CalendarClock className="h-3 w-3 text-cream-faint" />
              {monthPostCount} post{monthPostCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(201,127,61,0.4)] bg-[rgba(201,127,61,0.1)] px-2.5 py-0.5 text-[11px] text-amber">
              <FileText className="h-3 w-3" />
              {monthBriefCount} brief{monthBriefCount === 1 ? "" : "s"}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => goTo(shiftMonth(monthKey, -1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => goTo(null)}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => goTo(shiftMonth(monthKey, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {emptyMonth ? (
            <EmptyState
              className="py-14"
              icon={<CalendarDays />}
              title="Nothing on the calendar this month"
              hint="Run the pipeline from the overview and Palate will brief, create, review and schedule a fresh batch of posts."
            />
          ) : (
            <>
              {/* weekday header */}
              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((w) => (
                  <p key={w} className="px-1.5 text-[10px] uppercase tracking-[0.16em] text-cream-faint">
                    {w}
                  </p>
                ))}
              </div>

              {/* day grid */}
              <div className="mt-1.5 grid grid-cols-7 gap-1.5">
                {days.map((day, i) => {
                  const cell = byDay.get(day);
                  const outside = !inMonth(day);
                  const isToday = day === todayISO;
                  return (
                    <div
                      key={day}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (hoverDay !== day) setHoverDay(day);
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        setHoverDay((d) => (d === day ? null : d));
                      }}
                      onDrop={(e) => void dropOnDay(e, day)}
                      className={cn(
                        "min-h-24 rounded-xl border border-line bg-[rgba(255,255,255,0.45)] p-1.5 transition-colors duration-150 animate-in-up",
                        outside && "opacity-45 bg-transparent",
                        isToday && "accent-ring border-[rgba(196,99,58,0.5)] bg-[rgba(196,99,58,0.05)]",
                        hoverDay === day && draggingId !== null && "border-[rgba(196,99,58,0.55)] bg-[rgba(196,99,58,0.1)]"
                      )}
                      style={{ animationDelay: `${Math.min(i, 13) * 0.015}s` }}
                    >
                      <p
                        className={cn(
                          "px-0.5 font-mono text-[10px]",
                          isToday ? "text-terracotta font-semibold" : "text-cream-faint"
                        )}
                      >
                        {Number(day.slice(8))}
                        {isToday && <span className="ml-1 text-[9px] uppercase tracking-wider">today</span>}
                      </p>
                      <div className="mt-1 grid grid-cols-1 gap-1">
                        {(cell?.briefs ?? []).map((brief) => (
                          <HoverDetail
                            key={brief.id}
                            width={320}
                            disabled={draggingId !== null}
                            content={<BriefHoverContent brief={brief} />}
                          >
                            <BriefChip brief={brief} />
                          </HoverDetail>
                        ))}
                        {(cell?.posts ?? []).map((post) => (
                          <HoverDetail
                            key={post.id}
                            width={320}
                            disabled={draggingId !== null}
                            content={<PostHoverContent post={post} />}
                          >
                            <PostChip
                              post={post}
                              dragging={draggingId === post.id}
                              onDragStart={() => setDraggingId(post.id)}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setHoverDay(null);
                              }}
                            />
                          </HoverDetail>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        {/* ── unscheduled rail ── */}
        <Card className="p-4 animate-in-up">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="dot" style={{ background: "#2f9e63" }} />
            <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">
              Unscheduled — approved &amp; waiting for a slot
            </p>
            <span className="font-mono text-[10px] text-cream-faint">{unscheduled.length}</span>
            <AskPalateButton className="ml-auto" prompt={askPrompt} />
          </div>
          {unscheduled.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-line px-3 py-5 text-center text-[11px] text-cream-faint">
              Nothing waiting — every approved post has a slot on the calendar.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {unscheduled.map((post) => (
                <HoverDetail
                  key={post.id}
                  width={320}
                  disabled={draggingId !== null}
                  content={<PostHoverContent post={post} />}
                >
                  <PostChip
                    post={post}
                    rail
                    dragging={draggingId === post.id}
                    onDragStart={() => setDraggingId(post.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setHoverDay(null);
                    }}
                  />
                </HoverDetail>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-cream-faint">tip — drag a chip onto a day to schedule it for 6:00 pm</p>
        </Card>
      </div>
    </div>
  );
}

/* ───────── chips ───────── */

function BriefChip({ brief }: { brief: CalendarBrief }) {
  return (
    <span className="inline-flex w-full min-w-0 items-center gap-1 rounded-md border border-[rgba(201,127,61,0.4)] bg-[rgba(201,127,61,0.1)] px-1.5 py-0.5 text-[10px] text-amber">
      <FileText className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{brief.title}</span>
    </span>
  );
}

function PostChip({
  post, dragging, onDragStart, onDragEnd, rail,
}: {
  post: CalendarPost;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  rail?: boolean;
}) {
  const meta = CHANNEL_META[post.channel] ?? FALLBACK_CHANNEL;
  const draggable = isDraggable(post);
  return (
    // Plain span (not motion): native HTML5 onDragStart/onDragEnd clash with framer-motion's drag props.
    <span
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData("text/plain", post.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px]",
        rail ? "max-w-56" : "w-full",
        meta.chip,
        draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50 ring-2 ring-[rgba(196,99,58,0.5)]"
      )}
      title={draggable ? "Drag onto a day to reschedule" : undefined}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: STATUS_DOT[post.status] ?? STATUS_DOT.draft }}
        aria-label={post.status}
      />
      <span className="shrink-0 font-medium">{meta.label}</span>
      {post.caption && <span className="truncate opacity-80">{post.caption}</span>}
      {draggable && <GripVertical className="ml-auto h-2.5 w-2.5 shrink-0 opacity-60" />}
    </span>
  );
}

/* ───────── hover cards (~320 wide) ───────── */

function PostHoverContent({ post }: { post: CalendarPost }) {
  const meta = CHANNEL_META[post.channel] ?? FALLBACK_CHANNEL;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge tone="info">{CHANNEL_LABELS[post.channel] ?? meta.label}</Badge>
        <Badge tone={STATUS_TONE[post.status] ?? "neutral"}>{post.status.replaceAll("_", " ")}</Badge>
      </div>
      {post.caption && <p className="text-xs text-cream leading-relaxed">{post.caption}</p>}
      {(post.hashtags ?? []).length > 0 && (
        <p className="font-mono text-[10px] text-cream-faint leading-relaxed">
          {post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
        </p>
      )}
      <div>
        {post.scheduled_at && <HoverRow label="scheduled">{fmtDateTime(post.scheduled_at)}</HoverRow>}
        {post.published_at && <HoverRow label="published">{fmtDateTime(post.published_at)}</HoverRow>}
        {!post.scheduled_at && !post.published_at && <HoverRow label="slot">not yet scheduled</HoverRow>}
      </div>
    </div>
  );
}

function BriefHoverContent({ brief }: { brief: CalendarBrief }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge tone="accent">brief</Badge>
        <Badge tone={BRIEF_TONE[brief.status] ?? "neutral"}>{brief.status.replaceAll("_", " ")}</Badge>
      </div>
      <p className="text-xs text-cream leading-snug" style={{ fontFamily: "var(--font-display), serif" }}>
        {brief.title}
      </p>
      {(brief.channels ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {brief.channels.map((c) => (
            <span key={c} className="rounded-full border border-line px-1.5 py-px text-[9px] text-cream-muted">
              {CHANNEL_LABELS[c] ?? c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
