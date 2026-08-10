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
const stoicheiaLoaderSource = await source(
  "src/features/stoicheia/bridge/loadFrontend.ts",
);
const stoicheiaDocumentBridgeSource = await source(
  "src/features/stoicheia/bridge/documentBridge.ts",
);
const stoicheiaAdapterSource = await source(
  "src/features/stoicheia/bridge/StoicheiaPackageStudioAdapter.tsx",
);
const stoicheiaHeaderSource = await source(
  "src/features/stoicheia/components/AppHeader.tsx",
);
const tabsStoreSource = await source("src/stores/useTabsStore.ts");

test("Package Studio sidebar builder selection stays open and preserves editor content", () => {
  assertIncludes(
    appSource,
    "!viewKeepsEditorMounted(activeView)",
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

test("Graphics Studio stays behind a conditional lazy frontend boundary", () => {
  assertNotIncludes(
    appSource,
    "features/stoicheia",
    "DataTeX application shell",
  );
  assertNotIncludes(
    sidebarSource,
    "features/stoicheia",
    "Package Studio sidebar",
  );
  assertNotIncludes(
    serviceSource,
    "features/stoicheia",
    "Package Studio service",
  );
  assertIncludes(
    workspaceSource,
    "const LazyStoicheiaPackageStudio = React.lazy",
    "Package Studio graphics lazy component",
  );
  assertIncludes(
    workspaceSource,
    'activeBuilder?.id === "graphics-studio"',
    "Package Studio graphics full-bleed gate",
  );
  assertIncludes(
    workspaceSource,
    "<LazyStoicheiaPackageStudio",
    "Package Studio graphics mount",
  );
  assertIncludes(
    workspaceSource,
    "hostDocument={stoicheiaHostDocument}",
    "Package Studio active-document bridge",
  );
  assertIncludes(
    workspaceSource,
    "activeFileContent === undefined",
    "Package Studio empty-document guard",
  );
  assertIncludes(
    workspaceSource,
    'sessionId: `${stoicheiaWorkspaceSessionId}:tikzpicture:${target.ordinal}:${graphicsSessionMode.focus.baselineSha256}`',
    "Package Studio target- and source-scoped document session",
  );
  assertIncludes(
    stoicheiaLoaderSource,
    'import("./StoicheiaPackageStudioAdapter")',
    "Stoicheia dynamic frontend entry",
  );
  assertNotIncludes(
    workspaceSource,
    "void loadStoicheiaFrontend()",
    "Package Studio preload-only effect",
  );
  assertNotIncludes(
    workspaceSource,
    'from "../../features/stoicheia/App"',
    "Package Studio workspace",
  );
});

test("Graphics Studio bypasses the normal hero, context, and scrolling builder shell", () => {
  const graphicsBranch = workspaceSource.indexOf(
    'activeBuilder?.id === "graphics-studio"',
  );
  const normalScrollShell = workspaceSource.indexOf(
    'className="package-studio-main-scroll"',
  );
  const graphicsMount = workspaceSource.indexOf("<LazyStoicheiaPackageStudio");

  assert.ok(graphicsBranch >= 0, "graphics full-bleed branch is missing");
  assert.ok(graphicsMount > graphicsBranch, "graphics mount must be inside its branch");
  assert.ok(
    normalScrollShell > graphicsMount,
    "normal scroll shell must follow the full-bleed graphics branch",
  );
});

test("Graphics Studio routes full-document changes through Rust and DataTeX review", () => {
  assertIncludes(
    serviceSource,
    "export interface GraphicsDocumentEditRequest",
    "Graphics document edit service contract",
  );
  assertIncludes(
    serviceSource,
    '"package_studio_plan_graphics_document_edit_cmd"',
    "Graphics document edit service command",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub struct GraphicsDocumentEditRequest",
    "Rust Graphics document request",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn plan_graphics_document_edit",
    "Rust Graphics document planner",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_plan_graphics_document_edit_cmd",
    "Graphics document command registration",
  );
  assertIncludes(
    workspaceSource,
    "onRequestApply={handleGraphicsRequestApply}",
    "Stoicheia Apply host callback",
  );
  assertIncludes(
    workspaceSource,
    "data-graphics-edit-review",
    "Graphics in-window review surface",
  );
  assertIncludes(
    workspaceSource,
    "graphicsPayloadMatchesDocument",
    "Graphics async session guard",
  );
  assertIncludes(
    workspaceSource,
    "onRequestSave={",
    "Graphics reviewed host-save bridge",
  );
  assertIncludes(
    workspaceSource,
    "handleGraphicsRequestSave",
    "Graphics explicit Save callback",
  );
  assertIncludes(
    appSource,
    'tab.type === "editor" && tab.id === targetFilePath',
    "Package Studio target-tab binding",
  );
  assertIncludes(
    appSource,
    "if (currentSource !== source)",
    "Package Studio pre-review stale-source guard",
  );
  assertIncludes(
    appSource,
    "return applied;",
    "Package Studio confirmed Apply result",
  );
});

test("Graphics Studio discovers and applies a range-safe tikzpicture target", () => {
  assertIncludes(
    appSource,
    "const toUtf8Byte = (editorPosition: unknown) =>",
    "Package Studio Monaco focus capture",
  );
  assertIncludes(
    appSource,
    "stringIndexToUtf8ByteOffset(source, utf16Offset)",
    "Package Studio UTF-8 focus conversion call",
  );
  assertIncludes(
    serviceSource,
    "new TextEncoder().encode(source.slice(0, safeIndex)).length",
    "Package Studio UTF-8 focus conversion implementation",
  );
  assertIncludes(
    appSource,
    "activeFileFocus={packageStudioSourceFocus}",
    "Package Studio source-focus bridge",
  );
  assertNotIncludes(
    appSource,
    "features/stoicheia",
    "DataTeX focus capture",
  );

  assertIncludes(
    serviceSource,
    '"package_studio_discover_graphics_tikzpictures_cmd"',
    "Graphics target discovery service command",
  );
  assertIncludes(
    serviceSource,
    '"package_studio_prepare_graphics_tikzpicture_cmd"',
    "Graphics target preparation service command",
  );
  assertIncludes(
    serviceSource,
    '"package_studio_plan_graphics_tikzpicture_edit_cmd"',
    "Graphics range-edit planning service command",
  );

  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_discover_graphics_tikzpictures_cmd",
    "Graphics target discovery command registration",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_prepare_graphics_tikzpicture_cmd",
    "Graphics target preparation command registration",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_plan_graphics_tikzpicture_edit_cmd",
    "Graphics range-edit command registration",
  );

  assertIncludes(
    workspaceSource,
    "data-graphics-target-selector",
    "Graphics in-window target selector",
  );
  assertIncludes(
    workspaceSource,
    "data-graphics-target-mode={graphicsSessionMode.kind}",
    "Graphics selected-target mode bar",
  );
  assertIncludes(
    workspaceSource,
    '"Range-safe"',
    "Graphics range-safe target label",
  );
  assertIncludes(
    workspaceSource,
    "selectGraphicsTikzpictureFromFocus",
    "Graphics cursor/selection target resolution",
  );
  assertIncludes(
    workspaceSource,
    "await planGraphicsTikzpictureEdit({",
    "Graphics range-safe edit planner",
  );

  const applyHandler = workspaceSource.indexOf(
    "const handleApplyPendingReview = useCallback",
  );
  const validate = workspaceSource.indexOf(
    "pendingGraphicsApply.lifecycle.validate()",
    applyHandler,
  );
  const hostApply = workspaceSource.indexOf(
    "onApplyPendingEditPlan?.()",
    validate,
  );
  const commit = workspaceSource.indexOf(
    "pendingGraphicsApply.lifecycle.commit(appliedSource)",
    hostApply,
  );

  assert.ok(applyHandler >= 0, "Graphics confirmed Apply handler is missing");
  assert.ok(
    validate > applyHandler,
    "Graphics lifecycle validation must be inside the confirmed Apply handler",
  );
  assert.ok(
    hostApply > validate,
    "Graphics lifecycle must validate before the host Apply",
  );
  assert.ok(
    commit > hostApply,
    "Graphics lifecycle must commit only after the host Apply succeeds",
  );
  assertIncludes(
    workspaceSource,
    "onRequestSave={",
    "Graphics reviewed host-save bridge",
  );
});

test("Graphics Studio saves only after review, Apply, and bridge commit", () => {
  assertIncludes(
    serviceSource,
    "export interface PackageStudioHostSaveRequest",
    "DataTeX host-save request contract",
  );
  assertIncludes(
    workspaceSource,
    'void handleGraphicsRequestAction("save", payload, lifecycle)',
    "Graphics Save review intent",
  );
  assertIncludes(
    workspaceSource,
    "onSaveHostDocument({",
    "Graphics narrow DataTeX persistence callback",
  );
  assertIncludes(
    appSource,
    "const handleSavePackageStudioDocument = useCallback",
    "DataTeX Package Studio Save handler",
  );
  assertIncludes(
    appSource,
    "onSaveHostDocument={",
    "DataTeX Package Studio Save wiring",
  );
  assertIncludes(
    appSource,
    "onSaveFile={handleSaveFromActiveSurface}",
    "DataTeX global toolbar Save routing",
  );
  assertIncludes(
    appSource,
    "onRegisterGraphicsSaveRequest={",
    "Graphics Save request registration",
  );

  const applyHandlerStart = workspaceSource.indexOf(
    "const handleApplyPendingReview = useCallback",
  );
  const applyHandlerEnd = workspaceSource.indexOf(
    "const handleDismissPendingReview = useCallback",
    applyHandlerStart,
  );
  const applyHandlerSource = workspaceSource.slice(
    applyHandlerStart,
    applyHandlerEnd,
  );
  const validate = applyHandlerSource.indexOf(
    "pendingGraphicsApply.lifecycle.validate()",
  );
  const hostApply = applyHandlerSource.indexOf(
    "onApplyPendingEditPlan?.()",
    validate,
  );
  const commit = applyHandlerSource.indexOf(
    "pendingGraphicsApply.lifecycle.commit(appliedSource)",
    hostApply,
  );
  const saveIntent = applyHandlerSource.indexOf(
    'pendingGraphicsApply.intent === "save"',
    commit,
  );
  const hostSave = applyHandlerSource.indexOf(
    "saveCommittedGraphicsDocument(",
    saveIntent,
  );

  assert.ok(applyHandlerStart >= 0, "Graphics confirmed Apply handler is missing");
  assert.ok(validate >= 0, "Graphics Save must validate the frozen lifecycle");
  assert.ok(hostApply > validate, "Graphics Save must Apply after validation");
  assert.ok(commit > hostApply, "Graphics Save must commit after host Apply");
  assert.ok(saveIntent > commit, "Graphics Save intent must be checked after commit");
  assert.ok(hostSave > saveIntent, "DataTeX Save must run only after commit");
  assertIncludes(
    applyHandlerSource,
    "return committed;",
    "Graphics Apply/Save committed result",
  );

  const hostSaveHandlerStart = appSource.indexOf(
    "const handleSavePackageStudioDocument = useCallback",
  );
  const hostSaveHandlerEnd = appSource.indexOf(
    "// --- Compilation Hook ---",
    hostSaveHandlerStart,
  );
  const hostSaveHandlerSource = appSource.slice(
    hostSaveHandlerStart,
    hostSaveHandlerEnd,
  );
  assert.ok(
    hostSaveHandlerStart >= 0 && hostSaveHandlerEnd > hostSaveHandlerStart,
    "DataTeX host-save handler scope is missing",
  );
  assertIncludes(
    hostSaveHandlerSource,
    "tab.id === request.documentId",
    "DataTeX Save document identity guard",
  );
  assertIncludes(
    hostSaveHandlerSource,
    "tab.id === request.targetFilePath",
    "DataTeX Save path identity guard",
  );
  assertIncludes(
    hostSaveHandlerSource,
    '(targetTab.content ?? "") !== request.source',
    "DataTeX Save exact-source guard",
  );
  assertIncludes(
    hostSaveHandlerSource,
    "persistTabSource(",
    "DataTeX reviewed-source persistence",
  );
  assertIncludes(
    appSource,
    "fileSaveQueueRef.current.get(filePath)",
    "per-file ordered Save queue",
  );
  assertIncludes(
    appSource,
    "return targetStillExists;",
    "post-write target identity result",
  );
  assertIncludes(
    hostSaveHandlerSource,
    "latestEditorSourceRef.current",
    "post-Save newer-editor-source guard",
  );
  assertIncludes(
    stoicheiaDocumentBridgeSource,
    "useEditorStore.getState().source === payload.nextSource",
    "reviewed local-draft lifecycle guard",
  );
  assertNotIncludes(
    workspaceSource,
    "writeTextFile",
    "Graphics workspace direct filesystem access",
  );
  assertNotIncludes(
    stoicheiaAdapterSource,
    "writeTextFile",
    "Stoicheia adapter direct filesystem access",
  );
  assertNotIncludes(
    stoicheiaHeaderSource,
    "writeTextFile",
    "Stoicheia embedded header direct filesystem access",
  );
});

test("Graphics Studio Save As and exact SVG export stay host-owned and revision-safe", () => {
  assertIncludes(
    serviceSource,
    "export interface PackageStudioHostSaveAsPickRequest",
    "Save As destination-pick contract",
  );
  assertIncludes(
    serviceSource,
    "export interface PackageStudioHostSaveAsRequest",
    "Save As persistence contract",
  );
  assertIncludes(
    serviceSource,
    "export interface PackageStudioHostSvgExportRequest",
    "SVG export contract",
  );
  assertIncludes(
    workspaceSource,
    "onRequestSaveAs={",
    "embedded Save As host bridge",
  );
  assertIncludes(
    workspaceSource,
    "onRequestExportSvg={",
    "embedded SVG export host bridge",
  );

  const saveAsHandlerStart = workspaceSource.indexOf(
    "const handleGraphicsRequestSaveAs = useCallback",
  );
  const chooseDestination = workspaceSource.indexOf(
    "await onChooseHostSaveAsTarget({",
    saveAsHandlerStart,
  );
  const requestReview = workspaceSource.indexOf(
    'await handleGraphicsRequestAction(\n          "saveAs"',
    chooseDestination,
  );
  assert.ok(saveAsHandlerStart >= 0, "Graphics Save As handler is missing");
  assert.ok(
    chooseDestination > saveAsHandlerStart,
    "Save As must choose its host destination inside the handler",
  );
  assert.ok(
    requestReview > chooseDestination,
    "Save As must freeze the selected destination before creating review",
  );
  assertIncludes(
    workspaceSource,
    "pendingGraphicsApply.saveAsTargetFilePath",
    "review-owned Save As target",
  );
  assertIncludes(
    stoicheiaDocumentBridgeSource,
    "validateCommitted:",
    "post-commit local-draft guard",
  );
  assertIncludes(
    workspaceSource,
    "pendingGraphicsApply.lifecycle.validateCommitted(appliedSource)",
    "Save As post-commit draft revalidation",
  );
  assertIncludes(
    workspaceSource,
    "saveAsCommittedGraphicsDocument(",
    "post-commit Save As persistence",
  );
  assertIncludes(
    appSource,
    "const handleSaveAsPackageStudioDocument = useCallback",
    "DataTeX Save As persistence handler",
  );
  assertIncludes(
    appSource,
    "retargetEditorTab(",
    "atomic post-write tab retarget",
  );
  assertIncludes(
    tabsStoreSource,
    "(sourceTab.content ?? \"\") !== expectedSource",
    "atomic tab-retarget stale-source guard",
  );
  assertIncludes(
    tabsStoreSource,
    "destinationCollision",
    "atomic tab-retarget collision guard",
  );
  assertIncludes(
    appSource,
    "onSaveAs={handleSaveAsFromActiveSurface}",
    "global Save As routing",
  );

  assertIncludes(
    stoicheiaHeaderSource,
    "compiledSource === source",
    "exact compiled-source SVG gate",
  );
  assertIncludes(
    stoicheiaDocumentBridgeSource,
    "sanitizeExactSvg(svgSource)",
    "SVG sanitizer boundary",
  );
  assertIncludes(
    stoicheiaDocumentBridgeSource,
    "fingerprintDocumentSource(currentSvg) === payload.svgRevision",
    "SVG render revision guard",
  );
  assertIncludes(
    appSource,
    "const handleExportPackageStudioSvg = useCallback",
    "DataTeX-owned SVG exporter",
  );
  const svgHostHandlerStart = appSource.indexOf(
    "const handleExportPackageStudioSvg = useCallback",
  );
  const svgDialog = appSource.indexOf(
    'title: "Export exact SVG"',
    svgHostHandlerStart,
  );
  const svgPostDialogValidation = appSource.indexOf(
    "if (!sourceDocumentExists() || !request.validate())",
    svgDialog,
  );
  const svgWrite = appSource.indexOf("await writeTextFile(", svgDialog);
  assert.ok(svgDialog > svgHostHandlerStart, "host SVG dialog is missing");
  assert.ok(
    svgPostDialogValidation > svgDialog,
    "SVG freshness must be revalidated after the host dialog",
  );
  assert.ok(
    svgWrite > svgPostDialogValidation,
    "SVG write must happen only after post-dialog validation",
  );
  assertNotIncludes(
    workspaceSource,
    "writeTextFile",
    "Graphics workspace direct file export",
  );
  assertNotIncludes(
    stoicheiaAdapterSource,
    "exportSvgFile",
    "embedded adapter standalone SVG exporter",
  );
});

test("Graphics Studio creates a new drawing and inserts it through Rust-owned review", () => {
  assertIncludes(
    serviceSource,
    "export interface GraphicsNewDrawingTemplateRequest",
    "Graphics new-drawing template service contract",
  );
  assertIncludes(
    serviceSource,
    "export interface GraphicsDrawingInsertRequest",
    "Graphics drawing-insert service contract",
  );
  assertIncludes(
    serviceSource,
    "export function prepareGraphicsNewDrawing",
    "Graphics new-drawing template service",
  );
  assertIncludes(
    serviceSource,
    '"package_studio_prepare_graphics_new_drawing_cmd"',
    "Graphics new-drawing template invoke",
  );
  assertIncludes(
    serviceSource,
    "export function planGraphicsDrawingInsert",
    "Graphics drawing-insert planning service",
  );
  assertIncludes(
    serviceSource,
    '"package_studio_plan_graphics_drawing_insert_cmd"',
    "Graphics drawing-insert planner invoke",
  );

  assertIncludes(
    rustPackageStudioSource,
    "pub struct GraphicsNewDrawingTemplateRequest",
    "Rust Graphics new-drawing template request",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub struct GraphicsDrawingInsertRequest",
    "Rust Graphics drawing-insert request",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn prepare_graphics_new_drawing",
    "Rust Graphics new-drawing template planner",
  );
  assertIncludes(
    rustPackageStudioSource,
    "pub fn plan_graphics_drawing_insert",
    "Rust Graphics drawing-insert planner",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_prepare_graphics_new_drawing_cmd",
    "Graphics new-drawing template command registration",
  );
  assertIncludes(
    rustLibSource,
    "package_studio::package_studio_plan_graphics_drawing_insert_cmd",
    "Graphics drawing-insert command registration",
  );

  assertIncludes(
    stoicheiaDocumentBridgeSource,
    'Readonly<{ kind: "newDrawing" }>',
    "Stoicheia new-drawing session target",
  );
  assertIncludes(
    workspaceSource,
    'target: { kind: "newDrawing" }',
    "Graphics new-drawing host target",
  );
  assertIncludes(
    workspaceSource,
    "data-new-drawing-setup",
    "Graphics in-window new-drawing setup",
  );
  assertIncludes(
    workspaceSource,
    "await prepareGraphicsNewDrawing({",
    "Graphics Rust-owned scratch template preparation",
  );

  const applyHandlerStart = workspaceSource.indexOf(
    "const handleGraphicsRequestAction = useCallback",
  );
  const applyHandlerEnd = workspaceSource.indexOf(
    "const handleGraphicsRequestApply = useCallback",
    applyHandlerStart,
  );
  const applyHandlerSource = workspaceSource.slice(
    applyHandlerStart,
    applyHandlerEnd,
  );
  const newDrawingPlan = applyHandlerSource.indexOf(
    "await planGraphicsDrawingInsert({",
  );
  const reviewedPlan = applyHandlerSource.indexOf(
    "const reviewCreated = onReviewEditPlan(",
    newDrawingPlan,
  );

  assert.ok(
    applyHandlerStart >= 0 && applyHandlerEnd > applyHandlerStart,
    "Graphics Apply handler scope is missing",
  );
  assertIncludes(
    applyHandlerSource,
    'payload.target.kind === "newDrawing"',
    "Graphics new-drawing Apply branch",
  );
  assert.ok(
    newDrawingPlan >= 0,
    "Graphics new drawing must use the Rust drawing-insert planner",
  );
  assert.ok(
    reviewedPlan > newDrawingPlan,
    "Graphics drawing insertion must enter DataTeX review after Rust planning",
  );
  assertIncludes(
    applyHandlerSource,
    "setPendingGraphicsApply(nextPending)",
    "Graphics reviewed insertion lifecycle",
  );
  assertNotIncludes(
    applyHandlerSource,
    "handleInsertFromPackageStudio",
    "Graphics new-drawing Apply handler",
  );
  assertNotIncludes(
    applyHandlerSource,
    "onInsertCode",
    "Graphics new-drawing Apply handler",
  );

  const graphicsBranchStart = workspaceSource.indexOf(
    '{activeBuilder?.id === "graphics-studio" ? (',
  );
  const graphicsBranchEnd = workspaceSource.indexOf(
    'className="package-studio-main-scroll"',
    graphicsBranchStart,
  );
  const graphicsBranchSource = workspaceSource.slice(
    graphicsBranchStart,
    graphicsBranchEnd,
  );
  assert.ok(
    graphicsBranchStart >= 0 && graphicsBranchEnd > graphicsBranchStart,
    "Graphics full-bleed render branch is missing",
  );
  assertNotIncludes(
    graphicsBranchSource,
    "onInsertCode",
    "Graphics full-bleed new-drawing UI",
  );
  assertNotIncludes(
    graphicsBranchSource,
    "handleInsertFromPackageStudio",
    "Graphics full-bleed new-drawing UI",
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
