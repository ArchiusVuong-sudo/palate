"use client";

/**
 * Ask Palate — context-aware handoff to the copilot. askPalate() opens the
 * copilot drawer with a prefilled prompt (the human still hits send — they
 * stay in the loop). AskPalateButton is the standard chip for cards.
 */
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/format";

export function askPalate(prompt: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("palate:ask", { detail: { prompt } }));
}

export function AskPalateButton({
  prompt,
  label = "Ask Palate",
  className,
}: {
  prompt: string;
  label?: string;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        askPalate(prompt);
      }}
      title="Send this context to the copilot"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[rgba(111,191,148,0.35)] bg-[rgba(111,191,148,0.08)] px-2 py-0.5 text-[10px] text-eucalyptus hover:bg-[rgba(111,191,148,0.16)] hover:border-[rgba(111,191,148,0.55)] transition-colors",
        className
      )}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {label}
    </button>
  );
}
