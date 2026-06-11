"use client";

/**
 * StoryPlayer — fullscreen Instagram-style story viewer with auto-advancing
 * progress bars. Tap right/left to navigate, hold to pause, Esc to close.
 */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/format";

export type StoryItem = {
  url: string;
  kind: "image" | "video";
  label?: string;
};

const IMAGE_DURATION = 5000;

export function StoryPlayer({
  open,
  items,
  onClose,
  username = "marlowandsage",
}: {
  open: boolean;
  items: StoryItem[];
  onClose: () => void;
  username?: string;
}) {
  const [index, setIndex] = React.useState(0);
  const [progress, setProgress] = React.useState(0); // 0..1 for active item
  const [paused, setPaused] = React.useState(false);
  const [muted, setMuted] = React.useState(true);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const durationRef = React.useRef(IMAGE_DURATION);
  const rafRef = React.useRef<number>(0);
  const lastTickRef = React.useRef<number>(0);
  const elapsedRef = React.useRef(0);

  const item = items[index];

  const goTo = React.useCallback((next: number) => {
    if (next < 0) next = 0;
    if (next >= items.length) { onClose(); return; }
    elapsedRef.current = 0;
    setProgress(0);
    setIndex(next);
  }, [items.length, onClose]);

  // reset when opened
  React.useEffect(() => {
    if (open) {
      setIndex(0); setProgress(0); setPaused(false);
      elapsedRef.current = 0;
    }
  }, [open]);

  // duration source: fixed for images, real duration for videos
  React.useEffect(() => {
    durationRef.current = item?.kind === "video" ? IMAGE_DURATION : IMAGE_DURATION;
  }, [item]);

  // progress engine
  React.useEffect(() => {
    if (!open || !item) return;
    lastTickRef.current = performance.now();
    const tick = (t: number) => {
      const dt = t - lastTickRef.current;
      lastTickRef.current = t;
      if (!paused) {
        elapsedRef.current += dt;
        const p = Math.min(1, elapsedRef.current / durationRef.current);
        setProgress(p);
        if (p >= 1) { goTo(index + 1); return; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, index, paused, item, goTo]);

  // video sync
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, index]);

  // keyboard
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, goTo, onClose]);

  if (!open || !item) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-sm flex items-center justify-center"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-20 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10"
        >
          <X className="h-6 w-6" />
        </button>

        <motion.div
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.21, 0.8, 0.32, 1] }}
          className="relative h-[min(92vh,860px)] aspect-[9/16] rounded-3xl overflow-hidden bg-[#0c0c0c] shadow-[0_40px_120px_-30px_rgba(0,0,0,1)] ring-1 ring-white/10"
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerLeave={() => setPaused(false)}
        >
          {/* media */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              {item.kind === "video" ? (
                <video
                  ref={videoRef}
                  src={item.url}
                  autoPlay
                  muted={muted}
                  playsInline
                  onLoadedMetadata={(e) => {
                    const d = (e.target as HTMLVideoElement).duration;
                    if (Number.isFinite(d) && d > 0) durationRef.current = d * 1000;
                  }}
                  onEnded={() => goTo(index + 1)}
                  className="w-full h-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.label ?? "story"} className="w-full h-full object-cover" draggable={false} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* gradients */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />

          {/* progress bars */}
          <div className="absolute top-3 inset-x-3 flex gap-1 z-10">
            {items.map((_, i) => (
              <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }}
                />
              </div>
            ))}
          </div>

          {/* header */}
          <div className="absolute top-7 inset-x-3 flex items-center gap-2.5 z-10">
            <span
              className="h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-bold text-[#1a0f08]"
              style={{ background: "linear-gradient(135deg, #e8a062, #c4633a)" }}
            >
              M
            </span>
            <span className="text-[13px] font-semibold text-white">{username}</span>
            {item.label && <span className="text-[11px] text-white/60">{item.label}</span>}
            <span className="ml-auto flex items-center gap-1">
              {paused && <Pause className="h-4 w-4 text-white/80" />}
              {item.kind === "video" && (
                <button onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }} className="p-1.5 text-white/80 hover:text-white">
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}
            </span>
          </div>

          {/* tap zones */}
          <button className="absolute inset-y-0 left-0 w-1/3 z-[5]" onClick={() => goTo(index - 1)} aria-label="previous" />
          <button className="absolute inset-y-0 right-0 w-2/3 z-[5]" onClick={() => goTo(index + 1)} aria-label="next" />
        </motion.div>

        <p className={cn("absolute bottom-5 text-[11px] text-white/40")}>
          tap to advance · hold to pause · esc to close
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
