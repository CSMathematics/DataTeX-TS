import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = JSON.parse(await readFile(
  path.join(repositoryRoot, "benchmarks/stoicheia/performance-policy.v1.json"),
  "utf8",
));
const gates = policy.hardwareIndependentGates;
const MAX_ADAPTER_JS_BYTES = gates.adapterJsMaxBytes;
const MAX_SCOPED_CSS_BYTES = gates.scopedCssMaxBytes;
const MAX_STOICHEIA_JS_BYTES = gates.stoicheiaOwnedJsMaxBytes;
const manifestPath = path.join(repositoryRoot, "dist/.vite/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const distPath = (relativePath) => path.join(repositoryRoot, "dist", relativePath);
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

const filesForKeys = (keys) => {
  const files = new Set();
  for (const key of keys) {
    const entry = manifest[key];
    if (entry?.file) files.add(entry.file);
    for (const file of entry?.css ?? []) files.add(file);
    for (const file of entry?.assets ?? []) files.add(file);
  }
  return files;
};
const initialFiles = filesForKeys(staticEntryKeys);
const stoicheiaOwnedFiles = filesForKeys(stoicheiaOwnedKeys);
const leakedFiles = [...initialFiles].filter((file) => stoicheiaOwnedFiles.has(file));
assert.deepEqual(
  leakedFiles,
  [],
  `Stoicheia files leaked into the initial static closure: ${leakedFiles.join(", ")}`,
);

const indexHtml = await readFile(distPath("index.html"), "utf8");
for (const file of stoicheiaOwnedFiles) {
  assert.ok(
    !indexHtml.includes(file),
    `Stoicheia asset leaked into index.html scripts or modulepreloads: ${file}`,
  );
}

const chunkStats = await stat(distPath(stoicheiaEntry.file));
assert.ok(
  chunkStats.size <= MAX_ADAPTER_JS_BYTES,
  `Stoicheia adapter exceeds ${MAX_ADAPTER_JS_BYTES} bytes: ${chunkStats.size}`,
);

const [scopedCssFile] = stoicheiaEntry.css;
const cssStats = await stat(distPath(scopedCssFile));
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
  totalStoicheiaJsBytes += (await stat(distPath(file))).size;
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
