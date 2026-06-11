import { getRunDaily, getRuns, getRunTotals } from "@/lib/queries";
import { q } from "@/lib/db";
import { RunsView, type RunRow } from "./view";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const [runs, totals, daily] = await Promise.all([getRuns(40), getRunTotals(), getRunDaily(14)]);

  // getRuns doesn't select the mission prompt — fetch it alongside so the
  // expanded audit view can show the full task each run was given.
  let prompts = new Map<string, string | null>();
  if (runs.length > 0) {
    const rows = await q<{ id: string; prompt: string | null }>(
      `select id, prompt from agent_runs where id = any($1::uuid[])`,
      [runs.map((r) => r.id)]
    ).catch(() => [] as { id: string; prompt: string | null }[]);
    prompts = new Map(rows.map((r) => [r.id, r.prompt]));
  }

  const rows: RunRow[] = runs.map((r) => ({ ...r, prompt: prompts.get(r.id) ?? null }));
  return <RunsView runs={rows} totals={totals} daily={daily} />;
}
