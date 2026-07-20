import { invoke } from "@tauri-apps/api/core";
import { useDatabaseStore, type Resource } from "../stores/databaseStore";
import { useTabsStore } from "../stores/useTabsStore";

export interface BibliographyEntrySummary {
  id: string;
  source_id: string;
  entry_type: string;
  citation_key: string;
  title?: string | null;
  year?: string | null;
  date?: string | null;
  doi?: string | null;
  url?: string | null;
  fields?: Record<string, unknown>;
}

interface CitationContext {
  query: string;
  range: {
    startLineNumber: number;
    endLineNumber: number;
    startColumn: number;
    endColumn: number;
  };
}

interface CitationKeyContext extends CitationContext {
  key: string;
}

const citationPrefixPattern =
  /\\([A-Za-z]*cite[A-Za-z]*|nocite)\*?\s*(?:\[[^\]]*]){0,2}\s*\{([^{}]*)$/i;
const LATEX_LANGUAGE_ID = "my-latex";
const citationCache = new Map<
  string,
  { createdAt: number; entries: BibliographyEntrySummary[] }
>();
const registeredMonacoInstances = new WeakSet<object>();
const CACHE_TTL_MS = 12_000;
const MAX_CACHE_KEYS = 80;

export function registerCitationProviders(monaco: any): void {
  if (!monaco || registeredMonacoInstances.has(monaco)) return;
  registeredMonacoInstances.add(monaco);

  monaco.languages.registerCompletionItemProvider(LATEX_LANGUAGE_ID, {
    triggerCharacters: ["{", ","],
    provideCompletionItems: async (model: any, position: any) => {
      const context = getCitationContext(model, position, monaco);
      if (!context) return { suggestions: [] };

      try {
        const resourceId = resolveResourceIdForModel(model);
        const entries = await searchBibliographyEntries(
          resourceId,
          context.query,
          100,
        );

        return {
          suggestions: entries.map((entry, index) =>
            toCompletionItem(entry, index, context.range, monaco),
          ),
        };
      } catch (error) {
        console.warn("[DataTeX] Citation completion failed:", error);
        return { suggestions: [] };
      }
    },
  });

  monaco.languages.registerHoverProvider(LATEX_LANGUAGE_ID, {
    provideHover: async (model: any, position: any) => {
      const context = getCitationKeyContext(model, position, monaco);
      if (!context) return null;

      try {
        const resourceId = resolveResourceIdForModel(model);
        const entries = await searchBibliographyEntries(
          resourceId,
          context.key,
          20,
        );
        const entry = entries.find(
          (candidate) => candidate.citation_key === context.key,
        );
        if (!entry) return null;

        return {
          range: new monaco.Range(
            context.range.startLineNumber,
            context.range.startColumn,
            context.range.endLineNumber,
            context.range.endColumn,
          ),
          contents: [{ value: bibliographyMarkdown(entry) }],
        };
      } catch (error) {
        console.warn("[DataTeX] Citation hover failed:", error);
        return null;
      }
    },
  });
}

async function searchBibliographyEntries(
  resourceId: string | null,
  query: string,
  limit: number,
): Promise<BibliographyEntrySummary[]> {
  const normalizedQuery = query.trim();
  const cacheKey = `${resourceId ?? "global"}:${normalizedQuery.toLowerCase()}:${limit}`;
  const cached = citationCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.entries;
  }

  const entries = await invoke<BibliographyEntrySummary[]>(
    "search_bibliography_entries_cmd",
    {
      resourceId,
      query: normalizedQuery,
      limit,
    },
  );

  citationCache.set(cacheKey, { createdAt: Date.now(), entries });
  while (citationCache.size > MAX_CACHE_KEYS) {
    const oldestKey = citationCache.keys().next().value;
    if (!oldestKey) break;
    citationCache.delete(oldestKey);
  }
  return entries;
}

function toCompletionItem(
  entry: BibliographyEntrySummary,
  index: number,
  range: CitationContext["range"],
  monaco: any,
) {
  const kind =
    monaco.languages.CompletionItemKind.Reference ??
    monaco.languages.CompletionItemKind.Text;
  const year = entry.year || entry.date;
  const author = fieldString(entry, "author") || fieldString(entry, "editor");
  const detail = [
    `@${entry.entry_type}`,
    year,
    author ? compactText(author, 80) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    label: entry.citation_key,
    kind,
    insertText: entry.citation_key,
    detail,
    documentation: {
      value: bibliographyMarkdown(entry),
      isTrusted: false,
    },
    sortText: `${index.toString().padStart(4, "0")}-${entry.citation_key}`,
    filterText: entry.citation_key,
    range,
  };
}

