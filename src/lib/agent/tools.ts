/**
 * Palate tool belt — small, generic, composable units.
 * Generic read (db_query) + validated domain writes + knowledge filesystem +
 * canvas blocks + email + the human-in-the-loop approval gate.
 */
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { pool, q, one } from "@/lib/db";
import { runBus, approvalBridge } from "@/lib/agent/bridge";
import nodemailer from "nodemailer";

export type ToolCtx = {
  brandId: string;
  runId: string;
  workflow: string;
};

export type ToolResult = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
};

export function textResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 1) }] };
}

export function errorResult(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: `Error: ${message}` }] };
}

export function safe<T>(fn: (args: T) => Promise<ToolResult>) {
  return async (args: T): Promise<ToolResult> => {
    try {
      return await fn(args);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  };
}

// ============================ generic data ================================

export function buildDataTools(ctx: ToolCtx) {
  const dbQuery = tool(
    "db_query",
    "Run a read-only SQL SELECT against the marketing database (Postgres). Tables: brands, locations, connections, social_items, insights, proposed_actions, briefs, assets, reviews, posts, approvals, knowledge_files, agent_runs, canvas_blocks, outbox_emails. Always filter by brand_id where the table has it. Returns rows as JSON. Max 200 rows.",
    {
      sql: z.string().describe("A single SELECT (or WITH...SELECT) statement. No writes."),
      params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).default([]).describe("Positional $1,$2… parameters"),
    },
    safe(async ({ sql, params }) => {
      const norm = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/;\s*$/, "");
      if (!/^(select|with)\b/i.test(norm)) return errorResult("Only SELECT/WITH queries are allowed.");
      if (norm.includes(";")) return errorResult("Multiple statements are not allowed.");
      const client = await pool.connect();
      try {
        await client.query("begin transaction read only");
        await client.query("set local statement_timeout = '8s'");
        const limited = /\blimit\s+\d+/i.test(norm) ? norm : `${norm} limit 200`;
        const res = await client.query(limited, params);
        await client.query("commit");
        return textResult({ rowCount: res.rowCount, rows: res.rows });
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    })
  );

  const listSocial = tool(
    "list_social_items",
    "List social items (reviews/comments/mentions) with filters. Use unanalyzed_only=true to fetch the inbox of items not yet sentiment-tagged.",
    {
      since_hours: z.number().int().min(1).max(24 * 60).default(48),
      unanalyzed_only: z.boolean().default(false),
      source: z.enum(["google_reviews", "facebook", "instagram"]).optional(),
      location_id: z.string().uuid().optional(),
      flagged_only: z.boolean().default(false),
      limit: z.number().int().min(1).max(200).default(100),
    },
    safe(async (a) => {
      const conds = ["s.brand_id = $1", `s.posted_at > now() - ($2 || ' hours')::interval`];
      const params: unknown[] = [ctx.brandId, String(a.since_hours)];
      if (a.unanalyzed_only) conds.push("s.analyzed_at is null");
      if (a.flagged_only) conds.push("s.is_flagged = true");
      if (a.source) { params.push(a.source); conds.push(`s.source = $${params.length}`); }
      if (a.location_id) { params.push(a.location_id); conds.push(`s.location_id = $${params.length}`); }
      params.push(a.limit);
      const rows = await q(
        `select s.id, s.source, s.kind, s.author_name, s.author_handle, s.rating, s.text,
                s.posted_at, s.sentiment, s.sentiment_score, s.topics, s.dish_mentions, s.is_flagged,
                l.name as location
         from social_items s left join locations l on l.id = s.location_id
         where ${conds.join(" and ")}
         order by s.posted_at desc limit $${params.length}`,
        params
      );
      return textResult({ count: rows.length, items: rows });
    })
  );

  const updateSocial = tool(
    "update_social_item",
    "Tag a social item with analysis: sentiment, score (-1..1), topics, dish mentions, and flag status. Marks it analyzed.",
    {
      id: z.string().uuid(),
      sentiment: z.enum(["positive", "neutral", "negative"]),
      sentiment_score: z.number().min(-1).max(1),
      topics: z.array(z.string()).default([]),
      dish_mentions: z.array(z.string()).default([]),
      is_flagged: z.boolean().default(false),
    },
    safe(async (a) => {
      const row = await one(
        `update social_items set sentiment=$2, sentiment_score=$3, topics=$4, dish_mentions=$5, is_flagged=$6, analyzed_at=now()
         where id = $1 and brand_id = $7 returning id`,
        [a.id, a.sentiment, a.sentiment_score, a.topics, a.dish_mentions, a.is_flagged, ctx.brandId]
      );
      if (!row) return errorResult("social item not found for this brand");
      return textResult({ ok: true, id: a.id });
    })
  );

  return [dbQuery, listSocial, updateSocial];
}

