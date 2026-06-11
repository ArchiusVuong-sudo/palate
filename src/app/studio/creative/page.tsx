import { getAssets, getBriefs, getCanvasBlocks } from "@/lib/queries";
import { CreativeView } from "./view";

export const dynamic = "force-dynamic";

export default async function CreativePage() {
  const [briefs, assets, blocks] = await Promise.all([
    getBriefs(10),
    getAssets({ limit: 120 }),
    getCanvasBlocks("creative", 6),
  ]);
  return <CreativeView briefs={briefs} assets={assets} blocks={blocks} />;
}
