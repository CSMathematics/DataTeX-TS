import React, { useEffect, useMemo, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  Alert,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  ColorInput,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowLeft,
  faBookOpen,
  faBoxOpen,
  faCheck,
  faCircleInfo,
  faCode,
  faCopy,
  faExclamationTriangle,
  faExternalLinkAlt,
  faFileImport,
  faFileLines,
  faEraser,
  faFillDrip,
  faFolderOpen,
  faImage,
  faFlask,
  faBold,
  faItalic,
  faPlus,
  faLayerGroup,
  faListOl,
  faSquareRootAlt,
  faTable,
  faTrash,
  faWandMagicSparkles,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import {
  analyzeLatexPackages,
  generateCodeHighlighting,
  generateCodeHighlightingSnippet,
  generateEnumitem,
  generateFancyhdr,
  generateGeometry,
  generateGraphicx,
  generateMath,
  generateSiunitx,
  generateTable,
  generateXcolor,
  importCodeHighlighting,
  importEnumitem,
  importFancyhdr,
  importGeometry,
  importGraphicx,
  importSiunitx,
  importXcolor,
  listMathImports,
  listBuilderOptions,
  listPackageBuilders,
  type BuilderOutput,
  type BuilderConfigurationDraft,
  type BuilderCategory,
  type BuilderDescriptor,
  type CodeHighlightingBuilderRequest,
  type EnumitemBuilderRequest,
  type FancyhdrBuilderRequest,
  type GeometryBuilderRequest,
  type GraphicxBuilderRequest,
  type LatexPackageAnalysis,
  type MathImportedSnippet,
  type MathBuilderRequest,
  type SiunitxBuilderRequest,
  type SiunitxUnitComponent,
  type TableBuilderRequest,
  type TableCellSpan,
  type TableCellStyle,
  type BuilderOutputTarget,
  type BuilderPackageOptionDescriptor,
  type BuilderSupportLevel,
  type PackageDiagnostic,
  type PackageEditPlan,
  type PackageStudioEditReview,
  type XcolorBuilderRequest,
  utf8ByteOffsetToStringIndex,
} from "../../services/packageStudioService";
import { LANGUAGES_DB } from "../wizards/preamble/LanguageDb";

interface PackageStudioWorkspaceProps {
  activeBuilderId?: string | null;
  onSelectBuilder: (builderId: string) => void;
  onBackToEditor: () => void;
  onInsertCode: (code: string) => void;
  onFixDiagnostic?: (diagnostic: PackageDiagnostic) => void;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
  onRevealSourceLine?: (line: number) => void;
  onReviewEditPlan?: (
    plan: PackageEditPlan,
    source: string,
    targetFilePath: string,
  ) => void;
  pendingEditReview?: PackageStudioEditReview | null;
  onApplyPendingEditPlan?: () => void;
  onDismissPendingEditPlan?: () => void;
  activeFilePath?: string;
  activeFileContent?: string;
}

type CategoryMeta = {
  label: string;
  color: string;
  icon: IconDefinition;
};

const CATEGORY_META: Record<BuilderCategory, CategoryMeta> = {
  layout: { label: "Layout", color: "indigo", icon: faLayerGroup },
  code: { label: "Code", color: "violet", icon: faCode },
  tables: { label: "Tables", color: "cyan", icon: faTable },
  math: { label: "Math", color: "teal", icon: faSquareRootAlt },
  graphics: { label: "Graphics", color: "orange", icon: faImage },
  bibliography: { label: "Bibliography", color: "blue", icon: faBookOpen },
  document: { label: "Document", color: "gray", icon: faFileLines },
};

const OUTPUT_TARGET_LABELS: Record<BuilderOutputTarget, string> = {
  preamble: "Preamble",
  body: "Body",
  fullDocument: "Full document",
};

const SUPPORT_LABELS: Record<BuilderSupportLevel, string> = {
  nativeEditable: "Native editable builder",
  generated: "Generated code",
  assistedSource: "Assisted source",
  previewOnly: "Preview only",
};

const AUTO_OPTION_VALUE = "__datatex_auto__";

const inputValue = (
  event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => event.currentTarget?.value ?? "";

const inputChecked = (event: React.ChangeEvent<HTMLInputElement>) =>
  event.currentTarget?.checked ?? false;

const DEFAULT_GEOMETRY_REQUEST: GeometryBuilderRequest = {
  enabled: true,
  marginTop: 2.5,
  marginBottom: 2.5,
  marginLeft: 2.5,
  marginRight: 2.5,
  columns: "one",
  columnSep: 0.5,
  sidedness: "oneside",
  marginNotes: false,
  marginSep: 0.5,
  marginWidth: 3,
  includeMp: false,
  headHeight: 0,
  headSep: 0,
  footSkip: 0,
  bindingOffset: 0,
  hOffset: 0,
  vOffset: 0,
  includeHead: false,
  includeFoot: false,
};

const DEFAULT_GRAPHICX_REQUEST: GraphicxBuilderRequest = {
  enabled: true,
  filePath: "image.png",
  width: "0.8",
  widthUnit: "\\textwidth",
  height: "",
  heightUnit: "cm",
  keepAspectRatio: true,
  scale: null,
  angle: null,
  useFigure: true,
  center: true,
  caption: "Caption",
  label: "fig:my_image",
  placement: "ht",
};

const GRAPHICX_WIDTH_UNITS = ["\\textwidth", "\\linewidth", "cm", "mm", "in", "pt"];
const GRAPHICX_HEIGHT_UNITS = ["cm", "mm", "in", "pt", "\\textheight"];
const GRAPHICX_PLACEMENTS = [
  { value: "h", label: "Here (h)" },
  { value: "t", label: "Top (t)" },
  { value: "b", label: "Bottom (b)" },
  { value: "p", label: "Page (p)" },
  { value: "ht", label: "Here/Top (ht)" },
  { value: "!ht", label: "Force Here/Top (!ht)" },
  { value: "H", label: "Exactly here (H)" },
];

const createDefaultTableCellStyle = (): TableCellStyle => ({
  bold: false,
  italic: false,
  alignment: "",
  verticalAlignment: "",
  backgroundColor: "",
  textColor: "",
});

const createDefaultTableCellSpan = (): TableCellSpan => ({
  rowSpan: 1,
  colSpan: 1,
  hidden: false,
});

const createDefaultTableStyleRow = (columns: number): TableCellStyle[] =>
  Array.from({ length: columns }, createDefaultTableCellStyle);

const createDefaultTableSpanRow = (columns: number): TableCellSpan[] =>
  Array.from({ length: columns }, createDefaultTableCellSpan);

const createDefaultTableSpanGrid = (
  rows: number,
  columns: number,
): TableCellSpan[][] =>
  Array.from({ length: rows }, () => createDefaultTableSpanRow(columns));

const hasMergedTableCells = (spans: TableCellSpan[][]): boolean =>
  spans.some((row) =>
    row.some((span) => span.hidden || span.rowSpan > 1 || span.colSpan > 1),
  );

const countDelimitedColumns = (line: string, delimiter: string): number => {
  let count = 1;
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      count += 1;
    }
  }

  return count;
};

const detectTableImportDelimiter = (text: string): string => {
  const sample = text
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0) ?? "";
  const candidates = ["\t", ",", ";"];
  return candidates
    .map((delimiter) => ({
      delimiter,
      columns: countDelimitedColumns(sample, delimiter),
    }))
    .sort((left, right) => right.columns - left.columns)[0]?.delimiter ?? ",";
};

const parseDelimitedTableText = (text: string): string[][] => {
  const delimiter = detectTableImportDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      row.push(cell.trim());
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      if (char === "\r" && text[index + 1] === "\n") index += 1;
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);

  return rows;
};

const DEFAULT_TABLE_REQUEST: TableBuilderRequest = {
  enabled: true,
  mode: "booktabs",
  rows: 3,
  columns: 3,
  cells: [
    ["Header 1", "Header 2", "Header 3"],
    ["A", "B", "C"],
    ["1", "2", "3"],
  ],
  cellStyles: [
    createDefaultTableStyleRow(3),
    createDefaultTableStyleRow(3),
    createDefaultTableStyleRow(3),
  ],
  cellSpans: [
    [
      { rowSpan: 1, colSpan: 1, hidden: false },
      { rowSpan: 1, colSpan: 1, hidden: false },
      { rowSpan: 1, colSpan: 1, hidden: false },
    ],
    [
      { rowSpan: 1, colSpan: 1, hidden: false },
      { rowSpan: 1, colSpan: 1, hidden: false },
      { rowSpan: 1, colSpan: 1, hidden: false },
    ],
    [
      { rowSpan: 1, colSpan: 1, hidden: false },
      { rowSpan: 1, colSpan: 1, hidden: false },
      { rowSpan: 1, colSpan: 1, hidden: false },
    ],
  ],
  columnAlignments: ["l", "c", "r"],
  columnWeights: ["", "", ""],
  hlines: true,
  vlines: false,
  useTableEnvironment: true,
  center: true,
  caption: "Table caption",
  label: "tab:my_table",
  placement: "ht",
  longTable: false,
};

const DEFAULT_MATH_REQUEST: MathBuilderRequest = {
  enabled: true,
  mode: "environment",
  environmentType: "align",
  starred: false,
  label: "eq:example",
  content: "x &= y + z",
  matrixType: "pmatrix",
  matrixRows: 2,
  matrixColumns: 2,
  matrixStarred: false,
  matrixAlignment: "c",
  matrixCells: [
    ["a", "b"],
    ["c", "d"],
  ],
  toolType: "arrow",
  arrowType: "xrightarrow",
  arrowAbove: "f",
  arrowBelow: "",
  bracketType: "underbracket",
  bracketContent: "a + b",
  bracketThickness: "",
  bracketHeight: "",
  splitFractionType: "splitfrac",
  splitFractionTop: "a + b",
  splitFractionBottom: "c + d",
  prescriptSup: "14",
  prescriptSub: "6",
  prescriptArg: "C",
  delimiterCommand: "norm",
  delimiterLeft: "\\lVert",
  delimiterRight: "\\rVert",
  tagAction: "newtagform",
  tagName: "brackets",
  tagLeft: "[",
  tagRight: "]",
  tagFormat: "",
  tagRefLabel: "eq:example",
  delimiterMathType: "display_brackets",
  delimiterMathContent: "E = mc^2",
};

const MATH_MODES = [
  { value: "environment", label: "Environment" },
  { value: "matrix", label: "Matrix" },
  { value: "tool", label: "Mathtools snippet" },
  { value: "tag", label: "Equation tags" },
  { value: "delimited", label: "Delimited math" },
];

const MATH_DELIMITER_TYPES = [
  { value: "display_brackets", label: "\\[ ... \\] display" },
  { value: "inline_parens", label: "\\( ... \\) inline" },
  { value: "inline_dollar", label: "$ ... $ inline" },
  { value: "display_dollars", label: "$$ ... $$ display" },
];

const MATH_ENVIRONMENTS = [
  { value: "equation", label: "equation" },
  { value: "align", label: "align" },
  { value: "aligned", label: "aligned" },
  { value: "gather", label: "gather" },
  { value: "gathered", label: "gathered" },
  { value: "lgathered", label: "lgathered · mathtools" },
  { value: "rgathered", label: "rgathered · mathtools" },
  { value: "multline", label: "multline" },
  { value: "flalign", label: "flalign" },
  { value: "cases", label: "cases" },
  { value: "split", label: "split" },
  { value: "dcases", label: "dcases · mathtools" },
  { value: "rcases", label: "rcases · mathtools" },
];

const MATH_MATRIX_TYPES = [
  { value: "pmatrix", label: "( ) pmatrix" },
  { value: "bmatrix", label: "[ ] bmatrix" },
  { value: "Bmatrix", label: "{ } Bmatrix" },
  { value: "vmatrix", label: "| | vmatrix" },
  { value: "Vmatrix", label: "‖ ‖ Vmatrix" },
  { value: "matrix", label: "matrix" },
  { value: "smallmatrix", label: "smallmatrix" },
];

const MATHTOOLS_TOOL_TYPES = [
  { value: "arrow", label: "Extensible arrow" },
  { value: "bracket", label: "Bracket / brace" },
  { value: "split_fraction", label: "Split fraction" },
  { value: "prescript", label: "Prescript" },
  { value: "delimiter", label: "Paired delimiter" },
];

const MATHTOOLS_ARROWS = [
  "xrightarrow",
  "xleftarrow",
  "xleftrightarrow",
  "xRightarrow",
  "xLeftarrow",
  "xLeftrightarrow",
  "xlongequal",
  "xmapsto",
  "xhookleftarrow",
  "xhookrightarrow",
  "xleftharpoondown",
  "xleftharpoonup",
  "xleftrightharpoons",
  "xrightharpoondown",
  "xrightharpoonup",
  "xrightleftharpoons",
].map((value) => ({ value, label: `\\${value}` }));

const MATHTOOLS_BRACKETS = [
  { value: "underbracket", label: "\\underbracket" },
  { value: "overbracket", label: "\\overbracket" },
  { value: "underbrace", label: "\\underbrace" },
  { value: "overbrace", label: "\\overbrace" },
];

const MATHTOOLS_TAG_ACTIONS = [
  { value: "newtagform", label: "\\newtagform" },
  { value: "usetagform", label: "\\usetagform" },
  { value: "eqref", label: "\\eqref · amsmath" },
  { value: "refeq", label: "\\refeq" },
  { value: "noeqref", label: "\\noeqref" },
];

const DEFAULT_SIUNITX_REQUEST: SiunitxBuilderRequest = {
  enabled: true,
  snippetMode: "qty",
  number: "10.5",
  exponentMode: "input",
  roundMode: "none",
  roundPrecision: 2,
  units: [{ prefix: "\\kilo", unit: "\\meter", power: "", per: false }],
  listContent: "10; 20; 30",
  rangeStart: "5",
  rangeEnd: "10",
  perMode: "power",
  interUnitProduct: "thin",
  rangePhrase: "to",
  compatibilityWarnings: [],
};

const SIUNITX_SNIPPET_MODES = [
  { value: "qty", label: "Quantity · \\qty" },
  { value: "num", label: "Number · \\num" },
  { value: "unit", label: "Unit · \\unit" },
  { value: "qtylist", label: "Quantity list · \\qtylist" },
  { value: "qtyrange", label: "Quantity range · \\qtyrange" },
  { value: "setup", label: "Preamble setup · \\sisetup" },
];

const SIUNITX_PREFIXES = [
  { value: "", label: "none · 10⁰" },
  { value: "\\yocto", label: "yocto · y · 10⁻²⁴" },
  { value: "\\zepto", label: "zepto · z · 10⁻²¹" },
  { value: "\\atto", label: "atto · a · 10⁻¹⁸" },
  { value: "\\femto", label: "femto · f · 10⁻¹⁵" },
  { value: "\\pico", label: "pico · p · 10⁻¹²" },
  { value: "\\nano", label: "nano · n · 10⁻⁹" },
  { value: "\\micro", label: "micro · μ · 10⁻⁶" },
  { value: "\\milli", label: "milli · m · 10⁻³" },
  { value: "\\centi", label: "centi · c · 10⁻²" },
  { value: "\\deci", label: "deci · d · 10⁻¹" },
  { value: "\\deca", label: "deca · da · 10¹" },
  { value: "\\hecto", label: "hecto · h · 10²" },
  { value: "\\kilo", label: "kilo · k · 10³" },
  { value: "\\mega", label: "mega · M · 10⁶" },
  { value: "\\giga", label: "giga · G · 10⁹" },
  { value: "\\tera", label: "tera · T · 10¹²" },
  { value: "\\peta", label: "peta · P · 10¹⁵" },
  { value: "\\exa", label: "exa · E · 10¹⁸" },
  { value: "\\zetta", label: "zetta · Z · 10²¹" },
  { value: "\\yotta", label: "yotta · Y · 10²⁴" },
];

const SIUNITX_UNITS = [
  { value: "\\meter", label: "meter · m · length" },
  { value: "\\gram", label: "gram · g · mass" },
  { value: "\\second", label: "second · s · time" },
  { value: "\\ampere", label: "ampere · A · current" },
  { value: "\\kelvin", label: "kelvin · K · temperature" },
  { value: "\\mole", label: "mole · mol · amount" },
  { value: "\\candela", label: "candela · cd · luminous intensity" },
  { value: "\\radian", label: "radian · rad · angle" },
  { value: "\\steradian", label: "steradian · sr · solid angle" },
  { value: "\\hertz", label: "hertz · Hz · frequency" },
  { value: "\\newton", label: "newton · N · force" },
  { value: "\\pascal", label: "pascal · Pa · pressure" },
  { value: "\\joule", label: "joule · J · energy" },
  { value: "\\watt", label: "watt · W · power" },
  { value: "\\coulomb", label: "coulomb · C · charge" },
  { value: "\\volt", label: "volt · V · voltage" },
  { value: "\\farad", label: "farad · F · capacitance" },
  { value: "\\ohm", label: "ohm · Ω · resistance" },
  { value: "\\siemens", label: "siemens · S · conductance" },
  { value: "\\weber", label: "weber · Wb · magnetic flux" },
  { value: "\\tesla", label: "tesla · T · magnetic field" },
  { value: "\\henry", label: "henry · H · inductance" },
  { value: "\\degreeCelsius", label: "degree Celsius · °C · temperature" },
  { value: "\\lumen", label: "lumen · lm · luminous flux" },
  { value: "\\lux", label: "lux · lx · illuminance" },
  { value: "\\becquerel", label: "becquerel · Bq · activity" },
  { value: "\\gray", label: "gray · Gy · absorbed dose" },
  { value: "\\sievert", label: "sievert · Sv · dose equivalent" },
  { value: "\\katal", label: "katal · kat · catalytic activity" },
  { value: "\\minute", label: "minute · min · time" },
  { value: "\\hour", label: "hour · h · time" },
  { value: "\\day", label: "day · d · time" },
  { value: "\\degree", label: "degree · ° · angle" },
  { value: "\\arcminute", label: "arcminute · ′ · angle" },
  { value: "\\arcsecond", label: "arcsecond · ″ · angle" },
  { value: "\\hectare", label: "hectare · ha · area" },
  { value: "\\liter", label: "liter · L · volume" },
  { value: "\\tonne", label: "tonne · t · mass" },
  { value: "\\electronvolt", label: "electronvolt · eV · energy" },
  { value: "\\dalton", label: "dalton · Da · mass" },
  { value: "\\astronomicalunit", label: "astronomical unit · au · distance" },
  { value: "\\bel", label: "bel · B · logarithmic ratio" },
  { value: "\\decibel", label: "decibel · dB · logarithmic ratio" },
  { value: "\\percent", label: "percent · % · ratio" },
  { value: "\\permille", label: "per mille · ‰ · ratio" },
  { value: "\\bit", label: "bit · information" },
  { value: "\\byte", label: "byte · B · information" },
];

const SIUNITX_POWERS = [
  { value: "", label: "1" },
  { value: "\\squared", label: "²" },
  { value: "\\cubed", label: "³" },
  { value: "^{4}", label: "⁴" },
  { value: "^{-1}", label: "⁻¹" },
];

const SIUNITX_PRESETS: Array<{
  value: string;
  label: string;
  units: SiunitxUnitComponent[];
}> = [
  {
    value: "length",
    label: "Length · km",
    units: [{ prefix: "\\kilo", unit: "\\meter", power: "", per: false }],
  },
  {
    value: "velocity",
    label: "Velocity · m/s",
    units: [
      { prefix: "", unit: "\\meter", power: "", per: false },
      { prefix: "", unit: "\\second", power: "", per: true },
    ],
  },
  {
    value: "acceleration",
    label: "Acceleration · m/s²",
    units: [
      { prefix: "", unit: "\\meter", power: "", per: false },
      { prefix: "", unit: "\\second", power: "\\squared", per: true },
    ],
  },
  {
    value: "density",
    label: "Density · kg/m³",
    units: [
      { prefix: "\\kilo", unit: "\\gram", power: "", per: false },
      { prefix: "", unit: "\\meter", power: "\\cubed", per: true },
    ],
  },
  {
    value: "force",
    label: "Force · N",
    units: [{ prefix: "", unit: "\\newton", power: "", per: false }],
  },
  {
    value: "energy",
    label: "Energy · J",
    units: [{ prefix: "", unit: "\\joule", power: "", per: false }],
  },
  {
    value: "pressure",
    label: "Pressure · kPa",
    units: [{ prefix: "\\kilo", unit: "\\pascal", power: "", per: false }],
  },
  {
    value: "power",
    label: "Power · MW",
    units: [{ prefix: "\\mega", unit: "\\watt", power: "", per: false }],
  },
  {
    value: "electric-field",
    label: "Electric field · V/m",
    units: [
      { prefix: "", unit: "\\volt", power: "", per: false },
      { prefix: "", unit: "\\meter", power: "", per: true },
    ],
  },
  {
    value: "concentration",
    label: "Concentration · mol/L",
    units: [
      { prefix: "", unit: "\\mole", power: "", per: false },
      { prefix: "", unit: "\\liter", power: "", per: true },
    ],
  },
  {
    value: "data-rate",
    label: "Data rate · MB/s",
    units: [
      { prefix: "\\mega", unit: "\\byte", power: "", per: false },
      { prefix: "", unit: "\\second", power: "", per: true },
    ],
  },
];

const TABLE_MODES = [
  { value: "booktabs", label: "Booktabs · professional" },
  { value: "tabularray", label: "Tabularray · modern" },
  { value: "standard", label: "Standard tabular" },
];

const TABLE_PLACEMENTS = [
  { value: "h", label: "Here (h)" },
  { value: "t", label: "Top (t)" },
  { value: "b", label: "Bottom (b)" },
  { value: "p", label: "Page (p)" },
  { value: "ht", label: "Here/Top (ht)" },
  { value: "!ht", label: "Force Here/Top (!ht)" },
  { value: "H", label: "Exactly here (H)" },
];

const tableCssAlign = (alignment?: string) => {
  if (alignment === "r") return "right";
  if (alignment === "c") return "center";
  return "left";
};

const tableCssVerticalAlign = (alignment?: string) => {
  if (alignment === "t") return "flex-start";
  if (alignment === "b") return "flex-end";
  return "center";
};

const findTableSpanMaster = (
  request: TableBuilderRequest,
  targetRow: number,
  targetColumn: number,
) => {
  for (let row = 0; row < request.rows; row += 1) {
    for (let column = 0; column < request.columns; column += 1) {
      const span = request.cellSpans[row]?.[column];
      if (!span || span.hidden) continue;
      const coversRow = targetRow >= row && targetRow < row + span.rowSpan;
      const coversColumn =
        targetColumn >= column && targetColumn < column + span.colSpan;
      if (coversRow && coversColumn) return { row, column };
    }
  }
  return null;
};

const hydrateGeometryFromOptions = (
  current: GeometryBuilderRequest,
  options: string[],
): GeometryBuilderRequest => {
  const next = { ...current };
  const numericKeys: Record<string, keyof GeometryBuilderRequest> = {
    top: "marginTop",
    bottom: "marginBottom",
    left: "marginLeft",
    right: "marginRight",
    columnsep: "columnSep",
    marginparsep: "marginSep",
    marginparwidth: "marginWidth",
    headheight: "headHeight",
    headsep: "headSep",
    footskip: "footSkip",
    bindingoffset: "bindingOffset",
    hoffset: "hOffset",
    voffset: "vOffset",
  };

  options.forEach((option) => {
    const [rawKey, rawValue] = option.split("=", 2);
    const key = rawKey.trim().toLowerCase();
    if (rawValue && numericKeys[key]) {
      const parsed = Number.parseFloat(rawValue.trim().replace(/cm$/i, ""));
      if (Number.isFinite(parsed)) {
        (next as unknown as Record<string, unknown>)[numericKeys[key]] = parsed;
      }
      return;
    }
    if (key === "includehead") next.includeHead = true;
    if (key === "includefoot") next.includeFoot = true;
    if (key === "includemp") {
      next.marginNotes = true;
      next.includeMp = true;
    }
    if (key === "asymmetric") next.sidedness = "asymmetric";
  });

  if (options.some((option) => option.toLowerCase().startsWith("columnsep="))) {
    next.columns = "two";
  }
  if (
    options.some((option) =>
      ["marginparsep", "marginparwidth"].some((key) =>
        option.toLowerCase().startsWith(`${key}=`),
      ),
    )
  ) {
    next.marginNotes = true;
  }
  return next;
};

const DEFAULT_CODE_HIGHLIGHTING_REQUEST: CodeHighlightingBuilderRequest = {
  engine: "listings",
  language: "python",
  showNumbers: true,
  breakLines: true,
  showFrame: true,
  mintedStyle: "friendly",
  lstColors: {
    keyword: "#0000FF",
    string: "#A020F0",
    comment: "#008000",
    background: "#F5F5F5",
  },
};

const DEFAULT_FANCYHDR_REQUEST: FancyhdrBuilderRequest = {
  enabled: true,
  documentType: "twoside",
  pageStyle: "fancy",
  clearFields: true,
  packageOptions: [],
  headerOddLeft: "",
  headerOddCenter: "",
  headerOddRight: "\\thepage",
  headerEvenLeft: "\\thepage",
  headerEvenCenter: "",
  headerEvenRight: "",
  footerOddLeft: "",
  footerOddCenter: "",
  footerOddRight: "",
  footerEvenLeft: "",
  footerEvenCenter: "",
  footerEvenRight: "",
  headRuleWidth: 0.4,
  footRuleWidth: 0,
};

const FANCYHDR_COMMAND_CHIPS = [
  { label: "Page", value: "\\thepage" },
  { label: "Chapter", value: "\\leftmark" },
  { label: "Section", value: "\\rightmark" },
  { label: "Today", value: "\\today" },
  { label: "Author", value: "\\@author" },
  { label: "Title", value: "\\@title" },
];

const FANCYHDR_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  request: FancyhdrBuilderRequest;
}> = [
  {
    id: "book-standard",
    label: "Book standard",
    description: "Two-sided chapter/section marks with outside page numbers.",
    request: {
      ...DEFAULT_FANCYHDR_REQUEST,
      documentType: "twoside",
      headerOddLeft: "\\rightmark",
      headerOddRight: "\\thepage",
      headerEvenLeft: "\\thepage",
      headerEvenRight: "\\leftmark",
      footerOddCenter: "",
      footerEvenCenter: "",
      headRuleWidth: 0.4,
      footRuleWidth: 0,
    },
  },
  {
    id: "thesis-style",
    label: "Thesis style",
    description: "Formal two-sided layout with a subtle footer rule.",
    request: {
      ...DEFAULT_FANCYHDR_REQUEST,
      documentType: "twoside",
      headerOddLeft: "\\rightmark",
      headerOddRight: "\\thepage",
      headerEvenLeft: "\\thepage",
      headerEvenRight: "\\leftmark",
      footerOddCenter: "\\today",
      footerEvenCenter: "\\today",
      headRuleWidth: 0.4,
      footRuleWidth: 0.2,
    },
  },
  {
    id: "article-simple",
    label: "Article simple",
    description: "One-sided article header with centered page footer.",
    request: {
      ...DEFAULT_FANCYHDR_REQUEST,
      documentType: "oneside",
      headerOddLeft: "\\leftmark",
      headerOddRight: "\\thepage",
      footerOddCenter: "\\thepage",
      headerEvenLeft: "",
      headerEvenRight: "",
      footerEvenCenter: "",
      headRuleWidth: 0.4,
      footRuleWidth: 0,
    },
  },
  {
    id: "report-format",
    label: "Report format",
    description: "Title/date header with page number in the footer.",
    request: {
      ...DEFAULT_FANCYHDR_REQUEST,
      documentType: "oneside",
      headerOddLeft: "\\@title",
      headerOddRight: "\\today",
      footerOddCenter: "\\thepage",
      headerEvenLeft: "",
      headerEvenRight: "",
      footerEvenCenter: "",
      headRuleWidth: 0.4,
      footRuleWidth: 0.4,
    },
  },
];

const DEFAULT_ENUMITEM_REQUEST: EnumitemBuilderRequest = {
  enabled: true,
  inline: false,
  globalSpacing: "default",
  itemizeLabel: "default",
  enumerateLabel: "default",
  customLists: [],
};

const DEFAULT_ENUMITEM_DRAFT = {
  name: "",
  baseType: "enumerate",
  inline: false,
  label: "\\arabic*.",
  spacing: "default",
  wide: false,
  leftMarginStar: false,
  bold: false,
  italic: false,
  align: "default",
  resume: false,
  start: null as number | null,
};

const ENUMITEM_ITEMIZE_LABELS = [
  { value: "default", label: "Default" },
  { value: "bullet", label: "Bullet" },
  { value: "dash", label: "Dash" },
  { value: "asterisk", label: "Asterisk" },
  { value: "arrow", label: "Arrow" },
];

const ENUMITEM_ENUMERATE_LABELS = [
  { value: "default", label: "Default" },
  { value: "arabic_paren", label: "1)" },
  { value: "arabic_wrapped", label: "(1)" },
  { value: "alph", label: "a)" },
  { value: "alph_wrapped", label: "(a)" },
  { value: "roman", label: "i)" },
  { value: "Roman", label: "I." },
];

const ENUMITEM_SPACING_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "nosep", label: "Compact" },
  { value: "noitemsep", label: "No item spacing" },
  { value: "half", label: "Half item spacing" },
];

const ENUMITEM_CUSTOM_ENUM_LABELS = [
  { value: "\\arabic*.", label: "1." },
  { value: "(\\arabic*)", label: "(1)" },
  { value: "\\alph*)", label: "a)" },
  { value: "(\\alph*)", label: "(a)" },
  { value: "\\Roman*.", label: "I." },
  { value: "\\roman*.", label: "i." },
];

const ENUMITEM_CUSTOM_ITEMIZE_LABELS = [
  { value: "\\bullet", label: "•" },
  { value: "\\textendash", label: "–" },
  { value: "\\textasteriskcentered", label: "*" },
  { value: "\\Rightarrow", label: "⇒" },
];

const DEFAULT_XCOLOR_REQUEST: XcolorBuilderRequest = {
  enabled: true,
  packageOptions: ["table", "dvipsnames"],
  colors: [
    { name: "datatexPrimary", model: "HTML", value: "228BE6" },
    { name: "datatexAccent", model: "HTML", value: "7950F2" },
    { name: "datatexSuccess", model: "HTML", value: "40C057" },
    { name: "datatexWarning", model: "HTML", value: "FAB005" },
  ],
  aliases: [],
};

const XCOLOR_COLOR_MODELS = [
  { value: "HTML", label: "HTML (Hex)" },
  { value: "rgb", label: "rgb (0-1)" },
  { value: "RGB", label: "RGB (0-255)" },
  { value: "cmy", label: "cmy (0-1)" },
  { value: "cmyk", label: "cmyk (0-1)" },
  { value: "hsb", label: "hsb (0-1)" },
  { value: "HSB", label: "HSB (0-255)" },
  { value: "gray", label: "gray (0-1)" },
  { value: "Gray", label: "Gray (0-15)" },
];

const MINTED_STYLE_OPTIONS = [
  "friendly",
  "default",
  "colorful",
  "monokai",
  "manni",
  "material",
  "borland",
  "emacs",
  "vs",
  "xcode",
].map((style) => ({ value: style, label: style }));

const CODE_SNIPPET_SAMPLE = [
  "def solve(x):",
  "    return x ** 2 + 1",
].join("\n");

const codeLanguageOptions = (engine: string) =>
  LANGUAGES_DB.filter((language) =>
    engine === "listings" ? Boolean(language.listings) : true,
  ).map((language) => ({
    value: language.value,
    label:
      engine === "listings" && language.listings
        ? `${language.label} · ${language.listings}`
        : `${language.label} · ${language.minted}`,
  }));

const ensureSupportedCodeLanguage = (engine: string, languageValue: string) => {
  const options = codeLanguageOptions(engine);
  return options.some((option) => option.value === languageValue)
    ? languageValue
    : options[0]?.value || "python";
};

