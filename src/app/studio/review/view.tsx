"use client";

/**
 * Review studio — workflow 4. Brand-consistency review runs, the human
 * approval queue, the publish pipeline board, and rubric verdicts (with
 * agent-annotated images).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarClock, CheckCircle2, ClipboardCheck, GripVertical, MessageSquareWarning,
  ScanEye, Send, ShieldCheck, Smartphone, Undo2,
} from "lucide-react";
import type { Approval, Asset, CanvasBlockRow, Post, Review } from "@/lib/queries";
import {
  Badge, Button, Card, EmptyState, Input, Modal, SectionTitle, WorkingDots,
} from "@/components/ui/primitives";
import { HoverDetail } from "@/components/ui/hover-detail";
import { ShowMoreButton } from "@/components/ui/lazy-list";
import { usePaged } from "@/components/ui/use-paged";
import { InstagramFrame } from "@/components/social/instagram-frame";
import { CompareSlider } from "@/components/social/compare-slider";
import { ScoreRing } from "@/components/charts/charts";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { RunConsole } from "@/components/agent/run-console";
import { useRunStream } from "@/components/agent/use-run-stream";
import { CHANNEL_LABELS, cn, fmtDateTime, timeAgo } from "@/lib/format";

/* ───────── helpers ───────── */

const IMG_RE = /^https?:\/\/.+\.(png|jpe?g|webp|gif)/i;

function contextImages(ctx: Record<string, unknown> | null | undefined): string[] {
  const urls: string[] = [];
  for (const v of Object.values(ctx ?? {})) {
    if (typeof v === "string" && IMG_RE.test(v)) urls.push(v);
    if (Array.isArray(v)) for (const x of v) if (typeof x === "string" && IMG_RE.test(x)) urls.push(x);
  }
  return urls;
}

