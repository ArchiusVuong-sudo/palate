import { getConnections } from "@/lib/queries";
import { getActiveBrand } from "@/lib/brand";
import { one } from "@/lib/db";
import { SettingsView, type AutopilotSettings } from "./view";

export const dynamic = "force-dynamic";

/** Missing row = autopilot enabled (matches the cron's backwards-compat default). */
async function getAutopilot(): Promise<AutopilotSettings> {
  const row = await one<{ value: Partial<AutopilotSettings> | null }>(
    `select value from app_settings where key = 'autopilot'`
  );
  const v = row?.value ?? {};
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : true,
    hour: typeof v.hour === "number" ? v.hour : 7,
  };
}

export default async function SettingsPage() {
  const [brand, connections, autopilot] = await Promise.all([
    getActiveBrand(),
    getConnections(),
    getAutopilot(),
  ]);
  return <SettingsView brand={brand} connections={connections} autopilot={autopilot} />;
}
