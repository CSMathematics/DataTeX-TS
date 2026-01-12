// ============================================================================
// Typed Metadata Interfaces
// TypeScript definitions matching Rust backend types
// ============================================================================

// ============================================================================
// File Metadata
// ============================================================================

export interface FileMetadata {
  fileTypeId?: string;
  fieldId?: string;
  difficulty?: number; // 1-5
  date?: string;
  solvedProoved?: boolean;
  solutionId?: string;
  bibliography?: string;
  fileContent?: string;
  preambleId?: string;
  buildCommand?: string;
  fileDescription?: string;
  // Arrays (junction tables)
  chapters?: string[];
  sections?: string[];
  subsections?: string[]; // NEW: 4th level
  exerciseTypes?: string[];
  requiredPackages?: string[];
  customTags?: string[];
  bibEntries?: string[];
}

// ============================================================================
// Document Metadata
// ============================================================================

export interface IncludedFile {
  fileId: string;
  orderIndex: number;
  filesDatabaseSource?: string;
  databaseType?: number;
}

export interface DocumentMetadata {
  title?: string;
  documentTypeId?: string;
  // Hierarchy fields (replacing basicFolder/subFolder/subsubFolder)
  fieldId?: string;
  chapters?: string[];
  sections?: string[];
  subsections?: string[];
  // Legacy folder fields (kept for backwards compatibility, auto-filled)
  basicFolder?: string;
  subFolder?: string;
  subsubFolder?: string;
  // Other fields
  date?: string;
  content?: string;
  preambleId?: string;
  buildCommand?: string;
  bibliography?: string;
  description?: string;
  solutionDocumentId?: string;
  // Arrays
  includedFiles?: IncludedFile[];
  customTags?: string[];
  bibEntries?: string[];
}

// ============================================================================
// Table Metadata
// ============================================================================

export interface TableMetadata {
  tableTypeId?: string;
  date?: string;
  content?: string;
  caption?: string;
  description?: string;

  // LaTeX specifics
  environment?: string; // tabular, tabularx, longtable, tabularray
  placement?: string;
  label?: string;
  width?: string;
  alignment?: string;

  // Dimensions
  rows?: number;
  columns?: number;

  // Arrays
  requiredPackages?: string[];
  customTags?: string[];
}

// ============================================================================
// Figure Metadata
// ============================================================================

export interface FigureMetadata {
  figureTypeId?: string;
  environment?: string;
  date?: string;
  content?: string;
  caption?: string;
  preambleId?: string;
  buildCommand?: string;
  description?: string;
  // Layout & Dimensions
  width?: string;
  height?: string;
  options?: string;
  tikzStyle?: string;
  label?: string;
  placement?: string;
  alignment?: string;
  // Arrays
  requiredPackages?: string[];
  customTags?: string[];
}

export interface FigureType {
  id: string;
  name: string;
  description?: string;
}

// ============================================================================
// Command Metadata
// ============================================================================

export interface CommandMetadata {
  name?: string;
  commandTypeId?: string;
  argumentsNum?: number;
  optionalArgument?: string;
  content?: string;
  example?: string;
  description?: string;
  builtIn?: boolean;
  // Arrays
  requiredPackages?: string[];
  customTags?: string[];
}

export interface CommandType {
  id: string;
  name: string;
  description?: string;
}

// ============================================================================
// Package Metadata
// ============================================================================

export interface PackageMetadata {
  name?: string;
  topicId?: string;
  date?: string;
  content?: string;
  description?: string;
  options?: string;
  builtIn?: boolean;
  documentation?: string;
  example?: string;
  // Arrays
  requiredPackages?: string[];
  topics?: string[];
  providedCommands?: string[];
  customTags?: string[];
}

// ============================================================================
// Preamble Metadata
// ============================================================================

export interface PreambleMetadata {
  name?: string;
  preambleTypeId?: string;
  content?: string;
  description?: string;
  builtIn?: boolean;
  // Enriched fields
  engines?: string;
  date?: string;
  className?: string; // Mapped from 'class' in DB
  paperSize?: string;
  fontSize?: number;
  options?: string;
  languages?: string;
  geometry?: string;
  author?: string;
  title?: string;
  // Booleans
  useBibliography?: boolean;
  bibCompileEngine?: string;
  makeIndex?: boolean;
  makeGlossaries?: boolean;
  hasToc?: boolean;
  hasLot?: boolean;
  hasLof?: boolean;
  // Arrays
  requiredPackages?: string[];
  commandTypes?: string[];
  providedCommands?: string[];
}

// ============================================================================
// Class Metadata
// ============================================================================

