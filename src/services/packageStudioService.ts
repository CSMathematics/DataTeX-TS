import { invoke } from "@tauri-apps/api/core";

export interface SourcePosition {
  byte: number;
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export type PackageDeclarationKind =
  | "usePackage"
  | "requirePackage"
  | "documentClass"
  | "tikzLibrary"
  | "pgfplotsCompat";

export interface PackageDeclaration {
  kind: PackageDeclarationKind;
  name: string;
  options: string[];
  range: SourceRange;
  commandRange: SourceRange;
  raw: string;
}

export type PackageDiagnosticSeverity = "info" | "warning" | "error";

export interface PackageDiagnostic {
  code: string;
  severity: PackageDiagnosticSeverity;
  message: string;
  range: SourceRange | null;
  packageId: string | null;
}

export interface LatexPackageAnalysis {
  schemaVersion: number;
  revision: number;
  declarations: PackageDeclaration[];
  packages: string[];
  documentClass: PackageDeclaration | null;
  diagnostics: PackageDiagnostic[];
}

export interface TextEdit {
  range: SourceRange;
  replacement: string;
}

export interface PackageEditPlan {
  schemaVersion: number;
  revision: number;
  title: string;
  summary: string;
  edits: TextEdit[];
  diagnostics: PackageDiagnostic[];
}

export interface PackageStudioEditReview {
  plan: PackageEditPlan;
  source: string;
  targetFilePath?: string;
}

export interface PackageStudioHostSaveRequest {
  documentId: string;
  targetFilePath: string;
  source: string;
}

export interface PackageStudioHostSaveAsPickRequest {
  documentId: string;
  sourceFilePath: string;
  source: string;
  suggestedFileName: string;
}

export type PackageStudioHostSaveAsPickResult =
  | Readonly<{ status: "selected"; targetFilePath: string }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "failed"; message: string }>;

export interface PackageStudioHostSaveAsRequest {
  documentId: string;
  sourceFilePath: string;
  targetFilePath: string;
  source: string;
  /** Prevents a completed write from retargeting over a newer local draft. */
  validate: () => boolean;
}

export interface PackageStudioHostSvgExportRequest {
  documentId: string;
  sourceFilePath: string;
  svgSource: string;
  suggestedFileName: string;
  /** Revalidates the frozen render immediately before the host writes it. */
  validate: () => boolean;
}

export type PackageStudioHostFileActionResult =
  | Readonly<{ status: "saved"; filePath: string }>
  | Readonly<{ status: "savedDetached"; filePath: string }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "failed"; message: string }>;

/**
 * Exact editor focus captured from the same Monaco model snapshot that is
 * handed to Package Studio. Offsets are UTF-8 bytes so Rust can compare them
 * directly with its source ranges.
 */
export interface PackageStudioSourceFocus {
  documentId: string;
  source: string;
  cursorByte: number;
  selectionStartByte: number;
  selectionEndByte: number;
}

export function stringIndexToUtf8ByteOffset(
  source: string,
  stringIndex: number,
): number {
  const safeIndex = Math.max(0, Math.min(source.length, stringIndex));
  return new TextEncoder().encode(source.slice(0, safeIndex)).length;
}

export function selectGraphicsTikzpictureFromFocus(
  targets: readonly GraphicsTikzpictureTargetDescriptor[],
  focus: PackageStudioSourceFocus | null | undefined,
  documentId: string,
  source: string,
): GraphicsTikzpictureTargetDescriptor | null {
  if (
    !focus ||
    focus.documentId !== documentId ||
    focus.source !== source
  ) {
    return null;
  }

  const selectionStart = Math.min(
    focus.selectionStartByte,
    focus.selectionEndByte,
  );
  const selectionEnd = Math.max(
    focus.selectionStartByte,
    focus.selectionEndByte,
  );
  if (selectionEnd > selectionStart) {
    const selected = targets.filter(
      (target) =>
        target.baselineRange.start.byte <= selectionStart &&
        selectionEnd <= target.baselineRange.end.byte,
    );
    if (selected.length === 1) return selected[0];
  }

  const underCursor = targets.filter(
    (target) =>
      target.baselineRange.start.byte <= focus.cursorByte &&
      focus.cursorByte < target.baselineRange.end.byte,
  );
  return underCursor.length === 1 ? underCursor[0] : null;
}

