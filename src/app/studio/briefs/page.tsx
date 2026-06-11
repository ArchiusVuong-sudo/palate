import { getBriefs, getCanvasBlocks, getInsights } from "@/lib/queries";
import { BriefsView } from "./view";

export const dynamic = "force-dynamic";

export default async function BriefsPage() {
  const [briefs, insights, blocks] = await Promise.all([
    getBriefs(20),
    getInsights(6),
    getCanvasBlocks("briefing", 8),
  ]);
  return <BriefsView briefs={briefs} insights={insights} blocks={blocks} />;
}
