#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const featureRoot = path.resolve("src/features/stoicheia");
const manifestPath = path.join(featureRoot, "SOURCE_MANIFEST.sha256");
const ledgerPath = path.join(featureRoot, "PHASE4_ADAPTATION_LEDGER.md");

const adaptedBaselineFiles = new Set([
  "App.css",
  "App.tsx",
  "components/AdvancedPointDialog.tsx",
  "components/AngleValueDialog.tsx",
  "components/AppHeader.test.tsx",
  "components/AppHeader.tsx",
  "components/AssociatedTriangleDialog.tsx",
  "components/BarycentricPointDialog.tsx",
  "components/CircleCircleDialog.tsx",
  "components/CircleTransformationDialog.tsx",
  "components/DefinedCircleDialog.tsx",
  "components/DefinedLineDialog.tsx",
  "components/DefinedTriangleDialog.tsx",
  "components/DuplicateSegmentDialog.tsx",
  "components/EllipseDialog.tsx",
  "components/LineCircleDialog.tsx",
  "components/MeasurementDialog.tsx",
  "components/PointTransformationDialog.tsx",
  "components/PointsTransformationDialog.tsx",
  "components/PolygonConstructionDialog.tsx",
  "components/Preview.test.tsx",
  "components/Preview.tsx",
  "components/ProjectedExcentersDialog.tsx",
  "components/RadicalAxisDialog.tsx",
  "components/RandomPointDialog.tsx",
  "components/SettingsPage.test.tsx",
  "components/SettingsPage.tsx",
  "components/ShowLineDialog.tsx",
  "components/ShowTransformationDialog.tsx",
  "components/StatusBar.tsx",
  "components/Toolbar.test.tsx",
  "components/ToolGroup.tsx",
  "components/TriangleCenterDialog.tsx",
  "components/VectorCoordinatesDialog.tsx",
  "components/VectorPointDialog.tsx",
  "hooks/useAutosaveDraft.test.tsx",
  "hooks/useAutosaveDraft.ts",
  "hooks/useDocumentPipeline.test.tsx",
  "hooks/useDocumentPipeline.ts",
]);

const manifest = await readFile(manifestPath, "utf8");
const entries = manifest
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^([a-f0-9]{64})\s+\*?\.\/(.+)$/);
    assert.ok(match, `Invalid source-manifest line: ${line}`);
    return { hash: match[1], relativePath: match[2] };
  });

assert.equal(entries.length, 110, "Expected the 110-file Phase 3 baseline");
assert.equal(
  adaptedBaselineFiles.size,
  39,
  "Phase 4 adaptation allowlist count changed unexpectedly",
);

const manifestPaths = new Set(entries.map((entry) => entry.relativePath));
const ledger = await readFile(ledgerPath, "utf8");
for (const relativePath of adaptedBaselineFiles) {
  assert.ok(
    manifestPaths.has(relativePath),
    `Adapted file is absent from the baseline: ${relativePath}`,
  );
  await access(path.join(featureRoot, relativePath));
  const baseline = entries.find((entry) => entry.relativePath === relativePath);
  assert.ok(
    ledger.includes(`| \`${relativePath}\` | \`${baseline.hash}\` |`),
    `Adapted file is missing from the Phase 4 ledger: ${relativePath}`,
  );
}

const portalDialogFiles = new Set(
  [...adaptedBaselineFiles].filter((relativePath) =>
    /^components\/.+Dialog\.tsx$/.test(relativePath),
  ),
);
assert.equal(portalDialogFiles.size, 24, "Expected 24 scoped portal dialogs");

const componentEntries = await readdir(path.join(featureRoot, "components"), {
  withFileTypes: true,
});
const createPortalFiles = [];
for (const entry of componentEntries) {
  if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
  const relativePath = `components/${entry.name}`;
  const source = await readFile(path.join(featureRoot, relativePath), "utf8");
  if (source.includes("createPortal")) createPortalFiles.push(relativePath);
  if (!portalDialogFiles.has(relativePath)) continue;
  assert.ok(
    source.includes("getScopedPortalTarget()"),
    `Portal dialog does not use the shared scoped target: ${relativePath}`,
  );
  assert.ok(
    !source.includes("document.body"),
    `Portal dialog still targets document.body: ${relativePath}`,
  );
}
assert.deepEqual(
  createPortalFiles.sort(),
  [...portalDialogFiles].sort(),
  "Every Stoicheia component portal must be listed in the scoped-dialog ledger",
);

let verified = 0;
for (const entry of entries) {
  if (adaptedBaselineFiles.has(entry.relativePath)) continue;
  const contents = await readFile(path.join(featureRoot, entry.relativePath));
  const actual = createHash("sha256").update(contents).digest("hex");
  assert.equal(
    actual,
    entry.hash,
    `Unexpected change outside the Phase 4 boundary: ${entry.relativePath}`,
  );
  verified += 1;
}

assert.equal(verified, 71);
process.stdout.write(
  `Stoicheia copy-first baseline verified: ${verified} unchanged files; ${adaptedBaselineFiles.size} explicit Phase 4 adapters.\n`,
);
