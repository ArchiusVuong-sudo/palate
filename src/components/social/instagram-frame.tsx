"use client";

/**
 * InstagramFrame — pixel-style Instagram preview inside a phone bezel.
 * mode "feed": post card with header/actions/caption (double-tap to like).
 * mode "story": full-bleed 9:16 with story chrome.
 */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Battery, Bookmark, Heart, MessageCircle, MoreHorizontal, Send, Signal, Wifi,
} from "lucide-react";
import { cn } from "@/lib/format";

function BrandAvatar({ size = 28, ring = true }: { size?: number; ring?: boolean }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full shrink-0", ring && "p-[2px]")}
      style={ring ? { background: "conic-gradient(from 210deg, #c4633a, #e8a062, #6fbf94, #c4633a)" } : undefined}
    >
      <span
        className="rounded-full flex items-center justify-center font-semibold text-[#1a0f08]"
        style={{
          width: size, height: size, fontSize: size * 0.42,
          background: "linear-gradient(135deg, #e8a062, #c4633a)",
          border: "2px solid #000",
        }}
      >
        M
      </span>
    </span>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-2.5 pb-1 text-white">
      <span className="text-[11px] font-semibold tracking-wide">9:41</span>
      <span className="flex items-center gap-1">
        <Signal className="h-3 w-3" />
        <Wifi className="h-3 w-3" />
        <Battery className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

export function InstagramFrame({
  mode,
  mediaUrl,
  mediaKind = "image",
  caption,
  hashtags = [],
  username = "marlowandsage",
  location,
  className,
}: {
  mode: "feed" | "story";
  mediaUrl: string;
  mediaKind?: "image" | "video";
  caption?: string;
  hashtags?: string[];
  username?: string;
  location?: string;
  className?: string;
}) {
  const [liked, setLiked] = React.useState(false);
  const [burst, setBurst] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);

  const doubleTap = () => {
    setLiked(true);
    setBurst((b) => b + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.21, 0.8, 0.32, 1] }}
      className={cn("relative select-none", className)}
      style={{ width: 300 }}
    >
      {/* phone bezel */}
      <div className="rounded-[44px] bg-[#161616] p-[10px] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(244,237,227,0.08)]">
        <div className="relative rounded-[34px] bg-black overflow-hidden">
          {/* dynamic island */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 h-[22px] w-[88px] rounded-full bg-black z-30 border border-[#1d1d1d]" />
          <StatusBar />

          {mode === "feed" ? (
            <div className="pb-5">
              {/* post header */}
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <BrandAvatar />
                <div className="leading-tight">
                  <p className="text-[12px] font-semibold text-white">{username}</p>
                  {location && <p className="text-[10px] text-white/60">{location}</p>}
                </div>
                <MoreHorizontal className="h-4 w-4 text-white ml-auto" />
              </div>

              {/* media (double-tap to like) */}
              <div className="relative cursor-pointer" onDoubleClick={doubleTap}>
                {mediaKind === "video" ? (
                  <video src={mediaUrl} muted autoPlay loop playsInline className="w-full aspect-[4/5] object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl} alt="post preview" className="w-full aspect-[4/5] object-cover" draggable={false} />
                )}
                <AnimatePresence>
                  {burst > 0 && (
                    <motion.div
                      key={burst}
                      initial={{ scale: 0, opacity: 0.9 }}
                      animate={{ scale: 1.25, opacity: 1 }}
                      exit={{ scale: 1.6, opacity: 0 }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                      onAnimationComplete={() => setBurst(0)}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <Heart className="h-20 w-20 text-white drop-shadow-2xl" fill="white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* actions */}
              <div className="flex items-center gap-3.5 px-3 pt-2.5">
                <button onClick={() => setLiked((l) => !l)} className="transition-transform active:scale-75">
                  <Heart className={cn("h-[22px] w-[22px] transition-colors", liked ? "text-[#ff3040]" : "text-white")} fill={liked ? "#ff3040" : "none"} />
                </button>
                <MessageCircle className="h-[22px] w-[22px] text-white -scale-x-100" />
                <Send className="h-[21px] w-[21px] text-white" />
                <Bookmark className="h-[22px] w-[22px] text-white ml-auto" />
              </div>

              <p className="px-3 pt-2 text-[11px] font-semibold text-white">
                {liked ? "Liked by you" : "Be the first to like this"}
              </p>

              {caption && (
                <p
                  className={cn("px-3 pt-1 text-[11px] leading-[1.45] text-white/95 cursor-pointer", !expanded && "line-clamp-2")}
                  onClick={() => setExpanded((e) => !e)}
                >
                  <span className="font-semibold">{username}</span>{" "}
                  {caption}
                  {hashtags.length > 0 && (
                    <span className="text-[#b3d4ff]"> {hashtags.join(" ")}</span>
                  )}
                </p>
              )}
              <p className="px-3 pt-1.5 text-[9px] uppercase tracking-wide text-white/40">Just now · Preview</p>
            </div>
          ) : (
            /* ───── story mode ───── */
            <div className="relative aspect-[9/17.5]">
              {mediaKind === "video" ? (
                <video src={mediaUrl} muted autoPlay loop playsInline className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="story preview" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
              )}
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

              {/* progress + header */}
              <div className="absolute top-8 inset-x-2.5">
                <div className="h-[2.5px] rounded-full bg-white/30 overflow-hidden">
                  <motion.div
                    className="h-full bg-white"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 5, ease: "linear", repeat: Infinity }}
                  />
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <BrandAvatar size={24} ring={false} />
                  <span className="text-[11px] font-semibold text-white">{username}</span>
                  <span className="text-[10px] text-white/60">Just now</span>
                  <MoreHorizontal className="h-4 w-4 text-white ml-auto" />
                </div>
              </div>

              {/* footer */}
              <div className="absolute bottom-3.5 inset-x-2.5 flex items-center gap-2.5">
                <div className="flex-1 h-9 rounded-full border border-white/50 px-3.5 flex items-center">
                  <span className="text-[11px] text-white/70">Send message</span>
                </div>
                <Heart className="h-6 w-6 text-white" />
                <Send className="h-[22px] w-[22px] text-white" />
              </div>
            </div>
          )}

          {/* home indicator */}
          <div className="flex justify-center pb-1.5 pt-1 bg-black">
            <div className="h-1 w-24 rounded-full bg-white/30" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
