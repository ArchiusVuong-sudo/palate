/**
 * POST /api/uploads — upload a reference product photo (multipart form:
 * file, dish_name, notes?). Stored in the brand library; the creative agent
 * passes these to Gemini so generated content matches the real dishes.
 */
import { NextResponse } from "next/server";
import { one } from "@/lib/db";
import { getActiveBrand } from "@/lib/brand";
import { uploadAsset } from "@/lib/storage";

export const runtime = "nodejs";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart form required" }, { status: 400 });
  const file = form.get("file") as File | null;
  const dishName = String(form.get("dish_name") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();

  if (!file || typeof file === "string") return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "png/jpeg/webp only" }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: "max 15MB" }, { status: 400 });
  if (!dishName) return NextResponse.json({ error: "dish_name required" }, { status: 400 });

  const brand = await getActiveBrand();
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${brand.id}/library/${Date.now()}-${dishName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${ext}`;
  const { publicUrl } = await uploadAsset(path, buffer, file.type);

  const row = await one<{ id: string }>(
    `insert into assets (brand_id, kind, format, variant_label, prompt, storage_path, public_url, status, metadata)
     values ($1,'reference','library',$2,$3,$4,$5,'selected',$6) returning id`,
    [brand.id, dishName, notes || `Reference photo of ${dishName}`, path, publicUrl,
      JSON.stringify({ original_name: file.name, bytes: file.size })]
  );
  return NextResponse.json({ ok: true, asset_id: row!.id, public_url: publicUrl });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const brand = await getActiveBrand();
  await one(`delete from assets where id=$1 and brand_id=$2 and kind='reference' returning id`, [id, brand.id]);
  return NextResponse.json({ ok: true });
}
