"use client";

/**
 * CompareSlider — drag the divider to compare two images
 * (original vs agent-annotated review markup).
 */
import * as React from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/format";

export function CompareSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "original",
  afterLabel = "annotated",
  className,
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState(50);
  const dragging = React.useRef(false);

  const update = React.useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(96, Math.max(4, pct)));
  }, []);

  React.useEffect(() => {
    const move = (e: PointerEvent) => { if (dragging.current) update(e.clientX); };
    const up = () => { dragging.current = false; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [update]);

  return (
    <div
      ref={ref}
      className={cn("relative rounded-xl overflow-hidden border border-line select-none touch-none cursor-ew-resize", className)}
      onPointerDown={(e) => { dragging.current = true; update(e.clientX); }}
    >
      {/* after (full) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt={afterLabel} className="block w-full h-auto" draggable={false} />
      {/* before (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt={beforeLabel} className="block w-full h-auto" draggable={false} />
      </div>

      {/* divider */}
      <div className="absolute inset-y-0 z-10" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -translate-x-1/2 w-[2px] bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.6)]" />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-white text-[#222] flex items-center justify-center shadow-xl">
          <ChevronsLeftRight className="h-4 w-4" />
        </div>
      </div>

      {/* labels */}
      <span className="absolute top-2 left-2 rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/90">{beforeLabel}</span>
      <span className="absolute top-2 right-2 rounded-full bg-[rgba(196,99,58,0.85)] px-2 py-0.5 text-[9px] uppercase tracking-wider text-white">{afterLabel}</span>
    </div>
  );
}
