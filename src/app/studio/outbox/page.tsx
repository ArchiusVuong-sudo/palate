import { getOutbox } from "@/lib/queries";
import { OutboxView } from "./view";

export const dynamic = "force-dynamic";

export default async function OutboxPage() {
  const emails = await getOutbox(30);
  return <OutboxView emails={emails} />;
}
