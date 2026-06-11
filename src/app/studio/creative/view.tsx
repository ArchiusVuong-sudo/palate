"use client";

/**
 * Creative studio — Gemini-generated variant packages per brief: images,
 * video and captions, with select/reject/refine curation and a lightbox.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, FileText, Film,
  Image as ImageIcon, ImagePlus, Palette, Play, Quote, Smartphone, Wand2, X,
} from "lucide-react";
import {
  Badge, Button, Card, EmptyState, Input, Modal, SectionTitle, Textarea,
} from "@/components/ui/primitives";
import { HoverDetail, HoverRow } from "@/components/ui/hover-detail";
import { ShowMoreButton } from "@/components/ui/lazy-list";
import { RunConsole } from "@/components/agent/run-console";
import { useRunStream } from "@/components/agent/use-run-stream";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { InstagramFrame } from "@/components/social/instagram-frame";
import { StoryPlayer, type StoryItem } from "@/components/social/story-player";
import type { Asset, Brief, CanvasBlockRow } from "@/lib/queries";
import { CHANNEL_LABELS, cn, fmtDate, fmtUsd, timeAgo } from "@/lib/format";

const serif = { fontFamily: "var(--font-display), serif" };

/* per-group gallery window — assets shown before the "Show all" expander */
const GROUP_PREVIEW = 9;

const FORMAT_LABELS: Record<string, string> = {
  story_9x16: "story 9:16",
  feed_4x5: "feed 4:5",
  feed_1x1: "1:1",
  landscape_16x9: "16:9",
};
const fmtFormat = (f: string | null) => (f ? FORMAT_LABELS[f] ?? f : "");

/* catalogue filters */
const KIND_PILLS = [
  { id: "all", label: "All" },
  { id: "image", label: "Images" },
  { id: "video", label: "Video" },
  { id: "caption", label: "Captions" },
] as const;
type KindFilter = (typeof KIND_PILLS)[number]["id"];

const STATUS_FILTER_PILLS = [
  { id: "all", label: "All" },
  { id: "selected", label: "Selected" },
  { id: "candidate", label: "Candidates" },
  { id: "rejected", label: "Rejected" },
] as const;
type StatusFilter = (typeof STATUS_FILTER_PILLS)[number]["id"];

const KIND_COUNT_META = [
  { kind: "image", label: "img", Icon: ImageIcon },
  { kind: "video", label: "vid", Icon: Film },
  { kind: "caption", label: "captions", Icon: Quote },
] as const;

type Group = { key: string; title: string; date: string | null; items: Asset[]; images: Asset[] };

function makeGroup(key: string, title: string, date: string | null, items: Asset[]): Group {
  return { key, title, date, items, images: items.filter((a) => a.kind === "image" && !!a.public_url) };
}

function captionParts(a: Asset): { text: string; tags: string[] } {
  const meta = (a.metadata ?? {}) as Record<string, unknown>;
  const tags = Array.isArray(meta.hashtags)
    ? (meta.hashtags as unknown[]).filter((t): t is string => typeof t === "string")
    : [];
  let text = a.caption_text ?? "";
  if (tags.length) {
    const tail = tags.join(" ");
    if (text.trimEnd().endsWith(tail)) text = text.trimEnd().slice(0, -tail.length).trimEnd();
  }
  return { text, tags };
}

/** Caption + hashtags ready for the Instagram preview. Prefers metadata.hashtags;
 *  otherwise extracts a trailing run of #tags from the caption text. */
