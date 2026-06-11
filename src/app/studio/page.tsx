import {
  getAssets,
  getCanvasBlocks,
  getInsights,
  getOverviewStats,
  getProposedActions,
  getRecentAgentEvents,
  getRuns,
  getSentimentTrend,
  getSourceBreakdown,
  getTopTopics,
  getTrendingDishes,
} from "@/lib/queries";
import { OverviewView } from "./view";

export const dynamic = "force-dynamic";

export default async function StudioOverviewPage() {
  const [stats, trend, topics, dishes, sources, insights, actions, blocks, runs, assets, agentEvents] = await Promise.all([
    getOverviewStats(),
    getSentimentTrend(14),
    getTopTopics(14, 7),
    getTrendingDishes(7, 6),
    getSourceBreakdown(14),
    getInsights(8),
    getProposedActions("proposed"),
    getCanvasBlocks("dashboard", 12),
    getRuns(5),
    getAssets({ limit: 12 }),
    getRecentAgentEvents(28),
  ]);

  return (
    <OverviewView
      stats={stats}
      trend={trend}
      topics={topics}
      dishes={dishes}
      sources={sources}
      insights={insights}
      actions={actions}
      blocks={blocks}
      runs={runs}
      assets={assets}
      agentEvents={agentEvents}
    />
  );
}
