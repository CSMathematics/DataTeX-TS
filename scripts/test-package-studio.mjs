import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);

async function source(relativePath) {
  return readFile(resolve(projectRoot, relativePath), "utf8");
}

function assertIncludes(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label} is missing ${needle}`);
}

function assertNotIncludes(haystack, needle, label) {
  assert.ok(!haystack.includes(needle), `${label} unexpectedly contains ${needle}`);
}

const appSource = await source("src/App.tsx");
const workspaceSource = await source(
  "src/components/packages/PackageStudioWorkspace.tsx",
);
const sidebarSource = await source("src/components/layout/Sidebar.tsx");
const serviceSource = await source("src/services/packageStudioService.ts");
const rustPackageStudioSource = await source("src-tauri/src/package_studio/mod.rs");
const rustLibSource = await source("src-tauri/src/lib.rs");
const rustBuilderRegistrySource = await source(
  "src-tauri/src/package_studio/builders/mod.rs",
);
const rustTablesBuilderSource = await source(
  "src-tauri/src/package_studio/builders/tables.rs",
);
const rustSiunitxBuilderSource = await source(
  "src-tauri/src/package_studio/builders/siunitx.rs",
);
const rustMathBuilderSource = await source(
  "src-tauri/src/package_studio/builders/math.rs",
);

test("Package Studio sidebar builder selection stays open and preserves editor content", () => {
  assertIncludes(
    appSource,
    'if (activeView !== "editor" || !activeTabId || !editorRef.current) return;',
    "active editor sync guard",
  );
  assertIncludes(
    appSource,
    "const handleOpenPackageStudioBuilder = useCallback",
    "builder open handler",
  );
  assertIncludes(
    appSource,
    'setActiveActivity("packages");',
    "builder open handler",
  );
  assertIncludes(
    appSource,
    'setActiveView("package-studio");',
    "builder open handler",
  );
  assertIncludes(
    appSource,
    "setIsSidebarOpen(true);",
    "builder open handler",
  );
  assertNotIncludes(
    appSource,
    "setIsSidebarOpen(false);\n    },\n    [syncActiveEditorContent],\n  );\n  const handleOpenExamGenerator",
    "builder open handler",
  );
});

test("Package Studio uses the left sidebar as the only builder selector", () => {
  assertIncludes(
    sidebarSource,
    "<PackageStudioSidebarPanel",
    "left package sidebar",
  );
  assertIncludes(
    sidebarSource,
    "onOpenPackageStudioBuilder(builderId)",
    "left package sidebar builder callback",
  );
  assertNotIncludes(
    workspaceSource,
    'placeholder={t("packageStudio.searchBuilders"',
    "central Package Studio workspace",
  );
  assertNotIncludes(
    workspaceSource,
    "filteredBuilders.map((builder)",
    "central Package Studio workspace",
  );
});

test("Enumitem builder is wired end to end through Rust, Tauri, service, and UI", () => {
  assertIncludes(
    rustBuilderRegistrySource,
    "pub mod enumitem;",
    "Rust builder registry",
  );
  assertIncludes(
    rustBuilderRegistrySource,
    'id: "enumitem".to_string()',
    "Rust builder descriptor",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_generate_enumitem_cmd",
    "Tauri generate command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_import_enumitem_cmd",
    "Tauri import command",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_generate_enumitem_cmd",
    "Tauri generate handler",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_import_enumitem_cmd",
    "Tauri import handler",
  );
  assertIncludes(
    serviceSource,
    'invoke<EnumitemBuilderOutput>("package_studio_generate_enumitem_cmd"',
    "frontend generate adapter",
  );
  assertIncludes(
    serviceSource,
    'invoke<EnumitemBuilderRequest>("package_studio_import_enumitem_cmd"',
    "frontend import adapter",
  );
  assertIncludes(
    workspaceSource,
    "<EnumitemBuilderPanel",
    "workspace enumitem panel route",
  );
  assertIncludes(
    workspaceSource,
    'blockId: "enumitem-setup"',
    "enumitem generated setup block",
  );
});

test("Enumitem import path uses active file content and exposes label presets", () => {
  assertIncludes(
    workspaceSource,
    "activeFileContent={activeFileContent}",
    "workspace active source handoff",
  );
  assertIncludes(
    workspaceSource,
    "void importEnumitem(activeFileContent)",
    "enumitem source import effect",
  );
  assertIncludes(
    workspaceSource,
    "ENUMITEM_CUSTOM_ENUM_LABELS",
    "enumitem custom enumerate presets",
  );
  assertIncludes(
    workspaceSource,
    "ENUMITEM_CUSTOM_ITEMIZE_LABELS",
    "enumitem custom itemize presets",
  );
  assertIncludes(
    rustPackageStudioSource,
    "imports_enumitem_setup_from_existing_source",
    "Rust enumitem import regression test",
  );
});

test("Package Studio input handlers do not keep React event currentTarget references", () => {
  assertNotIncludes(
    workspaceSource,
    "currentTarget.value",
    "Package Studio event handlers",
  );
  assertNotIncludes(
    workspaceSource,
    "currentTarget.checked",
    "Package Studio event handlers",
  );
  assertIncludes(
    workspaceSource,
    "const inputValue = (",
    "Package Studio safe input value helper",
  );
  assertIncludes(
    workspaceSource,
    "const inputChecked = (",
    "Package Studio safe input checked helper",
  );
});

test("Fancyhdr builder exposes presets, quick commands, and compact preview modes", () => {
  assertIncludes(
    workspaceSource,
    "FANCYHDR_PRESETS",
    "fancyhdr preset registry",
  );
  assertIncludes(
    workspaceSource,
    "FANCYHDR_COMMAND_CHIPS",
    "fancyhdr quick command registry",
  );
  assertIncludes(
    workspaceSource,
    'setPreviewMode("visual")',
    "fancyhdr visual preview toggle",
  );
  assertIncludes(
    workspaceSource,
    'setPreviewMode("code")',
    "fancyhdr code preview toggle",
  );
  assertIncludes(
    workspaceSource,
    "insertCommandIntoActiveField",
    "fancyhdr active-field command insertion",
  );
  assertIncludes(
    workspaceSource,
    "addCustomPackageOption",
    "fancyhdr custom package option entry",
  );
});

test("Fancyhdr import path is wired from Rust to the active Package Studio UI", () => {
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_import_fancyhdr_cmd",
    "Tauri fancyhdr import command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "imports_fancyhdr_setup_from_existing_source",
    "Rust fancyhdr import regression test",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_import_fancyhdr_cmd",
    "Tauri fancyhdr import handler",
  );
  assertIncludes(
    serviceSource,
    'invoke<FancyhdrBuilderRequest>("package_studio_import_fancyhdr_cmd"',
    "frontend fancyhdr import adapter",
  );
  assertIncludes(
    workspaceSource,
    "void importFancyhdr(activeFileContent)",
    "fancyhdr active source import effect",
  );
  assertIncludes(
    workspaceSource,
    "activeFileContent={activeFileContent}",
    "fancyhdr active source handoff",
  );
});

test("Code highlighting builder exposes language-aware body snippets", () => {
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_generate_code_highlighting_snippet_cmd",
    "Rust code highlighting snippet command",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_generate_code_highlighting_snippet_cmd",
    "Tauri code highlighting snippet handler",
  );
  assertIncludes(
    serviceSource,
    "generateCodeHighlightingSnippet",
    "frontend code highlighting snippet adapter",
  );
  assertIncludes(
    workspaceSource,
    "LANGUAGES_DB",
    "Package Studio language database reuse",
  );
  assertIncludes(
    workspaceSource,
    "codeLanguageOptions",
    "code highlighting language option filtering",
  );
  assertIncludes(
    workspaceSource,
    "snippetOutput",
    "code highlighting generated snippet preview",
  );
  assertIncludes(
    workspaceSource,
    "onInsertCode(snippetOutput)",
    "code highlighting cursor insertion",
  );
});

test("Code highlighting import path is wired from Rust to the active Package Studio UI", () => {
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_import_code_highlighting_cmd",
    "Rust code highlighting import command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "imports_listings_setup_from_existing_source",
    "Rust listings import regression test",
  );
  assertIncludes(
    rustPackageStudioSource,
    "imports_minted_setup_from_existing_source",
    "Rust minted import regression test",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_import_code_highlighting_cmd",
    "Tauri code highlighting import handler",
  );
  assertIncludes(
    serviceSource,
    "importCodeHighlighting",
    "frontend code highlighting import adapter",
  );
  assertIncludes(
    workspaceSource,
    "void importCodeHighlighting(activeFileContent)",
    "code highlighting active source import effect",
  );
});

test("Xcolor import path is wired from Rust to the active Package Studio UI", () => {
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_import_xcolor_cmd",
    "Rust xcolor import command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "imports_xcolor_palette_from_existing_source",
    "Rust xcolor import regression test",
  );
  assertIncludes(
    rustPackageStudioSource,
    "xcolor_import_deduplicates_palette_names",
    "Rust xcolor import dedupe regression test",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_import_xcolor_cmd",
    "Tauri xcolor import handler",
  );
  assertIncludes(
    serviceSource,
    "importXcolor",
    "frontend xcolor import adapter",
  );
  assertIncludes(
    workspaceSource,
    "void importXcolor(activeFileContent)",
    "xcolor active source import effect",
  );
});

test("Geometry import path preserves document-class twoside semantics", () => {
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_import_geometry_cmd",
    "Rust geometry import command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "imports_geometry_setup_and_documentclass_twoside",
    "Rust geometry import regression test",
  );
  assertIncludes(
    rustPackageStudioSource,
    "imported_twoside_is_not_emitted_as_geometry_option",
    "Rust geometry twoside regression test",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_import_geometry_cmd",
    "Tauri geometry import handler",
  );
  assertIncludes(
    serviceSource,
    "importGeometry",
    "frontend geometry import adapter",
  );
  assertIncludes(
    workspaceSource,
    "void importGeometry(activeFileContent)",
    "geometry active source import effect",
  );
  assertIncludes(
    workspaceSource,
    "Two-sided (document class)",
    "geometry twoside UI hint",
  );
});

test("Graphicx builder is wired end to end with body snippet insertion", () => {
  assertIncludes(
    rustBuilderRegistrySource,
    "pub mod graphicx;",
    "Rust graphicx builder module",
  );
  assertIncludes(
    rustBuilderRegistrySource,
    'id: "graphicx".to_string()',
    "Rust graphicx builder descriptor",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_generate_graphicx_cmd",
    "Tauri graphicx generate command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_import_graphicx_cmd",
    "Tauri graphicx import command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn import_graphicx_from_source",
    "Rust graphicx source import",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_generate_graphicx_cmd",
    "Tauri graphicx generate handler",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_import_graphicx_cmd",
    "Tauri graphicx import handler",
  );
  assertIncludes(
    serviceSource,
    "generateGraphicx",
    "frontend graphicx adapter",
  );
  assertIncludes(
    serviceSource,
    "importGraphicx",
    "frontend graphicx import adapter",
  );
  assertIncludes(
    workspaceSource,
    "<GraphicxBuilderPanel",
    "workspace graphicx panel route",
  );
  assertIncludes(
    workspaceSource,
    "activeFileContent={activeFileContent}",
    "workspace graphicx active source prop",
  );
  assertIncludes(
    workspaceSource,
    "void importGraphicx(activeFileContent)",
    "workspace graphicx active source import effect",
  );
  assertIncludes(
    workspaceSource,
    "onInsertCode(output.code)",
    "graphicx cursor insertion",
  );
  assertIncludes(
    workspaceSource,
    "generatedBlocks={[]}",
    "graphicx does not write body snippet as preamble block",
  );
  assertIncludes(
    workspaceSource,
    'await import("@tauri-apps/plugin-dialog")',
    "graphicx native image picker",
  );
  assertIncludes(
    workspaceSource,
    'extensions: ["png", "jpg", "jpeg", "pdf", "eps", "svg"]',
    "graphicx file picker extensions",
  );
});

test("Table Workbench builder is wired end to end with body snippet insertion", () => {
  assertIncludes(
    rustBuilderRegistrySource,
    "pub mod tables;",
    "Rust tables builder module",
  );
  assertIncludes(
    rustBuilderRegistrySource,
    'id: "tables".to_string()',
    "Rust tables builder descriptor",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_generate_table_cmd",
    "Tauri table generate command",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_generate_table_cmd",
    "Tauri table generate handler",
  );
  assertIncludes(
    serviceSource,
    "generateTable",
    "frontend table adapter",
  );
  assertIncludes(
    serviceSource,
    "export interface TableBuilderRequest",
    "frontend table request type",
  );
  assertIncludes(
    serviceSource,
    "export interface TableCellStyle",
    "frontend table cell style type",
  );
  assertIncludes(
    serviceSource,
    "backgroundColor: string;",
    "frontend table background color style",
  );
  assertIncludes(
    serviceSource,
    "textColor: string;",
    "frontend table text color style",
  );
  assertIncludes(
    serviceSource,
    "verticalAlignment: string;",
    "frontend table vertical alignment style",
  );
  assertIncludes(
    serviceSource,
    "columnWeights: string[];",
    "frontend table tabularray column weights",
  );
  assertIncludes(
    workspaceSource,
    "<TableBuilderPanel",
    "workspace table panel route",
  );
  assertIncludes(
    workspaceSource,
    "managedPackageIds={[\"tabularray\", \"booktabs\"]}",
    "table package activation",
  );
  assertIncludes(
    workspaceSource,
    "updateActiveCellStyle",
    "table active cell styling controls",
  );
  assertIncludes(
    workspaceSource,
    "cellStyles",
    "table cell style state",
  );
  assertIncludes(
    serviceSource,
    "export interface TableCellSpan",
    "frontend table cell span type",
  );
  assertIncludes(
    workspaceSource,
    "cellSpans",
    "table cell span state",
  );
  assertIncludes(
    workspaceSource,
    "mergeSelection",
    "table merge selection control",
  );
  assertIncludes(
    workspaceSource,
    "splitActiveCell",
    "table split cell control",
  );
  assertIncludes(
    workspaceSource,
    "beginCellSelection",
    "table spreadsheet-style mouse selection start",
  );
  assertIncludes(
    workspaceSource,
    "extendCellSelection",
    "table spreadsheet-style mouse selection drag",
  );
  assertIncludes(
    workspaceSource,
    'aria-label="Active column alignment"',
    "table active-column alignment in toolbar",
  );
  assertIncludes(
    workspaceSource,
    'aria-label="Table placement"',
    "table float placement in toolbar",
  );
  assertIncludes(
    workspaceSource,
    "insertTableRow",
    "table active-row insertion command",
  );
  assertIncludes(
    workspaceSource,
    "insertTableColumn",
    "table active-column insertion command",
  );
  assertIncludes(
    workspaceSource,
    'aria-label="Remove active column"',
    "table active-column removal command",
  );
  assertIncludes(
    workspaceSource,
    "hasMergedTableCells",
    "safe table span reset during structural edits",
  );
  assertIncludes(
    workspaceSource,
    "parseDelimitedTableText",
    "table CSV/TSV import parser",
  );
  assertIncludes(
    workspaceSource,
    'aria-label="Paste CSV or spreadsheet data"',
    "table spreadsheet paste input",
  );
  assertIncludes(
    workspaceSource,
    "Import grid",
    "table spreadsheet import action",
  );
  assertIncludes(
    workspaceSource,
    'aria-label="Table color"',
    "table color picker in toolbar",
  );
  assertIncludes(
    workspaceSource,
    'aria-label="Selected cell vertical alignment"',
    "table tabularray vertical alignment control",
  );
  assertIncludes(
    workspaceSource,
    'aria-label="Active tabularray column weight"',
    "table tabularray weighted column control",
  );
  assertIncludes(
    workspaceSource,
    "output?.warnings.map",
    "table builder warning display",
  );
  assertIncludes(
    workspaceSource,
    "applyTableColor",
    "table cell row column color commands",
  );
  assertIncludes(
    workspaceSource,
    "Clear selected table cell styles",
    "table clear cell styles command",
  );
  assertIncludes(
    rustTablesBuilderSource,
    'package_id: "xcolor"',
    "table xcolor package requirement",
  );
  assertIncludes(
    rustTablesBuilderSource,
    "\\cellcolor[HTML]",
    "standard table cell background output",
  );
  assertIncludes(
    rustTablesBuilderSource,
    "bg=datatable",
    "tabularray table background output",
  );
  assertIncludes(
    rustTablesBuilderSource,
    "valign=",
    "tabularray vertical alignment output",
  );
  assertIncludes(
    rustTablesBuilderSource,
    "font={",
    "tabularray font styling output",
  );
  assertIncludes(
    rustTablesBuilderSource,
    "tabularray_colspec",
    "tabularray weighted column output",
  );
  assertIncludes(
    rustTablesBuilderSource,
    "longtblr-label-without-caption",
    "longtblr caption/label warning",
  );
  assertIncludes(
    rustTablesBuilderSource,
    "longtblr-non-floating-table",
    "longtblr ignored float controls warning",
  );
  assertIncludes(
    workspaceSource,
    "onMouseEnter={() =>",
    "table grid drag selection event",
  );
  assertIncludes(
    workspaceSource,
    "onInsertCode(output.code)",
    "table cursor insertion",
  );
});

test("Siunitx builder is wired end to end with setup and body snippets", () => {
  assertIncludes(
    rustBuilderRegistrySource,
    "pub mod siunitx;",
    "Rust siunitx builder module",
  );
  assertIncludes(
    rustBuilderRegistrySource,
    'id: "siunitx".to_string()',
    "Rust siunitx builder descriptor",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_generate_siunitx_cmd",
    "Tauri siunitx generate command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_import_siunitx_cmd",
    "Tauri siunitx import command",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_generate_siunitx_cmd",
    "Tauri siunitx generate handler",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_import_siunitx_cmd",
    "Tauri siunitx import handler",
  );
  assertIncludes(
    serviceSource,
    "export interface SiunitxBuilderRequest",
    "frontend siunitx request type",
  );
  assertIncludes(
    serviceSource,
    "compatibilityWarnings?: BuilderWarning[]",
    "frontend siunitx compatibility warnings",
  );
  assertIncludes(
    serviceSource,
    "generateSiunitx",
    "frontend siunitx adapter",
  );
  assertIncludes(
    serviceSource,
    "importSiunitx",
    "frontend siunitx import adapter",
  );
  assertIncludes(
    workspaceSource,
    "<SiunitxBuilderPanel",
    "workspace siunitx panel route",
  );
  assertIncludes(
    workspaceSource,
    "const SiunitxLivePreview",
    "workspace siunitx live preview component",
  );
  assertIncludes(
    workspaceSource,
    "Compound unit:",
    "workspace siunitx compound unit preview",
  );
  assertIncludes(
    workspaceSource,
    "void importSiunitx(activeFileContent)",
    "workspace siunitx import path",
  );
  assertIncludes(
    rustSiunitxBuilderSource,
    "siunitx-incomplete-range",
    "siunitx range diagnostics",
  );
  assertIncludes(
    workspaceSource,
    'managedPackageIds={["siunitx"]}',
    "siunitx package activation",
  );
  assertIncludes(
    workspaceSource,
    'blockId: "siunitx-setup"',
    "siunitx setup generated block",
  );
  assertIncludes(
    workspaceSource,
    "SIUNITX_PRESETS",
    "siunitx quantity presets",
  );
  assertIncludes(
    workspaceSource,
    '"\\\\yotta"',
    "siunitx full SI prefix catalog",
  );
  assertIncludes(
    workspaceSource,
    '"\\\\tesla"',
    "siunitx derived unit catalog",
  );
  assertIncludes(
    workspaceSource,
    '"data-rate"',
    "siunitx practical compound unit presets",
  );
  assertIncludes(
    workspaceSource,
    "toSuperscript",
    "siunitx exponent preview formatting",
  );
  assertIncludes(
    rustSiunitxBuilderSource,
    "\\qtylist",
    "siunitx quantity list output",
  );
  assertIncludes(
    rustSiunitxBuilderSource,
    "\\sisetup",
    "siunitx setup output",
  );
  assertIncludes(
    rustSiunitxBuilderSource,
    "siunitx-prefix-on-special-unit",
    "siunitx unit diagnostics",
  );
  assertIncludes(
    rustPackageStudioSource,
    "siunitx-legacy-command-",
    "siunitx legacy command diagnostics",
  );
  assertIncludes(
    rustPackageStudioSource,
    "is_siunitx_version_sensitive_option",
    "siunitx version-sensitive option diagnostics",
  );
});

test("AMS math builder is wired end to end with environments, matrices, and mathtools snippets", () => {
  assertIncludes(
    rustBuilderRegistrySource,
    "pub mod math;",
    "Rust math builder module",
  );
  assertIncludes(
    rustBuilderRegistrySource,
    'id: "math".to_string()',
    "Rust math builder descriptor",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_generate_math_cmd",
    "Tauri math generate command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_import_math_cmd",
    "Tauri math import command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn package_studio_list_math_imports_cmd",
    "Tauri math import list command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn import_math_from_source",
    "Rust math source importer",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_generate_math_cmd",
    "Tauri math generate handler",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_import_math_cmd",
    "Tauri math import handler",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_list_math_imports_cmd",
    "Tauri math import list handler",
  );
  assertIncludes(
    serviceSource,
    "export interface MathBuilderRequest",
    "frontend math request type",
  );
  assertIncludes(
    serviceSource,
    "importedSourceRange",
    "frontend math import range field",
  );
  assertIncludes(
    serviceSource,
    "generateMath",
    "frontend math adapter",
  );
  assertIncludes(
    serviceSource,
    "importMath",
    "frontend math import adapter",
  );
  assertIncludes(
    serviceSource,
    "listMathImports",
    "frontend math import list adapter",
  );
  assertIncludes(
    workspaceSource,
    "<MathBuilderPanel",
    "workspace math panel route",
  );
  assertIncludes(
    workspaceSource,
    "activeFileContent={activeFileContent}",
    "workspace math source import prop",
  );
  assertIncludes(
    workspaceSource,
    "onReviewEditPlan={onReviewEditPlan}",
    "workspace math replacement review route",
  );
  assertIncludes(
    workspaceSource,
    "Replace imported",
    "math imported snippet replacement action",
  );
  assertIncludes(
    workspaceSource,
    "Detected math snippets",
    "math detected snippet picker",
  );
  assertIncludes(
    workspaceSource,
    "Builder controls",
    "math builder controls are grouped",
  );
  assertIncludes(
    workspaceSource,
    "Source & actions",
    "math source and actions card",
  );
  assertIncludes(
    workspaceSource,
    "No supported math snippets were detected",
    "math import empty state",
  );
  assertIncludes(
    workspaceSource,
    "MathLatexPreview",
    "math KaTeX preview component",
  );
  assertIncludes(
    workspaceSource,
    "katex.renderToString",
    "math preview uses KaTeX renderToString",
  );
  assertIncludes(
    workspaceSource,
    "buildMathPreviewExpression",
    "math preview normalizes generated snippets",
  );
  assertIncludes(
    workspaceSource,
    "normalizeMathPreviewForKatex",
    "math preview has KaTeX-safe fallback normalization",
  );
  assertIncludes(
    workspaceSource,
    "xrightleftharpoons",
    "mathtools harpoon arrows are exposed",
  );
  assertIncludes(
    workspaceSource,
    "MATH_DELIMITER_TYPES",
    "math delimited snippet controls",
  );
  assertIncludes(
    serviceSource,
    "delimiterMathType",
    "frontend math delimited request field",
  );
  assertIncludes(
    rustMathBuilderSource,
    "format_delimited_math",
    "Rust math delimited snippet generator",
  );
  assertIncludes(
    rustPackageStudioSource,
    "collect_math_delimiter_imports",
    "Rust math delimiter importer",
  );
  assertIncludes(
    workspaceSource,
    'managedPackageIds={["amsmath", "mathtools"]}',
    "math package activation",
  );
  assertIncludes(
    workspaceSource,
    "MATH_ENVIRONMENTS",
    "math environment catalog",
  );
  assertIncludes(
    workspaceSource,
    "MATHTOOLS_ARROWS",
    "mathtools arrow catalog",
  );
  assertIncludes(
    workspaceSource,
    "MATHTOOLS_TAG_ACTIONS",
    "mathtools tag action catalog",
  );
  assertIncludes(
    workspaceSource,
    "Equation references use amsmath",
    "math tag package guidance distinguishes amsmath and mathtools",
  );
  assertIncludes(
    workspaceSource,
    "New siunitx snippet",
    "siunitx reset action is written as snippet creation",
  );
  assertIncludes(
    workspaceSource,
    "preamble setup",
    "siunitx status strip shows setup target",
  );
  assertIncludes(
    workspaceSource,
    "Body snippets can be inserted directly at the cursor",
    "siunitx status strip explains insertion flow",
  );
  assertIncludes(
    rustMathBuilderSource,
    "\\DeclarePairedDelimiter",
    "mathtools paired delimiter output",
  );
  assertIncludes(
    rustMathBuilderSource,
    "\\newtagform",
    "mathtools tag form output",
  );
  assertIncludes(
    rustMathBuilderSource,
    "math-empty-tag-form-name",
    "math tag diagnostics",
  );
  assertIncludes(
    rustMathBuilderSource,
    "math-empty-delimiter-command",
    "math builder diagnostics",
  );
  assertIncludes(
    rustPackageStudioSource,
    "imports_math_environment_from_existing_source",
    "math environment import test",
  );
  assertIncludes(
    rustPackageStudioSource,
    "lists_multiple_math_import_candidates_in_source_order",
    "math import candidate list test",
  );
  assertIncludes(
    rustPackageStudioSource,
    "imported_source_range",
    "math imported source range tracking",
  );
});
