"use client";

/**
 * Listening — workflow 01. The social inbox: an editorial feed of reviews,
 * comments and posts, with the morning-sweep agent and today's insights.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AtSign, CheckCircle2, ChevronDown, Ear, Lightbulb, MessageSquare, MessageSquareQuote, ShieldAlert, Star, X,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { HoverDetail, HoverQuote, HoverRow } from "@/components/ui/hover-detail";
import { LazySentinel, ShowMoreButton } from "@/components/ui/lazy-list";
import { usePaged } from "@/components/ui/use-paged";
import { MetricCard, TrendArea } from "@/components/charts/charts";
import { ActivityHeatmap, RadarCompare, type HeatmapDay } from "@/components/charts/extra";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { RunConsole } from "@/components/agent/run-console";
import { useRunStream } from "@/components/agent/use-run-stream";
import { AskPalateButton } from "@/components/agent/ask-palate";
import { cn, fmtDateTime, initials, SOURCE_LABELS, timeAgo } from "@/lib/format";
import type { CanvasBlockRow, Insight, SocialItem } from "@/lib/queries";

type TrendRow = { day: string; positive: number; negative: number; neutral: number };

/** Shape of a getLocationPulse(14) row (typed locally — page rules forbid touching lib/queries). */
type LocationPulse = {
  name: string;
  mentions: number;
  avg_sentiment: number | null;
  positive: number;
  negative: number;
  avg_rating: number | null;
  top_dish: string | null;
};

/** Venue colours: terracotta, eucalyptus, info — one per location, in order. */
const LOC_COLORS = ["#bc5a32", "#3f9268", "#4f87ad"];

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  google_reviews: Star,
  facebook: MessageSquare,
  instagram: AtSign,
};

const SOURCE_PILLS = ["all", "google_reviews", "facebook", "instagram"] as const;

const MOOD_PILLS = [
  { id: "all", label: "All" },
  { id: "positive", label: "Positive" },
  { id: "negative", label: "Negative" },
  { id: "unanalysed", label: "Unanalysed" },
  { id: "flagged", label: "Flagged" },
] as const;
type Mood = (typeof MOOD_PILLS)[number]["id"];

/* ── day cross-filter helpers ──
 * The trend rows arrive with a `day` label rendered server-side as "DD Mon"
 * (e.g. "10 Jun"). To match feed items robustly we compare day+month numbers,
 * not raw strings: both sides normalise to a yyyy-mm-dd key pinned to the
 * current year. */
