"use client";

/**
 * ⌘K command palette — navigate, launch agent runs, and search everything
 * (reviews, briefs, assets, knowledge) from anywhere in the studio.
 */
import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity, AtSign, BookOpen, CalendarDays, Ear, FileText, Home, Image as ImageIcon, Inbox,
  MessageSquare, Palette, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Star,
} from "lucide-react";
import { cn } from "@/lib/format";

type SearchResults = {
  social: { id: string; author_name: string; source: string; snippet: string; sentiment: string | null }[];
  briefs: { id: string; title: string; for_date: string; status: string }[];
  assets: { id: string; kind: string; variant_label: string | null; format: string | null; public_url: string | null; snippet: string | null }[];
  knowledge: { path: string; title: string | null }[];
};

const NAV = [
  { label: "Overview", href: "/studio", icon: Home, kbd: "g o" },
  { label: "Listening", href: "/studio/listening", icon: Ear, kbd: "g l" },
  { label: "Briefs", href: "/studio/briefs", icon: FileText, kbd: "g b" },
  { label: "Creative", href: "/studio/creative", icon: Palette, kbd: "g c" },
  { label: "Review", href: "/studio/review", icon: ShieldCheck, kbd: "g r" },
  { label: "Calendar", href: "/studio/calendar", icon: CalendarDays, kbd: "g d" },
  { label: "Knowledge", href: "/studio/knowledge", icon: BookOpen, kbd: "g k" },
  { label: "Agent runs", href: "/studio/runs", icon: Activity, kbd: "g a" },
  { label: "Outbox", href: "/studio/outbox", icon: Inbox },
  { label: "Settings", href: "/studio/settings", icon: Settings, kbd: "g s" },
];

