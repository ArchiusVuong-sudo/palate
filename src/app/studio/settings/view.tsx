"use client";

/**
 * Settings — brand profile, connections and agent behaviour.
 * A consulting demo: transparent about what's live, demo and configurable.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  AtSign, Bot, Film, Globe, Image as ImageIcon, KeyRound, Mail,
  MessageSquare, ShieldCheck, Star, UtensilsCrossed, Wallet,
} from "lucide-react";
import { Badge, Button, Card, Input, SectionTitle } from "@/components/ui/primitives";
import type { Brand } from "@/lib/brand";
import { SOURCE_LABELS, timeAgo } from "@/lib/format";

const display = { fontFamily: "var(--font-display), serif" };

export type ConnectionRow = {
  provider: string;
  status: string;
  config: Record<string, unknown>;
  last_synced_at: string | null;
};

const PROVIDER_ORDER = ["google_reviews", "facebook", "instagram", "gmail"] as const;

const PROVIDER_META: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  copy: string;
  tint: string;
  ring: string;
  iconCls: string;
}> = {
  google_reviews: {
    icon: Star,
    copy: "Google Business Profile API — reviews for all 3 locations.",
    tint: "rgba(185,138,35,0.12)", ring: "rgba(185,138,35,0.3)", iconCls: "text-warn",
  },
  facebook: {
    icon: MessageSquare,
    copy: "Meta Graph API — page comments & messages.",
    tint: "rgba(79,135,173,0.12)", ring: "rgba(79,135,173,0.3)", iconCls: "text-info",
  },
  instagram: {
    icon: AtSign,
    copy: "Instagram Graph API — mentions, comments & tags.",
    tint: "rgba(196,99,58,0.12)", ring: "rgba(196,99,58,0.3)", iconCls: "text-amber",
  },
  gmail: {
    icon: Mail,
    copy: "SMTP app password — lets the agent actually send.",
    tint: "rgba(63,146,104,0.12)", ring: "rgba(63,146,104,0.3)", iconCls: "text-eucalyptus",
  },
};

function ConnectionBadge({ status }: { status: string }) {
  if (status === "demo") return <Badge tone="warn">demo data</Badge>;
  if (status === "connected") return <Badge tone="good">connected</Badge>;
  if (status === "error") return <Badge tone="bad">error</Badge>;
  return <Badge tone="neutral">disconnected</Badge>;
}

export function SettingsView({ brand, connections }: { brand: Brand; connections: ConnectionRow[] }) {
  const router = useRouter();
  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  const list: ConnectionRow[] = PROVIDER_ORDER.map(
    (p) => byProvider.get(p) ?? { provider: p, status: "disconnected", config: {}, last_synced_at: null }
  );

  return (
    <div>
      <SectionTitle title="Settings" subtitle="Brand profile, connections and agent behaviour" />

      <div className="mt-5 grid grid-cols-1 gap-4">
        {/* ───── brand card ───── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <BrandCard brand={brand} />
        </motion.div>

        {/* ───── connections ───── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-cream-faint mb-3 mt-2">Connections</p>
          <div className="grid md:grid-cols-2 gap-4">
            {list.map((c, i) => (
              <ConnectionCard key={c.provider} connection={c} index={i} onSaved={() => router.refresh()} />
            ))}
          </div>
        </motion.div>

        {/* ───── agent behaviour ───── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <p className="text-[11px] uppercase tracking-[0.18em] text-cream-faint mb-3 mt-2">Agent</p>
          <AgentCard />
        </motion.div>
      </div>
    </div>
  );
}

/* ───────── brand ───────── */

