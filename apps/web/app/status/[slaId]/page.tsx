import type { Metadata } from "next";
import { StatusView } from "@/components/status/status-view";

export async function generateMetadata({
  params,
}: PageProps<"/status/[slaId]">): Promise<Metadata> {
  const { slaId } = await params;
  return {
    title: `SLA #${slaId} — SLASettle`,
    description: `Public status for SLA #${slaId}: bond, watcher check-ins, quorum, and settlement history.`,
  };
}

export default async function StatusPage({ params }: PageProps<"/status/[slaId]">) {
  const { slaId } = await params;

  if (!/^\d+$/.test(slaId)) {
    return (
      <p role="alert" className="py-12 text-sm text-[var(--color-status-down)]">
        &quot;{slaId}&quot; is not a valid SLA ID. SLA IDs are non-negative whole numbers.
      </p>
    );
  }

  return <StatusView slaId={BigInt(slaId)} />;
}
