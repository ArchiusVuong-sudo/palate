"use client";

/**
 * Palate chart kit — Recharts with heavy custom styling: gradient fills,
 * animated entrances, glass tooltips, count-up metrics.
 */
import * as React from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
} from "recharts";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, fmtNumber } from "@/lib/format";

export const PALETTE = ["#e8a062", "#6fbf94", "#4f87ad", "#c4633a", "#b98a23", "#b58ad6", "#2f9e63", "#cf4b3b"];

const AXIS = { stroke: "rgba(43,34,26,0.5)", fontSize: 10.5, fontFamily: "var(--font-geist-mono)" };
const GRID = "rgba(43,34,26,0.08)";

/** ResponsiveContainer measures -1×-1 during SSR and logs a warning — only render charts after mount. */
function useMounted() {
  const [m, setM] = React.useState(false);
  React.useEffect(() => { setM(true); }, []);
  return m;
}

function GlassTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number | string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-[rgba(255,255,255,0.97)] px-3 py-2 shadow-2xl backdrop-blur-md">
      {label !== undefined && <p className="text-[10px] uppercase tracking-wider text-cream-faint mb-1">{label}</p>}
      <div className="grid gap-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? PALETTE[i] }} />
            <span className="text-cream-muted">{p.name}</span>
            <span className="ml-auto font-mono text-cream">{fmtNumber(p.value as number)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Count-up metric ───────── */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function MetricCard({
  label, value, suffix, delta, tone = "neutral", caption, spark, index = 0,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  delta?: number | string;
  tone?: "good" | "bad" | "neutral";
  caption?: string;
  spark?: number[];
  index?: number;
}) {
  const mounted = useMounted();
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  const isNum = !Number.isNaN(numeric) && typeof value !== "string" || (typeof value === "string" && /^[\d.,-]+$/.test(value.trim()));
  const animated = useCountUp(isNum ? numeric : 0);
  const display = isNum
    ? (Number.isInteger(numeric) ? Math.round(animated).toLocaleString() : animated.toFixed(Math.abs(numeric) < 10 ? 2 : 1))
    : value;
  const deltaNum = typeof delta === "string" ? Number(String(delta).replace(/[^\d.-]/g, "")) : delta;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.21, 0.8, 0.32, 1] }}
      className="glass glass-hover rounded-2xl p-4 relative overflow-hidden"
    >
      <div
        className="absolute -top-10 -right-10 h-28 w-28 rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: tone === "good" ? "#2f9e63" : tone === "bad" ? "#cf4b3b" : "#c4633a" }}
      />
      <p className="text-[11px] uppercase tracking-[0.14em] text-cream-faint">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[1.7rem] leading-none font-mono text-cream tabular-nums">{display}{suffix}</span>
        {delta !== undefined && deltaNum !== undefined && !Number.isNaN(deltaNum) && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium",
              deltaNum > 0 ? "text-good" : deltaNum < 0 ? "text-bad" : "text-cream-faint"
            )}
          >
            {deltaNum > 0 ? <ArrowUpRight className="h-3 w-3" /> : deltaNum < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {typeof delta === "string" ? delta : `${Math.abs(deltaNum)}%`}
          </span>
        )}
      </div>
      {caption && <p className="mt-1 text-[11px] text-cream-muted truncate">{caption}</p>}
      {spark && spark.length > 1 && (
        <div className="h-8 mt-2 -mx-1">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark.map((v, i) => ({ i, v }))}>
                <Line type="monotone" dataKey="v" stroke={tone === "bad" ? "#cf4b3b" : "#3f9268"} strokeWidth={1.5} dot={false} isAnimationActive animationDuration={1200} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ───────── Area trend (multi-series) ───────── */
export function TrendArea({
  data, series, height = 240, stacked, onPointClick,
}: {
  data: Array<Record<string, string | number>>;
  series: { key: string; name: string; color?: string }[];
  height?: number;
  stacked?: boolean;
  onPointClick?: (label: string) => void;
}) {
  const id = React.useId().replace(/[:]/g, "");
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height} style={onPointClick ? { cursor: "pointer" } : undefined}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
        onClick={(s) => {
          const label = (s as { activeLabel?: string | number } | null)?.activeLabel;
          if (onPointClick && label !== undefined && label !== null) onPointClick(String(label));
        }}
      >
        <defs>
          {series.map((s, i) => {
            const color = s.color ?? PALETTE[i];
            return (
              <linearGradient key={s.key} id={`grad-${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} />
        <Tooltip content={<GlassTooltip />} cursor={{ stroke: "rgba(43,34,26,0.15)" }} />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stackId={stacked ? "1" : undefined}
            stroke={s.color ?? PALETTE[i]}
            strokeWidth={1.8}
            fill={`url(#grad-${id}-${i})`}
            isAnimationActive
            animationDuration={1100}
            animationEasing="ease-out"
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ───────── Horizontal bars ───────── */
export function TopicBars({
  data, height = 240, color = "#e8a062",
}: {
  data: { name: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontSize: 11, fontFamily: "var(--font-geist-sans)" }} tickLine={false} axisLine={false} width={120} />
        <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgba(43,34,26,0.04)" }} />
        <Bar dataKey="value" name="mentions" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900} barSize={16}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? color : `${color}${Math.max(30, 95 - i * 12).toString(16).padStart(2, "0")}`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ───────── Vertical bars (generic) ───────── */
export function SimpleBars({
  data, series, height = 240,
}: {
  data: Array<Record<string, string | number>>;
  series: { key: string; name: string; color?: string }[];
  height?: number;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={46} />
        <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgba(43,34,26,0.04)" }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color ?? PALETTE[i]} radius={[5, 5, 0, 0]} isAnimationActive animationDuration={900} barSize={18} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ───────── Donut ───────── */
export function Donut({
  data, height = 220, centerLabel,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: { value: string; caption: string };
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const mounted = useMounted();
  return (
    <div className="relative" style={{ height }}>
      {mounted && <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<GlassTooltip />} />
          <Pie
            data={data} dataKey="value" nameKey="name"
            innerRadius="64%" outerRadius="88%" paddingAngle={3} strokeWidth={0}
            isAnimationActive animationDuration={1000}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? PALETTE[i]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-mono text-2xl text-cream">{centerLabel?.value ?? fmtNumber(total)}</span>
        <span className="text-[10px] uppercase tracking-widest text-cream-faint">{centerLabel?.caption ?? "total"}</span>
      </div>
    </div>
  );
}

/* ───────── Score ring (review rubric) ───────── */
export function ScoreRing({ score, size = 64, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "#2f9e63" : score >= 50 ? "#b98a23" : "#cf4b3b";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(43,34,26,0.08)" strokeWidth={5} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * Math.min(100, Math.max(0, score))) / 100 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <span className="font-mono text-sm text-cream -mt-[calc(50%+18px)] mb-[calc(50%-10px)]" style={{ marginTop: -(size / 2 + 9), marginBottom: size / 2 - 14 }}>
        {Math.round(score)}
      </span>
      {label && <span className="text-[10px] text-cream-faint text-center leading-tight max-w-[80px]">{label}</span>}
    </div>
  );
}
