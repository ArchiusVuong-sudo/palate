# Palate UI contract (for page builders)

Dark editorial SaaS. Ink background with eucalyptus/terracotta glows, cream type, glass cards. Already-built foundation — REUSE, do not modify shared files.

## Design tokens (Tailwind classes)
- Text: `text-cream` (primary), `text-cream-muted`, `text-cream-faint`, accents `text-amber`, `text-terracotta`, `text-eucalyptus`, status `text-good|text-bad|text-warn|text-info`
- Borders: `border-line`, `border-line-strong`
- Cards: `glass rounded-2xl` (+ `glass-hover` when clickable), padding `p-4` or `p-5`
- Display font (headings): `style={{ fontFamily: "var(--font-display), serif" }}` — Instrument Serif. Use for page titles, card titles, hero copy. Italic `<em>` + `text-gradient` for accent words.
- Mono for numbers/ids: `font-mono`
- Markdown content: wrap in `<div className="prose-palate">` with ReactMarkdown + remarkGfm
- Entry animation: framer-motion `initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}` with stagger `transition={{delay:i*0.06}}`, or class `animate-in-up`

## Shared components (import paths exact)
```tsx
import { Button, Badge, Card, SectionTitle, Input, Textarea, EmptyState, WorkingDots, Modal } from "@/components/ui/primitives";
// Button: variant "primary"|"ghost"|"outline"|"danger"|"subtle", size "sm"|"md"|"lg", loading
// Badge: tone "neutral"|"good"|"bad"|"warn"|"info"|"accent"|"agent"
// SectionTitle: { title, subtitle?, right? } — standard page header
// Modal: { open, onClose, wide?, children }

import { MetricCard, TrendArea, TopicBars, SimpleBars, Donut, ScoreRing, PALETTE } from "@/components/charts/charts";
// MetricCard: { label, value (number animates), suffix?, delta?, tone?, caption?, spark?: number[], index? }
// TrendArea: { data: [{label, [seriesKey]: number}], series: [{key,name,color?}], height?, stacked? }
// TopicBars: { data: [{name, value}], height? }   Donut: { data: [{name,value,color?}], height?, centerLabel? }
// ScoreRing: { score 0-100, size?, label? }

import { BlockRenderer, type CanvasBlock } from "@/components/blocks/block-renderer";
// <BlockRenderer block={{ id, kind: "metric"|"chart"|"table"|"markdown"|"list", title, payload }} compact? />

import { useRunStream } from "@/components/agent/use-run-stream";
// const { state, start, decide, cancel, reset, busy } = useRunStream({ onDone: () => router.refresh() });
// await start({ workflow: "listening"|"briefing"|"creative"|"review"|"pipeline"|"copilot", prompt?, params? });
// state: { status, segments, liveText, thinking, pendingApprovals, summary, costUsd, error }

import { RunConsole } from "@/components/agent/run-console";
// <RunConsole state={state} onDecide={decide} dense? /> — full live agent timeline incl. approval cards
```

## Data fetchers — `@/lib/queries` (server components only)
getOverviewStats(), getSentimentTrend(days), getTopTopics(days,limit), getTrendingDishes(days,limit),
getSourceBreakdown(days), getSocialItems({limit,source,sentiment,flagged}), getInsights(limit),
getProposedActions(status), getBriefs(limit), getBrief(id), getAssets({briefId,kind,limit}), getPosts(limit),
getReviews(limit), getKnowledgeFiles(), getKnowledgeRevisions(fileId), getRuns(limit), getRunEvents(runId),
getApprovals(status?), getOutbox(limit), getCanvasBlocks(scope,limit), getConnections(), getPendingCounts()
— Types exported: SocialItem, Insight, ProposedAction, Brief, Asset, Post, Review, KnowledgeFile, AgentRun, Approval, OutboxEmail, CanvasBlockRow.

## Helpers — `@/lib/format`
cn, timeAgo, fmtDate, fmtDateTime, fmtNumber, fmtUsd, SOURCE_LABELS, CHANNEL_LABELS, initials

