import { afterEach, describe, expect, it } from "vitest";
import {
  getScopedPortalTarget,
  registerScopedPortalTarget,
} from "./scopedPortal";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("Stoicheia scoped portal target", () => {
  it("falls back to document.body for standalone rendering", () => {
    expect(getScopedPortalTarget()).toBe(document.body);
  });

  it("uses the host registered by the embedded shell", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    cleanups.push(() => host.remove());
    cleanups.push(registerScopedPortalTarget(host));

    expect(getScopedPortalTarget()).toBe(host);
  });

  it("does not let a stale cleanup detach a newer host", () => {
    const firstHost = document.createElement("div");
    const secondHost = document.createElement("div");
    const unregisterFirst = registerScopedPortalTarget(firstHost);
    const unregisterSecond = registerScopedPortalTarget(secondHost);
    cleanups.push(unregisterSecond);

    unregisterFirst();

    expect(getScopedPortalTarget()).toBe(secondHost);
  });
});
