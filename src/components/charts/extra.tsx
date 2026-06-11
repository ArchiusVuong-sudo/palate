"use client";

/**
 * Extra chart primitives — GitHub-style activity heatmap and a location
 * radar comparison. Same visual language as charts.tsx (gradients, glass).
 * All charts gate on mount so SSR never measures a zero-size container.
 */
import * as React from "react";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Tooltip,
} from "recharts";
import { cn, fmtNumber } from "@/lib/format";

const PALETTE = ["#e8a062", "#6fbf94", "#4f87ad", "#c4633a", "#b98a23", "#b58ad6"];

function useMounted() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => { setM(true); }, []);
  return m;
}

/* ───────── Activity heatmap (weeks × weekdays) ───────── */

export type HeatmapDay = { day: string; count: number; avg_sentiment: number | null };

const DOW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function cellColor(d: HeatmapDay, max: number): string {
  if (d.count === 0) return "rgba(43,34,26,0.05)";
  const t = 0.3 + 0.7 * Math.min(1, d.count / Math.max(1, max));
  const s = d.avg_sentiment;
  const base = s !== null && s < -0.15 ? "207,75,59" : s !== null && s > 0.15 ? "63,146,104" : "217,122,63";
  return `rgba(${base},${t.toFixed(2)})`;
}

export function ActivityHeatmap({ data, className }: { data: HeatmapDay[]; className?: string }) {
  const [hover, setHover] = React.useState<HeatmapDay | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));

  // pad the front so the first column starts on Monday
  const firstDow = data.length ? (new Date(`${data[0].day}T00:00:00`).getDay() + 6) % 7 : 0;
  const padded: (HeatmapDay | null)[] = [...Array.from({ length: firstDow }, () => null), ...data];
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  const monthLabels = weeks.map((w, i) => {
    const first = w.find(Boolean);
    if (!first) return "";
    const dt = new Date(`${first.day}T00:00:00`);
    if (i === 0) return dt.toLocaleDateString("en-AU", { month: "short" });
    const prev = weeks[i - 1]?.find(Boolean);
    if (prev && new Date(`${prev.day}T00:00:00`).getMonth() !== dt.getMonth()) {
      return dt.toLocaleDateString("en-AU", { month: "short" });
    }
    return "";
  });

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex gap-2">
        <div className="grid shrink-0 gap-[3px] pt-[18px]" style={{ gridTemplateRows: "repeat(7, 13px)" }}>
          {DOW_LABELS.map((l, i) => (
            <span key={i} className="text-[8.5px] leading-[13px] text-cream-faint font-mono">{l}</span>
          ))}
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex flex-col gap-[3px] w-max">
            <div className="flex gap-[3px]">
              {monthLabels.map((m, i) => (
                <span key={i} className="w-[13px] shrink-0 text-[8.5px] text-cream-faint font-mono overflow-visible whitespace-nowrap" style={{ height: 15 }}>
                  {m}
                </span>
              ))}
            </div>
            {Array.from({ length: 7 }, (_, dow) => (
              <div key={dow} className="flex gap-[3px]">
                {weeks.map((w, wi) => {
                  const d = w[dow];
                  return (
                    <span
                      key={wi}
                      onMouseEnter={() => d && setHover(d)}
                      onMouseLeave={() => setHover(null)}
                      className={cn(
                        "h-[13px] w-[13px] shrink-0 rounded-[3px] transition-transform",
                        d && d.count > 0 && "hover:scale-125 hover:ring-1 hover:ring-[rgba(43,34,26,0.5)]"
                      )}
                      style={{ background: d ? cellColor(d, max) : "transparent" }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-cream-faint min-h-[16px]">
        {hover ? (
          <span className="text-cream-muted">
            <span className="font-mono text-cream">{hover.count}</span> mention{hover.count === 1 ? "" : "s"} ·{" "}
            {new Date(`${hover.day}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            {hover.avg_sentiment !== null && (
              <span className={hover.avg_sentiment > 0.15 ? "text-good" : hover.avg_sentiment < -0.15 ? "text-bad" : ""}>
                {" "}· sentiment {hover.avg_sentiment > 0 ? "+" : ""}{hover.avg_sentiment.toFixed(2)}
              </span>
            )}
          </span>
        ) : (
          <>
            <span>quiet</span>
            <span className="flex gap-[3px]">
              {[0.12, 0.3, 0.55, 0.8, 1].map((t) => (
                <span key={t} className="h-[10px] w-[10px] rounded-[2.5px]" style={{ background: `rgba(201,127,61,${t})` }} />
              ))}
            </span>
            <span>busy · green positive · red negative</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────── Radar comparison ───────── */

function RadarTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number | string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-[rgba(255,255,255,0.97)] px-3 py-2 shadow-2xl backdrop-blur-md">
      {label !== undefined && <p className="text-[10px] uppercase tracking-wider text-cream-faint mb-1">{label}</p>}
      <div className="grid grid-cols-1 gap-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? PALETTE[i] }} />
            <span className="text-cream-muted">{p.name}</span>
            <span className="ml-auto font-mono text-cream pl-3">{fmtNumber(p.value as number)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RadarCompare({
  data, series, height = 260,
}: {
  data: Array<Record<string, string | number>>;
  series: { key: string; name: string; color?: string }[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="74%">
        <PolarGrid stroke="rgba(43,34,26,0.1)" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: "rgba(43,34,26,0.55)", fontSize: 10.5, fontFamily: "var(--font-geist-mono)" }}
        />
        <Tooltip content={<RadarTooltip />} />
        {series.map((s, i) => {
          const color = s.color ?? PALETTE[i];
          return (
            <Radar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stroke={color}
              strokeWidth={1.8}
              fill={color}
              fillOpacity={0.14}
              dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={900}
            />
          );
        })}
      </RadarChart>
    </ResponsiveContainer>
  );
}
