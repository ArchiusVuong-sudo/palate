/**
 * GET/PUT /api/settings — app-level settings stored in app_settings (key/jsonb).
 * Currently: autopilot {enabled, hour} for the daily cron pipeline.
 * A missing row means autopilot is ON (backwards compatible with the cron).
 */
import { NextResponse } from "next/server";
import { one, q } from "@/lib/db";

export const runtime = "nodejs";

type Autopilot = { enabled: boolean; hour: number };
const DEFAULT_AUTOPILOT: Autopilot = { enabled: true, hour: 7 };

function normaliseAutopilot(value: unknown): Autopilot {
  const v = (value ?? {}) as Partial<Autopilot>;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_AUTOPILOT.enabled,
    hour: typeof v.hour === "number" ? v.hour : DEFAULT_AUTOPILOT.hour,
  };
}

export async function GET() {
  const row = await one<{ value: unknown }>(
    `select value from app_settings where key = 'autopilot'`
  );
  return NextResponse.json({ settings: { autopilot: normaliseAutopilot(row?.value) } });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ap = (body as { autopilot?: Partial<Autopilot> }).autopilot;
  if (!ap || typeof ap.enabled !== "boolean" || typeof ap.hour !== "number" || !Number.isFinite(ap.hour)) {
    return NextResponse.json(
      { error: "expected {autopilot: {enabled: boolean, hour: number}}" },
      { status: 400 }
    );
  }
  const value: Autopilot = { enabled: ap.enabled, hour: Math.round(ap.hour) };
  await q(
    `insert into app_settings (key, value, updated_at)
     values ('autopilot', $1::jsonb, now())
     on conflict (key) do update
       set value = $1::jsonb, updated_at = now()`,
    [JSON.stringify(value)]
  );
  return NextResponse.json({ ok: true, settings: { autopilot: value } });
}