// ============================ insights & actions ==========================

export function buildInsightTools(ctx: ToolCtx) {
  const saveInsight = tool(
    "save_insight",
    "Save an insight discovered from social data. Evidence must cite real social_item ids with short quotes.",
    {
      kind: z.enum(["highlight", "risk", "trend", "opportunity", "summary"]),
      severity: z.enum(["info", "warning", "critical"]).default("info"),
      title: z.string().max(140),
      summary: z.string().max(2000),
      evidence: z.array(z.object({ social_item_id: z.string().uuid(), quote: z.string().max(280) })).default([]),
      metrics: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
      for_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Defaults to today (Sydney)"),
    },
    safe(async (a) => {
      const forDate = a.for_date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
      const row = await one<{ id: string }>(
        `insert into insights (brand_id, for_date, kind, severity, title, summary, evidence, metrics, run_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
        [ctx.brandId, forDate, a.kind, a.severity, a.title, a.summary, JSON.stringify(a.evidence), JSON.stringify(a.metrics), ctx.runId]
      );
      runBus.emit(ctx.runId, "status", { note: `insight saved: ${a.title}`, insight_id: row!.id });
      return textResult({ ok: true, insight_id: row!.id });
    })
  );

  const proposeAction = tool(
    "propose_action",
    "Propose a concrete next action for the team (shows up as an actionable card). kinds: create_brief | reply_review | escalate | menu_feedback | email_team | ops_fix | other",
    {
      kind: z.string(),
      title: z.string().max(140),
      rationale: z.string().max(1000),
      insight_id: z.string().uuid().optional(),
      payload: z.record(z.string(), z.unknown()).default({}),
    },
    safe(async (a) => {
      const row = await one<{ id: string }>(
        `insert into proposed_actions (brand_id, insight_id, kind, title, rationale, payload, run_id)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [ctx.brandId, a.insight_id ?? null, a.kind, a.title, a.rationale, JSON.stringify(a.payload), ctx.runId]
      );
      return textResult({ ok: true, action_id: row!.id });
    })
  );

  return [saveInsight, proposeAction];
}

// ============================ briefs ======================================

const briefFields = {
  title: z.string().max(160),
  objective: z.string().max(500),
  audience: z.string().max(300),
  key_message: z.string().max(400),
  tone: z.string().max(200),
  angle: z.string().max(300),
  channels: z.array(z.enum(["instagram_story", "instagram_feed", "facebook"])).min(1),
  cta: z.string().max(200),
  visual_direction: z.string().max(1200),
  copy_notes: z.string().max(1200).optional(),
  schedule_hint: z.string().max(200).optional(),
  source_insight_ids: z.array(z.string().uuid()).default([]),
};