export function applyPackageTextEdits(
  source: string,
  edits: TextEdit[],
): string {
  return [...edits]
    .sort((a, b) => b.range.start.byte - a.range.start.byte)
    .reduce((current, edit) => {
      const start = utf8ByteOffsetToStringIndex(current, edit.range.start.byte);
      const end = utf8ByteOffsetToStringIndex(current, edit.range.end.byte);
      return `${current.slice(0, start)}${edit.replacement}${current.slice(end)}`;
    }, source);
}

export function utf8ByteOffsetToStringIndex(
  source: string,
  byteOffset: number,
): number {
  let bytes = 0;
  let index = 0;

  for (const char of source) {
    const codePoint = char.codePointAt(0) ?? 0;
    const charBytes =
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
    if (bytes + charBytes > byteOffset) break;
    bytes += charBytes;
    index += char.length;
  }

  return index;
}

export interface AddPackageRequest {
  source: string;
  revision: number;
  packageId: string;
  options?: string[];
  updateExisting?: boolean;
}

export interface RemovePackageRequest {
  source: string;
  revision: number;
  packageId: string;
}

export interface MovePackageRequest {
  source: string;
  revision: number;
  packageId: string;
  target: "latePreamble" | "afterPackage" | string;
  afterPackageId?: string | null;
}

export interface GeneratedBlockRequest {
  source: string;
  revision: number;
  blockId: string;
  code: string;
}

export interface GraphicsDocumentEditRequest {
  schemaVersion: 1;
  revision: number;
  documentId: string;
  targetFilePath: string;
  baselineSource: string;
  replacementSource: string;
  baselineSha256: string;
}

export type GraphicsTikzpictureTarget =
  | { kind: "cursor"; byte: number }
  | { kind: "range"; startByte: number; endByte: number }
  | { kind: "ordinal"; ordinal: number };

export interface GraphicsTikzpictureEditRequest
  extends GraphicsDocumentEditRequest {
  target: GraphicsTikzpictureTarget;
}

export type GraphicsTikzpictureDiscoveryRequest = GraphicsDocumentEditRequest;

export interface GraphicsTikzpictureTargetDescriptor {
  ordinal: number;
  baselineRange: SourceRange;
  replacementRange: SourceRange | null;
  sourceSha256: string;
  label: string;
  preview: string;
  changed: boolean;
}

export interface GraphicsTikzpictureDiscovery {
  schemaVersion: 1;
  revision: number;
  documentId: string;
  targetFilePath: string;
  baselineSha256: string;
  targets: GraphicsTikzpictureTargetDescriptor[];
  outsideChanges: boolean;
  structurallyCompatible: boolean;
  structuralError: string | null;
}

export interface GraphicsTikzpictureFocusRequest {
  schemaVersion: 1;
  revision: number;
  documentId: string;
  targetFilePath: string;
  baselineSource: string;
  baselineSha256: string;
  target: GraphicsTikzpictureTarget;
}

export interface GraphicsTikzpictureFocus {
  schemaVersion: 1;
  revision: number;
  documentId: string;
  targetFilePath: string;
  baselineSha256: string;
  workingSource: string;
  workingSha256: string;
  target: GraphicsTikzpictureTargetDescriptor;
}

export interface GraphicsNewDrawingTemplateRequest {
  schemaVersion: 1;
  revision: number;
}

export interface GraphicsNewDrawingTemplate {
  schemaVersion: 1;
  revision: number;
  source: string;
  sourceSha256: string;
}

export type GraphicsDrawingInsertionTarget =
  | { kind: "cursor"; byte: number }
  | { kind: "beforeEndDocument" }
  | { kind: "selection"; startByte: number; endByte: number };

export type GraphicsDrawingWrapper =
  | { kind: "inline" }
  | {
      kind: "figure";
      placement?: string | null;
      centering: boolean;
      caption?: string | null;
      label?: string | null;
    };

export interface GraphicsDrawingInsertRequest {
  schemaVersion: 1;
  revision: number;
  documentId: string;
  targetFilePath: string;
  baselineSource: string;
  drawingSource: string;
  baselineSha256: string;
  target: GraphicsDrawingInsertionTarget;
  wrapper?: GraphicsDrawingWrapper;
  requiredPackages?: string[];
  requiredTikzLibraries?: string[];
}