export const PackageStudioWorkspace: React.FC<PackageStudioWorkspaceProps> = ({
  activeBuilderId,
  onSelectBuilder,
  onBackToEditor,
  onInsertCode,
  onFixDiagnostic,
  onApplyBuilderConfiguration,
  onRevealSourceLine,
  onReviewEditPlan,
  pendingEditReview,
  onApplyPendingEditPlan,
  onDismissPendingEditPlan,
  activeFilePath,
  activeFileContent,
}) => {
  const { t } = useTranslation();
  const [builders, setBuilders] = useState<BuilderDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<LatexPackageAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadBuilders = async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await listPackageBuilders();
        if (!mounted) return;
        setBuilders(loaded);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to load package builders:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadBuilders();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeBuilderId && builders[0]) {
      onSelectBuilder(builders[0].id);
    }
  }, [activeBuilderId, builders, onSelectBuilder]);

  useEffect(() => {
    let mounted = true;
    const source = activeFileContent || "";

    if (!activeFilePath || !source.trim()) {
      setAnalysis(null);
      setAnalysisError(null);
      setAnalysisLoading(false);
      return;
    }

    const analyze = async () => {
      setAnalysisLoading(true);
      setAnalysisError(null);
      try {
        const result = await analyzeLatexPackages(source, Date.now());
        if (mounted) setAnalysis(result);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to analyze active document packages:", caught);
        setAnalysisError(String(caught));
      } finally {
        if (mounted) setAnalysisLoading(false);
      }
    };

    void analyze();

    return () => {
      mounted = false;
    };
  }, [activeFileContent, activeFilePath]);

  const activeBuilder =
    builders.find((builder) => builder.id === activeBuilderId) ??
    builders[0] ??
    null;

  return (
    <Box
      h="100%"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--app-bg)",
      }}
    >
      <Group
        h={58}
        px="md"
        justify="space-between"
        wrap="nowrap"
        style={{
          borderBottom: "1px solid var(--app-border-color)",
          background: "var(--app-header-bg)",
          flexShrink: 0,
        }}
      >
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon size={34} radius="md" variant="light" color="blue">
            <FontAwesomeIcon icon={faBoxOpen} />
          </ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Title order={4} style={{ lineHeight: 1.2 }}>
              {t("packageStudio.title", {
                defaultValue: "Package Studio",
              })}
            </Title>
            <Text size="xs" c="dimmed" truncate>
              {t("packageStudio.subtitle", {
                defaultValue:
                  "Native LaTeX package builders, previews, and insertion workflows.",
              })}
            </Text>
          </Box>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Badge variant="light" color="blue">
            {builders.length}{" "}
            {t("packageStudio.builders", {
              defaultValue: "builders",
            })}
          </Badge>
          <Button
            size="xs"
            variant="light"
            color="gray"
            leftSection={<FontAwesomeIcon icon={faArrowLeft} />}
            onClick={onBackToEditor}
          >
            {t("packageStudio.backToEditor", {
              defaultValue: "Editor",
            })}
          </Button>
        </Group>
      </Group>

      <Box
        p="md"
        style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
      >
        <Box
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            height: "100%",
            maxHeight: "100%",
            overflowY: "scroll",
            overflowX: "hidden",
            paddingRight: 8,
            paddingBottom: 24,
            scrollbarGutter: "stable",
          }}
          className="package-studio-main-scroll"
        >
          <Box
            style={{
              minHeight: "100%",
              paddingBottom: 8,
            }}
          >
            {loading ? (
              <Group justify="center" py="xl">
                <Loader size="sm" />
              </Group>
            ) : error ? (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            ) : activeBuilder ? (
              <Stack gap="md">
                <Group align="stretch" gap="md" wrap="wrap">
                  <Box style={{ flex: "1 1 340px", minWidth: 0 }}>
                    <PackageBuilderHero builder={activeBuilder} />
                  </Box>
                  <Box style={{ flex: "1.45 1 480px", minWidth: 0 }}>
                    <CompactBuilderContext
                      activeBuilder={activeBuilder}
                      activeFilePath={activeFilePath}
                      activeFileContent={activeFileContent}
                      analysis={analysis}
                      loading={analysisLoading}
                      error={analysisError}
                      onRevealSourceLine={onRevealSourceLine}
                      onFixDiagnostic={onFixDiagnostic}
                    />
                  </Box>
                </Group>
                {pendingEditReview && (
                  <PackageEditReviewPanel
                    review={pendingEditReview}
                    onApply={onApplyPendingEditPlan}
                    onDismiss={onDismissPendingEditPlan}
                    onRevealSourceLine={onRevealSourceLine}
                  />
                )}

                <Box
                  style={{
                    display: activeBuilder.id === "geometry" ? "block" : "none",
                  }}
                >
                  <GeometryBuilderPanel
                    activeFilePath={activeFilePath}
                    activeFileContent={activeFileContent}
                    analysis={analysis}
                    onApplyBuilderConfiguration={onApplyBuilderConfiguration}
                  />
                </Box>
                <Box
                  style={{
                    display:
                      activeBuilder.id === "code-highlighting"
                        ? "block"
                        : "none",
                  }}
                >
                  <CodeHighlightingBuilderPanel
                    activeFilePath={activeFilePath}
                    activeFileContent={activeFileContent}
                    analysis={analysis}
                    onInsertCode={onInsertCode}
                    onApplyBuilderConfiguration={onApplyBuilderConfiguration}
                  />
                </Box>
                <Box
                  style={{
                    display: activeBuilder.id === "xcolor" ? "block" : "none",
                  }}
                >
                  <XcolorBuilderPanel
                    activeFilePath={activeFilePath}
                    activeFileContent={activeFileContent}
                    analysis={analysis}
                    onInsertCode={onInsertCode}
                    onApplyBuilderConfiguration={onApplyBuilderConfiguration}
                  />
                </Box>
                <Box
                  style={{
                    display: activeBuilder.id === "fancyhdr" ? "block" : "none",
                  }}
                >
                  <FancyhdrBuilderPanel
                    activeFilePath={activeFilePath}
                    activeFileContent={activeFileContent}
                    analysis={analysis}
                    onApplyBuilderConfiguration={onApplyBuilderConfiguration}
                  />
                </Box>
                <Box
                  style={{
                    display: activeBuilder.id === "enumitem" ? "block" : "none",
                  }}
                >
                  <EnumitemBuilderPanel
                    activeFilePath={activeFilePath}
                    activeFileContent={activeFileContent}
                    analysis={analysis}
                    onApplyBuilderConfiguration={onApplyBuilderConfiguration}
                  />
                </Box>
                <Box
                  style={{
                    display: activeBuilder.id === "graphicx" ? "block" : "none",
                  }}
                >
                  <GraphicxBuilderPanel
                    activeFilePath={activeFilePath}
                    activeFileContent={activeFileContent}
                    analysis={analysis}
                    onInsertCode={onInsertCode}
                    onApplyBuilderConfiguration={onApplyBuilderConfiguration}
                  />
                </Box>
                <Box
                  style={{
                    display: activeBuilder.id === "tables" ? "block" : "none",
                  }}
                >
                  <TableBuilderPanel
                    activeFilePath={activeFilePath}
                    analysis={analysis}
                    onInsertCode={onInsertCode}
                    onApplyBuilderConfiguration={onApplyBuilderConfiguration}
                  />
                </Box>
                <Box
                  style={{
                    display: activeBuilder.id === "math" ? "block" : "none",
                  }}
                >
                  <MathBuilderPanel
                    activeFilePath={activeFilePath}
                    activeFileContent={activeFileContent}
                    analysis={analysis}
                    onInsertCode={onInsertCode}
                    onReviewEditPlan={onReviewEditPlan}
                    onApplyBuilderConfiguration={onApplyBuilderConfiguration}
                  />
                </Box>
                <Box
                  style={{
                    display: activeBuilder.id === "siunitx" ? "block" : "none",
                  }}
                >
                  <SiunitxBuilderPanel
                    activeFilePath={activeFilePath}
                    activeFileContent={activeFileContent}
                    analysis={analysis}
                    onInsertCode={onInsertCode}
                    onApplyBuilderConfiguration={onApplyBuilderConfiguration}
                  />
                </Box>
                {![
                  "geometry",
                  "code-highlighting",
                  "xcolor",
                  "fancyhdr",
                  "enumitem",
                  "graphicx",
                  "tables",
                  "math",
                  "siunitx",
                ].includes(activeBuilder.id) && (
                  <Alert variant="light" color="blue">
                    {t("packageStudio.nextStepNote", {
                      defaultValue:
                        "Next step: attach the first native forms to these builders and reuse the generated Rust output for insertion.",
                    })}
                  </Alert>
                )}
              </Stack>
            ) : (
              <Paper withBorder p="xl" radius="md">
                <Text c="dimmed" ta="center">
                  {t("packageStudio.empty", {
                    defaultValue: "No package builders are available yet.",
                  })}
                </Text>
              </Paper>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const BuilderActivationBar: React.FC<{
  builderId: string;
  managedPackageIds: string[];
  output: BuilderOutput | null;
  generatedBlocks?: Array<{ blockId: string; code: string }>;
  activeFilePath?: string;
  analysis: LatexPackageAnalysis | null;
  loading?: boolean;
  onApply: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  builderId,
  managedPackageIds,
  output,
  generatedBlocks = [],
  activeFilePath,
  analysis,
  loading = false,
  onApply,
}) => {
  const { t } = useTranslation();
  const installed = managedPackageIds.filter((packageId) =>
    analysis?.packages.some((present) =>
      present.toLowerCase() === packageId.toLowerCase(),
    ),
  );
  const enabled = installed.length > 0;
  const canApply = Boolean(activeFilePath && output && !loading);

  const apply = (nextEnabled: boolean) => {
    if (!output || !activeFilePath) return;
    onApply({
      builderId,
      enabled: nextEnabled,
      managedPackageIds,
      requirements: nextEnabled ? output.requirements : [],
      generatedBlocks,
    });
  };

  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      style={{
        borderColor: enabled
          ? "var(--mantine-color-teal-7)"
          : "var(--app-border-color)",
        background: enabled
          ? "color-mix(in srgb, var(--mantine-color-teal-9), transparent 88%)"
          : undefined,
      }}
    >
      <Group justify="space-between" gap="md" align="center" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <Switch
            size="md"
            checked={enabled}
            disabled={!canApply}
            color="teal"
            onChange={(event) => {
              const checked = inputChecked(event);
              apply(checked);
            }}
            aria-label={t("packageStudio.activation.toggle", {
              defaultValue: "Use package in current document",
            })}
          />
          <Box style={{ minWidth: 0 }}>
            <Group gap={6} wrap="wrap">
              <Text size="sm" fw={700}>
                {t("packageStudio.activation.title", {
                  defaultValue: "Use in current document",
                })}
              </Text>
              <Badge
                size="xs"
                variant="light"
                color={enabled ? "teal" : "gray"}
              >
                {enabled
                  ? t("packageStudio.activation.active", {
                      defaultValue: "active in preamble",
                    })
                  : t("packageStudio.activation.inactive", {
                      defaultValue: "not in preamble",
                    })}
              </Badge>
              {installed.map((packageId) => (
                <Badge key={packageId} size="xs" variant="outline" color="teal">
                  {packageId}
                </Badge>
              ))}
            </Group>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {!activeFilePath
                ? t("packageStudio.activation.openDocument", {
                    defaultValue: "Open a LaTeX document to manage this package.",
                  })
                : t("packageStudio.activation.hint", {
                    defaultValue:
                      "The switch adds or removes the package. Option and setup changes are applied together after review.",
                  })}
            </Text>
          </Box>
        </Group>
        <Button
          size="xs"
          variant={enabled ? "light" : "filled"}
          color={enabled ? "blue" : "teal"}
          leftSection={<FontAwesomeIcon icon={enabled ? faCheck : faPlus} />}
          disabled={!canApply}
          onClick={() => apply(true)}
          style={{ flexShrink: 0 }}
        >
          {enabled
            ? t("packageStudio.activation.reviewChanges", {
                defaultValue: "Review & apply changes",
              })
            : t("packageStudio.activation.enable", {
                defaultValue: "Enable with these settings",
              })}
        </Button>
      </Group>
    </Paper>
  );
};

type NumericGeometryKey =
  | "marginTop"
  | "marginBottom"
  | "marginLeft"
  | "marginRight"
  | "columnSep"
  | "marginSep"
  | "marginWidth"
  | "headHeight"
  | "headSep"
  | "footSkip"
  | "bindingOffset"
  | "hOffset"
  | "vOffset";

const GeometryBuilderPanel: React.FC<{
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  activeFilePath,
  activeFileContent,
  analysis,
  onApplyBuilderConfiguration,
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<GeometryBuilderRequest>(
    DEFAULT_GEOMETRY_REQUEST,
  );
  const [output, setOutput] = useState<BuilderOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { options: geometryOptions } = useBuilderOptions("geometry");
  const geometryOption = (option: string) =>
    geometryOptions.find((item) => item.option === option);

  useEffect(() => {
    if (!activeFilePath || !activeFileContent) return;
    let mounted = true;
    void importGeometry(activeFileContent)
      .then((imported) => {
        if (!mounted) return;
        setRequest((current) => ({
          ...current,
          ...imported,
        }));
      })
      .catch((caught) => {
        console.error("Failed to import geometry setup:", caught);
      });
    return () => {
      mounted = false;
    };
  }, [activeFilePath, activeFileContent]);

  useEffect(() => {
    if (!activeFilePath || !analysis || activeFileContent) return;
    const declaration = analysis.declarations.find(
      (item) =>
        (item.kind === "usePackage" || item.kind === "requirePackage") &&
        item.name.toLowerCase() === "geometry",
    );
    if (!declaration) return;
    setRequest((current) =>
      hydrateGeometryFromOptions(current, declaration.options),
    );
  }, [activeFilePath, analysis]);

  useEffect(() => {
    let mounted = true;

    const build = async () => {
      setLoading(true);
      setError(null);
      try {
        const generated = await generateGeometry(request);
        if (mounted) setOutput(generated);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to generate geometry package code:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void build(), 90);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  const updateNumber =
    (key: NumericGeometryKey) => (value: string | number) => {
      setRequest((current) => {
        const numeric =
          typeof value === "number" ? value : Number.parseFloat(value);
        return {
          ...current,
          [key]: Number.isFinite(numeric) ? numeric : current[key],
        };
      });
    };

  const updateBoolean =
    (key: keyof Pick<
      GeometryBuilderRequest,
      "marginNotes" | "includeMp" | "includeHead" | "includeFoot"
    >) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = inputChecked(event);
      setRequest((current) => ({
        ...current,
        [key]: checked,
      }));
    };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="indigo">
                <FontAwesomeIcon icon={faLayerGroup} />
              </ThemeIcon>
              <Text fw={700}>
                {t("packageStudio.geometry.title", {
                  defaultValue: "Geometry builder",
                })}
              </Text>
              {loading && <Loader size="xs" />}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {t("packageStudio.geometry.description", {
                defaultValue:
                  "Configure margins and page layout. Output is generated by the Rust geometry builder.",
              })}
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setRequest(DEFAULT_GEOMETRY_REQUEST)}
            >
              {t("packageStudio.reset", { defaultValue: "Reset" })}
            </Button>
          </Group>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <BuilderActivationBar
          builderId="geometry"
          managedPackageIds={["geometry"]}
          output={output}
          activeFilePath={activeFilePath}
          analysis={analysis}
          loading={loading}
          onApply={onApplyBuilderConfiguration}
        />

        <Group align="stretch" gap="md" style={{ minHeight: 0 }}>
          <Box style={{ flex: 1.15, minWidth: 360 }}>
            <Stack gap="md">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="xs">
                    <NumberInput
                      size="xs"
                      label={
                        <OptionControlLabel
                          label={t("packageStudio.geometry.top", {
                            defaultValue: "Top margin (cm)",
                          })}
                          descriptor={geometryOption("top")}
                        />
                      }
                      min={0}
                      step={0.1}
                      value={request.marginTop}
                      onChange={updateNumber("marginTop")}
                    />
                    <NumberInput
                      size="xs"
                      label={
                        <OptionControlLabel
                          label={t("packageStudio.geometry.bottom", {
                            defaultValue: "Bottom margin (cm)",
                          })}
                          descriptor={geometryOption("bottom")}
                        />
                      }
                      min={0}
                      step={0.1}
                      value={request.marginBottom}
                      onChange={updateNumber("marginBottom")}
                    />
                    <NumberInput
                      size="xs"
                      label={
                        <OptionControlLabel
                          label={t("packageStudio.geometry.left", {
                            defaultValue: "Left margin (cm)",
                          })}
                          descriptor={geometryOption("left")}
                        />
                      }
                      min={0}
                      step={0.1}
                      value={request.marginLeft}
                      onChange={updateNumber("marginLeft")}
                    />
                    <NumberInput
                      size="xs"
                      label={
                        <OptionControlLabel
                          label={t("packageStudio.geometry.right", {
                            defaultValue: "Right margin (cm)",
                          })}
                          descriptor={geometryOption("right")}
                        />
                      }
                      min={0}
                      step={0.1}
                      value={request.marginRight}
                      onChange={updateNumber("marginRight")}
                    />
                  </SimpleGrid>
                </Stack>
              </Paper>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Paper withBorder p="sm" radius="md">
                  <Stack gap="sm">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.geometry.columns", {
                        defaultValue: "Columns and sidedness",
                      })}
                    </Text>
                    <Select
                      size="xs"
                      label={t("packageStudio.geometry.columnMode", {
                        defaultValue: "Column mode",
                      })}
                      data={[
                        { value: "one", label: "One column" },
                        { value: "two", label: "Two columns" },
                      ]}
                      value={request.columns}
                      onChange={(value) =>
                        setRequest((current) => ({
                          ...current,
                          columns: value || "one",
                        }))
                      }
                    />
                    <NumberInput
                      size="xs"
                      label={
                        <OptionControlLabel
                          label={t("packageStudio.geometry.columnSep", {
                            defaultValue: "Column separation (cm)",
                          })}
                          descriptor={geometryOption("columnsep")}
                        />
                      }
                      min={0}
                      step={0.1}
                      disabled={request.columns !== "two"}
                      value={request.columnSep}
                      onChange={updateNumber("columnSep")}
                    />
                    <Select
                      size="xs"
                      label={
                        <OptionControlLabel
                          label={t("packageStudio.geometry.sidedness", {
                            defaultValue: "Sidedness",
                          })}
                          descriptor={geometryOption("asymmetric")}
                        />
                      }
                      data={[
                        { value: "oneside", label: "One-sided" },
                        { value: "twoside", label: "Two-sided (document class)" },
                        { value: "asymmetric", label: "Asymmetric" },
                      ]}
                      value={request.sidedness}
                      onChange={(value) =>
                        setRequest((current) => ({
                          ...current,
                          sidedness: value || "oneside",
                        }))
                      }
                    />
                    {request.sidedness === "twoside" && (
                      <Alert variant="light" color="blue">
                        <Text size="xs">
                          {t("packageStudio.geometry.twosideHint", {
                            defaultValue:
                              "Two-sided layout is a document-class option. Package Studio detects it here, but the geometry package edit will not add or remove \\documentclass[twoside].",
                          })}
                        </Text>
                      </Alert>
                    )}
                    {request.sidedness === "asymmetric" && (
                      <Alert variant="light" color="violet">
                        <Text size="xs">
                          {t("packageStudio.geometry.asymmetricHint", {
                            defaultValue:
                              "Asymmetric is a geometry option, so it will be included in the reviewed package edit.",
                          })}
                        </Text>
                      </Alert>
                    )}
                  </Stack>
                </Paper>

                <Paper withBorder p="sm" radius="md">
                  <Stack gap="sm">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.geometry.marginNotes", {
                        defaultValue: "Margin notes",
                      })}
                    </Text>
                    <Switch
                      size="sm"
                      label={t("packageStudio.geometry.enableMarginNotes", {
                        defaultValue: "Reserve margin note space",
                      })}
                      checked={request.marginNotes}
                      onChange={updateBoolean("marginNotes")}
                    />
                    <SimpleGrid cols={2} spacing="xs">
                      <NumberInput
                        size="xs"
                        label={
                          <OptionControlLabel
                            label={t("packageStudio.geometry.marginSep", {
                              defaultValue: "Separation (cm)",
                            })}
                            descriptor={geometryOption("marginparsep")}
                          />
                        }
                        min={0}
                        step={0.1}
                        disabled={!request.marginNotes}
                        value={request.marginSep}
                        onChange={updateNumber("marginSep")}
                      />
                      <NumberInput
                        size="xs"
                        label={
                          <OptionControlLabel
                            label={t("packageStudio.geometry.marginWidth", {
                              defaultValue: "Width (cm)",
                            })}
                            descriptor={geometryOption("marginparwidth")}
                          />
                        }
                        min={0}
                        step={0.1}
                        disabled={!request.marginNotes}
                        value={request.marginWidth}
                        onChange={updateNumber("marginWidth")}
                      />
                    </SimpleGrid>
                    <Switch
                      size="sm"
                      label={
                        <OptionControlLabel
                          label="includemp"
                          descriptor={geometryOption("includemp")}
                        />
                      }
                      disabled={!request.marginNotes}
                      checked={request.includeMp}
                      onChange={updateBoolean("includeMp")}
                    />
                  </Stack>
                </Paper>
              </SimpleGrid>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Text size="sm" fw={700}>
                    {t("packageStudio.geometry.headerFooterOffsets", {
                      defaultValue: "Header, footer, and offsets",
                    })}
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="xs">
                    <NumberInput
                      size="xs"
                      label={<OptionControlLabel label="headheight (cm)" descriptor={geometryOption("headheight")} />}
                      min={0}
                      step={0.1}
                      value={request.headHeight}
                      onChange={updateNumber("headHeight")}
                    />
                    <NumberInput
                      size="xs"
                      label={<OptionControlLabel label="headsep (cm)" descriptor={geometryOption("headsep")} />}
                      min={0}
                      step={0.1}
                      value={request.headSep}
                      onChange={updateNumber("headSep")}
                    />
                    <NumberInput
                      size="xs"
                      label={<OptionControlLabel label="footskip (cm)" descriptor={geometryOption("footskip")} />}
                      min={0}
                      step={0.1}
                      value={request.footSkip}
                      onChange={updateNumber("footSkip")}
                    />
                    <NumberInput
                      size="xs"
                      label={<OptionControlLabel label="bindingoffset (cm)" descriptor={geometryOption("bindingoffset")} />}
                      min={0}
                      step={0.1}
                      value={request.bindingOffset}
                      onChange={updateNumber("bindingOffset")}
                    />
                    <NumberInput
                      size="xs"
                      label={<OptionControlLabel label="hoffset (cm)" descriptor={geometryOption("hoffset")} />}
                      step={0.1}
                      value={request.hOffset}
                      onChange={updateNumber("hOffset")}
                    />
                    <NumberInput
                      size="xs"
                      label={<OptionControlLabel label="voffset (cm)" descriptor={geometryOption("voffset")} />}
                      step={0.1}
                      value={request.vOffset}
                      onChange={updateNumber("vOffset")}
                    />
                  </SimpleGrid>
                  <Group gap="md">
                    <Switch
                      size="sm"
                      label={<OptionControlLabel label="includehead" descriptor={geometryOption("includehead")} />}
                      checked={request.includeHead}
                      onChange={updateBoolean("includeHead")}
                    />
                    <Switch
                      size="sm"
                      label={<OptionControlLabel label="includefoot" descriptor={geometryOption("includefoot")} />}
                      checked={request.includeFoot}
                      onChange={updateBoolean("includeFoot")}
                    />
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Box>

          <Box style={{ width: 360, minWidth: 320 }}>
            <Stack gap="md" h="100%">
              <GeometryPagePreview request={request} />
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.generatedCode", {
                        defaultValue: "Generated code",
                      })}
                    </Text>
                    <Badge size="xs" variant="light" color="indigo">
                      Rust
                    </Badge>
                  </Group>
                  <Textarea
                    readOnly
                    autosize
                    minRows={4}
                    maxRows={8}
                    value={output?.code || ""}
                    styles={{
                      input: {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      },
                    }}
                  />
                  {output?.requirements.length ? (
                    <Group gap={6}>
                      {output.requirements.map((requirement) => (
                        <Badge
                          key={requirement.packageId}
                          size="xs"
                          variant="outline"
                          color="gray"
                        >
                          {requirement.packageId} ·{" "}
                          {requirement.options.length} options
                        </Badge>
                      ))}
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed">
                      {t("packageStudio.noPackageOutput", {
                        defaultValue: "Package output disabled.",
                      })}
                    </Text>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
};

const GeometryPagePreview: React.FC<{ request: GeometryBuilderRequest }> = ({
  request,
}) => {
  const maxMargin = Math.max(
    request.marginTop,
    request.marginBottom,
    request.marginLeft,
    request.marginRight,
    0.1,
  );
  const scale = 22 / Math.max(maxMargin, 2.5);
  const pagePadding = {
    paddingTop: `${Math.max(8, request.marginTop * scale)}px`,
    paddingBottom: `${Math.max(8, request.marginBottom * scale)}px`,
    paddingLeft: `${Math.max(8, request.marginLeft * scale)}px`,
    paddingRight: `${Math.max(8, request.marginRight * scale)}px`,
  };

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={700}>
            Live layout sketch
          </Text>
          <Badge size="xs" variant="light" color="gray">
            instant
          </Badge>
        </Group>
        <Box
          style={{
            height: 250,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "var(--mantine-color-dark-7)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <Box
            style={{
              width: 150,
              height: 218,
              background: request.enabled
                ? "var(--mantine-color-gray-0)"
                : "var(--mantine-color-gray-3)",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
              ...pagePadding,
              transition: "padding 120ms ease",
            }}
          >
            <Box
              style={{
                height: "100%",
                border: "1px dashed var(--mantine-color-blue-5)",
                background:
                  "linear-gradient(180deg, rgba(34,139,230,0.12), rgba(34,139,230,0.04))",
                display: "grid",
                gridTemplateColumns:
                  request.columns === "two" ? "1fr 1fr" : "1fr",
                gap: request.columns === "two" ? request.columnSep * 7 : 0,
                padding: 6,
              }}
            >
              <Box
                style={{
                  borderRadius: 3,
                  background: "rgba(34, 139, 230, 0.25)",
                }}
              />
              {request.columns === "two" && (
                <Box
                  style={{
                    borderRadius: 3,
                    background: "rgba(34, 139, 230, 0.25)",
                  }}
                />
              )}
            </Box>
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
};

const GraphicxBuilderPanel: React.FC<{
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  onInsertCode: (code: string) => void;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  activeFilePath,
  activeFileContent,
  analysis,
  onInsertCode,
  onApplyBuilderConfiguration,
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<GraphicxBuilderRequest>(
    DEFAULT_GRAPHICX_REQUEST,
  );
  const [output, setOutput] = useState<BuilderOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFromDocument = async () => {
    if (!activeFileContent) return;
    try {
      const imported = await importGraphicx(activeFileContent);
      setRequest((current) => ({
        ...current,
        ...imported,
      }));
    } catch (caught) {
      console.error("Failed to import graphicx snippet:", caught);
      setError(String(caught));
    }
  };

  useEffect(() => {
    if (!activeFilePath || !activeFileContent) return;
    let mounted = true;
    void importGraphicx(activeFileContent)
      .then((imported) => {
        if (!mounted) return;
        setRequest((current) => ({
          ...current,
          ...imported,
        }));
      })
      .catch((caught) => {
        console.error("Failed to import graphicx snippet:", caught);
      });
    return () => {
      mounted = false;
    };
  }, [activeFilePath, activeFileContent]);

  useEffect(() => {
    let mounted = true;

    const build = async () => {
      setLoading(true);
      setError(null);
      try {
        const generated = await generateGraphicx(request);
        if (mounted) setOutput(generated);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to generate graphicx snippet:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void build(), 90);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  const updateText =
    (key: keyof Pick<
      GraphicxBuilderRequest,
      "filePath" | "width" | "height" | "caption" | "label"
    >) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = inputValue(event);
      setRequest((current) => ({ ...current, [key]: value }));
    };

  const updateNumber =
    (key: "scale" | "angle") => (value: string | number) => {
      const numeric =
        typeof value === "number" ? value : Number.parseFloat(value);
      setRequest((current) => ({
        ...current,
        [key]: Number.isFinite(numeric) ? numeric : null,
      }));
    };

  const updateBoolean =
    (key: keyof Pick<
      GraphicxBuilderRequest,
      "keepAspectRatio" | "useFigure" | "center"
    >) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = inputChecked(event);
      setRequest((current) => ({ ...current, [key]: checked }));
    };

  const handleBrowseImage = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "LaTeX graphics",
            extensions: ["png", "jpg", "jpeg", "pdf", "eps", "svg"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setRequest((current) => ({
          ...current,
          filePath: selected.replace(/\\/g, "/"),
        }));
      }
    } catch (caught) {
      console.error("Failed to open graphicx image dialog:", caught);
      setError(String(caught));
    }
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="orange">
                <FontAwesomeIcon icon={faImage} />
              </ThemeIcon>
              <Text fw={700}>
                {t("packageStudio.graphicx.title", {
                  defaultValue: "Graphicx figure builder",
                })}
              </Text>
              {loading && <Loader size="xs" />}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {t("packageStudio.graphicx.description", {
                defaultValue:
                  "Generate includegraphics commands, optional figure wrappers, and the graphicx package requirement.",
              })}
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setRequest(DEFAULT_GRAPHICX_REQUEST)}
            >
              {t("packageStudio.reset", { defaultValue: "Reset" })}
            </Button>
            <Button
              size="xs"
              variant="light"
              color="orange"
              disabled={!activeFileContent}
              onClick={() => void importFromDocument()}
            >
              {t("packageStudio.importFromDocument", {
                defaultValue: "Import from document",
              })}
            </Button>
          </Group>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <BuilderActivationBar
          builderId="graphicx"
          managedPackageIds={["graphicx"]}
          output={output}
          generatedBlocks={[]}
          activeFilePath={activeFilePath}
          analysis={analysis}
          loading={loading}
          onApply={onApplyBuilderConfiguration}
        />

        <Group align="stretch" gap="md">
          <Box style={{ flex: 1.15, minWidth: 420 }}>
            <Stack gap="md">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Text size="sm" fw={700}>
                    {t("packageStudio.graphicx.source", {
                      defaultValue: "Image source",
                    })}
                  </Text>
                  <Group align="flex-end" gap="xs" wrap="nowrap">
                    <TextInput
                      size="xs"
                      label={t("packageStudio.graphicx.filePath", {
                        defaultValue: "File path",
                      })}
                      placeholder="figures/diagram.pdf"
                      value={request.filePath}
                      onChange={updateText("filePath")}
                      style={{ flex: 1 }}
                    />
                    <Button
                      size="xs"
                      variant="light"
                      color="orange"
                      leftSection={<FontAwesomeIcon icon={faFolderOpen} />}
                      onClick={handleBrowseImage}
                    >
                      {t("packageStudio.graphicx.browse", {
                        defaultValue: "Browse",
                      })}
                    </Button>
                  </Group>
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.graphicx.dimensions", {
                        defaultValue: "Dimensions and transform",
                      })}
                    </Text>
                    <Badge size="xs" variant="light" color="orange">
                      \\includegraphics
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                    <Group gap="xs" align="flex-end" wrap="nowrap">
                      <TextInput
                        size="xs"
                        label={t("packageStudio.graphicx.width", {
                          defaultValue: "Width",
                        })}
                        value={request.width}
                        onChange={updateText("width")}
                        style={{ flex: 1 }}
                      />
                      <Select
                        size="xs"
                        label={t("packageStudio.graphicx.unit", {
                          defaultValue: "Unit",
                        })}
                        data={GRAPHICX_WIDTH_UNITS}
                        value={request.widthUnit}
                        onChange={(value) =>
                          setRequest((current) => ({
                            ...current,
                            widthUnit: value || "\\textwidth",
                          }))
                        }
                        w={130}
                      />
                    </Group>
                    <Group gap="xs" align="flex-end" wrap="nowrap">
                      <TextInput
                        size="xs"
                        label={t("packageStudio.graphicx.height", {
                          defaultValue: "Height",
                        })}
                        value={request.height}
                        onChange={updateText("height")}
                        style={{ flex: 1 }}
                      />
                      <Select
                        size="xs"
                        label={t("packageStudio.graphicx.unit", {
                          defaultValue: "Unit",
                        })}
                        data={GRAPHICX_HEIGHT_UNITS}
                        value={request.heightUnit}
                        onChange={(value) =>
                          setRequest((current) => ({
                            ...current,
                            heightUnit: value || "cm",
                          }))
                        }
                        w={130}
                      />
                    </Group>
                    <NumberInput
                      size="xs"
                      label={t("packageStudio.graphicx.scale", {
                        defaultValue: "Scale",
                      })}
                      min={0}
                      step={0.1}
                      value={request.scale ?? ""}
                      onChange={updateNumber("scale")}
                    />
                    <NumberInput
                      size="xs"
                      label={t("packageStudio.graphicx.angle", {
                        defaultValue: "Angle",
                      })}
                      step={1}
                      value={request.angle ?? ""}
                      onChange={updateNumber("angle")}
                    />
                  </SimpleGrid>
                  <Switch
                    size="sm"
                    label={t("packageStudio.graphicx.keepAspectRatio", {
                      defaultValue: "Keep aspect ratio when width or height is set",
                    })}
                    checked={request.keepAspectRatio}
                    onChange={updateBoolean("keepAspectRatio")}
                  />
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.graphicx.figureWrapper", {
                        defaultValue: "Figure wrapper",
                      })}
                    </Text>
                    <Switch
                      size="sm"
                      checked={request.useFigure}
                      onChange={updateBoolean("useFigure")}
                    />
                  </Group>
                  {request.useFigure && (
                    <>
                      <Group gap="md">
                        <Switch
                          size="sm"
                          label={t("packageStudio.graphicx.centering", {
                            defaultValue: "Centering",
                          })}
                          checked={request.center}
                          onChange={updateBoolean("center")}
                        />
                        <Select
                          size="xs"
                          label={t("packageStudio.graphicx.placement", {
                            defaultValue: "Placement",
                          })}
                          data={GRAPHICX_PLACEMENTS}
                          value={request.placement}
                          onChange={(value) =>
                            setRequest((current) => ({
                              ...current,
                              placement: value || "ht",
                            }))
                          }
                          w={220}
                        />
                      </Group>
                      <TextInput
                        size="xs"
                        label={t("packageStudio.graphicx.caption", {
                          defaultValue: "Caption",
                        })}
                        value={request.caption}
                        onChange={updateText("caption")}
                      />
                      <TextInput
                        size="xs"
                        label={t("packageStudio.graphicx.label", {
                          defaultValue: "Label",
                        })}
                        placeholder="fig:my_image"
                        value={request.label}
                        onChange={updateText("label")}
                      />
                    </>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Box>

          <Box style={{ width: 390, minWidth: 330 }}>
            <Stack gap="md">
              <GraphicxPreview request={request} />
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.graphicx.generatedSnippet", {
                        defaultValue: "Generated body snippet",
                      })}
                    </Text>
                    <Badge size="xs" variant="light" color="orange">
                      Rust
                    </Badge>
                  </Group>
                  <Textarea
                    readOnly
                    autosize
                    minRows={8}
                    maxRows={16}
                    value={output?.code || ""}
                    styles={{
                      input: {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      },
                    }}
                  />
                  <Group justify="space-between">
                    <Group gap={6}>
                      {output?.requirements.map((requirement) => (
                        <Badge
                          key={requirement.packageId}
                          size="xs"
                          variant="outline"
                          color="gray"
                        >
                          {requirement.packageId}
                        </Badge>
                      ))}
                    </Group>
                    <Button
                      size="xs"
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                      disabled={!output?.code.trim()}
                      onClick={() => output?.code && onInsertCode(output.code)}
                    >
                      {t("packageStudio.insertAtCursor", {
                        defaultValue: "Insert at cursor",
                      })}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
};

