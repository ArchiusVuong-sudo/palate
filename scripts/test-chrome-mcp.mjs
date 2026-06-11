// Minimal repro: does query() connect an external stdio MCP server?
import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "node:path";

const bin = path.join(process.cwd(), "node_modules", ".bin", "chrome-devtools-mcp");

const stream = query({
  prompt: "Call mcp__chrome__list_pages once and report exactly what it returns. If the tool is unavailable, say TOOL-MISSING.",
  options: {
    model: "claude-sonnet-4-6",
    mcpServers: { chrome: { type: "stdio", command: bin, args: [] } },
    allowedTools: ["mcp__chrome__list_pages", "mcp__chrome__new_page", "mcp__chrome__take_snapshot"],
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns: 4,
    settingSources: [],
    env: { ...process.env, DISABLE_AUTOUPDATER: "1" },
    stderr: (d) => console.error("[stderr]", d.slice(0, 300)),
  },
});

for await (const m of stream) {
  if (m.type === "system" && m.subtype === "init") {
    console.log("INIT mcp_servers:", JSON.stringify(m.mcp_servers));
    console.log("INIT tools containing chrome:", (m.tools ?? []).filter((t) => t.includes("chrome")));
  } else if (m.type === "assistant") {
    for (const b of m.message.content) {
      if (b.type === "text") console.log("TEXT:", b.text.slice(0, 300));
      if (b.type === "tool_use") console.log("TOOL_USE:", b.name);
    }
  } else if (m.type === "result") {
    console.log("RESULT:", m.subtype, "| cost:", m.total_cost_usd);
  }
}
