// ============================================================================
// Column Configuration for Database View
// Defines column schemas per resource kind with priority ordering
// ============================================================================

export interface ColumnDef {
  key: string;
  label: string;
  priority: number; // Lower = more important, shown first
  width?: number;
  formatType?: "text" | "badge" | "rating" | "tags" | "date";
}

// Standard columns shown for all resource types
const STANDARD_COLUMNS: ColumnDef[] = [
  { key: "title", label: "Τίτλος", priority: 1, formatType: "text" },
  { key: "collection", label: "Συλλογή", priority: 2, formatType: "badge" },
  { key: "kind", label: "Τύπος", priority: 3, formatType: "badge" },
];

// Column schemas per resource kind
export const COLUMN_SCHEMAS: Record<string, ColumnDef[]> = {
  file: [
    ...STANDARD_COLUMNS,
    {
      key: "difficulty",
      label: "Δυσκολία",
      priority: 10,
      formatType: "rating",
    },
    { key: "field", label: "Πεδίο", priority: 11, formatType: "text" },
    { key: "chapters", label: "Κεφάλαια", priority: 12, formatType: "tags" },
    { key: "sections", label: "Ενότητες", priority: 13, formatType: "tags" },
    {
      key: "exerciseTypes",
      label: "Τύπος Άσκησης",
      priority: 14,
      formatType: "tags",
    },
    {
      key: "solved_prooved",
      label: "Λυμένο",
      priority: 15,
      formatType: "text",
    },
    { key: "preamble", label: "Preamble", priority: 20, formatType: "text" },
    {
      key: "requiredPackages",
      label: "Packages",
      priority: 21,
      formatType: "tags",
    },
    {
      key: "bibliography",
      label: "Βιβλιογραφία",
      priority: 22,
      formatType: "tags",
    },
  ],

  document: [
    ...STANDARD_COLUMNS,
    {
      key: "documentTypeId",
      label: "Τύπος Εγγράφου",
      priority: 10,
      formatType: "badge",
    },
    { key: "basicFolder", label: "Φάκελος", priority: 11, formatType: "text" },
    { key: "subFolder", label: "Υποφάκελος", priority: 12, formatType: "text" },
    { key: "date", label: "Ημερομηνία", priority: 13, formatType: "date" },
    { key: "preambleId", label: "Preamble", priority: 14, formatType: "text" },
    {
      key: "needsUpdate",
      label: "Χρειάζεται Ενημέρωση",
      priority: 15,
      formatType: "text",
    },
    { key: "customTags", label: "Tags", priority: 20, formatType: "tags" },
  ],

  table: [
    ...STANDARD_COLUMNS,
    {
      key: "tableTypeId",
      label: "Τύπος Πίνακα",
      priority: 10,
      formatType: "badge",
    },
    { key: "caption", label: "Λεζάντα", priority: 11, formatType: "text" },
    { key: "date", label: "Ημερομηνία", priority: 12, formatType: "date" },
    {
      key: "requiredPackages",
      label: "Packages",
      priority: 20,
      formatType: "tags",
    },
    { key: "customTags", label: "Tags", priority: 21, formatType: "tags" },
  ],

  figure: [
    ...STANDARD_COLUMNS,
    {
      key: "plotTypeId",
      label: "Τύπος Σχήματος",
      priority: 10,
      formatType: "badge",
    },
    {
      key: "environment",
      label: "Environment",
      priority: 11,
      formatType: "text",
    },
    { key: "caption", label: "Λεζάντα", priority: 12, formatType: "text" },
    {
      key: "description",
      label: "Περιγραφή",
      priority: 13,
      formatType: "text",
    },
    { key: "preambleId", label: "Preamble", priority: 14, formatType: "text" },
    {
      key: "requiredPackages",
      label: "Packages",
      priority: 20,
      formatType: "tags",
    },
  ],

  command: [
    ...STANDARD_COLUMNS,
    { key: "name", label: "Όνομα", priority: 10, formatType: "text" },
    {
      key: "fileTypeId",
      label: "Τύπος Αρχείου",
      priority: 11,
      formatType: "badge",
    },
    {
      key: "macroCommandTypeId",
      label: "Τύπος Macro",
      priority: 12,
      formatType: "badge",
    },
    {
      key: "description",
      label: "Περιγραφή",
      priority: 13,
      formatType: "text",
    },
    { key: "builtIn", label: "Built-in", priority: 14, formatType: "text" },
    {
      key: "requiredPackages",
      label: "Packages",
      priority: 20,
      formatType: "tags",
    },
  ],

  preamble: [
    ...STANDARD_COLUMNS,
    { key: "name", label: "Όνομα", priority: 10, formatType: "text" },
    {
      key: "fileTypeId",
      label: "Τύπος Αρχείου",
      priority: 11,
      formatType: "badge",
    },
    {
      key: "description",
      label: "Περιγραφή",
      priority: 12,
      formatType: "text",
    },
    { key: "builtIn", label: "Built-in", priority: 13, formatType: "text" },
    {
      key: "requiredPackages",
      label: "Packages",
      priority: 20,
      formatType: "tags",
    },
    {
      key: "commandTypes",
      label: "Command Types",
      priority: 21,
      formatType: "tags",
    },
  ],

  class: [
    ...STANDARD_COLUMNS,
    { key: "name", label: "Όνομα", priority: 10, formatType: "text" },
    {
      key: "fileTypeId",
      label: "Τύπος Αρχείου",
      priority: 11,
      formatType: "badge",
    },
    { key: "date", label: "Ημερομηνία", priority: 12, formatType: "date" },
    {
      key: "description",
      label: "Περιγραφή",
      priority: 13,
      formatType: "text",
    },
    { key: "customTags", label: "Tags", priority: 20, formatType: "tags" },
  ],

  dtx: [
    ...STANDARD_COLUMNS,
    { key: "baseName", label: "Base Name", priority: 10, formatType: "text" },
    { key: "version", label: "Έκδοση", priority: 11, formatType: "badge" },
    { key: "date", label: "Ημερομηνία", priority: 12, formatType: "date" },
    {
      key: "description",
      label: "Περιγραφή",
      priority: 13,
      formatType: "text",
    },
    {
      key: "providesClasses",
      label: "Classes",
      priority: 20,
      formatType: "tags",
    },
    {
      key: "providesPackages",
      label: "Packages",
      priority: 21,
      formatType: "tags",
    },
  ],

  ins: [
    ...STANDARD_COLUMNS,
    {
      key: "targetDtxId",
      label: "Target DTX",
      priority: 10,
      formatType: "text",
    },
    {
      key: "generatedFiles",
      label: "Generated Files",
      priority: 11,
      formatType: "tags",
    },
  ],
};

