/**
 * Server-side data fetchers for studio pages. All scoped to the active brand.
 */
import { q, one } from "@/lib/db";
import { getActiveBrand } from "@/lib/brand";

export type SocialItem = {
  id: string; source: string; kind: string; author_name: string | null; author_handle: string | null;
  rating: number | null; text: string | null; posted_at: string; sentiment: string | null;
  sentiment_score: number | null; topics: string[]; dish_mentions: string[]; is_flagged: boolean;
  analyzed_at: string | null; location: string | null;
};

export type Insight = {
  id: string; for_date: string; kind: string; severity: string; title: string; summary: string;
  evidence: { social_item_id: string; quote: string }[]; metrics: Record<string, unknown>;
  status: string; created_at: string;
};

export type ProposedAction = {
  id: string; insight_id: string | null; kind: string; title: string; rationale: string | null;
  status: string; created_at: string;
};

export type Brief = {
  id: string; for_date: string; title: string; status: string; objective: string | null;
  audience: string | null; key_message: string | null; tone: string | null; angle: string | null;
  channels: string[]; cta: string | null; visual_direction: string | null; copy_notes: string | null;
  schedule_hint: string | null; source_insight_ids: string[]; feedback: string | null;
  version: number; created_at: string; updated_at: string;
};

export type Asset = {
  id: string; brief_id: string | null; kind: string; format: string | null; variant_label: string | null;
  prompt: string | null; model: string | null; public_url: string | null; width: number | null;
  height: number | null; duration_seconds: number | null; caption_text: string | null; status: string;
  cost_usd: number | null; created_at: string; metadata: Record<string, unknown>;
};

export type Post = {
  id: string; brief_id: string | null; channel: string; caption: string | null; hashtags: string[];
  asset_ids: string[]; status: string; scheduled_at: string | null; published_at: string | null;
  review_id: string | null; created_at: string; updated_at: string;
};

export type Review = {
  id: string; post_id: string | null; asset_id: string | null; verdict: string; overall_score: number | null;
  scores: Record<string, { score: number; note: string }>; feedback: string | null;
  annotated_image_url: string | null; created_at: string;
};

export type KnowledgeFile = {
  id: string; path: string; title: string | null; content: string; version: number;
  updated_by: string; change_note: string | null; updated_at: string;
};

export type AgentRun = {
  id: string; workflow: string; trigger: string; status: string; summary: string | null;
  model: string | null; turns: number; cost_usd: number; started_at: string; finished_at: string | null;
};

export type Approval = {
  id: string; run_id: string | null; subject_type: string; subject_id: string | null; question: string;
  context: Record<string, unknown>; options: string[]; status: string; decision: string | null;
  note: string | null; created_at: string;
};

export type OutboxEmail = {
  id: string; to_emails: string[]; subject: string; html: string; status: string;
  provider: string; created_at: string; sent_at: string | null;
};

export type CanvasBlockRow = {
  id: string; scope: string; kind: "metric" | "chart" | "table" | "markdown" | "list";
  title: string | null; payload: Record<string, unknown>; pinned: boolean; created_at: string;
};

export async function getOverviewStats() {
  const brand = await getActiveBrand();
  const [row] = await q<{
    mentions_72h: string; mentions_prev_72h: string; avg_sentiment: string | null;
    avg_rating_14d: string | null; negative_pct: string | null; unanalyzed: string;
    pending_approvals: string; flagged: string;
  }>(
    `select
      (select count(*) from social_items where brand_id=$1 and posted_at > now() - interval '72 hours') as mentions_72h,
      (select count(*) from social_items where brand_id=$1 and posted_at between now() - interval '144 hours' and now() - interval '72 hours') as mentions_prev_72h,
      (select round(avg(sentiment_score)::numeric, 2) from social_items where brand_id=$1 and posted_at > now() - interval '14 days' and sentiment_score is not null) as avg_sentiment,
      (select round(avg(rating)::numeric, 1) from social_items where brand_id=$1 and rating is not null and posted_at > now() - interval '14 days') as avg_rating_14d,
      (select round(100.0 * count(*) filter (where sentiment='negative') / nullif(count(*) filter (where sentiment is not null), 0), 0) from social_items where brand_id=$1 and posted_at > now() - interval '72 hours') as negative_pct,
      (select count(*) from social_items where brand_id=$1 and analyzed_at is null) as unanalyzed,
      (select count(*) from approvals where brand_id=$1 and status='pending') as pending_approvals,
      (select count(*) from social_items where brand_id=$1 and is_flagged) as flagged`,
    [brand.id]
  );
  return row;
}

