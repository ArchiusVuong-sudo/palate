/** GET /api/search?q= — global search for the command palette. */
import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getActiveBrand } from "@/lib/brand";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const query = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json({ social: [], briefs: [], assets: [], knowledge: [] });
  const brand = await getActiveBrand();
  const like = `%${query}%`;

  const [social, briefs, assets, knowledge] = await Promise.all([
    q<{ id: string; author_name: string; source: string; snippet: string; sentiment: string | null }>(
      `select id, author_name, source, left(text, 90) as snippet, sentiment
       from social_items where brand_id=$1 and (text ilike $2 or author_name ilike $2)
       order by posted_at desc limit 4`,
      [brand.id, like]
    ),
    q<{ id: string; title: string; for_date: string; status: string }>(
      `select id, title, for_date, status from briefs
       where brand_id=$1 and title ilike $2 order by for_date desc limit 3`,
      [brand.id, like]
    ),
    q<{ id: string; kind: string; variant_label: string | null; format: string | null; public_url: string | null; snippet: string | null }>(
      `select id, kind, variant_label, format, public_url, left(coalesce(caption_text, prompt), 80) as snippet
       from assets where brand_id=$1 and (caption_text ilike $2 or prompt ilike $2 or variant_label ilike $2)
       order by created_at desc limit 4`,
      [brand.id, like]
    ),
    q<{ path: string; title: string | null }>(
      `select path, title from knowledge_files
       where brand_id=$1 and (path ilike $2 or title ilike $2 or content ilike $2)
       order by path limit 3`,
      [brand.id, like]
    ),
  ]);

  return NextResponse.json({ social, briefs, assets, knowledge });
}