function previewCaption(a: Asset): { text: string; tags: string[] } {
  const { text, tags } = captionParts(a);
  if (tags.length) return { text, tags: tags.map((t) => (t.startsWith("#") ? t : `#${t}`)) };
  const m = /(^|\s)(#[^\s#]+(?:\s+#[^\s#]+)*)\s*$/.exec(text);
  if (m && m[2]) return { text: text.slice(0, m.index).trimEnd(), tags: m[2].split(/\s+/) };
  return { text, tags: [] };
}

export function CreativeView({
  briefs,
  assets,
  blocks,
}: {
  briefs: Brief[];
  assets: Asset[];
  blocks: CanvasBlockRow[];
}) {
  const router = useRouter();
  const [intent, setIntent] = React.useState<"package" | "refine">("package");
  const intentRef = React.useRef(intent);
  const setRunIntent = (v: "package" | "refine") => {
    intentRef.current = v;
    setIntent(v);
  };

  const { state, start, decide, reset, busy } = useRunStream({
    onDone: (done) => {
      router.refresh();
      if (done.status !== "completed") toast.error(`Agent run ${done.status}`);
      else if (intentRef.current === "refine") toast.success("Edit applied — gallery refreshed");
      else toast.success("Creative package ready");
    },
  });

  const selectable = React.useMemo(() => briefs.filter((b) => b.status !== "archived"), [briefs]);
  const [selectedBrief, setSelectedBrief] = React.useState(selectable[0]?.id ?? "");
  React.useEffect(() => {
    if (selectable.length > 0 && !selectable.some((b) => b.id === selectedBrief)) {
      setSelectedBrief(selectable[0].id);
    }
  }, [selectable, selectedBrief]);

  const [lightbox, setLightbox] = React.useState<{ key: string; id: string } | null>(null);
  const [lightboxTab, setLightboxTab] = React.useState<"asset" | "instagram">("asset");
  const [storyItems, setStoryItems] = React.useState<StoryItem[] | null>(null);
  const [refining, setRefining] = React.useState<Asset | null>(null);
  const [instruction, setInstruction] = React.useState("");
  const [acting, setActing] = React.useState<string | null>(null);

  /* per-group windowing — brief groups whose full asset list is shown */
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /* brand library (reference photos) vs generated creative */
  const referenceAssets = React.useMemo(() => assets.filter((a) => a.kind === "reference"), [assets]);
  const creativeAssets = React.useMemo(() => assets.filter((a) => a.kind !== "reference"), [assets]);

  /* catalogue filters */
  const [kindFilter, setKindFilter] = React.useState<KindFilter>("all");
  const [formatFilter, setFormatFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const filtersOn = kindFilter !== "all" || formatFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => {
    setKindFilter("all");
    setFormatFilter("all");
    setStatusFilter("all");
  };

  const visibleAssets = React.useMemo(
    () =>
      creativeAssets.filter((a) => {
        if (kindFilter !== "all" && a.kind !== kindFilter) return false;
        if (formatFilter !== "all" && a.format !== formatFilter) return false;
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        return true;
      }),
    [creativeAssets, kindFilter, formatFilter, statusFilter]
  );

  /* group assets by brief (null brief_id → ad-hoc, last) */
  const groups = React.useMemo<Group[]>(() => {
    const byKey = new Map<string, Asset[]>();
    for (const a of visibleAssets) {
      const k = a.brief_id ?? "adhoc";
      const arr = byKey.get(k);
      if (arr) arr.push(a);
      else byKey.set(k, [a]);
    }
    const ordered: Group[] = [];
    const seen = new Set<string>();
    for (const b of briefs) {
      const items = byKey.get(b.id);
      if (!items) continue;
      seen.add(b.id);
      ordered.push(makeGroup(b.id, b.title, b.for_date, items));
    }
    for (const [k, items] of byKey) {
      if (k === "adhoc" || seen.has(k)) continue;
      ordered.push(makeGroup(k, "Earlier brief", null, items));
    }
    const adhoc = byKey.get("adhoc");
    if (adhoc) ordered.push(makeGroup("adhoc", "Ad-hoc", null, adhoc));
    return ordered;
  }, [visibleAssets, briefs]);

  const lightboxData = React.useMemo(() => {
    if (!lightbox) return null;
    const group = groups.find((g) => g.key === lightbox.key);
    if (!group) return null;
    const index = group.images.findIndex((a) => a.id === lightbox.id);
    if (index < 0) return null;
    return { group, asset: group.images[index], index };
  }, [lightbox, groups]);

  /* Instagram preview — best caption for the same brief, matching the channel */
  const lightboxPreview = React.useMemo(() => {
    if (!lightboxData) return null;
    const a = lightboxData.asset;
    const channel = a.format === "story_9x16" ? "instagram_story" : "instagram_feed";
    const pool = creativeAssets.filter(
      (c) => c.kind === "caption" && c.brief_id === a.brief_id && !!c.caption_text
    );
    const pick = (arr: Asset[]) => arr.find((c) => c.status === "selected") ?? arr[0] ?? null;
    const best = pick(pool.filter((c) => c.format === channel)) ?? pick(pool);
    const parsed = best ? previewCaption(best) : null;
    return {
      mode: a.format === "story_9x16" ? ("story" as const) : ("feed" as const),
      caption: parsed?.text || undefined,
      hashtags: parsed?.tags ?? [],
    };
  }, [lightboxData, creativeAssets]);

  /* story player — a group's story_9x16 assets, chronological */
  const groupStoryItems = React.useCallback(
    (group: Group): StoryItem[] =>
      group.items
        .filter(
          (a) => a.format === "story_9x16" && !!a.public_url && (a.kind === "image" || a.kind === "video")
        )
        .sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime())
        .map((a) => ({
          url: a.public_url!,
          kind: a.kind === "video" ? ("video" as const) : ("image" as const),
          label: a.variant_label ?? undefined,
        })),
    []
  );

  const step = React.useCallback(
    (dir: 1 | -1) => {
      if (!lightboxData) return;
      const imgs = lightboxData.group.images;
      const next = imgs[(lightboxData.index + dir + imgs.length) % imgs.length];
      setLightbox({ key: lightboxData.group.key, id: next.id });
    },
    [lightboxData]
  );

  React.useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, step]);

  /* ───── actions ───── */

  const setStatus = async (asset: Asset, status: "selected" | "rejected") => {
    setActing(asset.id);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(status === "selected" ? "Variant selected" : "Variant rejected");
      router.refresh();
    } catch {
      toast.error("Couldn't update the asset — try again");
    } finally {
      setActing(null);
    }
  };

  const generatePackage = async () => {
    if (!selectedBrief || busy) return;
    setRunIntent("package");
    await start({ workflow: "creative", params: { briefId: selectedBrief } });
  };

  const openRefine = (a: Asset) => {
    setInstruction("");
    setRefining(a);
  };
  const closeRefine = () => {
    setRefining(null);
    setInstruction("");
  };

  const applyEdit = async () => {
    const inst = instruction.trim();
    if (!refining || !inst || busy) return;
    setRunIntent("refine");
    await start({
      workflow: "creative",
      prompt: `Use edit_image on asset ${refining.id} with instruction: "${inst}". One edit only, save it, then stop.`,
    });
  };

  const copyPrompt = async (p: string) => {
    try {
      await navigator.clipboard.writeText(p);
      toast.success("Prompt copied");
    } catch {
      toast.error("Couldn't copy the prompt");
    }
  };

  /* ───── render ───── */

  return (
    <div>
      <SectionTitle
        title="Creative studio"
        subtitle="Gemini-generated stories, posts and video — in your brand's style"
        right={
          <div className="flex items-center gap-2">
            <select
              value={selectedBrief}
              onChange={(e) => setSelectedBrief(e.target.value)}
              disabled={selectable.length === 0}
              className="bg-surface border border-line rounded-xl h-9 text-sm px-3 text-cream max-w-[240px] outline-none focus:border-[rgba(196,99,58,0.5)] transition-colors disabled:opacity-50"
            >
              {selectable.length === 0 ? (
                <option value="">No briefs yet</option>
              ) : (
                selectable.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} · {fmtDate(b.for_date)}
                  </option>
                ))
              )}
            </select>
            <Button
              onClick={generatePackage}
              disabled={busy || !selectedBrief}
              loading={busy && intent === "package"}
            >
              <Palette className="h-4 w-4" />
              Generate package
            </Button>
          </div>
        }
      />

      {/* brand library — real product photos the agent grounds Gemini with */}
      <BrandLibrary items={referenceAssets} />

      {/* live agent console — image variants stream in as they're generated */}
      {intent === "package" && state.status !== "idle" && (
        <Card className="p-4 mt-5 max-h-[60vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">creative agent</span>
            {!busy && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Dismiss
              </Button>
            )}
          </div>
          <RunConsole state={state} onDecide={decide} className="flex-1" />
        </Card>
      )}

      {/* catalogue control bar — kind, status and format filters */}
      {creativeAssets.length > 0 && (
        <div className="sticky top-0 z-20 mt-6 flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-[rgba(255,253,248,0.82)] backdrop-blur-xl px-3 py-2.5">
          {KIND_PILLS.map((k) => (
            <Pill key={k.id} active={kindFilter === k.id} onClick={() => setKindFilter(k.id)}>
              {k.label}
            </Pill>
          ))}
          <span className="mx-1.5 h-4 border-l border-line-strong" aria-hidden />
          {STATUS_FILTER_PILLS.map((s) => (
            <Pill key={s.id} active={statusFilter === s.id} onClick={() => setStatusFilter(s.id)}>
              {s.label}
            </Pill>
          ))}
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            aria-label="Filter by format"
            className="ml-auto bg-surface border border-line rounded-xl h-8 text-xs px-2.5 text-cream outline-none focus:border-[rgba(196,99,58,0.5)] transition-colors"
          >
            <option value="all">All formats</option>
            {Object.entries(FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="font-mono text-[11px] text-cream-faint">
            {visibleAssets.length}/{creativeAssets.length}
          </span>
        </div>
      )}

      {/* gallery */}
      {creativeAssets.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={<Palette />}
            title="No creative yet"
            hint="Approve a brief, then generate a full package of variants"
            action={
              <Link href="/studio/briefs">
                <Button variant="outline" size="sm">
                  <FileText className="h-3.5 w-3.5" />
                  Open briefs
                </Button>
              </Link>
            }
          />
        </Card>
      ) : visibleAssets.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            className="py-10"
            icon={<Palette />}
            title="No assets match these filters"
            hint="Try another kind, status or format."
            action={
              filtersOn ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        groups.map((group) => {
          const stories = groupStoryItems(group);
          const groupExpanded = expandedGroups.has(group.key);
          const shownItems = groupExpanded ? group.items : group.items.slice(0, GROUP_PREVIEW);
          return (
          <section key={group.key} className="mt-8">
            <header className="flex items-baseline gap-2.5 flex-wrap">
              <h3 className="text-[11px] uppercase tracking-[0.16em] text-cream">{group.title}</h3>
              {group.date && <span className="text-[11px] text-cream-faint">{fmtDate(group.date)}</span>}
              <span className="font-mono text-[10px] text-cream-faint">
                {group.items.length} {group.items.length === 1 ? "asset" : "assets"}
              </span>
              {KIND_COUNT_META.map(({ kind, label, Icon }) => {
                const n = group.items.filter((a) => a.kind === kind).length;
                if (n === 0) return null;
                return (
                  <span
                    key={kind}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-[rgba(43,34,26,0.03)] px-2 py-0.5 font-mono text-[9px] text-cream-faint"
                  >
                    <Icon className="h-3 w-3" />
                    {n} {kind === "caption" && n === 1 ? "caption" : label}
                  </span>
                );
              })}
              {stories.length > 0 && (
                <Button
                  size="sm"
                  variant="subtle"
                  className="ml-auto self-center"
                  onClick={() => setStoryItems(stories)}
                >
                  <Play className="h-3.5 w-3.5" />
                  Play stories
                </Button>
              )}
            </header>
            <div className="columns-2 lg:columns-3 gap-4 mt-3">
              {shownItems.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.45) }}
                  className="mb-4 break-inside-avoid"
                >
                  <AssetCard
                    asset={a}
                    acting={acting === a.id}
                    busy={busy}
                    onSelect={() => setStatus(a, "selected")}
                    onReject={() => setStatus(a, "rejected")}
                    onRefine={() => openRefine(a)}
                    onOpen={() => {
                      setLightboxTab("asset");
                      setLightbox({ key: group.key, id: a.id });
                    }}
                  />
                </motion.div>
              ))}
            </div>
            {group.items.length > GROUP_PREVIEW &&
              (groupExpanded ? (
                <div className="mt-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-[11px] text-cream-muted hover:text-cream hover:border-line-strong hover:bg-[rgba(43,34,26,0.04)] transition-all"
                  >
                    <ChevronUp className="h-3 w-3" />
                    Collapse
                  </button>
                </div>
              ) : (
                <ShowMoreButton
                  className="mt-1"
                  label="Show all"
                  remaining={group.items.length - GROUP_PREVIEW}
                  onClick={() => toggleGroup(group.key)}
                />
              ))}
          </section>
          );
        })
      )}

      {/* creative canvas blocks */}
      {blocks.length > 0 && (
        <section className="mt-10">
          <p className="text-[11px] uppercase tracking-[0.16em] text-cream-faint">Creative canvas</p>
          <div className="grid md:grid-cols-2 gap-4 mt-3">
            {blocks.map((b) => (
              <BlockRenderer key={b.id} block={b} />
            ))}
          </div>
        </section>
      )}

      {/* ───── lightbox ───── */}
      <Modal open={!!lightboxData} onClose={() => setLightbox(null)} wide>
        {lightboxData && (
          <div className="p-5">
            <div className="flex items-center gap-1.5 pr-10">
              <Pill active={lightboxTab === "asset"} onClick={() => setLightboxTab("asset")}>
                <ImageIcon className="h-3 w-3" />
                Asset
              </Pill>
              <Pill active={lightboxTab === "instagram"} onClick={() => setLightboxTab("instagram")}>
                <Smartphone className="h-3 w-3" />
                Instagram preview
              </Pill>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap pr-10 mt-3">
              {lightboxData.asset.variant_label && <Badge tone="accent">{lightboxData.asset.variant_label}</Badge>}
              <span className="font-mono text-[10px] text-cream-faint">{fmtFormat(lightboxData.asset.format)}</span>
              {lightboxData.asset.status === "selected" && <Badge tone="good">selected</Badge>}
              {lightboxData.asset.status === "rejected" && <Badge tone="bad">rejected</Badge>}
              <span className="ml-auto font-mono text-[10px] text-cream-faint">
                {lightboxData.index + 1} / {lightboxData.group.images.length}
              </span>
            </div>
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 text-cream-faint hover:text-cream p-1 rounded-lg hover:bg-[rgba(43,34,26,0.06)]"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {lightboxTab === "asset" ? (
            <div className="grid lg:grid-cols-[1fr_280px] gap-5 mt-4">
              <div className="relative min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={lightboxData.asset.id}
                  src={lightboxData.asset.public_url ?? ""}
                  alt={lightboxData.asset.variant_label ?? "creative variant"}
                  className="w-full h-auto rounded-xl border border-line"
                />
                {lightboxData.group.images.length > 1 && (
                  <>
                    <NavArrow side="left" onClick={() => step(-1)}>
                      <ChevronLeft className="h-4.5 w-4.5" />
                    </NavArrow>
                    <NavArrow side="right" onClick={() => step(1)}>
                      <ChevronRight className="h-4.5 w-4.5" />
                    </NavArrow>
                  </>
                )}
              </div>

              <aside className="min-w-0">
                {lightboxData.asset.prompt && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-cream-faint">Prompt</p>
                      <button
                        onClick={() => copyPrompt(lightboxData.asset.prompt!)}
                        className="inline-flex items-center gap-1 text-[10px] text-cream-faint hover:text-cream transition-colors"
                      >
                        <Copy className="h-3 w-3" /> copy
                      </button>
                    </div>
                    <p className="mt-1.5 font-mono text-[11px] text-cream-muted leading-relaxed whitespace-pre-wrap max-h-44 overflow-y-auto rounded-lg bg-black/30 border border-line p-2.5">
                      {lightboxData.asset.prompt}
                    </p>
                  </>
                )}

                <dl className="mt-4 grid grid-cols-1 gap-1.5 text-xs">
                  <MetaRow k="Model">{lightboxData.asset.model ?? "—"}</MetaRow>
                  <MetaRow k="Format">{fmtFormat(lightboxData.asset.format) || "—"}</MetaRow>
                  <MetaRow k="Dimensions">
                    {lightboxData.asset.width && lightboxData.asset.height
                      ? `${lightboxData.asset.width}×${lightboxData.asset.height}`
                      : "—"}
                  </MetaRow>
                  <MetaRow k="Cost">
                    {lightboxData.asset.cost_usd != null ? fmtUsd(lightboxData.asset.cost_usd) : "—"}
                  </MetaRow>
                  <MetaRow k="Created">{timeAgo(lightboxData.asset.created_at)}</MetaRow>
                </dl>

                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    size="sm"
                    disabled={acting === lightboxData.asset.id}
                    onClick={() => setStatus(lightboxData.asset, "selected")}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Select variant
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={acting === lightboxData.asset.id}
                    onClick={() => setStatus(lightboxData.asset, "rejected")}
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      const a = lightboxData.asset;
                      setLightbox(null);
                      openRefine(a);
                    }}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Refine with Gemini
                  </Button>
                </div>
              </aside>
            </div>
            ) : (
            <div className="relative mt-4 flex items-center justify-center overflow-hidden rounded-xl border border-line bg-black/30 py-8">
              {/* subtle radial glow behind the phone */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(58% 60% at 50% 44%, rgba(196,99,58,0.22), rgba(63,146,104,0.07) 55%, transparent 78%)",
                }}
              />
              <InstagramFrame
                key={lightboxData.asset.id}
                mode={lightboxPreview?.mode ?? "feed"}
                mediaUrl={lightboxData.asset.public_url ?? ""}
                mediaKind={lightboxData.asset.kind === "video" ? "video" : "image"}
                caption={lightboxPreview?.caption}
                hashtags={lightboxPreview?.hashtags}
              />
              {lightboxData.group.images.length > 1 && (
                <>
                  <NavArrow side="left" onClick={() => step(-1)}>
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </NavArrow>
                  <NavArrow side="right" onClick={() => step(1)}>
                    <ChevronRight className="h-4.5 w-4.5" />
                  </NavArrow>
                </>
              )}
            </div>
            )}
          </div>
        )}
      </Modal>

      {/* ───── refine modal ───── */}
      <Modal open={!!refining} onClose={closeRefine}>
        {refining && (
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl text-cream" style={serif}>
                  Refine this image
                </h3>
                <p className="text-xs text-cream-muted mt-0.5">
                  One Gemini edit — describe exactly what should change.
                </p>
              </div>
              <button
                onClick={closeRefine}
                className="text-cream-faint hover:text-cream p-1 rounded-lg hover:bg-[rgba(43,34,26,0.06)] shrink-0"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {refining.public_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={refining.public_url}
                alt={refining.variant_label ?? "asset to refine"}
                className="w-full h-auto max-h-72 object-contain rounded-xl border border-line bg-black/30 mt-4"
              />
            )}

            <Textarea
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Make the lighting warmer and remove the cutlery at the top left…"
              className="mt-4 text-xs"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={applyEdit}
                disabled={busy || !instruction.trim()}
                loading={busy && intent === "refine"}
              >
                <Wand2 className="h-4 w-4" />
                Apply edit
              </Button>
              <Button variant="ghost" onClick={closeRefine}>
                Close
              </Button>
            </div>

            {intent === "refine" && state.status !== "idle" && (
              <div className="mt-4 pt-3 border-t border-line max-h-[40vh] flex flex-col">
                <RunConsole state={state} onDecide={decide} dense className="flex-1" />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ───── story player (shared across brief groups) ───── */}
      <StoryPlayer open={!!storyItems} items={storyItems ?? []} onClose={() => setStoryItems(null)} />
    </div>
  );
}