export async function getSentimentTrend(days = 14) {
  const brand = await getActiveBrand();
  return q<{ day: string; positive: number; negative: number; neutral: number }>(
    `select to_char(d.day, 'DD Mon') as day,
            count(*) filter (where s.sentiment='positive')::int as positive,
            count(*) filter (where s.sentiment='negative')::int as negative,
            count(*) filter (where s.sentiment='neutral')::int as neutral
     from generate_series(current_date - ($2::int - 1), current_date, interval '1 day') d(day)
     left join social_items s on s.brand_id=$1 and s.posted_at::date = d.day
     group by d.day order by d.day`,
    [brand.id, days]
  );
}

export async function getTopTopics(days = 14, limit = 8) {
  const brand = await getActiveBrand();
  return q<{ name: string; value: number }>(
    `select t as name, count(*)::int as value
     from social_items s, unnest(s.topics) t
     where s.brand_id=$1 and s.posted_at > now() - ($2 || ' days')::interval
     group by t order by value desc limit $3`,
    [brand.id, String(days), limit]
  );
}

export async function getTrendingDishes(days = 7, limit = 6) {
  const brand = await getActiveBrand();
  return q<{ name: string; value: number; avg_sentiment: number | null }>(
    `select d as name, count(*)::int as value, round(avg(s.sentiment_score)::numeric, 2)::float as avg_sentiment
     from social_items s, unnest(s.dish_mentions) d
     where s.brand_id=$1 and s.posted_at > now() - ($2 || ' days')::interval
     group by d order by value desc limit $3`,
    [brand.id, String(days), limit]
  );
}

export async function getSourceBreakdown(days = 14) {
  const brand = await getActiveBrand();
  return q<{ name: string; value: number }>(
    `select source as name, count(*)::int as value from social_items
     where brand_id=$1 and posted_at > now() - ($2 || ' days')::interval
     group by source order by value desc`,
    [brand.id, String(days)]
  );
}

export async function getSocialItems(opts: { limit?: number; source?: string; sentiment?: string; flagged?: boolean } = {}) {
  const brand = await getActiveBrand();
  const conds = ["s.brand_id = $1"];
  const params: unknown[] = [brand.id];
  if (opts.source) { params.push(opts.source); conds.push(`s.source = $${params.length}`); }
  if (opts.sentiment === "unanalyzed") conds.push("s.analyzed_at is null");
  else if (opts.sentiment) { params.push(opts.sentiment); conds.push(`s.sentiment = $${params.length}`); }
  if (opts.flagged) conds.push("s.is_flagged");
  params.push(opts.limit ?? 60);
  return q<SocialItem>(
    `select s.id, s.source, s.kind, s.author_name, s.author_handle, s.rating, s.text, s.posted_at,
            s.sentiment, s.sentiment_score, s.topics, s.dish_mentions, s.is_flagged, s.analyzed_at,
            l.name as location
     from social_items s left join locations l on l.id = s.location_id
     where ${conds.join(" and ")}
     order by s.posted_at desc limit $${params.length}`,
    params
  );
}

export async function getInsights(limit = 20) {
  const brand = await getActiveBrand();
  return q<Insight>(
    `select id, for_date, kind, severity, title, summary, evidence, metrics, status, created_at
     from insights where brand_id=$1 order by for_date desc, severity = 'critical' desc, created_at desc limit $2`,
    [brand.id, limit]
  );
}

export async function getProposedActions(status = "proposed") {
  const brand = await getActiveBrand();
  return q<ProposedAction>(
    `select id, insight_id, kind, title, rationale, status, created_at
     from proposed_actions where brand_id=$1 and status=$2 order by created_at desc limit 12`,
    [brand.id, status]
  );
}

export async function getBriefs(limit = 20) {
  const brand = await getActiveBrand();
  return q<Brief>(
    `select id, for_date, title, status, objective, audience, key_message, tone, angle, channels, cta,
            visual_direction, copy_notes, schedule_hint, source_insight_ids, feedback, version, created_at, updated_at
     from briefs where brand_id=$1 order by for_date desc, created_at desc limit $2`,
    [brand.id, limit]
  );
}

export async function getBrief(id: string) {
  const brand = await getActiveBrand();
  return one<Brief>(
    `select id, for_date, title, status, objective, audience, key_message, tone, angle, channels, cta,
            visual_direction, copy_notes, schedule_hint, source_insight_ids, feedback, version, created_at, updated_at
     from briefs where brand_id=$1 and id=$2`,
    [brand.id, id]
  );
}

