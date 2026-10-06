import type { Metadata } from "next";
import { UnavailableState } from "@/components/state-notice";
import { StatusView } from "@/components/status/status-view";

const MAX_U64 = (1n << 64n) - 1n;

/** A route parameter is untrusted. Only a plain decimal that fits a u64 is an SLA ID. */
function parseSlaId(value: string): bigint | null {
  if (!/^\d{1,20}$/.test(value)) return null;
  const id = BigInt(value);
  return id <= MAX_U64 ? id : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/status/[slaId]">): Promise<Metadata> {
  const { slaId } = await params;
  const id = parseSlaId(slaId);
  if (id === null) return { title: "Invalid SLA ID | SLASettle" };
  return {
    title: `SLA #${id} | SLASettle`,
    description: `Public status for SLA #${id}: bond, watcher check-ins, quorum, and settlement history.`,
  };
}

export default async function StatusPage({ params }: PageProps<"/status/[slaId]">) {
  const { slaId } = await params;
  const id = parseSlaId(slaId);

  if (id === null) {
    return (
      <div className="py-8">
        <UnavailableState
          tone="error"
          title="Not a valid SLA ID"
          message="SLA IDs are whole numbers from 0 up to 18446744073709551615."
        />
      </div>
    );
  }

  return <StatusView slaId={id} />;
}
