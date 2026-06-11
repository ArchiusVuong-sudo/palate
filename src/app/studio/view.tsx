"use client";

/**
 * Overview — the command centre. Morning greeting, pulse metrics, sentiment
 * charts, insights needing attention, agent proposals and the live canvas.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity, ArrowRight, CheckCheck, CheckCircle2, Ear, Film, Flame, Hash, MessageSquareQuote, PieChart, Sparkles,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { HoverDetail, HoverQuote, HoverRow } from "@/components/ui/hover-detail";
import { Donut, MetricCard, TopicBars, TrendArea } from "@/components/charts/charts";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { RunConsole } from "@/components/agent/run-console";
import { useRunStream } from "@/components/agent/use-run-stream";
import { cn, fmtNumber, fmtUsd, SOURCE_LABELS, timeAgo } from "@/lib/format";
import type { AgentRun, Asset, CanvasBlockRow, Insight, ProposedAction } from "@/lib/queries";

type OverviewStats = {
  mentions_72h: string; mentions_prev_72h: string; avg_sentiment: string | null;
  avg_rating_14d: string | null; negative_pct: string | null; unanalyzed: string;
  pending_approvals: string; flagged: string;
};
type TrendRow = { day: string; positive: number; negative: number; neutral: number };
type NameValue = { name: string; value: number };
type Dish = { name: string; value: number; avg_sentiment: number | null };

const SOURCE_COLORS: Record<string, string> = {
  google_reviews: "#b98a23",
  facebook: "#4f87ad",
  instagram: "#b58ad6",
  gmail: "#cf4b3b",
};

const WORKFLOW_LABELS: Record<string, string> = {
  pipeline: "Full pipeline",
  listening: "Morning sweep",
  briefing: "Briefing",
  creative: "Creative",
  review: "Review",
  copilot: "Copilot",
};

const FORMAT_LABELS: Record<string, string> = {
  story_9x16: "story 9:16",
  feed_4x5: "feed 4:5",
  feed_1x1: "1:1",
  landscape_16x9: "16:9",
};

/** Short, chip-safe rendering of an insight metric value. */
function metricValue(v: unknown): string {
  const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
  return s.length > 24 ? `${s.slice(0, 24)}…` : s;
}