export async function getAssets(opts: { briefId?: string; kind?: string; limit?: number } = {}) {
  const brand = await getActiveBrand();
  const conds = ["brand_id = $1"];
  const params: unknown[] = [brand.id];
  if (opts.briefId) { params.push(opts.briefId); conds.push(`brief_id = $${params.length}`); }
  if (opts.kind) { params.push(opts.kind); conds.push(`kind = $${params.length}`); }
  params.push(opts.limit ?? 60);
  return q<Asset>(
    `select id, brief_id, kind, format, variant_label, prompt, model, public_url, width, height,
            duration_seconds, caption_text, status, cost_usd, created_at, metadata
     from assets where ${conds.join(" and ")} order by created_at desc limit $${params.length}`,
    params
  );
}

export async function getPosts(limit = 30) {
  const brand = await getActiveBrand();
  return q<Post>(
    `select id, brief_id, channel, caption, hashtags, asset_ids, status, scheduled_at, published_at,
            review_id, created_at, updated_at
     from posts where brand_id=$1 order by created_at desc limit $2`,
    [brand.id, limit]
  );
}

export async function getReviews(limit = 30) {
  const brand = await getActiveBrand();
  return q<Review>(
    `select id, post_id, asset_id, verdict, overall_score, scores, feedback, annotated_image_url, created_at
     from reviews where brand_id=$1 order by created_at desc limit $2`,
    [brand.id, limit]
  );
}

export async function getKnowledgeFiles() {
  const brand = await getActiveBrand();
  return q<KnowledgeFile>(
    `select id, path, title, content, version, updated_by, change_note, updated_at
     from knowledge_files where brand_id=$1 order by path`,
    [brand.id]
  );
}

export async function getKnowledgeRevisions(fileId: string) {
  return q<{ version: number; change_note: string | null; updated_by: string | null; created_at: string }>(
    `select version, change_note, updated_by, created_at from knowledge_revisions
     where file_id=$1 order by version desc limit 20`,
    [fileId]
  );
}

export async function getRuns(limit = 30) {
  const brand = await getActiveBrand();
  return q<AgentRun>(
    `select id, workflow, trigger, status, summary, model, turns, cost_usd, started_at, finished_at
     from agent_runs where brand_id=$1 order by started_at desc limit $2`,
    [brand.id, limit]
  );
}

export async function getRunEvents(runId: string) {
  return q<{ seq: number; type: string; payload: Record<string, unknown>; created_at: string }>(
    `select seq, type, payload, created_at from agent_events where run_id=$1 order by seq limit 500`,
    [runId]
  );
}

export async function getApprovals(status?: string) {
  const brand = await getActiveBrand();
  const conds = ["brand_id = $1"];
  const params: unknown[] = [brand.id];
  if (status) { params.push(status); conds.push(`status = $${params.length}`); }
  return q<Approval>(
    `select id, run_id, subject_type, subject_id, question, context, options, status, decision, note, created_at
     from approvals where ${conds.join(" and ")} order by created_at desc limit 30`,
    params
  );
}

export async function getOutbox(limit = 30) {
  const brand = await getActiveBrand();
  return q<OutboxEmail>(
    `select id, to_emails, subject, html, status, provider, created_at, sent_at
     from outbox_emails where brand_id=$1 order by created_at desc limit $2`,
    [brand.id, limit]
  );
}

export async function getCanvasBlocks(scope: string, limit = 24) {
  const brand = await getActiveBrand();
  return q<CanvasBlockRow>(
    `select id, scope, kind, title, payload, pinned, created_at
     from canvas_blocks where brand_id=$1 and scope=$2 order by pinned desc, created_at desc limit $3`,
    [brand.id, scope, limit]
  );
}

export async function getConnections() {
  const brand = await getActiveBrand();
  return q<{ provider: string; status: string; config: Record<string, unknown>; last_synced_at: string | null }>(
    `select provider, status, config, last_synced_at from connections where brand_id=$1 order by provider`,
    [brand.id]
  );
}

export async function getChatThread(threadId: string) {
  return q<{ id: string; role: string; content: string | null; created_at: string }>(
    `select id, role, content, created_at from chat_messages where thread_id=$1 order by created_at limit 100`,
    [threadId]
  );
}

export async function getMentionHeatmap(days = 84) {
  const brand = await getActiveBrand();
  return q<{ day: string; count: number; avg_sentiment: number | null }>(
    `select to_char(d.day, 'YYYY-MM-DD') as day,
            count(s.id)::int as count,
            round(avg(s.sentiment_score)::numeric, 2)::float as avg_sentiment
     from generate_series(current_date - ($2::int - 1), current_date, interval '1 day') d(day)
     left join social_items s on s.brand_id=$1 and s.posted_at::date = d.day
     group by d.day order by d.day`,
    [brand.id, days]
  );
}

