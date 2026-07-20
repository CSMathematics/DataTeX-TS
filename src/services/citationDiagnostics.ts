import { invoke } from "@tauri-apps/api/core";
import {
  resolveResourceIdForModel,
  type BibliographyEntrySummary,
} from "./citationCompletions";

interface CitationOccurrence {
  citationKey: string;
  commandName: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

interface CitationKeyResolutionSummary {
  citation_key: string;
  scan_status: "resolved" | "missing" | "ambiguous";
  entry_count: number;
  entries: BibliographyEntrySummary[];
}

const MARKER_OWNER = "datatex-bibliography";
const DIAGNOSTIC_DEBOUNCE_MS = 650;
const MAX_KEYS_PER_PASS = 300;
const citeCommandPattern =
  /\\([A-Za-z]*cite[A-Za-z]*|nocite)\*?\s*(?:\[[^\]\n]*]\s*){0,2}\{/gi;

export function attachCitationDiagnostics(editor: any, monaco: any) {
  let disposed = false;
  let timeoutId: number | undefined;
  let runId = 0;

  const clear = () => {
    const model = editor.getModel();
    if (model) monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
  };

  const schedule = (delay = DIAGNOSTIC_DEBOUNCE_MS) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      void runDiagnostics();
    }, delay);
  };

  const runDiagnostics = async () => {
    const model = editor.getModel();
    if (!model || disposed || model.getLanguageId?.() !== "my-latex") {
      clear();
      return;
    }

    const occurrences = scanCitationOccurrences(model).slice(
      0,
      MAX_KEYS_PER_PASS,
    );
    if (occurrences.length === 0) {
      clear();
      return;
    }

    const currentRunId = ++runId;
    const citationKeys = Array.from(
      new Set(occurrences.map((occurrence) => occurrence.citationKey)),
    );

    try {
      const resolutions = await invoke<CitationKeyResolutionSummary[]>(
        "resolve_citation_keys_cmd",
        {
          resourceId: resolveResourceIdForModel(model),
          citationKeys,
        },
      );
      if (disposed || currentRunId !== runId) return;

      const byKey = new Map(
        resolutions.map((resolution) => [resolution.citation_key, resolution]),
      );
      const markers = occurrences
        .map((occurrence) => {
          const resolution = byKey.get(occurrence.citationKey);
          if (!resolution || resolution.scan_status === "resolved") {
            return null;
          }

          const isMissing = resolution.scan_status === "missing";
          return {
            severity: isMissing
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info,
            message: isMissing
              ? `Missing bibliography entry: ${occurrence.citationKey}`
              : `Ambiguous citation key: ${occurrence.citationKey} (${resolution.entry_count} matches)`,
            source: "DataTeX bibliography",
            startLineNumber: occurrence.startLineNumber,
            startColumn: occurrence.startColumn,
            endLineNumber: occurrence.endLineNumber,
            endColumn: occurrence.endColumn,
          };
        })
        .filter(Boolean);

      monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
    } catch (error) {
      console.warn("[DataTeX] Citation diagnostics failed:", error);
      if (!disposed && currentRunId === runId) clear();
    }
  };

  const modelDisposable = editor.onDidChangeModel?.(() => schedule(0));
  const contentDisposable = editor.onDidChangeModelContent?.(() => schedule());
  schedule(150);

  return {
    dispose: () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      clear();
      modelDisposable?.dispose?.();
      contentDisposable?.dispose?.();
    },
  };
}

function scanCitationOccurrences(model: any): CitationOccurrence[] {
  const occurrences: CitationOccurrence[] = [];
  const lineCount = model.getLineCount();

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber += 1) {
    const rawLine = model.getLineContent(lineNumber);
    const commentStart = unescapedCommentStart(rawLine);
    const line = commentStart >= 0 ? rawLine.slice(0, commentStart) : rawLine;
    citeCommandPattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = citeCommandPattern.exec(line))) {
      const commandName = match[1] ?? "cite";
      const braceIndex = citeCommandPattern.lastIndex - 1;
      const closeIndex = findUnescaped(line, "}", braceIndex + 1);
      if (closeIndex < 0) break;

      pushCitationKeys(
        line.slice(braceIndex + 1, closeIndex),
        lineNumber,
        braceIndex + 1,
        commandName,
        occurrences,
      );
      citeCommandPattern.lastIndex = closeIndex + 1;
    }
  }

  return occurrences;
}

function pushCitationKeys(
  rawKeys: string,
  lineNumber: number,
  zeroBasedContentStart: number,
  commandName: string,
  occurrences: CitationOccurrence[],
): void {
  let keyStart = 0;
  for (let index = 0; index <= rawKeys.length; index += 1) {
    if (index < rawKeys.length && rawKeys[index] !== ",") continue;

    const segment = rawKeys.slice(keyStart, index);
    const leading = segment.length - segment.trimStart().length;
    const trailing = segment.length - segment.trimEnd().length;
    const trimmedStart = keyStart + leading;
    const trimmedEnd = index - trailing;
    const citationKey = rawKeys.slice(trimmedStart, trimmedEnd);

    if (citationKey && citationKey !== "*") {
      occurrences.push({
        citationKey,
        commandName,
        startLineNumber: lineNumber,
        startColumn: zeroBasedContentStart + trimmedStart + 1,
        endLineNumber: lineNumber,
        endColumn: zeroBasedContentStart + trimmedEnd + 1,
      });
    }

    keyStart = index + 1;
  }
}

function findUnescaped(value: string, needle: string, fromIndex: number): number {
  for (let index = fromIndex; index < value.length; index += 1) {
    if (value[index] === needle && !isEscaped(value, index)) return index;
  }
  return -1;
}

function unescapedCommentStart(value: string): number {
  return findUnescaped(value, "%", 0);
}

function isEscaped(value: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}