const TableBuilderPanel: React.FC<{
  activeFilePath?: string;
  analysis: LatexPackageAnalysis | null;
  onInsertCode: (code: string) => void;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  activeFilePath,
  analysis,
  onInsertCode,
  onApplyBuilderConfiguration,
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<TableBuilderRequest>(
    DEFAULT_TABLE_REQUEST,
  );
  const [output, setOutput] = useState<BuilderOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState({ row: 0, column: 0 });
  const [isSelectingCells, setIsSelectingCells] = useState(false);
  const [selection, setSelection] = useState({
    startRow: 0,
    startColumn: 0,
    endRow: 0,
    endColumn: 0,
  });
  const [tableColor, setTableColor] = useState("#fff3bf");
  const [tableImportText, setTableImportText] = useState("");
  const [tableImportSummary, setTableImportSummary] = useState("");

  useEffect(() => {
    let mounted = true;

    const build = async () => {
      setLoading(true);
      setError(null);
      try {
        const generated = await generateTable(request);
        if (mounted) setOutput(generated);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to generate table snippet:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void build(), 90);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  const resizeGrid = (rows: number, columns: number) => {
    const nextRows = Math.max(1, Math.min(50, rows));
    const nextColumns = Math.max(1, Math.min(20, columns));
    setRequest((current) => {
      const cells = Array.from({ length: nextRows }, (_, rowIndex) =>
        Array.from(
          { length: nextColumns },
          (_, columnIndex) => current.cells[rowIndex]?.[columnIndex] ?? "",
        ),
      );
      const cellStyles = Array.from({ length: nextRows }, (_, rowIndex) =>
        Array.from(
          { length: nextColumns },
          (_, columnIndex) =>
            current.cellStyles[rowIndex]?.[columnIndex] ??
            createDefaultTableCellStyle(),
        ),
      );
      const cellSpans = Array.from({ length: nextRows }, (_, rowIndex) =>
        Array.from(
          { length: nextColumns },
          (_, columnIndex) =>
            current.cellSpans[rowIndex]?.[columnIndex] ??
            createDefaultTableCellSpan(),
        ),
      );
      const columnAlignments = Array.from(
        { length: nextColumns },
        (_, index) => current.columnAlignments[index] ?? "c",
      );
      const columnWeights = Array.from(
        { length: nextColumns },
        (_, index) => current.columnWeights?.[index] ?? "",
      );
      return {
        ...current,
        rows: nextRows,
        columns: nextColumns,
        cells,
        cellStyles,
        cellSpans,
        columnAlignments,
        columnWeights,
      };
    });
    setActiveCell((current) => ({
      row: Math.min(current.row, nextRows - 1),
      column: Math.min(current.column, nextColumns - 1),
    }));
    setSelection((current) => ({
      startRow: Math.min(current.startRow, nextRows - 1),
      startColumn: Math.min(current.startColumn, nextColumns - 1),
      endRow: Math.min(current.endRow, nextRows - 1),
      endColumn: Math.min(current.endColumn, nextColumns - 1),
    }));
  };

  const focusTableCell = (row: number, column: number) => {
    setActiveCell({ row, column });
    setSelection({
      startRow: row,
      startColumn: column,
      endRow: row,
      endColumn: column,
    });
  };

  const insertTableRow = () => {
    const insertIndex = Math.min(request.rows, activeCell.row + 1);
    setRequest((current) => {
      if (current.rows >= 50) return current;
      const nextRows = current.rows + 1;
      const shouldResetSpans = hasMergedTableCells(current.cellSpans);
      return {
        ...current,
        rows: nextRows,
        cells: [
          ...current.cells.slice(0, insertIndex),
          Array.from({ length: current.columns }, () => ""),
          ...current.cells.slice(insertIndex),
        ],
        cellStyles: [
          ...current.cellStyles.slice(0, insertIndex),
          createDefaultTableStyleRow(current.columns),
          ...current.cellStyles.slice(insertIndex),
        ],
        cellSpans: shouldResetSpans
          ? createDefaultTableSpanGrid(nextRows, current.columns)
          : [
              ...current.cellSpans.slice(0, insertIndex),
              createDefaultTableSpanRow(current.columns),
              ...current.cellSpans.slice(insertIndex),
            ],
      };
    });
    focusTableCell(insertIndex, activeCell.column);
  };

  const insertTableColumn = () => {
    const insertIndex = Math.min(request.columns, activeCell.column + 1);
    setRequest((current) => {
      if (current.columns >= 20) return current;
      const nextColumns = current.columns + 1;
      const shouldResetSpans = hasMergedTableCells(current.cellSpans);
      return {
        ...current,
        columns: nextColumns,
        cells: current.cells.map((row) => [
          ...row.slice(0, insertIndex),
          "",
          ...row.slice(insertIndex),
        ]),
        cellStyles: current.cellStyles.map((row) => [
          ...row.slice(0, insertIndex),
          createDefaultTableCellStyle(),
          ...row.slice(insertIndex),
        ]),
        cellSpans: shouldResetSpans
          ? createDefaultTableSpanGrid(current.rows, nextColumns)
          : current.cellSpans.map((row) => [
              ...row.slice(0, insertIndex),
              createDefaultTableCellSpan(),
              ...row.slice(insertIndex),
            ]),
        columnAlignments: [
          ...current.columnAlignments.slice(0, insertIndex),
          current.columnAlignments[activeCell.column] ?? "c",
          ...current.columnAlignments.slice(insertIndex),
        ],
        columnWeights: [
          ...(current.columnWeights ?? []).slice(0, insertIndex),
          "",
          ...(current.columnWeights ?? []).slice(insertIndex),
        ],
      };
    });
    focusTableCell(activeCell.row, insertIndex);
  };

  const removeActiveTableRow = () => {
    if (request.rows <= 1) return;
    const removeIndex = Math.min(activeCell.row, request.rows - 1);
    const nextRow = Math.max(0, Math.min(removeIndex, request.rows - 2));
    setRequest((current) => {
      if (current.rows <= 1) return current;
      const nextRows = current.rows - 1;
      const shouldResetSpans = hasMergedTableCells(current.cellSpans);
      return {
        ...current,
        rows: nextRows,
        cells: current.cells.filter((_, index) => index !== removeIndex),
        cellStyles: current.cellStyles.filter((_, index) => index !== removeIndex),
        cellSpans: shouldResetSpans
          ? createDefaultTableSpanGrid(nextRows, current.columns)
          : current.cellSpans.filter((_, index) => index !== removeIndex),
      };
    });
    focusTableCell(nextRow, activeCell.column);
  };

  const removeActiveTableColumn = () => {
    if (request.columns <= 1) return;
    const removeIndex = Math.min(activeCell.column, request.columns - 1);
    const nextColumn = Math.max(0, Math.min(removeIndex, request.columns - 2));
    setRequest((current) => {
      if (current.columns <= 1) return current;
      const nextColumns = current.columns - 1;
      const shouldResetSpans = hasMergedTableCells(current.cellSpans);
      return {
        ...current,
        columns: nextColumns,
        cells: current.cells.map((row) =>
          row.filter((_, index) => index !== removeIndex),
        ),
        cellStyles: current.cellStyles.map((row) =>
          row.filter((_, index) => index !== removeIndex),
        ),
        cellSpans: shouldResetSpans
          ? createDefaultTableSpanGrid(current.rows, nextColumns)
          : current.cellSpans.map((row) =>
              row.filter((_, index) => index !== removeIndex),
            ),
        columnAlignments: current.columnAlignments.filter(
          (_, index) => index !== removeIndex,
        ),
        columnWeights: (current.columnWeights ?? []).filter(
          (_, index) => index !== removeIndex,
        ),
      };
    });
    focusTableCell(activeCell.row, nextColumn);
  };

  const importDelimitedTable = () => {
    const parsed = parseDelimitedTableText(tableImportText);
    if (parsed.length === 0) {
      setTableImportSummary("Paste CSV or spreadsheet data first.");
      return;
    }

    const nextRows = Math.min(50, parsed.length);
    const nextColumns = Math.min(
      20,
      Math.max(1, ...parsed.slice(0, nextRows).map((row) => row.length)),
    );
    const cells = Array.from({ length: nextRows }, (_, rowIndex) =>
      Array.from(
        { length: nextColumns },
        (_, columnIndex) => parsed[rowIndex]?.[columnIndex] ?? "",
      ),
    );

    setRequest((current) => ({
      ...current,
      rows: nextRows,
      columns: nextColumns,
      cells,
      cellStyles: Array.from({ length: nextRows }, () =>
        createDefaultTableStyleRow(nextColumns),
      ),
      cellSpans: createDefaultTableSpanGrid(nextRows, nextColumns),
      columnAlignments: Array.from(
        { length: nextColumns },
        (_, index) => current.columnAlignments[index] ?? "c",
      ),
      columnWeights: Array.from({ length: nextColumns }, () => ""),
    }));
    focusTableCell(0, 0);
    setTableImportSummary(`Imported ${nextRows}×${nextColumns} cells.`);
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    setRequest((current) => ({
      ...current,
      cells: current.cells.map((row, currentRow) =>
        currentRow === rowIndex
          ? row.map((cell, currentColumn) =>
              currentColumn === columnIndex ? value : cell,
            )
          : row,
      ),
    }));
  };

  const updateAlignment = (columnIndex: number, value: string | null) => {
    const nextValue = value || "c";
    setRequest((current) => ({
      ...current,
      columnAlignments: current.columnAlignments.map((alignment, index) =>
        index === columnIndex ? nextValue : alignment,
      ),
      columnWeights: Array.from(
        { length: current.columns },
        (_, index) =>
          index === columnIndex && nextValue !== "X" && nextValue !== "Q"
            ? ""
            : current.columnWeights?.[index] ?? "",
      ),
    }));
  };

  const updateColumnWeight = (columnIndex: number, value: string) => {
    setRequest((current) => ({
      ...current,
      columnWeights: Array.from(
        { length: current.columns },
        (_, index) =>
          index === columnIndex ? value : current.columnWeights?.[index] ?? "",
      ),
    }));
  };

  const updateActiveCellStyle = (
    updater: (current: TableCellStyle) => TableCellStyle,
  ) => {
    setRequest((current) => ({
      ...current,
      cellStyles: current.cellStyles.map((row, rowIndex) =>
        row.map((style, columnIndex) => {
          const selected =
            rowIndex >= selectionRange.minRow &&
            rowIndex <= selectionRange.maxRow &&
            columnIndex >= selectionRange.minColumn &&
            columnIndex <= selectionRange.maxColumn;
          const hidden = current.cellSpans[rowIndex]?.[columnIndex]?.hidden;
          return selected && !hidden ? updater(style) : style;
        }),
      ),
    }));
  };

  const updateTableStyles = (
    target: "selection" | "row" | "column",
    updater: (current: TableCellStyle) => TableCellStyle,
  ) => {
    setRequest((current) => ({
      ...current,
      cellStyles: current.cellStyles.map((row, rowIndex) =>
        row.map((style, columnIndex) => {
          const selected =
            rowIndex >= selectionRange.minRow &&
            rowIndex <= selectionRange.maxRow &&
            columnIndex >= selectionRange.minColumn &&
            columnIndex <= selectionRange.maxColumn;
          const matches =
            target === "selection"
              ? selected
              : target === "row"
                ? rowIndex === activeCell.row
                : columnIndex === activeCell.column;
          const hidden = current.cellSpans[rowIndex]?.[columnIndex]?.hidden;
          return matches && !hidden ? updater(style) : style;
        }),
      ),
    }));
  };

  const applyTableColor = (
    target: "selection" | "row" | "column",
    colorKey: "backgroundColor" | "textColor",
  ) => {
    updateTableStyles(target, (style) => ({
      ...style,
      [colorKey]: tableColor,
    }));
  };

  const clearSelectedTableStyles = () => {
    updateTableStyles("selection", createDefaultTableCellStyle);
  };

  const beginCellSelection = (
    row: number,
    column: number,
    extendSelection: boolean,
  ) => {
    setActiveCell({ row, column });
    setIsSelectingCells(true);
    setSelection((current) =>
      extendSelection
        ? { ...current, endRow: row, endColumn: column }
        : {
            startRow: row,
            startColumn: column,
            endRow: row,
            endColumn: column,
          },
    );
  };

  const extendCellSelection = (row: number, column: number) => {
    if (!isSelectingCells) return;
    setSelection((current) => ({ ...current, endRow: row, endColumn: column }));
  };

  const endCellSelection = () => {
    setIsSelectingCells(false);
  };

  const selectionRange = {
    minRow: Math.min(selection.startRow, selection.endRow),
    maxRow: Math.max(selection.startRow, selection.endRow),
    minColumn: Math.min(selection.startColumn, selection.endColumn),
    maxColumn: Math.max(selection.startColumn, selection.endColumn),
  };
  const selectedRowSpan = selectionRange.maxRow - selectionRange.minRow + 1;
  const selectedColSpan =
    selectionRange.maxColumn - selectionRange.minColumn + 1;
  const hasSelectionRange = selectedRowSpan > 1 || selectedColSpan > 1;

  const mergeSelection = () => {
    if (!hasSelectionRange) return;
    setRequest((current) => ({
      ...current,
      cellSpans: current.cellSpans.map((row, rowIndex) =>
        row.map((span, columnIndex) => {
          const inRange =
            rowIndex >= selectionRange.minRow &&
            rowIndex <= selectionRange.maxRow &&
            columnIndex >= selectionRange.minColumn &&
            columnIndex <= selectionRange.maxColumn;
          if (!inRange) return span;
          if (
            rowIndex === selectionRange.minRow &&
            columnIndex === selectionRange.minColumn
          ) {
            return {
              rowSpan: selectedRowSpan,
              colSpan: selectedColSpan,
              hidden: false,
            };
          }
          return { rowSpan: 1, colSpan: 1, hidden: true };
        }),
      ),
    }));
    setActiveCell({
      row: selectionRange.minRow,
      column: selectionRange.minColumn,
    });
    setSelection({
      startRow: selectionRange.minRow,
      startColumn: selectionRange.minColumn,
      endRow: selectionRange.minRow,
      endColumn: selectionRange.minColumn,
    });
  };

  const splitActiveCell = () => {
    const master = findTableSpanMaster(request, activeCell.row, activeCell.column);
    if (!master) return;
    const masterSpan = request.cellSpans[master.row]?.[master.column];
    if (!masterSpan) return;
    setRequest((current) => ({
      ...current,
      cellSpans: current.cellSpans.map((row, rowIndex) =>
        row.map((span, columnIndex) => {
          const inRange =
            rowIndex >= master.row &&
            rowIndex < master.row + masterSpan.rowSpan &&
            columnIndex >= master.column &&
            columnIndex < master.column + masterSpan.colSpan;
          return inRange
            ? { rowSpan: 1, colSpan: 1, hidden: false }
            : span;
        }),
      ),
    }));
  };

  const updateBoolean =
    (key: keyof Pick<
      TableBuilderRequest,
      "hlines" | "vlines" | "useTableEnvironment" | "center" | "longTable"
    >) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = inputChecked(event);
      setRequest((current) => ({ ...current, [key]: checked }));
    };

  const alignmentOptions =
    request.mode === "tabularray"
      ? ["l", "c", "r", "X", "Q"]
      : ["l", "c", "r"];
  const activeCellStyle =
    request.cellStyles[activeCell.row]?.[activeCell.column] ??
    createDefaultTableCellStyle();
  const activeCellSpan =
    request.cellSpans[activeCell.row]?.[activeCell.column] ?? {
      rowSpan: 1,
      colSpan: 1,
      hidden: false,
    };
  const activeColumnAlignment =
    request.columnAlignments[activeCell.column] ?? "c";
  const activeColumnWeight = request.columnWeights?.[activeCell.column] ?? "";
  const canUseColumnWeight =
    request.mode === "tabularray" &&
    (activeColumnAlignment === "X" || activeColumnAlignment === "Q");

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      onMouseUp={endCellSelection}
      onMouseLeave={endCellSelection}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="cyan">
                <FontAwesomeIcon icon={faTable} />
              </ThemeIcon>
              <Text fw={700}>
                {t("packageStudio.tables.title", {
                  defaultValue: "Table Workbench",
                })}
              </Text>
              {loading && <Loader size="xs" />}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {t("packageStudio.tables.description", {
                defaultValue:
                  "Create standard, booktabs, and tabularray table snippets with package requirements.",
              })}
            </Text>
          </Box>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => setRequest(DEFAULT_TABLE_REQUEST)}
          >
            {t("packageStudio.reset", { defaultValue: "Reset" })}
          </Button>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {output?.warnings.map((warning, index) => (
          <Alert
            key={`${warning.code}-${index}`}
            color={warning.severity === "error" ? "red" : "orange"}
            variant="light"
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          >
            <Text size="sm" fw={700}>
              {warning.code}
            </Text>
            <Text size="xs">{warning.message}</Text>
          </Alert>
        ))}

        <BuilderActivationBar
          builderId="tables"
          managedPackageIds={["tabularray", "booktabs"]}
          output={output}
          generatedBlocks={[]}
          activeFilePath={activeFilePath}
          analysis={analysis}
          loading={loading}
          onApply={onApplyBuilderConfiguration}
        />

        <Group align="stretch" gap="md">
          <Box style={{ flex: 1.2, minWidth: 480 }}>
            <Stack gap="md">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Paper withBorder p="xs" radius="sm">
                    <Stack gap={6}>
                      <Group gap="xs" align="center" wrap="wrap">
                        <Text size="sm" fw={700} mr="xs">
                          {t("packageStudio.tables.grid", {
                            defaultValue: "Table",
                          })}
                        </Text>
                        <Select
                          size="xs"
                          aria-label="Table mode"
                          data={TABLE_MODES}
                          value={request.mode}
                          allowDeselect={false}
                          onChange={(value) =>
                            setRequest((current) => ({
                              ...current,
                              mode: value || "booktabs",
                              vlines:
                                value === "booktabs" ? false : current.vlines,
                              columnAlignments: current.columnAlignments.map(
                                (alignment) =>
                                  value === "tabularray"
                                    ? alignment
                                    : alignment === "X" || alignment === "Q"
                                      ? "c"
                                      : alignment,
                              ),
                            }))
                          }
                          w={220}
                        />
                        <NumberInput
                          size="xs"
                          aria-label="Rows"
                          min={1}
                          max={50}
                          value={request.rows}
                          onChange={(value) =>
                            resizeGrid(Number(value) || 1, request.columns)
                          }
                          w={76}
                          prefix="R "
                        />
                        <NumberInput
                          size="xs"
                          aria-label="Columns"
                          min={1}
                          max={20}
                          value={request.columns}
                          onChange={(value) =>
                            resizeGrid(request.rows, Number(value) || 1)
                          }
                          w={76}
                          prefix="C "
                        />
                        <ActionIcon
                          size="sm"
                          variant="light"
                          color="cyan"
                          disabled={request.rows >= 50}
                          onClick={insertTableRow}
                          aria-label="Insert row below active cell"
                        >
                          <FontAwesomeIcon icon={faPlus} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="light"
                          color="cyan"
                          disabled={request.columns >= 20}
                          onClick={insertTableColumn}
                          aria-label="Insert column after active cell"
                        >
                          <FontAwesomeIcon icon={faPlus} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="light"
                          color="red"
                          disabled={request.rows <= 1}
                          onClick={removeActiveTableRow}
                          aria-label="Remove active row"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="light"
                          color="red"
                          disabled={request.columns <= 1}
                          onClick={removeActiveTableColumn}
                          aria-label="Remove active column"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </ActionIcon>
                        <Switch
                          size="sm"
                          label={t("packageStudio.tables.hlines", {
                            defaultValue: "H rules",
                          })}
                          checked={request.hlines}
                          onChange={updateBoolean("hlines")}
                        />
                        <Switch
                          size="sm"
                          label={t("packageStudio.tables.vlines", {
                            defaultValue: "V rules",
                          })}
                          checked={request.vlines}
                          disabled={request.mode === "booktabs"}
                          onChange={updateBoolean("vlines")}
                        />
                        {request.mode === "tabularray" && (
                          <Switch
                            size="sm"
                            label={t("packageStudio.tables.longTable", {
                              defaultValue: "Long",
                            })}
                            checked={request.longTable}
                            onChange={updateBoolean("longTable")}
                          />
                        )}
                        <Switch
                          size="sm"
                          label={t("packageStudio.tables.float", {
                            defaultValue: "Float",
                          })}
                          checked={request.useTableEnvironment}
                          onChange={updateBoolean("useTableEnvironment")}
                        />
                        <Switch
                          size="sm"
                          label={t("packageStudio.tables.center", {
                            defaultValue: "Center",
                          })}
                          checked={request.center}
                          onChange={updateBoolean("center")}
                        />
                        <Select
                          size="xs"
                          aria-label="Table placement"
                          data={TABLE_PLACEMENTS}
                          value={request.placement}
                          onChange={(value) =>
                            setRequest((current) => ({
                              ...current,
                              placement: value || "ht",
                            }))
                          }
                          w={120}
                        />
                      </Group>
                      <Group gap="xs" align="center" wrap="wrap">
                        <Badge size="xs" variant="light" color="cyan">
                          R{activeCell.row + 1} · C{activeCell.column + 1}
                        </Badge>
                        {activeCellSpan.rowSpan > 1 || activeCellSpan.colSpan > 1 ? (
                          <Badge size="xs" variant="outline" color="cyan">
                            {activeCellSpan.rowSpan}×{activeCellSpan.colSpan}
                          </Badge>
                        ) : null}
                        <Select
                          size="xs"
                          aria-label="Active column alignment"
                          data={alignmentOptions}
                          value={activeColumnAlignment}
                          allowDeselect={false}
                          onChange={(value) =>
                            updateAlignment(activeCell.column, value)
                          }
                          w={105}
                          leftSection={<Text size="xs">Col</Text>}
                        />
                        {canUseColumnWeight && (
                          <TextInput
                            size="xs"
                            aria-label="Active tabularray column weight"
                            placeholder="2 or 1.5cm"
                            value={activeColumnWeight}
                            onChange={(event) =>
                              updateColumnWeight(
                                activeCell.column,
                                inputValue(event),
                              )
                            }
                            w={116}
                            leftSection={<Text size="xs">X/Q</Text>}
                          />
                        )}
                        <ActionIcon
                          size="sm"
                          variant={activeCellStyle.bold ? "filled" : "light"}
                          color="cyan"
                          onClick={() =>
                            updateActiveCellStyle((style) => ({
                              ...style,
                              bold: !activeCellStyle.bold,
                            }))
                          }
                          aria-label="Toggle bold for selected table cells"
                        >
                          <FontAwesomeIcon icon={faBold} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant={activeCellStyle.italic ? "filled" : "light"}
                          color="cyan"
                          onClick={() =>
                            updateActiveCellStyle((style) => ({
                              ...style,
                              italic: !activeCellStyle.italic,
                            }))
                          }
                          aria-label="Toggle italic for selected table cells"
                        >
                          <FontAwesomeIcon icon={faItalic} />
                        </ActionIcon>
                        <Select
                          size="xs"
                          aria-label="Selected cell alignment"
                          data={[
                            { value: AUTO_OPTION_VALUE, label: "Cell auto" },
                            { value: "l", label: "Left" },
                            { value: "c", label: "Center" },
                            { value: "r", label: "Right" },
                          ]}
                          value={activeCellStyle.alignment || AUTO_OPTION_VALUE}
                          allowDeselect={false}
                          onChange={(value) =>
                            updateActiveCellStyle((style) => ({
                              ...style,
                              alignment:
                                value === AUTO_OPTION_VALUE ? "" : value || "",
                            }))
                          }
                          w={140}
                        />
                        {request.mode === "tabularray" && (
                          <Select
                            size="xs"
                            aria-label="Selected cell vertical alignment"
                            data={[
                              { value: AUTO_OPTION_VALUE, label: "V auto" },
                              { value: "t", label: "Top" },
                              { value: "m", label: "Middle" },
                              { value: "b", label: "Bottom" },
                            ]}
                            value={
                              activeCellStyle.verticalAlignment ||
                              AUTO_OPTION_VALUE
                            }
                            allowDeselect={false}
                            onChange={(value) =>
                              updateActiveCellStyle((style) => ({
                                ...style,
                                verticalAlignment:
                                  value === AUTO_OPTION_VALUE
                                    ? ""
                                    : value || "",
                              }))
                            }
                            w={118}
                          />
                        )}
                        <ColorInput
                          size="xs"
                          aria-label="Table color"
                          value={tableColor}
                          onChange={setTableColor}
                          w={116}
                          leftSection={<FontAwesomeIcon icon={faFillDrip} />}
                        />
                        <Button
                          size="xs"
                          variant="light"
                          color="cyan"
                          onClick={() =>
                            applyTableColor("selection", "backgroundColor")
                          }
                        >
                          BG cells
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="cyan"
                          onClick={() =>
                            applyTableColor("selection", "textColor")
                          }
                        >
                          Text
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="cyan"
                          onClick={() =>
                            applyTableColor("row", "backgroundColor")
                          }
                        >
                          BG row
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="cyan"
                          onClick={() =>
                            applyTableColor("column", "backgroundColor")
                          }
                        >
                          BG col
                        </Button>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="gray"
                          onClick={clearSelectedTableStyles}
                          aria-label="Clear selected table cell styles"
                        >
                          <FontAwesomeIcon icon={faEraser} />
                        </ActionIcon>
                        <Button
                          size="xs"
                          variant="light"
                          color="cyan"
                          disabled={!hasSelectionRange}
                          onClick={mergeSelection}
                        >
                          {t("packageStudio.tables.merge", {
                            defaultValue: "Merge",
                          })}
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="gray"
                          disabled={
                            activeCellSpan.rowSpan <= 1 &&
                            activeCellSpan.colSpan <= 1
                          }
                          onClick={splitActiveCell}
                        >
                          {t("packageStudio.tables.split", {
                            defaultValue: "Split",
                          })}
                        </Button>
                        <Text size="xs" c="dimmed">
                          {t("packageStudio.tables.cellStyleHint", {
                            defaultValue:
                              "Drag across cells, then format or merge.",
                          })}
                        </Text>
                      </Group>
                    </Stack>
                  </Paper>
                  <Box style={{ overflowX: "auto", paddingBottom: 4 }}>
                    <Box
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${request.columns}, minmax(120px, 1fr))`,
                        gap: 6,
                        minWidth: request.columns * 126,
                      }}
                    >
                      {request.cells.flatMap((row, rowIndex) =>
                        row.map((cell, columnIndex) => {
                          const span =
                            request.cellSpans[rowIndex]?.[columnIndex] ?? {
                              rowSpan: 1,
                              colSpan: 1,
                              hidden: false,
                            };
                          if (span.hidden) return null;
                          const selected =
                            rowIndex >= selectionRange.minRow &&
                            rowIndex <= selectionRange.maxRow &&
                            columnIndex >= selectionRange.minColumn &&
                            columnIndex <= selectionRange.maxColumn;
                          return (
                            <Box
                              key={`${rowIndex}-${columnIndex}`}
                              style={{
                                gridColumn: `span ${span.colSpan}`,
                                gridRow: `span ${span.rowSpan}`,
                              }}
                              onMouseDown={(event) =>
                                beginCellSelection(
                                  rowIndex,
                                  columnIndex,
                                  event.shiftKey,
                                )
                              }
                              onMouseEnter={() =>
                                extendCellSelection(rowIndex, columnIndex)
                              }
                            >
                              <TextInput
                                size="xs"
                                aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                                value={cell}
                                onFocus={() =>
                                  setActiveCell({
                                    row: rowIndex,
                                    column: columnIndex,
                                  })
                                }
                                onChange={(event) =>
                                  updateCell(
                                    rowIndex,
                                    columnIndex,
                                    inputValue(event),
                                  )
                                }
                                styles={{
                                  input: {
                                    height: span.rowSpan > 1 ? "100%" : undefined,
                                    minHeight: span.rowSpan > 1 ? 36 * span.rowSpan : undefined,
                                    borderColor:
                                      activeCell.row === rowIndex &&
                                      activeCell.column === columnIndex
                                        ? "var(--mantine-color-cyan-5)"
                                        : selected
                                          ? "var(--mantine-color-cyan-7)"
                                          : undefined,
                                    backgroundColor: selected
                                      ? "color-mix(in srgb, var(--mantine-color-cyan-9), transparent 82%)"
                                      : request.cellStyles[rowIndex]?.[
                                          columnIndex
                                        ]?.backgroundColor || undefined,
                                    color:
                                      request.cellStyles[rowIndex]?.[columnIndex]
                                        ?.textColor || undefined,
                                    fontWeight:
                                      request.cellStyles[rowIndex]?.[columnIndex]
                                        ?.bold || rowIndex === 0
                                        ? 700
                                        : 400,
                                    fontStyle: request.cellStyles[rowIndex]?.[
                                      columnIndex
                                    ]?.italic
                                      ? "italic"
                                      : undefined,
                                    textAlign: tableCssAlign(
                                      request.cellStyles[rowIndex]?.[columnIndex]
                                        ?.alignment ||
                                        request.columnAlignments[columnIndex],
                                    ),
                                  },
                                }}
                              />
                            </Box>
                          );
                        }),
                      )}
                    </Box>
                  </Box>
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="sm" fw={700}>
                        Paste spreadsheet data
                      </Text>
                      <Text size="xs" c="dimmed">
                        CSV, semicolon CSV, or tab-separated cells from
                        LibreOffice/Excel.
                      </Text>
                    </div>
                    <Badge size="xs" variant="light" color="cyan">
                      CSV · TSV
                    </Badge>
                  </Group>
                  <Textarea
                    size="xs"
                    aria-label="Paste CSV or spreadsheet data"
                    placeholder={"Name\tValue\tNote\nA\t1\tFirst row"}
                    value={tableImportText}
                    onChange={(event) => {
                      setTableImportText(inputValue(event));
                      setTableImportSummary("");
                    }}
                    autosize
                    minRows={3}
                    maxRows={6}
                    styles={{
                      input: {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      },
                    }}
                  />
                  <Group justify="space-between" gap="xs" wrap="wrap">
                    <Text size="xs" c="dimmed">
                      {tableImportSummary ||
                        "Import replaces the grid and resets cell styling/spans."}
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      color="cyan"
                      leftSection={<FontAwesomeIcon icon={faFileImport} />}
                      disabled={!tableImportText.trim()}
                      onClick={importDelimitedTable}
                    >
                      Import grid
                    </Button>
                  </Group>
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                    <TextInput
                      size="xs"
                      label={t("packageStudio.tables.caption", {
                        defaultValue: "Caption",
                      })}
                      value={request.caption}
                      onChange={(event) =>
                        setRequest((current) => ({
                          ...current,
                          caption: inputValue(event),
                        }))
                      }
                    />
                    <TextInput
                      size="xs"
                      label={t("packageStudio.tables.label", {
                        defaultValue: "Label",
                      })}
                      value={request.label}
                      onChange={(event) =>
                        setRequest((current) => ({
                          ...current,
                          label: inputValue(event),
                        }))
                      }
                    />
                  </SimpleGrid>
                </Stack>
              </Paper>
            </Stack>
          </Box>

          <Box style={{ width: 410, minWidth: 340 }}>
            <Stack gap="md">
              <TablePreview request={request} />
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.tables.generatedSnippet", {
                        defaultValue: "Generated table snippet",
                      })}
                    </Text>
                    <Badge size="xs" variant="light" color="cyan">
                      Rust
                    </Badge>
                  </Group>
                  <Textarea
                    readOnly
                    autosize
                    minRows={12}
                    maxRows={18}
                    value={output?.code || ""}
                    styles={{
                      input: {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      },
                    }}
                  />
                  <Group justify="space-between">
                    <Group gap={6}>
                      {output?.requirements.map((requirement) => (
                        <Badge
                          key={requirement.packageId}
                          size="xs"
                          variant="outline"
                          color="gray"
                        >
                          {requirement.packageId}
                        </Badge>
                      ))}
                    </Group>
                    <Button
                      size="xs"
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                      disabled={!output?.code.trim()}
                      onClick={() => output?.code && onInsertCode(output.code)}
                    >
                      {t("packageStudio.insertAtCursor", {
                        defaultValue: "Insert at cursor",
                      })}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
};

const MathBuilderPanel: React.FC<{
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  onInsertCode: (code: string) => void;
  onReviewEditPlan?: (
    plan: PackageEditPlan,
    source: string,
    targetFilePath: string,
  ) => void;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  activeFilePath,
  activeFileContent,
  analysis,
  onInsertCode,
  onReviewEditPlan,
  onApplyBuilderConfiguration,
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<MathBuilderRequest>(
    DEFAULT_MATH_REQUEST,
  );
  const [output, setOutput] = useState<BuilderOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mathImports, setMathImports] = useState<MathImportedSnippet[]>([]);
  const [selectedMathImportId, setSelectedMathImportId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!activeFilePath || !activeFileContent) {
      setMathImports([]);
      setSelectedMathImportId(null);
      return;
    }
    let mounted = true;
    void listMathImports(activeFileContent)
      .then((imports) => {
        if (!mounted) return;
        setMathImports(imports);
        const firstImport = imports[0];
        setSelectedMathImportId(firstImport?.id ?? null);
        setRequest((current) =>
          firstImport
            ? {
                ...current,
                ...firstImport.request,
              }
            : {
                ...current,
                importedSourceRange: null,
              },
        );
      })
      .catch((caught) => {
        console.error("Failed to import math setup:", caught);
        if (mounted) {
          setMathImports([]);
          setSelectedMathImportId(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, [activeFilePath, activeFileContent]);

  useEffect(() => {
    let mounted = true;
    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void generateMath(request)
        .then((generated) => {
          if (mounted) setOutput(generated);
        })
        .catch((caught) => {
          if (!mounted) return;
          console.error("Failed to generate math snippet:", caught);
          setError(String(caught));
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 90);
    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  const updateText =
    (key: keyof MathBuilderRequest) =>
    (value: string | null) => {
      setRequest((current) => ({ ...current, [key]: value || "" }));
    };

  const canReplaceImportedSnippet = Boolean(
    activeFilePath &&
      activeFileContent &&
      request.importedSourceRange &&
      output?.code.trim() &&
      onReviewEditPlan,
  );

  const reviewImportedSnippetReplacement = () => {
    if (
      !activeFilePath ||
      !activeFileContent ||
      !request.importedSourceRange ||
      !output?.code ||
      !onReviewEditPlan
    ) {
      return;
    }

    const start = utf8ByteOffsetToStringIndex(
      activeFileContent,
      request.importedSourceRange.start.byte,
    );
    const end = utf8ByteOffsetToStringIndex(
      activeFileContent,
      request.importedSourceRange.end.byte,
    );
    const importedSource = activeFileContent.slice(start, end);
    const plan: PackageEditPlan = {
      schemaVersion: 1,
      revision: analysis?.revision ?? Date.now(),
      title: "Replace imported math snippet",
      summary:
        importedSource === output.code
          ? "The imported math snippet already matches the generated output."
          : "Replace the imported math snippet with the generated Math builder output.",
      edits:
        importedSource === output.code
          ? []
          : [
              {
                range: request.importedSourceRange,
                replacement: output.code,
              },
            ],
      diagnostics: [],
    };
    onReviewEditPlan(plan, activeFileContent, activeFilePath);
  };

  const resizeMatrix = (rows: number, columns: number) => {
    const nextRows = Math.max(1, Math.min(12, rows));
    const nextColumns = Math.max(1, Math.min(12, columns));
    setRequest((current) => ({
      ...current,
      matrixRows: nextRows,
      matrixColumns: nextColumns,
      matrixCells: Array.from({ length: nextRows }, (_, rowIndex) =>
        Array.from(
          { length: nextColumns },
          (_, columnIndex) =>
            current.matrixCells[rowIndex]?.[columnIndex] ||
            String.fromCharCode(97 + ((rowIndex * nextColumns + columnIndex) % 26)),
        ),
      ),
    }));
  };

  const updateMatrixCell = (
    rowIndex: number,
    columnIndex: number,
    value: string,
  ) => {
    setRequest((current) => ({
      ...current,
      matrixCells: current.matrixCells.map((row, currentRow) =>
        currentRow === rowIndex
          ? row.map((cell, currentColumn) =>
              currentColumn === columnIndex ? value : cell,
            )
          : row,
      ),
    }));
  };

  const selectedMathImport = mathImports.find(
    (snippet) => snippet.id === selectedMathImportId,
  );
  const activeMode = MATH_MODES.find((mode) => mode.value === request.mode);
  const activeRequirementSummary =
    output?.requirements.map((requirement) => requirement.packageId).join(", ") ||
    (request.mode === "delimited" ? "No package needed" : "Pending");

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="teal">
                <FontAwesomeIcon icon={faSquareRootAlt} />
              </ThemeIcon>
              <Text fw={700}>AMS Math Tools</Text>
              {loading && <Loader size="xs" />}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Build, preview, import, and replace math snippets without leaving
              the editor workflow.
            </Text>
          </Box>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => {
              setSelectedMathImportId(null);
              setRequest(DEFAULT_MATH_REQUEST);
            }}
          >
            New snippet
          </Button>
        </Group>

        <Paper withBorder p="xs" radius="md">
          <Group gap="xs" justify="space-between" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Badge size="sm" variant="light" color="teal">
                {activeMode?.label || request.mode}
              </Badge>
              <Badge size="sm" variant="outline" color="gray">
                {activeRequirementSummary}
              </Badge>
              {selectedMathImport ? (
                <Badge size="sm" variant="light" color="blue">
                  Imported · L{selectedMathImport.line}
                </Badge>
              ) : (
                <Badge size="sm" variant="light" color="gray">
                  Draft
                </Badge>
              )}
            </Group>
            <Text size="xs" c="dimmed">
              {request.importedSourceRange
                ? "Edit the imported snippet, then review replacement."
                : "Create a new snippet and insert it at the cursor."}
            </Text>
          </Group>
        </Paper>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {output?.warnings.map((warning, index) => (
          <Alert
            key={`${warning.code}-${index}`}
            color={warning.severity === "error" ? "red" : "orange"}
            variant="light"
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          >
            <Text size="sm" fw={700}>
              {warning.code}
            </Text>
            <Text size="xs">{warning.message}</Text>
          </Alert>
        ))}

        <BuilderActivationBar
          builderId="math"
          managedPackageIds={["amsmath", "mathtools"]}
          output={output}
          generatedBlocks={[]}
          activeFilePath={activeFilePath}
          analysis={analysis}
          loading={loading}
          onApply={onApplyBuilderConfiguration}
        />

        <Group align="stretch" gap="md">
          <Box style={{ flex: 1, minWidth: 440 }}>
            <Stack gap="md">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs">
                    <Box>
                      <Text size="sm" fw={700}>
                        Builder controls
                      </Text>
                      <Text size="xs" c="dimmed">
                        Choose a math surface, then edit only the fields that
                        affect that snippet.
                      </Text>
                    </Box>
                    <Badge size="xs" variant="dot" color="teal">
                      {request.mode}
                    </Badge>
                  </Group>
                  <Select
                    size="xs"
                    label="Builder mode"
                    data={MATH_MODES}
                    value={request.mode}
                    allowDeselect={false}
                    onChange={updateText("mode")}
                  />

                  {request.mode === "environment" && (
                    <Stack gap="sm">
                      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                        <Select
                          size="xs"
                          label="Environment"
                          data={MATH_ENVIRONMENTS}
                          value={request.environmentType}
                          searchable
                          allowDeselect={false}
                          onChange={updateText("environmentType")}
                        />
                        <TextInput
                          size="xs"
                          label="Label"
                          disabled={request.starred}
                          value={request.label}
                          onChange={(event) =>
                            setRequest((current) => ({
                              ...current,
                              label: inputValue(event),
                            }))
                          }
                        />
                        <Switch
                          size="sm"
                          label="Starred / unnumbered"
                          checked={request.starred}
                          onChange={(event) =>
                            setRequest((current) => ({
                              ...current,
                              starred: inputChecked(event),
                            }))
                          }
                        />
                      </SimpleGrid>
                      <Textarea
                        size="xs"
                        label="Environment content"
                        value={request.content}
                        minRows={4}
                        onChange={(event) =>
                          setRequest((current) => ({
                            ...current,
                            content: inputValue(event),
                          }))
                        }
                      />
                    </Stack>
                  )}

                  {request.mode === "matrix" && (
                    <Stack gap="sm">
                      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="xs">
                        <Select
                          size="xs"
                          label="Matrix"
                          data={MATH_MATRIX_TYPES}
                          value={request.matrixType}
                          allowDeselect={false}
                          onChange={updateText("matrixType")}
                        />
                        <NumberInput
                          size="xs"
                          label="Rows"
                          min={1}
                          max={12}
                          value={request.matrixRows}
                          onChange={(value) =>
                            resizeMatrix(Number(value) || 1, request.matrixColumns)
                          }
                        />
                        <NumberInput
                          size="xs"
                          label="Columns"
                          min={1}
                          max={12}
                          value={request.matrixColumns}
                          onChange={(value) =>
                            resizeMatrix(request.matrixRows, Number(value) || 1)
                          }
                        />
                        <Switch
                          size="sm"
                          label="Starred matrix"
                          checked={request.matrixStarred}
                          onChange={(event) =>
                            setRequest((current) => ({
                              ...current,
                              matrixStarred: inputChecked(event),
                            }))
                          }
                        />
                      </SimpleGrid>
                      {request.matrixStarred && (
                        <Select
                          size="xs"
                          label="Column alignment"
                          data={[
                            { value: "l", label: "Left" },
                            { value: "c", label: "Center" },
                            { value: "r", label: "Right" },
                          ]}
                          value={request.matrixAlignment}
                          allowDeselect={false}
                          onChange={updateText("matrixAlignment")}
                        />
                      )}
                      <Box
                        style={{
                          display: "grid",
                          gridTemplateColumns: `repeat(${request.matrixColumns}, minmax(72px, 1fr))`,
                          gap: 6,
                        }}
                      >
                        {request.matrixCells.map((row, rowIndex) =>
                          row.map((cell, columnIndex) => (
                            <TextInput
                              key={`${rowIndex}-${columnIndex}`}
                              size="xs"
                              value={cell}
                              aria-label={`Matrix cell ${rowIndex + 1}, ${columnIndex + 1}`}
                              onChange={(event) =>
                                updateMatrixCell(
                                  rowIndex,
                                  columnIndex,
                                  inputValue(event),
                                )
                              }
                            />
                          )),
                        )}
                      </Box>
                    </Stack>
                  )}

                  {request.mode === "tool" && (
                    <Stack gap="sm">
                      <Select
                        size="xs"
                        label="Mathtools snippet"
                        data={MATHTOOLS_TOOL_TYPES}
                        value={request.toolType}
                        allowDeselect={false}
                        onChange={updateText("toolType")}
                      />
                      {request.toolType === "arrow" && (
                        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                          <Select
                            size="xs"
                            label="Arrow"
                            data={MATHTOOLS_ARROWS}
                            value={request.arrowType}
                            searchable
                            allowDeselect={false}
                            onChange={updateText("arrowType")}
                          />
                          <TextInput
                            size="xs"
                            label="Above"
                            value={request.arrowAbove}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                arrowAbove: inputValue(event),
                              }))
                            }
                          />
                          <TextInput
                            size="xs"
                            label="Below"
                            value={request.arrowBelow}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                arrowBelow: inputValue(event),
                              }))
                            }
                          />
                        </SimpleGrid>
                      )}
                      {request.toolType === "bracket" && (
                        <Stack gap="xs">
                          <Select
                            size="xs"
                            label="Bracket"
                            data={MATHTOOLS_BRACKETS}
                            value={request.bracketType}
                            allowDeselect={false}
                            onChange={updateText("bracketType")}
                          />
                          <TextInput
                            size="xs"
                            label="Content"
                            value={request.bracketContent}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                bracketContent: inputValue(event),
                              }))
                            }
                          />
                          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                            <TextInput
                              size="xs"
                              label="Thickness"
                              value={request.bracketThickness}
                              onChange={(event) =>
                                setRequest((current) => ({
                                  ...current,
                                  bracketThickness: inputValue(event),
                                }))
                              }
                            />
                            <TextInput
                              size="xs"
                              label="Height"
                              value={request.bracketHeight}
                              onChange={(event) =>
                                setRequest((current) => ({
                                  ...current,
                                  bracketHeight: inputValue(event),
                                }))
                              }
                            />
                          </SimpleGrid>
                        </Stack>
                      )}
                      {request.toolType === "split_fraction" && (
                        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                          <Select
                            size="xs"
                            label="Type"
                            data={[
                              { value: "splitfrac", label: "\\splitfrac" },
                              { value: "splitdfrac", label: "\\splitdfrac" },
                            ]}
                            value={request.splitFractionType}
                            allowDeselect={false}
                            onChange={updateText("splitFractionType")}
                          />
                          <TextInput
                            size="xs"
                            label="Top"
                            value={request.splitFractionTop}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                splitFractionTop: inputValue(event),
                              }))
                            }
                          />
                          <TextInput
                            size="xs"
                            label="Bottom"
                            value={request.splitFractionBottom}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                splitFractionBottom: inputValue(event),
                              }))
                            }
                          />
                        </SimpleGrid>
                      )}
                      {request.toolType === "prescript" && (
                        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                          <TextInput
                            size="xs"
                            label="Sup"
                            value={request.prescriptSup}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                prescriptSup: inputValue(event),
                              }))
                            }
                          />
                          <TextInput
                            size="xs"
                            label="Sub"
                            value={request.prescriptSub}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                prescriptSub: inputValue(event),
                              }))
                            }
                          />
                          <TextInput
                            size="xs"
                            label="Argument"
                            value={request.prescriptArg}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                prescriptArg: inputValue(event),
                              }))
                            }
                          />
                        </SimpleGrid>
                      )}
                      {request.toolType === "delimiter" && (
                        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                          <TextInput
                            size="xs"
                            label="Command"
                            value={request.delimiterCommand}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                delimiterCommand: inputValue(event),
                              }))
                            }
                          />
                          <TextInput
                            size="xs"
                            label="Left"
                            value={request.delimiterLeft}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                delimiterLeft: inputValue(event),
                              }))
                            }
                          />
                          <TextInput
                            size="xs"
                            label="Right"
                            value={request.delimiterRight}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                delimiterRight: inputValue(event),
                              }))
                            }
                          />
                        </SimpleGrid>
                      )}
                    </Stack>
                  )}

                  {request.mode === "tag" && (
                    <Stack gap="sm">
                      <Select
                        size="xs"
                        label="Tag action"
                        data={MATHTOOLS_TAG_ACTIONS}
                        value={request.tagAction}
                        allowDeselect={false}
                        onChange={updateText("tagAction")}
                      />
                      {(request.tagAction === "newtagform" ||
                        request.tagAction === "usetagform") && (
                        <TextInput
                          size="xs"
                          label="Tag form name"
                          value={request.tagName}
                          onChange={(event) =>
                            setRequest((current) => ({
                              ...current,
                              tagName: inputValue(event),
                            }))
                          }
                        />
                      )}
                      {request.tagAction === "newtagform" && (
                        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                          <TextInput
                            size="xs"
                            label="Left delimiter"
                            value={request.tagLeft}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                tagLeft: inputValue(event),
                              }))
                            }
                          />
                          <TextInput
                            size="xs"
                            label="Right delimiter"
                            value={request.tagRight}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                tagRight: inputValue(event),
                              }))
                            }
                          />
                          <TextInput
                            size="xs"
                            label="Optional format"
                            placeholder="\\bfseries"
                            value={request.tagFormat}
                            onChange={(event) =>
                              setRequest((current) => ({
                                ...current,
                                tagFormat: inputValue(event),
                              }))
                            }
                          />
                        </SimpleGrid>
                      )}
                      {(request.tagAction === "eqref" ||
                        request.tagAction === "refeq" ||
                        request.tagAction === "noeqref") && (
                        <TextInput
                          size="xs"
                          label="Equation label"
                          value={request.tagRefLabel}
                          onChange={(event) =>
                            setRequest((current) => ({
                              ...current,
                              tagRefLabel: inputValue(event),
                            }))
                          }
                        />
                      )}
                      <Alert color="teal" variant="light">
                        <Text size="xs">
                          Equation references use amsmath for \eqref; tag forms
                          and mathtools references use mathtools. Use the review
                          switch above to keep the required package synchronized.
                        </Text>
                      </Alert>
                    </Stack>
                  )}

                  {request.mode === "delimited" && (
                    <Stack gap="sm">
                      <Select
                        size="xs"
                        label="Delimiter"
                        data={MATH_DELIMITER_TYPES}
                        value={request.delimiterMathType}
                        allowDeselect={false}
                        onChange={updateText("delimiterMathType")}
                      />
                      <Textarea
                        size="xs"
                        label="Math content"
                        value={request.delimiterMathContent}
                        minRows={3}
                        onChange={(event) =>
                          setRequest((current) => ({
                            ...current,
                            delimiterMathContent: inputValue(event),
                          }))
                        }
                      />
                      <Alert color="blue" variant="light">
                        <Text size="xs">
                          Delimited math preserves inline/display delimiters
                          such as \\( ... \\), \\[ ... \\], $ ... $, and $$
                          ... $$ when replacing imported snippets.
                        </Text>
                      </Alert>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Box>

          <Box style={{ width: 390, minWidth: 320 }}>
            <Stack gap="md">
              {mathImports.length > 0 && (
                <Paper withBorder p="sm" radius="md">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={700}>
                        Detected math snippets
                      </Text>
                      <Badge size="xs" variant="light" color="blue">
                        {mathImports.length}
                      </Badge>
                    </Group>
                    <Box
                      style={{
                        maxHeight: 180,
                        overflowY: "auto",
                        paddingRight: 2,
                      }}
                    >
                      <Stack gap={6}>
                        {mathImports.map((snippet) => {
                          const selected = snippet.id === selectedMathImportId;
                          return (
                            <Button
                              key={snippet.id}
                              size="xs"
                              variant={selected ? "light" : "subtle"}
                              color={selected ? "teal" : "gray"}
                              fullWidth
                              justify="flex-start"
                              styles={{
                                inner: { justifyContent: "flex-start" },
                                label: {
                                  display: "block",
                                  width: "100%",
                                  textAlign: "left",
                                },
                              }}
                              onClick={() => {
                                setSelectedMathImportId(snippet.id);
                                setRequest((current) => ({
                                  ...current,
                                  ...snippet.request,
                                }));
                              }}
                            >
                              <Group justify="space-between" gap={6} wrap="nowrap">
                                <Box style={{ minWidth: 0, flex: 1 }}>
                                  <Group gap={6} wrap="nowrap">
                                    <Badge size="xs" variant="dot" color="teal">
                                      {snippet.kind}
                                    </Badge>
                                    <Text size="xs" fw={700} truncate>
                                      {snippet.label}
                                    </Text>
                                  </Group>
                                  {snippet.preview && (
                                    <Text size="xs" c="dimmed" truncate mt={2}>
                                      {snippet.preview}
                                    </Text>
                                  )}
                                </Box>
                                <Badge size="xs" variant="outline" color="gray">
                                  L{snippet.line}
                                </Badge>
                              </Group>
                            </Button>
                          );
                        })}
                      </Stack>
                    </Box>
                    <Text size="xs" c="dimmed">
                      Select an imported snippet to edit it and replace the
                      original through the review panel.
                    </Text>
                  </Stack>
                </Paper>
              )}
              {mathImports.length === 0 && activeFilePath && (
                <Paper withBorder p="sm" radius="md">
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text size="sm" fw={700}>
                        Detected math snippets
                      </Text>
                      <Badge size="xs" variant="light" color="gray">
                        0
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      No supported math snippets were detected in the active
                      file yet. You can still create a new snippet and insert it
                      at the cursor.
                    </Text>
                  </Stack>
                </Paper>
              )}
              <MathLatexPreview
                request={request}
                generatedCode={output?.code || ""}
              />
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Box>
                      <Text size="sm" fw={700}>
                        Source & actions
                      </Text>
                      <Text size="xs" c="dimmed">
                        Review the exact LaTeX that will be inserted or used as
                        a replacement.
                      </Text>
                    </Box>
                    <Badge size="xs" variant="light" color="teal">
                      {request.mode}
                    </Badge>
                  </Group>
                  <Textarea
                    readOnly
                    autosize
                    minRows={6}
                    maxRows={14}
                    value={output?.code || ""}
                    styles={{
                      input: {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      },
                    }}
                  />
                  <Group justify="space-between" align="flex-end">
                    <Group gap={6}>
                      {output?.requirements.length ? (
                        output.requirements.map((requirement) => (
                          <Badge
                            key={requirement.packageId}
                            size="xs"
                            variant="outline"
                            color="gray"
                          >
                            {requirement.packageId}
                          </Badge>
                        ))
                      ) : (
                        <Badge size="xs" variant="outline" color="gray">
                          no package
                        </Badge>
                      )}
                    </Group>
                    <Group gap={6} justify="flex-end">
                      {request.importedSourceRange && (
                        <Button
                          size="xs"
                          variant="light"
                          color="teal"
                          leftSection={<FontAwesomeIcon icon={faFileImport} />}
                          disabled={!canReplaceImportedSnippet}
                          onClick={reviewImportedSnippetReplacement}
                        >
                          {t("packageStudio.replaceImported", {
                            defaultValue: "Replace imported",
                          })}
                        </Button>
                      )}
                      <Button
                        size="xs"
                        leftSection={<FontAwesomeIcon icon={faPlus} />}
                        disabled={!output?.code.trim()}
                        onClick={() => output?.code && onInsertCode(output.code)}
                      >
                        {t("packageStudio.insertAtCursor", {
                          defaultValue: "Insert at cursor",
                        })}
                      </Button>
                    </Group>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
};

const MathLatexPreview: React.FC<{
  request: MathBuilderRequest;
  generatedCode: string;
}> = ({ request, generatedCode }) => {
  const preview = useMemo(
    () => renderMathPreview(request, generatedCode),
    [request, generatedCode],
  );

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={700}>
            Live math preview
          </Text>
          <Group gap={6}>
            {preview.note && (
              <Badge size="xs" variant="light" color="yellow">
                {preview.note}
              </Badge>
            )}
            <Badge size="xs" variant="light" color="violet">
              KaTeX
            </Badge>
          </Group>
        </Group>
        {preview.html ? (
          <Box
            style={{
              minHeight: 92,
              maxHeight: 220,
              overflow: "auto",
              border: "1px solid var(--mantine-color-dark-4)",
              borderRadius: 8,
              padding: "18px 14px",
              background:
                "linear-gradient(135deg, rgba(34, 139, 230, 0.08), rgba(132, 94, 247, 0.07))",
            }}
          >
            <Box
              style={{
                color: "var(--mantine-color-gray-1)",
                fontSize: 18,
              }}
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          </Box>
        ) : (
          <Alert color="yellow" variant="light">
            <Text size="xs" fw={700}>
              Preview unavailable
            </Text>
            <Text size="xs">
              KaTeX could not render this snippet. The generated LaTeX source
              below is still available.
            </Text>
          </Alert>
        )}
        {preview.source && (
          <Text
            size="xs"
            c="dimmed"
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {preview.source}
          </Text>
        )}
      </Stack>
    </Paper>
  );
};

type MathPreviewRender = {
  html: string;
  source: string;
  note?: string;
};

function renderMathPreview(
  request: MathBuilderRequest,
  generatedCode: string,
): MathPreviewRender {
  const preview = buildMathPreviewExpression(request, generatedCode);
  const katexPreview = normalizeMathPreviewForKatex(preview.expression);
  if (!katexPreview.expression.trim()) {
    return { html: "", source: "", note: "empty" };
  }

  try {
    return {
      html: katex.renderToString(katexPreview.expression, {
        displayMode: true,
        throwOnError: false,
        strict: "ignore",
        trust: false,
      }),
      source: preview.expression,
      note: preview.note || katexPreview.note,
    };
  } catch (caught) {
    console.warn("Failed to render KaTeX math preview:", caught);
    return {
      html: "",
      source: preview.expression,
      note: "fallback",
    };
  }
}

function buildMathPreviewExpression(
  request: MathBuilderRequest,
  generatedCode: string,
): { expression: string; note?: string } {
  if (request.mode === "matrix") {
    const matrixType = request.matrixType.replace(/\*$/, "") || "pmatrix";
    const rows = request.matrixCells
      .slice(0, Math.max(1, request.matrixRows))
      .map((row) =>
        row
          .slice(0, Math.max(1, request.matrixColumns))
          .map((cell) => cell.trim() || " ")
          .join(" & "),
      )
      .join(" \\\\\n");
    return {
      expression: `\\begin{${matrixType}}\n${rows || "a"}\n\\end{${matrixType}}`,
      note: request.matrixStarred ? "star preview" : undefined,
    };
  }

  if (request.mode === "tool") {
    return buildMathtoolsPreviewExpression(request);
  }

  if (request.mode === "tag") {
    return buildMathTagPreviewExpression(request);
  }

  if (request.mode === "delimited") {
    return {
      expression: request.delimiterMathContent.trim() || "E = mc^2",
      note:
        request.delimiterMathType === "inline_parens" ||
        request.delimiterMathType === "inline_dollar"
          ? "inline"
          : "display",
    };
  }

  const content =
    stripMathPreviewLabels(request.content).trim() ||
    stripMathPreviewLabels(extractGeneratedMathBody(generatedCode)).trim() ||
    "x = y + z";
  const environment = request.environmentType.replace(/\*$/, "");

  if (["cases", "dcases", "rcases"].includes(environment)) {
    return {
      expression: `\\begin{cases}\n${content}\n\\end{cases}`,
      note: environment === "cases" ? undefined : "normalized",
    };
  }

  if (["align", "aligned", "flalign", "multline", "split"].includes(environment)) {
    return {
      expression: `\\begin{aligned}\n${content}\n\\end{aligned}`,
      note:
        environment === "align" || environment === "aligned"
          ? undefined
          : "normalized",
    };
  }

  if (["gather", "gathered", "lgathered", "rgathered"].includes(environment)) {
    return {
      expression: `\\begin{gathered}\n${content}\n\\end{gathered}`,
      note:
        environment === "gather" || environment === "gathered"
          ? undefined
          : "normalized",
    };
  }

  return { expression: content };
}

function buildMathtoolsPreviewExpression(request: MathBuilderRequest): {
  expression: string;
  note?: string;
} {
  if (request.toolType === "arrow") {
    const below = request.arrowBelow.trim()
      ? `[${request.arrowBelow.trim()}]`
      : "";
    const above = `{${request.arrowAbove.trim() || "f"}}`;
    return {
      expression: `A \\${request.arrowType}${below}${above} B`,
    };
  }

  if (request.toolType === "bracket") {
    const options = [
      request.bracketThickness.trim(),
      request.bracketHeight.trim(),
    ]
      .filter(Boolean)
      .map((value) => `[${value}]`)
      .join("");
    return {
      expression: `\\${request.bracketType}${options}{${
        request.bracketContent.trim() || "a + b"
      }}`,
    };
  }

  if (request.toolType === "split_fraction") {
    return {
      expression: `\\${request.splitFractionType}{${
        request.splitFractionTop.trim() || "a + b"
      }}{${request.splitFractionBottom.trim() || "c + d"}}`,
    };
  }

  if (request.toolType === "prescript") {
    return {
      expression: `\\prescript{${request.prescriptSup.trim() || "14"}}{${
        request.prescriptSub.trim() || "6"
      }}{${request.prescriptArg.trim() || "C"}}`,
    };
  }

  if (request.toolType === "delimiter") {
    return {
      expression: `\\left${request.delimiterLeft.trim() || "\\lVert"} x \\right${
        request.delimiterRight.trim() || "\\rVert"
      }`,
      note: "usage",
    };
  }

  return { expression: "x = y" };
}

function normalizeMathPreviewForKatex(expression: string): {
  expression: string;
  note?: string;
} {
  let normalized = expression;
  const replacements: Array<[RegExp, string]> = [
    [/\\splitd?frac\s*\{([^{}]*)}\s*\{([^{}]*)}/g, "\\frac{\\substack{$1}}{\\substack{$2}}"],
    [/\\xhookleftarrow/g, "\\xleftarrow"],
    [/\\xhookrightarrow/g, "\\xrightarrow"],
    [/\\xleftharpoondown/g, "\\xleftarrow"],
    [/\\xleftharpoonup/g, "\\xleftarrow"],
    [/\\xleftrightharpoons/g, "\\xleftrightarrow"],
    [/\\xrightharpoondown/g, "\\xrightarrow"],
    [/\\xrightharpoonup/g, "\\xrightarrow"],
    [/\\xrightleftharpoons/g, "\\xleftrightarrow"],
    [/\\xlongequal/g, "\\xrightarrow"],
  ];

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return {
    expression: normalized,
    note: normalized === expression ? undefined : "preview-safe",
  };
}

function buildMathTagPreviewExpression(request: MathBuilderRequest): {
  expression: string;
  note?: string;
} {
  if (request.tagAction === "newtagform") {
    return {
      expression: `\\text{${request.tagName.trim() || "tag"}}\\quad ${
        request.tagLeft.trim() || "("
      }1${request.tagRight.trim() || ")"}`,
      note: "tag sample",
    };
  }

  if (request.tagAction === "usetagform") {
    return {
      expression: `\\text{use tag form: }${request.tagName.trim() || "default"}`,
      note: "semantic",
    };
  }

  return {
    expression: `\\text{reference: }${request.tagRefLabel.trim() || "eq:example"}`,
    note: "semantic",
  };
}

function extractGeneratedMathBody(generatedCode: string): string {
  const beginMatch = generatedCode.match(/\\begin\{[^}]+}\s*(?:\[[^\]]+])?/);
  if (!beginMatch || beginMatch.index === undefined) return generatedCode;
  const bodyStart = beginMatch.index + beginMatch[0].length;
  const endMatch = generatedCode.slice(bodyStart).match(/\\end\{[^}]+}/);
  if (!endMatch || endMatch.index === undefined) {
    return generatedCode.slice(bodyStart);
  }
  return generatedCode.slice(bodyStart, bodyStart + endMatch.index);
}

function stripMathPreviewLabels(value: string): string {
  return value
    .split("\n")
    .filter((line) => !line.trim().startsWith("\\label"))
    .join("\n")
    .trim();
}

const SiunitxBuilderPanel: React.FC<{
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  onInsertCode: (code: string) => void;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  activeFilePath,
  activeFileContent,
  analysis,
  onInsertCode,
  onApplyBuilderConfiguration,
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<SiunitxBuilderRequest>(
    DEFAULT_SIUNITX_REQUEST,
  );
  const [output, setOutput] = useState<BuilderOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeFilePath || !activeFileContent) return;
    let mounted = true;
    void importSiunitx(activeFileContent)
      .then((imported) => {
        if (!mounted) return;
        setRequest((current) => ({
          ...current,
          ...imported,
        }));
      })
      .catch((caught) => {
        console.error("Failed to import siunitx setup:", caught);
      });
    return () => {
      mounted = false;
    };
  }, [activeFilePath, activeFileContent]);

  useEffect(() => {
    let mounted = true;

    const build = async () => {
      setLoading(true);
      setError(null);
      try {
        const generated = await generateSiunitx(request);
        if (mounted) setOutput(generated);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to generate siunitx snippet:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void build(), 90);
    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  const updateText =
    (key: keyof Pick<
      SiunitxBuilderRequest,
      | "snippetMode"
      | "number"
      | "exponentMode"
      | "roundMode"
      | "listContent"
      | "rangeStart"
      | "rangeEnd"
      | "perMode"
      | "interUnitProduct"
      | "rangePhrase"
    >) =>
    (value: string | null) => {
      setRequest((current) => ({ ...current, [key]: value || "" }));
    };

  const updateUnit = (
    index: number,
    patch: Partial<SiunitxUnitComponent>,
  ) => {
    setRequest((current) => ({
      ...current,
      units: current.units.map((unit, unitIndex) =>
        unitIndex === index ? { ...unit, ...patch } : unit,
      ),
    }));
  };

  const addUnit = () => {
    setRequest((current) => ({
      ...current,
      units: [
        ...current.units,
        { prefix: "", unit: "\\second", power: "", per: current.units.length > 0 },
      ],
    }));
  };

  const removeUnit = (index: number) => {
    setRequest((current) => ({
      ...current,
      units:
        current.units.length <= 1
          ? current.units
          : current.units.filter((_, unitIndex) => unitIndex !== index),
    }));
  };

  const isSetup = request.snippetMode === "setup";
  const generatedBlocks = isSetup
    ? [{ blockId: "siunitx-setup", code: output?.code || "" }]
    : [];
  const siunitxTarget = isSetup ? "preamble setup" : "body snippet";
  const siunitxWarningCount =
    (output?.warnings.length || 0) + (request.compatibilityWarnings?.length || 0);

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="teal">
                <FontAwesomeIcon icon={faSquareRootAlt} />
              </ThemeIcon>
              <Text fw={700}>
                {t("packageStudio.siunitx.title", {
                  defaultValue: "Siunitx Units",
                })}
              </Text>
              {loading && <Loader size="xs" />}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {t("packageStudio.siunitx.description", {
                defaultValue:
                  "Generate SI numbers, units, quantities, ranges, lists, and setup.",
              })}
            </Text>
          </Box>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => setRequest(DEFAULT_SIUNITX_REQUEST)}
          >
            New siunitx snippet
          </Button>
        </Group>

        <Paper withBorder p="xs" radius="md">
          <Group gap="xs" justify="space-between" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Badge size="sm" variant="light" color="teal">
                {request.snippetMode}
              </Badge>
              <Badge size="sm" variant="outline" color="gray">
                {siunitxTarget}
              </Badge>
              <Badge size="sm" variant="light" color="blue">
                siunitx
              </Badge>
              <Badge
                size="sm"
                variant="light"
                color={siunitxWarningCount ? "orange" : "green"}
              >
                {siunitxWarningCount
                  ? `${siunitxWarningCount} diagnostics`
                  : "clean"}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {isSetup
                ? "Setup snippets are synchronized through the package review switch."
                : "Body snippets can be inserted directly at the cursor."}
            </Text>
          </Group>
        </Paper>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {output?.warnings.map((warning, index) => (
          <Alert
            key={`${warning.code}-${index}`}
            color={warning.severity === "error" ? "red" : "orange"}
            variant="light"
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          >
            <Text size="sm" fw={700}>
              {warning.code}
            </Text>
            <Text size="xs">{warning.message}</Text>
          </Alert>
        ))}

        <BuilderActivationBar
          builderId="siunitx"
          managedPackageIds={["siunitx"]}
          output={output}
          generatedBlocks={generatedBlocks}
          activeFilePath={activeFilePath}
          analysis={analysis}
          loading={loading}
          onApply={onApplyBuilderConfiguration}
        />

        <Group align="stretch" gap="md">
          <Box style={{ flex: 1, minWidth: 420 }}>
            <Stack gap="md">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs">
                    <Box>
                      <Text size="sm" fw={700}>
                        Builder controls
                      </Text>
                      <Text size="xs" c="dimmed">
                        Choose the siunitx output type, then tune only the
                        number, unit, range, or setup fields that apply.
                      </Text>
                    </Box>
                    <Badge size="xs" variant="dot" color="teal">
                      {siunitxTarget}
                    </Badge>
                  </Group>
                  <Select
                    size="xs"
                    label="Snippet type"
                    data={SIUNITX_SNIPPET_MODES}
                    value={request.snippetMode}
                    allowDeselect={false}
                    onChange={updateText("snippetMode")}
                  />

                  {request.snippetMode !== "unit" && !isSetup && (
                    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                      <TextInput
                        size="xs"
                        label="Number"
                        value={request.number}
                        onChange={(event) =>
                          setRequest((current) => ({
                            ...current,
                            number: inputValue(event),
                          }))
                        }
                      />
                      <Select
                        size="xs"
                        label="Exponent"
                        data={[
                          { value: "input", label: "As input" },
                          { value: "scientific", label: "Scientific" },
                          { value: "engineering", label: "Engineering" },
                          { value: "fixed", label: "Fixed" },
                        ]}
                        value={request.exponentMode}
                        allowDeselect={false}
                        onChange={updateText("exponentMode")}
                      />
                      <Select
                        size="xs"
                        label="Round"
                        data={[
                          { value: "none", label: "None" },
                          { value: "places", label: "Places" },
                          { value: "figures", label: "Figures" },
                          { value: "uncertainty", label: "Uncertainty" },
                        ]}
                        value={request.roundMode}
                        allowDeselect={false}
                        onChange={updateText("roundMode")}
                      />
                    </SimpleGrid>
                  )}

                  {(request.roundMode === "places" ||
                    request.roundMode === "figures") &&
                    !isSetup && (
                      <NumberInput
                        size="xs"
                        label="Round precision"
                        min={0}
                        max={20}
                        value={request.roundPrecision}
                        onChange={(value) =>
                          setRequest((current) => ({
                            ...current,
                            roundPrecision: Number(value) || 0,
                          }))
                        }
                      />
                    )}

                  {request.snippetMode === "qtylist" && (
                    <Textarea
                      size="xs"
                      label="List values"
                      description="Separate values with semicolons"
                      value={request.listContent}
                      onChange={(event) =>
                        setRequest((current) => ({
                          ...current,
                          listContent: inputValue(event),
                        }))
                      }
                      minRows={3}
                    />
                  )}

                  {request.snippetMode === "qtyrange" && (
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                      <TextInput
                        size="xs"
                        label="Range start"
                        value={request.rangeStart}
                        onChange={(event) =>
                          setRequest((current) => ({
                            ...current,
                            rangeStart: inputValue(event),
                          }))
                        }
                      />
                      <TextInput
                        size="xs"
                        label="Range end"
                        value={request.rangeEnd}
                        onChange={(event) =>
                          setRequest((current) => ({
                            ...current,
                            rangeEnd: inputValue(event),
                          }))
                        }
                      />
                    </SimpleGrid>
                  )}

                  {isSetup && (
                    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                      <Select
                        size="xs"
                        label="Per mode"
                        data={["power", "fraction", "symbol"]}
                        value={request.perMode}
                        allowDeselect={false}
                        onChange={updateText("perMode")}
                      />
                      <Select
                        size="xs"
                        label="Inter-unit product"
                        data={["thin", "tight", "cdot"]}
                        value={request.interUnitProduct}
                        allowDeselect={false}
                        onChange={updateText("interUnitProduct")}
                      />
                      <Select
                        size="xs"
                        label="Range phrase"
                        data={[
                          { value: "to", label: "to" },
                          { value: "--", label: "--" },
                        ]}
                        value={request.rangePhrase}
                        allowDeselect={false}
                        onChange={updateText("rangePhrase")}
                      />
                    </SimpleGrid>
                  )}
                </Stack>
              </Paper>

              {!isSetup && request.snippetMode !== "num" && (
                <Paper withBorder p="sm" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text size="sm" fw={700}>
                        Unit builder
                      </Text>
                      <Select
                        size="xs"
                        placeholder="Preset"
                        data={SIUNITX_PRESETS.map(({ value, label }) => ({
                          value,
                          label,
                        }))}
                        onChange={(value) => {
                          const preset = SIUNITX_PRESETS.find(
                            (item) => item.value === value,
                          );
                          if (preset) {
                            setRequest((current) => ({
                              ...current,
                              units: preset.units,
                            }));
                          }
                        }}
                        w={180}
                      />
                    </Group>
                    {request.units.map((unit, index) => (
                      <Group key={`${index}-${unit.unit}`} gap="xs" align="end">
                        <Select
                          size="xs"
                          label={index === 0 ? "Prefix" : undefined}
                          data={SIUNITX_PREFIXES}
                          value={unit.prefix}
                          searchable
                          onChange={(value) =>
                            updateUnit(index, { prefix: value || "" })
                          }
                          w={105}
                        />
                        <Select
                          size="xs"
                          label={index === 0 ? "Unit" : undefined}
                          data={SIUNITX_UNITS}
                          value={unit.unit}
                          searchable
                          onChange={(value) =>
                            updateUnit(index, { unit: value || "\\meter" })
                          }
                          style={{ flex: 1 }}
                        />
                        <Select
                          size="xs"
                          label={index === 0 ? "Power" : undefined}
                          data={SIUNITX_POWERS}
                          value={unit.power}
                          onChange={(value) =>
                            updateUnit(index, { power: value || "" })
                          }
                          w={86}
                        />
                        <Switch
                          size="sm"
                          label="per"
                          checked={unit.per}
                          disabled={index === 0}
                          onChange={(event) =>
                            updateUnit(index, {
                              per: inputChecked(event),
                            })
                          }
                        />
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          disabled={request.units.length <= 1}
                          onClick={() => removeUnit(index)}
                          aria-label="Remove siunitx unit component"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </ActionIcon>
                      </Group>
                    ))}
                    <Button size="xs" variant="light" onClick={addUnit}>
                      Add unit component
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Box>

          <Box style={{ width: 390, minWidth: 320 }}>
            <Stack gap="md">
              <SiunitxLivePreview request={request} output={output} />
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      Generated siunitx code
                    </Text>
                    <Badge size="xs" variant="light" color="teal">
                      {isSetup ? "preamble" : "body"}
                    </Badge>
                  </Group>
                  <Textarea
                    readOnly
                    autosize
                    minRows={isSetup ? 7 : 3}
                    maxRows={12}
                    value={output?.code || ""}
                    styles={{
                      input: {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      },
                    }}
                  />
                  <Group justify="space-between">
                    <Group gap={6}>
                      {output?.requirements.map((requirement) => (
                        <Badge
                          key={requirement.packageId}
                          size="xs"
                          variant="outline"
                          color="gray"
                        >
                          {requirement.packageId}
                        </Badge>
                      ))}
                    </Group>
                    <Button
                      size="xs"
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                      disabled={isSetup || !output?.code.trim()}
                      onClick={() => output?.code && onInsertCode(output.code)}
                    >
                      {isSetup ? "Use review switch" : "Insert at cursor"}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
};

const SiunitxLivePreview: React.FC<{
  request: SiunitxBuilderRequest;
  output: BuilderOutput | null;
}> = ({ request, output }) => {
  const isSetup = request.snippetMode === "setup";
  const unitPreview = siunitxUnitPreview(request.units);
  const listValues = request.listContent
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  const activeNumberOptions = [
    request.exponentMode !== "input" ? `exponent: ${request.exponentMode}` : "",
    request.roundMode !== "none" ? `round: ${request.roundMode}` : "",
    request.roundMode === "places" || request.roundMode === "figures"
      ? `precision: ${request.roundPrecision}`
      : "",
  ].filter(Boolean);

  const previewTitle = isSetup
    ? "Setup preview"
    : request.snippetMode === "num"
      ? "Number preview"
      : request.snippetMode === "unit"
        ? "Unit preview"
        : request.snippetMode === "qtylist"
          ? "List preview"
          : request.snippetMode === "qtyrange"
            ? "Range preview"
            : "Quantity preview";

  const previewValue = (() => {
    if (isSetup) {
      return `per-mode ${request.perMode}, product ${request.interUnitProduct}, ranges ${request.rangePhrase}`;
    }
    if (request.snippetMode === "num") return request.number || "—";
    if (request.snippetMode === "unit") return unitPreview;
    if (request.snippetMode === "qtylist") {
      return `${listValues.join(", ") || "—"} ${unitPreview}`.trim();
    }
    if (request.snippetMode === "qtyrange") {
      return `${request.rangeStart || "—"} – ${request.rangeEnd || "—"} ${unitPreview}`.trim();
    }
    return `${request.number || "—"} ${unitPreview}`.trim();
  })();

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={700}>
            Live siunitx preview
          </Text>
          <Badge size="xs" variant="light" color="teal">
            {request.snippetMode}
          </Badge>
        </Group>
        <Paper p="sm" radius="sm" bg="var(--mantine-color-dark-6)">
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              {previewTitle}
            </Text>
            <Text size="lg" fw={700}>
              {previewValue}
            </Text>
            {!isSetup && request.snippetMode !== "num" && (
              <Text size="xs" c="dimmed">
                Compound unit: {unitPreview}
              </Text>
            )}
          </Stack>
        </Paper>
        <Group gap={6}>
          {activeNumberOptions.map((option) => (
            <Badge key={option} size="xs" variant="light" color="blue">
              {option}
            </Badge>
          ))}
          {isSetup && (
            <>
              <Badge size="xs" variant="light" color="violet">
                per {request.perMode}
              </Badge>
              <Badge size="xs" variant="light" color="violet">
                product {request.interUnitProduct}
              </Badge>
            </>
          )}
          {output?.warnings.length ? (
            <Badge size="xs" variant="light" color="orange">
              {output.warnings.length} warning
              {output.warnings.length === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge size="xs" variant="light" color="green">
              no warnings
            </Badge>
          )}
        </Group>
      </Stack>
    </Paper>
  );
};

const siunitxUnitPreview = (units: SiunitxUnitComponent[]) => {
  const parts = units.map((unit, index) => {
    const prefix = siunitxLabelPart(SIUNITX_PREFIXES, unit.prefix);
    const unitLabel = siunitxLabelPart(SIUNITX_UNITS, unit.unit);
    const power = siunitxPowerLabel(unit.power);
    const separator = unit.per ? "/" : index === 0 ? "" : " · ";
    const prefixLabel = prefix && prefix !== "none" ? `${prefix} ` : "";
    return `${separator}${prefixLabel}${unitLabel}${power}`;
  });
  return parts.join("") || "unit";
};

const siunitxLabelPart = (
  data: Array<{ value: string; label: string }>,
  value: string,
) => data.find((item) => item.value === value)?.label.split("·")[0].trim() || value;

const siunitxPowerLabel = (power: string) => {
  if (!power) return "";
  if (power === "\\squared") return "²";
  if (power === "\\cubed") return "³";
  const match = power.match(/^\^\{(.+)\}$/);
  return match ? toSuperscript(match[1]) : power;
};

const toSuperscript = (value: string) =>
  value
    .replace(/-/g, "⁻")
    .replace(/0/g, "⁰")
    .replace(/1/g, "¹")
    .replace(/2/g, "²")
    .replace(/3/g, "³")
    .replace(/4/g, "⁴")
    .replace(/5/g, "⁵")
    .replace(/6/g, "⁶")
    .replace(/7/g, "⁷")
    .replace(/8/g, "⁸")
    .replace(/9/g, "⁹");

const TablePreview: React.FC<{ request: TableBuilderRequest }> = ({
  request,
}) => (
  <Paper withBorder p="sm" radius="md">
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={700}>
          Table sketch
        </Text>
        <Badge size="xs" variant="light" color="cyan">
          {request.mode}
        </Badge>
      </Group>
      <Box style={{ overflowX: "auto" }}>
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${request.columns}, minmax(70px, 1fr))`,
            borderTop:
              request.hlines || request.mode === "booktabs"
                ? "2px solid var(--mantine-color-cyan-5)"
                : "1px solid var(--app-border-color)",
            minWidth: request.columns * 76,
          }}
        >
          {request.cells.flatMap((row, rowIndex) =>
            row.map((cell, columnIndex) => {
              const span = request.cellSpans[rowIndex]?.[columnIndex] ?? {
                rowSpan: 1,
                colSpan: 1,
                hidden: false,
              };
              if (span.hidden) return null;
              return (
                <Box
                  key={`preview-${rowIndex}-${columnIndex}`}
                  p={6}
                  style={{
                    gridColumn: `span ${span.colSpan}`,
                    gridRow: `span ${span.rowSpan}`,
                    borderBottom: request.hlines
                      ? "1px solid var(--app-border-color)"
                      : undefined,
                    borderRight: request.vlines
                      ? "1px solid var(--app-border-color)"
                      : undefined,
                    fontWeight:
                      request.cellStyles[rowIndex]?.[columnIndex]?.bold ||
                      rowIndex === 0
                        ? 700
                        : 400,
                    fontStyle: request.cellStyles[rowIndex]?.[columnIndex]?.italic
                      ? "italic"
                      : undefined,
                    backgroundColor:
                      request.cellStyles[rowIndex]?.[columnIndex]
                        ?.backgroundColor || undefined,
                    color:
                      request.cellStyles[rowIndex]?.[columnIndex]?.textColor ||
                      undefined,
                    textAlign: tableCssAlign(
                      request.cellStyles[rowIndex]?.[columnIndex]?.alignment ||
                        request.columnAlignments[columnIndex],
                    ),
                    minHeight: 32 * span.rowSpan,
                    display: "flex",
                    alignItems: tableCssVerticalAlign(
                      request.cellStyles[rowIndex]?.[columnIndex]
                        ?.verticalAlignment,
                    ),
                    justifyContent:
                      tableCssAlign(
                        request.cellStyles[rowIndex]?.[columnIndex]?.alignment ||
                          request.columnAlignments[columnIndex],
                      ) === "right"
                        ? "flex-end"
                        : tableCssAlign(
                              request.cellStyles[rowIndex]?.[columnIndex]
                                ?.alignment ||
                                request.columnAlignments[columnIndex],
                            ) === "center"
                          ? "center"
                          : "flex-start",
                  }}
                >
                  <Text size="xs" truncate>
                    {cell || "—"}
                  </Text>
                </Box>
              );
            }),
          )}
        </Box>
      </Box>
      {(request.caption || request.label) && (
        <Text size="xs" c="dimmed">
          {request.caption || "Untitled table"}
          {request.label ? ` · ${request.label}` : ""}
        </Text>
      )}
    </Stack>
  </Paper>
);