export function buildBriefTools(ctx: ToolCtx) {
  const saveBrief = tool(
    "save_brief",
    "Create today's structured content brief (status=draft). One brief per day per angle; check existing briefs first via db_query.",
    {
      ...briefFields,
      for_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    },
    safe(async (a) => {
      const forDate = a.for_date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
      const row = await one<{ id: string }>(
        `insert into briefs (brand_id, for_date, title, objective, audience, key_message, tone, angle, channels, cta,
            visual_direction, copy_notes, schedule_hint, source_insight_ids, run_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
        [ctx.brandId, forDate, a.title, a.objective, a.audience, a.key_message, a.tone, a.angle, a.channels, a.cta,
          a.visual_direction, a.copy_notes ?? null, a.schedule_hint ?? null, a.source_insight_ids, ctx.runId]
      );
      runBus.emit(ctx.runId, "status", { note: `brief saved: ${a.title}`, brief_id: row!.id });
      return textResult({ ok: true, brief_id: row!.id });
    })
  );

  const updateBrief = tool(
    "update_brief",
    "Update an existing brief (e.g. after human feedback). Bumps version. Status transitions allowed here: draft | in_review | archived. (approved requires human action or approval gate.)",
    {
      id: z.string().uuid(),
      patch: z.object({
        ...Object.fromEntries(Object.entries(briefFields).map(([k, v]) => [k, (v as z.ZodType).optional()])),
        status: z.enum(["draft", "in_review", "archived"]).optional(),
        feedback: z.string().max(2000).optional(),
      }),
    },
    safe(async ({ id, patch }) => {
      const existing = await one<{ id: string; version: number }>(
        `select id, version from briefs where id=$1 and brand_id=$2`, [id, ctx.brandId]);
      if (!existing) return errorResult("brief not found");
      const cols: string[] = ["version = version + 1", "updated_at = now()"];
      const params: unknown[] = [id, ctx.brandId];
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        params.push(Array.isArray(v) ? v : v);
        cols.push(`${k} = $${params.length}`);
      }
      await q(`update briefs set ${cols.join(", ")} where id=$1 and brand_id=$2`, params);
      return textResult({ ok: true, brief_id: id, version: existing.version + 1 });
    })
  );

  return [saveBrief, updateBrief];
}

// ============================ knowledge filesystem ========================

export function buildKnowledgeTools(ctx: ToolCtx) {
  const list = tool(
    "knowledge_list",
    "List all files in the brand knowledge filesystem (the agent's evolving memory).",
    {},
    safe(async () => {
      const rows = await q(
        `select path, title, version, updated_by, updated_at, length(content) as bytes
         from knowledge_files where brand_id=$1 order by path`, [ctx.brandId]);
      return textResult(rows);
    })
  );

  const read = tool(
    "knowledge_read",
    "Read a knowledge file by path.",
    { path: z.string() },
    safe(async ({ path }) => {
      const row = await one<{ content: string; version: number; updated_at: string }>(
        `select content, version, updated_at from knowledge_files where brand_id=$1 and path=$2`,
        [ctx.brandId, path]);
      if (!row) return errorResult(`no knowledge file at ${path}`);
      return textResult({ path, version: row.version, updated_at: row.updated_at, content: row.content });
    })
  );

  const write = tool(
    "knowledge_write",
    "Create or fully rewrite a knowledge file. Use for new files or restructuring; prefer knowledge_append for adding lessons. Always include a change_note explaining why.",
    {
      path: z.string().regex(/^[a-z0-9-_/.]+\.md$/i, "path like learnings/foo.md"),
      title: z.string().max(120).optional(),
      content: z.string().max(40_000),
      change_note: z.string().max(300),
    },
    safe(async (a) => {
      const updated = await one<{ id: string; version: number }>(
        `insert into knowledge_files (brand_id, path, title, content, updated_by, change_note)
         values ($1,$2,$3,$4,'agent',$5)
         on conflict (brand_id, path) do update
           set content=$4, title=coalesce($3, knowledge_files.title), version=knowledge_files.version+1,
               updated_by='agent', change_note=$5, updated_at=now()
         returning id, version`,
        [ctx.brandId, a.path, a.title ?? null, a.content, a.change_note]);
      await q(
        `insert into knowledge_revisions (file_id, version, content, updated_by, change_note)
         values ($1,$2,$3,'agent',$4)`,
        [updated!.id, updated!.version, a.content, a.change_note]);
      runBus.emit(ctx.runId, "status", { note: `knowledge updated: ${a.path} (v${updated!.version})` });
      return textResult({ ok: true, path: a.path, version: updated!.version });
    })
  );

  const append = tool(
    "knowledge_append",
    "Append a dated entry to a knowledge file (creates it if missing). The standard way to record lessons from human feedback.",
    {
      path: z.string().regex(/^[a-z0-9-_/.]+\.md$/i),
      content: z.string().max(4000).describe("Markdown to append (a dated bullet or short section)"),
      change_note: z.string().max(300),
    },
    safe(async (a) => {
      const existing = await one<{ id: string; content: string; version: number }>(
        `select id, content, version from knowledge_files where brand_id=$1 and path=$2`,
        [ctx.brandId, a.path]);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
      const addition = a.content.trim().startsWith("-") ? a.content.trim() : `- ${today} — ${a.content.trim()}`;
      const next = existing ? `${existing.content.replace(/\s+$/, "")}\n${addition}\n` : `# ${a.path}\n\n${addition}\n`;
      const updated = await one<{ id: string; version: number }>(
        `insert into knowledge_files (brand_id, path, content, updated_by, change_note)
         values ($1,$2,$3,'agent',$4)
         on conflict (brand_id, path) do update
           set content=$3, version=knowledge_files.version+1, updated_by='agent', change_note=$4, updated_at=now()
         returning id, version`,
        [ctx.brandId, a.path, next, a.change_note]);
      await q(
        `insert into knowledge_revisions (file_id, version, content, updated_by, change_note)
         values ($1,$2,$3,'agent',$4)`,
        [updated!.id, updated!.version, next, a.change_note]);
      runBus.emit(ctx.runId, "status", { note: `lesson recorded in ${a.path}` });
      return textResult({ ok: true, path: a.path, version: updated!.version });
    })
  );

  return [list, read, write, append];
}

// ============================ canvas blocks ===============================

export function buildCanvasTools(ctx: ToolCtx) {
  const pushBlock = tool(
    "push_block",
    `Push a visual block to the team's dashboard. kinds & payload shapes:
- metric: { label, value, delta?, tone?: "good"|"bad"|"neutral", caption? }
- chart: { chartType: "line"|"area"|"bar"|"donut", labels: string[], series: [{ name, data: number[], color? }], explanation, filters? }
- table: { columns: string[], rows: (string|number)[][], explanation? }
- markdown: { content }
- list: { items: [{ title, subtitle?, badge?, tone? }] }
Every chart/table must include an explanation stating the exact filters/timeframe used.`,
    {
      scope: z.enum(["dashboard", "listening", "briefing", "creative", "review", "chat"]).default("chat"),
      kind: z.enum(["metric", "chart", "table", "markdown", "list"]),
      title: z.string().max(120),
      payload: z.record(z.string(), z.unknown()),
    },
    safe(async (a) => {
      const row = await one<{ id: string }>(
        `insert into canvas_blocks (brand_id, run_id, scope, kind, title, payload)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [ctx.brandId, ctx.runId, a.scope, a.kind, a.title, JSON.stringify(a.payload)]);
      runBus.emit(ctx.runId, "block", { block_id: row!.id, scope: a.scope, kind: a.kind, title: a.title, payload: a.payload });
      return textResult({ ok: true, block_id: row!.id });
    })
  );
  return [pushBlock];
}

// ============================ approval gate (HITL) ========================

export function buildApprovalTools(ctx: ToolCtx) {
  const requestApproval = tool(
    "request_approval",
    "Ask the human team for a decision and WAIT for it (blocks up to 15 minutes). Required before sending email or moving any post to approved/scheduled/published. Returns { decision, note }. Decision is one of your options (default approve/reject) or 'expired'. Pass rich context so the human can decide from the card alone.",
    {
      subject_type: z.enum(["post", "email", "action", "brief", "other"]),
      subject_id: z.string().optional().describe("id of the post/brief/etc this decision is about"),
      question: z.string().max(500),
      context: z.record(z.string(), z.unknown()).default({}).describe("Everything the human needs: caption text, image urls, recipients, etc."),
      options: z.array(z.string().max(40)).min(2).max(4).default(["approve", "reject"]),
    },
    safe(async (a) => {
      const row = await one<{ id: string }>(
        `insert into approvals (brand_id, run_id, subject_type, subject_id, tool_name, question, context, options)
         values ($1,$2,$3,$4,'request_approval',$5,$6,$7) returning id`,
        [ctx.brandId, ctx.runId, a.subject_type, a.subject_id ?? null, a.question, JSON.stringify(a.context), JSON.stringify(a.options)]);
      const approvalId = row!.id;
      const waiter = approvalBridge.register(approvalId, ctx.runId);
      runBus.emit(ctx.runId, "approval_request", {
        approval_id: approvalId, subject_type: a.subject_type, subject_id: a.subject_id,
        question: a.question, context: a.context, options: a.options,
      });
      await q(`update agent_runs set status='awaiting_approval' where id=$1`, [ctx.runId]);

      const result = await Promise.race([
        waiter,
        new Promise<{ decision: string; note?: string }>((resolve) =>
          setTimeout(() => resolve({ decision: "expired" }), 15 * 60 * 1000)),
      ]);

      if (result.decision === "expired") {
        await q(`update approvals set status='expired', decided_at=now() where id=$1 and status='pending'`, [approvalId]);
      }
      await q(`update agent_runs set status='running' where id=$1 and status='awaiting_approval'`, [ctx.runId]);
      runBus.emit(ctx.runId, "approval_resolved", { approval_id: approvalId, ...result });
      return textResult({ approval_id: approvalId, ...result });
    })
  );
  return [requestApproval];
}

// ============================ email =======================================

export function buildEmailTools(ctx: ToolCtx) {
  const sendEmail = tool(
    "send_email",
    "Send an email to the team (digest, escalation, approval summary). REQUIRES an approval_id from request_approval with decision approve. If Gmail SMTP is not configured the email lands in the in-app outbox instead.",
    {
      approval_id: z.string().uuid().describe("an approvals.id whose status is approved"),
      to: z.array(z.string().email()).min(1).max(10),
      subject: z.string().max(200),
      html: z.string().max(100_000).describe("Email body HTML — clean inline-styled, brand palette"),
      text: z.string().max(20_000).optional(),
    },
    safe(async (a) => {
      const approval = await one<{ status: string }>(
        `select status from approvals where id=$1 and brand_id=$2`, [a.approval_id, ctx.brandId]);
      if (!approval || approval.status !== "approved") {
        return errorResult(`approval ${a.approval_id} is ${approval?.status ?? "missing"} — request_approval first and only send after an explicit approve.`);
      }
      const row = await one<{ id: string }>(
        `insert into outbox_emails (brand_id, to_emails, subject, html, text_body, run_id)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [ctx.brandId, a.to, a.subject, a.html, a.text ?? null, ctx.runId]);

      const user = process.env.GMAIL_USER;
      const pass = process.env.GMAIL_APP_PASSWORD;
      if (user && pass) {
        const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
        await transporter.sendMail({ from: user, to: a.to.join(", "), subject: a.subject, html: a.html, text: a.text });
        await q(`update outbox_emails set status='sent', provider='gmail', sent_at=now() where id=$1`, [row!.id]);
        runBus.emit(ctx.runId, "status", { note: `email sent via Gmail to ${a.to.join(", ")}` });
        return textResult({ ok: true, sent_via: "gmail", outbox_id: row!.id });
      }
      runBus.emit(ctx.runId, "status", { note: `email queued to in-app outbox (SMTP not configured)` });
      return textResult({ ok: true, sent_via: "outbox", outbox_id: row!.id, note: "Gmail SMTP not configured — the email is visible in the Outbox page." });
    })
  );
  return [sendEmail];
}