export interface ManagedGeneratedBlock {
  blockId: string;
  code: string;
}

export interface BuilderConfigurationDraft {
  builderId: string;
  enabled: boolean;
  managedPackageIds: string[];
  requirements: BuilderPackageRequirement[];
  generatedBlocks: ManagedGeneratedBlock[];
}

export interface ApplyBuilderConfigurationRequest
  extends BuilderConfigurationDraft {
  source: string;
  revision: number;
}

export type BuilderCategory =
  | "layout"
  | "code"
  | "tables"
  | "math"
  | "graphics"
  | "bibliography"
  | "document";

export type BuilderOutputTarget = "preamble" | "body" | "fullDocument";

export type BuilderSupportLevel =
  | "nativeEditable"
  | "generated"
  | "assistedSource"
  | "previewOnly";

export interface BuilderCapability {
  supportsPreview: boolean;
  supportsImport: boolean;
  supportsPresets: boolean;
  requiresExactCompile: boolean;
}

export interface BuilderDescriptor {
  schemaVersion: number;
  id: string;
  displayName: string;
  category: BuilderCategory;
  packageIds: string[];
  outputTargets: BuilderOutputTarget[];
  supportLevel: BuilderSupportLevel;
  capabilities: BuilderCapability;
  description: string;
}

export interface GeometryBuilderRequest {
  enabled?: boolean;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  columns: string;
  columnSep: number;
  sidedness: string;
  marginNotes: boolean;
  marginSep: number;
  marginWidth: number;
  includeMp: boolean;
  headHeight: number;
  headSep: number;
  footSkip: number;
  bindingOffset: number;
  hOffset: number;
  vOffset: number;
  includeHead: boolean;
  includeFoot: boolean;
}

export interface BuilderPackageRequirement {
  packageId: string;
  options: string[];
}

export interface BuilderPackageOptionDescriptor {
  packageId: string;
  option: string;
  label: string;
  description: string;
  valueKind: string;
  group: string;
  choices: BuilderPackageOptionChoice[];
  exclusiveGroup: string | null;
  defaultValue: string | null;
  unit: string | null;
}

export interface BuilderPackageOptionChoice {
  value: string;
  label: string;
  description: string | null;
}

export interface ListingsColors {
  keyword: string;
  string: string;
  comment: string;
  background: string;
}

export interface CodeHighlightingBuilderRequest {
  engine: "none" | "listings" | "minted" | string;
  language: string;
  showNumbers: boolean;
  breakLines: boolean;
  showFrame: boolean;
  mintedStyle: string;
  lstColors: ListingsColors;
}

export interface BuildProfileRequirement {
  shellEscapeRequired: boolean;
}

export type BuilderWarningSeverity = "info" | "warning" | "error";

export interface BuilderWarning {
  code: string;
  severity: BuilderWarningSeverity;
  message: string;
  packageId: string | null;
}

export interface BuilderOutput {
  schemaVersion: number;
  builderId: string;
  code: string;
  requirements: BuilderPackageRequirement[];
  buildProfile: BuildProfileRequirement;
  warnings: BuilderWarning[];
}

export type GeometryBuilderOutput = BuilderOutput;

export type CodeHighlightingBuilderOutput = BuilderOutput;

export interface FancyhdrBuilderRequest {
  enabled?: boolean;
  documentType: "oneside" | "twoside" | string;
  pageStyle: string;
  clearFields: boolean;
  packageOptions: string[];
  headerOddLeft: string;
  headerOddCenter: string;
  headerOddRight: string;
  headerEvenLeft: string;
  headerEvenCenter: string;
  headerEvenRight: string;
  footerOddLeft: string;
  footerOddCenter: string;
  footerOddRight: string;
  footerEvenLeft: string;
  footerEvenCenter: string;
  footerEvenRight: string;
  headRuleWidth: number;
  footRuleWidth: number;
}

export type FancyhdrBuilderOutput = BuilderOutput;

