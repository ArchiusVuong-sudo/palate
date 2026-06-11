"use client";

/**
 * Outbox — emails the agent drafted. Sent via Gmail when configured,
 * parked here otherwise. Click a card to preview the rendered HTML.
 */
import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Copy, Inbox, Mail } from "lucide-react";
import { Badge, Button, Card, EmptyState, Modal, SectionTitle } from "@/components/ui/primitives";
import type { OutboxEmail } from "@/lib/queries";
import { timeAgo } from "@/lib/format";

const display = { fontFamily: "var(--font-display), serif" };

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") return <Badge tone="good">sent via gmail</Badge>;
  if (status === "queued") return <Badge tone="warn">in outbox</Badge>;
  if (status === "failed") return <Badge tone="bad">failed</Badge>;
  return <Badge tone="neutral">{status}</Badge>;
}

export function OutboxView({ emails }: { emails: OutboxEmail[] }) {
  const [open, setOpen] = React.useState<OutboxEmail | null>(null);

  const copyHtml = (email: OutboxEmail) => {
    navigator.clipboard
      .writeText(email.html)
      .then(() => toast.success("Email HTML copied to clipboard"))
      .catch(() => toast.error("Couldn't copy — clipboard unavailable"));
  };

  return (
    <div>
      <SectionTitle
        title="Outbox"
        subtitle="Emails the agent drafted — sent via Gmail when configured, parked here otherwise"
        right={emails.length > 0 ? <Badge tone="neutral">{emails.length} emails</Badge> : undefined}
      />

      {emails.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={<Inbox />}
            title="Nothing in the outbox yet"
            hint="Approve a daily digest in a pipeline run and it lands here."
          />
        </Card>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3">
          {emails.map((email, i) => (
            <motion.div
              key={email.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.06 }}
            >
              <Card hover className="cursor-pointer">
                <button onClick={() => setOpen(email)} className="w-full text-left p-4 sm:p-5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(196,99,58,0.3)] bg-[rgba(196,99,58,0.12)] shrink-0">
                      <Mail className="h-4 w-4 text-amber" />
                    </span>
                    <h3 className="text-base text-cream flex-1 min-w-[200px] truncate" style={display}>
                      {email.subject}
                    </h3>
                    <StatusBadge status={email.status} />
                    <span className="text-[11px] text-cream-faint shrink-0">
                      {timeAgo(email.sent_at ?? email.created_at)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap pl-12">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-cream-faint mr-1">to</span>
                    {email.to_emails.map((addr) => (
                      <span
                        key={addr}
                        className="font-mono text-[10.5px] text-cream-muted rounded-full border border-line bg-[rgba(43,34,26,0.04)] px-2.5 py-0.5"
                      >
                        {addr}
                      </span>
                    ))}
                  </div>
                </button>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ───── preview modal ───── */}
      <Modal open={open !== null} onClose={() => setOpen(null)} wide>
        {open && (
          <div className="p-5">
            <div className="flex items-start gap-3 flex-wrap pb-4 border-b border-line">
              <div className="flex-1 min-w-[220px]">
                <h3 className="text-lg text-cream leading-snug" style={display}>{open.subject}</h3>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {open.to_emails.map((addr) => (
                    <span
                      key={addr}
                      className="font-mono text-[10.5px] text-cream-muted rounded-full border border-line bg-[rgba(43,34,26,0.04)] px-2.5 py-0.5"
                    >
                      {addr}
                    </span>
                  ))}
                  <span className="text-[11px] text-cream-faint ml-1">
                    {open.status === "sent" && open.sent_at
                      ? `sent ${timeAgo(open.sent_at)}`
                      : `drafted ${timeAgo(open.created_at)}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={open.status} />
                <Button size="sm" variant="outline" onClick={() => copyHtml(open)}>
                  <Copy className="h-3.5 w-3.5" /> Copy HTML
                </Button>
              </div>
            </div>
            {/* emails are bright — sandboxed white iframe */}
            <iframe
              title={open.subject}
              sandbox=""
              srcDoc={open.html}
              className="w-full h-[60vh] rounded-xl bg-white mt-4 border border-line"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
