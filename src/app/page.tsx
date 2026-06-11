"use client";

/**
 * Palate landing — dark editorial marketing page for the product itself.
 * Static content, fully client-side so framer-motion can run generously.
 */
import * as React from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight, BarChart3, BookOpen, CheckCircle2, ChevronRight, CircleDashed,
  CornerDownRight, Ear, FileText, GraduationCap, Image as ImageIcon,
  MessageSquareWarning, MousePointerClick, Palette, Quote, Search,
  ShieldCheck, Sparkles,
} from "lucide-react";
import { LogoMark } from "@/components/studio/shell";
import { cn } from "@/lib/format";

const display = { fontFamily: "var(--font-display), serif" };
const EASE: [number, number, number, number] = [0.21, 0.8, 0.32, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, delay, ease: EASE },
});

/* ───────────────────────── page ───────────────────────── */

export default function LandingPage() {
  return (
    <main className="relative flex-1 overflow-x-clip">
      <Nav />
      <Hero />
      <Workflow />
      <HumansInTheLoop />
      <Footer />
    </main>
  );
}

/* ───────────────────────── nav ───────────────────────── */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[rgba(11,14,12,0.72)] backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg text-cream" style={display}>Palate</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="#workflow"
            className="hidden sm:inline-flex items-center h-9 px-3.5 rounded-xl text-xs font-medium text-cream-muted hover:text-cream hover:bg-[rgba(244,237,227,0.06)] transition-all"
          >
            The workflow
          </a>
          <CtaLink href="/studio" size="md">
            Open studio <ArrowRight className="h-3.5 w-3.5" />
          </CtaLink>
        </div>
      </div>
    </header>
  );
}

function CtaLink({
  href, children, variant = "primary", size = "lg", className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  size?: "md" | "lg";
  className?: string;
}) {
  const inner = (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 select-none",
        size === "md" ? "h-9.5 px-4 text-sm" : "h-11 px-6 text-sm",
        variant === "primary" &&
          "bg-gradient-to-b from-[#d4744a] to-terracotta text-[#1a0f08] shadow-[0_8px_24px_-10px_rgba(196,99,58,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 active:scale-[0.98]",
        variant === "outline" &&
          "border border-line-strong text-cream hover:bg-[rgba(244,237,227,0.05)] hover:border-[rgba(244,237,227,0.3)]",
        className
      )}
    >
      {children}
    </span>
  );
  return href.startsWith("#") ? <a href={href}>{inner}</a> : <Link href={href}>{inner}</Link>;
}

/* ───────────────────────── hero ───────────────────────── */

function Hero() {
  return (
    <section className="relative">
      {/* backdrop: grid + glow orbs */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-grid" />
        <div
          className="absolute -top-40 left-[12%] h-[520px] w-[520px] rounded-full blur-[130px] opacity-25"
          style={{ background: "radial-gradient(circle, #c4633a 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-10 right-[6%] h-[420px] w-[420px] rounded-full blur-[120px] opacity-20"
          style={{ background: "radial-gradient(circle, #6fbf94 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-[58%] left-[45%] h-[360px] w-[360px] rounded-full blur-[120px] opacity-[0.13]"
          style={{ background: "radial-gradient(circle, #e8a062 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-20 sm:pt-28 pb-24 flex flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-[11px] uppercase tracking-[0.3em] text-amber"
        >
          AI agent for restaurant marketing
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.08, ease: EASE }}
          className="mt-5 text-5xl sm:text-6xl leading-[1.06] text-cream max-w-3xl"
          style={display}
        >
          Your marketing team just got <em className="text-gradient">an extra palate</em>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.18, ease: EASE }}
          className="mt-6 text-base sm:text-lg text-cream-muted leading-relaxed max-w-2xl"
        >
          Palate listens to every review and mention, plans the day&rsquo;s content, generates
          the visuals and guards your brand — while your team approves every move before it ships.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.28, ease: EASE }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <CtaLink href="/studio">
            Enter the studio <ArrowRight className="h-4 w-4" />
          </CtaLink>
          <CtaLink href="#workflow" variant="outline">
            See the workflow
          </CtaLink>
        </motion.div>

        <AgentAtWork />
      </div>
    </section>
  );
}

/* ───────── "agent at work" mock panel ───────── */

const panelStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.16, delayChildren: 0.55 } },
};
const panelItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