export interface EnumitemCustomList {
  name: string;
  baseType: "enumerate" | "itemize" | "description" | string;
  inline: boolean;
  label: string;
  spacing: string;
  wide: boolean;
  leftMarginStar: boolean;
  bold: boolean;
  italic: boolean;
  align: string;
  resume: boolean;
  start: number | null;
}

export interface EnumitemBuilderRequest {
  enabled?: boolean;
  inline: boolean;
  globalSpacing: string;
  itemizeLabel: string;
  enumerateLabel: string;
  customLists: EnumitemCustomList[];
}

export type EnumitemBuilderOutput = BuilderOutput;

export interface XcolorDefinition {
  name: string;
  model: string;
  value: string;
}

export interface XcolorAlias {
  name: string;
  primary: string;
  percentage: number;
  secondary: string;
}

export interface XcolorBuilderRequest {
  enabled?: boolean;
  packageOptions: string[];
  colors: XcolorDefinition[];
  aliases: XcolorAlias[];
}

export type XcolorBuilderOutput = BuilderOutput;

export interface GraphicxBuilderRequest {
  enabled?: boolean;
  filePath: string;
  width: string;
  widthUnit: string;
  height: string;
  heightUnit: string;
  keepAspectRatio: boolean;
  scale: number | null;
  angle: number | null;
  useFigure: boolean;
  center: boolean;
  caption: string;
  label: string;
  placement: string;
}

export type GraphicxBuilderOutput = BuilderOutput;

export interface TableBuilderRequest {
  enabled?: boolean;
  mode: "tabularray" | "standard" | "booktabs" | string;
  rows: number;
  columns: number;
  cells: string[][];
  cellStyles: TableCellStyle[][];
  cellSpans: TableCellSpan[][];
  columnAlignments: string[];
  columnWeights: string[];
  hlines: boolean;
  vlines: boolean;
  useTableEnvironment: boolean;
  center: boolean;
  caption: string;
  label: string;
  placement: string;
  longTable: boolean;
}

export interface TableCellStyle {
  bold: boolean;
  italic: boolean;
  alignment: string;
  verticalAlignment: string;
  backgroundColor: string;
  textColor: string;
}

export interface TableCellSpan {
  rowSpan: number;
  colSpan: number;
  hidden: boolean;
}

export type TableBuilderOutput = BuilderOutput;

export interface MathBuilderRequest {
  enabled?: boolean;
  mode: string;
  environmentType: string;
  starred: boolean;
  label: string;
  content: string;
  matrixType: string;
  matrixRows: number;
  matrixColumns: number;
  matrixStarred: boolean;
  matrixAlignment: string;
  matrixCells: string[][];
  toolType: string;
  arrowType: string;
  arrowAbove: string;
  arrowBelow: string;
  bracketType: string;
  bracketContent: string;
  bracketThickness: string;
  bracketHeight: string;
  splitFractionType: string;
  splitFractionTop: string;
  splitFractionBottom: string;
  prescriptSup: string;
  prescriptSub: string;
  prescriptArg: string;
  delimiterCommand: string;
  delimiterLeft: string;
  delimiterRight: string;
  tagAction: string;
  tagName: string;
  tagLeft: string;
  tagRight: string;
  tagFormat: string;
  tagRefLabel: string;
  delimiterMathType: string;
  delimiterMathContent: string;
  importedSourceRange?: SourceRange | null;
}

export type MathBuilderOutput = BuilderOutput;

export interface MathImportedSnippet {
  id: string;
  kind: string;
  label: string;
  preview: string;
  line: number;
  request: MathBuilderRequest;
}

export interface SiunitxUnitComponent {
  prefix: string;
  unit: string;
  power: string;
  per: boolean;
}

export interface SiunitxBuilderRequest {
  enabled?: boolean;
  snippetMode: string;
  number: string;
  exponentMode: string;
  roundMode: string;
  roundPrecision: number;
  units: SiunitxUnitComponent[];
  listContent: string;
  rangeStart: string;
  rangeEnd: string;
  perMode: string;
  interUnitProduct: string;
  rangePhrase: string;
  compatibilityWarnings?: BuilderWarning[];
}

export type SiunitxBuilderOutput = BuilderOutput;

export function analyzeLatexPackages(
  source: string,
  revision: number,
): Promise<LatexPackageAnalysis> {
  return invoke<LatexPackageAnalysis>("package_studio_analyze_latex_cmd", {
    source,
    revision,
  });
}