// Kind filter options for the UI
export const KIND_OPTIONS = [
  { value: "all", label: "Όλα" },
  { value: "file", label: "Αρχεία" },
  { value: "document", label: "Έγγραφα" },
  { value: "figure", label: "Σχήματα" },
  { value: "table", label: "Πίνακες" },
  { value: "command", label: "Commands" },
  { value: "preamble", label: "Preambles" },
  { value: "class", label: "Classes" },
  { value: "dtx", label: "DTX (Literate)" },
  { value: "ins", label: "INS (Installer)" },
];

// Get columns for a specific kind, with fallback to standard + discovered columns
export function getColumnsForKind(kind: string): ColumnDef[] {
  return COLUMN_SCHEMAS[kind] || STANDARD_COLUMNS;
}

// Merge schema columns with any extra metadata keys found in resources
export function getColumnsWithDiscoveredMeta(
  kind: string,
  metaKeys: Set<string>
): ColumnDef[] {
  const schemaColumns = getColumnsForKind(kind);
  const schemaKeys = new Set(schemaColumns.map((c) => c.key));

  // Add any metadata keys not already in schema
  const extraColumns: ColumnDef[] = [];
  metaKeys.forEach((key) => {
    if (!schemaKeys.has(key)) {
      extraColumns.push({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        priority: 100, // Low priority for discovered columns
        formatType: "text",
      });
    }
  });

  return [...schemaColumns, ...extraColumns].sort(
    (a, b) => a.priority - b.priority
  );
}

// LocalStorage keys for column preferences
const STORAGE_KEY_VISIBLE_COLUMNS = "datatex-visible-columns";
const STORAGE_KEY_KIND_FILTER = "datatex-kind-filter";

export function loadColumnPreferences(): {
  visibleColumns: string[];
  kindFilter: string;
} {
  try {
    const visibleColumns = JSON.parse(
      localStorage.getItem(STORAGE_KEY_VISIBLE_COLUMNS) || "[]"
    );
    const kindFilter = localStorage.getItem(STORAGE_KEY_KIND_FILTER) || "all";
    return { visibleColumns, kindFilter };
  } catch {
    return { visibleColumns: [], kindFilter: "all" };
  }
}

export function saveColumnPreferences(
  visibleColumns: string[],
  kindFilter: string
): void {
  localStorage.setItem(
    STORAGE_KEY_VISIBLE_COLUMNS,
    JSON.stringify(visibleColumns)
  );
  localStorage.setItem(STORAGE_KEY_KIND_FILTER, kindFilter);
}
