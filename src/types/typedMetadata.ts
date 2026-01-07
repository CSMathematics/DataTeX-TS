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
  basicFolder?: string;
  subFolder?: string;
  subsubFolder?: string;
  date?: string;
  content?: string;
  preambleId?: string;
  buildCommand?: string;
  needsUpdate?: boolean;
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
  // Arrays
  requiredPackages?: string[];
  customTags?: string[];
}

// ============================================================================
// Figure Metadata
// ============================================================================

export interface FigureMetadata {
  plotTypeId?: string;
  environment?: string;
  date?: string;
  content?: string;
  caption?: string;
  preambleId?: string;
  buildCommand?: string;
  description?: string;
  // Arrays
  requiredPackages?: string[];
  customTags?: string[];
}

// ============================================================================
// Command Metadata
// ============================================================================

export interface CommandMetadata {
  name?: string;
  fileTypeId?: string;
  content?: string;
  description?: string;
  builtIn?: boolean;
  macroCommandTypeId?: string;
  // Arrays
  requiredPackages?: string[];
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
  // Arrays
  dependencies?: string[];
  topics?: string[];
}

// ============================================================================
// Preamble Metadata
// ============================================================================

export interface PreambleMetadata {
  name?: string;
  fileTypeId?: string;
  content?: string;
  description?: string;
  builtIn?: boolean;
  // Arrays
  requiredPackages?: string[];
  commandTypes?: string[];
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
  // Arrays
  customTags?: string[];
}

// ============================================================================
// Unified TypedMetadata Union
// ============================================================================

export type TypedMetadata =
  | { type: "file"; data: FileMetadata }
  | { type: "document"; data: DocumentMetadata }
  | { type: "table"; data: TableMetadata }
  | { type: "figure"; data: FigureMetadata }
  | { type: "command"; data: CommandMetadata }
  | { type: "package"; data: PackageMetadata }
  | { type: "preamble"; data: PreambleMetadata }
  | { type: "class"; data: ClassMetadata };

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

export interface CustomTag {
  tag: string;
  createdAt?: string;
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
  | "class";

export type MetadataByType<T extends ResourceType> = T extends "file"
  ? FileMetadata
  : T extends "document"
  ? DocumentMetadata
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
  : never;
