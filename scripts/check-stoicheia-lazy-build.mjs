import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const MAX_ADAPTER_JS_BYTES = 900 * 1024;
const MAX_SCOPED_CSS_BYTES = 128 * 1024;
const MAX_STOICHEIA_JS_BYTES = 1200 * 1024;
const manifestPath = "dist/.vite/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const workspaceKey = "src/components/packages/PackageStudioWorkspace.tsx";
const workspace = manifest[workspaceKey];

assert.ok(workspace, `Missing ${workspaceKey} in ${manifestPath}`);
assert.equal(
  workspace.isDynamicEntry,
  true,
  "Package Studio workspace must remain a dynamic entry",
);

const stoicheiaEntries = (workspace.dynamicImports ?? [])
  .map((key) => [key, manifest[key]])
  .filter(
    ([, entry]) =>
      entry?.name === "StoicheiaPackageStudioAdapter" &&
      (entry.dynamicImports ?? []).some((key) =>
        key.startsWith("src/features/stoicheia/"),
      ),
  );

assert.equal(
  stoicheiaEntries.length,
  1,
  "Package Studio must expose exactly one Stoicheia adapter dynamic entry",
);

const [stoicheiaKey, stoicheiaEntry] = stoicheiaEntries[0];
const stoicheiaEditorKey =
  "src/features/stoicheia/components/Editor.tsx";
const stoicheiaEditorEntry = manifest[stoicheiaEditorKey];
assert.equal(
  stoicheiaEntry.isDynamicEntry,
  true,
  "Stoicheia adapter must be emitted as a dynamic entry",
);
assert.ok(
  stoicheiaEntry.css?.length === 1,
  "Stoicheia adapter must load exactly one scoped stylesheet",
);
assert.ok(
  stoicheiaEditorEntry?.isDynamicEntry,
  "Stoicheia code editor must remain a separate dynamic entry",
);
assert.ok(
  stoicheiaEntry.dynamicImports?.includes(stoicheiaEditorKey),
  "Stoicheia adapter must lazy-load, not statically import, its code editor",
);

const staticEntryKeys = new Set();
const visitStaticImports = (key) => {
  if (staticEntryKeys.has(key)) return;
  staticEntryKeys.add(key);
  for (const importedKey of manifest[key]?.imports ?? []) {
    visitStaticImports(importedKey);
  }
};
visitStaticImports("index.html");

const stoicheiaFeatureKeys = Object.keys(manifest).filter(
  (key) => key.startsWith("src/features/stoicheia/"),
);
const stoicheiaOwnedKeys = new Set([stoicheiaKey, ...stoicheiaFeatureKeys]);
const leakedFeatureKeys = [...staticEntryKeys].filter((key) =>
  stoicheiaOwnedKeys.has(key),
);
assert.deepEqual(
  leakedFeatureKeys,
  [],
  `Stoicheia entries leaked into the initial static import graph: ${leakedFeatureKeys.join(", ")}`,
);

const indexHtml = await readFile("dist/index.html", "utf8");
for (const key of stoicheiaOwnedKeys) {
  const file = manifest[key]?.file;
  if (!file) continue;
  assert.ok(
    !indexHtml.includes(file),
    `Stoicheia asset leaked into index.html scripts or modulepreloads: ${file}`,
  );
}

const chunkStats = await stat(`dist/${stoicheiaEntry.file}`);
assert.ok(
  chunkStats.size <= MAX_ADAPTER_JS_BYTES,
  `Stoicheia adapter exceeds ${MAX_ADAPTER_JS_BYTES} bytes: ${chunkStats.size}`,
);

const [scopedCssFile] = stoicheiaEntry.css;
const cssStats = await stat(`dist/${scopedCssFile}`);
assert.ok(
  cssStats.size <= MAX_SCOPED_CSS_BYTES,
  `Stoicheia scoped CSS exceeds ${MAX_SCOPED_CSS_BYTES} bytes: ${cssStats.size}`,
);

const stoicheiaFiles = new Set(
  [...stoicheiaOwnedKeys]
    .map((key) => manifest[key]?.file)
    .filter(Boolean),
);
let totalStoicheiaJsBytes = 0;
for (const file of stoicheiaFiles) {
  totalStoicheiaJsBytes += (await stat(`dist/${file}`)).size;
}
assert.ok(
  totalStoicheiaJsBytes <= MAX_STOICHEIA_JS_BYTES,
  `Stoicheia JS exceeds ${MAX_STOICHEIA_JS_BYTES} bytes: ${totalStoicheiaJsBytes}`,
);

console.log(
  [
    "Stoicheia scoped lazy boundary verified:",
    `${stoicheiaEntry.file} ${chunkStats.size}/${MAX_ADAPTER_JS_BYTES} bytes;`,
    `${scopedCssFile} ${cssStats.size}/${MAX_SCOPED_CSS_BYTES} bytes;`,
    `${stoicheiaFiles.size} lazy JS chunks ${totalStoicheiaJsBytes}/${MAX_STOICHEIA_JS_BYTES} bytes.`,
  ].join(" "),
);
