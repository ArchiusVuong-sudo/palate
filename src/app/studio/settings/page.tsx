import { getConnections } from "@/lib/queries";
import { getActiveBrand } from "@/lib/brand";
import { SettingsView } from "./view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [brand, connections] = await Promise.all([getActiveBrand(), getConnections()]);
  return <SettingsView brand={brand} connections={connections} />;
}