const RUNS = [
  { label: "Run morning sweep", workflow: "listening", icon: Ear, href: "/studio/listening" },
  { label: "Generate today's brief", workflow: "briefing", icon: FileText, href: "/studio/briefs" },
  { label: "Run brand review", workflow: "review", icon: ShieldCheck, href: "/studio/review" },
  { label: "Run full daily pipeline", workflow: "pipeline", icon: Sparkles, href: "/studio" },
];

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  google_reviews: Star, facebook: MessageSquare, instagram: AtSign,
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<SearchResults | null>(null);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (!open) { setQ(""); setResults(null); }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // debounced global search
  React.useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        setResults(await res.json());
      } catch { setResults(null); }
      finally { setSearching(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => { onClose(); router.push(href); };

  const launch = async (workflow: string, label: string, href: string) => {
    onClose();
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow }),
    });
    if (!res.ok) { toast.error("Couldn't start the agent"); return; }
    const { runId } = await res.json();
    window.dispatchEvent(new CustomEvent("palate:run-started", { detail: { runId, workflow } }));
    toast.success(`${label} started`, {
      description: "Watch it live in the agent dock, bottom-left.",
      action: { label: "Open page", onClick: () => router.push(href) },
    });
  };

  const syncSources = async () => {
    onClose();
    const res = await fetch("/api/ingest", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    toast.success(`Synced — ${data.inserted ?? 0} fresh mentions landed`);
    router.refresh();
  };

  const match = (label: string) => !q.trim() || label.toLowerCase().includes(q.trim().toLowerCase());
  const hasResults = results && (results.social.length || results.briefs.length || results.assets.length || results.knowledge.length);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18, ease: [0.21, 0.8, 0.32, 1] }}
            className="mx-auto mt-[14vh] w-full max-w-xl px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Command shouldFilter={false} className="glass rounded-2xl overflow-hidden border-line-strong">
              <div className="flex items-center gap-2.5 px-4 border-b border-line">
                <Search className={cn("h-4 w-4 shrink-0", searching ? "text-amber animate-pulse" : "text-cream-faint")} />
                <Command.Input
                  value={q}
                  onValueChange={setQ}
                  autoFocus
                  placeholder="Search posts, briefs, assets… or jump anywhere"
                  className="h-12 w-full bg-transparent text-sm text-cream placeholder:text-cream-faint outline-none"
                />
                <kbd className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-cream-faint">esc</kbd>
              </div>

              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-xs text-cream-faint">
                  Nothing matches — try a dish, an author, or a page name.
                </Command.Empty>

                {/* search results */}
                {hasResults ? (
                  <>
                    {results!.social.length > 0 && (
                      <Group heading="Customer chatter">
                        {results!.social.map((s) => {
                          const Icon = SOURCE_ICONS[s.source] ?? MessageSquare;
                          return (
                            <Item key={s.id} onSelect={() => go("/studio/listening")}>
                              <Icon className="h-3.5 w-3.5 text-cream-faint shrink-0" />
                              <span className="truncate"><span className="text-cream">{s.author_name}</span> <span className="text-cream-muted">— {s.snippet}…</span></span>
                              {s.sentiment && (
                                <span className={cn("ml-auto text-[9px] uppercase tracking-wide shrink-0",
                                  s.sentiment === "positive" ? "text-good" : s.sentiment === "negative" ? "text-bad" : "text-cream-faint")}>
                                  {s.sentiment}
                                </span>
                              )}
                            </Item>
                          );
                        })}
                      </Group>
                    )}
                    {results!.briefs.length > 0 && (
                      <Group heading="Briefs">
                        {results!.briefs.map((b) => (
                          <Item key={b.id} onSelect={() => go("/studio/briefs")}>
                            <FileText className="h-3.5 w-3.5 text-cream-faint shrink-0" />
                            <span className="truncate text-cream">{b.title}</span>
                            <span className="ml-auto text-[10px] text-cream-faint shrink-0">{b.for_date} · {b.status}</span>
                          </Item>
                        ))}
                      </Group>
                    )}
                    {results!.assets.length > 0 && (
                      <Group heading="Creative assets">
                        {results!.assets.map((a) => (
                          <Item key={a.id} onSelect={() => go("/studio/creative")}>
                            {a.public_url && a.kind === "image" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.public_url} alt="" className="h-7 w-7 rounded-md object-cover border border-line shrink-0" />
                            ) : (
                              <ImageIcon className="h-3.5 w-3.5 text-cream-faint shrink-0" />
                            )}
                            <span className="truncate text-cream-muted">{a.variant_label ?? a.kind}{a.snippet ? ` — ${a.snippet}…` : ""}</span>
                            {a.format && <span className="ml-auto font-mono text-[9px] text-cream-faint shrink-0">{a.format}</span>}
                          </Item>
                        ))}
                      </Group>
                    )}
                    {results!.knowledge.length > 0 && (
                      <Group heading="Knowledge">
                        {results!.knowledge.map((k) => (
                          <Item key={k.path} onSelect={() => go("/studio/knowledge")}>
                            <BookOpen className="h-3.5 w-3.5 text-cream-faint shrink-0" />
                            <span className="font-mono text-[11px] text-cream">{k.path}</span>
                            {k.title && <span className="ml-auto text-[10px] text-cream-faint truncate">{k.title}</span>}
                          </Item>
                        ))}
                      </Group>
                    )}
                  </>
                ) : null}

                {/* actions */}
                {(RUNS.some((r) => match(r.label)) || match("sync sources fresh mentions")) && (
                  <Group heading="Run the agent">
                    {RUNS.filter((r) => match(r.label)).map((r) => (
                      <Item key={r.workflow} onSelect={() => launch(r.workflow, r.label, r.href)}>
                        <r.icon className="h-3.5 w-3.5 text-amber shrink-0" />
                        <span className="text-cream">{r.label}</span>
                        <span className="ml-auto text-[9px] uppercase tracking-wider text-cream-faint">agent</span>
                      </Item>
                    ))}
                    {match("sync sources fresh mentions") && (
                      <Item onSelect={syncSources}>
                        <RefreshCw className="h-3.5 w-3.5 text-eucalyptus shrink-0" />
                        <span className="text-cream">Sync sources now</span>
                        <span className="ml-auto text-[9px] uppercase tracking-wider text-cream-faint">connector</span>
                      </Item>
                    )}
                  </Group>
                )}

                {NAV.some((n) => match(n.label)) && (
                  <Group heading="Go to">
                    {NAV.filter((n) => match(n.label)).map((n) => (
                      <Item key={n.href} onSelect={() => go(n.href)}>
                        <n.icon className="h-3.5 w-3.5 text-cream-faint shrink-0" />
                        <span className="text-cream">{n.label}</span>
                        {n.kbd && <kbd className="ml-auto font-mono text-[9px] text-cream-faint">{n.kbd}</kbd>}
                      </Item>
                    ))}
                  </Group>
                )}
              </Command.List>

              <div className="flex items-center gap-3 px-4 py-2 border-t border-line text-[10px] text-cream-faint">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">↵</kbd> select</span>
                <span className="ml-auto">tip: press <kbd className="font-mono">g</kbd> then a letter anywhere</span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-cream-faint"
    >
      {children}
    </Command.Group>
  );
}

function Item({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs cursor-pointer data-[selected=true]:bg-[rgba(196,99,58,0.14)] data-[selected=true]:border-[rgba(196,99,58,0.25)] border border-transparent"
    >
      {children}
    </Command.Item>
  );
}
