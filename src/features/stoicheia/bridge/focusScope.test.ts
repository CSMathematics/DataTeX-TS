import { describe, expect, it } from "vitest";
import { isStoicheiaInteractionTarget } from "./focusScope";

describe("Stoicheia interaction scope", () => {
  it("accepts targets inside the embedded workspace", () => {
    const root = document.createElement("section");
    const button = document.createElement("button");
    root.appendChild(button);

    expect(isStoicheiaInteractionTarget(button, root)).toBe(true);
  });

  it("accepts targets inside the detached scoped portal", () => {
    const root = document.createElement("section");
    const portal = document.createElement("div");
    const dialog = document.createElement("div");
    portal.className = "stoicheia-scope stoicheia-portal-root";
    portal.appendChild(dialog);

    expect(isStoicheiaInteractionTarget(dialog, root)).toBe(true);
  });

  it("rejects unrelated DataTeX targets", () => {
    const root = document.createElement("section");
    const outside = document.createElement("input");

    expect(isStoicheiaInteractionTarget(outside, root)).toBe(false);
    expect(isStoicheiaInteractionTarget(window, root)).toBe(false);
  });
});
