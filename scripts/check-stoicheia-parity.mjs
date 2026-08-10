#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendRoot = path.join(repositoryRoot, "src/features/stoicheia");
const engineRoot = path.join(repositoryRoot, "src-tauri/crates/stoicheia-engine");

const sha256 = (contents) => createHash("sha256").update(contents).digest("hex");
const read = (root, relativePath) => readFile(path.join(root, relativePath), "utf8");
const count = (source, token) => source.split(token).length - 1;
const canonicalJson = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map(
    (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
  ).join(",")}}`;
};

const frontendManifestSource = await read(frontendRoot, "SOURCE_MANIFEST.sha256");
const frontendManifest = new Map(
  frontendManifestSource
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([a-f0-9]{64})\s+\*?\.\/(.+)$/);
      assert.ok(match, `Invalid frontend source-manifest line: ${line}`);
      return [match[2], match[1]];
    }),
);

const assertFrontendBaseline = async (relativePath, normalize = (source) => source) => {
  const expected = frontendManifest.get(relativePath);
  assert.ok(expected, `Missing frontend baseline hash for ${relativePath}`);
  const actual = sha256(normalize(await read(frontendRoot, relativePath)));
  assert.equal(actual, expected, `Stoicheia parity drift in ${relativePath}`);
};

const toolbarPath = "components/Toolbar.tsx";
const toolbar = await read(frontendRoot, toolbarPath);
await assertFrontendBaseline(toolbarPath);

const toolbarDefinition = toolbar.slice(
  toolbar.indexOf("const toolbarGroupsWithDefaultIcons"),
  toolbar.indexOf("const withGeometryIcon"),
);
const toolbarGroupIds = Array.from(
  toolbarDefinition.matchAll(/^  (?:\{|defineToolbarGroup\(\{)\n    id: '([^']+)'/gm),
  (match) => match[1],
);
const toolbarSectionIds = Array.from(
  toolbarDefinition.matchAll(/^      \{\n        id: '([^']+)'/gm),
  (match) => match[1],
);
assert.equal(toolbarGroupIds.length, 14, "Expected the 14 standalone toolbar groups");
assert.equal(toolbarSectionIds.length, 19, "Expected the 19 standalone toolbar sections");
const toolIds = Array.from(
  toolbarDefinition.matchAll(/\{ id: '([^']+)', icon:/g),
  (match) => match[1],
);
assert.equal(toolIds.length, 100, "Expected the 100 standalone toolbar tools");
assert.equal(new Set(toolIds).size, toolIds.length, "Toolbar tool IDs must be unique");

const store = await read(frontendRoot, "store.ts");
await assertFrontendBaseline("store.ts");
const toolType = store.match(/export type ToolType = ([\s\S]*?);/);
assert.ok(toolType, "Could not find the standalone ToolType union");
const toolTypeIds = Array.from(toolType[1].matchAll(/"([^"]+)"/g), (match) => match[1]);
assert.equal(toolTypeIds.length, 102, "Expected 100 tools plus cursor and pan");
assert.deepEqual(
  [...toolIds].sort(),
  toolTypeIds.filter((id) => id !== "cursor" && id !== "pan").sort(),
  "Toolbar must expose every non-navigation ToolType exactly once",
);

const iconRegistry = await read(frontendRoot, "icons/geometry/registry.tsx");
await assertFrontendBaseline("icons/geometry/registry.tsx");
const iconRegistryBody = iconRegistry.slice(
  iconRegistry.indexOf("export const geometryToolIcons"),
  iconRegistry.indexOf("export const geometryIconToolIds"),
);
const iconToolIds = Array.from(
  iconRegistryBody.matchAll(/^  ([a-z_]+): \w+ToolIcon,/gm),
  (match) => match[1],
);
assert.equal(iconToolIds.length, 100, "Expected one geometry icon for every toolbar tool");
assert.deepEqual([...iconToolIds].sort(), [...toolIds].sort(), "Geometry icon coverage drifted");

const commandPalette = await read(frontendRoot, "components/CommandPalette.tsx");
await assertFrontendBaseline("components/CommandPalette.tsx");
const staticActionBody = commandPalette.slice(
  commandPalette.indexOf("    return ["),
  commandPalette.indexOf("      ...toolActions,"),
);
const staticActionIds = Array.from(
  staticActionBody.matchAll(/^        id: '([^']+)'/gm),
  (match) => match[1],
);
assert.equal(staticActionIds.length, 12, "Expected the 12 standalone static palette actions");
assert.equal(new Set(staticActionIds).size, 12, "Static palette action IDs must be unique");
assert.ok(
  commandPalette.includes("id: `tool:${tool.id}`"),
  "Command palette must generate one action for every toolbar tool",
);

const lazyDialogs = Array.from(
  toolbar.matchAll(/const (\w+Dialog) = lazy\(\(\) => import\('\.\/(\w+Dialog)'\)/g),
  (match) => {
    assert.equal(match[1], match[2], `Dialog binding/import mismatch for ${match[1]}`);
    return match[1];
  },
);
assert.equal(lazyDialogs.length, 24, "Expected all 24 standalone dialogs");
assert.equal(new Set(lazyDialogs).size, 24, "Dialog registrations must be unique");

const scopedPortalImport = "import { getScopedPortalTarget } from '../bridge/scopedPortal';\n";
for (const dialog of lazyDialogs) {
  assert.ok(toolbar.includes(`<${dialog}`), `${dialog} is imported but never rendered`);
  const relativePath = `components/${dialog}.tsx`;
  await assertFrontendBaseline(relativePath, (source) => {
    assert.equal(count(source, scopedPortalImport), 1, `${dialog} must have one scoped import`);
    assert.equal(count(source, "getScopedPortalTarget()"), 1, `${dialog} must have one scoped target`);
    return source
      .replace(scopedPortalImport, "")
      .replace("getScopedPortalTarget()", "document.body");
  });
}

await assertFrontendBaseline("components/Toolbar.test.tsx", (source) => {
  const embeddedAssertion = "    expect(menu.style.maxHeight).not.toContain('vh');";
  assert.equal(count(source, embeddedAssertion), 1, "Expected the embedded menu-height assertion");
  return source.replace(
    embeddedAssertion,
    "    expect(menu).toHaveStyle({ maxHeight: 'calc(100vh - 24px)' });",
  );
});

for (const relativePath of [
  "store.test.ts",
  "tikz/options.ts",
  "tikz/options.test.ts",
  "tikz/styleCommands.ts",
  "renderers/FastSvgRenderer.tsx",
  "renderers/FastSvgRenderer.test.tsx",
  "geometry/fastViewport.ts",
  "geometry/fastViewport.test.ts",
]) {
  await assertFrontendBaseline(relativePath);
}

const generatedLatexFixturePath = "parity/fixtures/generated-latex.v1.json";
const generatedLatexFixture = JSON.parse(
  await read(frontendRoot, generatedLatexFixturePath),
);
const expectedGeneratedLatexInventory = [
  ["first-of-multiple-pictures-lf", "insertion"],
  ["before-end-document-crlf-unicode", "line-endings"],
  ["append-without-document-shell", "insertion"],
  ["composite-construction-name-reservation", "construction"],
  ["transform-and-intersection", "construction"],
  ["styles-nested-options-unicode-label", "style"],
  ["cartesian-and-polar-coordinate-edit", "editing"],
  ["inspector-options-and-reference-swap", "inspector"],
  ["delete-construction-preserves-unrelated-bytes", "deletion"],
  ["direct-add-polygon-action", "construction"],
];
const expectedGeneratorSources = [
  "store.ts",
  "tikz/options.ts",
  "tikz/styleCommands.ts",
  "editor/commandOptions.ts",
  "components/nodeDeletion.ts",
];
const sha256Pattern = /^[a-f0-9]{64}$/;

assert.equal(generatedLatexFixture.schemaVersion, 1, "Unsupported generated-LaTeX fixture schema");
assert.equal(
  generatedLatexFixture.suite,
  "stoicheia-generated-latex-byte-exact",
  "Unexpected generated-LaTeX suite",
);
assert.equal(generatedLatexFixture.provenance.standaloneVersion, "1.2.2");
assert.equal(generatedLatexFixture.provenance.encoding, "utf-8");
assert.equal(generatedLatexFixture.provenance.comparison, "exact");
assert.equal(generatedLatexFixture.provenance.unicodeNormalization, "none");
assert.equal(
  generatedLatexFixture.provenance.sourceManifest.path,
  "src/features/stoicheia/SOURCE_MANIFEST.sha256",
);
assert.equal(
  generatedLatexFixture.provenance.sourceManifest.sha256,
  sha256(frontendManifestSource),
  "Generated-LaTeX fixture points at a different source manifest",
);

assert.deepEqual(
  generatedLatexFixture.provenance.generatorSources.map(({ path: sourcePath }) => sourcePath),
  expectedGeneratorSources,
  "Generated-LaTeX generator-source inventory drifted",
);
for (const source of generatedLatexFixture.provenance.generatorSources) {
  assert.match(source.sha256, sha256Pattern, `Invalid source hash for ${source.path}`);
  assert.equal(
    source.sha256,
    frontendManifest.get(source.path),
    `Fixture provenance differs from the source manifest for ${source.path}`,
  );
  assert.equal(
    sha256(await read(frontendRoot, source.path)),
    source.sha256,
    `Fixture generator source drifted: ${source.path}`,
  );
}

assert.ok(Array.isArray(generatedLatexFixture.scenarios), "Fixture scenarios must be an array");
assert.deepEqual(
  generatedLatexFixture.scenarios.map(({ id, category }) => [id, category]),
  expectedGeneratedLatexInventory,
  "Generated-LaTeX scenario inventory drifted",
);
assert.equal(
  new Set(generatedLatexFixture.scenarios.map(({ id }) => id)).size,
  generatedLatexFixture.scenarios.length,
  "Generated-LaTeX scenario IDs must be unique",
);
for (const scenario of generatedLatexFixture.scenarios) {
  assert.ok(scenario.description?.trim(), `Missing description for ${scenario.id}`);
  assert.equal(typeof scenario.expectedSource, "string", `Missing exact source for ${scenario.id}`);
  assert.match(
    scenario.expectedSourceSha256Utf8,
    sha256Pattern,
    `Invalid expected-source hash for ${scenario.id}`,
  );
  assert.equal(
    sha256(scenario.expectedSource),
    scenario.expectedSourceSha256Utf8,
    `Generated-LaTeX golden output drifted: ${scenario.id}`,
  );
}

const engineManifest = await read(engineRoot, "SOURCE_MANIFEST.md");
const engineHashes = new Map(
  Array.from(
    engineManifest.matchAll(
      /^\| `([^`]+)` \| `[^`]+` \| `[a-f0-9]{64}` \| `([a-f0-9]{64})` \| .+ \|$/gm,
    ),
    (match) => [match[1], match[2]],
  ),
);
for (const relativePath of ["src/parser.rs", "src/geometry.rs"]) {
  const expected = engineHashes.get(relativePath);
  assert.ok(expected, `Missing engine baseline hash for ${relativePath}`);
  const contents = await readFile(path.join(engineRoot, relativePath));
  assert.equal(sha256(contents), expected, `Stoicheia engine parity drift in ${relativePath}`);
}

const fixtureHash = engineManifest.match(
  /tests\/fixtures\/tkz-triangle\.tex[\s\S]*?```text\s+([a-f0-9]{64})\s+```/,
);
assert.ok(fixtureHash, "Missing golden tkz-triangle fixture hash");
const triangleFixture = await readFile(path.join(engineRoot, "tests/fixtures/tkz-triangle.tex"));
assert.equal(sha256(triangleFixture), fixtureHash[1], "tkz-triangle fixture source drifted");

const parserRenderFixturePath = "tests/fixtures/parser-render.v1.json";
const parserRenderFixtureSource = await read(engineRoot, parserRenderFixturePath);
assert.ok(!parserRenderFixtureSource.startsWith("\uFEFF"), "Parser/render fixture must not contain a BOM");
const parserRenderFixture = JSON.parse(parserRenderFixtureSource);
const expectedParserRenderInventory = [
  ["basic-triangle", "basic"],
  ["chained-construction", "construction"],
  ["styles-labels-clipping", "style-and-clip"],
  ["incomplete-geometry-diagnostics", "diagnostics"],
];
const expectedRustParserRenderSources = [
  "src-tauri/crates/stoicheia-engine/src/parser.rs",
  "src-tauri/crates/stoicheia-engine/src/geometry.rs",
];
const expectedFrontendParserRenderSources = [
  "src/features/stoicheia/hooks/useDocumentPipeline.ts",
  "src/features/stoicheia/store.ts",
  "src/features/stoicheia/renderers/FastSvgRenderer.tsx",
  "src/features/stoicheia/geometry/fastViewport.ts",
  "src/features/stoicheia/geometry/math.ts",
  "src/features/stoicheia/tikz/options.ts",
  "src/features/stoicheia/editor/commandOptions.ts",
  "src/features/stoicheia/parity/semanticSvg.ts",
];

assert.equal(parserRenderFixture.schemaVersion, 1, "Unsupported parser/render fixture schema");
assert.equal(parserRenderFixture.suite, "stoicheia-parser-geometry-semantic-svg");
assert.equal(parserRenderFixture.provenance.standaloneVersion, "1.2.2");
assert.equal(parserRenderFixture.provenance.encoding, "utf-8");
assert.equal(parserRenderFixture.provenance.lineEndings, "lf");
assert.equal(parserRenderFixture.provenance.unicodeNormalization, "none");
assert.equal(
  parserRenderFixture.provenance.parseProjection,
  "serde_json::to_value(ParseResult) excluding only top-level timings",
);
assert.deepEqual(parserRenderFixture.provenance.semanticSvgProjection, {
  schemaVersion: 1,
  generatedIds: "canonicalized by retained definition order",
  attributes: "all explicit SVG, data, and aria attributes except class",
  text: "non-empty text nodes preserved exactly",
});
assert.deepEqual(
  parserRenderFixture.provenance.rustSources.map(({ path: sourcePath }) => sourcePath),
  expectedRustParserRenderSources,
  "Rust parser/render provenance inventory drifted",
);
assert.deepEqual(
  parserRenderFixture.provenance.frontendSources.map(({ path: sourcePath }) => sourcePath),
  expectedFrontendParserRenderSources,
  "Frontend parser/render provenance inventory drifted",
);
for (const source of [
  ...parserRenderFixture.provenance.rustSources,
  ...parserRenderFixture.provenance.frontendSources,
]) {
  assert.match(source.sha256, sha256Pattern, `Invalid parser/render source hash: ${source.path}`);
  const contents = await readFile(path.join(repositoryRoot, source.path));
  assert.equal(sha256(contents), source.sha256, `Parser/render source drifted: ${source.path}`);
}

assert.deepEqual(
  parserRenderFixture.scenarios.map(({ id, category }) => [id, category]),
  expectedParserRenderInventory,
  "Parser/render scenario inventory drifted",
);
assert.equal(
  new Set(parserRenderFixture.scenarios.map(({ id }) => id)).size,
  parserRenderFixture.scenarios.length,
  "Parser/render scenario IDs must be unique",
);
const validateSemanticSvg = (scenario) => {
  const snapshot = scenario.expectedSemanticSvg;
  assert.equal(snapshot?.schemaVersion, 1, `${scenario.id}: unsupported semantic-SVG schema`);
  assert.equal(snapshot?.root?.tag, "svg", `${scenario.id}: semantic-SVG root must be svg`);
  const ids = [];
  const references = [];
  const walk = (node) => {
    assert.equal(typeof node, "object", `${scenario.id}: semantic-SVG node must be an object`);
    assert.ok(node !== null && !Array.isArray(node), `${scenario.id}: invalid semantic-SVG node`);
    if (Object.hasOwn(node, "text")) {
      assert.deepEqual(Object.keys(node), ["text"], `${scenario.id}: text node shape drifted`);
      assert.equal(typeof node.text, "string", `${scenario.id}: semantic text must be a string`);
      assert.ok(node.text.trim(), `${scenario.id}: empty semantic text nodes are forbidden`);
      return;
    }

    assert.ok(node.tag?.trim(), `${scenario.id}: semantic element requires a tag`);
    assert.ok(
      Object.keys(node).every((key) => ["tag", "attributes", "children"].includes(key)),
      `${scenario.id}: semantic element shape drifted`,
    );
    if (node.attributes !== undefined) {
      assert.ok(
        node.attributes !== null && !Array.isArray(node.attributes),
        `${scenario.id}: semantic attributes must be an object`,
      );
      const attributeNames = Object.keys(node.attributes);
      assert.deepEqual(
        attributeNames,
        [...attributeNames].sort(),
        `${scenario.id}: semantic attributes must remain sorted`,
      );
      assert.ok(!Object.hasOwn(node.attributes, "class"), `${scenario.id}: CSS classes are not semantic`);
      for (const [name, value] of Object.entries(node.attributes)) {
        assert.equal(typeof value, "string", `${scenario.id}: ${name} must be a string`);
        if (name === "id") ids.push(value);
        for (const match of value.matchAll(/url\(\s*#([^\s)]+)\s*\)/g)) references.push(match[1]);
        if ((name === "href" || name === "xlink:href") && value.startsWith("#")) {
          references.push(value.slice(1));
        }
      }
    }
    if (node.children !== undefined) {
      assert.ok(Array.isArray(node.children), `${scenario.id}: semantic children must be an array`);
      node.children.forEach(walk);
    }
  };
  walk(snapshot.root);
  assert.deepEqual(
    ids,
    ids.map((_id, index) => `semantic-svg-id-${index + 1}`),
    `${scenario.id}: generated SVG IDs must follow retained document order`,
  );
  for (const reference of references) {
    assert.ok(ids.includes(reference), `${scenario.id}: unresolved semantic SVG reference ${reference}`);
  }
  assert.match(
    scenario.expectedSemanticSvgSha256CanonicalJson,
    sha256Pattern,
    `${scenario.id}: invalid semantic-SVG hash`,
  );
  assert.equal(
    sha256(canonicalJson(snapshot)),
    scenario.expectedSemanticSvgSha256CanonicalJson,
    `${scenario.id}: canonical semantic SVG drifted`,
  );
};
for (const scenario of parserRenderFixture.scenarios) {
  assert.ok(scenario.description?.trim(), `Missing parser/render description: ${scenario.id}`);
  assert.equal(typeof scenario.source, "string", `Missing parser/render source: ${scenario.id}`);
  assert.ok(!scenario.source.includes("\r"), `${scenario.id}: source must retain LF endings`);
  assert.match(scenario.sourceSha256Utf8, sha256Pattern, `${scenario.id}: invalid source hash`);
  assert.equal(sha256(scenario.source), scenario.sourceSha256Utf8, `${scenario.id}: source drifted`);
  assert.deepEqual(
    Object.keys(scenario.expectedParseResult).sort(),
    ["geometry_complete", "nodes", "renderScene", "viewport"],
    `${scenario.id}: canonical ParseResult keys drifted`,
  );
  assert.ok(!("timings" in scenario.expectedParseResult), `${scenario.id}: timings must be excluded`);
  assert.equal(
    scenario.expectedParseResult.renderScene.geometryComplete,
    scenario.expectedParseResult.geometry_complete,
    `${scenario.id}: geometry completeness fields disagree`,
  );
  assert.match(
    scenario.expectedParseResultSha256CanonicalJson,
    sha256Pattern,
    `${scenario.id}: invalid canonical ParseResult hash`,
  );
  assert.equal(
    sha256(canonicalJson(scenario.expectedParseResult)),
    scenario.expectedParseResultSha256CanonicalJson,
    `${scenario.id}: canonical ParseResult drifted`,
  );
  if (scenario.expectedParseResult.geometry_complete) {
    assert.ok(scenario.expectedParseResult.viewport?.viewBox, `${scenario.id}: missing Rust viewport`);
    assert.equal(
      scenario.expectedParseResult.renderScene.viewBox,
      scenario.expectedParseResult.viewport.viewBox,
      `${scenario.id}: viewport payloads disagree`,
    );
  } else {
    assert.equal(scenario.expectedParseResult.viewport, null, `${scenario.id}: partial viewport must be null`);
    assert.ok(
      !("viewBox" in scenario.expectedParseResult.renderScene),
      `${scenario.id}: partial render scene must omit viewBox`,
    );
    assert.ok(
      scenario.expectedParseResult.renderScene.diagnostics?.length > 0,
      `${scenario.id}: partial geometry must retain diagnostics`,
    );
  }
  validateSemanticSvg(scenario);
}
assert.equal(
  parserRenderFixture.scenarios[0].source,
  triangleFixture.toString("utf8"),
  "The shared basic scenario must reuse tkz-triangle.tex exactly",
);

process.stdout.write(
  "Stoicheia parity gate verified: 14 groups/19 sections/100 toolbar tools; "
  + "100 icons and 112 palette actions; 24 scoped dialogs; "
  + "LaTeX generator sources and 10 byte-exact golden scenarios match the immutable baseline; "
  + "4 shared parser/geometry payloads and complete semantic-SVG snapshots are canonical; "
  + "instant renderer matches the immutable baseline; "
  + "Rust parser, geometry, and fixture source hashes match.\n",
);
