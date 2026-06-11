import { getApprovals, getAssets, getCanvasBlocks, getPosts, getReviews } from "@/lib/queries";
import { ReviewView } from "./view";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [posts, reviews, assets, approvals, blocks] = await Promise.all([
    getPosts(30),
    getReviews(30),
    getAssets({ limit: 100 }),
    getApprovals(),
    getCanvasBlocks("review", 6),
  ]);
  return <ReviewView posts={posts} reviews={reviews} assets={assets} approvals={approvals} blocks={blocks} />;
}
