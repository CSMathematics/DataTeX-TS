import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoicheiaErrorBoundary } from "./StoicheiaErrorBoundary";

describe("Stoicheia error boundary", () => {
  it("isolates a render failure and supports retry or back", () => {
    const onBack = vi.fn();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;
    const Workbench = () => {
      if (shouldThrow) throw new Error("render failed");
      return <div>Recovered workbench</div>;
    };

    render(
      <StoicheiaErrorBoundary onBack={onBack}>
        <Workbench />
      </StoicheiaErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("render failed");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Recovered workbench")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
