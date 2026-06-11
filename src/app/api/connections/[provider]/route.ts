/** POST /api/connections/[provider] — update a connection's status/config. */
import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getActiveBrand } from "@/lib/brand";

export const runtime = "nodejs";
const PROVIDERS = ["google_reviews", "facebook", "instagram", "gmail"];

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!PROVIDERS.includes(provider)) return NextResponse.json({ error: "bad provider" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const brand = await getActiveBrand();
  await q(
    `insert into connections (brand_id, provider, status, config)
     values ($1,$2,$3,$4)
     on conflict (brand_id, provider) do update
       set status = coalesce($3, connections.status),
           config = connections.config || $4::jsonb`,
    [brand.id, provider, body.status ?? null, JSON.stringify(body.config ?? {})]
  );
  return NextResponse.json({ ok: true });
}