const BAR_HEIGHTS = [38, 52, 44, 60, 35, 64, 58, 72, 30, 66, 74, 68, 80, 88];
const NEGATIVE_DAYS = new Set([4, 8]);

function AgentAtWork() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.42, ease: EASE }}
      className="relative mt-16 w-full max-w-2xl text-left"
    >
      <div
        aria-hidden
        className="absolute -inset-10 rounded-[40px] opacity-30 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(196,99,58,0.35), transparent 65%)" }}
      />

      <div className="relative glass rounded-2xl overflow-hidden">
        {/* window chrome */}
        <div className="flex items-center gap-2 px-4 h-11 border-b border-line bg-[rgba(244,237,227,0.02)]">
          <span className="h-2.5 w-2.5 rounded-full bg-terracotta/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-eucalyptus/60" />
          <span className="ml-2 font-mono text-[10px] text-cream-faint">palate · morning sweep — Marlow &amp; Sage</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium border bg-[rgba(111,191,148,0.1)] text-eucalyptus border-[rgba(111,191,148,0.25)]">
            <span className="dot bg-eucalyptus dot-pulse" /> live
          </span>
        </div>

        <motion.div variants={panelStagger} initial="hidden" animate="show" className="p-4 sm:p-5 space-y-2.5">
          {/* status line */}
          <motion.p variants={panelItem} className="text-[11px] text-cream-faint flex items-center gap-1.5">
            <span className="dot bg-eucalyptus/70" /> Morning sweep started — 38 mentions in the last 72h
          </motion.p>

          {/* finished tool rows */}
          <MockToolRow icon={Search} label="Reading social inbox" result="38 items · 3 flagged" mono="list_social_items" />
          <MockToolRow icon={Sparkles} label="Saving insight" result="Pavlova selling out by 8pm — mentions up 5×" mono="save_insight" />

          {/* tiny chart */}
          <motion.div variants={panelItem} className="rounded-xl border border-line/70 bg-[rgba(244,237,227,0.025)] p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <BarChart3 className="h-3.5 w-3.5 text-cream-muted" />
              <span className="text-[11px] text-cream-muted">Sentiment by day</span>
              <span className="ml-auto flex items-center gap-3 text-[9.5px] text-cream-faint">
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-eucalyptus" /> positive</span>
                <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-terracotta" /> negative</span>
              </span>
            </div>
            <div className="flex items-end gap-1.5 h-14">
              {BAR_HEIGHTS.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ delay: 1.15 + i * 0.05, duration: 0.45, ease: EASE }}
                  className={cn(
                    "flex-1 rounded-t-[3px] origin-bottom",
                    NEGATIVE_DAYS.has(i) ? "bg-terracotta/75" : "bg-eucalyptus/65"
                  )}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </motion.div>

          {/* in-flight tool row */}
          <motion.div variants={panelItem} className="rounded-xl border border-line/70 bg-[rgba(244,237,227,0.025)] px-3 py-2">
            <div className="flex items-center gap-2.5">
              <CircleDashed className="h-3.5 w-3.5 text-amber animate-spin shrink-0" style={{ animationDuration: "2.4s" }} />
              <ImageIcon className="h-3.5 w-3.5 text-cream-muted shrink-0" />
              <span className="text-xs text-cream">Generating image — story 9:16</span>
              <span className="ml-auto font-mono text-[10px] text-cream-faint">generate_image</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-[rgba(244,237,227,0.07)] overflow-hidden">
              <motion.div
                initial={{ width: "8%" }}
                animate={{ width: "68%" }}
                transition={{ delay: 1.6, duration: 2.4, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-terracotta to-amber animate-pulse"
              />
            </div>
          </motion.div>

          {/* approval chip */}
          <motion.div
            variants={panelItem}
            className="rounded-2xl border border-[rgba(232,160,98,0.4)] bg-[rgba(196,99,58,0.06)] accent-ring p-3.5"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <MessageSquareWarning className="h-4 w-4 text-amber" />
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-cream-faint">agent needs your decision</span>
              <span className="ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border bg-[rgba(196,99,58,0.12)] text-amber border-[rgba(196,99,58,0.3)]">post</span>
            </div>
            <p className="text-[13px] text-cream leading-relaxed">
              Schedule the pavlova scarcity story for 7:30pm tonight?
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-8 px-3 rounded-xl text-xs font-medium bg-gradient-to-b from-[#d4744a] to-terracotta text-[#1a0f08] shadow-[0_8px_24px_-10px_rgba(196,99,58,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]">
                Approve
              </span>
              <span className="inline-flex items-center justify-center h-8 px-3 rounded-xl text-xs font-medium border border-line-strong text-cream">
                Request changes
              </span>
              <span className="ml-auto hidden sm:inline text-[10px] text-cream-faint">your call, always</span>
            </div>
          </motion.div>

          {/* footer line */}
          <motion.div variants={panelItem} className="flex items-center gap-2 pt-1 text-[10.5px] text-cream-faint border-t border-line">
            <CheckCircle2 className="h-3.5 w-3.5 text-good" />
            every step audited
            <span className="ml-auto font-mono">23 turns · $1.87</span>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function MockToolRow({
  icon: Icon, label, result, mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  result: string;
  mono: string;
}) {
  return (
    <motion.div
      variants={panelItem}
      className="rounded-xl border border-line/70 bg-[rgba(244,237,227,0.025)] px-3 py-2 flex items-center gap-2.5"
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-good shrink-0" />
      <Icon className="h-3.5 w-3.5 text-cream-muted shrink-0" />
      <span className="text-xs text-cream shrink-0">{label}</span>
      <span className="text-[11px] text-cream-faint truncate">— {result}</span>
      <span className="ml-auto font-mono text-[10px] text-cream-faint hidden sm:inline">{mono}</span>
    </motion.div>
  );
}

/* ───────────────────────── workflow ───────────────────────── */

const STEPS = [
  {
    n: "01", title: "Listen", icon: Ear,
    copy: "Reads every review, comment and mention overnight",
    iconCls: "text-info", tint: "rgba(127,181,214,0.12)", ring: "rgba(127,181,214,0.3)",
  },
  {
    n: "02", title: "Brief", icon: FileText,
    copy: "Turns insight into a designer-ready brief",
    iconCls: "text-amber", tint: "rgba(232,160,98,0.12)", ring: "rgba(232,160,98,0.3)",
  },
  {
    n: "03", title: "Create", icon: Palette,
    copy: "Generates on-brand stories, posts and video variants",
    iconCls: "text-eucalyptus", tint: "rgba(111,191,148,0.12)", ring: "rgba(111,191,148,0.3)",
  },
  {
    n: "04", title: "Guard", icon: ShieldCheck,
    copy: "Scores everything against your brand contract before you approve",
    iconCls: "text-warn", tint: "rgba(232,185,79,0.12)", ring: "rgba(232,185,79,0.3)",
  },
];

function Workflow() {
  return (
    <section id="workflow" className="relative scroll-mt-24 border-t border-line">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <motion.p {...fadeUp(0)} className="text-[11px] uppercase tracking-[0.3em] text-amber text-center">
          The daily loop
        </motion.p>
        <motion.h2 {...fadeUp(0.06)} className="mt-4 text-3xl sm:text-4xl text-cream text-center" style={display}>
          One daily loop, <em className="text-gradient">four agents</em>
        </motion.h2>
        <motion.p {...fadeUp(0.12)} className="mt-3 text-sm text-cream-muted text-center max-w-xl mx-auto">
          Palate runs your marketing morning the way a great studio would — in order, with receipts.
        </motion.p>

        <div className="relative mt-14">
          {/* connecting line */}
          <div
            aria-hidden
            className="hidden md:block absolute top-[52px] left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-[rgba(244,237,227,0.18)] to-transparent"
          />
          <div className="grid md:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <motion.div key={s.n} {...fadeUp(i * 0.09)} className="relative">
                <div className="glass glass-hover rounded-2xl p-5 h-full relative">
                  <div className="flex items-start justify-between">
                    <span
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border"
                      style={{ background: s.tint, borderColor: s.ring }}
                    >
                      <s.icon className={cn("h-5 w-5", s.iconCls)} />
                    </span>
                    <span className="font-mono text-[11px] text-cream-faint pt-1">{s.n}</span>
                  </div>
                  <h3 className="mt-4 text-xl text-cream" style={display}>{s.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-cream-muted">{s.copy}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden md:flex absolute top-[42px] -right-[22px] z-10 h-6 w-6 items-center justify-center rounded-full border border-line bg-[#11150f]"
                  >
                    <ChevronRight className="h-3 w-3 text-cream-faint" />
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── humans in the loop ───────────────────────── */

function HumansInTheLoop() {
  return (
    <section className="relative border-t border-line overflow-hidden">
      <div
        aria-hidden
        className="absolute top-1/3 -left-40 h-[460px] w-[460px] rounded-full blur-[130px] opacity-[0.14] pointer-events-none"
        style={{ background: "radial-gradient(circle, #6fbf94 0%, transparent 70%)" }}
      />
      <div className="relative max-w-6xl mx-auto px-6 py-24">
        <motion.p {...fadeUp(0)} className="text-[11px] uppercase tracking-[0.3em] text-amber text-center">
          Human in the loop
        </motion.p>
        <motion.h2 {...fadeUp(0.06)} className="mt-4 text-3xl sm:text-4xl text-cream text-center" style={display}>
          Built for <em className="text-gradient">humans in the loop</em>
        </motion.h2>
        <motion.p {...fadeUp(0.12)} className="mt-3 text-sm text-cream-muted text-center max-w-xl mx-auto">
          The agent does the legwork. Your team keeps the taste.
        </motion.p>

        <div className="mt-20 space-y-24">
          <FeatureRow
            icon={MousePointerClick}
            title="Approval gates"
            copy="Nothing ships on autopilot. When the agent wants to publish, send or spend, it stops and asks — with full context, a score against your brand contract, and a one-tap decision that it remembers."
            visual={<ApprovalVisual />}
          />
          <FeatureRow
            flip
            icon={GraduationCap}
            title="A memory that learns"
            copy="Every correction becomes a lesson in the brand knowledge files. Reject a crop once and it's written down — versioned, auditable, and applied to every run that follows."
            visual={<MemoryVisual />}
          />
          <FeatureRow
            icon={BarChart3}
            title="Evidence, not vibes"
            copy="Every chart, insight and brief traces back to real customer quotes. You can always ask why — and the agent shows its receipts, down to the review that started it."
            visual={<EvidenceVisual />}
          />
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  icon: Icon, title, copy, visual, flip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  copy: string;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
      <motion.div {...fadeUp(0)} className={cn(flip && "md:order-2")}>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(196,99,58,0.3)] bg-[rgba(196,99,58,0.12)]">
          <Icon className="h-4.5 w-4.5 text-amber" />
        </span>
        <h3 className="mt-5 text-2xl sm:text-[1.7rem] text-cream" style={display}>{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-cream-muted max-w-md">{copy}</p>
      </motion.div>
      <motion.div {...fadeUp(0.12)} className={cn(flip && "md:order-1")}>
        {visual}
      </motion.div>
    </div>
  );
}

/* ───────── feature visuals (hand-built with tokens) ───────── */

function ApprovalVisual() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[32px] blur-2xl opacity-25 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(196,99,58,0.35), transparent 70%)" }}
      />
      <div className="relative rounded-2xl border border-[rgba(232,160,98,0.4)] bg-[rgba(196,99,58,0.06)] accent-ring p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquareWarning className="h-4 w-4 text-amber" />
          <span className="text-[11px] uppercase tracking-[0.14em] text-cream-faint">agent needs your decision</span>
          <span className="ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border bg-[rgba(196,99,58,0.12)] text-amber border-[rgba(196,99,58,0.3)]">post</span>
        </div>
        <p className="text-sm text-cream leading-relaxed">
          This story scored 92/100 against the brand contract. Schedule for 7:30pm tonight?
        </p>
        <div className="mt-2.5 grid gap-1 text-[11px] leading-relaxed">
          <p><span className="text-cream-faint">caption: </span><span className="text-cream-muted">Last call for the miso caramel pav — it sold out by 8 last night…</span></p>
          <p><span className="text-cream-faint">channel: </span><span className="text-cream-muted">Instagram story · Surry Hills</span></p>
        </div>
        <div className="mt-3 h-8 rounded-lg bg-[rgba(0,0,0,0.25)] border border-line px-2.5 flex items-center text-xs text-cream-faint">
          Optional note for the agent (it learns from this)…
        </div>
        <div className="mt-2.5 flex gap-2">
          <span className="inline-flex items-center justify-center h-8 px-3 rounded-xl text-xs font-medium bg-gradient-to-b from-[#d4744a] to-terracotta text-[#1a0f08] shadow-[0_8px_24px_-10px_rgba(196,99,58,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]">
            approve
          </span>
          <span className="inline-flex items-center justify-center h-8 px-3 rounded-xl text-xs font-medium border border-line-strong text-cream">
            request changes
          </span>
          <span className="inline-flex items-center justify-center h-8 px-3 rounded-xl text-xs font-medium border border-[rgba(239,116,102,0.3)] bg-[rgba(239,116,102,0.14)] text-bad">
            reject
          </span>
        </div>
      </div>
    </div>
  );
}

const KNOWLEDGE_ROWS = [
  { path: "brand/voice.md", v: "v3", by: "human", hot: false },
  { path: "brand/visual-style.md", v: "v2", by: "human", hot: false },
  { path: "learnings/feedback-log.md", v: "v7", by: "agent", hot: true },
  { path: "learnings/content-performance.md", v: "v4", by: "agent", hot: false },
];

function MemoryVisual() {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-eucalyptus" />
        <span className="text-[11px] uppercase tracking-[0.14em] text-cream-faint">brand knowledge</span>
        <span className="ml-auto font-mono text-[10px] text-cream-faint">versioned</span>
      </div>
      <div className="grid gap-1.5">
        {KNOWLEDGE_ROWS.map((r) => (
          <div
            key={r.path}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2",
              r.hot
                ? "border-[rgba(111,191,148,0.35)] bg-[rgba(111,191,148,0.07)]"
                : "border-line/70 bg-[rgba(244,237,227,0.02)]"
            )}
          >
            <FileText className={cn("h-3.5 w-3.5 shrink-0", r.hot ? "text-eucalyptus" : "text-cream-faint")} />
            <span className="font-mono text-[11.5px] text-cream truncate">{r.path}</span>
            <span className="ml-auto font-mono text-[10px] text-cream-faint">{r.v}</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-medium border",
                r.by === "agent"
                  ? "bg-[rgba(111,191,148,0.1)] text-eucalyptus border-[rgba(111,191,148,0.25)]"
                  : "bg-[rgba(244,237,227,0.06)] text-cream-muted border-line"
              )}
            >
              {r.by}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-line bg-[rgba(0,0,0,0.3)] p-3 font-mono text-[11px] leading-relaxed">
        <p className="text-cream-faint">learnings/feedback-log.md · v6 → v7</p>
        <p className="text-good mt-1">+ Never crop the pavlova — the toffee shard is the hero.</p>
        <p className="text-cream-faint mt-1">recorded after a &ldquo;request changes&rdquo; decision</p>
      </div>
    </div>
  );
}

const MINI_METRICS = [
  { label: "weekend rating", value: "2.7★", delta: "-1.9 vs midweek", bad: true },
  { label: "mentions 72h", value: "38", delta: "+24%", bad: false },
  { label: "avg sentiment", value: "0.62", delta: "+0.08", bad: false },
];

function EvidenceVisual() {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-3">
        {MINI_METRICS.map((m) => (
          <div key={m.label} className="glass rounded-2xl p-3.5 relative overflow-hidden">
            <div
              aria-hidden
              className="absolute -top-8 -right-8 h-20 w-20 rounded-full blur-2xl opacity-25 pointer-events-none"
              style={{ background: m.bad ? "#ef7466" : "#5ad48e" }}
            />
            <p className="text-[9.5px] uppercase tracking-[0.14em] text-cream-faint">{m.label}</p>
            <p className="mt-1.5 font-mono text-xl text-cream tabular-nums">{m.value}</p>
            <p className={cn("mt-0.5 text-[10px] font-medium", m.bad ? "text-bad" : "text-good")}>{m.delta}</p>
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-4">
        <div className="flex items-start gap-2.5">
          <Quote className="h-4 w-4 text-amber shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] text-cream leading-relaxed italic" style={display}>
              &ldquo;Food was incredible, but 40 minutes between entrée and mains on a Friday.&rdquo;
            </p>
            <p className="mt-1.5 text-[10.5px] text-cream-faint">Google review · Surry Hills · ★★☆☆☆</p>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-eucalyptus">
          <CornerDownRight className="h-3.5 w-3.5" />
          evidence attached to insight: Friday-night service speed
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7" />
          <p className="text-xs text-cream-faint">
            Palate — built as an AT Solutions consulting prototype for Marlow &amp; Sage.
          </p>
        </div>
        <Link
          href="/studio"
          className="sm:ml-auto inline-flex items-center gap-1.5 text-xs text-amber hover:text-cream transition-colors"
        >
          Open the studio <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </footer>
  );
}
