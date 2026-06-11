import { config } from "dotenv";
import path from "node:path";
config({ path: path.join(__dirname, "..", ".env.local") });

async function main() {
  const { startAgentRun } = await import("../src/lib/agent/run");
  const { runBus } = await import("../src/lib/agent/bridge");

  const { runId } = await startAgentRun({
    workflow: "copilot",
    prompt:
      "Quick check-in: 1) call knowledge_list, 2) db_query the count of social_items grouped by sentiment, 3) push_block a metric block (scope chat) with total mentions. Then summarise in 2 lines. Keep it fast.",
    trigger: "manual",
  });
  console.log("runId:", runId);

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => { console.log("TIMEOUT after 240s"); resolve(); }, 240_000);
    runBus.subscribe(runId, (e) => {
      if (e.type === "text") process.stdout.write((e.payload.text as string) ?? "");
      else if (e.type === "thinking") { /* quiet */ }
      else console.log(`\n[${e.type}]`, JSON.stringify(e.payload).slice(0, 220));
      if (e.type === "done") { clearTimeout(timeout); resolve(); }
    });
  });
  process.exit(0);
}

main().catch((e) => { console.error("SMOKE FAILED:", e); process.exit(1); });
