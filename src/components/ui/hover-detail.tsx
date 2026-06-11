"use client";

/**
 * HoverDetail — glanceable rich detail card on hover. Portal-rendered,
 * viewport-aware (flips horizontally, clamps vertically), non-interactive.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/format";

const CARD_WIDTH = 330;
const MAX_HEIGHT = 360;
const GAP = 12;

export function HoverDetail({
  children,
  content,
  width = CARD_WIDTH,
  openDelay = 230,
  side = "auto",
  disabled,
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  width?: number;
  openDelay?: number;
  side?: "auto" | "left" | "right" | "top";
  disabled?: boolean;
  className?: string;
}) {
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; up: boolean; maxH: number } | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  const open = React.useCallback(() => {
    if (disabled) return;
    timerRef.current = setTimeout(() => {
      const el = anchorRef.current;
      if (!el) return;
      // display:contents generates no box, so getBoundingClientRect() is a
      // zero-rect at the origin — measure the wrapped children instead.
      let rect = el.getBoundingClientRect();
      if (rect.width < 1 && rect.height < 1) {
        const range = document.createRange();
        range.selectNodeContents(el);
        rect = range.getBoundingClientRect();
      }
      if (rect.width < 1 && rect.height < 1) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left: number;
      const fitsRight = rect.right + GAP + width < vw;
      const fitsLeft = rect.left - GAP - width > 0;
      if (side === "left" && fitsLeft) left = rect.left - GAP - width;
      else if (side === "right" && fitsRight) left = rect.right + GAP;
      else if (side === "top") left = Math.min(Math.max(GAP, rect.left), vw - width - GAP);
      else if (fitsRight) left = rect.right + GAP;
      else if (fitsLeft) left = rect.left - GAP - width;
      else left = Math.min(Math.max(GAP, rect.left), vw - width - GAP);

      let top: number;
      let up = false;
      let maxH = MAX_HEIGHT;
      if (side === "top" && rect.top > 150) {
        // anchor the card's bottom edge just above the element
        top = rect.top - GAP;
        up = true;
        maxH = Math.min(MAX_HEIGHT, rect.top - 2 * GAP);
      } else if (side === "top") {
        top = Math.min(rect.bottom + GAP, vh - GAP - 160);
        maxH = Math.min(MAX_HEIGHT, vh - top - GAP);
      } else {
        top = Math.min(Math.max(GAP, rect.top), vh - Math.min(MAX_HEIGHT, vh * 0.5) - GAP);
        maxH = Math.min(MAX_HEIGHT, vh - top - GAP);
      }
      setPos({ top, left, up, maxH });
    }, openDelay);
  }, [disabled, openDelay, side, width]);

  const close = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPos(null);
  }, []);

  // close on any scroll (stale position) + on escape
  React.useEffect(() => {
    if (!pos) return;
    const onScroll = () => close();
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, [pos, close]);

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div
      ref={anchorRef}
      className={cn("contents", className)}
      onMouseEnter={open}
      onMouseLeave={close}
    >
      {children}
      {mounted && createPortal(
        <AnimatePresence>
          {pos && (
            <div
              className="fixed z-[85] pointer-events-none"
              style={{ top: pos.top, left: pos.left, width, transform: pos.up ? "translateY(-100%)" : undefined }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: pos.up ? -4 : 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: pos.up ? -2 : 2 }}
                transition={{ duration: 0.16, ease: [0.21, 0.8, 0.32, 1] }}
              >
                <div
                  className="glass rounded-2xl border-line-strong p-3.5 overflow-hidden shadow-[0_24px_70px_-24px_rgba(43,34,26,0.3)]"
                  style={{ maxHeight: pos.maxH }}
                >
                  {content}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

/* Small typographic helpers for hover-card content */
export function HoverRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[11px] leading-relaxed py-0.5">
      <span className="text-cream-faint shrink-0 w-20 uppercase tracking-wider text-[9px] pt-0.5">{label}</span>
      <span className="text-cream-muted min-w-0">{children}</span>
    </div>
  );
}

export function HoverQuote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] italic text-cream-muted border-l-2 border-[rgba(196,99,58,0.5)] pl-2.5 py-0.5 my-1 leading-relaxed">
      “{children}”
    </p>
  );
}
