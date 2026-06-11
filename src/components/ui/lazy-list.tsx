"use client";

/**
 * LazySentinel — fires onVisible when scrolled near (IntersectionObserver,
 * 300px lookahead). ShowMoreButton — the manual companion.
 */
import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/format";

export function LazySentinel({
  onVisible,
  disabled,
  className,
}: {
  onVisible: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const cbRef = React.useRef(onVisible);
  cbRef.current = onVisible;

  React.useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) cbRef.current();
        }
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [disabled]);

  if (disabled) return null;
  return (
    <div ref={ref} className={cn("flex justify-center py-3", className)} aria-hidden>
      <Loader2 className="h-4 w-4 text-cream-faint animate-spin" style={{ animationDuration: "1.6s" }} />
    </div>
  );
}

export function ShowMoreButton({
  remaining,
  onClick,
  label,
  className,
}: {
  remaining: number;
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  if (remaining <= 0) return null;
  return (
    <div className={cn("flex justify-center", className)}>
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-[11px] text-cream-muted hover:text-cream hover:border-line-strong hover:bg-[rgba(244,237,227,0.04)] transition-all"
      >
        <ChevronDown className="h-3 w-3" />
        {label ?? `Show ${Math.min(remaining, 12)} more`}
        <span className="font-mono text-[9px] text-cream-faint">({remaining} left)</span>
      </button>
    </div>
  );
}
