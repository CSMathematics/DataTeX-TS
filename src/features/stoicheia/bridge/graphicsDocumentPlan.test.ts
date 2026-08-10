import { describe, expect, it } from "vitest";
import { calculateSourceSha256 } from "../../../services/packageStudioService";

describe("Graphics document plan fingerprint", () => {
  it("matches the Rust SHA-256 contract for UTF-8 source", async () => {
    await expect(calculateSourceSha256("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    await expect(calculateSourceSha256("α😀")).resolves.toBe(
      "6336ea0bde3a656ee28f637c6d5afbfa2abef9290f9cf6fcbac0e26e88f12f06",
    );
  });
});
