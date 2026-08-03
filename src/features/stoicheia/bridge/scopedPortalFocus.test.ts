import { fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { installScopedPortalFocusManagement } from "./scopedPortalFocus";

describe("scoped portal focus management", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("focuses a dialog, traps Tab, and restores the trigger", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();

    const host = document.createElement("div");
    document.body.appendChild(host);
    const cleanup = installScopedPortalFocusManagement(host);

    const dialog = document.createElement("section");
    dialog.setAttribute("role", "dialog");
    const first = document.createElement("button");
    first.textContent = "First";
    const last = document.createElement("button");
    last.textContent = "Last";
    dialog.append(first, last);
    host.appendChild(dialog);

    await waitFor(() => expect(first).toHaveFocus());
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    dialog.remove();
    await waitFor(() => expect(trigger).toHaveFocus());
    cleanup();
  });

  it("makes a control-free dialog itself keyboard-focusable", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const cleanup = installScopedPortalFocusManagement(host);
    const dialog = document.createElement("section");
    dialog.setAttribute("role", "dialog");
    host.appendChild(dialog);

    await waitFor(() => expect(dialog).toHaveFocus());
    expect(dialog).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog).toHaveFocus();
    cleanup();
  });
});
