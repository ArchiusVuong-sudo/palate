/**
 * Agent run orchestrator — wraps Claude Agent SDK query() with:
 *  - the Palate tool belt (in-process MCP server)
 *  - SSE event streaming via runBus (+ agent_events persistence)
 *  - run lifecycle rows in agent_runs
 *  - session capture for resumable chat threads
 */
import { query, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { q, one } from "@/lib/db";
import { getActiveBrand, getLocations } from "@/lib/brand";
import { buildSystemPrompt, type Workflow } from "@/lib/agent/system";
import { runBus } from "@/lib/agent/bridge";
import {
  buildDataTools, buildInsightTools, buildBriefTools, buildKnowledgeTools,
  buildCanvasTools, buildApprovalTools, buildEmailTools, type ToolCtx,
} from "@/lib/agent/tools";
import { buildCreativeTools, buildReviewTools } from "@/lib/agent/tools-creative";

const TOOL_NAMES = [
  "db_query", "list_social_items", "update_social_item",
  "save_insight", "propose_action",
  "save_brief", "update_brief",
  "knowledge_list", "knowledge_read", "knowledge_write", "knowledge_append",
  "push_block", "request_approval", "send_email",
  "generate_image", "edit_image", "annotate_image", "generate_video", "save_caption",
  "save_review", "save_post", "update_post",
].map((t) => `mcp__palate__${t}`);

declare global {
  // eslint-disable-next-line no-var
  var __palateAborts: Map<string, AbortController> | undefined;
}
const aborts: Map<string, AbortController> = global.__palateAborts ?? new Map();
global.__palateAborts = aborts;

export type StartRunOpts = {
  workflow: Workflow;
  prompt: string;
  trigger?: "manual" | "chat" | "cron" | "pipeline";
  threadId?: string;       // chat thread for copilot persistence
  resumeSessionId?: string; // continue a previous SDK session
};

export async function startAgentRun(opts: StartRunOpts): Promise<{ runId: string }> {
  const brand = await getActiveBrand();
  const row = await one<{ id: string }>(
    `insert into agent_runs (brand_id, workflow, trigger, prompt, model, status)
     values ($1,$2,$3,$4,$5,'running') returning id`,
    [brand.id, opts.workflow, opts.trigger ?? "manual", opts.prompt, process.env.AGENT_MODEL ?? "claude-opus-4-8"]
  );
  const runId = row!.id;
  executeRun(runId, brand.id, opts).catch(async (e) => {
    await q(`update agent_runs set status='failed', error=$2, finished_at=now() where id=$1`, [runId, String(e)]);
    runBus.emit(runId, "error", { message: String(e) });
    runBus.emit(runId, "done", { status: "failed" });
  });
  return { runId };
}

export function cancelRun(runId: string): boolean {
  const ac = aborts.get(runId);
  if (!ac) return false;
  ac.abort();
  return true;
}

async function executeRun(runId: string, brandId: string, opts: StartRunOpts) {
  const brand = await getActiveBrand();
  const locations = await getLocations(brandId);
  const systemPrompt = await buildSystemPrompt({ brand, locations, workflow: opts.workflow });

  const ctx: ToolCtx = { brandId, runId, workflow: opts.workflow };
  const server = createSdkMcpServer({
    name: "palate",
    version: "1.0.0",
    tools: [
      ...buildDataTools(ctx),
      ...buildInsightTools(ctx),
      ...buildBriefTools(ctx),
      ...buildKnowledgeTools(ctx),
      ...buildCanvasTools(ctx),
      ...buildApprovalTools(ctx),
      ...buildEmailTools(ctx),
      ...buildCreativeTools(ctx),
      ...buildReviewTools(ctx),
    ],
  });

  const workspace = path.join(process.cwd(), ".agent-workspace", brandId);
  mkdirSync(workspace, { recursive: true });

  const abortController = new AbortController();
  aborts.set(runId, abortController);
  runBus.emit(runId, "status", { note: `run started — ${opts.workflow}`, workflow: opts.workflow });

  const toolNameById = new Map<string, string>();
  let finalText = "";
  let currentText = "";
  let turns = 0;
  const seenMsgIds = new Set<string>();
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const stream = query({
      prompt: opts.prompt,
      options: {
        abortController,
        systemPrompt,
        model: process.env.AGENT_MODEL ?? "claude-opus-4-8",
        fallbackModel: process.env.AGENT_FALLBACK_MODEL ?? "claude-sonnet-4-6",
        mcpServers: { palate: server },
        tools: ["WebSearch", "WebFetch"],
        allowedTools: [...TOOL_NAMES, "WebSearch", "WebFetch"],
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        maxTurns: 120,
        maxBudgetUsd: 8,
        cwd: workspace,
        settingSources: [],
        persistSession: true,
        ...(opts.resumeSessionId ? { resume: opts.resumeSessionId } : {}),
        env: {
          ...process.env,
          CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
          // request_approval can block up to 15 min; Veo renders take minutes.
          CLAUDE_CODE_STREAM_CLOSE_TIMEOUT: "1800000",
          DISABLE_AUTOUPDATER: "1",
        },
        stderr: (data: string) => {
          if (process.env.NODE_ENV !== "production") console.error("[agent-cli]", data.slice(0, 400));
        },
      },
    });

    for await (const message of stream) {
      if (message.type === "system" && message.subtype === "init") {
        await q(`update agent_runs set session_id=$2, model=$3 where id=$1`, [runId, message.session_id, message.model]);
        if (opts.threadId) {
          await q(`update chat_threads set session_id=$2, updated_at=now() where id=$1`, [opts.threadId, message.session_id]);
        }
        runBus.emit(runId, "status", { note: "agent online", session_id: message.session_id, model: message.model });
      } else if (message.type === "stream_event") {
        const ev = message.event as { type: string; delta?: { type?: string; text?: string; thinking?: string }; content_block?: { type?: string; name?: string } };
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta" && ev.delta.text) {
          currentText += ev.delta.text;
          runBus.emit(runId, "text", { text: ev.delta.text });
        } else if (ev.type === "content_block_delta" && ev.delta?.type === "thinking_delta" && ev.delta.thinking) {
          runBus.emit(runId, "thinking", { text: ev.delta.thinking });
        } else if (ev.type === "content_block_start" && ev.content_block?.type === "tool_use" && ev.content_block.name) {
          runBus.emit(runId, "status", { note: `calling ${shortToolName(ev.content_block.name)}…` });
        }
      } else if (message.type === "assistant") {
        turns += 1;
        const msg = message.message as unknown as { id: string; usage?: { input_tokens?: number; output_tokens?: number }; content: Array<Record<string, unknown>> };
        if (msg.id && !seenMsgIds.has(msg.id)) {
          seenMsgIds.add(msg.id);
          inputTokens += msg.usage?.input_tokens ?? 0;
          outputTokens += msg.usage?.output_tokens ?? 0;
        }
        for (const block of msg.content) {
          if (block.type === "tool_use") {
            const name = String(block.name);
            toolNameById.set(String(block.id), name);
            runBus.emit(runId, "tool_call", {
              tool_use_id: block.id,
              name: shortToolName(name),
              input: sanitizeForEvent(block.input),
            });
          } else if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
            finalText = block.text;
            runBus.emit(runId, "text_block", { text: block.text });
          }
        }
        if (currentText.trim()) currentText = "";
      } else if (message.type === "user") {
        const m = message as { message?: { content?: unknown }; tool_use_result?: unknown };
        const content = m.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === "tool_result") {
              const name = toolNameById.get(String(block.tool_use_id)) ?? "tool";
              runBus.emit(runId, "tool_result", {
                tool_use_id: block.tool_use_id,
                name: shortToolName(name),
                is_error: Boolean(block.is_error),
                summary: summarizeToolResult(block.content),
              });
            }
          }
        }
      } else if (message.type === "result") {
        const r = message as unknown as {
          subtype: string; result?: string; total_cost_usd?: number; num_turns?: number;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        const ok = r.subtype === "success";
        const summary = (ok && r.result ? r.result : finalText).slice(0, 4000);
        await q(
          `update agent_runs set status=$2, summary=$3, cost_usd=$4, turns=$5, input_tokens=$6, output_tokens=$7,
             finished_at=now(), error = case when $2='failed' then $8 else null end
           where id=$1`,
          [runId, ok ? "completed" : "failed", summary, r.total_cost_usd ?? 0, r.num_turns ?? turns,
            r.usage?.input_tokens ?? inputTokens, r.usage?.output_tokens ?? outputTokens,
            ok ? null : `agent ended: ${r.subtype}`]
        );
        if (opts.threadId && summary) {
          await q(
            `insert into chat_messages (thread_id, run_id, role, content) values ($1,$2,'assistant',$3)`,
            [opts.threadId, runId, summary]
          );
          await q(`update chat_threads set updated_at=now() where id=$1`, [opts.threadId]);
        }
        runBus.emit(runId, "done", {
          status: ok ? "completed" : "failed",
          subtype: r.subtype,
          cost_usd: r.total_cost_usd,
          summary,
        });
      }
    }
  } finally {
    aborts.delete(runId);
    // If the loop exited without a result (abort/crash), close the run row.
    const stillRunning = await one<{ id: string }>(
      `select id from agent_runs where id=$1 and status in ('running','awaiting_approval')`, [runId]);
    if (stillRunning) {
      await q(`update agent_runs set status='cancelled', finished_at=now() where id=$1`, [runId]);
      runBus.emit(runId, "done", { status: "cancelled" });
    }
  }
}

function shortToolName(name: string): string {
  return name.replace(/^mcp__palate__/, "");
}

function sanitizeForEvent(input: unknown): unknown {
  try {
    const json = JSON.stringify(input, (_k, v) =>
      typeof v === "string" && v.length > 600 ? `${v.slice(0, 600)}… (${v.length} chars)` : v
    );
    return JSON.parse(json);
  } catch {
    return { note: "unserializable input" };
  }
}

function summarizeToolResult(content: unknown): string {
  if (typeof content === "string") return content.slice(0, 700);
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const c of content) {
      if (c?.type === "text" && typeof c.text === "string") parts.push(c.text.slice(0, 700));
      else if (c?.type === "image") parts.push("[image]");
    }
    return parts.join(" ").slice(0, 800);
  }
  return "";
}
