"use client";

/**
 * Knowledge studio — the agent's evolving memory filesystem. Brand voice,
 * guidelines and the lessons the agent files back after every run.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { BookOpen, Eye, EyeOff, FileText, Folder, History, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import type { KnowledgeFile } from "@/lib/queries";
import {
  Badge, Button, Card, EmptyState, Input, Modal, SectionTitle, Textarea, WorkingDots,
} from "@/components/ui/primitives";
import { cn, timeAgo } from "@/lib/format";

const PATH_RE = /^[a-z0-9-_/.]+\.md$/i;
const KNOWN_FOLDERS = ["brand", "audience", "operations", "learnings"];

const basename = (path: string) => path.split("/").pop() ?? path;

/* ───────── memory evolution: revision types + tiny line diff ───────── */

type Revision = {
  version: number;
  content: string;
  updated_by: string;
  change_note: string | null;
  created_at: string;
};

type DiffLine = { type: "add" | "del" | "ctx"; text: string };

const DIFF_LINE_CAP = 400;

/** Simple LCS line diff: old = the past revision, new = the current content. */
function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n").slice(0, DIFF_LINE_CAP);
  const b = newText.split("\n").slice(0, DIFF_LINE_CAP);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "ctx", text: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}

function groupFiles(files: KnowledgeFile[]): [string, KnowledgeFile[]][] {
  const groups = new Map<string, KnowledgeFile[]>();
  for (const f of files) {
    const top = f.path.includes("/") ? f.path.split("/")[0].toLowerCase() : "";
    const key = KNOWN_FOLDERS.includes(top) ? top : "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return [...KNOWN_FOLDERS, "other"].filter((k) => groups.has(k)).map((k) => [k, groups.get(k)!]);
}

export function KnowledgeView({ files }: { files: KnowledgeFile[] }) {
  const router = useRouter();
  const [selectedPath, setSelectedPath] = React.useState<string | null>(files[0]?.path ?? null);
  const selected = React.useMemo(
    () => files.find((f) => f.path === selectedPath) ?? files[0] ?? null,
    [files, selectedPath]
  );

  const [draft, setDraft] = React.useState(selected?.content ?? "");
  const [changeNote, setChangeNote] = React.useState("");
  const [preview, setPreview] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [newPath, setNewPath] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");
  const [newContent, setNewContent] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Memory evolution — revision history state.
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [revisions, setRevisions] = React.useState<Revision[] | null>(null);
  const [loadingRevs, setLoadingRevs] = React.useState(false);
  const [viewedVersion, setViewedVersion] = React.useState<number | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  // Re-sync the editor whenever a different file (or a fresh version of it) arrives.
  const selectedId = selected?.id;
  const selectedVersion = selected?.version;
  React.useEffect(() => {
    setDraft(selected?.content ?? "");
    setChangeNote("");
    setHistoryOpen(false);
    setRevisions(null);
    setViewedVersion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedVersion]);

  const toggleHistory = async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    if (!selected) return;
    setHistoryOpen(true);
    setViewedVersion(null);
    setLoadingRevs(true);
    try {
      const res = await fetch(`/api/knowledge/revisions?fileId=${encodeURIComponent(selected.id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { revisions: Revision[] };
      setRevisions(data.revisions ?? []);
    } catch {
      toast.error("Couldn't load the file's history");
      setRevisions([]);
    } finally {
      setLoadingRevs(false);
    }
  };

  const restore = async (rev: Revision) => {
    if (!selected) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selected.path, content: rev.content, change_note: `restored v${rev.version}` }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { version?: number };
      toast.success(`Restored v${rev.version}${data.version ? ` — now v${data.version}` : ""}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't restore the version");
    } finally {
      setRestoring(false);
    }
  };

  const groups = React.useMemo(() => groupFiles(files), [files]);
  const dirty = selected ? draft !== selected.content : false;

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selected.path, content: draft, change_note: changeNote.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { version?: number };
      toast.success(`Saved ${selected.path}${data.version ? ` — now v${data.version}` : ""}`);
      setChangeNote("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the file");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.path}? The agent loses this memory permanently.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/knowledge?path=${encodeURIComponent(selected.path)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`Deleted ${selected.path}`);
      setSelectedPath(null);
      router.refresh();
    } catch {
      toast.error("Couldn't delete the file");
    } finally {
      setDeleting(false);
    }
  };

  const createFile = async () => {
    const path = newPath.trim();
    if (!PATH_RE.test(path)) {
      toast.error("Path must look like learnings/example.md");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          title: newTitle.trim() || undefined,
          content: newContent,
          change_note: "Created in studio",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : `HTTP ${res.status}`);
      }
      toast.success(`Created ${path}`);
      setModalOpen(false);
      setNewPath("");
      setNewTitle("");
      setNewContent("");
      setSelectedPath(path);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the file");
    } finally {
      setCreating(false);
    }
  };

  const agentEdited = selected?.updated_by === "agent";

  return (
    <div className="pb-10">
      <SectionTitle
        title={<>Brand <em className="text-gradient">knowledge</em></>}
        subtitle="The agent's memory — it reads this before every job and writes lessons back"
        right={
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> New file
          </Button>
        }
      />

      {files.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={<BookOpen />}
            title="No knowledge yet"
            hint="Create the first file, or let the agent write its own lesson after the next run."
            action={
              <Button variant="outline" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" /> New file
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mt-5 grid lg:grid-cols-[280px_1fr] gap-5 items-start">
          {/* ───── file tree ───── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="p-2.5">
              {groups.map(([folder, items], gi) => (
                <div key={folder} className={gi > 0 ? "mt-3" : undefined}>
                  <div className="flex items-center gap-1.5 px-2 pb-1">
                    <Folder className="h-3 w-3 text-cream-faint" />
                    <span className="text-[10px] uppercase tracking-[0.18em] text-cream-faint">{folder}</span>
                    <span className="ml-auto font-mono text-[9px] text-cream-faint">{items.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {items.map((f, i) => (
                      <FileRow
                        key={f.id}
                        file={f}
                        active={selected?.path === f.path}
                        index={gi * 2 + i}
                        onSelect={() => setSelectedPath(f.path)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </Card>

            {/* tip callout */}
            <div className="glass rounded-2xl p-4" style={{ borderColor: "rgba(63,146,104,0.22)" }}>
              <div className="flex items-start gap-2.5">
                <BookOpen className="h-4 w-4 text-eucalyptus shrink-0 mt-0.5" />
                <p className="text-[11px] text-cream-muted leading-relaxed">
                  Tip — tell the copilot things like <span className="text-cream">“never use the word cheap”</span> and
                  it will file the lesson here itself.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ───── editor ───── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            {selected ? (
              <Card className="overflow-hidden">
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-cream-faint truncate">
                      {selected.path} <span className="text-cream-muted">· v{selected.version}</span>
                    </p>
                    <h3 className="mt-0.5 text-lg text-cream truncate" style={{ fontFamily: "var(--font-display), serif" }}>
                      {selected.title ?? basename(selected.path)}
                    </h3>
                    <p className="mt-1 text-[11px] text-cream-muted">
                      updated {timeAgo(selected.updated_at)}
                      {selected.change_note && (
                        <span className="italic text-cream-faint"> — “{selected.change_note}”</span>
                      )}
                    </p>
                  </div>
                  <Badge tone={agentEdited ? "agent" : "neutral"} className="shrink-0">
                    {agentEdited && <Sparkles className="h-3 w-3" />}
                    {selected.updated_by}
                  </Badge>
                </div>

                <div className="p-4">
                  {historyOpen ? (
                    <HistoryPanel
                      file={selected}
                      revisions={revisions}
                      loading={loadingRevs}
                      viewedVersion={viewedVersion}
                      onView={(v) => setViewedVersion((cur) => (cur === v ? null : v))}
                      onRestore={restore}
                      restoring={restoring}
                    />
                  ) : preview ? (
                    <div className="prose-palate min-h-[420px] max-h-[62vh] overflow-y-auto rounded-xl border border-line bg-[rgba(43,34,26,0.04)] px-4 py-3">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft || "*Nothing here yet.*"}</ReactMarkdown>
                    </div>
                  ) : (
                    <Textarea
                      rows={24}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                      className="font-mono text-xs leading-relaxed"
                    />
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (historyOpen) {
                            setHistoryOpen(false);
                            setPreview(true);
                          } else {
                            setPreview((p) => !p);
                          }
                        }}
                      >
                        {preview && !historyOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {preview && !historyOpen ? "Edit markdown" : "Preview"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleHistory}
                        className={historyOpen ? "text-amber" : undefined}
                      >
                        <History className="h-3.5 w-3.5" />
                        {historyOpen ? "Close history" : `History v${selected.version}`}
                      </Button>
                    </div>
                    {dirty && (
                      <span className="flex items-center gap-1.5 text-[10px] text-amber">
                        <span className="dot bg-amber" style={{ width: 6, height: 6 }} /> unsaved changes
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
                  <Input
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    placeholder="What changed and why?"
                    className="h-8 flex-1 min-w-[200px] text-xs"
                  />
                  <Button size="sm" loading={saving} onClick={save}>
                    Save (v{selected.version + 1})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={deleting}
                    onClick={remove}
                    aria-label={`Delete ${selected.path}`}
                    className="px-2 text-bad hover:text-bad hover:bg-[rgba(207,75,59,0.12)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ) : (
              <Card>
                <EmptyState icon={<FileText />} title="Pick a file" hint="Choose a file from the tree to read or edit it." />
              </Card>
            )}
          </motion.div>
        </div>
      )}

      {/* ───── new file modal ───── */}
      <Modal open={modalOpen} onClose={() => !creating && setModalOpen(false)}>
        <div className="p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-amber" />
            <h3 className="text-lg text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
              New knowledge file
            </h3>
          </div>
          <p className="mt-1 text-xs text-cream-muted">
            The agent reads every file here before each job — write it like a briefing note.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-cream-faint">Path</p>
              <Input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="learnings/example.md"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-cream-faint">Title</p>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Lessons from review feedback"
                className="mt-1"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-cream-faint">Content</p>
              <Textarea
                rows={10}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder={"# Title\n\nMarkdown welcome — dot points beat prose."}
                spellCheck={false}
                className="mt-1 font-mono text-xs leading-relaxed"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button loading={creating} onClick={createFile}>
              <Plus className="h-4 w-4" /> Create file
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ───────── file tree row ───────── */

function FileRow({
  file, active, index, onSelect,
}: {
  file: KnowledgeFile;
  active: boolean;
  index: number;
  onSelect: () => void;
}) {
  const agent = file.updated_by === "agent";
  return (
    <motion.button
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03 }}
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[12.5px] transition-all",
        active
          ? "text-cream bg-[rgba(196,99,58,0.13)] border-[rgba(196,99,58,0.25)]"
          : "text-cream-muted border-transparent hover:text-cream hover:bg-[rgba(43,34,26,0.04)]"
      )}
    >
      <FileText className={cn("h-3.5 w-3.5 shrink-0", active ? "text-amber" : "text-cream-faint")} />
      <span className="flex-1 min-w-0 truncate">{basename(file.path)}</span>
      {agent && (
        <span
          className="dot shrink-0 bg-eucalyptus"
          style={{ width: 6, height: 6, boxShadow: "0 0 10px 1.5px rgba(63,146,104,0.8)" }}
          title="last updated by the agent"
        />
      )}
      <span className="font-mono text-[9px] text-cream-faint shrink-0">v{file.version}</span>
      <Badge tone={agent ? "agent" : "neutral"} className="px-1.5 py-0 text-[9px] shrink-0">
        {file.updated_by}
      </Badge>
    </motion.button>
  );
}