const GraphicxPreview: React.FC<{ request: GraphicxBuilderRequest }> = ({
  request,
}) => (
  <Paper withBorder p="sm" radius="md">
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={700}>
          Figure sketch
        </Text>
        <Badge size="xs" variant="light" color="orange">
          {request.useFigure ? "figure" : "includegraphics"}
        </Badge>
      </Group>
      <Box
        style={{
          height: 240,
          borderRadius: 8,
          background: "var(--mantine-color-dark-7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 18,
        }}
      >
        <Box
          style={{
            width: request.width ? 190 : 150,
            height: request.height ? 130 : 115,
            borderRadius: 8,
            border: "1px dashed var(--mantine-color-orange-4)",
            background:
              "linear-gradient(135deg, rgba(253,126,20,0.22), rgba(34,139,230,0.12))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: request.angle ? `rotate(${request.angle}deg)` : undefined,
            transition: "width 120ms ease, height 120ms ease, transform 120ms ease",
          }}
        >
          <Stack gap={2} align="center">
            <FontAwesomeIcon icon={faImage} />
            <Text size="xs" c="dimmed" maw={160} ta="center" truncate>
              {request.filePath || "imagefile"}
            </Text>
          </Stack>
        </Box>
      </Box>
      {request.useFigure && (
        <Text size="xs" c="dimmed" ta="center">
          {request.caption || "Caption"}
        </Text>
      )}
    </Stack>
  </Paper>
);

