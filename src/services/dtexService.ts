/**
 * Service for handling .dtex file operations
 *
 * Provides methods for:
 * - Parsing .dtex files from disk
 * - Serializing .dtex files to disk
 * - Converting between .tex and .dtex formats
 * - Auto-saving metadata changes with debouncing
 */

import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { debounce } from "lodash";
import {
  DtexFile,
  DtexMetadata,
  DtexDatabaseInfo,
  CreateDtexOptions,
  DtexValidationResult,
} from "../types/dtex";

/**
 * Main service class for .dtex file operations
 */
export class DtexService {
  /**
   * Parse a .dtex file from disk
   * @param filePath Absolute path to the .dtex file
   * @returns Parsed DtexFile object
   * @throws Error if file cannot be read or JSON is invalid
   */
  static async parse(filePath: string): Promise<DtexFile> {
    try {
      const content = await readTextFile(filePath);
      const dtexFile = JSON.parse(content) as DtexFile;

      // Validate basic structure
      if (!dtexFile.version || !dtexFile.content || !dtexFile.metadata) {
        throw new Error(
          "Invalid .dtex file structure: missing required fields",
        );
      }

      return dtexFile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in .dtex file: ${error.message}`);
      }
      throw new Error(`Failed to read .dtex file: ${String(error)}`);
    }
  }

  /**
   * Serialize and save a .dtex file to disk
   * @param filePath Absolute path where to save the file
   * @param dtexFile Complete DtexFile object to save
   * @throws Error if file cannot be written
   */
  static async serialize(filePath: string, dtexFile: DtexFile): Promise<void> {
    try {
      // Update modification timestamp
      const updated: DtexFile = {
        ...dtexFile,
        modified: new Date().toISOString(),
      };

      // Serialize with pretty printing for readability
      const jsonContent = JSON.stringify(updated, null, 2);

      await writeTextFile(filePath, jsonContent);
    } catch (error) {
      throw new Error(`Failed to save .dtex file: ${String(error)}`);
    }
  }

  /**
   * Create a new .dtex file from options
   * @param options Options for creating the .dtex file
   * @returns New DtexFile object (not yet saved to disk)
   */
  static createNew(options: CreateDtexOptions): DtexFile {
    const now = new Date().toISOString();

    return {
      version: "2.0",
      created: now,
      modified: now,
      database: options.database || {
        id: "default",
        name: "Default Database",
        type: "files_database",
      },
      metadata: options.metadata,
      bibliography: options.bibliography || [],
      content: {
        latex: options.latexContent,
        encoding: "utf-8",
      },
    };
  }

  /**
   * Export a .dtex file back to plain .tex (content only)
   * @param dtexFile The DtexFile to export
   * @param outputPath Path where to save the .tex file
   */
  static async exportToTex(
    dtexFile: DtexFile,
    outputPath: string,
  ): Promise<void> {
    try {
      await writeTextFile(outputPath, dtexFile.content.latex);
    } catch (error) {
      throw new Error(`Failed to export to .tex: ${String(error)}`);
    }
  }

  /**
   * Validate a .dtex file structure
   * @param dtexFile The file to validate
   * @returns Validation result with errors and warnings
   */
  static validate(dtexFile: DtexFile): DtexValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check version
    if (!dtexFile.version) {
      errors.push("Missing version field");
    } else if (dtexFile.version !== "2.0") {
      warnings.push(`Unknown version: ${dtexFile.version}`);
    }

    // Check required fields
    if (!dtexFile.content) {
      errors.push("Missing content field");
    } else {
      if (!dtexFile.content.latex) {
        errors.push("Missing LaTeX content");
      }
      if (!dtexFile.content.encoding) {
        warnings.push("Missing encoding field, assuming utf-8");
      }
    }

    if (!dtexFile.metadata) {
      errors.push("Missing metadata field");
    } else {
      if (!dtexFile.metadata.id) {
        errors.push("Missing metadata.id");
      }
      if (!dtexFile.metadata.fileType) {
        warnings.push("Missing metadata.fileType");
      }
    }

    if (!dtexFile.database) {
      warnings.push("Missing database information");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Save only the metadata portion of a .dtex file (for auto-save)
   * This reads the existing file, updates metadata, and writes back
   * @param filePath Path to the .dtex file
   * @param metadata Updated metadata
   */
  static async saveMetadata(
    filePath: string,
    metadata: DtexMetadata,
  ): Promise<void> {
    try {
      // Read existing file
      const dtexFile = await this.parse(filePath);

      // Update metadata
      dtexFile.metadata = metadata;
      dtexFile.modified = new Date().toISOString();

      // Save back
      await this.serialize(filePath, dtexFile);
    } catch (error) {
      console.error("Failed to save metadata:", error);
      throw error;
    }
  }

  /**
   * Save only the LaTeX content portion of a .dtex file (for manual save)
   * This reads the existing file, updates content, and writes back
   * @param filePath Path to the .dtex file
   * @param latexContent Updated LaTeX content
   */
  static async saveContent(
    filePath: string,
    latexContent: string,
  ): Promise<void> {
    try {
      // Read existing file
      const dtexFile = await this.parse(filePath);

      // Update content
      dtexFile.content.latex = latexContent;
      dtexFile.modified = new Date().toISOString();

      // Save back
      await this.serialize(filePath, dtexFile);
    } catch (error) {
      console.error("Failed to save content:", error);
      throw error;
    }
  }

  /**
   * Debounced version of saveMetadata for auto-save functionality
   * Waits 2 seconds after the last call before actually saving
   */
  static debouncedSaveMetadata = debounce(
    async (filePath: string, metadata: DtexMetadata) => {
      await DtexService.saveMetadata(filePath, metadata);
    },
    2000, // 2 second debounce
    { leading: false, trailing: true },
  );

  /**
   * Cancel any pending debounced saves
   */
  static cancelPendingSaves(): void {
    this.debouncedSaveMetadata.cancel();
  }

  /**
   * Create a new .dtex file from an existing .tex file
   * @param sourcePath Absolute path to the .tex file
   * @param databaseInfo Optional database info to associate with the file
   * @returns Path to the created .dtex file
   */
  static async createFromTexFile(
    sourcePath: string,
    databaseInfo?: DtexDatabaseInfo,
  ): Promise<string> {
    try {
      // 1. Read source content
      const latexContent = await readTextFile(sourcePath);

      // 2. Generate target path (.dtex)
      const targetPath = sourcePath.replace(/\.tex$/i, ".dtex");

      // 3. Create default metadata
      const now = new Date().toISOString();
      const fileName = sourcePath.split(/[/\\]/).pop() || "unknown.tex";

      const metadata: DtexMetadata = {
        id: crypto.randomUUID(),
        fileType: "file",
        description: `Exported from ${fileName}`,
        difficulty: 0,
      };

      // 4. Create DtexFile structure
      const dtexFile: DtexFile = {
        version: "2.0",
        created: now,
        modified: now,
        database: databaseInfo || {
          id: "local",
          name: "Local Export",
          type: "local",
        },
        metadata: metadata,
        bibliography: [],
        content: {
          latex: latexContent,
          encoding: "utf-8",
        },
      };

      // 5. Serialize to disk
      await this.serialize(targetPath, dtexFile);

      return targetPath;
    } catch (error) {
      console.error("Failed to export to .dtex:", error);
      throw error;
    }
  }
}