/* ───────── filter pill ───────── */

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 rounded-full border px-3 text-[11px] font-medium transition-all",
        active
          ? "border-[rgba(196,99,58,0.45)] bg-[rgba(196,99,58,0.14)] text-cream"
          : "border-line text-cream-muted hover:text-cream hover:border-line-strong"
      )}
    >
      {children}
    </button>
  );
}

/* ───────── brand library (reference product photos) ───────── */

const LIBRARY_TYPES = ["image/png", "image/jpeg", "image/webp"];

function BrandLibrary({ items }: { items: Asset[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(items.length === 0); // invite first upload
  const [dragOver, setDragOver] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [dishName, setDishName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // revoke any live object URL on unmount
  const previewRef = React.useRef<string | null>(null);
  previewRef.current = preview;
  React.useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    []
  );

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!LIBRARY_TYPES.includes(f.type)) {
      toast.error("PNG, JPEG or WebP only");
      return;
    }
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  };

  const clearForm = () => {
    setFile(null);
    setDishName("");
    setNotes("");
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = async () => {
    if (!file || !dishName.trim() || uploading) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dish_name", dishName.trim());
      fd.append("notes", notes.trim());
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toast.success(`"${dishName.trim()}" added to the brand library`);
      clearForm();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed — try again");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (a: Asset) => {
    if (!window.confirm(`Remove "${a.variant_label ?? "this photo"}" from the brand library?`)) return;
    setDeleting(a.id);
    try {
      const res = await fetch(`/api/uploads?id=${encodeURIComponent(a.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Reference photo removed");
      router.refresh();
    } catch {
      toast.error("Couldn't remove the photo — try again");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card className="mt-5 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 text-left"
        aria-expanded={open}
      >
        <Camera className="h-4 w-4 text-eucalyptus shrink-0" />
        <h3 className="text-lg text-cream" style={serif}>
          Brand library — real product photos
        </h3>
        <Badge tone="neutral" className="font-mono">
          {items.length}
        </Badge>
        <ChevronDown
          className={cn("h-4 w-4 text-cream-faint ml-auto shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-3">
          {/* upload zone — drag & drop or click */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "rounded-xl border border-dashed px-4 py-6 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-[rgba(63,146,104,0.6)] bg-[rgba(63,146,104,0.06)]"
                : "border-line-strong hover:border-[rgba(43,34,26,0.3)] hover:bg-[rgba(43,34,26,0.02)]"
            )}
          >
            <ImagePlus className="h-5 w-5 mx-auto text-cream-faint" />
            <p className="text-xs text-cream-muted mt-1.5">Drop a dish photo or click to upload</p>
            <p className="text-[10px] text-cream-faint mt-0.5">PNG, JPEG or WebP · max 15MB</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>

          {/* inline details form once a file is chosen */}
          {file && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-[rgba(43,34,26,0.03)] p-3">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt={file.name}
                  className="h-12 w-12 rounded-lg border border-line object-cover shrink-0"
                />
              )}
              <Input
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                placeholder="Dish name (required)"
                className="h-8 text-xs flex-1 min-w-[160px]"
              />
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes — plating, story, allergens (optional)"
                className="h-8 text-xs flex-1 min-w-[200px]"
              />
              <Button size="sm" onClick={upload} loading={uploading} disabled={!dishName.trim()}>
                <ImagePlus className="h-3.5 w-3.5" />
                Add to library
              </Button>
              <Button size="sm" variant="ghost" onClick={clearForm} disabled={uploading}>
                Cancel
              </Button>
            </div>
          )}

          {/* catalogue row */}
          {items.length > 0 && (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1.5">
              {items.map((a) => (
                <div key={a.id} className="relative shrink-0 group/ref">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.public_url ?? ""}
                    alt={a.variant_label ?? "reference photo"}
                    className="h-24 w-auto min-w-16 rounded-xl border border-line object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  {a.variant_label && (
                    <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)]">
                      <Badge tone="accent" className="bg-black/65 backdrop-blur max-w-full !px-2">
                        <span className="truncate">{a.variant_label}</span>
                      </Badge>
                    </span>
                  )}
                  <button
                    type="button"
                    title="Remove from library"
                    disabled={deleting === a.id}
                    onClick={() => remove(a)}
                    className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-black/70 backdrop-blur border border-line text-cream-muted hover:text-bad flex items-center justify-center opacity-0 group-hover/ref:opacity-100 transition-opacity disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="mt-2.5 text-[11px] text-cream-faint">
            The agent passes these to Gemini so generated content matches your real plating.
          </p>
        </div>
      )}
    </Card>
  );
}

/* ───────── asset cards ───────── */

function AssetCard({
  asset,
  acting,
  busy,
  onSelect,
  onReject,
  onRefine,
  onOpen,
}: {
  asset: Asset;
  acting: boolean;
  busy: boolean;
  onSelect: () => void;
  onReject: () => void;
  onRefine: () => void;
  onOpen: () => void;
}) {
  // caption expansion — declared before the kind branches so hooks stay unconditional
  const [showAllCaption, setShowAllCaption] = React.useState(false);
  const statusClasses = cn(
    asset.status === "selected" && "ring-2 ring-[rgba(47,158,99,0.5)]",
    asset.status === "rejected" && "opacity-40"
  );

  if (asset.kind === "image") {
    return (
      <HoverDetail
        side="left"
        width={330}
        openDelay={500}
        content={
          <div>
            <HoverRow label="variant">{asset.variant_label ?? "—"}</HoverRow>
            <HoverRow label="format">{fmtFormat(asset.format) || "—"}</HoverRow>
            {asset.width != null && asset.height != null && (
              <HoverRow label="dimensions">{`${asset.width}×${asset.height}`}</HoverRow>
            )}
            <HoverRow label="model">{asset.model ?? "—"}</HoverRow>
            <HoverRow label="cost">{asset.cost_usd != null ? fmtUsd(asset.cost_usd) : "—"}</HoverRow>
            <HoverRow label="created">{timeAgo(asset.created_at)}</HoverRow>
            {asset.prompt && (
              <p className="mt-2 border-t border-line/60 pt-2 font-mono text-[10px] text-cream-faint leading-relaxed whitespace-pre-wrap max-h-40 overflow-hidden">
                {asset.prompt}
              </p>
            )}
          </div>
        }
      >
      <div className={cn("glass rounded-2xl overflow-hidden relative group", statusClasses)}>
        {asset.public_url ? (
          <button type="button" onClick={onOpen} className="block w-full relative cursor-zoom-in text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.public_url}
              alt={asset.variant_label ?? "creative variant"}
              className="w-full h-auto"
              loading="lazy"
              decoding="async"
            />
            {asset.prompt && (
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                <span className="font-mono text-[10px] text-cream-muted leading-relaxed line-clamp-3">
                  {asset.prompt}
                </span>
                {asset.model && (
                  <span className="mt-1.5 self-start rounded-full border border-line bg-black/50 px-2 py-0.5 font-mono text-[9px] text-cream-faint">
                    {asset.model}
                  </span>
                )}
              </span>
            )}
          </button>
        ) : (
          <div className="aspect-[4/5] flex items-center justify-center text-cream-faint">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <CardActions
          disabled={acting}
          onSelect={onSelect}
          onReject={onReject}
          onRefine={busy ? undefined : onRefine}
        />
        <AssetFooter asset={asset} />
      </div>
      </HoverDetail>
    );
  }

  if (asset.kind === "video") {
    return (
      <div className={cn("glass rounded-2xl overflow-hidden relative group", statusClasses)}>
        {asset.public_url && (
          <video
            src={asset.public_url}
            controls
            muted
            playsInline
            preload="metadata"
            className="w-full h-auto"
            onMouseEnter={(e) => {
              void e.currentTarget.play().catch(() => {});
            }}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
          />
        )}
        <CardActions disabled={acting} onSelect={onSelect} onReject={onReject} />
        <AssetFooter
          asset={asset}
          lead={
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 font-mono text-[9px] text-cream-faint">
              <Film className="h-3 w-3 text-amber" />
              {asset.duration_seconds ? `${asset.duration_seconds}s` : "video"}
            </span>
          }
        />
      </div>
    );
  }

  /* caption */
  const { text, tags } = captionParts(asset);
  const captionLong = text.length > 240 || text.split("\n").length > 4;
  return (
    <HoverDetail
      width={340}
      content={
        <div>
          <p className="text-xs text-cream leading-relaxed whitespace-pre-wrap">{text}</p>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-line bg-[rgba(43,34,26,0.04)] px-2 py-0.5 text-[10px] text-info"
                >
                  {t.startsWith("#") ? t : `#${t}`}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 border-t border-line/60 pt-2">
            <HoverRow label="channel">
              {asset.format ? CHANNEL_LABELS[asset.format] ?? asset.format : "—"}
            </HoverRow>
            <HoverRow label="variant">{asset.variant_label ?? "—"}</HoverRow>
            <HoverRow label="created">{timeAgo(asset.created_at)}</HoverRow>
          </div>
        </div>
      }
    >
    <div className={cn("glass rounded-2xl p-4 relative group", statusClasses)}>
      <Quote className="h-3.5 w-3.5 text-terracotta mb-2" />
      <p className={cn("text-sm text-cream leading-relaxed whitespace-pre-wrap", !showAllCaption && "line-clamp-4")}>
        {text}
      </p>
      {captionLong && (
        <button
          type="button"
          onClick={() => setShowAllCaption((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-[10px] text-cream-faint hover:text-cream transition-colors"
        >
          {showAllCaption ? "less" : "more"}
          <ChevronDown className={cn("h-3 w-3 transition-transform", showAllCaption && "rotate-180")} />
        </button>
      )}
      {tags.length > 0 && (
        <span className="flex flex-wrap gap-x-1.5 gap-y-1 mt-2.5">
          {tags.map((t) => (
            <span key={t} className="text-[11px] text-info">
              {t.startsWith("#") ? t : `#${t}`}
            </span>
          ))}
        </span>
      )}
      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-line/60">
        {asset.format && <Badge tone="neutral">{CHANNEL_LABELS[asset.format] ?? asset.format}</Badge>}
        {asset.variant_label && <Badge tone="accent">{asset.variant_label}</Badge>}
        {asset.status === "selected" && <Check className="h-3 w-3 text-good ml-auto" />}
      </div>
      <CardActions disabled={acting} onSelect={onSelect} onReject={onReject} />
    </div>
    </HoverDetail>
  );
}

function AssetFooter({ asset, lead }: { asset: Asset; lead?: React.ReactNode }) {
  return (
    <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
      {lead}
      {asset.variant_label && <Badge tone="accent">{asset.variant_label}</Badge>}
      {asset.format && <span className="font-mono text-[9px] text-cream-faint">{fmtFormat(asset.format)}</span>}
      {asset.status === "selected" && <Check className="h-3 w-3 text-good" />}
      {asset.cost_usd != null && (
        <span className="ml-auto font-mono text-[9px] text-cream-faint">{fmtUsd(asset.cost_usd)}</span>
      )}
    </div>
  );
}

function CardActions({
  onSelect,
  onReject,
  onRefine,
  disabled,
}: {
  onSelect: () => void;
  onReject: () => void;
  onRefine?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
      <IconBtn title="Select" onClick={onSelect} disabled={disabled} className="hover:text-good">
        <Check className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn title="Reject" onClick={onReject} disabled={disabled} className="hover:text-bad">
        <X className="h-3.5 w-3.5" />
      </IconBtn>
      {onRefine && (
        <IconBtn title="Refine" onClick={onRefine} disabled={disabled} className="hover:text-amber">
          <Wand2 className="h-3.5 w-3.5" />
        </IconBtn>
      )}
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  className,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 w-7 rounded-lg bg-black/60 backdrop-blur border border-line text-cream-muted flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none",
        className
      )}
    >
      {children}
    </button>
  );
}

function NavArrow({
  side,
  onClick,
  children,
}: {
  side: "left" | "right";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={side === "left" ? "Previous variant" : "Next variant"}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 backdrop-blur border border-line text-cream-muted hover:text-cream flex items-center justify-center transition-colors",
        side === "left" ? "left-2" : "right-2"
      )}
    >
      {children}
    </button>
  );
}

function MetaRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/50 pb-1.5">
      <dt className="text-cream-faint">{k}</dt>
      <dd className="text-cream-muted font-mono text-[11px] truncate">{children}</dd>
    </div>
  );
}
