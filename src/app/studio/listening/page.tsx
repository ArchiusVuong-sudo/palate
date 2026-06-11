import { getCanvasBlocks, getInsights, getSentimentTrend, getSocialItems } from "@/lib/queries";
import { ListeningView } from "./view";

export const dynamic = "force-dynamic";

export default async function ListeningPage() {
  const [items, insights, blocks, trend] = await Promise.all([
    getSocialItems({ limit: 200 }),
    getInsights(12),
    getCanvasBlocks("listening", 12),
    getSentimentTrend(14),
  ]);

  return <ListeningView items={items} insights={insights} blocks={blocks} trend={trend} />;
}
