import { getKnowledgeFiles } from "@/lib/queries";
import { KnowledgeView } from "./view";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const files = await getKnowledgeFiles();
  return <KnowledgeView files={files} />;
}