function bibliographyMarkdown(entry: BibliographyEntrySummary): string {
  const title = entry.title || fieldString(entry, "title");
  const author = fieldString(entry, "author") || fieldString(entry, "editor");
  const year = entry.year || entry.date || fieldString(entry, "year");
  const parts = [
    `**${escapeMarkdown(entry.citation_key)}**  `,
    `\`@${escapeMarkdown(entry.entry_type)}\``,
  ];

  if (title) parts.push(`\n\n${escapeMarkdown(compactText(title, 240))}`);
  if (author) parts.push(`\n\n_${escapeMarkdown(compactText(author, 180))}_`);
  if (year) parts.push(`\n\nYear: ${escapeMarkdown(year)}`);
  if (entry.doi) parts.push(`\n\nDOI: ${escapeMarkdown(entry.doi)}`);
  if (entry.url) parts.push(`\n\nURL: ${escapeMarkdown(entry.url)}`);

  return parts.join("");
}

function getCitationContext(
  model: any,
  position: any,
  monaco: any,
): CitationContext | null {
  const line = model.getLineContent(position.lineNumber);
  const beforeCursor = line.slice(0, position.column - 1);
  if (unescapedCommentStart(beforeCursor) !== -1) return null;

  const match = beforeCursor.match(citationPrefixPattern);
  if (!match) return null;

  const citationContent = match[2] ?? "";
  const previousComma = citationContent.lastIndexOf(",");
  const rawFragment = citationContent.slice(previousComma + 1);
  const query = rawFragment.trimStart();
  const startColumn = position.column - query.length;

  return {
    query,
    range: new monaco.Range(
      position.lineNumber,
      startColumn,
      position.lineNumber,
      position.column,
    ),
  };
}

function getCitationKeyContext(
  model: any,
  position: any,
  monaco: any,
): CitationKeyContext | null {
  const context = getCitationContext(model, position, monaco);
  if (!context) return null;

  const line = model.getLineContent(position.lineNumber);
  const suffix = line.slice(position.column - 1);
  const rightKey = suffix.match(/^[^,\}\s]*/)?.[0] ?? "";
  const key = `${context.query}${rightKey}`.trim();
  if (!key) return null;

  return {
    ...context,
    key,
    range: new monaco.Range(
      context.range.startLineNumber,
      context.range.startColumn,
      context.range.endLineNumber,
      position.column + rightKey.length,
    ),
  };
}

export function resolveResourceIdForModel(model: any): string | null {
  const resources = uniqueResources([
    ...useDatabaseStore.getState().allLoadedResources,
    ...useDatabaseStore.getState().resources,
  ]);
  const candidates = modelPathCandidates(model);

  for (const candidate of candidates) {
    const match = resources.find(
      (resource) =>
        normalizePath(resource.id) === candidate ||
        normalizePath(resource.path) === candidate,
    );
    if (match) return match.id;
  }

  const tabsState = useTabsStore.getState();
  const activeTab = tabsState.tabs.find(
    (tab) => tab.id === tabsState.activeTabId,
  );
  if (!activeTab) return null;

  const activeTabPath = normalizePath(activeTab.id);
  const activeResource = resources.find(
    (resource) =>
      normalizePath(resource.id) === activeTabPath ||
      normalizePath(resource.path) === activeTabPath,
  );
  return activeResource?.id ?? activeTab.dtexMetadata?.id ?? null;
}

function uniqueResources(resources: Resource[]): Resource[] {
  const byId = new Map<string, Resource>();
  for (const resource of resources) byId.set(resource.id, resource);
  return Array.from(byId.values());
}

function modelPathCandidates(model: any): string[] {
  const uri = model?.uri;
  return [
    uri?.fsPath,
    uri?.path,
    typeof uri?.toString === "function" ? uri.toString() : null,
  ]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map(normalizePath)
    .filter(Boolean);
}

function normalizePath(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  return decoded
    .replace(/^file:\/\//, "")
    .replace(/^inmemory:\/\/model\//, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");
}

function fieldString(
  entry: BibliographyEntrySummary,
  fieldName: string,
): string | null {
  const value = entry.fields?.[fieldName];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compactText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}\[\]()#+\-.!|]/g, "\\$&");
}

function unescapedCommentStart(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "%" && !isEscaped(value, index)) return index;
  }
  return -1;
}

function isEscaped(value: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}
