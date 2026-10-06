import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmAction } from "./confirm-action";

function setup(props: Partial<Parameters<typeof ConfirmAction>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <ConfirmAction
      label="Cancel SLA"
      title="Cancel SLA 4?"
      confirmLabel="Cancel this SLA"
      cancelLabel="Keep SLA"
      onConfirm={onConfirm}
      {...props}
    >
      <p>Cancelling does not move any funds.</p>
    </ConfirmAction>,
  );
  return { onConfirm, user: userEvent.setup() };
}

describe("ConfirmAction", () => {
  it("shows an explanation and sends nothing until the user confirms", async () => {
    const { onConfirm, user } = setup();
    expect(screen.queryByText("Cancelling does not move any funds.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel SLA" }));
    expect(screen.getByRole("group", { name: "Cancel SLA 4?" })).toBeInTheDocument();
    expect(screen.getByText("Cancelling does not move any funds.")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel this SLA" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("closes without side effects from the cancel button and returns focus to the trigger", async () => {
    const { onConfirm, user } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel SLA" }));
    await user.click(screen.getByRole("button", { name: "Keep SLA" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel SLA" })).toHaveFocus();
  });

  it("closes on Escape from the keyboard", async () => {
    const { onConfirm, user } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel SLA" }));
    expect(screen.getByRole("group")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cannot be opened while disabled", async () => {
    const { user } = setup({ disabled: true });
    await user.click(screen.getByRole("button", { name: "Cancel SLA" }));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
