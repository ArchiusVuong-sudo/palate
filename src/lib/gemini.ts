/**
 * Gemini wrapper — image generation/editing/annotation (Nano Banana 2 family),
 * Veo video generation, and fast text analysis.
 *
 * Models (June 2026):
 *  - gemini-3.1-flash-image  : default image model (512/1K/2K/4K, 14 ratios, thinkingLevel)
 *  - gemini-3-pro-image      : pro-grade image model
 *  - gemini-3.5-flash        : text/vision understanding
 *  - veo-3.1-fast-generate-preview : video (with audio)
 */
import { GoogleGenAI } from "@google/genai";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

declare global {
  // eslint-disable-next-line no-var
  var __palateGenAI: GoogleGenAI | undefined;
}

export function genai(): GoogleGenAI {
  if (global.__palateGenAI) return global.__palateGenAI;
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  global.__palateGenAI = client;
  return client;
}

export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
export const IMAGE_MODEL_PRO = process.env.GEMINI_IMAGE_MODEL_PRO || "gemini-3-pro-image";
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
export const VEO_MODEL = process.env.VEO_MODEL || "veo-3.1-fast-generate-preview";

export type GeneratedImage = {
  base64: string;
  mimeType: string;
  text?: string;
  model: string;
};

type ImagePart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** Approximate output cost per image (USD) for run cost tracking. */
export function imageCostUsd(model: string, imageSize: string): number {
  if (model.includes("3-pro-image")) return imageSize === "4K" ? 0.24 : 0.134;
  if (model.includes("3.1-flash-image")) {
    if (imageSize === "4K") return 0.151;
    if (imageSize === "2K") return 0.101;
    if (imageSize === "512") return 0.045;
    return 0.067;
  }
  return 0.039;
}

/**
 * Generate (or edit/compose) an image. Pass `refImages` (base64 PNG/JPEG) for
 * editing, style reference, or multi-image composition (logo + reference shots).
 */
export async function generateImage(opts: {
  prompt: string;
  refImages?: { mimeType: string; data: string }[];
  aspectRatio?: string; // "1:1" | "4:5" | "9:16" | "16:9" | ...
  imageSize?: "512" | "1K" | "2K" | "4K";
  model?: string;
  thinking?: "minimal" | "high";
}): Promise<GeneratedImage> {
  const model = opts.model || IMAGE_MODEL;
  const parts: ImagePart[] = [];
  for (const img of opts.refImages ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  parts.push({ text: opts.prompt });

  const config: Record<string, unknown> = {
    responseModalities: ["TEXT", "IMAGE"],
    imageConfig: {
      aspectRatio: opts.aspectRatio ?? "4:5",
      ...(model.includes("2.5") ? {} : { imageSize: opts.imageSize ?? "1K" }),
    },
  };
  if (opts.thinking && model.includes("3.1-flash-image")) {
    config.thinkingConfig = { thinkingLevel: opts.thinking === "high" ? "High" : "Minimal" };
  }

  const response = await genai().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config,
  });

  let text = "";
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    const p = part as { thought?: boolean; text?: string; inlineData?: { mimeType?: string; data?: string } };
    if (p.thought) continue;
    if (p.text) text += p.text;
    if (p.inlineData?.data) {
      return {
        base64: p.inlineData.data,
        mimeType: p.inlineData.mimeType || "image/png",
        text: text || undefined,
        model,
      };
    }
  }
  throw new Error(
    `Gemini returned no image (model=${model}). Text: ${text.slice(0, 300) || "(none)"}`
  );
}

/**
 * Annotate an image with visual markup (circles, arrows, labels) calling out
 * issues — used by the brand-review agent to point at problems on a visual.
 */
export async function annotateImage(opts: {
  imageBase64: string;
  mimeType: string;
  annotations: { issue: string; where: string }[];
  aspectRatio?: string;
}): Promise<GeneratedImage> {
  const list = opts.annotations
    .map((a, i) => `${i + 1}. At ${a.where}: ${a.issue}`)
    .join("\n");
  return generateImage({
    prompt:
      `You are a brand reviewer marking up a social media visual. Reproduce this exact image, unchanged, ` +
      `but overlay clean review annotations: for each issue below, draw a thin red circle or rounded rectangle around the relevant area ` +
      `with a small numbered red badge, and render a neat semi-transparent white annotation panel along the bottom edge listing each number with its issue in small dark red text. ` +
      `Keep the original image fully recognisable underneath. Issues:\n${list}`,
    refImages: [{ mimeType: opts.mimeType, data: opts.imageBase64 }],
    aspectRatio: opts.aspectRatio ?? "4:5",
    imageSize: "1K",
  });
}

export type GeneratedVideo = {
  buffer: Buffer;
  mimeType: string;
  durationSeconds: number;
  model: string;
};

/** Generate a short video with Veo (audio included). Optionally seed with an image. */
export async function generateVideo(opts: {
  prompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  aspectRatio?: "16:9" | "9:16";
  durationSeconds?: 4 | 6 | 8;
  resolution?: "720p" | "1080p";
  negativePrompt?: string;
  onProgress?: (msg: string) => void;
}): Promise<GeneratedVideo> {
  const ai = genai();
  const duration = opts.durationSeconds ?? 6;
  let operation = await ai.models.generateVideos({
    model: VEO_MODEL,
    prompt: opts.prompt,
    ...(opts.imageBase64
      ? { image: { imageBytes: opts.imageBase64, mimeType: opts.imageMimeType || "image/png" } }
      : {}),
    config: {
      aspectRatio: opts.aspectRatio ?? "9:16",
      resolution: opts.resolution ?? "720p",
      durationSeconds: duration,
      ...(opts.negativePrompt ? { negativePrompt: opts.negativePrompt } : {}),
      numberOfVideos: 1,
    },
  });

  const startedAt = Date.now();
  while (!operation.done) {
    if (Date.now() - startedAt > 8 * 60 * 1000) {
      throw new Error("Veo generation timed out after 8 minutes");
    }
    opts.onProgress?.(`Veo rendering… ${Math.round((Date.now() - startedAt) / 1000)}s`);
    await new Promise((r) => setTimeout(r, 10_000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) throw new Error("Veo returned no video (possibly safety-filtered)");

  const tmp = join(tmpdir(), `veo-${randomUUID()}.mp4`);
  await ai.files.download({ file: video, downloadPath: tmp });
  const buffer = readFileSync(tmp);
  try { unlinkSync(tmp); } catch { /* ignore */ }
  return { buffer, mimeType: "video/mp4", durationSeconds: duration, model: VEO_MODEL };
}

/** Fast, cheap structured analysis with gemini-3.5-flash. Returns parsed JSON. */
export async function analyzeJson<T>(opts: {
  prompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  schema?: Record<string, unknown>;
}): Promise<T> {
  const parts: ImagePart[] = [];
  if (opts.imageBase64) {
    parts.push({ inlineData: { mimeType: opts.imageMimeType || "image/png", data: opts.imageBase64 } });
  }
  parts.push({ text: opts.prompt });
  const response = await genai().models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      ...(opts.schema ? { responseSchema: opts.schema } : {}),
    },
  });
  const text = response.text ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }
}

export function dataUrlToParts(dataUrlOrBase64: string): { mimeType: string; data: string } {
  const m = dataUrlOrBase64.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/png", data: dataUrlOrBase64 };
}