function contextTexts(ctx: Record<string, unknown> | null | undefined): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(ctx ?? {})) {
    if (typeof v === "string" && !/^https?:\/\//i.test(v)) out.push([k, v]);
    else if (Array.isArray(v)) {
      const strs = v.filter((x): x is string => typeof x === "string" && !/^https?:\/\//i.test(x));
      if (strs.length) out.push([k, strs.join(" · ")]);
    }
  }
  return out;
}

function firstMedia(post: Post, assetById: Map<string, Asset>): Asset | undefined {
  const resolved = (post.asset_ids ?? [])
    .map((id) => assetById.get(id))
    .filter((a): a is Asset => Boolean(a?.public_url));
  return resolved.find((a) => a.kind !== "video") ?? resolved[0];
}

const VERDICT_TONE: Record<string, "good" | "warn" | "bad"> = {
  pass: "good",
  flag: "warn",
  reject: "bad",
};

const CRITERIA: { key: string; label: string }[] = [
  { key: "voice_tone", label: "Voice & tone" },
  { key: "visual_style", label: "Visual style" },
  { key: "guideline_compliance", label: "Guidelines" },
  { key: "message_accuracy", label: "Message accuracy" },
  { key: "audience_fit", label: "Audience fit" },
];

function criterionScore(scores: Review["scores"], key: string): { score: number; note?: string } | null {
  const raw = (scores ?? {})[key] as unknown;
  if (typeof raw === "number") return { score: raw };
  if (raw && typeof raw === "object" && typeof (raw as { score?: unknown }).score === "number") {
    const o = raw as { score: number; note?: string };
    return { score: o.score, note: typeof o.note === "string" ? o.note : undefined };
  }
  return null;
}

const barGradient = (score: number) =>
  score >= 75
    ? "linear-gradient(90deg, rgba(90,212,142,0.45), #5ad48e)"
    : score >= 50
      ? "linear-gradient(90deg, rgba(232,185,79,0.45), #e8b94f)"
      : "linear-gradient(90deg, rgba(239,116,102,0.45), #ef7466)";

const COLUMNS: { key: string; label: string; dot: string; match: (status: string) => boolean }[] = [
  { key: "in_review", label: "In review", dot: "#e8a062", match: (s) => s === "draft" || s === "in_review" },
  { key: "changes", label: "Changes requested", dot: "#e8b94f", match: (s) => s === "changes_requested" },
  { key: "approved", label: "Approved", dot: "#5ad48e", match: (s) => s === "approved" },
  { key: "shipped", label: "Scheduled & published", dot: "#7fb5d6", match: (s) => s === "scheduled" || s === "published" },
];

/** Column key → post status applied when a card is dropped there. */
const COLUMN_STATUS: Record<string, string> = {
  in_review: "in_review",
  changes: "changes_requested",
  approved: "approved",
  shipped: "scheduled",
};

const sixPmToday = () => {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
};

/* ───────── main view ───────── */

export function ReviewView({
  posts, reviews, assets, approvals, blocks,
}: {
  posts: Post[];
  reviews: Review[];
  assets: Asset[];
  approvals: Approval[];
  blocks: CanvasBlockRow[];
}) {
  const router = useRouter();
  const { state, start, decide, cancel, reset, busy } = useRunStream({ onDone: () => router.refresh() });
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [acting, setActing] = React.useState<string | null>(null);

  // Client copy of the pipeline for optimistic drag-and-drop moves.
  const [clientPosts, setClientPosts] = React.useState<Post[]>(posts);
  React.useEffect(() => setClientPosts(posts), [posts]);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [hoverCol, setHoverCol] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<Post | null>(null);

  const assetById = React.useMemo(() => new Map<string, Asset>(assets.map((a) => [a.id, a])), [assets]);
  const reviewById = React.useMemo(() => new Map<string, Review>(reviews.map((r) => [r.id, r])), [reviews]);
  const postById = React.useMemo(() => new Map<string, Post>(posts.map((p) => [p.id, p])), [posts]);
  const pending = approvals.filter((a) => a.status === "pending");
  const pagedReviews = usePaged(reviews, 6, "");

  const runReview = () => {
    if (!busy) void start({ workflow: "review" });
  };

  /** Works even mid-run — the API resolves the agent's blocked tool. */
  const decideApproval = async (id: string, decision: string) => {
    const key = `${id}:${decision}`;
    setActing(key);
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: notes[id]?.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
      }
      toast.success(
        decision === "approve"
          ? "Approved — the agent can carry on"
          : decision === "reject"
            ? "Rejected — the agent will stand down"
            : "Changes requested — the agent will revise"
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record the decision");
    } finally {
      setActing(null);
    }
  };

  const updatePost = async (postId: string, patch: Record<string, unknown>, success: string, key: string) => {
    setActing(key);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
      }
      toast.success(success);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the post");
    } finally {
      setActing(null);
    }
  };

  const consoleDecide = async (approvalId: string, decision: string, note?: string) => {
    await decide(approvalId, decision, note);
    router.refresh();
  };

  /** Native HTML5 drop — optimistic local move, then persist; revert on failure. */
  const dropOnColumn = async (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setHoverCol(null);
    setDraggingId(null);
    const id = e.dataTransfer.getData("text/plain");
    const col = COLUMNS.find((c) => c.key === colKey);
    const post = clientPosts.find((p) => p.id === id);
    const nextStatus = COLUMN_STATUS[colKey];
    if (!id || !col || !post || !nextStatus || col.match(post.status)) return;

    const patch: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "scheduled") patch.scheduled_at = sixPmToday();
    const previous = clientPosts;
    setClientPosts((cur) =>
      cur.map((p) =>
        p.id === id
          ? { ...p, status: nextStatus, ...(nextStatus === "scheduled" ? { scheduled_at: patch.scheduled_at as string } : {}) }
          : p
      )
    );
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
      }
      toast.success(`Moved to ${col.label}`);
      router.refresh();
    } catch (err) {
      setClientPosts(previous);
      toast.error(err instanceof Error ? err.message : "Couldn't move the post");
    }
  };

  return (
    <div className="pb-10">
      <SectionTitle
        title={<>Brand <em className="text-gradient">review</em></>}
        subtitle="Nothing ships without passing the brand contract"
        right={
          <Button onClick={runReview} loading={busy}>
            <ShieldCheck className="h-4 w-4" /> Run brand review
          </Button>
        }
      />

      {/* ───── live run console ───── */}
      {state.status !== "idle" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mt-5 p-4 flex flex-col max-h-[60vh]">
            <div className="flex items-center gap-2 border-b border-line pb-3 mb-3 shrink-0">
              <ShieldCheck className="h-4 w-4 text-amber" />
              <span className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">Brand review run</span>
              {busy && <WorkingDots />}
              <div className="ml-auto">
                {busy ? (
                  <Button variant="ghost" size="sm" onClick={() => void cancel()}>Cancel</Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={reset}>Dismiss</Button>
                )}
              </div>
            </div>
            <RunConsole state={state} onDecide={consoleDecide} className="flex-1" />
          </Card>
        </motion.div>
      )}

      {/* ───── pending approvals banner ───── */}
      {pending.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mt-5 p-4 accent-ring">
            <div className="flex items-center gap-2 flex-wrap">
              <MessageSquareWarning className="h-4 w-4 text-amber" />
              <span className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">Pending approvals</span>
              <Badge tone="accent">{pending.length}</Badge>
              <span className="ml-auto text-[11px] text-cream-faint">
                decisions land instantly — even while the agent waits mid-run
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3">
              {pending.map((a, i) => (
                <ApprovalRow
                  key={a.id}
                  approval={a}
                  index={i}
                  note={notes[a.id] ?? ""}
                  onNote={(v) => setNotes((n) => ({ ...n, [a.id]: v }))}
                  actingKey={acting}
                  onDecide={decideApproval}
                />
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ───── publish pipeline board ───── */}
      <section className="mt-8">
        <SectionTitle
          title="Publish pipeline"
          subtitle="Every post's path from draft to live — nothing skips the queue"
        />
        {clientPosts.length === 0 ? (
          <Card className="mt-4">
            <EmptyState
              icon={<ClipboardCheck />}
              title="No posts in the pipeline yet"
              hint="Run the brand review and the agent will assemble candidate posts, score them, and queue them here."
              action={
                <Button variant="outline" onClick={runReview} loading={busy}>
                  <ShieldCheck className="h-4 w-4" /> Run brand review
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {COLUMNS.map((col) => {
              const items = clientPosts.filter((p) => col.match(p.status));
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (hoverCol !== col.key) setHoverCol(col.key);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setHoverCol((c) => (c === col.key ? null : c));
                  }}
                  onDrop={(e) => void dropOnColumn(e, col.key)}
                  className={cn(
                    "rounded-2xl border border-transparent p-1.5 -m-1.5 transition-colors duration-150",
                    hoverCol === col.key && "border-[rgba(196,99,58,0.45)] bg-[rgba(196,99,58,0.06)]"
                  )}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className="dot" style={{ background: col.dot }} />
                    <span className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">{col.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-cream-faint">{items.length}</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-1 gap-3">
                    {items.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-[11px] text-cream-faint">
                        {hoverCol === col.key ? "drop to move here" : "nothing here"}
                      </p>
                    ) : (
                      items.map((post, i) => {
                        const review = post.review_id ? reviewById.get(post.review_id) : undefined;
                        return (
                          // display:contents wrapper — the draggable attribute stays on the card itself
                          <HoverDetail
                            key={post.id}
                            width={340}
                            openDelay={450}
                            disabled={draggingId !== null}
                            content={<PostHoverContent post={post} review={review} />}
                          >
                            <PostCard
                              post={post}
                              media={firstMedia(post, assetById)}
                              review={review}
                              index={i}
                              actingKey={acting}
                              onAction={updatePost}
                              dragging={draggingId === post.id}
                              onDragStart={() => setDraggingId(post.id)}
                              onDragEnd={() => {
                                setDraggingId(null);
                                setHoverCol(null);
                              }}
                              onPreview={() => setPreview(post)}
                            />
                          </HoverDetail>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ───── latest verdicts ───── */}
      <section className="mt-8">
        <SectionTitle
          title="Latest verdicts"
          subtitle="Rubric scores against the brand contract — annotated images mark exactly what's off"
        />
        {reviews.length === 0 ? (
          <Card className="mt-4">
            <EmptyState
              icon={<ScanEye />}
              title="No verdicts yet"
              hint="Run a brand review and the agent will score every draft on voice, visuals, guidelines, accuracy and audience fit."
              action={
                <Button variant="outline" onClick={runReview} loading={busy}>
                  <ShieldCheck className="h-4 w-4" /> Run brand review
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <div className="mt-4 grid md:grid-cols-2 gap-4 items-start">
              {pagedReviews.visible.map((r, i) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  post={r.post_id ? postById.get(r.post_id) : undefined}
                  originalUrl={(r.asset_id ? assetById.get(r.asset_id)?.public_url : null) ?? undefined}
                  index={i}
                />
              ))}
            </div>
            <ShowMoreButton
              className="mt-4"
              remaining={pagedReviews.remaining}
              onClick={pagedReviews.showMore}
              label={`Show ${Math.min(pagedReviews.remaining, 6)} more`}
            />
          </>
        )}
      </section>

      {/* ───── review canvas blocks ───── */}
      {blocks.length > 0 && (
        <section className="mt-8">
          <SectionTitle title="Review canvas" subtitle="Charts and notes the agent pinned from its review runs" />
          <div className="mt-4 grid md:grid-cols-2 gap-4 items-start">
            {blocks.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <BlockRenderer block={b} />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ───── Instagram phone preview ───── */}
      <Modal open={preview !== null} onClose={() => setPreview(null)}>
        {preview && <PhonePreview post={preview} media={firstMedia(preview, assetById)} />}
      </Modal>
    </div>
  );
}

/* ───────── Instagram phone preview (modal body) ───────── */

function PhonePreview({ post, media }: { post: Post; media?: Asset }) {
  return (
    <div className="relative overflow-hidden px-6 py-10">
      {/* soft radial glow behind the phone */}
      <div className="pointer-events-none absolute -top-16 -left-12 h-64 w-64 rounded-full bg-[rgba(196,99,58,0.22)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-[rgba(111,191,148,0.16)] blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-56 w-56 rounded-full bg-[rgba(232,160,98,0.12)] blur-3xl" />

      <div className="relative flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Smartphone className="h-3.5 w-3.5 text-amber" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">
            {CHANNEL_LABELS[post.channel] ?? post.channel} preview
          </span>
        </div>
        {media?.public_url ? (
          <InstagramFrame
            mode={post.channel === "instagram_story" ? "story" : "feed"}
            mediaUrl={media.public_url}
            mediaKind={media.kind === "video" ? "video" : "image"}
            caption={post.caption ?? undefined}
            hashtags={(post.hashtags ?? []).map((h) => `#${h.replace(/^#/, "")}`)}
          />
        ) : (
          <EmptyState
            icon={<Smartphone />}
            title="No media to preview"
            hint="This post has no resolvable image or video asset yet."
          />
        )}
      </div>
    </div>
  );
}

/* ───────── pending approval row ───────── */

function ApprovalRow({
  approval, index, note, onNote, actingKey, onDecide,
}: {
  approval: Approval;
  index: number;
  note: string;
  onNote: (v: string) => void;
  actingKey: string | null;
  onDecide: (id: string, decision: string) => void;
}) {
  const images = contextImages(approval.context);
  const texts = contextTexts(approval.context);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl border border-[rgba(232,160,98,0.28)] bg-[rgba(196,99,58,0.05)] p-3.5"
    >
      <div className="flex items-start gap-2 flex-wrap">
        <p className="text-sm text-cream leading-relaxed flex-1 min-w-[200px]">{approval.question}</p>
        <Badge tone="accent">{approval.subject_type}</Badge>
        <span className="text-[10px] text-cream-faint pt-1">{timeAgo(approval.created_at)}</span>
      </div>

      {images.length > 0 && (
        <div className="mt-2.5 flex gap-2 overflow-x-auto">
          {images.slice(0, 5).map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="approval context" className="h-20 rounded-lg border border-line object-cover" loading="lazy" decoding="async" />
          ))}
        </div>
      )}
      {texts.length > 0 && (
        <div className="mt-2.5 grid grid-cols-1 gap-1">
          {texts.slice(0, 5).map(([k, v]) => (
            <p key={k} className="text-[11px] leading-relaxed line-clamp-2">
              <span className="text-cream-faint">{k.replaceAll("_", " ")}: </span>
              <span className="text-cream-muted">{v.length > 280 ? `${v.slice(0, 280)}…` : v}</span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Optional note — the agent learns from this…"
          className="h-8 flex-1 min-w-[200px] text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={actingKey === `${approval.id}:approve`} onClick={() => onDecide(approval.id, "approve")}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button size="sm" variant="danger" loading={actingKey === `${approval.id}:reject`} onClick={() => onDecide(approval.id, "reject")}>
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={actingKey === `${approval.id}:request changes`}
            onClick={() => onDecide(approval.id, "request changes")}
          >
            Request changes
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ───────── pipeline card hover content ───────── */

const POST_STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "info"> = {
  draft: "neutral",
  in_review: "warn",
  changes_requested: "warn",
  approved: "good",
  scheduled: "info",
  published: "good",
};

function PostHoverContent({ post, review }: { post: Post; review?: Review }) {
  const rows = review
    ? CRITERIA.flatMap((c) => {
        const val = criterionScore(review.scores, c.key);
        return val ? [{ ...c, score: Math.min(100, Math.max(0, val.score)) }] : [];
      })
    : [];
  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge tone="info">{CHANNEL_LABELS[post.channel] ?? post.channel}</Badge>
        <Badge tone={POST_STATUS_TONE[post.status] ?? "neutral"}>{post.status.replaceAll("_", " ")}</Badge>
      </div>
      {post.caption && (
        <p className="mt-2 text-xs text-cream leading-relaxed whitespace-pre-wrap">{post.caption}</p>
      )}
      {(post.hashtags ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {post.hashtags.map((h) => (
            <span
              key={h}
              className="rounded-full border border-line bg-[rgba(244,237,227,0.04)] px-2 py-0.5 font-mono text-[10px] text-info"
            >
              #{h.replace(/^#/, "")}
            </span>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-1 border-t border-line/60 pt-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="w-[6.5rem] shrink-0 text-[10px] text-cream-muted">{r.label}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(244,237,227,0.08)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.score}%`, background: barGradient(r.score) }}
                />
              </div>
              <span className="w-6 shrink-0 text-right font-mono text-[9px] text-cream">{Math.round(r.score)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── pipeline post card ───────── */

function PostCard({
  post, media, review, index, actingKey, onAction, dragging, onDragStart, onDragEnd, onPreview,
}: {
  post: Post;
  media?: Asset;
  review?: Review;
  index: number;
  actingKey: string | null;
  onAction: (postId: string, patch: Record<string, unknown>, success: string, key: string) => void;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onPreview: () => void;
}) {
  const act = (action: string, patch: Record<string, unknown>, success: string) =>
    onAction(post.id, patch, success, `${post.id}:${action}`);
  const busyOn = (action: string) => actingKey === `${post.id}:${action}`;

  return (
    // Plain div (not motion.div): native HTML5 onDragStart/onDragEnd clash with framer-motion's drag props.
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", post.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "glass glass-hover rounded-2xl p-3.5 flex flex-col gap-2.5 animate-in-up cursor-grab active:cursor-grabbing min-w-0 max-w-full overflow-hidden",
        dragging && "opacity-50 ring-2 ring-[rgba(196,99,58,0.5)]"
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 0.06}s` }}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge tone="info" className="px-2 py-0 text-[10px]">{CHANNEL_LABELS[post.channel] ?? post.channel}</Badge>
        {post.status === "draft" && <Badge tone="neutral" className="px-2 py-0 text-[10px]">draft</Badge>}
        {post.status === "scheduled" && <Badge tone="info" className="px-2 py-0 text-[10px]">scheduled</Badge>}
        {post.status === "published" && <Badge tone="good" className="px-2 py-0 text-[10px]">published</Badge>}
        {review && (
          <Badge tone={VERDICT_TONE[review.verdict] ?? "neutral"} className="px-2 py-0 text-[10px] ml-auto">
            {review.verdict}
            {typeof review.overall_score === "number" ? ` · ${Math.round(review.overall_score)}` : ""}
          </Badge>
        )}
        <GripVertical className={cn("h-3.5 w-3.5 shrink-0 text-cream-faint", !review && "ml-auto")} />
      </div>

      {media?.public_url &&
        (media.kind === "video" ? (
          <video src={media.public_url} className="h-36 w-full object-cover rounded-xl border border-line" muted playsInline preload="metadata" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.public_url} alt={media.variant_label ?? "post asset"} className="h-36 w-full object-cover rounded-xl border border-line" loading="lazy" decoding="async" />
        ))}

      {post.caption && <p className="text-sm text-cream leading-relaxed line-clamp-3">{post.caption}</p>}
      {(post.hashtags ?? []).length > 0 && (
        <p className="font-mono text-[10px] text-cream-faint truncate">
          {post.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
        </p>
      )}

      <div className={cn("flex items-center justify-between text-[10px] text-cream-faint", !post.caption && "mt-auto")}>
        <span>{timeAgo(post.created_at)}</span>
        {post.status === "scheduled" && post.scheduled_at && <span className="font-mono">{fmtDateTime(post.scheduled_at)}</span>}
        {post.status === "published" && post.published_at && <span>live {timeAgo(post.published_at)}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(post.status === "draft" || post.status === "in_review") && (
          <>
            <Button size="sm" loading={busyOn("approve")} onClick={() => act("approve", { status: "approved" }, "Post approved — ready to schedule")}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" loading={busyOn("changes")} onClick={() => act("changes", { status: "changes_requested" }, "Changes requested on the post")}>
              Request changes
            </Button>
          </>
        )}
        {post.status === "changes_requested" && (
          <Button size="sm" variant="outline" loading={busyOn("back")} onClick={() => act("back", { status: "in_review" }, "Post is back in review")}>
            <Undo2 className="h-3.5 w-3.5" /> Back to review
          </Button>
        )}
        {post.status === "approved" && (
          <>
            <Button
              size="sm"
              variant="subtle"
              loading={busyOn("schedule")}
              onClick={() => act("schedule", { status: "scheduled", scheduled_at: sixPmToday() }, "Scheduled for 6:00 pm today")}
            >
              <CalendarClock className="h-3.5 w-3.5" /> Schedule 6pm today
            </Button>
            <Button size="sm" variant="ghost" loading={busyOn("publish")} onClick={() => act("publish", { status: "published" }, "Marked as published")}>
              <Send className="h-3.5 w-3.5" /> Mark published
            </Button>
          </>
        )}
        {post.status === "scheduled" && (
          <Button size="sm" variant="ghost" loading={busyOn("publish")} onClick={() => act("publish", { status: "published" }, "Marked as published")}>
            <Send className="h-3.5 w-3.5" /> Mark published
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto px-2"
          title="Instagram preview"
          aria-label="Instagram preview"
          onClick={onPreview}
        >
          <Smartphone className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ───────── verdict card ───────── */

function ReviewCard({
  review, post, originalUrl, index,
}: {
  review: Review;
  post?: Post;
  originalUrl?: string;
  index: number;
}) {
  const rows = CRITERIA.flatMap((c) => {
    const val = criterionScore(review.scores, c.key);
    return val ? [{ ...c, ...val }] : [];
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.06, duration: 0.4 }}
    >
      <Card className="p-5 h-full">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={VERDICT_TONE[review.verdict] ?? "neutral"}>{review.verdict}</Badge>
              {post && <Badge tone="info">{CHANNEL_LABELS[post.channel] ?? post.channel}</Badge>}
              <span className="text-[11px] text-cream-faint">{timeAgo(review.created_at)}</span>
            </div>

            {rows.length > 0 && (
              <div className="mt-3.5 grid grid-cols-1 gap-2">
                {rows.map((r) => {
                  const score = Math.min(100, Math.max(0, r.score));
                  return (
                    <div key={r.key} className="flex items-center gap-2.5" title={r.note}>
                      <span className="w-[7.5rem] shrink-0 text-[11px] text-cream-muted">{r.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-[rgba(244,237,227,0.08)] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: barGradient(score) }}
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 + Math.min(index, 6) * 0.06 }}
                        />
                      </div>
                      <span className="w-7 shrink-0 text-right font-mono text-[10px] text-cream">{Math.round(score)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {typeof review.overall_score === "number" && (
            <div className="shrink-0">
              <ScoreRing score={review.overall_score} size={56} label="overall" />
            </div>
          )}
        </div>

        {review.feedback && (
          <div className="prose-palate mt-3 border-t border-line pt-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{review.feedback}</ReactMarkdown>
          </div>
        )}

        {review.annotated_image_url &&
          (originalUrl ? (
            <div className="mt-4">
              <Badge tone="bad" className="bg-[rgba(12,15,13,0.85)] backdrop-blur-sm">
                <ScanEye className="h-3 w-3" /> agent-annotated
              </Badge>
              <div className="mt-2">
                <CompareSlider
                  beforeUrl={originalUrl}
                  afterUrl={review.annotated_image_url}
                  beforeLabel="original"
                  afterLabel="agent markup"
                  className="max-w-sm"
                />
              </div>
            </div>
          ) : (
            <div className="relative mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={review.annotated_image_url}
                alt="Agent-annotated review image"
                className="w-full rounded-xl border border-[rgba(239,116,102,0.35)]"
                loading="lazy"
                decoding="async"
              />
              <Badge tone="bad" className="absolute left-2.5 top-2.5 bg-[rgba(12,15,13,0.85)] backdrop-blur-sm">
                <ScanEye className="h-3 w-3" /> agent-annotated
              </Badge>
            </div>
          ))}
      </Card>
    </motion.div>
  );
}