export function planAddPackage(
  request: AddPackageRequest,
): Promise<PackageEditPlan> {
  return invoke<PackageEditPlan>("package_studio_plan_add_package_cmd", {
    request: {
      ...request,
      options: request.options ?? [],
      updateExisting: request.updateExisting ?? false,
    },
  });
}

export function planRemovePackage(
  request: RemovePackageRequest,
): Promise<PackageEditPlan> {
  return invoke<PackageEditPlan>("package_studio_plan_remove_package_cmd", {
    request,
  });
}

export function planMovePackage(
  request: MovePackageRequest,
): Promise<PackageEditPlan> {
  return invoke<PackageEditPlan>("package_studio_plan_move_package_cmd", {
    request: {
      ...request,
      afterPackageId: request.afterPackageId ?? null,
    },
  });
}

export function planGeneratedBlock(
  request: GeneratedBlockRequest,
): Promise<PackageEditPlan> {
  return invoke<PackageEditPlan>("package_studio_plan_generated_block_cmd", {
    request,
  });
}

export function planApplyBuilderConfiguration(
  request: ApplyBuilderConfigurationRequest,
): Promise<PackageEditPlan> {
  return invoke<PackageEditPlan>(
    "package_studio_plan_apply_builder_configuration_cmd",
    { request },
  );
}

export async function calculateSourceSha256(source: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Secure source fingerprinting is unavailable in this WebView.",
    );
  }

  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function planGraphicsDocumentEdit(
  request: GraphicsDocumentEditRequest,
): Promise<PackageEditPlan> {
  return invoke<PackageEditPlan>(
    "package_studio_plan_graphics_document_edit_cmd",
    { request },
  );
}

export function discoverGraphicsTikzpictures(
  request: GraphicsTikzpictureDiscoveryRequest,
): Promise<GraphicsTikzpictureDiscovery> {
  return invoke<GraphicsTikzpictureDiscovery>(
    "package_studio_discover_graphics_tikzpictures_cmd",
    { request },
  );
}

export function prepareGraphicsTikzpicture(
  request: GraphicsTikzpictureFocusRequest,
): Promise<GraphicsTikzpictureFocus> {
  return invoke<GraphicsTikzpictureFocus>(
    "package_studio_prepare_graphics_tikzpicture_cmd",
    { request },
  );
}

export function planGraphicsTikzpictureEdit(
  request: GraphicsTikzpictureEditRequest,
): Promise<PackageEditPlan> {
  return invoke<PackageEditPlan>(
    "package_studio_plan_graphics_tikzpicture_edit_cmd",
    { request },
  );
}

export function prepareGraphicsNewDrawing(
  request: GraphicsNewDrawingTemplateRequest,
): Promise<GraphicsNewDrawingTemplate> {
  return invoke<GraphicsNewDrawingTemplate>(
    "package_studio_prepare_graphics_new_drawing_cmd",
    { request },
  );
}

export function planGraphicsDrawingInsert(
  request: GraphicsDrawingInsertRequest,
): Promise<PackageEditPlan> {
  return invoke<PackageEditPlan>(
    "package_studio_plan_graphics_drawing_insert_cmd",
    { request },
  );
}

export function listPackageBuilders(): Promise<BuilderDescriptor[]> {
  return invoke<BuilderDescriptor[]>("package_studio_list_builders_cmd");
}

export function listBuilderOptions(
  builderId: string,
): Promise<BuilderPackageOptionDescriptor[]> {
  return invoke<BuilderPackageOptionDescriptor[]>(
    "package_studio_list_builder_options_cmd",
    { builderId },
  );
}

export function generateGeometry(
  request: GeometryBuilderRequest,
): Promise<GeometryBuilderOutput> {
  return invoke<GeometryBuilderOutput>("package_studio_generate_geometry_cmd", {
    request: {
      ...request,
      enabled: request.enabled ?? true,
    },
  });
}

export function importGeometry(
  source: string,
): Promise<GeometryBuilderRequest> {
  return invoke<GeometryBuilderRequest>("package_studio_import_geometry_cmd", {
    source,
  });
}

