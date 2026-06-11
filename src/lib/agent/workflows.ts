/**
 * Canned mission prompts — what each workflow's "Run" button sends the agent.
 * The system prompt (system.ts) carries the role + rules; these carry the task.
 */
import type { Workflow } from "@/lib/agent/system";

export function missionPrompt(workflow: Workflow, params: Record<string, string> = {}): string {
  const today = new Date().toLocaleDateString("en-AU", {
    timeZone: "Australia/Sydney", weekday: "long", day: "numeric", month: "long",
  });
  switch (workflow) {
    case "listening":
      return `Run the morning listening sweep for ${today}.

1. Fetch unanalysed items (list_social_items, unanalyzed_only=true, since_hours=72) and analyse EVERY one: sentiment, score, topics, dish mentions, flag anything health/safety related (update_social_item).
2. Zoom out with db_query over the last 14 days of analysed items: sentiment by day, by location, by source; recurring topics; dish momentum; rating trends.
3. Save the day's insights (save_insight) — typically 3–5, each with evidence quotes and item ids. Safety issues are always a critical insight.
4. Make it visual for the team — push_block to scope "listening":
   • one metric block each for: total mentions (72h), average sentiment score, average review rating (14d), % negative (72h)
   • an area chart: positive vs negative mentions per day over 14 days
   • a bar chart: top topics by mention count (14d)
   • a list block: trending dishes with momentum badges
5. Propose 1–3 concrete actions (propose_action) ranked by impact.
6. Finish with a 5–8 line digest a busy manager can read in 30 seconds: lead with anything critical, then trends, then opportunities.`;
    case "briefing":
      return `Create today's content brief (${today}).

1. Read the latest insights (db_query insights for the last 3 days, newest first) and the proposed actions still open. Read learnings/content-performance.md and the recent briefs (last 5) so you don't repeat an angle.
2. Decide today's single best angle using the briefing business logic in your mission rules. Note in one line why this angle beats the runner-up.
3. Save ONE brief (save_brief) — specific enough that a designer would ask zero questions: concrete objective, audience persona, key message in customer language, tone cues from brand voice, channels (story + feed when warranted), CTA, a visual_direction that references our visual style contract, copy_notes with any mandatory wording, schedule_hint based on audience posting windows, and source_insight_ids.
4. push_block (scope "briefing") a markdown block summarising the brief and the why-this-angle reasoning.
5. Close with the runner-up angle you considered and when it would be the right play.${params.focus ? `\n\nThe team asked you to focus on: ${params.focus}` : ""}`;
    case "creative":
      return `Produce the full creative package for brief ${params.briefId}.

1. Read the brief (db_query) and brand/visual-style.md + brand/voice.md. ALSO check the brand library for real reference photos of the dishes involved: db_query "select id, variant_label, prompt from assets where kind='reference'". If any match the brief's dish, you MUST pass their ids via reference_asset_ids on every generate_image call so output matches the real plating and crockery.
2. Captions FIRST (final copy before any image): for each channel in the brief, write 2 caption variants (A/B with genuinely different hooks) and save each (save_caption).
3. Images: produce 2 distinct creative directions. For EACH direction, generate the formats the channels need (instagram_story → story_9x16, instagram_feed → feed_4x5, facebook → feed_1x1). Use generate_image with photographer-grade prompts implementing our visual style (warm natural light, 45° or top-down, eucalyptus green/terracotta/cream accents, real textures, shallow depth). Label variants clearly ("A — hero close-up", "B — table scene"). Inspect each returned image; if one misses the brief or style, fix it with edit_image (max one retouch each).
4. Generate ONE short Veo video (generate_video, 9:16, 6s) for the strongest direction — describe motion + ambient audio. Seed it from the best story image.
5. push_block (scope "creative") a markdown block: the package summary — directions, what each variant is for, and your recommended hero combination (caption × image) per channel.
6. End by recommending which variants to send to brand review and why.`;
    case "review":
      return `Run brand-consistency review${params.postId ? ` for post ${params.postId}` : " for the current candidate package"}.

1. Load the subject: ${params.postId ? `post ${params.postId} with its caption and assets (db_query posts, assets)` : `the most recent brief's candidate assets and captions (db_query)`}. Re-read brand/voice.md, brand/visual-style.md, brand/guidelines.md.
2. Score the rubric (voice_tone, visual_style, guideline_compliance, message_accuracy, audience_fit) 0–100 each with a one-line note. Judge the IMAGE by actually looking at it (it was returned to you when generated, or fetch context via db_query and reason from the stored prompt + your knowledge of it).
3. Verdict per the mapping (pass / flag / reject). For flag or reject with visual problems, call annotate_image marking each issue on the image, then save_review including the annotated asset. For pass, save_review with strengths in feedback.
4. If no post exists yet, assemble the best caption + image into save_post (channel from the brief) before reviewing.
5. For any post you judge ready: request_approval (subject_type post, include caption text + image url in context, options ["approve","reject","request changes"]). If approved → update_post status approved (pass the approval_id). If "request changes" or rejected → update_post status changes_requested and append the lesson to learnings/feedback-log.md.
6. push_block (scope "review") a table block: rubric scores and verdicts. Finish with a one-paragraph verdict summary.`;
    case "pipeline":
      return `Run the FULL daily marketing cycle for ${today}, end to end. Phases: (1) listening sweep (abbreviated: analyse new items, 2–3 insights, key blocks), (2) today's brief, (3) creative package (2 caption variants + 2 image directions for the brief's channels — skip video to save time), (4) brand review of the best combination, (5) assemble the post and request_approval with full context, finalising status per the decision, (6) send the team a daily digest email IF approved (request_approval for the email first, then send_email to ${params.digestEmail || "the team"}). Keep momentum — tight outputs, blocks as you go, and a final wrap-up of everything produced with links/ids.`;
    case "connect": {
      const provider = params.provider ?? "google_reviews";
      const playbooks: Record<string, string> = {
        google_reviews: `Provider: Google Reviews (Google Business Profile API).
Start at https://console.cloud.google.com/apis/credentials — existing keys live under "API keys". If the Business Profile API isn't enabled, the library page is https://console.cloud.google.com/apis/library/mybusinessbusinessinformation.googleapis.com. Save config {api_key}.`,
        facebook: `Provider: Facebook (Meta Graph API — page comments & messages).
Start at https://developers.facebook.com/apps — open the team's app (or request_approval before creating one). A quick token comes from Tools → Graph API Explorer (page token with pages_read_engagement); note token expiry in config {note}. Save config {access_token, app_id}.`,
        instagram: `Provider: Instagram (Instagram Graph API via the same Meta app).
Start at https://developers.facebook.com/apps — confirm the Instagram Graph API product is added, then Graph API Explorer with instagram_basic + pages_show_list scopes. Save config {access_token, app_id}.`,
        gmail: `Provider: Gmail SMTP via App Password — this makes Palate's digest emails actually send.
Start at https://myaccount.google.com/apppasswords (requires 2-Step Verification; if it's off, guide the user to https://myaccount.google.com/signinoptions/two-step-verification first and request_approval while they enable it). Have them create an app password named "Palate" — the 16-character code is shown ONCE, so take_snapshot immediately and capture it. Save config {user: <their gmail address>, app_password: <the 16 chars, no spaces>}. After saving, tell them the Outbox will now really send.`,
      };
      return `Connect "${provider}" for the team by co-driving your visible Chrome window.

${playbooks[provider] ?? `Provider: ${provider} — find its developer console and locate an API credential.`}

Protocol:
1. Say the plan in 2–3 lines. Your chrome tools load lazily — FIRST call ToolSearch with query "+chrome page" (or "select:mcp__chrome__list_pages,mcp__chrome__new_page,mcp__chrome__navigate_page,mcp__chrome__take_snapshot,mcp__chrome__click,mcp__chrome__fill,mcp__chrome__wait_for") to load them, then list_pages to confirm Chrome is up, then open the console URL and take_snapshot. You MUST drive the browser yourself — do not fall back to telling the user to do the navigation. Only if the chrome tools are genuinely unavailable after ToolSearch, say so explicitly and stop.
2. Logins/2FA/consent are the human's job — request_approval with exact instructions and wait. Never touch credential fields.
3. Find an existing credential first; request_approval before creating anything new.
4. When the credential is visible, capture it from the snapshot and call save_connection (provider "${provider}", status "connected", correct config keys). Quote only its last 4 characters in prose.
5. Blocked (no access, missing permissions, wrong account)? save_connection status "pending" with config {note: where it stopped} and finish with precise next steps for the team.
6. Close with a 3-line summary: what's connected, what Palate will do with it, anything left for the team.`;
    }
    default:
      return params.prompt ?? "Introduce yourself and summarise what you can see in the data right now.";
  }
}
