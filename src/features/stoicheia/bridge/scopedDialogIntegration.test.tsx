import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AngleValueDialog } from "../components/AngleValueDialog";
import { StoicheiaPackageStudioAdapter } from "./StoicheiaPackageStudioAdapter";

vi.mock("../App", () => ({
  default: () => <div data-testid="embedded-workbench" />,
}));

const adapterProps = {
  theme: "dark" as const,
  language: "en" as const,
  latexCompiler: "lualatex" as const,
  latexEnginePaths: {
    lualatex: "lualatex",
    pdflatex: "pdflatex",
    xelatex: "xelatex",
  },
  onBack: vi.fn(),
};

const dialogProps = {
  pointNames: ["A", "B", "C"],
  onCancel: vi.fn(),
  onCalculate: vi.fn(),
  onGet: vi.fn(),
};

describe("scoped dialog integration", () => {
  it("mounts a real copied dialog in the scoped host and restores focus", async () => {
    const view = render(
      <>
        <button type="button">Open angle dialog</button>
        <StoicheiaPackageStudioAdapter {...adapterProps} />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Open angle dialog" });
    trigger.focus();

    view.rerender(
      <>
        <button type="button">Open angle dialog</button>
        <StoicheiaPackageStudioAdapter {...adapterProps} />
        <AngleValueDialog tool="angle" {...dialogProps} />
      </>,
    );

    const dialog = await screen.findByRole("dialog");
    const portal = document.querySelector(".stoicheia-portal-root");
    expect(portal).toContainElement(dialog);
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    view.rerender(
      <>
        <button type="button">Open angle dialog</button>
        <StoicheiaPackageStudioAdapter {...adapterProps} />
        <AngleValueDialog tool={null} {...dialogProps} />
      </>,
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