export function OverviewView({
  stats, trend, topics, dishes, sources, insights, actions, blocks, runs, assets,
}: {
  stats: OverviewStats;
  trend: TrendRow[];
  topics: NameValue[];
  dishes: Dish[];
  sources: NameValue[];
  insights: Insight[];
  actions: ProposedAction[];
  blocks: CanvasBlockRow[];
  runs: AgentRun[];
  assets: Asset[];
}) {
  const router = useRouter();
  const { state, start, decide, busy, reset } = useRunStream({ onDone: () => router.refresh() });
  const [activeWorkflow, setActiveWorkflow] = React.useState<string | null>(null);
  const [ackBusy, setAckBusy] = React.useState<string | null>(null);
  const [actionBusy, setActionBusy] = React.useState<string | null>(null);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  /* ── derived metrics ── */
  const mentions = Number(stats.mentions_72h);
  const prevMentions = Number(stats.mentions_prev_72h);
  const mentionsDelta = prevMentions > 0 ? Math.round(((mentions - prevMentions) / prevMentions) * 100) : undefined;
  const avgSentiment = stats.avg_sentiment === null ? null : Number(stats.avg_sentiment);
  const avgRating = stats.avg_rating_14d === null ? null : Number(stats.avg_rating_14d);
  const pendingApprovals = Number(stats.pending_approvals);

  const trendData = trend.map((t) => ({ label: t.day, positive: t.positive, negative: t.negative }));
  /* sparklines from the daily trend — last 14 points */
  const spark14 = trend.slice(-14);
  const mentionsSpark = spark14.map((t) => t.positive + t.negative + (t.neutral ?? 0));
  const sentimentSpark = spark14.map((t) => t.positive - t.negative);
  const donutData = sources.map((s, i) => ({
    name: SOURCE_LABELS[s.name] ?? s.name,
    value: s.value,
    color: SOURCE_COLORS[s.name] ?? ["#e8a062", "#6fbf94", "#4f87ad", "#c4633a"][i % 4],
  }));
  const totalMentions = sources.reduce((a, b) => a + b.value, 0);
  const openInsights = insights.filter((i) => i.status === "new").length;
  const creative = assets.filter((a) => (a.kind === "image" || a.kind === "video") && a.public_url).slice(0, 12);

  const runWorkflow = (workflow: "pipeline" | "listening") => {
    setActiveWorkflow(workflow);
    void start({ workflow });
  };

  const acknowledge = async (id: string) => {
    setAckBusy(id);
    try {
      const res = await fetch(`/api/insights/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "acknowledged" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Insight acknowledged");
      router.refresh();
    } catch {
      toast.error("Couldn't update that insight");
    } finally {
      setAckBusy(null);
    }
  };

  const decideAction = async (id: string, status: "approved" | "dismissed") => {
    setActionBusy(`${id}:${status}`);
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as { runId?: string };
      if (!res.ok) throw new Error();
      if (status === "approved") toast.success(data.runId ? "Briefing agent started" : "Proposal approved");
      else toast("Proposal dismissed");
      router.refresh();
    } catch {
      toast.error("Couldn't update that proposal");
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div>
      {/* ── 1 · greeting header ── */}
      <SectionTitle
        title={
          <span className="block text-[1.9rem] leading-[1.15]">
            {greeting} <span className="text-cream-faint">—</span> <em className="text-gradient whitespace-nowrap">{dateStr}</em>
          </span>
        }
        subtitle="Here's what your customers are saying"
        right={
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => runWorkflow("listening")}>
              <Ear className="h-3.5 w-3.5" />
              Morning sweep
            </Button>
            <Button disabled={busy} onClick={() => runWorkflow("pipeline")}>
              <Sparkles className="h-4 w-4" />
              Run full pipeline
            </Button>
          </div>
        }
      />

      <div className="mt-5 space-y-5">
        {/* ── 2 · live agent console ── */}
        {state.status !== "idle" && (
          <Card className="p-4 max-h-[55vh] overflow-hidden flex flex-col animate-in-up">
            <div className="flex items-center gap-2 mb-3 shrink-0">
              <span className={cn("dot", busy ? "bg-eucalyptus dot-pulse" : "bg-cream-faint")} />
              <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">
                {WORKFLOW_LABELS[activeWorkflow ?? ""] ?? "Agent run"} {busy ? "· working" : "· finished"}
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

        {/* ── 3 · metric row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            index={0}
            label="Mentions · 72h"
            value={mentions}
            delta={mentionsDelta}
            caption="vs previous 72 hours"
            spark={mentionsSpark}
          />
          <MetricCard
            index={1}
            label="Avg sentiment"
            value={avgSentiment ?? "—"}
            tone={avgSentiment !== null && avgSentiment > 0.3 ? "good" : avgSentiment !== null && avgSentiment < 0 ? "bad" : "neutral"}
            caption="scale −1 to 1 · last 14 days"
            spark={sentimentSpark}
          />
          <MetricCard
            index={2}
            label="Avg rating · 14d"
            value={avgRating ?? "—"}
            suffix={avgRating !== null ? "★" : undefined}
            tone={avgRating !== null && avgRating >= 4.2 ? "good" : "neutral"}
            caption="out of 5"
          />
          <MetricCard
            index={3}
            label="Pending approvals"
            value={pendingApprovals}
            tone={pendingApprovals > 0 ? "bad" : "neutral"}
            caption="waiting on you"
          />
        </div>

        {/* ── 3b · latest creative catalogue strip ── */}
        {creative.length > 0 && (
          <section>
            <Link href="/studio/creative" className="group flex items-end justify-between gap-3">
              <div>
                <h3 className="text-lg text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
                  Latest creative
                </h3>
                <p className="text-[11px] text-cream-muted mt-0.5">Fresh variants from the creative studio</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-cream-muted group-hover:text-cream transition-colors shrink-0">
                Open studio <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1.5">
              {creative.map((a) => (
                <HoverDetail key={a.id} side="top" width={300} content={<AssetHoverCard asset={a} />}>
                  <div className="relative shrink-0">
                    {a.kind === "video" ? (
                      <>
                        <video
                          src={a.public_url ?? undefined}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-28 w-auto min-w-20 rounded-xl border border-line object-cover"
                        />
                        <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-black/60 backdrop-blur border border-line flex items-center justify-center">
                          <Film className="h-3 w-3 text-amber" />
                        </span>
                      </>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={a.public_url ?? ""}
                        alt={a.variant_label ?? "creative asset"}
                        loading="lazy"
                        decoding="async"
                        className="h-28 w-auto min-w-20 rounded-xl border border-line object-cover"
                      />
                    )}
                    {a.variant_label && (
                      <Badge tone="accent" className="absolute bottom-1.5 left-1.5 px-1.5 py-0 text-[9px] bg-black/55 backdrop-blur">
                        {a.variant_label}
                      </Badge>
                    )}
                    {a.format && (
                      <span className="absolute bottom-1.5 right-1.5 rounded-full border border-line bg-black/60 backdrop-blur px-1.5 py-0.5 font-mono text-[9px] text-cream-faint">
                        {FORMAT_LABELS[a.format] ?? a.format}
                      </span>
                    )}
                  </div>
                </HoverDetail>
              ))}
            </div>
          </section>
        )}

        {/* ── 4 · sentiment pulse + sources ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="p-5 lg:col-span-3">
            <CardTitle hint="Daily positive vs negative mentions">Sentiment pulse — 14 days</CardTitle>
            <TrendArea
              data={trendData}
              series={[
                { key: "positive", name: "Positive", color: "#6fbf94" },
                { key: "negative", name: "Negative", color: "#cf4b3b" },
              ]}
              height={244}
              stacked={false}
            />
          </Card>
          <Card className="p-5 lg:col-span-2">
            <CardTitle hint="Mentions by source · 14 days">Where it&apos;s happening</CardTitle>
            {donutData.length === 0 ? (
              <EmptyState className="py-10" icon={<PieChart />} title="No mentions yet" hint="Run a sweep to pull in the latest chatter." />
            ) : (
              <>
                <Donut data={donutData} height={196} centerLabel={{ value: fmtNumber(totalMentions), caption: "mentions" }} />
                <div className="mt-3 grid grid-cols-1 gap-1.5">
                  {donutData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-cream-muted">{d.name}</span>
                      <span className="ml-auto font-mono text-cream-faint">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* ── 5 · trending dishes + topics ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <CardTitle hint="Most-mentioned dishes · 7 days">What&apos;s trending on the pass</CardTitle>
            {dishes.length === 0 ? (
              <EmptyState className="py-8" icon={<Flame />} title="No dish mentions yet" hint="The agent tags dishes as it analyses reviews and comments." />
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {dishes.map((d, i) => {
                  const tone =
                    d.avg_sentiment !== null && d.avg_sentiment > 0.3 ? "good"
                    : d.avg_sentiment !== null && d.avg_sentiment < -0.1 ? "bad"
                    : "neutral";
                  return (
                    <motion.div
                      key={d.name}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4, ease: [0.21, 0.8, 0.32, 1] }}
                      className="flex items-center gap-3 rounded-xl border border-line/60 bg-[rgba(43,34,26,0.02)] px-3 py-2.5"
                    >
                      <span className="font-mono text-[11px] text-cream-faint w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-sm text-cream flex-1 min-w-0 truncate">{d.name}</span>
                      <span className="font-mono text-[11px] text-cream-faint shrink-0">
                        {d.value} mention{d.value === 1 ? "" : "s"}
                      </span>
                      <Badge tone={tone}>
                        {d.avg_sentiment === null ? "—" : `${d.avg_sentiment > 0 ? "+" : ""}${d.avg_sentiment.toFixed(2)}`}
                      </Badge>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
          <Card className="p-5">
            <CardTitle hint="What people keep bringing up · 14 days">Top topics</CardTitle>
            {topics.length === 0 ? (
              <EmptyState className="py-8" icon={<Hash />} title="No topics yet" hint="Topics appear once the agent has analysed your mentions." />
            ) : (
              <TopicBars data={topics} height={Math.max(190, topics.length * 34)} />
            )}
            <Link
              href="/studio/listening"
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-cream-muted hover:text-cream transition-colors"
            >
              click through in Listening <ArrowRight className="h-3 w-3" />
            </Link>
          </Card>
        </div>

        {/* ── 6 · needs your attention ── */}
        <section>
          <SubHeader
            title="Needs your attention"
            hint="Insights surfaced by the latest sweeps"
            right={openInsights > 0 ? <Badge tone="accent">{openInsights} open</Badge> : undefined}
          />
          {insights.length === 0 ? (
            <Card className="mt-3">
              <EmptyState
                className="py-8"
                icon={<CheckCircle2 />}
                title="Nothing needs your attention"
                hint="The agent will flag anything unusual after the next sweep."
              />
            </Card>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {insights.map((insight, i) => (
                <HoverDetail key={insight.id} width={360} content={<InsightHoverCard insight={insight} />}>
                  <InsightCard
                    insight={insight}
                    index={i}
                    acking={ackBusy === insight.id}
                    onAcknowledge={() => acknowledge(insight.id)}
                  />
                </HoverDetail>
              ))}
            </div>
          )}
        </section>

        {/* ── 7 · agent proposals ── */}
        {actions.length > 0 && (
          <section>
            <SubHeader
              title="Agent proposals"
              hint="Moves the agent recommends — approving a brief starts the briefing agent"
              right={<Badge tone="agent">{actions.length} proposed</Badge>}
            />
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {actions.map((action, i) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4, ease: [0.21, 0.8, 0.32, 1] }}
                >
                  <Card className="p-4 h-full flex flex-col">
                    <div className="flex items-center gap-2">
                      <Badge tone="agent">{action.kind.replaceAll("_", " ")}</Badge>
                      <span className="ml-auto text-[10px] text-cream-faint">{timeAgo(action.created_at)}</span>
                    </div>
                    <p className="mt-2.5 text-[15px] text-cream leading-snug" style={{ fontFamily: "var(--font-display), serif" }}>
                      {action.title}
                    </p>
                    {action.rationale && (
                      <p className="mt-1.5 text-xs text-cream-muted leading-relaxed line-clamp-2">{action.rationale}</p>
                    )}
                    <div className="mt-auto pt-3 flex items-center gap-2">
                      <Button
                        size="sm"
                        loading={actionBusy === `${action.id}:approved`}
                        disabled={actionBusy !== null}
                        onClick={() => decideAction(action.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={actionBusy === `${action.id}:dismissed`}
                        disabled={actionBusy !== null}
                        onClick={() => decideAction(action.id, "dismissed")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── 8 · agent canvas ── */}
        {blocks.length > 0 && (
          <section>
            <SubHeader title="Agent canvas" hint="Charts and notes the agent published during its runs" />
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {blocks.map((block) => (
                <div key={block.id} className={cn((block.kind === "chart" || block.kind === "table") && "md:col-span-2")}>
                  <BlockRenderer block={block} />
                  <p className="mt-1.5 text-[10px] text-cream-faint text-right">
                    {timeAgo(block.created_at)}
                    {block.pinned && " · pinned"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 9 · recent runs footer ── */}
        {runs.length > 0 && (
          <Card className="p-3">
            <div className="flex items-center justify-between px-2 pb-1.5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint flex items-center gap-1.5">
                <Activity className="h-3 w-3" /> Recent agent runs
              </p>
              <Link href="/studio/runs" className="text-[11px] text-amber hover:underline inline-flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-0.5">
              {runs.map((run) => (
                <Link
                  key={run.id}
                  href="/studio/runs"
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[rgba(43,34,26,0.04)] transition-colors"
                >
                  <span className="text-xs text-cream w-28 shrink-0">{WORKFLOW_LABELS[run.workflow] ?? run.workflow}</span>
                  <Badge tone={run.status === "completed" ? "good" : run.status === "failed" ? "bad" : run.status === "running" ? "info" : "neutral"}>
                    {run.status}
                  </Badge>
                  {run.summary && <span className="hidden md:block text-[11px] text-cream-faint truncate flex-1 min-w-0">{run.summary}</span>}
                  <span className="ml-auto text-[11px] text-cream-faint whitespace-nowrap">{timeAgo(run.started_at)}</span>
                  <span className="font-mono text-[11px] text-cream-faint w-14 text-right shrink-0">{fmtUsd(run.cost_usd)}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── local pieces ───────────────────────── */

function CardTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg text-cream leading-tight" style={{ fontFamily: "var(--font-display), serif" }}>
        {children}
      </h3>
      {hint && <p className="text-[11px] text-cream-faint mt-0.5">{hint}</p>}
    </div>
  );
}

function SubHeader({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h3 className="text-lg text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
          {title}
        </h3>
        {hint && <p className="text-[11px] text-cream-muted mt-0.5">{hint}</p>}
      </div>
      {right}
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

/** Hover card for a creative thumbnail — larger preview plus provenance. */
function AssetHoverCard({ asset }: { asset: Asset }) {
  return (
    <div className="space-y-2">
      {asset.kind === "video" ? (
        <p className="flex items-center gap-1.5 text-[11px] text-cream-muted">
          <Film className="h-3.5 w-3.5 text-amber shrink-0" />
          Video asset — open the Creative studio to play it
        </p>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={asset.public_url ?? ""}
          alt={asset.variant_label ?? "creative asset"}
          loading="lazy"
          decoding="async"
          className="max-h-44 rounded-lg w-full object-cover"
        />
      )}
      <div>
        <HoverRow label="variant">{asset.variant_label ?? "—"}</HoverRow>
        <HoverRow label="format">{FORMAT_LABELS[asset.format ?? ""] ?? asset.format ?? "—"}</HoverRow>
        <HoverRow label="model">{asset.model ?? "—"}</HoverRow>
        <HoverRow label="cost">{fmtUsd(asset.cost_usd)}</HoverRow>
        <HoverRow label="created">{timeAgo(asset.created_at)}</HoverRow>
        {asset.prompt && (
          <HoverRow label="prompt">
            <span className="line-clamp-3 text-[10px] font-mono text-cream-faint leading-relaxed">{asset.prompt}</span>
          </HoverRow>
        )}
      </div>
    </div>
  );
}

function InsightCard({
  insight, index, acking, onAcknowledge,
}: {
  insight: Insight;
  index: number;
  acking: boolean;
  onAcknowledge: () => void;
}) {
  const severityColor =
    insight.severity === "critical" ? "#cf4b3b"
    : insight.severity === "warning" ? "#b98a23"
    : "rgba(43,34,26,0.16)";
  const badgeTone = insight.severity === "critical" ? "bad" : insight.severity === "warning" ? "warn" : "info";
  const isOpen = insight.status === "new";
  const evidenceCount = (insight.evidence ?? []).length;
  const metricEntries = Object.entries(insight.metrics ?? {}).slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.21, 0.8, 0.32, 1] }}
      style={{ borderLeftColor: severityColor, borderLeftWidth: 2 }}
      className={cn(
        "glass rounded-2xl p-4 h-full flex flex-col",
        insight.severity === "critical" && isOpen && "accent-ring",
        !isOpen && "opacity-70"
      )}
    >
      <div className="flex items-center gap-2">
        <Badge tone={badgeTone}>{insight.kind.replaceAll("_", " ")}</Badge>
        {!isOpen && <Badge tone="neutral">{insight.status}</Badge>}
        <span className="ml-auto text-[10px] text-cream-faint">{timeAgo(insight.created_at)}</span>
      </div>
      <p className="mt-2.5 text-[15px] text-cream leading-snug" style={{ fontFamily: "var(--font-display), serif" }}>
        {insight.title}
      </p>
      <p className="mt-1.5 text-xs text-cream-muted leading-relaxed line-clamp-2">{insight.summary}</p>
      {(evidenceCount > 0 || metricEntries.length > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {evidenceCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-[rgba(43,34,26,0.03)] px-2 py-0.5 text-[10px] text-cream-muted">
              <MessageSquareQuote className="h-3 w-3 text-cream-faint" />
              {evidenceCount} quote{evidenceCount === 1 ? "" : "s"}
            </span>
          )}
          {metricEntries.map(([k, v]) => (
            <span
              key={k}
              className="rounded-full border border-line bg-[rgba(43,34,26,0.03)] px-2 py-0.5 font-mono text-[10px] text-cream-faint"
            >
              {k}: {metricValue(v)}
            </span>
          ))}
        </div>
      )}
      {isOpen && (
        <div className="mt-auto pt-3 flex justify-end">
          <Button size="sm" variant="ghost" loading={acking} onClick={onAcknowledge}>
            <CheckCheck className="h-3.5 w-3.5" />
            Acknowledge
          </Button>
        </div>
      )}
    </motion.div>
  );
}
