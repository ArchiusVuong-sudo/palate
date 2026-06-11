import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function fmtDate(date: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", ...opts });
}

export function fmtDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function fmtNumber(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(num)) return String(n);
  if (Math.abs(num) >= 1000) return new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(num);
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

export function fmtUsd(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  return `$${num < 0.1 ? num.toFixed(3) : num.toFixed(2)}`;
}

export const SOURCE_LABELS: Record<string, string> = {
  google_reviews: "Google Reviews",
  facebook: "Facebook",
  instagram: "Instagram",
  gmail: "Gmail",
};

export const CHANNEL_LABELS: Record<string, string> = {
  instagram_story: "IG Story",
  instagram_feed: "IG Feed",
  facebook: "Facebook",
};

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