const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function toDayKey(monthIndex: number, dayOfMonth: number): string {
  return `${new Date().getFullYear()}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}

/** "10 Jun" → "2026-06-10" (current year). Returns null when unparseable. */
function labelToDayKey(label: string): string | null {
  const m = label.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?$/);
  if (!m) return null;
  const dayOfMonth = Number(m[1]);
  const monthIndex = MONTH_INDEX[m[2].slice(0, 3).toLowerCase()];
  if (monthIndex === undefined || !Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return null;
  return toDayKey(monthIndex, dayOfMonth);
}

/** posted_at timestamp → same day-key space as the chart labels. */
function postedAtToDayKey(postedAt: string): string | null {
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return null;
  return toDayKey(d.getMonth(), d.getDate());
}

/** True when posted_at lands on the same day+month as a "10 Jun"-style label. */
function matchesDayLabel(postedAt: string, label: string): boolean {
  const labelKey = labelToDayKey(label);
  const itemKey = postedAtToDayKey(postedAt);
  if (labelKey && itemKey) return labelKey === itemKey;
  // fallback for odd labels: compare the locale-formatted string directly
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return false;
  const formatted = d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" });
  return formatted.trim().toLowerCase() === label.trim().toLowerCase();
}

export function ListeningView({
  items, insights, blocks, trend, heatmap, pulse,
}: {
  items: SocialItem[];
  insights: Insight[];
  blocks: CanvasBlockRow[];
  trend: TrendRow[];
  heatmap: HeatmapDay[];
  pulse: LocationPulse[];
}) {
  const router = useRouter();
  const { state, start, decide, busy, reset } = useRunStream({ onDone: () => router.refresh() });
  const [source, setSource] = React.useState<string>("all");
  const [mood, setMood] = React.useState<Mood>("all");

  /* ── cross-filters (day from the pulse chart, topic/dish from feed chips) ── */
  const [dayFilter, setDayFilter] = React.useState<string | null>(null);
  const [topicFilter, setTopicFilter] = React.useState<string | null>(null);
  const [dishFilter, setDishFilter] = React.useState<string | null>(null);
  const hasCrossFilters = dayFilter !== null || topicFilter !== null || dishFilter !== null;
  const clearCrossFilters = () => {
    setDayFilter(null);
    setTopicFilter(null);
    setDishFilter(null);
  };
  const toggleDay = (label: string) => setDayFilter((prev) => (prev === label ? null : label));
  const toggleTopic = (t: string) => setTopicFilter((prev) => (prev === t ? null : t));
  const toggleDish = (d: string) => setDishFilter((prev) => (prev === d ? null : d));

  /* ── stats computed from the inbox ── */
  const unanalysed = items.filter((i) => !i.analyzed_at).length;
  const analysed = items.filter((i) => i.analyzed_at);
  const positivePct = analysed.length
    ? Math.round((analysed.filter((i) => i.sentiment === "positive").length / analysed.length) * 100)
    : 0;
  const flagged = items.filter((i) => i.is_flagged).length;

  const filtered = items.filter((i) => {
    if (source !== "all" && i.source !== source) return false;
    if (dayFilter && !matchesDayLabel(i.posted_at, dayFilter)) return false;
    if (topicFilter && !(i.topics ?? []).includes(topicFilter)) return false;
    if (dishFilter && !(i.dish_mentions ?? []).includes(dishFilter)) return false;
    if (mood === "positive") return i.sentiment === "positive";
    if (mood === "negative") return i.sentiment === "negative";
    if (mood === "unanalysed") return !i.analyzed_at;
    if (mood === "flagged") return i.is_flagged;
    return true;
  });

  /* ── windowed rendering: 12 at a time, rewinds whenever any filter changes ── */
  const resetKey = JSON.stringify([source, mood, dayFilter, topicFilter, dishFilter]);
  const { visible, hasMore, remaining, showMore, shownCount } = usePaged(filtered, 12, resetKey);

  const trendData = trend.map((t) => ({ label: t.day, positive: t.positive, negative: t.negative }));
  const runSweep = () => void start({ workflow: "listening" });

  return (
    <div>
      {/* ── 1 · header ── */}
      <SectionTitle
        title="Social listening"
        subtitle="Google Reviews · Facebook · Instagram — analysed every morning"
        right={
          <Button disabled={busy} onClick={runSweep} className="whitespace-nowrap shrink-0">
            <Ear className="h-4 w-4" />
            Run morning sweep
          </Button>
        }
      />

      <div className="mt-5 space-y-5">
        {state.status !== "idle" && (
          <Card className="p-4 max-h-[55vh] overflow-hidden flex flex-col animate-in-up">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <span className={cn("dot", busy ? "bg-eucalyptus dot-pulse" : "bg-cream-faint")} />
              <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">
                Morning sweep {busy ? "· working" : "· finished"}
              </p>
              {!busy && (
                <Button variant="ghost" size="sm" className="ml-auto -my-1" onClick={reset}>
                  Dismiss
                </Button>
              )}
            </div>
            <RunConsole state={state} onDecide={decide} className="flex-1 min-h-0" />
          </Card>
        )}

        {/* ── compact header chart ── */}
        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">The pulse — 14 days</p>
            <span className="flex items-center gap-3 text-[10px] text-cream-faint">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#6fbf94]" /> positive</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#cf4b3b]" /> negative</span>
            </span>
          </div>
          <div className="mt-1">
            <TrendArea
              data={trendData}
              series={[
                { key: "positive", name: "Positive", color: "#6fbf94" },
                { key: "negative", name: "Negative", color: "#cf4b3b" },
              ]}
              height={108}
              onPointClick={toggleDay}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-cream-faint">tip — click a day to filter the feed</p>
        </Card>

        {/* ── 2 · stats strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            index={0}
            label="Unanalysed"
            value={unanalysed}
            tone={unanalysed > 0 ? "bad" : "neutral"}
            caption="in the inbox"
          />
          <MetricCard
            index={1}
            label="Positive"
            value={positivePct}
            suffix="%"
            tone={positivePct >= 60 ? "good" : positivePct < 35 ? "bad" : "neutral"}
            caption="of analysed mentions"
          />
          <MetricCard
            index={2}
            label="Flagged"
            value={flagged}
            tone={flagged > 0 ? "bad" : "neutral"}
            caption="safety / urgent"
          />
        </div>

        {/* ── 2b · listening rhythm + venue radar ── */}
        {heatmap.length > 0 && <RhythmCard heatmap={heatmap} />}
        {pulse.length > 0 && <VenuesCard pulse={pulse} />}

        {/* ── 3 · feed + insights ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 items-start">
          {/* the feed */}
          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {SOURCE_PILLS.map((s) => (
                <Pill key={s} active={source === s} onClick={() => setSource(s)}>
                  {s === "all" ? "All" : SOURCE_LABELS[s] ?? s}
                </Pill>
              ))}
              <span className="mx-1.5 h-4 border-l border-line-strong" aria-hidden />
              {MOOD_PILLS.map((m) => (
                <Pill key={m.id} active={mood === m.id} onClick={() => setMood(m.id)}>
                  {m.label}
                </Pill>
              ))}
              <span className="ml-auto font-mono text-[10px] text-cream-faint whitespace-nowrap">
                {shownCount} shown · {filtered.length} match · {items.length} total
              </span>
            </div>

            {hasCrossFilters && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {dayFilter && <ActiveFilterChip name="day" value={dayFilter} onClear={() => setDayFilter(null)} />}
                {topicFilter && <ActiveFilterChip name="topic" value={topicFilter} onClear={() => setTopicFilter(null)} />}
                {dishFilter && <ActiveFilterChip name="dish" value={dishFilter} onClear={() => setDishFilter(null)} />}
                <button
                  type="button"
                  onClick={clearCrossFilters}
                  className="ml-1 text-[11px] text-cream-faint hover:text-cream transition-colors"
                >
                  clear all
                </button>
              </div>
            )}

            {filtered.length === 0 ? (
              <Card className="mt-3">
                <EmptyState
                  icon={<Ear />}
                  title={items.length === 0 ? "The inbox is quiet" : "No mentions match this filter"}
                  hint={
                    items.length === 0
                      ? "Run the morning sweep to pull in the latest reviews and comments."
                      : hasCrossFilters
                        ? "Try another source or sentiment filter, or clear the active filters above."
                        : "Try another source or sentiment filter."
                  }
                  action={
                    items.length === 0 ? (
                      <Button disabled={busy} onClick={runSweep}>
                        <Ear className="h-4 w-4" />
                        Run morning sweep
                      </Button>
                    ) : undefined
                  }
                />
              </Card>
            ) : (
              <>
                <div key={resetKey} className="mt-3 grid grid-cols-1 gap-3">
                  {visible.map((item, i) => (
                    <HoverDetail key={item.id} side="left" width={340} content={<FeedHoverCard item={item} />}>
                      <FeedCard item={item} index={i} onTopicClick={toggleTopic} onDishClick={toggleDish} />
                    </HoverDetail>
                  ))}
                </div>
                <ShowMoreButton remaining={remaining} onClick={showMore} className="mt-3" />
                <LazySentinel onVisible={showMore} disabled={!hasMore} />
              </>
            )}
          </div>

          {/* right rail — flex+gap (not space-y) so HoverDetail's display:contents wrappers keep the rhythm */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div>
              <h3 className="text-lg text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
                Today&apos;s insights
              </h3>
              <p className="text-[11px] text-cream-muted mt-0.5">What the agent took away from the chatter</p>
            </div>
            {insights.length === 0 ? (
              <Card>
                <EmptyState
                  className="py-8"
                  icon={<Lightbulb />}
                  title="No insights yet"
                  hint="Run the morning sweep and the agent will distil the feed into insights."
                />
              </Card>
            ) : (
              insights.map((insight, i) => (
                <HoverDetail key={insight.id} side="left" width={360} content={<InsightHoverCard insight={insight} />}>
                  <CompactInsight insight={insight} index={i} />
                </HoverDetail>
              ))
            )}

            {blocks.length > 0 && (
              <>
                <div className="pt-2">
                  <h3 className="text-lg text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
                    Agent canvas
                  </h3>
                  <p className="text-[11px] text-cream-muted mt-0.5">Published during listening runs</p>
                </div>
                {blocks.map((block) => (
                  <div key={block.id}>
                    <BlockRenderer block={block} compact />
                    <p className="mt-1.5 text-[10px] text-cream-faint text-right">
                      {timeAgo(block.created_at)}
                      {block.pinned && " · pinned"}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── local pieces ───────────────────────── */

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-[rgba(43,34,26,0.03)] px-2 py-0.5 font-mono text-[10px] text-cream-muted whitespace-nowrap">
      {children}
    </span>
  );
}

/** "Listening rhythm" — 84-day GitHub-style heatmap of mention volume + mood. */
function RhythmCard({ heatmap }: { heatmap: HeatmapDay[] }) {
  const total = heatmap.reduce((acc, d) => acc + d.count, 0);
  const activeDays = heatmap.filter((d) => d.count > 0).length;
  const busiest = heatmap.reduce<HeatmapDay | null>(
    (acc, d) => (d.count > 0 && (acc === null || d.count > acc.count) ? d : acc),
    null
  );
  // static month table — Node and browser locale data disagree on short month names, breaking hydration
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const busiestLabel = busiest
    ? `${Number(busiest.day.slice(8, 10))} ${MONTHS[Number(busiest.day.slice(5, 7)) - 1]}`
    : null;

  return (
    <Card className="p-4 animate-in-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
            Listening rhythm
          </h3>
          <p className="text-[11px] text-cream-muted mt-0.5">
            Twelve weeks of mentions — depth is volume, colour is mood. Hover a day for detail.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatChip>{total} mentions</StatChip>
          {busiest && busiestLabel && (
            <StatChip>
              busiest {busiestLabel} · {busiest.count}
            </StatChip>
          )}
          <StatChip>
            {activeDays}/{heatmap.length} days active
          </StatChip>
        </div>
      </div>
      <div className="mt-3">
        <ActivityHeatmap data={heatmap} />
      </div>
    </Card>
  );
}

/** "Across the venues" — radar comparing the locations, plus a compact row each. */
function VenuesCard({ pulse }: { pulse: LocationPulse[] }) {
  const series = pulse.map((p, i) => ({ key: `l${i}`, name: p.name, color: LOC_COLORS[i % LOC_COLORS.length] }));
  // normalise each axis to the leading venue (=100) so counts and ratings share one scale
  const row = (metric: string, pick: (p: LocationPulse) => number): Record<string, string | number> => {
    const values = pulse.map(pick);
    const max = Math.max(1, ...values);
    return {
      metric,
      ...Object.fromEntries(values.map((v, i) => [`l${i}`, Math.round((v / max) * 100)])),
    };
  };
  const radarData = [
    row("Mentions", (p) => p.mentions),
    row("Positive", (p) => p.positive),
    row("Negative", (p) => p.negative),
    row("Rating", (p) => (p.avg_rating === null ? 0 : Number(p.avg_rating))),
  ];

  return (
    <Card className="p-4 animate-in-up">
      <div>
        <h3 className="text-lg text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
          Across the venues
        </h3>
        <p className="text-[11px] text-cream-muted mt-0.5">
          Last 14 days, venue by venue — each axis scaled to the leading venue (=100)
        </p>
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <RadarCompare data={radarData} series={series} height={240} />
        <div className="grid grid-cols-1 gap-2">
          {pulse.map((p, i) => {
            const delta = p.positive - p.negative;
            return (
              <div
                key={p.name}
                className="flex items-center gap-2 flex-wrap rounded-xl border border-line bg-[rgba(43,34,26,0.02)] px-3 py-2"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: LOC_COLORS[i % LOC_COLORS.length] }}
                  aria-hidden
                />
                <span className="text-sm text-cream truncate" style={{ fontFamily: "var(--font-display), serif" }}>
                  {p.name}
                </span>
                <span className="font-mono text-[10px] text-cream-faint whitespace-nowrap">
                  {p.mentions} mention{p.mentions === 1 ? "" : "s"}
                </span>
                <span className="ml-auto flex items-center gap-1.5 flex-wrap">
                  <Badge tone={delta > 0 ? "good" : delta < 0 ? "bad" : "neutral"}>
                    {delta >= 0 ? `+${delta}` : delta} net
                  </Badge>
                  {p.top_dish ? (
                    <span className="rounded-full border border-[rgba(63,146,104,0.3)] bg-[rgba(63,146,104,0.07)] px-2 py-0.5 text-[10px] text-eucalyptus whitespace-nowrap">
                      hero dish · {p.top_dish}
                    </span>
                  ) : (
                    <span className="text-[10px] text-cream-faint whitespace-nowrap">no standout dish yet</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-7 rounded-full border px-3 text-[11px] font-medium transition-all",
        active
          ? "border-[rgba(196,99,58,0.45)] bg-[rgba(196,99,58,0.14)] text-cream"
          : "border-line text-cream-muted hover:text-cream hover:border-line-strong"
      )}
    >
      {children}
    </button>
  );
}

function ActiveFilterChip({ name, value, onClear }: { name: string; value: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      title={`Remove ${name} filter`}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[rgba(201,127,61,0.4)] bg-[rgba(201,127,61,0.12)] px-2.5 text-[11px] text-amber hover:bg-[rgba(201,127,61,0.2)] transition-colors"
    >
      <span className="opacity-70">{name}:</span>
      <span className="max-w-40 truncate">{value}</span>
      <X className="h-3 w-3 shrink-0" />
    </button>
  );
}

function FeedCard({
  item, index, onTopicClick, onDishClick,
}: {
  item: SocialItem;
  index: number;
  onTopicClick: (topic: string) => void;
  onDishClick: (dish: string) => void;
}) {
  const SourceIcon = SOURCE_ICONS[item.source] ?? MessageSquare;
  const rating = item.rating === null ? null : Number(item.rating);

  const sentimentBadge = !item.analyzed_at ? (
    <Badge tone="warn">unanalysed</Badge>
  ) : item.sentiment === "positive" ? (
    <Badge tone="good">positive</Badge>
  ) : item.sentiment === "negative" ? (
    <Badge tone="bad">negative</Badge>
  ) : (
    <Badge tone="neutral">{item.sentiment ?? "neutral"}</Badge>
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.4, ease: [0.21, 0.8, 0.32, 1] }}
      style={item.is_flagged ? { borderColor: "rgba(207,75,59,0.4)" } : undefined}
      className="group glass glass-hover rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full border border-line bg-[rgba(43,34,26,0.06)] flex items-center justify-center text-[11px] font-medium text-cream-muted">
          {initials(item.author_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-cream">{item.author_name ?? "Anonymous"}</span>
            {item.author_handle && (
              <span className="text-[11px] text-cream-faint">@{item.author_handle.replace(/^@/, "")}</span>
            )}
            {item.location && <Badge tone="neutral">{item.location}</Badge>}
            {item.is_flagged && <ShieldAlert className="h-3.5 w-3.5 text-bad shrink-0" />}
          </div>
          {rating !== null && (
            <div className="flex items-center gap-0.5 mt-1" aria-label={`${rating} star rating`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn("h-3 w-3", n <= rating ? "fill-amber text-amber" : "text-cream-faint")} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          <SourceIcon className="h-3.5 w-3.5 text-cream-faint" aria-label={SOURCE_LABELS[item.source] ?? item.source} />
          <span className="text-[10px] text-cream-faint whitespace-nowrap">{timeAgo(item.posted_at)}</span>
        </div>
      </div>

      {item.text && <p className="mt-2.5 text-sm text-cream leading-relaxed">{item.text}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {sentimentBadge}
        {(item.topics ?? []).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTopicClick(t)}
            title={`Filter the feed by topic "${t}"`}
            className="rounded-full border border-line px-2 py-0.5 text-[10px] text-cream-muted hover:text-cream hover:border-line-strong transition-colors"
          >
            {t}
          </button>
        ))}
        {(item.dish_mentions ?? []).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onDishClick(d)}
            title={`Filter the feed by dish "${d}"`}
            className="rounded-full border border-[rgba(63,146,104,0.3)] bg-[rgba(63,146,104,0.07)] px-2 py-0.5 text-[10px] text-eucalyptus hover:bg-[rgba(63,146,104,0.16)] hover:border-[rgba(63,146,104,0.5)] transition-colors"
          >
            {d}
          </button>
        ))}
        {/* hover-card content is pointer-events-none, so the agent handoff lives on the visible row */}
        <AskPalateButton
          prompt={`A customer review from ${item.author_name ?? "an anonymous customer"} on ${SOURCE_LABELS[item.source] ?? item.source} says: "${item.text ?? "(no text — media only)"}". Draft how we should respond and what we should learn from it.`}
          className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        />
      </div>
    </motion.article>
  );
}

/** Short, chip-safe rendering of an insight metric value. */
function metricValue(v: unknown): string {
  const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
  return s.length > 24 ? `${s.slice(0, 24)}…` : s;
}

/** Hover card for a feed item — the full mention at a glance. */
function FeedHoverCard({ item }: { item: SocialItem }) {
  const score = item.sentiment_score === null ? null : Number(item.sentiment_score);
  const negative = item.sentiment === "negative" || (score ?? 0) < 0;
  const topics = item.topics ?? [];
  const dishes = item.dish_mentions ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-cream">{item.author_name ?? "Anonymous"}</span>
        {item.author_handle && (
          <span className="text-[10px] text-cream-faint">@{item.author_handle.replace(/^@/, "")}</span>
        )}
        <Badge tone="neutral">{SOURCE_LABELS[item.source] ?? item.source}</Badge>
        {item.location && <Badge tone="neutral">{item.location}</Badge>}
      </div>

      {item.text && <p className="text-xs text-cream leading-relaxed">{item.text}</p>}

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-[10px] capitalize shrink-0",
            item.sentiment === "positive" ? "text-good" : item.sentiment === "negative" ? "text-bad" : "text-cream-muted"
          )}
        >
          {item.sentiment ?? "unanalysed"}
        </span>
        <span className={cn("font-mono text-[10px] shrink-0", negative ? "text-bad" : "text-good")}>
          {score === null ? "—" : `${score >= 0 ? "+" : ""}${score.toFixed(2)}`}
        </span>
        <span className="h-1 flex-1 rounded-full bg-[rgba(43,34,26,0.07)] overflow-hidden">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.round(Math.min(1, Math.abs(score ?? 0)) * 100)}%`,
              background: negative
                ? "linear-gradient(90deg, rgba(207,75,59,0.3), #cf4b3b)"
                : "linear-gradient(90deg, rgba(63,146,104,0.3), #6fbf94)",
            }}
          />
        </span>
      </div>

      {(topics.length > 0 || dishes.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {topics.map((t) => (
            <span key={t} className="rounded-full border border-line px-1.5 py-px text-[9px] text-cream-muted">
              {t}
            </span>
          ))}
          {dishes.map((d) => (
            <span
              key={d}
              className="rounded-full border border-[rgba(63,146,104,0.3)] bg-[rgba(63,146,104,0.07)] px-1.5 py-px text-[9px] text-eucalyptus"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      <div>
        <HoverRow label="posted">{fmtDateTime(item.posted_at)}</HoverRow>
        <HoverRow label="analysed">{item.analyzed_at ? timeAgo(item.analyzed_at) : "not yet"}</HoverRow>
      </div>
    </div>
  );
}

/** Hover card for an insight — full summary, evidence quotes and metrics. */
function InsightHoverCard({ insight }: { insight: Insight }) {
  const badgeTone = insight.severity === "critical" ? "bad" : insight.severity === "warning" ? "warn" : "info";
  const quotes = (insight.evidence ?? []).slice(0, 4);
  const metricEntries = Object.entries(insight.metrics ?? {});

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge tone={badgeTone}>{insight.severity}</Badge>
        <Badge tone="neutral">{insight.kind.replaceAll("_", " ")}</Badge>
      </div>
      <p className="text-[11px] text-cream-muted leading-relaxed">{insight.summary}</p>
      {quotes.length > 0 && (
        <div>
          {quotes.map((q, i) => (
            <HoverQuote key={`${q.social_item_id}-${i}`}>{q.quote}</HoverQuote>
          ))}
        </div>
      )}
      {metricEntries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {metricEntries.map(([k, v]) => (
            <span
              key={k}
              className="rounded-full border border-line bg-[rgba(43,34,26,0.03)] px-1.5 py-0.5 font-mono text-[9px] text-cream-faint"
            >
              {k}: {metricValue(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CompactInsight({ insight, index }: { insight: Insight; index: number }) {
  const [open, setOpen] = React.useState(false);
  const severityColor =
    insight.severity === "critical" ? "#cf4b3b"
    : insight.severity === "warning" ? "#b98a23"
    : "rgba(43,34,26,0.16)";
  const badgeTone = insight.severity === "critical" ? "bad" : insight.severity === "warning" ? "warn" : "info";
  const quotes = (insight.evidence ?? []).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.06, duration: 0.4, ease: [0.21, 0.8, 0.32, 1] }}
      style={{ borderLeftColor: severityColor, borderLeftWidth: 2 }}
      className={cn("group glass rounded-2xl p-3.5", insight.severity === "critical" && insight.status === "new" && "accent-ring")}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge tone={badgeTone}>{insight.severity}</Badge>
        <Badge tone="neutral">{insight.kind.replaceAll("_", " ")}</Badge>
        <span className="ml-auto text-[10px] text-cream-faint">{timeAgo(insight.created_at)}</span>
      </div>
      <p className="mt-2 text-sm text-cream leading-snug" style={{ fontFamily: "var(--font-display), serif" }}>
        {insight.title}
      </p>
      <p className={cn("mt-1 text-[11px] text-cream-muted leading-relaxed", !open && "line-clamp-2")}>
        {insight.summary}
      </p>
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {quotes > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-[rgba(43,34,26,0.03)] px-2 py-0.5 text-[10px] text-cream-muted">
            <MessageSquareQuote className="h-3 w-3 text-cream-faint" />
            {quotes} quote{quotes === 1 ? "" : "s"}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-[rgba(43,34,26,0.03)] px-2 py-0.5 text-[10px] text-cream-faint">
          {insight.status !== "new" && <CheckCircle2 className="h-3 w-3" />}
          {insight.status}
        </span>
        {/* hover-card content is pointer-events-none, so the agent handoff lives on the visible row */}
        <AskPalateButton
          prompt={`Dig deeper into the listening insight "${insight.title}". Summary: ${insight.summary} Analyse what is driving it and propose one concrete action we should take.`}
          className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? "Collapse summary" : "Read full summary"}
          className="h-5 w-5 shrink-0 rounded-full border border-line text-cream-faint hover:text-cream hover:border-line-strong flex items-center justify-center transition-colors"
        >
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      </div>
    </motion.div>
  );
}