export function generateGraphicx(
  request: GraphicxBuilderRequest,
): Promise<GraphicxBuilderOutput> {
  return invoke<GraphicxBuilderOutput>("package_studio_generate_graphicx_cmd", {
    request: {
      ...request,
      enabled: request.enabled ?? true,
    },
  });
}

export function importGraphicx(
  source: string,
): Promise<GraphicxBuilderRequest> {
  return invoke<GraphicxBuilderRequest>("package_studio_import_graphicx_cmd", {
    source,
  });
}

export function generateTable(
  request: TableBuilderRequest,
): Promise<TableBuilderOutput> {
  return invoke<TableBuilderOutput>("package_studio_generate_table_cmd", {
    request: {
      ...request,
      enabled: request.enabled ?? true,
    },
  });
}

export function generateMath(
  request: MathBuilderRequest,
): Promise<MathBuilderOutput> {
  return invoke<MathBuilderOutput>("package_studio_generate_math_cmd", {
    request: {
      ...request,
      enabled: request.enabled ?? true,
    },
  });
}

export function importMath(source: string): Promise<MathBuilderRequest> {
  return invoke<MathBuilderRequest>("package_studio_import_math_cmd", {
    source,
  });
}

export function listMathImports(source: string): Promise<MathImportedSnippet[]> {
  return invoke<MathImportedSnippet[]>("package_studio_list_math_imports_cmd", {
    source,
  });
}

export function generateSiunitx(
  request: SiunitxBuilderRequest,
): Promise<SiunitxBuilderOutput> {
  return invoke<SiunitxBuilderOutput>("package_studio_generate_siunitx_cmd", {
    request: {
      ...request,
      enabled: request.enabled ?? true,
    },
  });
}

export function importSiunitx(source: string): Promise<SiunitxBuilderRequest> {
  return invoke<SiunitxBuilderRequest>("package_studio_import_siunitx_cmd", {
    source,
  });
}

export function generateFancyhdr(
  request: FancyhdrBuilderRequest,
): Promise<FancyhdrBuilderOutput> {
  return invoke<FancyhdrBuilderOutput>("package_studio_generate_fancyhdr_cmd", {
    request: {
      ...request,
      enabled: request.enabled ?? true,
    },
  });
}

export function importFancyhdr(
  source: string,
): Promise<FancyhdrBuilderRequest> {
  return invoke<FancyhdrBuilderRequest>("package_studio_import_fancyhdr_cmd", {
    source,
  });
}

export function generateEnumitem(
  request: EnumitemBuilderRequest,
): Promise<EnumitemBuilderOutput> {
  return invoke<EnumitemBuilderOutput>("package_studio_generate_enumitem_cmd", {
    request: {
      ...request,
      enabled: request.enabled ?? true,
    },
  });
}

export function importEnumitem(
  source: string,
): Promise<EnumitemBuilderRequest> {
  return invoke<EnumitemBuilderRequest>("package_studio_import_enumitem_cmd", {
    source,
  });
}

export function generateCodeHighlighting(
  request: CodeHighlightingBuilderRequest,
): Promise<CodeHighlightingBuilderOutput> {
  return invoke<CodeHighlightingBuilderOutput>(
    "package_studio_generate_code_highlighting_cmd",
    { request },
  );
}

export function generateCodeHighlightingSnippet(
  request: CodeHighlightingBuilderRequest,
  code: string,
): Promise<string> {
  return invoke<string>("package_studio_generate_code_highlighting_snippet_cmd", {
    request,
    code,
  });
}

export function importCodeHighlighting(
  source: string,
): Promise<CodeHighlightingBuilderRequest> {
  return invoke<CodeHighlightingBuilderRequest>(
    "package_studio_import_code_highlighting_cmd",
    { source },
  );
}

export function generateXcolor(
  request: XcolorBuilderRequest,
): Promise<XcolorBuilderOutput> {
  return invoke<XcolorBuilderOutput>("package_studio_generate_xcolor_cmd", {
    request: {
      ...request,
      enabled: request.enabled ?? true,
    },
  });
}

export function importXcolor(source: string): Promise<XcolorBuilderRequest> {
  return invoke<XcolorBuilderRequest>("package_studio_import_xcolor_cmd", {
    source,
  });
}
