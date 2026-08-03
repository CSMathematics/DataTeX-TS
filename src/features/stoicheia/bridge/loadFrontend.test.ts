import { describe, expect, it, vi } from "vitest";

const appModuleState = vi.hoisted(() => ({ evaluations: 0 }));

vi.mock("./StoicheiaPackageStudioAdapter", () => {
  appModuleState.evaluations += 1;
  return { default: () => null };
});

import { loadStoicheiaFrontend } from "./loadFrontend";

describe("Stoicheia frontend lazy boundary", () => {
  it("does not evaluate the frontend before loading and caches the import", async () => {
    expect(appModuleState.evaluations).toBe(0);

    const firstLoad = loadStoicheiaFrontend();
    const secondLoad = loadStoicheiaFrontend();

    expect(secondLoad).toBe(firstLoad);
    await firstLoad;
    expect(appModuleState.evaluations).toBe(1);
  });
});
