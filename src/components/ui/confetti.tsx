"use client";

/**
 * fireConfetti — tiny dependency-free celebration burst using the Web
 * Animations API. Call from any event handler with the click coordinates.
 */
const COLORS = ["#e8a062", "#6fbf94", "#c4633a", "#b98a23", "#d97a3f", "#4f87ad"];

export function fireConfetti(x?: number, y?: number) {
  if (typeof window === "undefined") return;
  const cx = x ?? window.innerWidth / 2;
  const cy = y ?? window.innerHeight / 2;
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:120;overflow:hidden";
  document.body.appendChild(root);

  for (let i = 0; i < 26; i++) {
    const p = document.createElement("div");
    const size = 5 + Math.random() * 6;
    const round = Math.random() < 0.3;
    p.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${size}px;height:${round ? size : size * 0.6}px;background:${COLORS[i % COLORS.length]};border-radius:${round ? "50%" : "2px"};will-change:transform,opacity`;
    const angle = Math.random() * Math.PI * 2;
    const velocity = 60 + Math.random() * 160;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity - 80 - Math.random() * 120;
    const rot = (Math.random() - 0.5) * 540;
    const fall = 160 + Math.random() * 200;
    p.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx * 1.4}px, ${dy + fall}px) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(0.16,0.6,0.45,1)", fill: "forwards" }
    );
    root.appendChild(p);
  }
  window.setTimeout(() => root.remove(), 1600);
}