export interface ClassMetadata {
  name?: string;
  fileTypeId?: string;
  date?: string;
  content?: string;
  description?: string;
  // Enriched fields
  engines?: string;
  paperSize?: string;
  fontSize?: number;
  geometry?: string;
  options?: string;
  languages?: string;
  // Arrays
  customTags?: string[];
  requiredPackages?: string[];
  providedCommands?: string[];
}

// ============================================================================
// Bibliography Metadata
// ============================================================================

export interface BibliographyPerson {
  role: "author" | "editor" | "translator";
  fullName: string;
}

export interface BibliographyMetadata {
  entryType?: string; // article, book, etc.
  citationKey?: string;

  // Periodic / Series
  journal?: string;
  volume?: string;
  series?: string;
  number?: string;
  issue?: string;

  // Date
  year?: string;
  month?: string;

  // Publication
  publisher?: string;
  edition?: string;
  institution?: string;
  school?: string;
  organization?: string;
  address?: string;
  location?: string;

  // Identification
  isbn?: string;
  issn?: string;
  doi?: string;
  url?: string;
  language?: string;

  // Content
  title?: string;
  subtitle?: string;
  booktitle?: string;
  chapter?: string;
  pages?: string;
  abstract?: string;
  note?: string; // Description/Note
  crossref?: string;

  // Lists
  authors?: string[]; // Simplified for UI, mapped to persons in DB
  editors?: string[];
  translators?: string[];

  // Extras
  extras?: Record<string, string>; // Custom fields
}

// ============================================================================
// DTX & INS Metadata (Literate Programming)
// ============================================================================

export interface DtxMetadata {
  baseName?: string;
  version?: string;
  date?: string;
  description?: string;
  providesClasses?: string; // JSON string
  providesPackages?: string; // JSON string
  documentationChecksum?: string;
}

export interface InsMetadata {
  targetDtxId?: string;
  generatedFiles?: string; // JSON string
}

// ============================================================================
// Unified TypedMetadata Union
// ============================================================================

export type TypedMetadata =
  | { type: "file"; data: FileMetadata }
  | { type: "document"; data: DocumentMetadata }
  | { type: "bibliography"; data: BibliographyMetadata }
  | { type: "table"; data: TableMetadata }
  | { type: "figure"; data: FigureMetadata }
  | { type: "command"; data: CommandMetadata }
  | { type: "package"; data: PackageMetadata }
  | { type: "preamble"; data: PreambleMetadata }
  | { type: "class"; data: ClassMetadata }
  | { type: "dtx"; data: DtxMetadata }
  | { type: "ins"; data: InsMetadata };

// ============================================================================
// Lookup Data Types
// ============================================================================

export interface Field {
  id: string;
  name: string;
  description?: string;
}

export interface Chapter {
  id: string;
  name: string;
  fieldId: string;
}

export interface Section {
  id: string;
  name: string;
  chapterId: string;
}

export interface Subsection {
  id: string;
  name: string;
  sectionId: string;
}

export interface ExerciseType {
  id: string;
  name: string;
  description?: string;
}

export interface FileType {
  id: string;
  name: string;
  folderName?: string;
  solvable?: boolean;
  description?: string;
}

export interface DocumentType {
  id: string;
  name: string;
  description?: string;
}

export interface TableType {
  id: string;
  name: string;
  description?: string;
}

export interface CustomTag {
  tag: string;
  createdAt?: string;
}

export interface PreambleType {
  id: string;
  name: string;
  description?: string;
}

export interface TeXLivePackage {
  id: string;
  description?: string;
}

export interface PackageTopic {
  id: string;
  name: string;
  description?: string;
}

export interface MacroCommandType {
  id: string;
  name: string;
  description?: string;
}

// ============================================================================
// Resource with Typed Metadata
// ============================================================================

export interface ResourceWithTypedMetadata {
  id: string;
  path: string;
  type: string;
  collection: string;
  title?: string;
  contentHash?: string;
  createdAt: string;
  updatedAt: string;
  typedMetadata?: TypedMetadata;
}

// ============================================================================
// Helper Types
// ============================================================================

export type ResourceType =
  | "file"
  | "document"
  | "bibliography"
  | "table"
  | "figure"
  | "command"
  | "package"
  | "preamble"
  | "class"
  | "dtx"
  | "ins";

export type MetadataByType<T extends ResourceType> = T extends "file"
  ? FileMetadata
  : T extends "document"
  ? DocumentMetadata
  : T extends "bibliography"
  ? BibliographyMetadata
  : T extends "table"
  ? TableMetadata
  : T extends "figure"
  ? FigureMetadata
  : T extends "command"
  ? CommandMetadata
  : T extends "package"
  ? PackageMetadata
  : T extends "preamble"
  ? PreambleMetadata
  : T extends "class"
  ? ClassMetadata
  : T extends "dtx"
  ? DtxMetadata
  : T extends "ins"
  ? InsMetadata
  : never;
