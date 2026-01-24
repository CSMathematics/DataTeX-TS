/**
 * TypeScript type definitions for .dtex file format
 *
 * .dtex files are JSON-based files that combine LaTeX code with database metadata.
 * Format version: 2.0
 */

import { LatexFileMetadata } from "../stores/databaseStore";

/**
 * Complete .dtex file structure
 */
export interface DtexFile {
  /** File format version (always "2.0" for this version) */
  version: string;

  /** Creation timestamp (ISO 8601 format) */
  created: string;

  /** Last modification timestamp (ISO 8601 format) */
  modified: string;

  /** Database information where this file originated */
  database: DtexDatabaseInfo;

  /** File metadata (taxonomy, difficulty, dependencies, etc.) */
  metadata: DtexMetadata;

  /** Bibliography citation keys */
  bibliography: string[];

  /** LaTeX content and encoding */
  content: DtexContent;
}

/**
 * Database information for the .dtex file
 */
export interface DtexDatabaseInfo {
  /** Unique database identifier */
  id: string;

  /** Human-readable database name */
  name: string;

  /** Database type (e.g., "files_database") */
  type: string;

  /** Optional file system path to the database */
  path?: string;

  /** Name of the collection the file belongs to */
  collection?: string;
}

/**
 * Extended metadata for .dtex files
 * Extends the base LatexFileMetadata with .dtex-specific fields
 */
export interface DtexMetadata extends LatexFileMetadata {
  /** Unique file identifier */
  id: string;

  /**
   * File type identifier - matches ResourceType from typedMetadata
   * Supports: file, document, table, figure, command, package, preamble, class, bibliography, dtx, ins
   */
  fileType:
    | "file"
    | "document"
    | "table"
    | "figure"
    | "command"
    | "package"
    | "preamble"
    | "class"
    | "bibliography"
    | "dtx"
    | "ins";

  /** Taxonomical classification (fields, chapters, sections, subsections) */
  taxonomy?: {
    field?: TaxonomyNode;
    chapter?: TaxonomyNode;
    section?: TaxonomyNode;
    subsection?: TaxonomyNode;
  };
}

/**
 * Taxonomy node representing a classification level
 */
export interface TaxonomyNode {
  /** Node identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Parent node identifier */
  parent?: string;
}

/**
 * LaTeX content container
 */
export interface DtexContent {
  /** The actual LaTeX code */
  latex: string;

  /** Character encoding (typically "utf-8") */
  encoding: string;
}

/**
 * Validation result for .dtex files
 */
export interface DtexValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Options for creating a new .dtex file
 */
export interface CreateDtexOptions {
  /** Source LaTeX content */
  latexContent: string;

  /** Metadata to include */
  metadata: DtexMetadata;

  /** Database info (optional, can be inferred) */
  database?: DtexDatabaseInfo;

  /** Bibliography keys */
  bibliography?: string[];
}
