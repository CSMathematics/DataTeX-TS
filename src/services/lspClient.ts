import { invoke } from "@tauri-apps/api/core";

/**
 * Convert a file path to a properly encoded file:// URI
 * Handles non-ASCII characters (Greek, etc.) correctly
 */
function pathToUri(path: string): string {
  // Remove existing file:// prefix if present
  const cleanPath = path.replace(/^file:\/\//, "");
  // Encode each path segment while preserving slashes
  const encoded = cleanPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `file://${encoded}`;
}

/**
 * LSP Completion Item Kind - Monaco compatible
 */
export enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
}

/**
 * LSP Completion Item
 */
export interface CompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string | { value: string; kind?: string };
  insertText?: string;
  insertTextFormat?: number;
  sortText?: string;
  filterText?: string;
}

/**
 * LSP Hover Response
 */
export interface Hover {
  contents:
    | string
    | { value: string; kind?: string }
    | Array<{ value: string; kind?: string }>;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

/**
 * LSP Location
 */
export interface Location {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

/**
 * Texlab LSP Client
 * Provides intelligent autocomplete and language features for LaTeX
 */
export class TexlabLspClient {
  private initialized = false;
  private documentVersion = new Map<string, number>();

  /**
   * Initialize the LSP server with workspace root
   */
  async initialize(rootUri: string): Promise<void> {
    try {
      const encodedUri = pathToUri(rootUri);
      await invoke("lsp_initialize", { rootUri: encodedUri });
      this.initialized = true;
    } catch (error) {
      console.error("❌ Failed to initialize Texlab LSP:", error);
      throw error;
    }
  }

  /**
   * Get completion suggestions at cursor position
   */
  async completion(
    uri: string,
    line: number,
    character: number,
  ): Promise<CompletionItem[]> {
    if (!this.initialized) {
      console.warn("⚠️ LSP not initialized, skipping completion");
      return [];
    }

    try {
      // LSP uses 0-based line numbers, Monaco uses 1-based
      const encodedUri = pathToUri(uri);
      const result = await invoke<any>("lsp_completion", {
        uri: encodedUri,
        line: line - 1,
        character,
      });

      // Parse LSP completion response
      if (!result) {
        console.warn("⚠️ LSP returned null/undefined result");
        return [];
      }

      // Handle both CompletionList and CompletionItem[] formats
      const items = Array.isArray(result) ? result : result.items || [];

      return items.map((item: any) => ({
        label: item.label,
        kind: item.kind || CompletionItemKind.Text,
        detail: item.detail,
        documentation: item.documentation,
        insertText: item.insertText || item.label,
        insertTextFormat: item.insertTextFormat,
        sortText: item.sortText,
        filterText: item.filterText,
      }));
    } catch (error) {
      console.error("❌ LSP Completion error:", error);
      return [];
    }
  }

  /**
   * Get hover documentation at cursor position
   */
  async hover(
    uri: string,
    line: number,
    character: number,
  ): Promise<Hover | null> {
    if (!this.initialized) return null;

    try {
      const encodedUri = pathToUri(uri);
      const result = await invoke<any>("lsp_hover", {
        uri: encodedUri,
        line: line - 1,
        character,
      });

      if (!result || !result.contents) return null;

      return {
        contents: result.contents,
        range: result.range,
      };
    } catch (error) {
      console.error("Hover error:", error);
      return null;
    }
  }

  /**
   * Get definition location (go to definition)
   */
  async definition(
    uri: string,
    line: number,
    character: number,
  ): Promise<Location | null> {
    if (!this.initialized) return null;

    try {
      const encodedUri = pathToUri(uri);
      const result = await invoke<any>("lsp_definition", {
        uri: encodedUri,
        line: line - 1,
        character,
      });

      if (!result) return null;

      // Handle both single Location and Location[] responses
      const location = Array.isArray(result) ? result[0] : result;

      return location || null;
    } catch (error) {
      console.error("Definition error:", error);
      return null;
    }
  }

  /**
   * Notify LSP that a document was opened
   */
  async didOpen(uri: string, languageId: string, text: string): Promise<void> {
    if (!this.initialized) {
      console.warn("⚠️ LSP not initialized, skipping didOpen");
      return;
    }

    try {
      const version = 1;
      const encodedUri = pathToUri(uri);
      this.documentVersion.set(uri, version);

      await invoke("lsp_did_open", {
        uri: encodedUri,
        languageId,
        version,
        text,
      });
    } catch (error) {
      console.error("❌ didOpen error:", error);
    }
  }

  /**
   * Notify LSP that a document was changed
   */
  async didChange(uri: string, text: string): Promise<void> {
    if (!this.initialized) {
      console.warn("⚠️ LSP not initialized, skipping didChange");
      return;
    }

    try {
      const version = (this.documentVersion.get(uri) || 0) + 1;
      const encodedUri = pathToUri(uri);
      this.documentVersion.set(uri, version);

      await invoke("lsp_did_change", {
        uri: encodedUri,
        version,
        text,
      });
    } catch (error) {
      console.error("❌ didChange error:", error);
    }
  }

  /**
   * Shutdown the LSP server
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    try {
      await invoke("lsp_shutdown");
      this.initialized = false;
      this.documentVersion.clear();
    } catch (error) {
      console.error("Shutdown error:", error);
    }
  }

  /**
   * Check if LSP is initialized and ready
   */
  isReady(): boolean {
    return this.initialized;
  }
}
