/**
 * POST /api/ingest — demo connector sync: lands a few fresh, unanalysed
 * social items (as a real connector poll would) so the listening agent
 * always has new work during demos.
 */
import { NextResponse } from "next/server";
import { q, one } from "@/lib/db";
import { getActiveBrand, getLocations } from "@/lib/brand";

export const runtime = "nodejs";

const FRESH: Array<{
  loc: number; source: string; kind: string; author: string; handle?: string;
  rating?: number; text: string;
}> = [
  { loc: 0, source: "instagram", kind: "comment", author: "Nina R", handle: "@nina.eats", text: "Walked past and the smell alone deserves a Michelin star. Coming back Friday with the girls" },
  { loc: 1, source: "google_reviews", kind: "review", author: "Paul Stevens", rating: 4, text: "Gnocchi was sensational, service warm. Docking a star because our entrees arrived after the mains. Small thing, will return." },
  { loc: 2, source: "instagram", kind: "mention", author: "Coastal Bites", handle: "@coastalbites", text: "The truffle gnocchi at @marlowandsage Burleigh might be the dish of the winter on the coast. Get it while the menu lasts" },
  { loc: 0, source: "facebook", kind: "comment", author: "Diane Walker", text: "Do you do anything for kids? Bringing the family Sunday — high chairs? kids menu?" },
  { loc: 1, source: "google_reviews", kind: "review", author: "Marcus Lee", rating: 5, text: "Negroni on tap remains the best idea any Melbourne bar has had. Kingfish crudo as good as ever. Staff superb." },
  { loc: 2, source: "google_reviews", kind: "review", author: "Helen Carey", rating: 3, text: "Lovely food but we sat 20 minutes before anyone took a drinks order on Saturday brunch. Terrace was packed, staff run off their feet." },
];

export async function POST() {
  const brand = await getActiveBrand();
  const locations = await getLocations(brand.id);
  const batch = FRESH.sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 3));
  let inserted = 0;
  for (const item of batch) {
    const row = await one(
      `insert into social_items (brand_id, location_id, source, kind, external_id, author_name, author_handle, rating, text, posted_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() - (random() * interval '40 minutes'))
       on conflict do nothing returning id`,
      [brand.id, locations[item.loc]?.id ?? null, item.source, item.kind,
        `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        item.author, item.handle ?? null, item.rating ?? null, item.text]
    );
    if (row) inserted++;
  }
  await q(`update connections set last_synced_at = now() where brand_id=$1 and provider in ('google_reviews','facebook','instagram')`, [brand.id]);
  return NextResponse.json({ ok: true, inserted });
}