type ListingsColorKey = keyof CodeHighlightingBuilderRequest["lstColors"];

const CodeHighlightingBuilderPanel: React.FC<{
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  onInsertCode: (code: string) => void;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  activeFilePath,
  activeFileContent,
  analysis,
  onInsertCode,
  onApplyBuilderConfiguration,
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<CodeHighlightingBuilderRequest>(
    DEFAULT_CODE_HIGHLIGHTING_REQUEST,
  );
  const [output, setOutput] = useState<BuilderOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snippetSource, setSnippetSource] = useState(CODE_SNIPPET_SAMPLE);
  const [snippetOutput, setSnippetOutput] = useState("");
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [snippetError, setSnippetError] = useState<string | null>(null);
  const { options: codeOptions } = useBuilderOptions("code-highlighting");
  const codeOption = (option: string) =>
    codeOptions.find(
      (item) => item.packageId === request.engine && item.option === option,
    );

  useEffect(() => {
    if (!activeFilePath || !activeFileContent) return;
    let mounted = true;
    void importCodeHighlighting(activeFileContent)
      .then((imported) => {
        if (!mounted || imported.engine === "none") return;
        setRequest((current) => ({
          ...current,
          ...imported,
          language: ensureSupportedCodeLanguage(
            imported.engine,
            imported.language || current.language,
          ),
        }));
      })
      .catch((caught) => {
        console.error("Failed to import code highlighting setup:", caught);
      });
    return () => {
      mounted = false;
    };
  }, [activeFilePath, activeFileContent]);

  useEffect(() => {
    if (!activeFilePath || !analysis || activeFileContent) return;
    const installedEngine = analysis.packages.some(
      (packageId) => packageId.toLowerCase() === "minted",
    )
      ? "minted"
      : analysis.packages.some(
            (packageId) => packageId.toLowerCase() === "listings",
          )
        ? "listings"
        : null;
    if (!installedEngine) return;
    setRequest((current) =>
      current.engine === installedEngine
        ? current
        : { ...current, engine: installedEngine },
    );
  }, [activeFilePath, analysis]);

  useEffect(() => {
    let mounted = true;

    const build = async () => {
      setLoading(true);
      setError(null);
      try {
        const generated = await generateCodeHighlighting(request);
        if (mounted) setOutput(generated);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to generate code highlighting setup:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void build(), 90);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  useEffect(() => {
    let mounted = true;

    const buildSnippet = async () => {
      setSnippetLoading(true);
      setSnippetError(null);
      try {
        const generated = await generateCodeHighlightingSnippet(
          request,
          snippetSource,
        );
        if (mounted) setSnippetOutput(generated);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to generate code highlighting snippet:", caught);
        setSnippetError(String(caught));
      } finally {
        if (mounted) setSnippetLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void buildSnippet(), 90);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request, snippetSource]);

  const updateBoolean =
    (key: keyof Pick<
      CodeHighlightingBuilderRequest,
      "showNumbers" | "breakLines" | "showFrame"
    >) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = inputChecked(event);
      setRequest((current) => ({
        ...current,
        [key]: checked,
      }));
    };

  const updateColor = (key: ListingsColorKey, value: string) => {
    setRequest((current) => ({
      ...current,
      lstColors: {
        ...current.lstColors,
        [key]: value,
      },
    }));
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="violet">
                <FontAwesomeIcon icon={faCode} />
              </ThemeIcon>
              <Text fw={700}>
                {t("packageStudio.codeHighlighting.title", {
                  defaultValue: "Code highlighting builder",
                })}
              </Text>
              {loading && <Loader size="xs" />}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {t("packageStudio.codeHighlighting.description", {
                defaultValue:
                  "Generate listings or minted setup from the native Rust builder.",
              })}
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setRequest(DEFAULT_CODE_HIGHLIGHTING_REQUEST)}
            >
              {t("packageStudio.reset", { defaultValue: "Reset" })}
            </Button>
          </Group>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {output?.warnings.map((warning, index) => (
          <Alert
            key={`${warning.code}-${index}`}
            color={warning.severity === "error" ? "red" : "orange"}
            variant="light"
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          >
            <Text size="sm" fw={700}>
              {warning.code}
            </Text>
            <Text size="xs">{warning.message}</Text>
          </Alert>
        ))}

        <BuilderActivationBar
          builderId="code-highlighting"
          managedPackageIds={["listings", "minted"]}
          output={output}
          generatedBlocks={[
            { blockId: "code-highlighting", code: output?.code || "" },
          ]}
          activeFilePath={activeFilePath}
          analysis={analysis}
          loading={loading}
          onApply={onApplyBuilderConfiguration}
        />

        <Group align="stretch" gap="md" style={{ minHeight: 0 }}>
          <Box style={{ flex: 1.1, minWidth: 360 }}>
            <Stack gap="md">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Select
                    size="xs"
                    label={t("packageStudio.codeHighlighting.engine", {
                      defaultValue: "Highlighting engine",
                    })}
                    description={t("packageStudio.codeHighlighting.engineHint", {
                      defaultValue:
                        "Use listings for pure LaTeX, or minted for richer output with shell-escape.",
                    })}
                    data={[
                      { value: "listings", label: "Listings" },
                      { value: "minted", label: "Minted" },
                    ]}
                    value={request.engine}
                    onChange={(value) =>
                      setRequest((current) => {
                        const engine = value || "listings";
                        return {
                          ...current,
                          engine,
                          language: ensureSupportedCodeLanguage(
                            engine,
                            current.language,
                          ),
                        };
                      })
                    }
                  />

                  {request.engine !== "none" && (
                    <Select
                      size="xs"
                      label={t("packageStudio.codeHighlighting.language", {
                        defaultValue: "Snippet language",
                      })}
                      description={t("packageStudio.codeHighlighting.languageHint", {
                        defaultValue:
                          "Used for generated lstlisting/minted body snippets.",
                      })}
                      data={codeLanguageOptions(request.engine)}
                      value={ensureSupportedCodeLanguage(
                        request.engine,
                        request.language,
                      )}
                      searchable
                      onChange={(value) =>
                        setRequest((current) => ({
                          ...current,
                          language: value || "python",
                        }))
                      }
                    />
                  )}

                  {request.engine !== "none" && (
                    <Group grow align="flex-start">
                      <Switch
                        size="sm"
                        label={
                          <OptionControlLabel
                            label={t("packageStudio.codeHighlighting.lineNumbers", {
                              defaultValue: "Line numbers",
                            })}
                            descriptor={codeOption(
                              request.engine === "minted" ? "linenos" : "numbers=left",
                            )}
                          />
                        }
                        checked={request.showNumbers}
                        onChange={updateBoolean("showNumbers")}
                      />
                      <Switch
                        size="sm"
                        label={
                          <OptionControlLabel
                            label={t("packageStudio.codeHighlighting.breakLines", {
                              defaultValue: "Break lines",
                            })}
                            descriptor={codeOption(
                              request.engine === "minted" ? "breaklines" : "breaklines=true",
                            )}
                          />
                        }
                        checked={request.breakLines}
                        onChange={updateBoolean("breakLines")}
                      />
                      <Switch
                        size="sm"
                        label={
                          <OptionControlLabel
                            label={t("packageStudio.codeHighlighting.frame", {
                              defaultValue: "Frame",
                            })}
                            descriptor={codeOption(
                              request.engine === "minted" ? "frame=lines" : "frame=single",
                            )}
                          />
                        }
                        checked={request.showFrame}
                        onChange={updateBoolean("showFrame")}
                      />
                    </Group>
                  )}
                </Stack>
              </Paper>

              {request.engine === "listings" && (
                <Paper withBorder p="sm" radius="md">
                  <Stack gap="sm">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.codeHighlighting.listingsColors", {
                        defaultValue: "Listings colors",
                      })}
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                      <ColorInput
                        size="xs"
                        label={
                          <OptionControlLabel
                            label={t("packageStudio.codeHighlighting.keywords", {
                              defaultValue: "Keywords",
                            })}
                            descriptor={codeOption("keywordstyle")}
                          />
                        }
                        value={request.lstColors.keyword}
                        onChange={(value) => updateColor("keyword", value)}
                      />
                      <ColorInput
                        size="xs"
                        label={t("packageStudio.codeHighlighting.strings", {
                          defaultValue: "Strings",
                        })}
                        value={request.lstColors.string}
                        onChange={(value) => updateColor("string", value)}
                      />
                      <ColorInput
                        size="xs"
                        label={t("packageStudio.codeHighlighting.comments", {
                          defaultValue: "Comments",
                        })}
                        value={request.lstColors.comment}
                        onChange={(value) => updateColor("comment", value)}
                      />
                      <ColorInput
                        size="xs"
                        label={
                          <OptionControlLabel
                            label={t("packageStudio.codeHighlighting.background", {
                              defaultValue: "Background",
                            })}
                            descriptor={codeOption("backgroundcolor")}
                          />
                        }
                        value={request.lstColors.background}
                        onChange={(value) => updateColor("background", value)}
                      />
                    </SimpleGrid>
                  </Stack>
                </Paper>
              )}

              {request.engine === "minted" && (
                <Paper withBorder p="sm" radius="md">
                  <Stack gap="sm">
                    <Alert
                      variant="light"
                      color="orange"
                      icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
                    >
                      {t("packageStudio.codeHighlighting.mintedRequirement", {
                        defaultValue:
                          "Minted usually requires -shell-escape and Python/Pygments in the build environment.",
                      })}
                    </Alert>
                    <Select
                      size="xs"
                      label={
                        <OptionControlLabel
                          label={t("packageStudio.codeHighlighting.mintedStyle", {
                            defaultValue: "Minted style",
                          })}
                          descriptor={codeOption("style")}
                        />
                      }
                      data={MINTED_STYLE_OPTIONS}
                      value={request.mintedStyle}
                      searchable
                      onChange={(value) =>
                        setRequest((current) => ({
                          ...current,
                          mintedStyle: value || "friendly",
                        }))
                      }
                    />
                  </Stack>
                </Paper>
              )}

              {request.engine !== "none" && (
                <Paper withBorder p="sm" radius="md">
                  <Stack gap="xs">
                    <Group justify="space-between" gap="xs">
                      <Box>
                        <Text size="sm" fw={700}>
                          {t("packageStudio.codeHighlighting.snippetBuilder", {
                            defaultValue: "Body snippet builder",
                          })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t("packageStudio.codeHighlighting.snippetHint", {
                            defaultValue:
                              "Generate a cursor-ready code environment using the selected engine and language.",
                          })}
                        </Text>
                      </Box>
                      <Group gap={6}>
                        {snippetLoading && <Loader size="xs" />}
                        <Badge size="xs" variant="light" color="violet">
                          {request.language}
                        </Badge>
                      </Group>
                    </Group>
                    {snippetError && (
                      <Alert color="red" variant="light">
                        {snippetError}
                      </Alert>
                    )}
                    <Textarea
                      size="xs"
                      label={t("packageStudio.codeHighlighting.sampleCode", {
                        defaultValue: "Code content",
                      })}
                      minRows={4}
                      autosize
                      value={snippetSource}
                      onChange={(event) => setSnippetSource(inputValue(event))}
                      styles={{
                        input: {
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          fontSize: 12,
                        },
                      }}
                    />
                    <Textarea
                      readOnly
                      size="xs"
                      label={t("packageStudio.codeHighlighting.generatedSnippet", {
                        defaultValue: "Generated body snippet",
                      })}
                      minRows={5}
                      autosize
                      value={snippetOutput}
                      styles={{
                        input: {
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          fontSize: 12,
                        },
                      }}
                    />
                    <Group justify="space-between" gap="xs">
                      <Text size="xs" c="dimmed">
                        {request.engine === "minted"
                          ? t("packageStudio.codeHighlighting.mintedSnippetNote", {
                              defaultValue:
                                "Remember to apply the minted setup before compiling.",
                            })
                          : t("packageStudio.codeHighlighting.listingsSnippetNote", {
                              defaultValue:
                                "Remember to apply the listings setup before compiling.",
                            })}
                      </Text>
                      <Button
                        size="xs"
                        leftSection={<FontAwesomeIcon icon={faPlus} />}
                        disabled={!snippetOutput.trim()}
                        onClick={() => onInsertCode(snippetOutput)}
                      >
                        {t("packageStudio.insertAtCursor", {
                          defaultValue: "Insert at cursor",
                        })}
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Box>

          <Box style={{ width: 390, minWidth: 330 }}>
            <Stack gap="md" h="100%">
              <CodeHighlightingPreview request={request} />
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.generatedCode", {
                        defaultValue: "Generated code",
                      })}
                    </Text>
                    <Group gap={6}>
                      {output?.buildProfile.shellEscapeRequired && (
                        <Badge size="xs" color="orange" variant="light">
                          shell-escape
                        </Badge>
                      )}
                      <Badge size="xs" variant="light" color="violet">
                        Rust
                      </Badge>
                    </Group>
                  </Group>
                  <Textarea
                    readOnly
                    autosize
                    minRows={6}
                    maxRows={12}
                    value={output?.code || ""}
                    styles={{
                      input: {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      },
                    }}
                  />
                  {output?.requirements.length ? (
                    <Group gap={6}>
                      {output.requirements.map((requirement) => (
                        <Badge
                          key={requirement.packageId}
                          size="xs"
                          variant="outline"
                          color="gray"
                        >
                          {requirement.packageId}
                        </Badge>
                      ))}
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed">
                      {t("packageStudio.noPackageOutput", {
                        defaultValue: "Package output disabled.",
                      })}
                    </Text>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
};

const CodeHighlightingPreview: React.FC<{
  request: CodeHighlightingBuilderRequest;
}> = ({ request }) => {
  const colors = request.lstColors;
  const isMinted = request.engine === "minted";

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={700}>
            Live style sketch
          </Text>
          <Badge size="xs" variant="light" color={isMinted ? "orange" : "gray"}>
            {request.engine}
          </Badge>
        </Group>
        <Box
          style={{
            borderRadius: 8,
            border: request.showFrame
              ? "1px solid var(--mantine-color-gray-6)"
              : "1px solid transparent",
            background:
              request.engine === "listings"
                ? colors.background
                : "var(--mantine-color-dark-7)",
            color:
              request.engine === "listings"
                ? "var(--mantine-color-dark-8)"
                : "var(--mantine-color-gray-2)",
            padding: 12,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12,
            lineHeight: 1.55,
            minHeight: 168,
            overflow: "hidden",
          }}
        >
          {request.engine === "none" ? (
            <Text size="xs" c="dimmed">
              Highlighting is disabled.
            </Text>
          ) : (
            <Box component="pre" m={0}>
              {request.showNumbers && <span style={{ opacity: 0.45 }}>1  </span>}
              <span style={{ color: isMinted ? "#ffcc66" : colors.keyword }}>
                function
              </span>{" "}
              solve
              <span style={{ color: isMinted ? "#89ddff" : colors.keyword }}>
                (
              </span>
              x
              <span style={{ color: isMinted ? "#89ddff" : colors.keyword }}>
                )
              </span>{" "}
              {"{\n"}
              {request.showNumbers && <span style={{ opacity: 0.45 }}>2  </span>}
              {"  "}
              <span style={{ color: isMinted ? "#c3e88d" : colors.string }}>
                "LaTeX"
              </span>{" "}
              + x
              {"\n"}
              {request.showNumbers && <span style={{ opacity: 0.45 }}>3  </span>}
              {"  "}
              <span style={{ color: isMinted ? "#676e95" : colors.comment }}>
                // generated package setup
              </span>
              {"\n}"}
            </Box>
          )}
        </Box>
      </Stack>
    </Paper>
  );
};

type FancyhdrTextKey =
  | "headerOddLeft"
  | "headerOddCenter"
  | "headerOddRight"
  | "headerEvenLeft"
  | "headerEvenCenter"
  | "headerEvenRight"
  | "footerOddLeft"
  | "footerOddCenter"
  | "footerOddRight"
  | "footerEvenLeft"
  | "footerEvenCenter"
  | "footerEvenRight";

const toggleOptionValue = (
  values: string[],
  option: string,
  checked: boolean,
) =>
  checked
    ? values.includes(option)
      ? values
      : [...values, option]
    : values.filter((value) => value !== option);

type RgbColor = [number, number, number];

const STANDARD_XCOLOR_PREVIEWS: Record<string, string> = {
  black: "#000000",
  blue: "#0000ff",
  brown: "#a52a2a",
  cyan: "#00ffff",
  darkgray: "#555555",
  gray: "#808080",
  green: "#008000",
  lightgray: "#d3d3d3",
  lime: "#00ff00",
  magenta: "#ff00ff",
  olive: "#808000",
  orange: "#ffa500",
  pink: "#ffc0cb",
  purple: "#800080",
  red: "#ff0000",
  teal: "#008080",
  violet: "#7f00ff",
  white: "#ffffff",
  yellow: "#ffff00",
};

const clampColor = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const parseColorComponents = (value: string, count: number) => {
  const values = value.split(",").map((part) => Number(part.trim()));
  return values.length === count && values.every(Number.isFinite) ? values : null;
};

const hsvToRgb = (hue: number, saturation: number, brightness: number): RgbColor => {
  const h = ((hue % 1) + 1) % 1;
  const s = clampColor(saturation);
  const v = clampColor(brightness);
  const sector = Math.floor(h * 6);
  const fraction = h * 6 - sector;
  const p = v * (1 - s);
  const q = v * (1 - fraction * s);
  const t = v * (1 - (1 - fraction) * s);
  const choices: RgbColor[] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ];
  return choices[sector % 6].map((component) => component * 255) as RgbColor;
};

