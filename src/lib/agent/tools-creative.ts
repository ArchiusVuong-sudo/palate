/**
 * Creative + review tool belt: Gemini image generation/editing/annotation,
 * Veo video, captions, brand reviews, posts with guarded status transitions.
 */
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { q, one } from "@/lib/db";
import { runBus } from "@/lib/agent/bridge";
import { generateImage, annotateImage, generateVideo, imageCostUsd, IMAGE_MODEL, IMAGE_MODEL_PRO } from "@/lib/gemini";
import { uploadAsset, downloadAsset } from "@/lib/storage";
import { textResult, errorResult, safe, type ToolCtx } from "@/lib/agent/tools";

const FORMATS = {
  story_9x16: { ratio: "9:16", w: 768, h: 1376 },
  feed_4x5: { ratio: "4:5", w: 896, h: 1120 },
  feed_1x1: { ratio: "1:1", w: 1024, h: 1024 },
  landscape_16x9: { ratio: "16:9", w: 1376, h: 768 },
} as const;
type FormatKey = keyof typeof FORMATS;

function imageBlock(base64: string, mimeType: string) {
  return { type: "image" as const, data: base64, mimeType };
}

async function persistImageAsset(opts: {
  ctx: ToolCtx;
  base64: string;
  mimeType: string;
  format: FormatKey;
  kind: "image";
  prompt: string;
  model: string;
  briefId?: string;
  variantLabel?: string;
  costUsd: number;
  generationMs: number;
  metadata?: Record<string, unknown>;
}) {
  const ext = opts.mimeType.includes("jpeg") ? "jpg" : "png";
  const path = `${opts.ctx.brandId}/${opts.briefId ?? "adhoc"}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { publicUrl } = await uploadAsset(path, Buffer.from(opts.base64, "base64"), opts.mimeType);
  const fmt = FORMATS[opts.format];
  const row = await one<{ id: string }>(
    `insert into assets (brand_id, brief_id, kind, format, variant_label, prompt, model, storage_path, public_url,
        width, height, status, generation_ms, cost_usd, metadata, run_id)
     values ($1,$2,'image',$3,$4,$5,$6,$7,$8,$9,$10,'candidate',$11,$12,$13,$14) returning id`,
    [opts.ctx.brandId, opts.briefId ?? null, opts.format, opts.variantLabel ?? null, opts.prompt, opts.model,
      path, publicUrl, fmt.w, fmt.h, opts.generationMs, opts.costUsd, JSON.stringify(opts.metadata ?? {}), opts.ctx.runId]
  );
  runBus.emit(opts.ctx.runId, "asset", {
    asset_id: row!.id, kind: "image", format: opts.format, variant_label: opts.variantLabel,
    public_url: publicUrl, brief_id: opts.briefId,
  });
  return { assetId: row!.id, publicUrl };
}

export function buildCreativeTools(ctx: ToolCtx) {
  const genImage = tool(
    "generate_image",
    "Generate one social media image with Gemini and save it to the asset gallery. Write prompts like a food photographer (scene, light, lens feel, texture, brand palette). For overlay text put the EXACT words in double quotes in the prompt; otherwise say 'no text'. IMPORTANT: before generating dish imagery, check the brand library for real photos of that dish (db_query: select id, variant_label, prompt from assets where kind='reference') and pass matching ids via reference_asset_ids — Gemini will then match the real plating, bowls and setting. Returns the image so you can inspect it.",
    {
      prompt: z.string().max(4000),
      format: z.enum(["story_9x16", "feed_4x5", "feed_1x1", "landscape_16x9"]),
      variant_label: z.string().max(20).optional().describe('e.g. "A — hero close-up"'),
      brief_id: z.string().uuid().optional(),
      quality: z.enum(["standard", "pro"]).default("standard").describe("pro = gemini-3-pro-image for final/hero assets"),
      reference_asset_ids: z.array(z.string().uuid()).max(4).default([]).describe("existing assets to use as style/edit references"),
    },
    safe(async (a) => {
      const started = Date.now();
      const refImages: { mimeType: string; data: string }[] = [];
      for (const id of a.reference_asset_ids) {
        const asset = await one<{ storage_path: string }>(
          `select storage_path from assets where id=$1 and brand_id=$2 and kind in ('image','reference')`, [id, ctx.brandId]);
        if (asset?.storage_path) {
          const buf = await downloadAsset(asset.storage_path);
          refImages.push({ mimeType: "image/png", data: buf.toString("base64") });
        }
      }
      const model = a.quality === "pro" ? IMAGE_MODEL_PRO : IMAGE_MODEL;
      const img = await generateImage({
        prompt: a.prompt,
        refImages: refImages.length ? refImages : undefined,
        aspectRatio: FORMATS[a.format].ratio,
        imageSize: "1K",
        model,
      });
      const { assetId, publicUrl } = await persistImageAsset({
        ctx, base64: img.base64, mimeType: img.mimeType, format: a.format, kind: "image",
        prompt: a.prompt, model, briefId: a.brief_id, variantLabel: a.variant_label,
        costUsd: imageCostUsd(model, "1K"), generationMs: Date.now() - started,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ ok: true, asset_id: assetId, public_url: publicUrl, format: a.format }) },
          imageBlock(img.base64, img.mimeType),
        ],
      };
    })
  );

  const editImage = tool(
    "edit_image",
    "Edit an existing asset image with a natural-language instruction (Gemini keeps the rest intact). Saves the result as a NEW candidate asset. Use after human feedback like 'warmer light' or 'remove the second plate'.",
    {
      asset_id: z.string().uuid(),
      instruction: z.string().max(2000),
      variant_label: z.string().max(20).optional(),
    },
    safe(async (a) => {
      const asset = await one<{ storage_path: string; format: string; brief_id: string | null; prompt: string }>(
        `select storage_path, format, brief_id, prompt from assets where id=$1 and brand_id=$2 and kind='image'`,
        [a.asset_id, ctx.brandId]);
      if (!asset) return errorResult("asset not found");
      const started = Date.now();
      const buf = await downloadAsset(asset.storage_path);
      const fmt = (asset.format as FormatKey) in FORMATS ? (asset.format as FormatKey) : "feed_4x5";
      const img = await generateImage({
        prompt: `Edit this image: ${a.instruction}. Keep everything else exactly the same — composition, lighting, subject.`,
        refImages: [{ mimeType: "image/png", data: buf.toString("base64") }],
        aspectRatio: FORMATS[fmt].ratio,
        imageSize: "1K",
      });
      const { assetId, publicUrl } = await persistImageAsset({
        ctx, base64: img.base64, mimeType: img.mimeType, format: fmt, kind: "image",
        prompt: `[edit of ${a.asset_id}] ${a.instruction}`, model: IMAGE_MODEL,
        briefId: asset.brief_id ?? undefined, variantLabel: a.variant_label,
        costUsd: imageCostUsd(IMAGE_MODEL, "1K"), generationMs: Date.now() - started,
        metadata: { edited_from: a.asset_id, instruction: a.instruction },
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ ok: true, asset_id: assetId, public_url: publicUrl, edited_from: a.asset_id }) },
          imageBlock(img.base64, img.mimeType),
        ],
      };
    })
  );

  const annotate = tool(
    "annotate_image",
    "Produce a review-markup copy of an asset image: red circles + numbered badges + a bottom panel listing each issue. Use during brand review for flag/reject verdicts so the team sees exactly what to fix. Saves as a new asset and returns its url.",
    {
      asset_id: z.string().uuid(),
      annotations: z.array(z.object({
        issue: z.string().max(200),
        where: z.string().max(120).describe('location in the image, e.g. "top-left logo", "the text overlay"'),
      })).min(1).max(6),
    },
    safe(async (a) => {
      const asset = await one<{ storage_path: string; format: string; brief_id: string | null }>(
        `select storage_path, format, brief_id from assets where id=$1 and brand_id=$2 and kind='image'`,
        [a.asset_id, ctx.brandId]);
      if (!asset) return errorResult("asset not found");
      const started = Date.now();
      const buf = await downloadAsset(asset.storage_path);
      const fmt = (asset.format as FormatKey) in FORMATS ? (asset.format as FormatKey) : "feed_4x5";
      const img = await annotateImage({
        imageBase64: buf.toString("base64"),
        mimeType: "image/png",
        annotations: a.annotations,
        aspectRatio: FORMATS[fmt].ratio,
      });
      const { assetId, publicUrl } = await persistImageAsset({
        ctx, base64: img.base64, mimeType: img.mimeType, format: fmt, kind: "image",
        prompt: `[review annotation of ${a.asset_id}]`, model: IMAGE_MODEL,
        briefId: asset.brief_id ?? undefined, variantLabel: "review-markup",
        costUsd: imageCostUsd(IMAGE_MODEL, "1K"), generationMs: Date.now() - started,
        metadata: { annotates: a.asset_id, annotations: a.annotations },
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ ok: true, annotated_asset_id: assetId, public_url: publicUrl }) },
          imageBlock(img.base64, img.mimeType),
        ],
      };
    })
  );

  const genVideo = tool(
    "generate_video",
    "Generate a short vertical/horizontal video with Veo 3.1 (includes audio). Takes 1–4 minutes — use sparingly (one per brief unless asked). Optionally animate from an existing image asset (seed_asset_id). Describe motion, ambiance and any spoken/sfx audio in the prompt.",
    {
      prompt: z.string().max(1500),
      aspect: z.enum(["9:16", "16:9"]).default("9:16"),
      duration_seconds: z.union([z.literal(4), z.literal(6), z.literal(8)]).default(6),
      brief_id: z.string().uuid().optional(),
      seed_asset_id: z.string().uuid().optional(),
      variant_label: z.string().max(20).optional(),
    },
    safe(async (a) => {
      const started = Date.now();
      let seed: { imageBase64: string; imageMimeType: string } | undefined;
      if (a.seed_asset_id) {
        const asset = await one<{ storage_path: string }>(
          `select storage_path from assets where id=$1 and brand_id=$2 and kind='image'`, [a.seed_asset_id, ctx.brandId]);
        if (asset) {
          const buf = await downloadAsset(asset.storage_path);
          seed = { imageBase64: buf.toString("base64"), imageMimeType: "image/png" };
        }
      }
      runBus.emit(ctx.runId, "status", { note: "Veo render started (1–4 min)…" });
      const video = await generateVideo({
        prompt: a.prompt,
        imageBase64: seed?.imageBase64,
        imageMimeType: seed?.imageMimeType,
        aspectRatio: a.aspect,
        durationSeconds: a.duration_seconds,
        resolution: "720p",
        onProgress: (msg) => runBus.emit(ctx.runId, "status", { note: msg }),
      });
      const path = `${ctx.brandId}/${a.brief_id ?? "adhoc"}/video-${Date.now()}.mp4`;
      const { publicUrl } = await uploadAsset(path, video.buffer, "video/mp4");
      const costUsd = 0.1 * a.duration_seconds; // veo-3.1-fast 720p ≈ $0.10/s
      const row = await one<{ id: string }>(
        `insert into assets (brand_id, brief_id, kind, format, variant_label, prompt, model, storage_path, public_url,
            duration_seconds, status, generation_ms, cost_usd, run_id)
         values ($1,$2,'video',$3,$4,$5,$6,$7,$8,$9,'candidate',$10,$11,$12) returning id`,
        [ctx.brandId, a.brief_id ?? null, a.aspect === "9:16" ? "story_9x16" : "landscape_16x9", a.variant_label ?? null,
          a.prompt, video.model, path, publicUrl, a.duration_seconds, Date.now() - started, costUsd, ctx.runId]);
      runBus.emit(ctx.runId, "asset", {
        asset_id: row!.id, kind: "video", format: a.aspect, public_url: publicUrl, brief_id: a.brief_id,
      });
      return textResult({ ok: true, asset_id: row!.id, public_url: publicUrl, duration_seconds: a.duration_seconds, note: "video saved to gallery" });
    })
  );

  const saveCaption = tool(
    "save_caption",
    "Save a caption variant as an asset (kind=caption) linked to a brief/channel.",
    {
      brief_id: z.string().uuid().optional(),
      channel: z.enum(["instagram_story", "instagram_feed", "facebook"]),
      text: z.string().max(3000),
      hashtags: z.array(z.string()).max(8).default([]),
      variant_label: z.string().max(20).optional(),
    },
    safe(async (a) => {
      const row = await one<{ id: string }>(
        `insert into assets (brand_id, brief_id, kind, format, variant_label, caption_text, status, metadata, run_id)
         values ($1,$2,'caption',$3,$4,$5,'candidate',$6,$7) returning id`,
        [ctx.brandId, a.brief_id ?? null, a.channel, a.variant_label ?? null,
          a.hashtags.length ? `${a.text}\n\n${a.hashtags.join(" ")}` : a.text,
          JSON.stringify({ hashtags: a.hashtags }), ctx.runId]);
      runBus.emit(ctx.runId, "asset", { asset_id: row!.id, kind: "caption", brief_id: a.brief_id, variant_label: a.variant_label });
      return textResult({ ok: true, asset_id: row!.id });
    })
  );

  return [genImage, editImage, annotate, genVideo, saveCaption];
}

// ============================ review & posts ==============================

export function buildReviewTools(ctx: ToolCtx) {
  const saveReview = tool(
    "save_review",
    "Save a brand-consistency review verdict for an asset or post. scores = { voice_tone, visual_style, guideline_compliance, message_accuracy, audience_fit } each { score: 0-100, note }.",
    {
      asset_id: z.string().uuid().optional(),
      post_id: z.string().uuid().optional(),
      verdict: z.enum(["pass", "flag", "reject"]),
      overall_score: z.number().min(0).max(100),
      scores: z.record(z.string(), z.object({ score: z.number().min(0).max(100), note: z.string().max(300) })),
      feedback: z.string().max(3000).describe("Plain-English summary for the team: what passed, what to fix"),
      annotated_asset_id: z.string().uuid().optional().describe("asset id returned by annotate_image, if you marked up issues"),
    },
    safe(async (a) => {
      let annotatedUrl: string | null = null;
      let annotatedPath: string | null = null;
      if (a.annotated_asset_id) {
        const ann = await one<{ public_url: string; storage_path: string }>(
          `select public_url, storage_path from assets where id=$1 and brand_id=$2`, [a.annotated_asset_id, ctx.brandId]);
        annotatedUrl = ann?.public_url ?? null;
        annotatedPath = ann?.storage_path ?? null;
      }
      const row = await one<{ id: string }>(
        `insert into reviews (brand_id, post_id, asset_id, verdict, overall_score, scores, feedback, annotated_image_path, annotated_image_url, run_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [ctx.brandId, a.post_id ?? null, a.asset_id ?? null, a.verdict, a.overall_score,
          JSON.stringify(a.scores), a.feedback, annotatedPath, annotatedUrl, ctx.runId]);
      if (a.post_id) {
        await q(`update posts set review_id=$1, status = case when $2='reject' then 'changes_requested' else status end, updated_at=now() where id=$3 and brand_id=$4`,
          [row!.id, a.verdict, a.post_id, ctx.brandId]);
      }
      runBus.emit(ctx.runId, "status", { note: `review saved: ${a.verdict} (${a.overall_score}/100)`, review_id: row!.id, verdict: a.verdict });
      return textResult({ ok: true, review_id: row!.id });
    })
  );

  const savePost = tool(
    "save_post",
    "Assemble a draft post (caption + selected assets) for a channel. Starts as draft; move it with update_post.",
    {
      brief_id: z.string().uuid().optional(),
      channel: z.enum(["instagram_story", "instagram_feed", "facebook"]),
      caption: z.string().max(3000),
      hashtags: z.array(z.string()).max(8).default([]),
      asset_ids: z.array(z.string().uuid()).min(1).max(6),
    },
    safe(async (a) => {
      const row = await one<{ id: string }>(
        `insert into posts (brand_id, brief_id, channel, caption, hashtags, asset_ids, run_id)
         values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [ctx.brandId, a.brief_id ?? null, a.channel, a.caption, a.hashtags, a.asset_ids, ctx.runId]);
      runBus.emit(ctx.runId, "status", { note: `draft post created (${a.channel})`, post_id: row!.id });
      return textResult({ ok: true, post_id: row!.id });
    })
  );

  const updatePost = tool(
    "update_post",
    "Update a post. Moving status to approved/scheduled/published REQUIRES approval_id (an approved request_approval for that post). draft/in_review/changes_requested transitions are free.",
    {
      id: z.string().uuid(),
      status: z.enum(["draft", "in_review", "changes_requested", "approved", "scheduled", "published"]).optional(),
      caption: z.string().max(3000).optional(),
      hashtags: z.array(z.string()).max(8).optional(),
      asset_ids: z.array(z.string().uuid()).optional(),
      scheduled_at: z.string().datetime({ offset: true }).optional(),
      approval_id: z.string().uuid().optional(),
    },
    safe(async (a) => {
      const post = await one<{ id: string; status: string }>(
        `select id, status from posts where id=$1 and brand_id=$2`, [a.id, ctx.brandId]);
      if (!post) return errorResult("post not found");
      const gated = ["approved", "scheduled", "published"];
      if (a.status && gated.includes(a.status)) {
        if (!a.approval_id) return errorResult(`status=${a.status} requires approval_id from an approved request_approval`);
        const approval = await one<{ status: string; subject_id: string | null }>(
          `select status, subject_id from approvals where id=$1 and brand_id=$2`, [a.approval_id, ctx.brandId]);
        if (!approval || approval.status !== "approved") {
          return errorResult(`approval ${a.approval_id} is ${approval?.status ?? "missing"} — cannot move post to ${a.status}`);
        }
      }
      const cols: string[] = ["updated_at = now()"];
      const params: unknown[] = [a.id, ctx.brandId];
      const patch: Record<string, unknown> = {
        status: a.status, caption: a.caption, hashtags: a.hashtags, asset_ids: a.asset_ids,
        scheduled_at: a.scheduled_at, published_at: a.status === "published" ? new Date().toISOString() : undefined,
      };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        params.push(v);
        cols.push(`${k} = $${params.length}`);
      }
      await q(`update posts set ${cols.join(", ")} where id=$1 and brand_id=$2`, params);
      runBus.emit(ctx.runId, "status", { note: `post ${a.id.slice(0, 8)} → ${a.status ?? "updated"}`, post_id: a.id, status: a.status });
      return textResult({ ok: true, post_id: a.id, status: a.status ?? post.status });
    })
  );

  return [saveReview, savePost, updatePost];
}