## Mutation endpoints (client fetch, JSON)
- POST /api/agent {workflow, prompt?, params?} → {runId} (prefer useRunStream.start)
- POST /api/approvals/[id] {decision, note?}
- POST /api/posts/[id] {status?, scheduled_at?, caption?}  (status: draft|in_review|changes_requested|approved|scheduled|published)
- POST /api/actions/[id] {status: approved|dismissed|done} → may return {runId} (briefing auto-start)
- POST /api/insights/[id] {status: acknowledged|actioned}
- POST /api/assets/[id] {status: candidate|selected|rejected}
- POST /api/knowledge {path, title?, content, change_note?} ; DELETE /api/knowledge?path=…
- POST /api/connections/[provider] {status?, config?}
- POST /api/runs/[id]/cancel

## Page conventions
- `page.tsx` = async server component: `export const dynamic = "force-dynamic";` fetch data, render `<XView data={...}/>`
- `view.tsx` (same folder) = `"use client"` component with all interactivity
- Page header: `<SectionTitle title="…" subtitle="…" right={<actions/>} />`, content `mt-5` grids `gap-4`/`gap-5`
- Agent runs: a prominent "Run" Button (variant primary, with a lucide icon); while busy render `<RunConsole>` inside a `Card` (p-4, max-h ~ 60vh flex column); `onDone: () => router.refresh()`
- Empty states: `<EmptyState icon={<SomeLucide/>} title hint action={<Button onClick={run}>…</Button>} />`
- All times via timeAgo/fmtDate. All ratings ★ via text-amber. Australian English copy ("analyse", "colour").
- Icons: lucide-react only.

## Hard rules
- Do NOT edit shared files (components/ui, charts, blocks, agent/*, lib/*, app/layout.tsx, app/globals.css, studio/layout.tsx, shell.tsx). Workarounds live in your own page files.
- Keep every page file self-sufficient; no new npm deps.
- `./node_modules/.bin/tsc --noEmit` must pass for your files before you finish.
- next/image is configured for qannfgylnsqmyocsfyse.supabase.co; for storage images prefer plain `<img>` (dynamic sizes) — eslint is off for builds.

## LIGHT THEME (current — June 11 wave 3)
The studio is now LIGHT: warm paper background (#f7f3ea), espresso ink text (#2b221a), white glass cards. Token names are unchanged (`text-cream` is now DARK text, `bg-ink` is the paper background) — keep using the same utility classes and you inherit the theme.
- NEVER hardcode dark-theme rgba values. Overlay/hover/border tints use `rgba(43,34,26,X)` (espresso). Terracotta accents: `rgba(196,99,58,X)`. Agent-green: `rgba(63,146,104,X)`. Amber: `rgba(201,127,61,X)`. Sentiment: good #2f9e63 · bad #cf4b3b · warn #b98a23 · info #4f87ad.
- Dark chips/scrims directly ON photos (bg-black/50-70 + backdrop-blur) are correct — keep that pattern for image overlays only.
- Single-column stacks MUST be `grid grid-cols-1 gap-*` (bare `grid gap-*` lets nowrap content blow the layout — this bit us twice).

## New shared primitives (wave 3)
- `ActivityHeatmap` + `RadarCompare` from `@/components/charts/extra` — GitHub-style day grid ({day:'YYYY-MM-DD',count,avg_sentiment}[]) and location radar (data rows keyed by `metric`, series {key,name,color}).
- `AskPalateButton`/`askPalate(prompt)` from `@/components/agent/ask-palate` — chip that opens the copilot drawer prefilled with context. Put it on hover cards / detail panels; write prompts that quote the item's content + ids in plain language.
- `fireConfetti(x?,y?)` from `@/components/ui/confetti` — celebration burst at the given viewport coords; use sparingly on human approve/publish moments only.
- `RunConsole` accepts optional `onFollowUp(text)` — POST /api/agent {followUpRunId, prompt} resumes a finished run's session; dispatch `palate:run-started` with the returned {runId, workflow} so the dock attaches.
- `HoverDetail` is now safe inside any layout (Range-based measurement) and accepts side "auto"|"left"|"right"|"top".
- Queries available in `@/lib/queries`: getMentionHeatmap, getLocationPulse, getRunTotals, getRunDaily, getCalendarData(fromISO,toISO), getRecentAgentEvents, getKnowledgeRevisions.