const xcolorDefinitionToRgb = (
  color: XcolorBuilderRequest["colors"][number],
): RgbColor | null => {
  const { model, value } = color;
  if (model === "HTML") {
    const hex = value.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as RgbColor;
  }

  if (model === "RGB") {
    const components = parseColorComponents(value, 3);
    return components?.every((component) => component >= 0 && component <= 255)
      ? (components as RgbColor)
      : null;
  }

  if (model === "rgb") {
    const components = parseColorComponents(value, 3);
    return components?.every((component) => component >= 0 && component <= 1)
      ? (components.map((component) => component * 255) as RgbColor)
      : null;
  }

  if (model === "cmy") {
    const components = parseColorComponents(value, 3);
    return components?.every((component) => component >= 0 && component <= 1)
      ? (components.map((component) => (1 - component) * 255) as RgbColor)
      : null;
  }

  if (model === "cmyk") {
    const components = parseColorComponents(value, 4);
    if (!components?.every((component) => component >= 0 && component <= 1)) return null;
    const [cyan, magenta, yellow, black] = components;
    return [
      255 * (1 - cyan) * (1 - black),
      255 * (1 - magenta) * (1 - black),
      255 * (1 - yellow) * (1 - black),
    ];
  }

  if (model === "hsb" || model === "HSB") {
    const components = parseColorComponents(value, 3);
    if (!components) return null;
    const divisor = model === "HSB" ? 255 : 1;
    if (!components.every((component) => component >= 0 && component <= divisor)) return null;
    return hsvToRgb(
      components[0] / divisor,
      components[1] / divisor,
      components[2] / divisor,
    );
  }

  if (model === "gray" || model === "Gray") {
    const components = parseColorComponents(value, 1);
    if (!components) return null;
    const divisor = model === "Gray" ? 15 : 1;
    if (components[0] < 0 || components[0] > divisor) return null;
    const channel = (components[0] / divisor) * 255;
    return [channel, channel, channel];
  }

  return null;
};

const rgbToHex = (rgb: RgbColor) =>
  `#${rgb
    .map((component) => Math.round(clampColor(component, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`;

const hexToXcolorValue = (hexValue: string, model: string) => {
  const hex = hexValue.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "";
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)) as RgbColor;
  const normalized = rgb.map((component) => component / 255);
  const format = (value: number) => Number(value.toFixed(3)).toString();
  if (model === "HTML") return hex.toUpperCase();
  if (model === "RGB") return rgb.map(Math.round).join(",");
  if (model === "rgb") return normalized.map(format).join(",");
  if (model === "cmy") return normalized.map((component) => format(1 - component)).join(",");
  if (model === "cmyk") {
    const black = 1 - Math.max(...normalized);
    if (black >= 0.999) return "0,0,0,1";
    const [red, green, blue] = normalized;
    return [
      (1 - red - black) / (1 - black),
      (1 - green - black) / (1 - black),
      (1 - blue - black) / (1 - black),
      black,
    ]
      .map(format)
      .join(",");
  }
  const max = Math.max(...normalized);
  const min = Math.min(...normalized);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === normalized[0]) hue = ((normalized[1] - normalized[2]) / delta) % 6;
    else if (max === normalized[1]) hue = (normalized[2] - normalized[0]) / delta + 2;
    else hue = (normalized[0] - normalized[1]) / delta + 4;
    hue = ((hue / 6) + 1) % 1;
  }
  const saturation = max === 0 ? 0 : delta / max;
  if (model === "hsb") return [hue, saturation, max].map(format).join(",");
  if (model === "HSB") return [hue, saturation, max].map((value) => Math.round(value * 255)).join(",");
  const luminance = normalized[0] * 0.299 + normalized[1] * 0.587 + normalized[2] * 0.114;
  if (model === "gray") return format(luminance);
  if (model === "Gray") return Math.round(luminance * 15).toString();
  return hex.toUpperCase();
};

const getXcolorPreviewColor = (
  color: XcolorBuilderRequest["colors"][number],
) => {
  const rgb = xcolorDefinitionToRgb(color);
  return rgb ? rgbToHex(rgb) : null;
};

const getContrastingTextColor = (hex: string) => {
  const value = hex.replace(/^#/, "");
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const luminance =
    (channels[0] * 0.299 + channels[1] * 0.587 + channels[2] * 0.114) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
};

const mixPreviewColors = (primary: string, secondary: string, percentage: number) => {
  const parse = (hex: string) =>
    [0, 2, 4].map((offset) => Number.parseInt(hex.replace(/^#/, "").slice(offset, offset + 2), 16)) as RgbColor;
  const first = parse(primary);
  const second = parse(secondary);
  const weight = clampColor(percentage, 0, 100) / 100;
  return rgbToHex(
    first.map((channel, index) => channel * weight + second[index] * (1 - weight)) as RgbColor,
  );
};

const builderOptionCache = new Map<
  string,
  BuilderPackageOptionDescriptor[]
>();
const builderOptionRequests = new Map<
  string,
  Promise<BuilderPackageOptionDescriptor[]>
>();

const loadBuilderOptions = (builderId: string) => {
  const cached = builderOptionCache.get(builderId);
  if (cached) return Promise.resolve(cached);

  const pending = builderOptionRequests.get(builderId);
  if (pending) return pending;

  const request = listBuilderOptions(builderId)
    .then((options) => {
      builderOptionCache.set(builderId, options);
      return options;
    })
    .finally(() => builderOptionRequests.delete(builderId));
  builderOptionRequests.set(builderId, request);
  return request;
};

const useBuilderOptions = (builderId: string) => {
  const [options, setOptions] = useState<BuilderPackageOptionDescriptor[]>(
    () => builderOptionCache.get(builderId) || [],
  );
  const [loading, setLoading] = useState(
    () => !builderOptionCache.has(builderId),
  );

  useEffect(() => {
    let mounted = true;
    const cached = builderOptionCache.get(builderId);
    if (cached) {
      setOptions(cached);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    void loadBuilderOptions(builderId)
      .then((loaded) => {
        if (mounted) setOptions(loaded);
      })
      .catch((caught) => {
        console.error("Failed to load builder package options:", caught);
        if (mounted) setOptions([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [builderId]);

  return { options, loading };
};

const OptionControlLabel: React.FC<{
  label: React.ReactNode;
  descriptor?: BuilderPackageOptionDescriptor;
}> = ({ label, descriptor }) => (
  <Group gap={4} wrap="nowrap">
    <Text span size="xs">
      {label}
    </Text>
    {descriptor && (
      <Tooltip
        multiline
        w={300}
        label={
          <Stack gap={3}>
            <Text size="xs" fw={700}>
              {descriptor.label} · {descriptor.option}
            </Text>
            <Text size="xs">{descriptor.description}</Text>
          </Stack>
        }
      >
        <ActionIcon
          component="span"
          size={16}
          radius="xl"
          variant="subtle"
          color="gray"
          aria-label={`${descriptor.label}: ${descriptor.description}`}
          tabIndex={0}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          style={{ cursor: "help", flexShrink: 0 }}
        >
          <FontAwesomeIcon icon={faCircleInfo} style={{ width: 11 }} />
        </ActionIcon>
      </Tooltip>
    )}
  </Group>
);

const PackageOptionCatalog: React.FC<{
  builderId: string;
  activePackageId?: string;
  selectedOptions: string[];
  onChangeOptions: (options: string[]) => void;
}> = ({ builderId, activePackageId, selectedOptions, onChangeOptions }) => {
  const { t } = useTranslation();
  const { options, loading } = useBuilderOptions(builderId);

  const visibleOptions = activePackageId
    ? options.filter(
        (option) =>
          option.packageId.toLowerCase() === activePackageId.toLowerCase(),
      )
    : options;
  const actionableOptions = visibleOptions.filter((option) =>
    ["flag", "choice", "dimension", "keyValue", "color"].includes(
      option.valueKind,
    ),
  );

  if (!loading && actionableOptions.length === 0) return null;

  const grouped = actionableOptions.reduce<Record<string, BuilderPackageOptionDescriptor[]>>(
    (groups, option) => {
      const key = option.group || "Options";
      groups[key] = groups[key] || [];
      groups[key].push(option);
      return groups;
    },
    {},
  );

  const optionMatches = (
    value: string,
    descriptor: BuilderPackageOptionDescriptor,
  ) =>
    value === descriptor.option ||
    value.startsWith(`${descriptor.option}=`) ||
    descriptor.choices.some((choice) => value === choice.value);

  const removeMatchingOptions = (
    current: string[],
    descriptors: BuilderPackageOptionDescriptor[],
  ) =>
    current.filter(
      (value) =>
        !descriptors.some((descriptor) => optionMatches(value, descriptor)),
    );

  const setDescriptorValue = (
    descriptor: BuilderPackageOptionDescriptor,
    nextValue: string | null,
  ) => {
    const base = removeMatchingOptions(selectedOptions, [descriptor]);
    const value = (nextValue || "").trim();
    if (!value) {
      onChangeOptions(base);
      return;
    }

    if (descriptor.valueKind === "flag") {
      onChangeOptions([...base, descriptor.option]);
      return;
    }

    const suffix = descriptor.valueKind === "dimension" && descriptor.unit
      ? descriptor.unit
      : "";
    onChangeOptions([...base, `${descriptor.option}=${value}${suffix}`]);
  };

  const getDescriptorValue = (descriptor: BuilderPackageOptionDescriptor) => {
    const match = selectedOptions.find((value) =>
      optionMatches(value, descriptor),
    );
    if (!match) return "";
    if (match === descriptor.option) return "true";
    if (match.includes("=")) {
      const rawValue = match.split("=").slice(1).join("=");
      return descriptor.unit && rawValue.endsWith(descriptor.unit)
        ? rawValue.slice(0, -descriptor.unit.length)
        : rawValue;
    }
    return match;
  };

  return (
    <Paper withBorder p="xs" radius="md">
      <Stack gap={8}>
        <Group justify="space-between">
          <Group gap={6}>
            <FontAwesomeIcon
              icon={faWandMagicSparkles}
              style={{ color: "var(--mantine-color-violet-5)", width: 13 }}
            />
            <Text size="xs" fw={700}>
              {t("packageStudio.optionCatalog.title", {
                defaultValue: "Available package options",
              })}
            </Text>
          </Group>
          {loading && <Loader size="xs" />}
        </Group>

        {Object.entries(grouped).map(([group, groupOptions]) => (
          <Stack key={group} gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              {group}
            </Text>
            {Array.from(
              new Map(
                groupOptions
                  .filter((item) => item.exclusiveGroup)
                  .map((item) => [item.exclusiveGroup, item.exclusiveGroup]),
              ).keys(),
            ).map((exclusiveGroup) => {
              const exclusiveOptions = groupOptions.filter(
                (item) => item.exclusiveGroup === exclusiveGroup,
              );
              const selectedExclusive =
                exclusiveOptions.find((item) =>
                  selectedOptions.includes(item.option),
                )?.option || AUTO_OPTION_VALUE;
              return (
                <Box
                  key={`${group}-${exclusiveGroup}`}
                  px="xs"
                  py={6}
                  style={{
                    border: "1px solid var(--mantine-color-default-border)",
                    borderRadius: "var(--mantine-radius-sm)",
                  }}
                >
                  <Select
                    size="xs"
                    label={
                      <OptionControlLabel
                        label={group}
                        descriptor={
                          exclusiveOptions.find(
                            (item) => item.option === selectedExclusive,
                          ) || exclusiveOptions[0]
                        }
                      />
                    }
                    data={[
                      {
                        value: AUTO_OPTION_VALUE,
                        label: t("packageStudio.optionCatalog.auto", {
                          defaultValue: "Auto",
                        }),
                      },
                      ...exclusiveOptions.map((item) => ({
                        value: item.option,
                        label: item.label.replace(/^Driver:\s*/i, ""),
                      })),
                    ]}
                    value={selectedExclusive}
                    onChange={(value) => {
                      const base = removeMatchingOptions(
                        selectedOptions,
                        exclusiveOptions,
                      );
                      onChangeOptions(
                        value && value !== AUTO_OPTION_VALUE
                          ? [...base, value]
                          : base,
                      );
                    }}
                  />
                </Box>
              );
            })}

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing={5}>
              {groupOptions
                .filter((item) => !item.exclusiveGroup)
                .map((item) => (
                  <Box
                    key={`${item.packageId}-${item.option}`}
                    px="xs"
                    py={6}
                    style={{
                      border: "1px solid var(--mantine-color-default-border)",
                      borderRadius: "var(--mantine-radius-sm)",
                    }}
                  >
                    {item.valueKind === "flag" && (
                      <Switch
                        size="xs"
                        label={
                          <OptionControlLabel
                            label={item.label}
                            descriptor={item}
                          />
                        }
                        checked={selectedOptions.includes(item.option)}
                        onChange={(event) => {
                          const checked = inputChecked(event);
                          setDescriptorValue(item, checked ? "true" : null);
                        }}
                      />
                    )}
                    {item.valueKind === "choice" && (
                      <Select
                        size="xs"
                        label={
                          <OptionControlLabel
                            label={item.label}
                            descriptor={item}
                          />
                        }
                        data={item.choices.map((choice) => ({
                          value: choice.value,
                          label: choice.label,
                        }))}
                        value={getDescriptorValue(item) || null}
                        placeholder={item.defaultValue || undefined}
                        clearable
                        onChange={(value) => setDescriptorValue(item, value)}
                      />
                    )}
                    {item.valueKind === "dimension" && (
                      <NumberInput
                        size="xs"
                        label={
                          <OptionControlLabel
                            label={item.label}
                            descriptor={item}
                          />
                        }
                        suffix={item.unit ? ` ${item.unit}` : undefined}
                        value={Number.parseFloat(getDescriptorValue(item)) || ""}
                        placeholder={item.defaultValue || undefined}
                        onChange={(value) =>
                          setDescriptorValue(
                            item,
                            value === "" ? null : String(value),
                          )
                        }
                      />
                    )}
                    {(item.valueKind === "keyValue" ||
                      item.valueKind === "color") && (
                      <TextInput
                        size="xs"
                        label={
                          <OptionControlLabel
                            label={item.label}
                            descriptor={item}
                          />
                        }
                        value={getDescriptorValue(item)}
                        placeholder={item.defaultValue || undefined}
                        onChange={(event) =>
                          setDescriptorValue(item, inputValue(event))
                        }
                      />
                    )}
                  </Box>
                ))}
            </SimpleGrid>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
};

const buildEnumitemDraftPreview = (
  draft: typeof DEFAULT_ENUMITEM_DRAFT,
) => {
  const name = draft.name.trim() || "questions";
  const baseType =
    draft.inline && ["enumerate", "itemize"].includes(draft.baseType)
      ? `${draft.baseType}*`
      : draft.baseType;
  const options: string[] = [];

  if (draft.baseType !== "description" && draft.label.trim()) {
    options.push(`label=${draft.label.trim()}`);
  }
  if (draft.spacing === "nosep") options.push("nosep");
  if (draft.spacing === "noitemsep") options.push("noitemsep");
  if (draft.spacing === "half") options.push("itemsep=0.5ex");
  if (draft.wide) options.push("wide=0pt");
  if (draft.leftMarginStar) options.push("leftmargin=*");
  const font = `${draft.bold ? "\\bfseries" : ""}${draft.italic ? "\\itshape" : ""}`;
  if (font) options.push(`font=${font}`);
  if (draft.align !== "default") options.push(`align=${draft.align}`);
  if (draft.baseType === "enumerate") {
    if (draft.resume) options.push("resume");
    if (draft.start && draft.start !== 1) options.push(`start=${draft.start}`);
  }

  return `\\newlist{${name}}{${baseType}}{3}\n\\setlist[${name}]{${options.join(", ")}}`;
};

const EnumitemBuilderPanel: React.FC<{
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  activeFilePath,
  activeFileContent,
  analysis,
  onApplyBuilderConfiguration,
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<EnumitemBuilderRequest>(
    DEFAULT_ENUMITEM_REQUEST,
  );
  const [draft, setDraft] = useState(DEFAULT_ENUMITEM_DRAFT);
  const [output, setOutput] = useState<BuilderOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!activeFilePath || !activeFileContent) return;

    void importEnumitem(activeFileContent)
      .then((imported) => {
        if (!mounted) return;
        setRequest(imported);
      })
      .catch((caught) => {
        console.error("Failed to import enumitem setup:", caught);
      });

    return () => {
      mounted = false;
    };
  }, [activeFileContent, activeFilePath]);

  useEffect(() => {
    if (!activeFilePath || !analysis) return;
    const declaration = analysis.declarations.find(
      (item) =>
        (item.kind === "usePackage" || item.kind === "requirePackage") &&
        item.name.toLowerCase() === "enumitem",
    );
    if (!declaration) return;
    setRequest((current) => ({
      ...current,
      inline: declaration.options.some(
        (option) => option.trim().toLowerCase() === "inline",
      ),
    }));
  }, [activeFilePath, analysis]);

  useEffect(() => {
    let mounted = true;

    const build = async () => {
      setLoading(true);
      setError(null);
      try {
        const generated = await generateEnumitem(request);
        if (mounted) setOutput(generated);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to generate enumitem setup:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void build(), 90);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  const addCustomList = () => {
    const name = draft.name.trim();
    if (!/^[A-Za-z]+$/.test(name)) {
      setFormError(
        t("packageStudio.enumitem.invalidName", {
          defaultValue: "Use only letters in the list name.",
        }),
      );
      return;
    }
    if (
      request.customLists.some(
        (list) => list.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setFormError(
        t("packageStudio.enumitem.duplicateName", {
          defaultValue: "A custom list with this name already exists.",
        }),
      );
      return;
    }

    setRequest((current) => ({
      ...current,
      inline:
        current.inline ||
        (draft.inline && ["enumerate", "itemize"].includes(draft.baseType)),
      customLists: [
        ...current.customLists,
        {
          name,
          baseType: draft.baseType,
          inline: draft.inline,
          label: draft.baseType === "description" ? "" : draft.label,
          spacing: draft.spacing,
          wide: draft.wide,
          leftMarginStar: draft.leftMarginStar,
          bold: draft.bold,
          italic: draft.italic,
          align: draft.align,
          resume: draft.resume,
          start: draft.start,
        },
      ],
    }));
    setDraft(DEFAULT_ENUMITEM_DRAFT);
    setFormError(null);
  };

  const removeCustomList = (name: string) => {
    setRequest((current) => ({
      ...current,
      customLists: current.customLists.filter((list) => list.name !== name),
    }));
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="indigo">
                <FontAwesomeIcon icon={faListOl} />
              </ThemeIcon>
              <Text fw={700}>
                {t("packageStudio.enumitem.title", {
                  defaultValue: "Enumitem list builder",
                })}
              </Text>
              {loading && <Loader size="xs" />}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {t("packageStudio.enumitem.description", {
                defaultValue:
                  "Configure list spacing, labels, inline lists, and reusable custom environments.",
              })}
            </Text>
          </Box>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            onClick={() => {
              setRequest(DEFAULT_ENUMITEM_REQUEST);
              setDraft(DEFAULT_ENUMITEM_DRAFT);
              setFormError(null);
            }}
          >
            {t("packageStudio.reset", { defaultValue: "Reset" })}
          </Button>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <BuilderActivationBar
          builderId="enumitem"
          managedPackageIds={["enumitem"]}
          output={output}
          generatedBlocks={[
            { blockId: "enumitem-setup", code: output?.code || "" },
          ]}
          activeFilePath={activeFilePath}
          analysis={analysis}
          loading={loading}
          onApply={onApplyBuilderConfiguration}
        />

        <Group align="stretch" gap="md">
          <Box style={{ flex: 1.1, minWidth: 420 }}>
            <Stack gap="md">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs">
                    <Box>
                      <Text size="sm" fw={700}>
                        {t("packageStudio.enumitem.globalSettings", {
                          defaultValue: "Global list settings",
                        })}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t("packageStudio.enumitem.globalHint", {
                          defaultValue:
                            "These settings apply to standard itemize/enumerate lists.",
                        })}
                      </Text>
                    </Box>
                    <Switch
                      size="xs"
                      label={t("packageStudio.enumitem.inline", {
                        defaultValue: "Inline lists",
                      })}
                      checked={request.inline}
                      onChange={(event) => {
                        const checked = inputChecked(event);
                        setRequest((current) => ({
                          ...current,
                          inline: checked,
                        }));
                      }}
                    />
                  </Group>
                  <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                    <Select
                      size="xs"
                      label={t("packageStudio.enumitem.spacing", {
                        defaultValue: "Spacing",
                      })}
                      data={ENUMITEM_SPACING_OPTIONS}
                      value={request.globalSpacing}
                      onChange={(value) =>
                        setRequest((current) => ({
                          ...current,
                          globalSpacing: value || "default",
                        }))
                      }
                    />
                    <Select
                      size="xs"
                      label={t("packageStudio.enumitem.itemize", {
                        defaultValue: "Itemize label",
                      })}
                      data={ENUMITEM_ITEMIZE_LABELS}
                      value={request.itemizeLabel}
                      onChange={(value) =>
                        setRequest((current) => ({
                          ...current,
                          itemizeLabel: value || "default",
                        }))
                      }
                    />
                    <Select
                      size="xs"
                      label={t("packageStudio.enumitem.enumerate", {
                        defaultValue: "Enumerate label",
                      })}
                      data={ENUMITEM_ENUMERATE_LABELS}
                      value={request.enumerateLabel}
                      onChange={(value) =>
                        setRequest((current) => ({
                          ...current,
                          enumerateLabel: value || "default",
                        }))
                      }
                    />
                  </SimpleGrid>
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs">
                    <Box>
                      <Text size="sm" fw={700}>
                        {t("packageStudio.enumitem.customList", {
                          defaultValue: "Custom list creator",
                        })}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t("packageStudio.enumitem.customListHint", {
                          defaultValue:
                            "Create named environments like questions, tasks, or steps.",
                        })}
                      </Text>
                    </Box>
                    <Badge size="xs" variant="light" color="indigo">
                      \newlist
                    </Badge>
                  </Group>

                  {formError && (
                    <Alert color="yellow" variant="light">
                      {formError}
                    </Alert>
                  )}

                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                    <TextInput
                      size="xs"
                      label={t("packageStudio.enumitem.listName", {
                        defaultValue: "List name",
                      })}
                      placeholder="questions"
                      value={draft.name}
                      onChange={(event) => {
                        const value = inputValue(event).replace(
                          /[^A-Za-z]/g,
                          "",
                        );
                        setDraft((current) => ({
                          ...current,
                          name: value,
                        }));
                      }}
                    />
                    <Select
                      size="xs"
                      label={t("packageStudio.enumitem.baseType", {
                        defaultValue: "Base type",
                      })}
                      data={[
                        { value: "enumerate", label: "Enumerate" },
                        { value: "itemize", label: "Itemize" },
                        { value: "description", label: "Description" },
                      ]}
                      value={draft.baseType}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          baseType: value || "enumerate",
                          label:
                            value === "itemize" ? "\\bullet" : "\\arabic*.",
                        }))
                      }
                    />
                  </SimpleGrid>

                  {draft.baseType !== "description" && (
                    <Stack gap={6}>
                      <Group gap={5} wrap="wrap">
                        {(draft.baseType === "enumerate"
                          ? ENUMITEM_CUSTOM_ENUM_LABELS
                          : ENUMITEM_CUSTOM_ITEMIZE_LABELS
                        ).map((preset) => (
                          <Button
                            key={preset.value}
                            size="compact-xs"
                            variant={
                              draft.label === preset.value ? "light" : "default"
                            }
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                label: preset.value,
                              }))
                            }
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </Group>
                      <TextInput
                        size="xs"
                        label={t("packageStudio.enumitem.labelPattern", {
                          defaultValue: "Label pattern",
                        })}
                        value={draft.label}
                        onChange={(event) => {
                          const value = inputValue(event);
                          setDraft((current) => ({
                            ...current,
                            label: value,
                          }));
                        }}
                      />
                    </Stack>
                  )}

                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                    <Select
                      size="xs"
                      label={t("packageStudio.enumitem.listSpacing", {
                        defaultValue: "List spacing",
                      })}
                      data={ENUMITEM_SPACING_OPTIONS}
                      value={draft.spacing}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          spacing: value || "default",
                        }))
                      }
                    />
                    <Select
                      size="xs"
                      label={t("packageStudio.enumitem.align", {
                        defaultValue: "Label alignment",
                      })}
                      data={[
                        { value: "default", label: "Default" },
                        { value: "left", label: "Left" },
                        { value: "parleft", label: "Parbox left" },
                      ]}
                      value={draft.align}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          align: value || "default",
                        }))
                      }
                    />
                  </SimpleGrid>

                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                    <Switch
                      size="xs"
                      label={t("packageStudio.enumitem.inlineCustom", {
                        defaultValue: "Inline environment",
                      })}
                      checked={draft.inline}
                      disabled={draft.baseType === "description"}
                      onChange={(event) => {
                        const checked = inputChecked(event);
                        setDraft((current) => ({
                          ...current,
                          inline: checked,
                        }));
                      }}
                    />
                    <Switch
                      size="xs"
                      label="wide=0pt"
                      checked={draft.wide}
                      onChange={(event) => {
                        const checked = inputChecked(event);
                        setDraft((current) => ({
                          ...current,
                          wide: checked,
                        }));
                      }}
                    />
                    <Switch
                      size="xs"
                      label="leftmargin=*"
                      checked={draft.leftMarginStar}
                      onChange={(event) => {
                        const checked = inputChecked(event);
                        setDraft((current) => ({
                          ...current,
                          leftMarginStar: checked,
                        }));
                      }}
                    />
                    <Group gap="xs" wrap="nowrap">
                      <Tooltip label="Bold label">
                        <ActionIcon
                          size="sm"
                          variant={draft.bold ? "filled" : "default"}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              bold: !current.bold,
                            }))
                          }
                        >
                          <FontAwesomeIcon icon={faBold} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Italic label">
                        <ActionIcon
                          size="sm"
                          variant={draft.italic ? "filled" : "default"}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              italic: !current.italic,
                            }))
                          }
                        >
                          <FontAwesomeIcon icon={faItalic} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </SimpleGrid>

                  {draft.baseType === "enumerate" && (
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                      <Switch
                        size="xs"
                        label={t("packageStudio.enumitem.resume", {
                          defaultValue: "Resume numbering",
                        })}
                        checked={draft.resume}
                        onChange={(event) => {
                          const checked = inputChecked(event);
                          setDraft((current) => ({
                            ...current,
                            resume: checked,
                          }));
                        }}
                      />
                      <NumberInput
                        size="xs"
                        label={t("packageStudio.enumitem.start", {
                          defaultValue: "Start value",
                        })}
                        min={1}
                        value={draft.start ?? ""}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            start:
                              value === "" ? null : Number.parseInt(String(value), 10),
                          }))
                        }
                      />
                    </SimpleGrid>
                  )}

                  <Button
                    size="xs"
                    leftSection={<FontAwesomeIcon icon={faPlus} />}
                    onClick={addCustomList}
                  >
                    {t("packageStudio.enumitem.addList", {
                      defaultValue: "Add custom list",
                    })}
                  </Button>
                </Stack>
              </Paper>
            </Stack>
          </Box>

          <Box style={{ width: 390, minWidth: 330 }}>
            <Stack gap="md">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Text size="sm" fw={700}>
                    {t("packageStudio.enumitem.preview", {
                      defaultValue: "New list preview",
                    })}
                  </Text>
                  <Textarea
                    readOnly
                    autosize
                    minRows={4}
                    value={buildEnumitemDraftPreview(draft)}
                    styles={{
                      input: {
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                      },
                    }}
                  />
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.enumitem.activeLists", {
                        defaultValue: "Custom lists",
                      })}
                    </Text>
                    <Badge size="xs" variant="light" color="indigo">
                      {request.customLists.length}
                    </Badge>
                  </Group>
                  {request.customLists.length === 0 ? (
                    <Text size="xs" c="dimmed">
                      {t("packageStudio.enumitem.noLists", {
                        defaultValue: "No custom lists defined yet.",
                      })}
                    </Text>
                  ) : (
                    <Stack gap={6}>
                      {request.customLists.map((list) => (
                        <Box
                          key={list.name}
                          px="xs"
                          py={7}
                          style={{
                            border:
                              "1px solid var(--mantine-color-default-border)",
                            borderRadius: "var(--mantine-radius-sm)",
                          }}
                        >
                          <Group justify="space-between" gap="xs" wrap="nowrap">
                            <Box style={{ minWidth: 0 }}>
                              <Text size="xs" fw={700} truncate>
                                {list.name}
                              </Text>
                              <Text size="xs" c="dimmed" truncate>
                                {list.baseType}
                                {list.inline ? "*" : ""} · {list.spacing}
                              </Text>
                            </Box>
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              aria-label={t("packageStudio.enumitem.removeList", {
                                defaultValue: "Remove custom list",
                              })}
                              onClick={() => removeCustomList(list.name)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </ActionIcon>
                          </Group>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.generatedCode", {
                        defaultValue: "Generated code",
                      })}
                    </Text>
                    <Badge size="xs" variant="light" color="indigo">
                      Rust
                    </Badge>
                  </Group>
                  <Textarea
                    readOnly
                    autosize
                    minRows={8}
                    maxRows={16}
                    value={output?.code || ""}
                    styles={{
                      input: {
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                      },
                    }}
                  />
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
};

const FancyhdrBuilderPanel: React.FC<{
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  activeFilePath,
  activeFileContent,
  analysis,
  onApplyBuilderConfiguration,
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<FancyhdrBuilderRequest>(
    DEFAULT_FANCYHDR_REQUEST,
  );
  const [output, setOutput] = useState<BuilderOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTextKey, setActiveTextKey] =
    useState<FancyhdrTextKey>("headerOddRight");
  const [customOptionDraft, setCustomOptionDraft] = useState("");
  const [previewMode, setPreviewMode] = useState<"visual" | "code">("visual");
  const [previewZoom, setPreviewZoom] = useState(100);
  const twoSide = request.documentType === "twoside";

  useEffect(() => {
    if (!activeFilePath || !activeFileContent) return;
    let mounted = true;
    void importFancyhdr(activeFileContent)
      .then((imported) => {
        if (!mounted) return;
        setRequest((current) => ({
          ...current,
          ...imported,
          packageOptions:
            imported.packageOptions.length > 0
              ? imported.packageOptions
              : current.packageOptions,
        }));
      })
      .catch((caught) => {
        console.error("Failed to import fancyhdr setup:", caught);
      });
    return () => {
      mounted = false;
    };
  }, [activeFilePath, activeFileContent]);

  useEffect(() => {
    if (!activeFilePath || !analysis || activeFileContent) return;
    const declaration = analysis.declarations.find(
      (item) =>
        (item.kind === "usePackage" || item.kind === "requirePackage") &&
        item.name.toLowerCase() === "fancyhdr",
    );
    if (!declaration) return;
    setRequest((current) => ({
      ...current,
      packageOptions: declaration.options,
    }));
  }, [activeFilePath, analysis]);

  useEffect(() => {
    let mounted = true;

    const build = async () => {
      setLoading(true);
      setError(null);
      try {
        const generated = await generateFancyhdr(request);
        if (mounted) setOutput(generated);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to generate fancyhdr setup:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void build(), 90);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  const updateText = (key: FancyhdrTextKey) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = inputValue(event);
    setRequest((current) => ({ ...current, [key]: value }));
  };

  const updateRule =
    (key: "headRuleWidth" | "footRuleWidth") => (value: string | number) => {
      const numeric =
        typeof value === "number" ? value : Number.parseFloat(value);
      setRequest((current) => ({
        ...current,
        [key]: Number.isFinite(numeric) ? numeric : current[key],
      }));
    };

  const applyPreset = (preset: (typeof FANCYHDR_PRESETS)[number]) => {
    setRequest((current) => ({
      ...preset.request,
      packageOptions: Array.from(
        new Set([...current.packageOptions, ...preset.request.packageOptions]),
      ),
    }));
    setActiveTextKey("headerOddRight");
  };

  const insertCommandIntoActiveField = (command: string) => {
    setRequest((current) => {
      const existing = current[activeTextKey] || "";
      const separator = existing.trim().length > 0 ? " " : "";
      return {
        ...current,
        [activeTextKey]: `${existing}${separator}${command}`,
      };
    });
  };

  const addCustomPackageOption = () => {
    const value = customOptionDraft.trim();
    if (!value || request.packageOptions.includes(value)) return;
    setRequest((current) => ({
      ...current,
      packageOptions: [...current.packageOptions, value],
    }));
    setCustomOptionDraft("");
  };

  const removePackageOption = (option: string) => {
    setRequest((current) => ({
      ...current,
      packageOptions: current.packageOptions.filter((item) => item !== option),
    }));
  };

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="indigo">
                <FontAwesomeIcon icon={faFileLines} />
              </ThemeIcon>
              <Text fw={700}>
                {t("packageStudio.fancyhdr.title", {
                  defaultValue: "Fancyhdr builder",
                })}
              </Text>
              {loading && <Loader size="xs" />}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {t("packageStudio.fancyhdr.description", {
                defaultValue:
                  "Configure headers, footers, page style, and rule widths.",
              })}
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setRequest(DEFAULT_FANCYHDR_REQUEST)}
            >
              {t("packageStudio.reset", { defaultValue: "Reset" })}
            </Button>
          </Group>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <BuilderActivationBar
          builderId="fancyhdr"
          managedPackageIds={["fancyhdr"]}
          output={output}
          generatedBlocks={[
            { blockId: "fancyhdr-setup", code: output?.code || "" },
          ]}
          activeFilePath={activeFilePath}
          analysis={analysis}
          loading={loading}
          onApply={onApplyBuilderConfiguration}
        />

        <Group align="stretch" gap="md">
          <Box style={{ flex: 1.1, minWidth: 430 }}>
            <Stack gap="md">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between" gap="xs">
                    <Box>
                      <Text size="sm" fw={700}>
                        {t("packageStudio.fancyhdr.presets", {
                          defaultValue: "Layout presets",
                        })}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t("packageStudio.fancyhdr.presetsHint", {
                          defaultValue:
                            "Start from a common page-style pattern, then adjust fields below.",
                        })}
                      </Text>
                    </Box>
                    <Badge size="xs" variant="light" color="indigo">
                      {FANCYHDR_PRESETS.length} presets
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                    {FANCYHDR_PRESETS.map((preset) => (
                      <Button
                        key={preset.id}
                        variant="default"
                        size="xs"
                        justify="flex-start"
                        onClick={() => applyPreset(preset)}
                        styles={{
                          inner: { justifyContent: "flex-start" },
                          label: { width: "100%" },
                        }}
                      >
                        <Box ta="left">
                          <Text size="xs" fw={700}>
                            {preset.label}
                          </Text>
                          <Text size="xs" c="dimmed" fw={400} truncate>
                            {preset.description}
                          </Text>
                        </Box>
                      </Button>
                    ))}
                  </SimpleGrid>
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
                  <Select
                    size="xs"
                    label={t("packageStudio.fancyhdr.documentType", {
                      defaultValue: "Document type",
                    })}
                    data={[
                      { value: "oneside", label: "One side" },
                      { value: "twoside", label: "Two side" },
                    ]}
                    value={request.documentType}
                    onChange={(value) =>
                      setRequest((current) => ({
                        ...current,
                        documentType: value || "oneside",
                      }))
                    }
                  />
                  <TextInput
                    size="xs"
                    label={t("packageStudio.fancyhdr.pageStyle", {
                      defaultValue: "Page style",
                    })}
                    value={request.pageStyle}
                    onChange={(event) => {
                      const value = inputValue(event);
                      setRequest((current) => ({
                        ...current,
                        pageStyle: value,
                      }));
                    }}
                  />
                  <Switch
                    mt={24}
                    label={t("packageStudio.fancyhdr.clearFields", {
                      defaultValue: "Clear header/footer fields",
                    })}
                    checked={request.clearFields}
                    onChange={(event) => {
                      const checked = inputChecked(event);
                      setRequest((current) => ({
                        ...current,
                        clearFields: checked,
                      }));
                    }}
                  />
                </SimpleGrid>
              </Paper>

              <PackageOptionCatalog
                builderId="fancyhdr"
                selectedOptions={request.packageOptions}
                onChangeOptions={(packageOptions) =>
                  setRequest((current) => ({
                    ...current,
                    packageOptions,
                  }))
                }
              />

              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between" gap="xs">
                    <Box>
                      <Text size="sm" fw={700}>
                        {t("packageStudio.fancyhdr.customOptions", {
                          defaultValue: "Advanced package options",
                        })}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t("packageStudio.fancyhdr.customOptionsHint", {
                          defaultValue:
                            "Add rare fancyhdr options without leaving the visual builder.",
                        })}
                      </Text>
                    </Box>
                    <Badge size="xs" variant="light" color="gray">
                      {request.packageOptions.length}
                    </Badge>
                  </Group>
                  <Group gap="xs" align="flex-end">
                    <TextInput
                      size="xs"
                      label={t("packageStudio.fancyhdr.customOption", {
                        defaultValue: "Custom option",
                      })}
                      placeholder="nocheck"
                      value={customOptionDraft}
                      onChange={(event) =>
                        setCustomOptionDraft(inputValue(event))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomPackageOption();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      size="xs"
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                      onClick={addCustomPackageOption}
                    >
                      {t("packageStudio.add", { defaultValue: "Add" })}
                    </Button>
                  </Group>
                  {request.packageOptions.length > 0 && (
                    <Group gap={6}>
                      {request.packageOptions.map((option) => (
                        <Badge
                          key={option}
                          variant="outline"
                          color="gray"
                          rightSection={
                            <ActionIcon
                              size={14}
                              variant="transparent"
                              color="gray"
                              aria-label={`Remove ${option}`}
                              onClick={() => removePackageOption(option)}
                            >
                              <FontAwesomeIcon icon={faXmark} />
                            </ActionIcon>
                          }
                        >
                          {option}
                        </Badge>
                      ))}
                    </Group>
                  )}
                </Stack>
              </Paper>

              <HeaderFooterGrid
                title={t("packageStudio.fancyhdr.oddPage", {
                  defaultValue: "Odd / one-sided page",
                })}
                activeField={activeTextKey}
                fieldKeys={{
                  headerLeft: "headerOddLeft",
                  headerCenter: "headerOddCenter",
                  headerRight: "headerOddRight",
                  footerLeft: "footerOddLeft",
                  footerCenter: "footerOddCenter",
                  footerRight: "footerOddRight",
                }}
                headerLeft={request.headerOddLeft}
                headerCenter={request.headerOddCenter}
                headerRight={request.headerOddRight}
                footerLeft={request.footerOddLeft}
                footerCenter={request.footerOddCenter}
                footerRight={request.footerOddRight}
                onHeaderLeft={updateText("headerOddLeft")}
                onHeaderCenter={updateText("headerOddCenter")}
                onHeaderRight={updateText("headerOddRight")}
                onFooterLeft={updateText("footerOddLeft")}
                onFooterCenter={updateText("footerOddCenter")}
                onFooterRight={updateText("footerOddRight")}
                onFieldFocus={setActiveTextKey}
                onInsertCommand={insertCommandIntoActiveField}
              />

              {twoSide && (
                <HeaderFooterGrid
                  title={t("packageStudio.fancyhdr.evenPage", {
                    defaultValue: "Even page",
                  })}
                  activeField={activeTextKey}
                  fieldKeys={{
                    headerLeft: "headerEvenLeft",
                    headerCenter: "headerEvenCenter",
                    headerRight: "headerEvenRight",
                    footerLeft: "footerEvenLeft",
                    footerCenter: "footerEvenCenter",
                    footerRight: "footerEvenRight",
                  }}
                  headerLeft={request.headerEvenLeft}
                  headerCenter={request.headerEvenCenter}
                  headerRight={request.headerEvenRight}
                  footerLeft={request.footerEvenLeft}
                  footerCenter={request.footerEvenCenter}
                  footerRight={request.footerEvenRight}
                  onHeaderLeft={updateText("headerEvenLeft")}
                  onHeaderCenter={updateText("headerEvenCenter")}
                  onHeaderRight={updateText("headerEvenRight")}
                  onFooterLeft={updateText("footerEvenLeft")}
                  onFooterCenter={updateText("footerEvenCenter")}
                  onFooterRight={updateText("footerEvenRight")}
                  onFieldFocus={setActiveTextKey}
                  onInsertCommand={insertCommandIntoActiveField}
                />
              )}

              <Paper withBorder p="sm" radius="md">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                  <NumberInput
                    size="xs"
                    label={t("packageStudio.fancyhdr.headRule", {
                      defaultValue: "Header rule width (pt)",
                    })}
                    min={0}
                    step={0.1}
                    value={request.headRuleWidth}
                    onChange={updateRule("headRuleWidth")}
                  />
                  <NumberInput
                    size="xs"
                    label={t("packageStudio.fancyhdr.footRule", {
                      defaultValue: "Footer rule width (pt)",
                    })}
                    min={0}
                    step={0.1}
                    value={request.footRuleWidth}
                    onChange={updateRule("footRuleWidth")}
                  />
                </SimpleGrid>
              </Paper>
            </Stack>
          </Box>

          <Box style={{ width: 390, minWidth: 330 }}>
            <Stack gap="md" h="100%">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Group gap={6}>
                      <Button
                        size="xs"
                        variant={previewMode === "visual" ? "filled" : "default"}
                        onClick={() => setPreviewMode("visual")}
                      >
                        {t("packageStudio.fancyhdr.visual", {
                          defaultValue: "Visual",
                        })}
                      </Button>
                      <Button
                        size="xs"
                        variant={previewMode === "code" ? "filled" : "default"}
                        onClick={() => setPreviewMode("code")}
                      >
                        {t("packageStudio.generatedCode", {
                          defaultValue: "Generated code",
                        })}
                      </Button>
                    </Group>
                    <Badge size="xs" variant="light" color="indigo">
                      Rust
                    </Badge>
                  </Group>
                  {previewMode === "visual" ? (
                    <>
                      <Group gap="xs" justify="space-between">
                        <Text size="xs" c="dimmed">
                          {t("packageStudio.fancyhdr.previewZoom", {
                            defaultValue: "Preview zoom",
                          })}
                        </Text>
                        <Group gap={4}>
                          {[80, 100, 120].map((zoom) => (
                            <Button
                              key={zoom}
                              size="compact-xs"
                              variant={previewZoom === zoom ? "filled" : "default"}
                              onClick={() => setPreviewZoom(zoom)}
                            >
                              {zoom}%
                            </Button>
                          ))}
                        </Group>
                      </Group>
                      <FancyhdrPreview request={request} zoom={previewZoom} />
                    </>
                  ) : (
                    <Textarea
                      readOnly
                      autosize
                      minRows={16}
                      maxRows={22}
                      value={output?.code || ""}
                      styles={{
                        input: {
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          fontSize: 12,
                        },
                      }}
                    />
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
};

const HeaderFooterGrid: React.FC<{
  title: string;
  activeField: FancyhdrTextKey;
  fieldKeys: {
    headerLeft: FancyhdrTextKey;
    headerCenter: FancyhdrTextKey;
    headerRight: FancyhdrTextKey;
    footerLeft: FancyhdrTextKey;
    footerCenter: FancyhdrTextKey;
    footerRight: FancyhdrTextKey;
  };
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  onHeaderLeft: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onHeaderCenter: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onHeaderRight: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFooterLeft: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFooterCenter: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFooterRight: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFieldFocus: (key: FancyhdrTextKey) => void;
  onInsertCommand: (command: string) => void;
}> = ({
  title,
  activeField,
  fieldKeys,
  headerLeft,
  headerCenter,
  headerRight,
  footerLeft,
  footerCenter,
  footerRight,
  onHeaderLeft,
  onHeaderCenter,
  onHeaderRight,
  onFooterLeft,
  onFooterCenter,
  onFooterRight,
  onFieldFocus,
  onInsertCommand,
}) => {
  const { t } = useTranslation();
  const activeLabel = Object.entries(fieldKeys).find(
    ([, key]) => key === activeField,
  )?.[0];

  return (
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" gap="xs">
          <Box>
            <Text size="sm" fw={700}>
              {title}
            </Text>
            <Text size="xs" c="dimmed">
              {t("packageStudio.fancyhdr.quickCommandHint", {
                defaultValue:
                  "Focus a field, then insert common fancyhdr commands.",
              })}
            </Text>
          </Box>
          <Badge size="xs" variant="light" color="indigo">
            {activeLabel || "field"}
          </Badge>
        </Group>
        <Group gap={5}>
          {FANCYHDR_COMMAND_CHIPS.map((command) => (
            <Button
              key={command.value}
              size="compact-xs"
              variant="default"
              onClick={() => onInsertCommand(command.value)}
            >
              {command.label}
            </Button>
          ))}
        </Group>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xs">
          <TextInput
            size="xs"
            label={t("packageStudio.fancyhdr.headerLeft", {
              defaultValue: "Header left",
            })}
            value={headerLeft}
            onChange={onHeaderLeft}
            onFocus={() => onFieldFocus(fieldKeys.headerLeft)}
          />
          <TextInput
            size="xs"
            label={t("packageStudio.fancyhdr.headerCenter", {
              defaultValue: "Header center",
            })}
            value={headerCenter}
            onChange={onHeaderCenter}
            onFocus={() => onFieldFocus(fieldKeys.headerCenter)}
          />
          <TextInput
            size="xs"
            label={t("packageStudio.fancyhdr.headerRight", {
              defaultValue: "Header right",
            })}
            value={headerRight}
            onChange={onHeaderRight}
            onFocus={() => onFieldFocus(fieldKeys.headerRight)}
          />
          <TextInput
            size="xs"
            label={t("packageStudio.fancyhdr.footerLeft", {
              defaultValue: "Footer left",
            })}
            value={footerLeft}
            onChange={onFooterLeft}
            onFocus={() => onFieldFocus(fieldKeys.footerLeft)}
          />
          <TextInput
            size="xs"
            label={t("packageStudio.fancyhdr.footerCenter", {
              defaultValue: "Footer center",
            })}
            value={footerCenter}
            onChange={onFooterCenter}
            onFocus={() => onFieldFocus(fieldKeys.footerCenter)}
          />
          <TextInput
            size="xs"
            label={t("packageStudio.fancyhdr.footerRight", {
              defaultValue: "Footer right",
            })}
            value={footerRight}
            onChange={onFooterRight}
            onFocus={() => onFieldFocus(fieldKeys.footerRight)}
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
};

const FancyhdrPreview: React.FC<{
  request: FancyhdrBuilderRequest;
  zoom: number;
}> = ({ request, zoom }) => {
  const { t } = useTranslation();
  const display = (value: string, fallback: string) =>
    value
      .replace(/\\thepage/g, "7")
      .replace(/\\leftmark/g, "Chapter")
      .replace(/\\rightmark/g, "Section")
      .replace(/\\today/g, "21/7/2026")
      .replace(/\\@author/g, "Author")
      .replace(/\\@title/g, "Title")
      .trim() ||
    fallback;
  const scale = zoom / 100;

  return (
    <Box>
      <Stack gap="xs">
        <Box
          style={{
            height: 270,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "var(--mantine-color-dark-7)",
            borderRadius: 8,
          }}
        >
          <Box
            style={{
              width: 170,
              height: 235,
              transform: `scale(${scale})`,
              transformOrigin: "center",
              background: "var(--mantine-color-gray-0)",
              color: "var(--mantine-color-dark-8)",
              borderRadius: 4,
              boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
              padding: 18,
              display: "grid",
              gridTemplateRows: "30px 1fr 30px",
              gap: 8,
              fontFamily: "serif",
              fontSize: 10,
            }}
          >
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                alignItems: "end",
                borderBottom:
                  request.headRuleWidth > 0
                    ? "1px solid var(--mantine-color-dark-8)"
                    : "none",
                gap: 4,
              }}
            >
              <Text size="xs" truncate>
                {display(request.headerOddLeft, "—")}
              </Text>
              <Text size="xs" ta="center" truncate>
                {display(request.headerOddCenter, "—")}
              </Text>
              <Text size="xs" ta="right" truncate>
                {display(request.headerOddRight, "—")}
              </Text>
            </Box>
            <Box
              style={{
                border: "1px dashed rgba(0,0,0,0.18)",
                borderRadius: 3,
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.02))",
              }}
            />
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                alignItems: "start",
                borderTop:
                  request.footRuleWidth > 0
                    ? "1px solid var(--mantine-color-dark-8)"
                    : "none",
                gap: 4,
              }}
            >
              <Text size="xs" truncate>
                {display(request.footerOddLeft, "—")}
              </Text>
              <Text size="xs" ta="center" truncate>
                {display(request.footerOddCenter, "—")}
              </Text>
              <Text size="xs" ta="right" truncate>
                {display(request.footerOddRight, "—")}
              </Text>
            </Box>
          </Box>
        </Box>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {t("packageStudio.fancyhdr.preview", {
              defaultValue: "Page style preview",
            })}
          </Text>
          <Badge size="xs" variant="light" color="indigo">
            {request.documentType}
          </Badge>
        </Group>
      </Stack>
    </Box>
  );
};

