import { invoke } from "@tauri-apps/api/core";

// Search query parameters
export interface SearchQuery {
  query: string;
  caseSensitive: boolean;
  useRegex: boolean;
  fileTypes: string[];
  collections: string[];
  maxResults: number;
}

// A single search match
export interface SearchMatch {
  resource_id: string;
  file_path: string;
  file_name: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
  context_before: string[];
  context_after: string[];
}

// Complete search result
export interface SearchResult {
  matches: SearchMatch[];
  total_files_searched: number;
  search_duration_ms: number;
}

/**
 * Search across database files
 */
export async function searchDatabaseFiles(
  query: SearchQuery
): Promise<SearchResult> {
  return await invoke<SearchResult>("search_database_files", {
    query: query.query,
    caseSensitive: query.caseSensitive,
    useRegex: query.useRegex,
    fileTypes: query.fileTypes,
    collections: query.collections,
    maxResults: query.maxResults,
  });
}

// Replace result
export interface ReplaceResult {
  total_files_changed: number;
  total_replacements: number;
  replace_duration_ms: number;
}

// Replace query parameters
export interface ReplaceQuery extends SearchQuery {
  replaceWith: string;
}

/**
 * Replace text across database files
 */
export async function replaceDatabaseFiles(
  query: ReplaceQuery
): Promise<ReplaceResult> {
  return await invoke<ReplaceResult>("replace_database_files", {
    query: query.query,
    replaceWith: query.replaceWith,
    caseSensitive: query.caseSensitive,
    useRegex: query.useRegex,
    fileTypes: query.fileTypes,
    collections: query.collections,
  });
}
