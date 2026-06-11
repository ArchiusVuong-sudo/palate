"use client";

import * as React from "react";
import { cn } from "@/lib/format";
import { Loader2 } from "lucide-react";

/* ───────── Button ───────── */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "subtle";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none select-none",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-9.5 px-4 text-sm",
        size === "lg" && "h-11 px-6 text-sm",
        variant === "primary" &&
          "bg-gradient-to-b from-[#d4744a] to-terracotta text-white shadow-[0_8px_24px_-10px_rgba(196,99,58,0.7),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 active:scale-[0.98]",
        variant === "ghost" && "text-cream-muted hover:text-cream hover:bg-[rgba(43,34,26,0.06)]",
        variant === "outline" &&
          "border border-line-strong text-cream hover:bg-[rgba(43,34,26,0.05)] hover:border-[rgba(43,34,26,0.3)]",
        variant === "subtle" && "bg-[rgba(43,34,26,0.07)] text-cream hover:bg-[rgba(43,34,26,0.12)]",
        variant === "danger" && "bg-[rgba(207,75,59,0.14)] text-bad border border-[rgba(207,75,59,0.3)] hover:bg-[rgba(207,75,59,0.22)]",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

/* ───────── Badge ───────── */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "info" | "accent" | "agent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide border",
        tone === "neutral" && "bg-[rgba(43,34,26,0.06)] text-cream-muted border-line",
        tone === "good" && "bg-[rgba(47,158,99,0.1)] text-good border-[rgba(47,158,99,0.25)]",
        tone === "bad" && "bg-[rgba(207,75,59,0.1)] text-bad border-[rgba(207,75,59,0.25)]",
        tone === "warn" && "bg-[rgba(185,138,35,0.1)] text-warn border-[rgba(185,138,35,0.25)]",
        tone === "info" && "bg-[rgba(79,135,173,0.1)] text-info border-[rgba(79,135,173,0.25)]",
        tone === "accent" && "bg-[rgba(196,99,58,0.12)] text-amber border-[rgba(196,99,58,0.3)]",
        tone === "agent" && "bg-[rgba(63,146,104,0.1)] text-eucalyptus border-[rgba(63,146,104,0.25)]",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ───────── Card ───────── */
export function Card({
  children,
  className,
  hover,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={cn("glass rounded-2xl", hover && "glass-hover", className)}>{children}</div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  right,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="font-display text-xl text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-cream-muted mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ───────── Inputs ───────── */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9.5 w-full rounded-xl bg-[rgba(43,34,26,0.05)] border border-line px-3.5 text-sm text-cream placeholder:text-cream-faint focus:border-[rgba(196,99,58,0.5)] focus:bg-[rgba(43,34,26,0.07)] transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl bg-[rgba(43,34,26,0.05)] border border-line px-3.5 py-2.5 text-sm text-cream placeholder:text-cream-faint focus:border-[rgba(196,99,58,0.5)] focus:bg-[rgba(43,34,26,0.07)] transition-colors resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

/* ───────── Empty state ───────── */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-14 text-center", className)}>
      {icon && <div className="text-cream-faint mb-1 [&>svg]:h-8 [&>svg]:w-8">{icon}</div>}
      <p className="text-sm text-cream-muted">{title}</p>
      {hint && <p className="text-xs text-cream-faint max-w-sm">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ───────── Spinner dot row (agent working) ───────── */
export function WorkingDots({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-cream-muted">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-amber animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
          />
        ))}
      </span>
      {label && <span className="thinking-shimmer">{label}</span>}
    </span>
  );
}

/* ───────── Modal (lightweight) ───────── */
export function Modal({
  open,
  onClose,
  children,
  className,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm animate-in-up" style={{ animationDuration: "0.2s" }} onClick={onClose} />
      <div
        className={cn(
          "relative glass rounded-2xl w-full max-h-[88vh] overflow-y-auto animate-in-up",
          wide ? "max-w-4xl" : "max-w-xl",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
