import {
  getCanvasBlocks, getInsights, getLocationPulse, getMentionHeatmap, getSentimentTrend, getSocialItems,
} from "@/lib/queries";
import { ListeningView } from "./view";

export const dynamic = "force-dynamic";

export default async function ListeningPage() {
  const [items, insights, blocks, trend, heatmap, pulse] = await Promise.all([
    getSocialItems({ limit: 200 }),
    getInsights(12),
    getCanvasBlocks("listening", 12),
    getSentimentTrend(14),
    getMentionHeatmap(84),
    getLocationPulse(14),
  ]);

  return (
    <ListeningView items={items} insights={insights} blocks={blocks} trend={trend} heatmap={heatmap} pulse={pulse} />
  );
}
