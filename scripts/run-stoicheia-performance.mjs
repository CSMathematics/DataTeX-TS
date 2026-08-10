#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = path.join(
  repositoryRoot,
  "benchmarks/stoicheia/performance-policy.v1.json",
);
const policy = JSON.parse(await readFile(policyPath, "utf8"));
assert.equal(policy.schemaVersion, 1, "Unsupported Stoicheia performance policy");

const positiveEnvInteger = (name, fallback) => {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const defaults = policy.measurementDefaults;
const nativeWarmups = positiveEnvInteger("STOICHEIA_PERF_WARMUPS", defaults.nativeWarmups);
const nativeSamples = positiveEnvInteger("STOICHEIA_PERF_SAMPLES", defaults.nativeSamples);
const rendererWarmups = positiveEnvInteger(
  "STOICHEIA_PERF_RENDER_WARMUPS",
  defaults.rendererProcessWarmups,
);
const rendererSamples = positiveEnvInteger(
  "STOICHEIA_PERF_RENDER_SAMPLES",
  defaults.rendererProcessSamples,
);
const outputPath = path.resolve(
  process.env.STOICHEIA_PERF_OUTPUT
    ?? path.join(os.tmpdir(), "datatex-stoicheia-performance-report.json"),
);
const reusedProductionBuild = process.env.STOICHEIA_PERF_REUSE_BUILD === "1";
const runtimeCaptureInputPath = process.env.STOICHEIA_TAURI_PERF_INPUT
  ? path.resolve(process.env.STOICHEIA_TAURI_PERF_INPUT)
  : null;
const maxBuffer = 64 * 1024 * 1024;
const normalizeChildOutput = (source) => source
  .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
  .replace(/\r\n?/g, "\n");
const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");

const run = (command, args, { env, label, showOutput = false } = {}) => {
  if (label) process.stderr.write(`[Stoicheia perf] ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`${command} exited with status ${result.status}`);
  }
  if (showOutput) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
  }
  return result.stdout ?? "";
};

const runOptional = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer,
  });
  return result.status === 0 ? (result.stdout ?? "").trim() : null;
};

const rounded = (value) => Math.round(value * 1_000_000) / 1_000_000;
const summarize = (samples) => {
  assert.ok(samples.length > 0, "Cannot summarize an empty metric");
  const values = samples.map(rounded);
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
  const p95Index = Math.min(Math.ceil(sorted.length * 0.95) - 1, sorted.length - 1);
  const mean = sorted.reduce((total, value) => total + value, 0) / sorted.length;
  const variance = sorted.reduce((total, value) => total + ((value - mean) ** 2), 0)
    / sorted.length;
  return {
    samplesMs: values,
    minMs: rounded(sorted[0]),
    medianMs: rounded(median),
    p95Ms: rounded(sorted[p95Index]),
    maxMs: rounded(sorted.at(-1)),
    meanMs: rounded(mean),
    coefficientOfVariationPercent: rounded(mean > 0 ? Math.sqrt(variance) / mean * 100 : 0),
  };
};

const cargo = process.platform === "win32" ? "cargo.exe" : "cargo";
const nativeOutput = run(
  cargo,
  [
    "run",
    "--release",
    "--quiet",
    "--manifest-path",
    "src-tauri/crates/stoicheia-engine/Cargo.toml",
    "--example",
    "performance_report",
  ],
  {
    label: `native release workloads (${nativeWarmups} warmups, ${nativeSamples} samples)`,
    env: {
      STOICHEIA_PERF_WARMUPS: String(nativeWarmups),
      STOICHEIA_PERF_SAMPLES: String(nativeSamples),
    },
  },
);
const native = JSON.parse(normalizeChildOutput(nativeOutput).trim());
assert.equal(native.schemaVersion, 1);
assert.equal(native.suite, "stoicheia-native-performance");

const vitest = path.join(repositoryRoot, "node_modules/vitest/vitest.mjs");
run(
  process.execPath,
  [
    vitest,
    "run",
    "--config",
    "vitest.config.ts",
    "src/features/stoicheia/parity/parserRenderParity.test.tsx",
    "-t",
    "policy-sized large scene",
    "--reporter",
    "dot",
  ],
  { label: "policy-driven 5,000-node DOM batching gate" },
);
const largeSceneStructureGate = {
  passed: true,
  astNodes: policy.hardwareIndependentGates.largeSceneNodeCount,
  expectedSegmentBatches: policy.hardwareIndependentGates.largeSceneSegmentBatchCount,
  svgElementMax: policy.hardwareIndependentGates.largeSceneSvgElementMax,
  verifiedBy: "src/features/stoicheia/parity/parserRenderParity.test.tsx",
};

const rendererRows = new Map();
const rendererTotalRuns = rendererWarmups + rendererSamples;
for (let runIndex = 0; runIndex < rendererTotalRuns; runIndex += 1) {
  const measured = runIndex >= rendererWarmups;
  const output = normalizeChildOutput(run(
    process.execPath,
    [
      vitest,
      "run",
      "--config",
      "vitest.config.ts",
      "src/features/stoicheia/renderers/FastSvgRenderer.test.tsx",
      "-t",
      "benchmarks large instant renderer scenes",
      "--reporter",
      "verbose",
    ],
    {
      label: `renderer ${measured ? "sample" : "warmup"} ${measured ? runIndex - rendererWarmups + 1 : runIndex + 1}/${measured ? rendererSamples : rendererWarmups}`,
      env: { STOICHEIA_RENDER_BENCHMARK: "1" },
    },
  ));
  const rows = Array.from(
    output.matchAll(/^(\d+),([0-9.]+),(\d+),(\d+)$/gm),
    (match) => ({
      nodes: Number(match[1]),
      renderMs: Number(match[2]),
      domElements: Number(match[3]),
      svgElements: Number(match[4]),
    }),
  );
  assert.deepEqual(
    rows.map(({ nodes }) => nodes),
    [50, 250, 1_000, policy.hardwareIndependentGates.largeSceneNodeCount],
    "Renderer benchmark inventory drifted",
  );
  if (!measured) continue;
  for (const row of rows) {
    const samples = rendererRows.get(row.nodes) ?? [];
    samples.push(row);
    rendererRows.set(row.nodes, samples);
  }
}
const renderer = {
  schemaVersion: 1,
  suite: "stoicheia-jsdom-renderer-performance",
  environment: {
    runtime: "Vitest/jsdom",
    nodeVersion: process.version,
    measuresBrowserLayoutPaintOrFps: false,
  },
  configuration: {
    processWarmups: rendererWarmups,
    processSamples: rendererSamples,
    percentileMethod: "nearest-rank",
    timingPolicy: "advisory; jsdom reconciliation and DOM creation only",
  },
  workloads: [...rendererRows.entries()].map(([nodes, rows]) => {
    const domElements = new Set(rows.map((row) => row.domElements));
    const svgElements = new Set(rows.map((row) => row.svgElements));
    assert.equal(domElements.size, 1, `${nodes}: renderer DOM shape drifted between samples`);
    assert.equal(svgElements.size, 1, `${nodes}: SVG shape drifted between samples`);
    return {
      nodes,
      domElements: rows[0].domElements,
      svgElements: rows[0].svgElements,
      render: summarize(rows.map((row) => row.renderMs)),
    };
  }),
};
const mixedStyleLargeScene = renderer.workloads.find(
  (workload) => workload.nodes === policy.hardwareIndependentGates.largeSceneNodeCount,
);
assert.ok(mixedStyleLargeScene, "Missing mixed-style large renderer workload");
assert.ok(
  mixedStyleLargeScene.svgElements
    <= policy.hardwareIndependentGates.mixedStyleSceneSvgElementMax,
  `Mixed-style renderer exceeds ${policy.hardwareIndependentGates.mixedStyleSceneSvgElementMax} SVG elements: ${mixedStyleLargeScene.svgElements}`,
);
const mixedStyleStructureGate = {
  passed: true,
  astNodes: mixedStyleLargeScene.nodes,
  svgElements: mixedStyleLargeScene.svgElements,
  svgElementMax: policy.hardwareIndependentGates.mixedStyleSceneSvgElementMax,
  note: "Mixed styles intentionally include unbatchable arrow segments; this is distinct from the one-batch structural gate.",
};
const warningThresholdPercent =
  policy.comparisonPolicy.warnWhenCoefficientOfVariationExceedsPercent;
const nativeWarnings = native.workloads
  .filter((workload) => (
    workload.category !== "canonical"
      && workload.metrics.outerCall.coefficientOfVariationPercent > warningThresholdPercent
  ))
  .map((workload) => ({
    code: "native-high-variability",
    workload: workload.id,
    metric: "outerCall",
    coefficientOfVariationPercent:
      workload.metrics.outerCall.coefficientOfVariationPercent,
    warningThresholdPercent,
    interpretation: "Timing is advisory and inconclusive for regression comparison; result-contract gates remain valid.",
  }));
const rendererWarnings = renderer.workloads
  .filter((workload) => (
    workload.render.coefficientOfVariationPercent > warningThresholdPercent
  ))
  .map((workload) => ({
    code: "renderer-high-variability",
    workload: `mixed-style-${workload.nodes}`,
    coefficientOfVariationPercent: workload.render.coefficientOfVariationPercent,
    warningThresholdPercent,
    interpretation: "Timing is advisory and inconclusive for regression comparison; structural gates remain valid.",
  }));
const warnings = [...nativeWarnings, ...rendererWarnings];
const flat5000 = native.workloads.find((workload) => workload.id === "flat-5000");
const chained5000 = native.workloads.find((workload) => workload.id === "chained-5000");
const render5000 = renderer.workloads.find(
  (workload) => workload.nodes === policy.hardwareIndependentGates.largeSceneNodeCount,
);
assert.ok(flat5000, "Missing flat-5000 native workload");
assert.ok(chained5000, "Missing chained-5000 native workload");
assert.ok(render5000, "Missing 5,000-node renderer workload");

const distPath = (...segments) => path.join(repositoryRoot, "dist", ...segments);
if (!reusedProductionBuild) {
  run(
    process.execPath,
    [path.join(repositoryRoot, "scripts/build-stoicheia-css.mjs")],
    { label: "generate scoped Graphics Studio CSS" },
  );
  run(
    process.execPath,
    [
      "--max-old-space-size=4096",
      path.join(repositoryRoot, "node_modules/vite/bin/vite.js"),
      "build",
      "--manifest",
      "--logLevel",
      "error",
    ],
    { label: "production manifest build" },
  );
}
run(
  process.execPath,
  [path.join(repositoryRoot, "scripts/check-stoicheia-lazy-build.mjs")],
  { label: "hardware-independent lazy/bundle gates" },
);

const manifestContents = await readFile(distPath(".vite", "manifest.json"), "utf8");
const manifest = JSON.parse(manifestContents);
const workspaceKey = "src/components/packages/PackageStudioWorkspace.tsx";
const editorKey = "src/features/stoicheia/components/Editor.tsx";
const workspaceEntry = manifest[workspaceKey];
assert.ok(workspaceEntry, `Missing ${workspaceKey} from production manifest`);
const stoicheiaCandidates = (workspaceEntry.dynamicImports ?? [])
  .map((key) => [key, manifest[key]])
  .filter(([, entry]) => (
    entry?.name === "StoicheiaPackageStudioAdapter"
    && (entry.dynamicImports ?? []).some((key) => key.startsWith("src/features/stoicheia/"))
  ));
assert.equal(stoicheiaCandidates.length, 1, "Expected one Graphics Studio adapter entry");
const [stoicheiaKey, stoicheiaEntry] = stoicheiaCandidates[0];
assert.ok(manifest[editorKey]?.isDynamicEntry, "Graphics editor must remain separately lazy");
const monacoMainCandidates = Object.entries(manifest).filter(
  ([, entry]) => entry?.name === "editor.main" && entry?.isDynamicEntry,
);
assert.equal(monacoMainCandidates.length, 1, "Expected one lazy Monaco editor.main entry");
const [monacoMainKey] = monacoMainCandidates[0];

const staticClosure = (rootKey) => {
  const keys = new Set();
  const visit = (key) => {
    if (keys.has(key)) return;
    const entry = manifest[key];
    assert.ok(entry, `Missing manifest entry ${key}`);
    keys.add(key);
    for (const imported of entry.imports ?? []) visit(imported);
  };
  visit(rootKey);
  return keys;
};
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
const difference = (source, excluded) => new Set([...source].filter((item) => !excluded.has(item)));
const union = (...sets) => new Set(sets.flatMap((set) => [...set]));
const measureFiles = async (files) => {
  const assets = [];
  for (const file of [...files].sort()) {
    const contents = await readFile(distPath(file));
    assets.push({
      file,
      bytes: contents.byteLength,
      gzipBytes: gzipSync(contents).byteLength,
      brotliBytes: brotliCompressSync(contents).byteLength,
    });
  }
  return {
    fileCount: assets.length,
    bytes: assets.reduce((total, asset) => total + asset.bytes, 0),
    gzipBytes: assets.reduce((total, asset) => total + asset.gzipBytes, 0),
    brotliBytes: assets.reduce((total, asset) => total + asset.brotliBytes, 0),
    assets,
  };
};

const initialKeys = staticClosure("index.html");
const workspaceKeys = staticClosure(workspaceKey);
const graphicsKeys = staticClosure(stoicheiaKey);
const editorKeys = staticClosure(editorKey);
const monacoMainKeys = staticClosure(monacoMainKey);
const initialFiles = filesForKeys(initialKeys);
const packageFiles = difference(filesForKeys(workspaceKeys), initialFiles);
const graphicsFiles = difference(
  filesForKeys(graphicsKeys),
  union(initialFiles, packageFiles),
);
const editorFiles = difference(
  filesForKeys(editorKeys),
  union(initialFiles, packageFiles, graphicsFiles),
);
const monacoCoreFiles = difference(
  filesForKeys(monacoMainKeys),
  union(initialFiles, packageFiles, graphicsFiles, editorFiles),
);
const assetFileNames = await readdir(distPath("assets"));
const monacoEditorWorkerNames = assetFileNames.filter((file) => (
  /^editor\.worker-[A-Za-z0-9_-]+\.js$/.test(file)
));
assert.equal(monacoEditorWorkerNames.length, 1, "Expected one emitted Monaco editor worker");
const monacoEditorWorkerFiles = new Set(
  monacoEditorWorkerNames.map((file) => `assets/${file}`),
);
const coldEditorFiles = union(editorFiles, monacoCoreFiles, monacoEditorWorkerFiles);
const stoicheiaOwnedKeys = new Set([
  stoicheiaKey,
  ...Object.keys(manifest).filter((key) => key.startsWith("src/features/stoicheia/")),
]);
const stoicheiaOwnedFiles = filesForKeys(stoicheiaOwnedKeys);
const initialStoicheiaFiles = [...initialFiles].filter((file) => stoicheiaOwnedFiles.has(file));
assert.equal(
  initialStoicheiaFiles.length,
  policy.hardwareIndependentGates.initialStoicheiaAssetCount,
  `Graphics assets leaked into initial startup: ${initialStoicheiaFiles.join(", ")}`,
);

const [scopedCssFile] = stoicheiaEntry.css ?? [];
const bundle = {
  schemaVersion: 1,
  manifest: "dist/.vite/manifest.json",
  buildReused: reusedProductionBuild,
  manifestSha256: sha256(manifestContents),
  lazyBundleGatesPassed: true,
  initialStoicheiaAssetCount: initialStoicheiaFiles.length,
  adapter: {
    file: stoicheiaEntry.file,
    bytes: (await stat(distPath(stoicheiaEntry.file))).size,
  },
  scopedCss: {
    file: scopedCssFile,
    bytes: (await stat(distPath(scopedCssFile))).size,
  },
  closures: {
    initialApplication: await measureFiles(initialFiles),
    packageStudioIncremental: await measureFiles(packageFiles),
    graphicsStudioFirstOpenIncremental: await measureFiles(graphicsFiles),
    graphicsEditorEntryIncremental: await measureFiles(editorFiles),
    monacoCoreColdIncremental: await measureFiles(monacoCoreFiles),
    monacoEditorWorkerOnFirstUse: await measureFiles(monacoEditorWorkerFiles),
    graphicsEditorColdIncremental: await measureFiles(coldEditorFiles),
    allStoicheiaOwnedAssets: await measureFiles(stoicheiaOwnedFiles),
  },
};

const gitCommit = runOptional("git", ["rev-parse", "HEAD"]);
const gitStatus = runOptional("git", ["status", "--porcelain"]);
const provenancePaths = [
  "package.json",
  "pnpm-lock.yaml",
  "benchmarks/stoicheia/performance-policy.v1.json",
  "scripts/check-stoicheia-lazy-build.mjs",
  "scripts/run-stoicheia-performance.mjs",
  "scripts/run-stoicheia-render-benchmark.mjs",
  "src-tauri/crates/stoicheia-engine/examples/performance_report.rs",
  "src-tauri/crates/stoicheia-engine/tests/fixtures/parser-render.v1.json",
  "src/features/stoicheia/parity/parserRenderParity.test.tsx",
  "src/features/stoicheia/renderers/FastSvgRenderer.test.tsx",
];
const inputSha256 = Object.fromEntries(await Promise.all(
  provenancePaths.map(async (relativePath) => [
    relativePath,
    sha256(await readFile(path.join(repositoryRoot, relativePath))),
  ]),
));
const packageVersion = async (packageName) => JSON.parse(await readFile(
  path.join(repositoryRoot, "node_modules", packageName, "package.json"),
  "utf8",
)).version;
const productionTauriCapture = runtimeCaptureInputPath
  ? JSON.parse(await readFile(runtimeCaptureInputPath, "utf8"))
  : null;
if (productionTauriCapture) {
  assert.equal(
    productionTauriCapture.schemaVersion,
    1,
    "Unsupported production Tauri capture schema",
  );
  assert.equal(
    productionTauriCapture.suite,
    "datatex-stoicheia-production-tauri-performance",
    "Unexpected production Tauri capture suite",
  );
  assert.equal(
    productionTauriCapture.captureMode,
    "production-tauri-webview",
    "Only a production Tauri/WebView capture can close the runtime gate",
  );
  for (const metric of policy.productionTauriCapture.requiredMetrics) {
    const value = productionTauriCapture.metrics?.[metric];
    const present = Array.isArray(value)
      ? value.length > 0 && value.every(Number.isFinite)
      : Number.isFinite(value);
    assert.ok(present, `Production Tauri capture is missing ${metric}`);
  }
}
const report = {
  schemaVersion: 1,
  suite: policy.suite,
  generatedAt: new Date().toISOString(),
  warnings,
  hardGates: {
    passed: true,
    largeSceneStructure: largeSceneStructureGate,
    mixedStyleRendererStructure: mixedStyleStructureGate,
    lazyBundle: {
      passed: bundle.lazyBundleGatesPassed,
      initialStoicheiaAssetCount: bundle.initialStoicheiaAssetCount,
      expectedInitialStoicheiaAssetCount:
        policy.hardwareIndependentGates.initialStoicheiaAssetCount,
    },
  },
  policy: {
    path: path.relative(repositoryRoot, policyPath).split(path.sep).join("/"),
    schemaVersion: policy.schemaVersion,
    timingComparisons: policy.comparisonPolicy,
  },
  environment: {
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    cpuModel: os.cpus()[0]?.model ?? "unknown",
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    nodeVersion: process.version,
    pnpmVersion: runOptional(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--version"]),
    viteVersion: await packageVersion("vite"),
    vitestVersion: await packageVersion("vitest"),
    jsdomVersion: await packageVersion("jsdom"),
    rustcVersion: runOptional("rustc", ["--version"]),
    gitCommit,
    gitDirty: gitStatus === null ? null : gitStatus.length > 0,
  },
  buildProvenance: {
    productionBuildReused: reusedProductionBuild,
    manifestSha256: bundle.manifestSha256,
    inputSha256,
  },
  native,
  renderer,
  bundle,
  productionTauriCapture: {
    captured: productionTauriCapture !== null,
    requiredMetrics: policy.productionTauriCapture.requiredMetrics,
    inputPath: runtimeCaptureInputPath,
    report: productionTauriCapture,
    note: productionTauriCapture
      ? "Production Tauri/WebView capture validated against the required metric inventory."
      : "Cold startup, browser paint, interaction FPS, and real TeX timings require a production Tauri/WebView capture on the target machine.",
  },
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

process.stdout.write([
  "Stoicheia performance report complete.",
  `Rust flat 5k median/max: ${flat5000.metrics.outerCall.medianMs}/${flat5000.metrics.outerCall.maxMs} ms; serialization ${flat5000.metrics.serialization.medianMs} ms.`,
  `Rust chained 5k median/max: ${chained5000.metrics.outerCall.medianMs}/${chained5000.metrics.outerCall.maxMs} ms.`,
  `jsdom mixed-style 5k median/max: ${render5000.render.medianMs}/${render5000.render.maxMs} ms; CV ${render5000.render.coefficientOfVariationPercent}%; ${render5000.svgElements} SVG elements.`,
  `Initial Graphics assets: ${bundle.initialStoicheiaAssetCount}; first-open incremental raw/gzip: ${bundle.closures.graphicsStudioFirstOpenIncremental.bytes}/${bundle.closures.graphicsStudioFirstOpenIncremental.gzipBytes} bytes.`,
  `Graphics editor incremental raw bytes: warm Monaco ${bundle.closures.graphicsEditorEntryIncremental.bytes}; cold Monaco ${bundle.closures.graphicsEditorColdIncremental.bytes}.`,
  `Warnings: ${warnings.length}.`,
  `Report: ${outputPath}`,
].join("\n") + "\n");
