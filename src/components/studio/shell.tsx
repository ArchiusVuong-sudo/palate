"use client";

/**
 * Studio shell — sidebar nav, topbar, and the collapsible Copilot drawer.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, BookOpen, CalendarDays, Ear, FileText, Home, Inbox, MessageCircle,
  Palette, Search, Settings, ShieldCheck, X,
} from "lucide-react";
import { CopilotPanel } from "@/components/agent/copilot-panel";
import { CommandPalette } from "@/components/studio/command-palette";
import { AgentDock } from "@/components/studio/agent-dock";
import { cn } from "@/lib/format";

const G_CHORDS: Record<string, string> = {
  o: "/studio", l: "/studio/listening", b: "/studio/briefs", c: "/studio/creative",
  r: "/studio/review", d: "/studio/calendar", k: "/studio/knowledge", a: "/studio/runs", s: "/studio/settings",
};

const NAV = [
  { href: "/studio", label: "Overview", icon: Home, exact: true },
  { href: "/studio/listening", label: "Listening", icon: Ear, step: "01" },
  { href: "/studio/briefs", label: "Briefs", icon: FileText, step: "02" },
  { href: "/studio/creative", label: "Creative", icon: Palette, step: "03" },
  { href: "/studio/review", label: "Review", icon: ShieldCheck, step: "04" },
  { href: "/studio/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/studio/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/studio/runs", label: "Agent runs", icon: Activity },
  { href: "/studio/outbox", label: "Outbox", icon: Inbox },
  { href: "/studio/settings", label: "Settings", icon: Settings },
];

export function StudioShell({
  children,
  badges,
}: {
  children: React.ReactNode;
  badges?: { approvals?: number; actions?: number; unanalyzed?: number };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [copilotOpen, setCopilotOpen] = React.useState(true);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [ask, setAsk] = React.useState<{ prompt: string; nonce: number } | null>(null);
  const gChordRef = React.useRef<number>(0);

  React.useEffect(() => {
    const saved = localStorage.getItem("palate-copilot-open");
    if (saved !== null) setCopilotOpen(saved === "1");
  }, []);

  // "Ask Palate" handoff from anywhere — open the drawer with a prefilled prompt
  React.useEffect(() => {
    const onAsk = (e: Event) => {
      const prompt = (e as CustomEvent).detail?.prompt;
      if (!prompt) return;
      setCopilotOpen(true);
      localStorage.setItem("palate-copilot-open", "1");
      setAsk({ prompt: String(prompt), nonce: Date.now() });
    };
    window.addEventListener("palate:ask", onAsk);
    return () => window.removeEventListener("palate:ask", onAsk);
  }, []);

  // global keyboard: ⌘K palette + g-chord navigation
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (typing || paletteOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "g") { gChordRef.current = Date.now(); return; }
      if (Date.now() - gChordRef.current < 900 && G_CHORDS[key]) {
        gChordRef.current = 0;
        router.push(G_CHORDS[key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, router]);
  const toggleCopilot = () => {
    setCopilotOpen((o) => {
      localStorage.setItem("palate-copilot-open", o ? "0" : "1");
      return !o;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden relative z-10">
      {/* ───── sidebar ───── */}
      <aside className="w-56 shrink-0 border-r border-line flex flex-col bg-[rgba(11,14,12,0.6)] backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-line">
          <LogoMark />
          <div>
            <p className="text-[15px] leading-none text-cream" style={{ fontFamily: "var(--font-display), serif" }}>Palate</p>
            <p className="text-[9.5px] uppercase tracking-[0.22em] text-cream-faint mt-1">marketing studio</p>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const badge =
              item.label === "Review" ? badges?.approvals :
              item.label === "Listening" ? badges?.unanalyzed :
              item.label === "Overview" ? badges?.actions : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-all relative",
                  active
                    ? "text-cream bg-[rgba(196,99,58,0.13)] border border-[rgba(196,99,58,0.25)]"
                    : "text-cream-muted border border-transparent hover:text-cream hover:bg-[rgba(244,237,227,0.04)]"
                )}
              >
                <item.icon className={cn("h-4 w-4", active ? "text-amber" : "text-cream-faint group-hover:text-cream-muted")} />
                {item.label}
                <span className="ml-auto flex items-center gap-1.5">
                  {badge !== undefined && badge > 0 && (
                    <span className="rounded-full bg-[rgba(196,99,58,0.85)] text-[#1a0f08] text-[10px] font-semibold h-4.5 min-w-4.5 px-1 inline-flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                  {item.step && <span className="font-mono text-[9px] text-cream-faint">{item.step}</span>}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-line">
          <p className="text-[10px] text-cream-faint leading-relaxed">
            Marlow &amp; Sage<br />
            <span className="text-cream-muted">Surry Hills · Fitzroy · Burleigh</span>
          </p>
        </div>
      </aside>

      {/* ───── main ───── */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 border-b border-line flex items-center px-6 gap-3 bg-[rgba(11,14,12,0.5)] backdrop-blur-xl">
          <Breadcrumb pathname={pathname} />
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl h-9 px-3 text-xs text-cream-faint border border-line hover:border-line-strong hover:text-cream-muted transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Search or command</span>
              <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[9px]">⌘K</kbd>
            </button>
            <button
              onClick={toggleCopilot}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3.5 h-9 text-xs font-medium border transition-all",
                copilotOpen
                  ? "border-[rgba(111,191,148,0.35)] bg-[rgba(111,191,148,0.1)] text-eucalyptus"
                  : "border-line-strong text-cream-muted hover:text-cream hover:border-[rgba(244,237,227,0.3)]"
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Copilot
              <span className={cn("dot", copilotOpen ? "bg-eucalyptus dot-pulse" : "bg-cream-faint")} />
            </button>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-6 max-w-[1200px] mx-auto">{children}</div>
        </div>
      </main>

      {/* ───── copilot drawer ───── */}
      <AnimatePresence initial={false}>
        {copilotOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.21, 0.8, 0.32, 1] }}
            className="shrink-0 border-l border-line bg-[rgba(13,17,14,0.7)] backdrop-blur-2xl overflow-hidden relative"
          >
            <div className="w-[400px] h-full flex flex-col">
              <button
                onClick={toggleCopilot}
                className="absolute top-3 right-3 z-10 text-cream-faint hover:text-cream p-1 rounded-lg hover:bg-[rgba(244,237,227,0.06)]"
                title="Close copilot"
              >
                <X className="h-4 w-4" />
              </button>
              <CopilotPanel prefill={ask} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <AgentDock />
    </div>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const seg = pathname.split("/").filter(Boolean);
  const page = seg[1] ? seg[1][0].toUpperCase() + seg[1].slice(1) : "Overview";
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-cream-faint">Studio</span>
      <span className="text-cream-faint">/</span>
      <span className="text-sm text-cream" style={{ fontFamily: "var(--font-display), serif" }}>{page}</span>
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-8 w-8 items-center justify-center rounded-xl overflow-hidden", className)}
      style={{ background: "linear-gradient(135deg, #c4633a 0%, #e8a062 100%)" }}>
      <span className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 70% 20%, white, transparent 50%)" }} />
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 relative" fill="none" stroke="#1a0f08" strokeWidth="2.2" strokeLinecap="round">
        <path d="M12 3v7" />
        <path d="M8 3v4a4 4 0 0 0 8 0V3" />
        <path d="M12 10v11" />
        <path d="M18 21c0-4 1-9 1-13a3 3 0 0 0-3-3" opacity="0.55" />
      </svg>
    </span>
  );
}
