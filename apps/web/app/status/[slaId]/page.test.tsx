import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/status/status-view", () => ({
  StatusView: ({ slaId }: { slaId: bigint }) => <div>status view for {slaId.toString()}</div>,
}));

import StatusPage from "./page";

async function renderFor(slaId: string) {
  const ui = await StatusPage({ params: Promise.resolve({ slaId }) } as never);
  return render(ui);
}

describe("status route", () => {
  it("renders the status view for a valid id, including the u64 maximum", async () => {
    await renderFor("42");
    expect(screen.getByText("status view for 42")).toBeInTheDocument();
  });

  it("keeps full precision for ids beyond Number.MAX_SAFE_INTEGER", async () => {
    await renderFor("18446744073709551615");
    expect(screen.getByText("status view for 18446744073709551615")).toBeInTheDocument();
  });

  it.each(["abc", "-1", "1.5", "1e3", "18446744073709551616", "%3Cscript%3E", ""])(
    "rejects %j without rendering the status view or reflecting it",
    async (slaId) => {
      await renderFor(slaId);
      expect(screen.getByRole("alert")).toHaveTextContent("Not a valid SLA ID");
      expect(screen.queryByText(/status view for/)).not.toBeInTheDocument();
      expect(document.body.innerHTML).not.toContain("<script");
    },
  );
});
