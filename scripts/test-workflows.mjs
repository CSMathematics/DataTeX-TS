import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readWorkflow = (name) =>
  readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");

const assertOrdered = (source, first, second) => {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert.notEqual(firstIndex, -1, `Missing workflow fragment: ${first}`);
  assert.notEqual(secondIndex, -1, `Missing workflow fragment: ${second}`);
  assert.ok(firstIndex < secondIndex, `${first} must appear before ${second}`);
};

test("build and release workflows retain clean native Graphics Studio gates", () => {
  const build = readWorkflow("build.yml");
  const release = readWorkflow("release.yml");

  for (const [name, source] of [
    ["build.yml", build],
    ["release.yml", release],
  ]) {
    assert.doesNotMatch(
      source,
      /^(?:<<<<<<<|=======|>>>>>>>)/m,
      `${name} contains merge-conflict markers`,
    );
    assert.match(source, /platform: macos-15-intel/);
    assert.match(source, /platform: macos-15(?:\r?\n)/);
    assert.match(source, /version: 11\.3\.0/);
    assertOrdered(source, "uses: pnpm/action-setup@v4", "uses: actions/setup-node@v4");
    assertOrdered(source, "pnpm run test:stoicheia:native", "uses: tauri-apps/tauri-action@v0");
  }

  assert.match(release, /includeUpdaterJson: false/);
  assert.match(release, /assetNamePattern:/);
  assert.doesNotMatch(release, /uploadUpdaterJson:/);
  assert.doesNotMatch(release, /releaseAssetNamePattern:/);
});