/* ───────── memory evolution: history timeline + diff ───────── */

function VersionChip({ version, current }: { version: number; current?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px]",
        current
          ? "border-[rgba(201,127,61,0.35)] bg-[rgba(201,127,61,0.10)] text-amber"
          : "border-line text-cream-muted"
      )}
    >
      v{version}
    </span>
  );
}

function HistoryPanel({
  file, revisions, loading, viewedVersion, onView, onRestore, restoring,
}: {
  file: KnowledgeFile;
  revisions: Revision[] | null;
  loading: boolean;
  viewedVersion: number | null;
  onView: (version: number) => void;
  onRestore: (rev: Revision) => void;
  restoring: boolean;
}) {
  const past = React.useMemo(
    () => (revisions ?? []).filter((r) => r.version !== file.version),
    [revisions, file.version]
  );

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-line bg-[rgba(43,34,26,0.03)]">
        <WorkingDots label="Reading the agent's memory…" />
      </div>
    );
  }

  return (
    <div className="min-h-[420px] max-h-[62vh] overflow-y-auto rounded-xl border border-line bg-[rgba(43,34,26,0.02)] p-3 animate-in-up">
      <div className="relative pl-5">
        {/* timeline rail */}
        <span
          aria-hidden
          className="absolute left-[5px] top-2 bottom-2 w-px"
          style={{ backgroundColor: "rgba(43,34,26,0.12)" }}
        />

        {/* current version, pinned */}
        <div className="relative">
          <span
            aria-hidden
            className="absolute -left-[18px] top-[13px] h-2 w-2 rounded-full bg-amber"
            style={{ boxShadow: "0 0 8px 1px rgba(201,127,61,0.5)" }}
          />
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(201,127,61,0.25)] bg-[rgba(201,127,61,0.06)] px-2.5 py-2">
            <VersionChip version={file.version} current />
            <span className="text-[10px] uppercase tracking-[0.14em] text-amber shrink-0">current</span>
            <Badge tone={file.updated_by === "agent" ? "agent" : "neutral"} className="px-1.5 py-0 text-[9px] shrink-0">
              {file.updated_by === "agent" && <Sparkles className="h-2.5 w-2.5" />}
              {file.updated_by}
            </Badge>
            {file.change_note && (
              <span className="min-w-0 flex-1 truncate text-[11px] italic text-cream-muted" title={file.change_note}>
                “{file.change_note}”
              </span>
            )}
            <span className="ml-auto shrink-0 text-[10px] text-cream-faint">{timeAgo(file.updated_at)}</span>
          </div>
        </div>

        {/* past revisions */}
        {past.length === 0 ? (
          <p className="px-2.5 py-4 text-[11px] italic text-cream-faint">
            No earlier revisions recorded yet — history starts with the next save.
          </p>
        ) : (
          <div className="mt-1.5 grid grid-cols-1 gap-1.5">
            {past.map((rev) => {
              const agent = rev.updated_by === "agent";
              const open = viewedVersion === rev.version;
              return (
                <div key={rev.version} className="relative">
                  <span
                    aria-hidden
                    className={cn("absolute -left-[17px] top-[14px] h-1.5 w-1.5 rounded-full", agent ? "bg-eucalyptus" : "")}
                    style={agent ? undefined : { backgroundColor: "rgba(43,34,26,0.25)" }}
                  />
                  <button
                    onClick={() => onView(rev.version)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all",
                      open
                        ? "border-[rgba(196,99,58,0.25)] bg-[rgba(196,99,58,0.08)]"
                        : "border-transparent hover:border-line hover:bg-[rgba(43,34,26,0.04)]"
                    )}
                  >
                    <VersionChip version={rev.version} />
                    <Badge tone={agent ? "agent" : "neutral"} className="px-1.5 py-0 text-[9px] shrink-0">
                      {agent && <Sparkles className="h-2.5 w-2.5" />}
                      {rev.updated_by}
                    </Badge>
                    {rev.change_note && (
                      <span className="min-w-0 flex-1 truncate text-[11px] italic text-cream-muted" title={rev.change_note}>
                        “{rev.change_note}”
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] text-cream-faint">{timeAgo(rev.created_at)}</span>
                  </button>
                  {open && (
                    <RevisionDiff rev={rev} file={file} onRestore={onRestore} restoring={restoring} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RevisionDiff({
  rev, file, onRestore, restoring,
}: {
  rev: Revision;
  file: KnowledgeFile;
  onRestore: (rev: Revision) => void;
  restoring: boolean;
}) {
  const full = React.useMemo(() => diffLines(rev.content, file.content), [rev.content, file.content]);
  const lines = full.slice(0, DIFF_LINE_CAP);
  const truncated = full.length > DIFF_LINE_CAP;
  const adds = full.filter((l) => l.type === "add").length;
  const dels = full.filter((l) => l.type === "del").length;

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-line animate-in-up">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[rgba(43,34,26,0.03)] px-3 py-2">
        <p className="font-mono text-[10px] text-cream-muted">
          v{rev.version} → v{file.version} <span className="text-cream-faint">(current)</span>
        </p>
        <span className="font-mono text-[10px] text-good">+{adds}</span>
        <span className="font-mono text-[10px] text-bad">−{dels}</span>
        <Button
          size="sm"
          variant="outline"
          loading={restoring}
          onClick={() => onRestore(rev)}
          className="ml-auto h-7 text-[11px]"
        >
          <RotateCcw className="h-3 w-3" /> Restore this version
        </Button>
      </div>
      <div className="max-h-[42vh] overflow-y-auto py-1 font-mono text-[11px] leading-relaxed">
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2 whitespace-pre-wrap break-words px-3",
              l.type === "del" && "bg-[rgba(207,75,59,0.08)] text-bad",
              l.type === "add" && "bg-[rgba(47,158,99,0.08)] text-good",
              l.type === "ctx" && "text-cream-faint"
            )}
          >
            <span className="w-3 shrink-0 select-none">{l.type === "del" ? "−" : l.type === "add" ? "+" : " "}</span>
            <span className="min-w-0 flex-1">{l.text || " "}</span>
          </div>
        ))}
        {truncated && (
          <p className="px-3 py-1.5 text-[10px] italic text-cream-faint">… diff truncated at {DIFF_LINE_CAP} lines</p>
        )}
      </div>
    </div>
  );
}