function BrandCard({ brand }: { brand: Brand }) {
  const handles = [
    brand.cuisine && { icon: UtensilsCrossed, label: brand.cuisine },
    brand.instagram_handle && { icon: AtSign, label: brand.instagram_handle },
    brand.facebook_page && { icon: MessageSquare, label: brand.facebook_page },
    brand.website && { icon: Globe, label: brand.website.replace(/^https?:\/\//, "") },
  ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; label: string }[];

  return (
    <Card className="p-5 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: "#c4633a" }}
      />
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cream-faint">Brand profile</p>
          <h3 className="mt-1.5 text-2xl text-cream" style={display}>{brand.name}</h3>
          {brand.tagline && (
            <p className="mt-1 text-sm text-cream-muted italic" style={display}>“{brand.tagline}”</p>
          )}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {handles.map((h) => (
              <span
                key={h.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[rgba(43,34,26,0.04)] px-3 py-1 text-[11.5px] text-cream-muted"
              >
                <h.icon className="h-3 w-3 text-cream-faint" />
                {h.label}
              </span>
            ))}
          </div>
        </div>

        {brand.brand_colors?.length > 0 && (
          <div className="lg:w-[300px] shrink-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cream-faint mb-2">Brand colours</p>
            <div className="grid grid-cols-4 gap-2.5">
              {brand.brand_colors.map((hex) => (
                <div key={hex}>
                  <div
                    className="h-12 rounded-xl border border-line-strong"
                    style={{ background: hex, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)" }}
                  />
                  <p className="mt-1.5 font-mono text-[9.5px] uppercase text-cream-faint text-center">{hex}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ───────── connection card ───────── */

function ConnectionCard({
  connection, index, onSaved,
}: {
  connection: ConnectionRow;
  index: number;
  onSaved: () => void;
}) {
  const meta = PROVIDER_META[connection.provider];
  const [token, setToken] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    const value = token.trim();
    if (!value) {
      toast.error("Paste an API key or token first");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/connections/${connection.provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { token: value } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`${SOURCE_LABELS[connection.provider] ?? connection.provider} token stored`);
      setToken("");
      onSaved();
    } catch {
      toast.error("Couldn't save the token — try again");
    } finally {
      setSaving(false);
    }
  };

  const Icon = meta?.icon ?? KeyRound;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06 }}
    >
      <Card hover className="p-5 h-full flex flex-col">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border shrink-0"
            style={{ background: meta?.tint, borderColor: meta?.ring }}
          >
            <Icon className={`h-4.5 w-4.5 ${meta?.iconCls ?? "text-cream-muted"}`} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base text-cream" style={display}>
              {SOURCE_LABELS[connection.provider] ?? connection.provider}
            </h3>
            <p className="text-[11px] text-cream-faint">
              {connection.last_synced_at ? `synced ${timeAgo(connection.last_synced_at)}` : "never synced"}
            </p>
          </div>
          <span className="ml-auto shrink-0">
            <ConnectionBadge status={connection.status} />
          </span>
        </div>

        <p className="mt-3 text-xs text-cream-muted leading-relaxed">{meta?.copy}</p>

        <div className="mt-4 pt-4 border-t border-line grid grid-cols-1 gap-2">
          {connection.provider === "gmail" ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-line-strong bg-[rgba(43,34,26,0.03)] px-3 py-2.5">
              <KeyRound className="h-3.5 w-3.5 text-eucalyptus shrink-0" />
              <code className="font-mono text-[10.5px] text-cream-muted leading-relaxed">
                set GMAIL_USER + GMAIL_APP_PASSWORD in .env.local
              </code>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="API key / access token"
                  className="font-mono text-xs opacity-60 focus:opacity-100"
                />
                <Button variant="subtle" loading={saving} onClick={save} className="shrink-0">
                  Save
                </Button>
              </div>
              <p className="text-[10.5px] text-cream-faint leading-relaxed">
                Live syncing lands in the connector phase — demo data flows today.
              </p>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

/* ───────── agent behaviour ───────── */

const AGENT_MODELS = [
  { icon: Bot, label: "Reasoning model", value: "claude-opus-4-8" },
  { icon: ImageIcon, label: "Image model", value: "gemini-3.1-flash-image" },
  { icon: Film, label: "Video model", value: "veo-3.1-fast" },
  { icon: Wallet, label: "Budget cap", value: "$8.00 / run" },
];

const APPROVAL_RULES = [
  "Outbound email never sends without a human approve — drafts park in the outbox otherwise.",
  "Publishing or scheduling a post always requires an explicit human sign-off.",
  "Every tool call, decision and dollar is logged to the run audit trail.",
];

function AgentCard() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(63,146,104,0.3)] bg-[rgba(63,146,104,0.12)]">
          <Bot className="h-4.5 w-4.5 text-eucalyptus" />
        </span>
        <div>
          <h3 className="text-base text-cream" style={display}>Agent behaviour</h3>
          <p className="text-[11px] text-cream-faint">Transparent by design — what runs, on what, with what limits</p>
        </div>
        <span className="ml-auto">
          <Badge tone="agent">human in the loop</Badge>
        </span>
      </div>

      <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {AGENT_MODELS.map((m) => (
          <div key={m.label} className="rounded-xl border border-line bg-[rgba(43,34,26,0.025)] p-3.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-cream-faint flex items-center gap-1.5">
              <m.icon className="h-3 w-3" /> {m.label}
            </p>
            <p className="mt-2 font-mono text-[12.5px] text-cream">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-line">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cream-faint mb-2.5">Approval rules</p>
        <ul className="grid grid-cols-1 gap-2">
          {APPROVAL_RULES.map((rule) => (
            <li key={rule} className="flex items-start gap-2.5 text-xs text-cream-muted leading-relaxed">
              <ShieldCheck className="h-3.5 w-3.5 text-eucalyptus shrink-0 mt-0.5" />
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
