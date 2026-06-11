"use client";

/**
 * Sign in — split-panel login. Left: the brand story. Right: glass card with
 * the demo credentials surfaced for reviewers.
 */
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Ear, KeyRound, Loader2, Mail, Palette, ShieldCheck, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/studio/shell";
import { cn } from "@/lib/format";

const FEATURES = [
  { icon: Ear, text: "Listens to every review and mention, every morning" },
  { icon: Palette, text: "Briefs itself, then shoots the visuals in your style" },
  { icon: ShieldCheck, text: "Nothing ships without your approval — ever" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Sign-in failed — try again.");
        setBusy(false);
        return;
      }
      router.replace(params.get("next") ?? "/studio");
      router.refresh();
    } catch {
      setError("Network hiccup — try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3.5">
      <label className="grid grid-cols-1 gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.14em] text-cream-faint">Email</span>
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-[rgba(43,34,26,0.04)] px-3.5 focus-within:border-[rgba(196,99,58,0.55)] transition-colors">
          <Mail className="h-4 w-4 text-cream-faint shrink-0" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@marlowandsage.com"
            autoComplete="username"
            autoFocus
            required
            className="h-11 w-full bg-transparent text-sm text-cream placeholder:text-cream-faint outline-none"
          />
        </div>
      </label>

      <label className="grid grid-cols-1 gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.14em] text-cream-faint">Password</span>
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-[rgba(43,34,26,0.04)] px-3.5 focus-within:border-[rgba(196,99,58,0.55)] transition-colors">
          <KeyRound className="h-4 w-4 text-cream-faint shrink-0" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            autoComplete="current-password"
            required
            className="h-11 w-full bg-transparent text-sm text-cream placeholder:text-cream-faint outline-none"
          />
        </div>
      </label>

      {error && (
        <motion.p
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-xl border border-[rgba(207,75,59,0.3)] bg-[rgba(207,75,59,0.07)] px-3 py-2 text-xs text-bad"
        >
          {error}
        </motion.p>
      )}

      <button
        type="submit"
        disabled={busy}
        className={cn(
          "mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-white",
          "bg-gradient-to-b from-[#d4744a] to-terracotta shadow-[0_8px_24px_-10px_rgba(196,99,58,0.7),inset_0_1px_0_rgba(255,255,255,0.25)]",
          "hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60"
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {busy ? "Signing in…" : "Enter the studio"}
      </button>

      {/* demo credentials — surfaced on purpose for reviewers */}
      <div className="mt-2 rounded-xl border border-dashed border-[rgba(63,146,104,0.4)] bg-[rgba(63,146,104,0.06)] px-3.5 py-2.5">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-eucalyptus">
          <Sparkles className="h-3 w-3" /> demo access
        </p>
        <p className="mt-1 font-mono text-[11.5px] text-cream-muted leading-relaxed">
          owner@marlowandsage.com<br />palate2026
        </p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative z-10 min-h-screen flex items-stretch">
      {/* ───── left: brand story ───── */}
      <section className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 600px at 20% 0%, rgba(196,99,58,0.1), transparent 60%), radial-gradient(700px 500px at 80% 100%, rgba(63,146,104,0.09), transparent 60%)",
          }}
        />
        <div className="bg-grid absolute inset-0 opacity-70 pointer-events-none" />

        <div className="relative flex items-center gap-2.5">
          <LogoMark />
          <div>
            <p className="text-[15px] leading-none text-cream" style={{ fontFamily: "var(--font-display), serif" }}>Palate</p>
            <p className="text-[9.5px] uppercase tracking-[0.22em] text-cream-faint mt-1">marketing studio</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.21, 0.8, 0.32, 1] }}
          className="relative max-w-lg"
        >
          <h1 className="text-5xl leading-[1.08] text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
            Your marketing team
            <br />
            just got <em className="text-gradient not-italic">an extra palate</em>
          </h1>
          <p className="mt-5 text-sm text-cream-muted leading-relaxed max-w-md">
            One agent that listens, plans, creates and guards the brand for Marlow &amp; Sage&apos;s
            three venues — with you approving every move.
          </p>
          <ul className="mt-7 grid grid-cols-1 gap-3">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.12 }}
                className="flex items-center gap-3 text-[13px] text-cream-muted"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(196,99,58,0.28)] bg-[rgba(196,99,58,0.09)] shrink-0">
                  <f.icon className="h-3.5 w-3.5 text-terracotta" />
                </span>
                {f.text}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <p className="relative text-[11px] text-cream-faint">
          Marlow &amp; Sage · Surry Hills · Fitzroy · Burleigh Heads
        </p>
      </section>

      {/* ───── right: sign-in card ───── */}
      <section className="flex-1 lg:max-w-[560px] flex items-center justify-center p-6 lg:border-l border-line lg:bg-[rgba(255,253,248,0.55)] lg:backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.21, 0.8, 0.32, 1] }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <LogoMark />
            <p className="text-[17px] text-cream" style={{ fontFamily: "var(--font-display), serif" }}>Palate</p>
          </div>

          <div className="glass rounded-3xl p-7">
            <h2 className="text-2xl text-cream" style={{ fontFamily: "var(--font-display), serif" }}>
              Welcome back
            </h2>
            <p className="mt-1 text-xs text-cream-muted">Sign in to the Marlow &amp; Sage studio</p>
            <div className="mt-6">
              <React.Suspense fallback={null}>
                <LoginForm />
              </React.Suspense>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-cream-faint">
            Palate · the agentic marketing studio — an AT Solutions take-home build
          </p>
        </motion.div>
      </section>
    </main>
  );
}
