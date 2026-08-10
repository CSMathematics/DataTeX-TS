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
  const expectedMatrix = [
    {
      name: "linux-x64",
      platform: "ubuntu-22.04",
      config: "src-tauri/tauri.linux.conf.json",
      target: null,
    },
    {
      name: "windows-x64",
      platform: "windows-latest",
      config: "src-tauri/tauri.windows.conf.json",
      target: null,
    },
    {
      name: "macos-x64",
      platform: "macos-15-intel",
      config: "src-tauri/tauri.macos-x86_64.conf.json",
      target: "x86_64-apple-darwin",
    },
    {
      name: "macos-arm64",
      platform: "macos-15",
      config: "src-tauri/tauri.macos-aarch64.conf.json",
      target: "aarch64-apple-darwin",
    },
  ];

  for (const [name, source] of [
    ["build.yml", build],
    ["release.yml", release],
  ]) {
    assert.doesNotMatch(
      source,
      /^(?:<<<<<<<|=======|>>>>>>>)/m,
      `${name} contains merge-conflict markers`,
    );
    const matrixStart = source.indexOf("      matrix:");
    const matrixEnd = source.indexOf("    runs-on:", matrixStart);
    assert.notEqual(matrixStart, -1, `${name} is missing its strategy matrix`);
    assert.notEqual(matrixEnd, -1, `${name} is missing its matrix runner`);
    const matrixSource = source.slice(matrixStart, matrixEnd);
    assert.deepEqual(
      Array.from(matrixSource.matchAll(/^\s+- name: (\S+)$/gm), match => match[1]),
      expectedMatrix.map(entry => entry.name),
      `${name} must contain exactly the supported release architecture matrix`,
    );
    for (const entry of expectedMatrix) {
      assert.match(source, new RegExp(`name: ${entry.name}(?:\\r?\\n)`));
      assert.match(
        source,
        new RegExp(`platform: ${entry.platform}(?:\\r?\\n)`),
      );
      assert.match(source, new RegExp(`--config ${entry.config}`));
      if (entry.target) {
        assert.match(source, new RegExp(`--target ${entry.target}`));
        assert.match(
          source,
          new RegExp(`rust-targets: "${entry.target}"`),
        );
      }
    }
    assert.match(source, /version: 11\.3\.0/);
    assertOrdered(source, "uses: pnpm/action-setup@v4", "uses: actions/setup-node@v4");
    assertOrdered(source, "pnpm run test:workflows", "pnpm run test:stoicheia:native");
    assertOrdered(source, "pnpm run test:stoicheia:native", "uses: tauri-apps/tauri-action@v0");
  }

  assert.match(release, /includeUpdaterJson: false/);
  assert.match(release, /assetNamePattern:/);
  assert.doesNotMatch(release, /uploadUpdaterJson:/);
  assert.doesNotMatch(release, /releaseAssetNamePattern:/);
});
