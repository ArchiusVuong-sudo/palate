import { StudioShell } from "@/components/studio/shell";
import { getPendingCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const counts = await getPendingCounts().catch(() => ({ approvals: "0", actions: "0", unanalyzed: "0" }));
  return (
    <StudioShell
      badges={{
        approvals: Number(counts.approvals),
        actions: Number(counts.actions),
        unanalyzed: Number(counts.unanalyzed),
      }}
    >
      {children}
    </StudioShell>
  );
}