const XcolorBuilderPanel: React.FC<{
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  onInsertCode: (code: string) => void;
  onApplyBuilderConfiguration: (configuration: BuilderConfigurationDraft) => void;
}> = ({
  activeFilePath,
  activeFileContent,
  analysis,
  onInsertCode,
  onApplyBuilderConfiguration,
}) => {
  const { t } = useTranslation();
  const [request, setRequest] = useState<XcolorBuilderRequest>(
    DEFAULT_XCOLOR_REQUEST,
  );
  const [output, setOutput] = useState<BuilderOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newColor, setNewColor] = useState({
    name: "",
    model: "HTML",
    value: "1C7ED6",
  });
  const [colorFormError, setColorFormError] = useState<string | null>(null);
  const [newAlias, setNewAlias] = useState({
    name: "",
    primary: "blue",
    percentage: 50,
    secondary: "white",
  });
  const [aliasFormError, setAliasFormError] = useState<string | null>(null);
  const [snippetType, setSnippetType] = useState("textcolor");
  const [snippetColor, setSnippetColor] = useState("datatexPrimary");
  const [snippetFrameColor, setSnippetFrameColor] = useState("black");
  const [snippetText, setSnippetText] = useState("Sample text");

  useEffect(() => {
    if (!activeFilePath || !activeFileContent) return;
    let mounted = true;
    void importXcolor(activeFileContent)
      .then((imported) => {
        if (!mounted) return;
        const hasImportedPalette =
          imported.colors.length > 0 || imported.aliases.length > 0;
        setRequest((current) => ({
          ...current,
          packageOptions:
            imported.packageOptions.length > 0
              ? imported.packageOptions
              : current.packageOptions,
          colors: hasImportedPalette ? imported.colors : current.colors,
          aliases: hasImportedPalette ? imported.aliases : current.aliases,
        }));
      })
      .catch((caught) => {
        console.error("Failed to import xcolor palette:", caught);
      });
    return () => {
      mounted = false;
    };
  }, [activeFilePath, activeFileContent]);

  useEffect(() => {
    if (!activeFilePath || !analysis || activeFileContent) return;
    const declaration = analysis.declarations.find(
      (item) =>
        (item.kind === "usePackage" || item.kind === "requirePackage") &&
        item.name.toLowerCase() === "xcolor",
    );
    if (!declaration) return;
    setRequest((current) => ({
      ...current,
      packageOptions: declaration.options,
    }));
  }, [activeFilePath, analysis]);

  useEffect(() => {
    let mounted = true;

    const build = async () => {
      setLoading(true);
      setError(null);
      try {
        const generated = await generateXcolor(request);
        if (mounted) setOutput(generated);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to generate xcolor palette:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timeoutId = window.setTimeout(() => void build(), 90);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [request]);

  const updateColor = (
    index: number,
    patch: Partial<XcolorBuilderRequest["colors"][number]>,
  ) => {
    setRequest((current) => ({
      ...current,
      colors: current.colors.map((color, colorIndex) =>
        colorIndex === index ? { ...color, ...patch } : color,
      ),
    }));
  };

  const removeColor = (index: number) => {
    setRequest((current) => ({
      ...current,
      colors: current.colors.filter((_, colorIndex) => colorIndex !== index),
    }));
  };

  const duplicateColor = (index: number) => {
    setRequest((current) => {
      const source = current.colors[index];
      if (!source) return current;
      const used = new Set([
        ...current.colors.map((color) => color.name),
        ...current.aliases.map((alias) => alias.name),
      ]);
      const stem = `${source.name || "color"}Copy`;
      let name = stem;
      let suffix = 2;
      while (used.has(name)) {
        name = `${stem}${suffix}`;
        suffix += 1;
      }
      return {
        ...current,
        colors: [...current.colors, { ...source, name }],
      };
    });
  };

  const addColor = () => {
    const name = newColor.name.trim();
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      setColorFormError(
        t("packageStudio.xcolor.invalidName", {
          defaultValue: "Use only letters, numbers, and underscores in the color name.",
        }),
      );
      return;
    }
    if (
      request.colors.some((color) => color.name === name) ||
      request.aliases.some((alias) => alias.name === name)
    ) {
      setColorFormError(
        t("packageStudio.xcolor.duplicateName", {
          defaultValue: "A color or mix with this name already exists.",
        }),
      );
      return;
    }
    if (!getXcolorPreviewColor(newColor)) {
      setColorFormError(
        t("packageStudio.xcolor.invalidValue", {
          defaultValue: "The value is not valid for the selected color model.",
        }),
      );
      return;
    }
    setRequest((current) => ({
      ...current,
      colors: [...current.colors, { ...newColor, name }],
    }));
    setNewColor((current) => ({ ...current, name: "" }));
    setColorFormError(null);
  };

  const addAlias = () => {
    const name = newAlias.name.trim();
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
      setAliasFormError(
        t("packageStudio.xcolor.invalidName", {
          defaultValue: "Use only letters, numbers, and underscores in the color name.",
        }),
      );
      return;
    }
    if (
      request.colors.some((color) => color.name === name) ||
      request.aliases.some((alias) => alias.name === name)
    ) {
      setAliasFormError(
        t("packageStudio.xcolor.duplicateName", {
          defaultValue: "A color or mix with this name already exists.",
        }),
      );
      return;
    }
    setRequest((current) => ({
      ...current,
      aliases: [...current.aliases, { ...newAlias, name }],
    }));
    setNewAlias((current) => ({ ...current, name: "" }));
    setAliasFormError(null);
  };

  const colorChoices = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(STANDARD_XCOLOR_PREVIEWS),
          ...request.colors.map((color) => color.name).filter(Boolean),
          ...request.aliases.map((alias) => alias.name).filter(Boolean),
        ]),
      ).map((name) => ({ value: name, label: name })),
    [request.aliases, request.colors],
  );

  const aliasPreviews = useMemo(() => {
    const previews = new Map<string, string>(Object.entries(STANDARD_XCOLOR_PREVIEWS));
    request.colors.forEach((color) => {
      const preview = getXcolorPreviewColor(color);
      if (preview && color.name) previews.set(color.name, preview);
    });
    return request.aliases.map((alias) => {
      const primary = previews.get(alias.primary) || "#868e96";
      const secondary = previews.get(alias.secondary) || "#ffffff";
      const preview = mixPreviewColors(primary, secondary, alias.percentage);
      if (alias.name) previews.set(alias.name, preview);
      return { alias, preview };
    });
  }, [request.aliases, request.colors]);

  const snippetCode = useMemo(() => {
    switch (snippetType) {
      case "colorbox":
        return `\\colorbox{${snippetColor}}{${snippetText}}`;
      case "fcolorbox":
        return `\\fcolorbox{${snippetFrameColor}}{${snippetColor}}{${snippetText}}`;
      case "pagecolor":
        return `\\pagecolor{${snippetColor}}`;
      case "rowcolor":
        return `\\rowcolor{${snippetColor}}`;
      default:
        return `\\textcolor{${snippetColor}}{${snippetText}}`;
    }
  }, [snippetColor, snippetFrameColor, snippetText, snippetType]);

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Group gap="xs">
              <ThemeIcon size="sm" radius="sm" variant="light" color="blue">
                <FontAwesomeIcon icon={faImage} />
              </ThemeIcon>
              <Text fw={700}>
                {t("packageStudio.xcolor.title", {
                  defaultValue: "Xcolor palette builder",
                })}
              </Text>
              {loading && <Loader size="xs" />}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {t("packageStudio.xcolor.description", {
                defaultValue:
                  "Configure xcolor options and generate reusable document color definitions.",
              })}
            </Text>
          </Box>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setRequest(DEFAULT_XCOLOR_REQUEST)}
            >
              {t("packageStudio.reset", { defaultValue: "Reset" })}
            </Button>
          </Group>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {output?.warnings.map((warning, index) => (
          <Alert
            key={`${warning.code}-${index}`}
            color={warning.severity === "error" ? "red" : "orange"}
            variant="light"
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          >
            <Text size="sm" fw={700}>
              {warning.code}
            </Text>
            <Text size="xs">{warning.message}</Text>
          </Alert>
        ))}

        <BuilderActivationBar
          builderId="xcolor"
          managedPackageIds={["xcolor"]}
          output={output}
          generatedBlocks={[
            { blockId: "xcolor-palette", code: output?.code || "" },
          ]}
          activeFilePath={activeFilePath}
          analysis={analysis}
          loading={loading}
          onApply={onApplyBuilderConfiguration}
        />

        <Group align="stretch" gap="md">
          <Box style={{ flex: 1.1, minWidth: 420 }}>
            <Stack gap="md">
              <PackageOptionCatalog
                builderId="xcolor"
                selectedOptions={request.packageOptions}
                onChangeOptions={(packageOptions) =>
                  setRequest((current) => ({
                    ...current,
                    packageOptions,
                  }))
                }
              />

              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs">
                    <Box>
                      <Text size="sm" fw={700}>
                        {t("packageStudio.xcolor.createColor", {
                          defaultValue: "Create a color",
                        })}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t("packageStudio.xcolor.createColorHint", {
                          defaultValue:
                            "Pick a color, give it a LaTeX name, and add it to the document palette.",
                        })}
                      </Text>
                    </Box>
                    <Badge size="xs" variant="light" color="blue">
                      \\definecolor
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                    <TextInput
                      size="xs"
                      label={t("packageStudio.xcolor.colorName", {
                        defaultValue: "Color name",
                      })}
                      placeholder="brandBlue"
                      value={newColor.name}
                      error={colorFormError || undefined}
                      onChange={(event) => {
                        const value = inputValue(event);
                        setNewColor((current) => ({ ...current, name: value }));
                        setColorFormError(null);
                      }}
                    />
                    <ColorInput
                      size="xs"
                      label={t("packageStudio.xcolor.pickColor", {
                        defaultValue: "Pick color",
                      })}
                      value={getXcolorPreviewColor(newColor) || "#1c7ed6"}
                      onChange={(value) =>
                        setNewColor((current) => ({
                          ...current,
                          value: hexToXcolorValue(value, current.model),
                        }))
                      }
                    />
                    <Select
                      size="xs"
                      label={t("packageStudio.xcolor.colorModel", {
                        defaultValue: "Color model",
                      })}
                      data={XCOLOR_COLOR_MODELS}
                      value={newColor.model}
                      onChange={(model) => {
                        const nextModel = model || "HTML";
                        const preview = getXcolorPreviewColor(newColor) || "#1c7ed6";
                        setNewColor((current) => ({
                          ...current,
                          model: nextModel,
                          value: hexToXcolorValue(preview, nextModel),
                        }));
                      }}
                    />
                    <TextInput
                      size="xs"
                      label={t("packageStudio.xcolor.modelValue", {
                        defaultValue: "Model value",
                      })}
                      description={t("packageStudio.xcolor.colorValueHint", {
                        defaultValue:
                          "Comma-separated values matching the selected xcolor model.",
                      })}
                      value={newColor.value}
                      onChange={(event) => {
                        const value = inputValue(event);
                        setNewColor((current) => ({ ...current, value }));
                        setColorFormError(null);
                      }}
                    />
                  </SimpleGrid>
                  <Group justify="flex-end">
                    <Button
                      size="xs"
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                      onClick={addColor}
                    >
                      {t("packageStudio.xcolor.addColor", {
                        defaultValue: "Add color",
                      })}
                    </Button>
                  </Group>
                </Stack>
              </Paper>

              <Group justify="space-between" align="flex-end">
                <Box>
                  <Text size="sm" fw={700}>
                    {t("packageStudio.xcolor.documentPalette", {
                      defaultValue: "Document palette",
                    })}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t("packageStudio.xcolor.documentPaletteHint", {
                      defaultValue: "Edit, duplicate, or remove reusable document colors.",
                    })}
                  </Text>
                </Box>
                <Badge size="xs" variant="light" color="blue">
                  {request.colors.length}
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                {request.colors.map((color, index) => (
                  <Paper key={index} withBorder p="sm" radius="md">
                    <Stack gap="xs">
                      <Group justify="space-between" gap="xs">
                        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                          <Box
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                              flexShrink: 0,
                              background:
                                getXcolorPreviewColor(color) ||
                                "repeating-linear-gradient(135deg, #495057, #495057 5px, #343a40 5px, #343a40 10px)",
                              border: "1px solid var(--app-border-color)",
                            }}
                          />
                          <Text size="xs" fw={700} truncate>
                            {color.name || t("packageStudio.xcolor.unnamed", { defaultValue: "Unnamed color" })}
                          </Text>
                        </Group>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip
                            label={t("packageStudio.xcolor.duplicateColor", {
                              defaultValue: "Duplicate color",
                            })}
                          >
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="gray"
                              onClick={() => duplicateColor(index)}
                            >
                              <FontAwesomeIcon icon={faCopy} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip
                            label={t("packageStudio.xcolor.removeColor", {
                              defaultValue: "Remove color",
                            })}
                          >
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={() => removeColor(index)}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                      <TextInput
                        size="xs"
                        label={t("packageStudio.xcolor.colorName", {
                          defaultValue: "Color name",
                        })}
                        value={color.name}
                        onChange={(event) => {
                          const value = inputValue(event);
                          updateColor(index, { name: value });
                        }}
                      />
                      <Select
                        size="xs"
                        label={t("packageStudio.xcolor.colorModel", {
                          defaultValue: "Color model",
                        })}
                        data={XCOLOR_COLOR_MODELS}
                        value={color.model}
                        onChange={(value) => {
                          const model = value || "HTML";
                          const preview = getXcolorPreviewColor(color);
                          updateColor(index, {
                            model,
                            value: preview
                              ? hexToXcolorValue(preview, model)
                              : color.value,
                          });
                        }}
                      />
                      {color.model === "HTML" ? (
                        <ColorInput
                          size="xs"
                          label={t("packageStudio.xcolor.colorValue", {
                            defaultValue: "Color value",
                          })}
                          value={`#${color.value.replace(/^#/, "")}`}
                          onChange={(value) =>
                            updateColor(index, {
                              value: value.replace(/^#/, ""),
                            })
                          }
                        />
                      ) : (
                        <Stack gap="xs">
                          <ColorInput
                            size="xs"
                            label={t("packageStudio.xcolor.pickColor", {
                              defaultValue: "Pick color",
                            })}
                            value={getXcolorPreviewColor(color) || "#1c7ed6"}
                            onChange={(value) =>
                              updateColor(index, {
                                value: hexToXcolorValue(value, color.model),
                              })
                            }
                          />
                          <TextInput
                            size="xs"
                            label={t("packageStudio.xcolor.colorValue", {
                              defaultValue: "Color value",
                            })}
                            description={t("packageStudio.xcolor.colorValueHint", {
                              defaultValue:
                                "Comma-separated values matching the selected xcolor model.",
                            })}
                            value={color.value}
                            onChange={(event) => {
                              const value = inputValue(event);
                              updateColor(index, { value });
                            }}
                          />
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between" gap="xs">
                    <Box>
                      <Group gap={6}>
                        <FontAwesomeIcon icon={faFlask} />
                        <Text size="sm" fw={700}>
                          {t("packageStudio.xcolor.mixTitle", {
                            defaultValue: "Mix / alias colors",
                          })}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {t("packageStudio.xcolor.mixHint", {
                          defaultValue:
                            "Create a named mix with colorlet without writing the expression manually.",
                        })}
                      </Text>
                    </Box>
                    <Badge size="xs" variant="light" color="violet">
                      \\colorlet
                    </Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                    <TextInput
                      size="xs"
                      label={t("packageStudio.xcolor.mixName", {
                        defaultValue: "Mix name",
                      })}
                      placeholder="softBlue"
                      value={newAlias.name}
                      error={aliasFormError || undefined}
                      onChange={(event) => {
                        const value = inputValue(event);
                        setNewAlias((current) => ({ ...current, name: value }));
                        setAliasFormError(null);
                      }}
                    />
                    <Select
                      size="xs"
                      searchable
                      label={t("packageStudio.xcolor.primaryColor", {
                        defaultValue: "Primary color",
                      })}
                      data={colorChoices}
                      value={newAlias.primary}
                      onChange={(value) =>
                        setNewAlias((current) => ({
                          ...current,
                          primary: value || "blue",
                        }))
                      }
                    />
                    <NumberInput
                      size="xs"
                      min={0}
                      max={100}
                      suffix="%"
                      label={t("packageStudio.xcolor.primaryAmount", {
                        defaultValue: "Primary amount",
                      })}
                      value={newAlias.percentage}
                      onChange={(value) => {
                        const numeric = typeof value === "number" ? value : Number(value);
                        setNewAlias((current) => ({
                          ...current,
                          percentage: Number.isFinite(numeric)
                            ? Math.round(clampColor(numeric, 0, 100))
                            : current.percentage,
                        }));
                      }}
                    />
                    <Select
                      size="xs"
                      searchable
                      label={t("packageStudio.xcolor.secondaryColor", {
                        defaultValue: "Secondary color",
                      })}
                      data={colorChoices}
                      value={newAlias.secondary}
                      onChange={(value) =>
                        setNewAlias((current) => ({
                          ...current,
                          secondary: value || "white",
                        }))
                      }
                    />
                  </SimpleGrid>
                  <Text size="xs" ff="monospace" c="dimmed">
                    {`\\colorlet{${newAlias.name || "mixName"}}{${
                      newAlias.percentage >= 100
                        ? newAlias.primary
                        : `${newAlias.primary}!${newAlias.percentage}!${newAlias.secondary}`
                    }}`}
                  </Text>
                  <Group justify="space-between" align="center">
                    <Group gap={6}>
                      {request.aliases.map((alias, index) => (
                        <Badge
                          key={`${alias.name}-${index}`}
                          variant="light"
                          color="violet"
                          rightSection={
                            <ActionIcon
                              size="xs"
                              variant="transparent"
                              color="violet"
                              aria-label={t("packageStudio.xcolor.removeMix", {
                                defaultValue: "Remove mix",
                              })}
                              onClick={() =>
                                setRequest((current) => ({
                                  ...current,
                                  aliases: current.aliases.filter(
                                    (_, aliasIndex) => aliasIndex !== index,
                                  ),
                                }))
                              }
                            >
                              <FontAwesomeIcon icon={faXmark} />
                            </ActionIcon>
                          }
                        >
                          {alias.name}
                        </Badge>
                      ))}
                    </Group>
                    <Button
                      size="xs"
                      variant="light"
                      color="violet"
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                      onClick={addAlias}
                    >
                      {t("packageStudio.xcolor.addMix", {
                        defaultValue: "Add mix",
                      })}
                    </Button>
                  </Group>
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Box>
                    <Text size="sm" fw={700}>
                      {t("packageStudio.xcolor.useColor", {
                        defaultValue: "Use a color",
                      })}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("packageStudio.xcolor.useColorHint", {
                        defaultValue:
                          "Build a common xcolor command and insert it at the editor cursor.",
                      })}
                    </Text>
                  </Box>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
                    <Select
                      size="xs"
                      label={t("packageStudio.xcolor.command", {
                        defaultValue: "Command",
                      })}
                      data={[
                        { value: "textcolor", label: "Text color" },
                        { value: "colorbox", label: "Color box" },
                        { value: "fcolorbox", label: "Framed color box" },
                        { value: "pagecolor", label: "Page color" },
                        { value: "rowcolor", label: "Table row color" },
                      ]}
                      value={snippetType}
                      onChange={(value) => {
                        const nextType = value || "textcolor";
                        setSnippetType(nextType);
                        if (nextType === "rowcolor") {
                          setRequest((current) => ({
                            ...current,
                            packageOptions: toggleOptionValue(
                              current.packageOptions,
                              "table",
                              true,
                            ),
                          }));
                        }
                      }}
                    />
                    <Select
                      size="xs"
                      searchable
                      label={t("packageStudio.xcolor.color", {
                        defaultValue: "Color",
                      })}
                      data={colorChoices}
                      value={snippetColor}
                      onChange={(value) => setSnippetColor(value || "blue")}
                    />
                    {snippetType === "fcolorbox" && (
                      <Select
                        size="xs"
                        searchable
                        label={t("packageStudio.xcolor.frameColor", {
                          defaultValue: "Frame color",
                        })}
                        data={colorChoices}
                        value={snippetFrameColor}
                        onChange={(value) =>
                          setSnippetFrameColor(value || "black")
                        }
                      />
                    )}
                    {!['pagecolor', 'rowcolor'].includes(snippetType) && (
                      <TextInput
                        size="xs"
                        label={t("packageStudio.xcolor.text", {
                          defaultValue: "Text",
                        })}
                        value={snippetText}
                        onChange={(event) => {
                          const value = inputValue(event);
                          setSnippetText(value);
                        }}
                      />
                    )}
                  </SimpleGrid>
                  {snippetType === "rowcolor" && (
                    <Alert color="blue" variant="light" py="xs">
                      {t("packageStudio.xcolor.rowColorHint", {
                        defaultValue:
                          "The table option has been enabled automatically. Review the package changes before compiling.",
                      })}
                    </Alert>
                  )}
                  <Group justify="space-between" gap="xs" wrap="nowrap">
                    <Text
                      size="xs"
                      ff="monospace"
                      style={{ overflowWrap: "anywhere" }}
                    >
                      {snippetCode}
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<FontAwesomeIcon icon={faPlus} />}
                      onClick={() => onInsertCode(snippetCode)}
                      style={{ flexShrink: 0 }}
                    >
                      {t("packageStudio.xcolor.insertAtCursor", {
                        defaultValue: "Insert at cursor",
                      })}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Box>

          <Box style={{ width: 390, minWidth: 330 }}>
            <Stack gap="md" h="100%">
              <Paper withBorder p="sm" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.xcolor.preview", {
                        defaultValue: "Palette preview",
                      })}
                    </Text>
                    <Badge size="xs" variant="light" color="blue">
                      xcolor
                    </Badge>
                  </Group>
                  <SimpleGrid cols={2} spacing="xs">
                    {request.colors.map((color, index) => {
                      const preview = getXcolorPreviewColor(color);
                      return (
                        <Box
                          key={`${color.name}-${index}`}
                          style={{
                            minHeight: 78,
                            borderRadius: 8,
                            padding: 10,
                            background:
                              preview ||
                              "repeating-linear-gradient(135deg, #495057, #495057 8px, #343a40 8px, #343a40 16px)",
                            color: preview
                              ? getContrastingTextColor(preview)
                              : "#ffffff",
                            boxShadow:
                              "inset 0 0 0 1px rgba(127,127,127,0.35)",
                          }}
                        >
                          <Text size="xs" fw={800} lineClamp={1}>
                            {color.name || "unnamed"}
                          </Text>
                          <Text size="xs" style={{ opacity: 0.85 }}>
                            {preview
                              ? `${color.model}: ${color.value}`
                              : t("packageStudio.xcolor.invalidPreview", {
                                  defaultValue: "Invalid value",
                                })}
                          </Text>
                        </Box>
                      );
                    })}
                    {aliasPreviews.map(({ alias, preview }, index) => (
                      <Box
                        key={`${alias.name}-alias-${index}`}
                        style={{
                          minHeight: 78,
                          borderRadius: 8,
                          padding: 10,
                          background: preview,
                          color: getContrastingTextColor(preview),
                          boxShadow: "inset 0 0 0 1px rgba(127,127,127,0.35)",
                        }}
                      >
                        <Text size="xs" fw={800} lineClamp={1}>
                          {alias.name || "unnamed"}
                        </Text>
                        <Text size="xs" style={{ opacity: 0.85 }}>
                          {alias.primary}!{alias.percentage}!{alias.secondary}
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {t("packageStudio.generatedCode", {
                        defaultValue: "Generated code",
                      })}
                    </Text>
                    <Badge size="xs" variant="light" color="blue">
                      Rust
                    </Badge>
                  </Group>
                  <Textarea
                    readOnly
                    autosize
                    minRows={6}
                    maxRows={12}
                    value={output?.code || ""}
                    styles={{
                      input: {
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      },
                    }}
                  />
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
};

const PREVIEW_TEXT_LIMIT = 900;

const clipPreviewText = (text: string) =>
  text.length > PREVIEW_TEXT_LIMIT
    ? `${text.slice(0, PREVIEW_TEXT_LIMIT)}\n…`
    : text;

const getEditPreviewText = (
  source: string,
  startByte: number,
  endByte: number,
) => {
  const start = utf8ByteOffsetToStringIndex(source, startByte);
  const end = utf8ByteOffsetToStringIndex(source, endByte);
  return clipPreviewText(source.slice(start, end));
};

type InlineDiffRow = {
  kind: "context" | "remove" | "add";
  text: string;
  oldLine?: number;
  newLine?: number;
};

const splitDiffLines = (text: string) => {
  if (!text) return [];
  return text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
};

const buildInlineDiffRows = (
  currentText: string,
  nextText: string,
): InlineDiffRow[] => {
  const currentLines = splitDiffLines(currentText);
  const nextLines = splitDiffLines(nextText);

  if (currentLines.length === 0) {
    return nextLines.map((text, index) => ({
      kind: "add",
      text,
      newLine: index + 1,
    }));
  }

  if (nextLines.length === 0) {
    return currentLines.map((text, index) => ({
      kind: "remove",
      text,
      oldLine: index + 1,
    }));
  }

  const matrix = Array.from({ length: currentLines.length + 1 }, () =>
    Array(nextLines.length + 1).fill(0),
  );

  for (let oldIndex = currentLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = nextLines.length - 1; newIndex >= 0; newIndex -= 1) {
      matrix[oldIndex][newIndex] =
        currentLines[oldIndex] === nextLines[newIndex]
          ? matrix[oldIndex + 1][newIndex + 1] + 1
          : Math.max(matrix[oldIndex + 1][newIndex], matrix[oldIndex][newIndex + 1]);
    }
  }

  const rows: InlineDiffRow[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < currentLines.length || newIndex < nextLines.length) {
    if (
      oldIndex < currentLines.length &&
      newIndex < nextLines.length &&
      currentLines[oldIndex] === nextLines[newIndex]
    ) {
      rows.push({
        kind: "context",
        text: currentLines[oldIndex],
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      });
      oldIndex += 1;
      newIndex += 1;
    } else if (
      newIndex >= nextLines.length ||
      (oldIndex < currentLines.length &&
        matrix[oldIndex + 1][newIndex] >= matrix[oldIndex][newIndex + 1])
    ) {
      rows.push({
        kind: "remove",
        text: currentLines[oldIndex],
        oldLine: oldIndex + 1,
      });
      oldIndex += 1;
    } else {
      rows.push({
        kind: "add",
        text: nextLines[newIndex],
        newLine: newIndex + 1,
      });
      newIndex += 1;
    }
  }

  return rows;
};

const InlineEditDiff: React.FC<{
  currentText: string;
  nextText: string;
}> = ({ currentText, nextText }) => {
  const { t } = useTranslation();
  const rows = buildInlineDiffRows(currentText, nextText);

  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <Group
        justify="space-between"
        px="xs"
        py={6}
        style={{
          borderBottom: "1px solid var(--app-border-color)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <Text size="xs" fw={700}>
          {t("packageStudio.editReview.inlineDiff", {
            defaultValue: "Inline diff",
          })}
        </Text>
        <Group gap={6}>
          <Badge size="xs" color="red" variant="light">
            - {rows.filter((row) => row.kind === "remove").length}
          </Badge>
          <Badge size="xs" color="green" variant="light">
            + {rows.filter((row) => row.kind === "add").length}
          </Badge>
        </Group>
      </Group>

      <Box
        style={{
          maxHeight: 260,
          overflow: "auto",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.55,
        }}
      >
        {rows.map((row, index) => {
          const isRemove = row.kind === "remove";
          const isAdd = row.kind === "add";
          return (
            <Box
              key={`${row.kind}-${row.oldLine ?? ""}-${row.newLine ?? ""}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "42px 42px 24px minmax(0, 1fr)",
                columnGap: 8,
                padding: "2px 8px",
                background: isRemove
                  ? "rgba(250, 82, 82, 0.13)"
                  : isAdd
                    ? "rgba(64, 192, 87, 0.13)"
                    : "transparent",
                color: isRemove
                  ? "var(--mantine-color-red-2)"
                  : isAdd
                    ? "var(--mantine-color-green-2)"
                    : undefined,
              }}
            >
              <Text size="xs" c="dimmed" ta="right" ff="monospace">
                {row.oldLine ?? ""}
              </Text>
              <Text size="xs" c="dimmed" ta="right" ff="monospace">
                {row.newLine ?? ""}
              </Text>
              <Text size="xs" fw={700} ff="monospace">
                {isRemove ? "-" : isAdd ? "+" : " "}
              </Text>
              <Box
                component="code"
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  minWidth: 0,
                }}
              >
                {row.text || " "}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};

const PackageEditReviewPanel: React.FC<{
  review: PackageStudioEditReview;
  onApply?: () => void;
  onDismiss?: () => void;
  onRevealSourceLine?: (line: number) => void;
}> = ({ review, onApply, onDismiss, onRevealSourceLine }) => {
  const { t } = useTranslation();
  const fileName = review.targetFilePath
    ? review.targetFilePath.split(/[/\\]/).pop() || review.targetFilePath
    : t("packageStudio.editReview.activeDocument", {
        defaultValue: "active document",
      });
  const visibleEdits = review.plan.edits.slice(0, 4);
  const remainingEdits = Math.max(
    0,
    review.plan.edits.length - visibleEdits.length,
  );
  const firstEditLine = review.plan.edits[0]?.range.start.line;

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{
        borderColor: "var(--mantine-color-blue-5)",
        background:
          "linear-gradient(135deg, rgba(34,139,230,0.08), rgba(34,139,230,0.02))",
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="md">
          <Group gap="xs" align="flex-start" style={{ minWidth: 0 }}>
            <ThemeIcon size="sm" radius="sm" variant="light" color="blue">
              <FontAwesomeIcon icon={faWandMagicSparkles} />
            </ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Text size="sm" fw={800}>
                {t("packageStudio.editReview.title", {
                  defaultValue: "Review source changes",
                })}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {review.plan.title} · {review.plan.summary}
              </Text>
              <Group gap={6} mt={6}>
                <Badge size="xs" variant="light" color="blue">
                  {fileName}
                </Badge>
                <Badge size="xs" variant="light" color="gray">
                  {review.plan.edits.length}{" "}
                  {t("packageStudio.editReview.edits", {
                    defaultValue: "edits",
                  })}
                </Badge>
                {review.plan.diagnostics.length > 0 && (
                  <Badge size="xs" variant="light" color="orange">
                    {review.plan.diagnostics.length} diagnostics
                  </Badge>
                )}
              </Group>
            </Box>
          </Group>

          <Group gap="xs" justify="flex-end">
            {firstEditLine && onRevealSourceLine && (
              <Button
                size="compact-xs"
                variant="light"
                color="gray"
                leftSection={<FontAwesomeIcon icon={faExternalLinkAlt} />}
                onClick={() => onRevealSourceLine(firstEditLine)}
              >
                {t("packageStudio.editReview.jumpToFirstEdit", {
                  defaultValue: "Jump to first edit",
                })}
              </Button>
            )}
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<FontAwesomeIcon icon={faXmark} />}
              onClick={onDismiss}
              disabled={!onDismiss}
            >
              {t("packageStudio.editReview.discard", {
                defaultValue: "Discard",
              })}
            </Button>
            <Button
              size="compact-xs"
              color="blue"
              leftSection={<FontAwesomeIcon icon={faCheck} />}
              onClick={onApply}
              disabled={!onApply || review.plan.edits.length === 0}
            >
              {t("packageStudio.editReview.apply", {
                defaultValue: "Apply changes",
              })}
            </Button>
          </Group>
        </Group>

        {review.plan.diagnostics.length > 0 && (
          <Alert
            variant="light"
            color="orange"
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          >
            <Stack gap={4}>
              {review.plan.diagnostics.slice(0, 3).map((diagnostic) => (
                <Text key={diagnostic.code} size="xs">
                  {diagnostic.message}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        {visibleEdits.length === 0 ? (
          <Text size="xs" c="dimmed">
            {t("packageStudio.editReview.noEdits", {
              defaultValue: "This plan does not change the source.",
            })}
          </Text>
        ) : (
          <Stack gap="xs">
            {visibleEdits.map((edit, index) => {
              const currentText = getEditPreviewText(
                review.source,
                edit.range.start.byte,
                edit.range.end.byte,
              );
              const nextText = clipPreviewText(edit.replacement);
              const isInsertion = edit.range.start.byte === edit.range.end.byte;

              return (
                <Card
                  key={`${edit.range.start.byte}-${index}`}
                  withBorder
                  p="xs"
                  radius="md"
                >
                  <Stack gap="xs">
                    <Group justify="space-between" gap="xs">
                      <Group gap={6}>
                        <Badge size="xs" variant="light" color="blue">
                          {t("packageStudio.currentDocument.line", {
                            defaultValue: "line",
                          })}{" "}
                          {edit.range.start.line}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {isInsertion
                            ? t("packageStudio.editReview.insertOperation", {
                                defaultValue: "Insert",
                              })
                            : t("packageStudio.editReview.replaceOperation", {
                                defaultValue: "Replace",
                              })}
                        </Text>
                      </Group>
                      {onRevealSourceLine && (
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="gray"
                          onClick={() =>
                            onRevealSourceLine(edit.range.start.line)
                          }
                        >
                          {t("packageStudio.editReview.jump", {
                            defaultValue: "Jump",
                          })}
                        </Button>
                      )}
                    </Group>

                    <InlineEditDiff
                      currentText={currentText}
                      nextText={nextText}
                    />
                  </Stack>
                </Card>
              );
            })}

            {remainingEdits > 0 && (
              <Text size="xs" c="dimmed">
                +{remainingEdits}{" "}
                {t("packageStudio.editReview.moreEdits", {
                  defaultValue: "more edits are included in this plan.",
                })}
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

const DIAGNOSTIC_QUICK_FIX_CODES = new Set([
  "package-conflict-color-xcolor",
  "obsolete-package-epsfig",
  "package-conflict-subfigure-subcaption",
  "package-order-hyperref-late",
  "package-order-cleveref-after-hyperref",
]);

const hasDiagnosticQuickFix = (diagnostic: PackageDiagnostic) =>
  DIAGNOSTIC_QUICK_FIX_CODES.has(diagnostic.code);

const CompactBuilderContext: React.FC<{
  activeBuilder: BuilderDescriptor;
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  loading: boolean;
  error: string | null;
  onRevealSourceLine?: (line: number) => void;
  onFixDiagnostic?: (diagnostic: PackageDiagnostic) => void;
}> = ({
  activeBuilder,
  activeFilePath,
  activeFileContent,
  analysis,
  loading,
  error,
  onRevealSourceLine,
  onFixDiagnostic,
}) => {
  const { t } = useTranslation();
  const presentPackages = new Set(
    (analysis?.packages || []).map((packageId) => packageId.toLowerCase()),
  );
  const builderPackageIds = activeBuilder.packageIds.map((packageId) =>
    packageId.toLowerCase(),
  );
  const declaration =
    analysis?.declarations.find(
      (item) =>
        (item.kind === "usePackage" || item.kind === "requirePackage") &&
        builderPackageIds.includes(item.name.toLowerCase()),
    ) ?? null;
  const managedBlockIdByBuilder: Record<string, string> = {
    "code-highlighting": "code-highlighting",
    xcolor: "xcolor-palette",
    fancyhdr: "fancyhdr-setup",
  };
  const managedBlockId = managedBlockIdByBuilder[activeBuilder.id];
  const generatedBlockPresent = Boolean(
    managedBlockId &&
      (activeFileContent?.includes(
        `% --- DataTeX Package Studio: ${managedBlockId}:start ---`,
      ) ||
        (activeBuilder.id === "code-highlighting" &&
          activeFileContent?.includes("% --- Code Highlighting ("))),
  );
  const configured = Boolean(declaration || generatedBlockPresent);
  const diagnostics = analysis?.diagnostics || [];
  const firstDiagnostic = diagnostics[0];
  const fileName = activeFilePath
    ? activeFilePath.split(/[/\\]/).pop() || activeFilePath
    : t("packageStudio.currentDocument.noActiveFile", {
        defaultValue: "No active LaTeX document",
      });
  const capabilities = [
    ["Preview", activeBuilder.capabilities.supportsPreview],
    ["Import", activeBuilder.capabilities.supportsImport],
    ["Presets", activeBuilder.capabilities.supportsPresets],
    ["Exact compile", activeBuilder.capabilities.requiresExactCompile],
  ] as const;

  return (
    <Paper withBorder p="sm" radius="md" h="100%">
      <Stack gap={8}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Group gap={7} wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size="sm" radius="sm" variant="light" color="teal">
              <FontAwesomeIcon icon={faFileLines} />
            </ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Text size="xs" fw={700} truncate>
                {fileName}
              </Text>
              <Text size="xs" c="dimmed">
                {SUPPORT_LABELS[activeBuilder.supportLevel]}
              </Text>
            </Box>
          </Group>
          <Group gap={5} wrap="nowrap">
            {loading && <Loader size="xs" />}
            {declaration && onRevealSourceLine && (
              <Tooltip
                label={t("packageStudio.currentDocument.jumpToDeclaration", {
                  defaultValue: "Jump to declaration",
                })}
              >
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="teal"
                  aria-label={t("packageStudio.currentDocument.jumpToDeclaration", {
                    defaultValue: "Jump to declaration",
                  })}
                  onClick={() => onRevealSourceLine(declaration.range.start.line)}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </ActionIcon>
              </Tooltip>
            )}
            <Badge size="xs" variant="light" color={configured ? "teal" : "gray"}>
              {configured
                ? t("packageStudio.currentDocument.configured", {
                    defaultValue: "configured",
                  })
                : t("packageStudio.currentDocument.notConfigured", {
                    defaultValue: "not configured",
                  })}
            </Badge>
            {diagnostics.length > 0 && (
              <Badge size="xs" variant="light" color="orange">
                {diagnostics.length} diagnostics
              </Badge>
            )}
          </Group>
        </Group>

        {error ? (
          <Text size="xs" c="red" lineClamp={2}>
            {error}
          </Text>
        ) : (
          <Group gap={5} align="center">
            <Text size="xs" c="dimmed" fw={700}>
              {t("packageStudio.requirements", {
                defaultValue: "Packages",
              })}
            </Text>
            {activeBuilder.packageIds.map((packageId) => {
              const present = presentPackages.has(packageId.toLowerCase());
              return (
                <Tooltip
                  key={packageId}
                  label={present ? "Detected in the document" : "Required by this builder"}
                >
                  <Badge
                    size="xs"
                    variant={present ? "filled" : "outline"}
                    color={present ? "teal" : "gray"}
                  >
                    {packageId}
                  </Badge>
                </Tooltip>
              );
            })}
            <Text size="xs" c="dimmed" mx={2}>·</Text>
            {activeBuilder.outputTargets.map((target) => (
              <Tooltip key={target} label={t("packageStudio.outputTargets", { defaultValue: "Output target" })}>
                <Badge size="xs" variant="light" color="blue">
                  {OUTPUT_TARGET_LABELS[target]}
                </Badge>
              </Tooltip>
            ))}
          </Group>
        )}

        <Group gap={5}>
          {capabilities
            .filter(([, enabled]) => enabled)
            .map(([label]) => (
              <Tooltip key={label} label={`${label} capability`}>
                <Badge size="xs" variant="dot" color="violet">
                  {label}
                </Badge>
              </Tooltip>
            ))}
          {generatedBlockPresent && (
            <Badge size="xs" variant="dot" color="violet">
              Generated block
            </Badge>
          )}
        </Group>

        {firstDiagnostic && (
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                style={{ color: "var(--mantine-color-orange-5)", flexShrink: 0 }}
              />
              <Tooltip label={firstDiagnostic.message} multiline maw={420}>
                <Text size="xs" c="dimmed" truncate>
                  {firstDiagnostic.message}
                </Text>
              </Tooltip>
            </Group>
            {onFixDiagnostic && hasDiagnosticQuickFix(firstDiagnostic) && (
              <Button
                size="compact-xs"
                variant="subtle"
                color="orange"
                onClick={() => onFixDiagnostic(firstDiagnostic)}
              >
                {t("packageStudio.currentDocument.reviewFix", {
                  defaultValue: "Review fix",
                })}
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </Paper>
  );
};

export const CurrentDocumentPackageStatus: React.FC<{
  activeBuilder: BuilderDescriptor;
  activeFilePath?: string;
  activeFileContent?: string;
  analysis: LatexPackageAnalysis | null;
  loading: boolean;
  error: string | null;
  onRevealSourceLine?: (line: number) => void;
  onRemovePackage?: (packageId: string) => void;
  onUpdatePackageOptions?: (packageId: string, options: string[]) => void;
  onFixDiagnostic?: (diagnostic: PackageDiagnostic) => void;
}> = ({
  activeBuilder,
  activeFilePath,
  activeFileContent,
  analysis,
  loading,
  error,
  onRevealSourceLine,
  onRemovePackage,
  onUpdatePackageOptions,
  onFixDiagnostic,
}) => {
  const { t } = useTranslation();
  const presentPackages = new Set(
    (analysis?.packages || []).map((packageId) => packageId.toLowerCase()),
  );
  const builderPackageIds = activeBuilder.packageIds.map((packageId) =>
    packageId.toLowerCase(),
  );
  const matchedRequirements = activeBuilder.packageIds.filter((packageId) =>
    presentPackages.has(packageId.toLowerCase()),
  );
  const firstBuilderDeclaration =
    analysis?.declarations.find(
      (declaration) =>
        (declaration.kind === "usePackage" ||
          declaration.kind === "requirePackage") &&
        builderPackageIds.includes(declaration.name.toLowerCase()),
    ) ?? null;
  const firstDiagnosticWithRange =
    analysis?.diagnostics.find((diagnostic) => diagnostic.range) ?? null;
  const managedBlockIdByBuilder: Record<string, string> = {
    "code-highlighting": "code-highlighting",
    xcolor: "xcolor-palette",
    fancyhdr: "fancyhdr-setup",
  };
  const managedBlockId = managedBlockIdByBuilder[activeBuilder.id];
  const generatedBlockPresent = Boolean(
    managedBlockId &&
      (activeFileContent?.includes(
        `% --- DataTeX Package Studio: ${managedBlockId}:start ---`,
      ) ||
        (activeBuilder.id === "code-highlighting" &&
          activeFileContent?.includes("% --- Code Highlighting ("))),
  );
  const builderConfigured =
    matchedRequirements.length > 0 || generatedBlockPresent;
  const fileName = activeFilePath
    ? activeFilePath.split(/[/\\]/).pop() || activeFilePath
    : "";
  const diagnostics = analysis?.diagnostics || [];
  const visiblePackages = analysis?.packages.slice(0, 18) || [];
  const removableRequirement = matchedRequirements[0] ?? null;
  const [optionDraft, setOptionDraft] = useState("");
  const currentOptionText = firstBuilderDeclaration?.options.join(", ") ?? "";
  const optionDraftValues = optionDraft
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
  const optionDraftChanged = optionDraft.trim() !== currentOptionText;

  useEffect(() => {
    setOptionDraft(currentOptionText);
  }, [currentOptionText, firstBuilderDeclaration?.raw]);

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" gap="sm" align="flex-start">
          <Group gap="xs" style={{ minWidth: 0 }}>
            <ThemeIcon size="sm" radius="sm" variant="light" color="teal">
              <FontAwesomeIcon icon={faFileLines} />
            </ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Text size="sm" fw={700}>
                {t("packageStudio.currentDocument.title", {
                  defaultValue: "Current document package status",
                })}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {fileName ||
                  t("packageStudio.currentDocument.noActiveFile", {
                    defaultValue: "No active LaTeX document",
                  })}
              </Text>
            </Box>
          </Group>
          <Group gap={6} justify="flex-end">
            {loading && <Loader size="xs" />}
            {firstBuilderDeclaration && onRevealSourceLine && (
              <Button
                size="compact-xs"
                variant="light"
                color="teal"
                leftSection={<FontAwesomeIcon icon={faExternalLinkAlt} />}
                onClick={() =>
                  onRevealSourceLine(firstBuilderDeclaration.range.start.line)
                }
              >
                {t("packageStudio.currentDocument.jumpToDeclaration", {
                  defaultValue: "Jump to declaration",
                })}
              </Button>
            )}
            {firstDiagnosticWithRange?.range && onRevealSourceLine && (
              <Button
                size="compact-xs"
                variant="light"
                color="orange"
                leftSection={<FontAwesomeIcon icon={faExclamationTriangle} />}
                onClick={() =>
                  onRevealSourceLine(firstDiagnosticWithRange.range!.start.line)
                }
              >
                {t("packageStudio.currentDocument.jumpToDiagnostic", {
                  defaultValue: "Jump to diagnostic",
                })}
              </Button>
            )}
            {removableRequirement && onRemovePackage && (
              <Button
                size="compact-xs"
                variant="light"
                color="red"
                leftSection={<FontAwesomeIcon icon={faXmark} />}
                onClick={() => onRemovePackage(removableRequirement)}
              >
                {t("packageStudio.currentDocument.removePackage", {
                  defaultValue: "Remove package",
                })}
              </Button>
            )}
            <Badge
              size="xs"
              variant="light"
              color={builderConfigured ? "teal" : "gray"}
            >
              {builderConfigured
                ? t("packageStudio.currentDocument.configured", {
                    defaultValue: "configured",
                  })
                : t("packageStudio.currentDocument.notConfigured", {
                    defaultValue: "not configured",
                  })}
            </Badge>
            <Badge
              size="xs"
              variant="light"
              color={diagnostics.length ? "orange" : "blue"}
            >
              {diagnostics.length} diagnostics
            </Badge>
          </Group>
        </Group>

        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : !activeFilePath ? (
          <Text size="xs" c="dimmed">
            {t("packageStudio.currentDocument.openDocumentHint", {
              defaultValue:
                "Open a LaTeX document to see package status for this builder.",
            })}
          </Text>
        ) : (
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
              <Box>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
                {t("packageStudio.currentDocument.builderRequirements", {
                  defaultValue: "Builder requirements",
                })}
              </Text>
              <Group gap={6}>
                {activeBuilder.packageIds.map((packageId) => {
                  const present = presentPackages.has(packageId.toLowerCase());
                  return (
                    <Badge
                      key={packageId}
                      size="xs"
                      variant={present ? "filled" : "light"}
                      color={present ? "teal" : "gray"}
                    >
                      {packageId}
                    </Badge>
                  );
                })}
                {generatedBlockPresent && (
                  <Badge size="xs" variant="filled" color="violet">
                    generated block
                  </Badge>
                )}
              </Group>
              </Box>

              <Box>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
                {t("packageStudio.currentDocument.detectedPackages", {
                  defaultValue: "Detected packages",
                })}
              </Text>
              {visiblePackages.length ? (
                <Group gap={6}>
                  {visiblePackages.map((packageId) => (
                    <Badge
                      key={packageId}
                      size="xs"
                      variant="outline"
                      color={
                        activeBuilder.packageIds.some((required) =>
                          required.toLowerCase() === packageId.toLowerCase(),
                        )
                          ? "teal"
                          : "gray"
                      }
                    >
                      {packageId}
                    </Badge>
                  ))}
                  {(analysis?.packages.length || 0) > visiblePackages.length && (
                    <Badge size="xs" variant="light" color="gray">
                      +{(analysis?.packages.length || 0) - visiblePackages.length}
                    </Badge>
                  )}
                </Group>
              ) : (
                <Text size="xs" c="dimmed">
                  {t("packageStudio.currentDocument.noPackages", {
                    defaultValue: "No package declarations detected.",
                  })}
                </Text>
              )}
              </Box>

              <Box>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
                {t("packageStudio.currentDocument.diagnostics", {
                  defaultValue: "Diagnostics",
                })}
              </Text>
              {diagnostics.length ? (
                <Stack gap={4}>
                  {diagnostics.slice(0, 3).map((diagnostic) => (
                    <Group
                      key={diagnostic.code}
                      gap={6}
                      wrap="nowrap"
                      justify="space-between"
                    >
                      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                        <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          style={{
                            width: 12,
                            height: 12,
                            color: "var(--mantine-color-orange-5)",
                            flexShrink: 0,
                          }}
                        />
                        <Text size="xs" lineClamp={1}>
                          {diagnostic.message}
                          {diagnostic.range
                            ? ` · ${t("packageStudio.currentDocument.line", {
                                defaultValue: "line",
                              })} ${diagnostic.range.start.line}`
                            : ""}
                        </Text>
                      </Group>
                      {onFixDiagnostic && hasDiagnosticQuickFix(diagnostic) && (
                        <Button
                          size="compact-xs"
                          variant="light"
                          color="orange"
                          onClick={() => onFixDiagnostic(diagnostic)}
                          style={{ flexShrink: 0 }}
                        >
                          {t("packageStudio.currentDocument.reviewFix", {
                            defaultValue: "Review fix",
                          })}
                        </Button>
                      )}
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Text size="xs" c="dimmed">
                  {t("packageStudio.currentDocument.noDiagnostics", {
                    defaultValue: "No package diagnostics.",
                  })}
                </Text>
              )}
              </Box>
            </SimpleGrid>

            {firstBuilderDeclaration && onUpdatePackageOptions && (
              <Paper withBorder p="xs" radius="md">
                <Stack gap="xs">
                  <Group justify="space-between" gap="xs" align="flex-end">
                    <TextInput
                      size="xs"
                      style={{ flex: 1 }}
                      label={t("packageStudio.currentDocument.packageOptions", {
                        defaultValue: "Package options",
                      })}
                      description={t(
                        "packageStudio.currentDocument.packageOptionsHint",
                        {
                          defaultValue:
                            "Comma-separated options for the detected builder package.",
                        },
                      )}
                      placeholder="margin=2cm, includehead"
                      value={optionDraft}
                      onChange={(event) =>
                        setOptionDraft(inputValue(event))
                      }
                    />
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => setOptionDraft(currentOptionText)}
                    >
                      {t("packageStudio.reset", { defaultValue: "Reset" })}
                    </Button>
                    <Button
                      size="compact-xs"
                      color="blue"
                      disabled={!optionDraftChanged}
                      onClick={() =>
                        onUpdatePackageOptions(
                          firstBuilderDeclaration.name,
                          optionDraftValues,
                        )
                      }
                    >
                      {t("packageStudio.currentDocument.reviewOptionChange", {
                        defaultValue: "Review option change",
                      })}
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t("packageStudio.currentDocument.packageOptionsSource", {
                      defaultValue:
                        "Current declaration: {{packageId}} on line {{line}}.",
                      packageId: firstBuilderDeclaration.name,
                      line: firstBuilderDeclaration.range.start.line,
                    })}
                  </Text>
                </Stack>
              </Paper>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
};

const PackageBuilderHero: React.FC<{ builder: BuilderDescriptor }> = ({
  builder,
}) => {
  const meta = CATEGORY_META[builder.category];

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      h="100%"
      style={{
        background:
          "linear-gradient(135deg, var(--mantine-color-blue-light), transparent 70%)",
      }}
    >
      <Group justify="space-between" align="flex-start" gap="md">
        <Group gap="md" align="flex-start" style={{ minWidth: 0, flex: 1 }}>
          <ThemeIcon size={46} radius="md" variant="filled" color={meta.color}>
            <FontAwesomeIcon icon={meta.icon} />
          </ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Group gap="xs">
              <Title order={3}>{builder.displayName}</Title>
              <Badge variant="light" color={meta.color}>
                {meta.label}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" maw={760}>
              {builder.description}
            </Text>
          </Box>
        </Group>
        <Badge variant="outline" color="gray">
          {builder.id}
        </Badge>
      </Group>
    </Paper>
  );
};
