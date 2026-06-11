"use client";

/**
 * BlockRenderer — renders agent-pushed canvas blocks (metric/chart/table/
 * markdown/list) as rich components. Defensive: coerces strings → arrays.
 */
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { MetricCard, TrendArea, SimpleBars, TopicBars, Donut, PALETTE } from "@/components/charts/charts";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/format";

export type CanvasBlock = {
  id: string;
  kind: "metric" | "chart" | "table" | "markdown" | "list";
  title?: string | null;
  payload: Record<string, unknown>;
  created_at?: string;
};

function coerceArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
}

export function BlockRenderer({ block, compact }: { block: CanvasBlock; compact?: boolean }) {
  const p = block.payload ?? {};
  switch (block.kind) {
    case "metric": {
      return (
        <MetricCard
          label={String(p.label ?? block.title ?? "Metric")}
          value={(p.value as number | string) ?? "—"}
          delta={p.delta as number | string | undefined}
          tone={(p.tone as "good" | "bad" | "neutral") ?? "neutral"}
          caption={p.caption ? String(p.caption) : undefined}
        />
      );
    }
    case "chart": {
      const chartType = String(p.chartType ?? "bar");
      const labels = coerceArray<string>(p.labels);
      const series = coerceArray<{ name: string; data: number[]; color?: string }>(p.series);
      const explanation = p.explanation ? String(p.explanation) : undefined;

      let body: React.ReactNode = null;
      if (chartType === "donut" || chartType === "pie") {
        const data = labels.map((name, i) => ({
          name,
          value: Number(series[0]?.data?.[i] ?? 0),
          color: PALETTE[i % PALETTE.length],
        }));
        body = <Donut data={data} height={compact ? 180 : 230} />;
      } else if (chartType === "line" || chartType === "area") {
        const data = labels.map((label, i) => {
          const row: Record<string, string | number> = { label };
          for (const s of series) row[s.name] = Number(s.data?.[i] ?? 0);
          return row;
        });
        body = (
          <TrendArea
            data={data}
            series={series.map((s, i) => ({ key: s.name, name: s.name, color: s.color ?? PALETTE[i] }))}
            height={compact ? 190 : 240}
            stacked={Boolean(p.stacked)}
          />
        );
      } else if (chartType === "hbar" || (chartType === "bar" && series.length === 1 && labels.length > 5)) {
        body = (
          <TopicBars
            data={labels.map((name, i) => ({ name, value: Number(series[0]?.data?.[i] ?? 0) }))}
            height={compact ? 200 : Math.min(320, 40 + labels.length * 30)}
          />
        );
      } else {
        const data = labels.map((label, i) => {
          const row: Record<string, string | number> = { label };
          for (const s of series) row[s.name] = Number(s.data?.[i] ?? 0);
          return row;
        });
        body = (
          <SimpleBars
            data={data}
            series={series.map((s, i) => ({ key: s.name, name: s.name, color: s.color ?? PALETTE[i] }))}
            height={compact ? 190 : 240}
          />
        );
      }
      return (
        <ChartShell title={block.title ?? String(p.title ?? "Chart")} explanation={explanation}>
          {body}
        </ChartShell>
      );
    }
    case "table": {
      const columns = coerceArray<string>(p.columns);
      const rows = coerceArray<(string | number)[]>(p.rows);
      return (
        <ChartShell title={block.title ?? "Table"} explanation={p.explanation ? String(p.explanation) : undefined}>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-cream-faint uppercase tracking-wider text-[10px]">
                  {columns.map((c, i) => (
                    <th key={i} className="px-2.5 py-2 border-b border-line font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="hover:bg-[rgba(43,34,26,0.03)]">
                    {row.map((cell, ci) => (
                      <td key={ci} className={cn("px-2.5 py-2 border-b border-line/50 text-cream-muted", ci === 0 && "text-cream")}>
                        {renderCell(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartShell>
      );
    }
    case "list": {
      const items = coerceArray<{ title: string; subtitle?: string; badge?: string; tone?: string }>(p.items);
      return (
        <ChartShell title={block.title ?? "List"}>
          <div className="grid gap-1.5">
            {items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-line/60 bg-[rgba(43,34,26,0.025)] px-3 py-2"
              >
                <span className="font-mono text-[10px] text-cream-faint w-4">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-cream truncate">{item.title}</p>
                  {item.subtitle && <p className="text-[11px] text-cream-faint truncate">{item.subtitle}</p>}
                </div>
                {item.badge && (
                  <Badge tone={(item.tone as "good" | "bad" | "warn" | "neutral") ?? "neutral"}>{item.badge}</Badge>
                )}
              </motion.div>
            ))}
          </div>
        </ChartShell>
      );
    }
    case "markdown":
    default: {
      return (
        <ChartShell title={block.title ?? undefined}>
          <div className="prose-palate">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(p.content ?? "")}</ReactMarkdown>
          </div>
        </ChartShell>
      );
    }
  }
}

function renderCell(cell: string | number): React.ReactNode {
  const s = String(cell);
  if (/^(pass|approved?|good)$/i.test(s)) return <Badge tone="good">{s}</Badge>;
  if (/^(reject(ed)?|fail(ed)?|bad)$/i.test(s)) return <Badge tone="bad">{s}</Badge>;
  if (/^(flag(ged)?|warn(ing)?|pending)$/i.test(s)) return <Badge tone="warn">{s}</Badge>;
  return s;
}

function ChartShell({ title, explanation, children }: { title?: string; explanation?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.21, 0.8, 0.32, 1] }}
      className="glass rounded-2xl p-4"
    >
      {title && (
        <p className="text-[11px] uppercase tracking-[0.14em] text-cream-faint mb-2.5">{title}</p>
      )}
      {children}
      {explanation && (
        <p className="mt-2.5 text-[11px] text-cream-faint border-t border-line/60 pt-2 leading-relaxed">{explanation}</p>
      )}
    </motion.div>
  );
}