export async function getLocationPulse(days = 14) {
  const brand = await getActiveBrand();
  return q<{
    name: string; mentions: number; avg_sentiment: number | null; positive: number;
    negative: number; avg_rating: number | null; top_dish: string | null;
  }>(
    `select l.name,
            count(s.id)::int as mentions,
            round(avg(s.sentiment_score)::numeric, 2)::float as avg_sentiment,
            count(*) filter (where s.sentiment='positive')::int as positive,
            count(*) filter (where s.sentiment='negative')::int as negative,
            round(avg(s.rating)::numeric, 1)::float as avg_rating,
            (select d from social_items s2, unnest(s2.dish_mentions) d
             where s2.location_id = l.id and s2.posted_at > now() - ($2 || ' days')::interval
             group by d order by count(*) desc limit 1) as top_dish
     from locations l
     left join social_items s on s.location_id = l.id and s.posted_at > now() - ($2 || ' days')::interval
     where l.brand_id = $1
     group by l.id, l.name order by l.name`,
    [brand.id, String(days)]
  );
}

export async function getRunTotals() {
  const brand = await getActiveBrand();
  const [row] = await q<{
    total: number; completed: number; failed: number; active: number;
    total_cost: number; total_turns: number; input_tokens: string; output_tokens: string;
    avg_minutes: number | null;
  }>(
    `select count(*)::int as total,
            count(*) filter (where status='completed')::int as completed,
            count(*) filter (where status='failed')::int as failed,
            count(*) filter (where status in ('running','awaiting_approval'))::int as active,
            coalesce(sum(cost_usd), 0)::float as total_cost,
            coalesce(sum(turns), 0)::int as total_turns,
            coalesce(sum(input_tokens), 0)::bigint as input_tokens,
            coalesce(sum(output_tokens), 0)::bigint as output_tokens,
            round((avg(extract(epoch from (finished_at - started_at)) / 60)
                   filter (where finished_at is not null))::numeric, 1)::float as avg_minutes
     from agent_runs where brand_id=$1`,
    [brand.id]
  );
  return row;
}

export async function getRunDaily(days = 14) {
  const brand = await getActiveBrand();
  return q<{ label: string; runs: number; cost: number }>(
    `select to_char(d.day, 'DD Mon') as label,
            count(r.id)::int as runs,
            round(coalesce(sum(r.cost_usd), 0)::numeric, 2)::float as cost
     from generate_series(current_date - ($2::int - 1), current_date, interval '1 day') d(day)
     left join agent_runs r on r.brand_id=$1 and r.started_at::date = d.day
     group by d.day order by d.day`,
    [brand.id, days]
  );
}

/** Posts + briefs that land inside [fromISO, toISO] — for the content calendar. */
export async function getCalendarData(fromISO: string, toISO: string) {
  const brand = await getActiveBrand();
  const posts = await q<Post & { occurs_on: string }>(
    `select id, brief_id, channel, caption, hashtags, asset_ids, status, scheduled_at, published_at,
            review_id, created_at, updated_at,
            to_char(coalesce(scheduled_at, published_at, created_at)::date, 'YYYY-MM-DD') as occurs_on
     from posts where brand_id=$1
       and coalesce(scheduled_at, published_at, created_at)::date between $2::date and $3::date
     order by coalesce(scheduled_at, published_at, created_at)`,
    [brand.id, fromISO, toISO]
  );
  const briefs = await q<{ id: string; title: string; status: string; channels: string[]; occurs_on: string }>(
    `select id, title, status, channels, to_char(for_date, 'YYYY-MM-DD') as occurs_on
     from briefs where brand_id=$1 and for_date between $2::date and $3::date
     order by for_date`,
    [brand.id, fromISO, toISO]
  );
  return { posts, briefs };
}

/** Latest agent activity across all runs — for the live activity feed. */
export async function getRecentAgentEvents(limit = 40) {
  const brand = await getActiveBrand();
  return q<{ run_id: string; workflow: string; type: string; payload: Record<string, unknown>; created_at: string }>(
    `select e.run_id, r.workflow, e.type, e.payload, e.created_at
     from agent_events e join agent_runs r on r.id = e.run_id
     where r.brand_id=$1 and e.type in ('tool_call','asset','block','approval_request','done')
     order by e.id desc limit $2`,
    [brand.id, limit]
  );
}

export async function getPendingCounts() {
  const brand = await getActiveBrand();
  const [row] = await q<{ approvals: string; actions: string; unanalyzed: string }>(
    `select
       (select count(*) from approvals where brand_id=$1 and status='pending') as approvals,
       (select count(*) from proposed_actions where brand_id=$1 and status='proposed') as actions,
       (select count(*) from social_items where brand_id=$1 and analyzed_at is null) as unanalyzed`,
    [brand.id]
  );
  return row;
}
