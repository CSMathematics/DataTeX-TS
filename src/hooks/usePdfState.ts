import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

const PDF_SOURCE_EXTENSION = /\.(?:tex|sty|cls|bib|dtx|ins)$/i;
const PDF_MIN_STABLE_AGE_MS = 120;
const PDF_HEADER_SCAN_BYTES = 1_024;
const PDF_EOF_SCAN_BYTES = 16 * 1_024;
const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const PDF_EOF = new Uint8Array([0x25, 0x25, 0x45, 0x4f, 0x46]);

const toPdfPath = (path: string) =>
  PDF_SOURCE_EXTENSION.test(path)
    ? path.replace(PDF_SOURCE_EXTENSION, ".pdf")
    : null;

const containsBytes = (
  data: Uint8Array,
  pattern: Uint8Array,
  start: number,
  end: number,
) => {
  const lastStart = Math.min(end, data.byteLength) - pattern.byteLength;
  for (let offset = Math.max(0, start); offset <= lastStart; offset += 1) {
    let matches = true;
    for (let index = 0; index < pattern.byteLength; index += 1) {
      if (data[offset + index] !== pattern[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
};

const validatePdfSnapshot = (data: Uint8Array) => {
  if (data.byteLength === 0) {
    throw new Error("The generated PDF is empty.");
  }
  if (
    !containsBytes(
      data,
      PDF_HEADER,
      0,
      Math.min(data.byteLength, PDF_HEADER_SCAN_BYTES),
    )
  ) {
    throw new Error("The generated PDF header is incomplete.");
  }
  if (
    !containsBytes(
      data,
      PDF_EOF,
      Math.max(0, data.byteLength - PDF_EOF_SCAN_BYTES),
      data.byteLength,
    )
  ) {
    throw new Error("The generated PDF is not complete yet.");
  }
};

const fileTime = (value: Date | null) =>
  value ? new Date(value).getTime() : null;

interface UsePdfStateOptions {
  activeTab: any;
  isTexFile: boolean;
  pdfRefreshTrigger: number;
  setCompileError: (error: string | null) => void;
  onRequirePanelOpen?: () => void;
}

interface UsePdfStateReturn {
  pdfPath: string | null;
  pdfUrl: string | null;
  pdfLoading: boolean;
  syncTexCoords: {
    page: number;
    x: number;
    y: number;
    requestId?: number;
  } | null;
  setSyncTexCoords: React.Dispatch<
    React.SetStateAction<{
      page: number;
      x: number;
      y: number;
      requestId?: number;
    } | null>
  >;
  handleSyncTexForward: (line: number, column: number) => Promise<void>;
  handleSyncTexInverse: (
    page: number,
    x: number,
    y: number,
  ) => Promise<{ file: string; line: number } | null>;
}

export function usePdfState({
  activeTab,
  isTexFile,
  pdfRefreshTrigger,
  setCompileError,
  onRequirePanelOpen,
}: UsePdfStateOptions): UsePdfStateReturn {
  const expectedPdfPath =
    activeTab?.id && isTexFile
      ? toPdfPath(activeTab.id)
      : null;
  const [loadedPdf, setLoadedPdf] = useState<{
    path: string;
    url: string;
  } | null>(null);
  const loadedPdfRef = useRef(loadedPdf);
  loadedPdfRef.current = loadedPdf;
  const [pdfLoadStatus, setPdfLoadStatus] = useState<{
    path: string;
    version: number;
    status: "loading" | "settled";
  } | null>(null);
  const pdfUrl =
    expectedPdfPath && loadedPdf?.path === expectedPdfPath
      ? loadedPdf.url
      : null;
  const pdfLoading =
    expectedPdfPath !== null &&
    (!pdfLoadStatus ||
      pdfLoadStatus.path !== expectedPdfPath ||
      pdfLoadStatus.version !== pdfRefreshTrigger ||
      pdfLoadStatus.status === "loading");
  const [syncTexCoords, setSyncTexCoords] = useState<{
    page: number;
    x: number;
    y: number;
    requestId?: number;
  } | null>(null);
  const syncTexRequestIdRef = useRef(0);

  // Object URLs are revoked only after React has committed their replacement.
  // This keeps the current document visible while a freshly compiled PDF is
  // being read, without leaking the previous Blob URL.
  useEffect(() => {
    if (!loadedPdf) return;
    return () => URL.revokeObjectURL(loadedPdf.url);
  }, [loadedPdf]);

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      if (!expectedPdfPath) {
        setPdfLoadStatus(null);
        setLoadedPdf(null);
        return;
      }

      const pdfPath = expectedPdfPath;
      const isSamePathRefresh = loadedPdfRef.current?.path === pdfPath;
      setPdfLoadStatus({
        path: pdfPath,
        version: pdfRefreshTrigger,
        status: "loading",
      });
      // The derived pdfUrl already hides a PDF owned by another tab before
      // this effect runs. Dropping it here releases its Blob after commit.
      setLoadedPdf((current) =>
        current?.path === pdfPath ? current : null,
      );

      try {
        // Use Tauri to read the file as binary
        const { readFile, stat } = await import("@tauri-apps/plugin-fs");
        const retryDelays = [0, 40, 80, 160, 240];
        let pdfData: Uint8Array | null = null;
        let readError: unknown;

        for (const delay of retryDelays) {
          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          if (cancelled) return;

          try {
            const before = await stat(pdfPath);
            if (!before.isFile) {
              throw new Error("The generated PDF path is not a file.");
            }

            const modifiedAt = fileTime(before.mtime);
            if (
              modifiedAt !== null &&
              Date.now() - modifiedAt < PDF_MIN_STABLE_AGE_MS
            ) {
              throw new Error("The generated PDF is still being written.");
            }

            const candidate = await readFile(pdfPath);
            const after = await stat(pdfPath);
            if (
              before.size !== after.size ||
              fileTime(before.mtime) !== fileTime(after.mtime) ||
              after.size !== candidate.byteLength
            ) {
              throw new Error("The generated PDF changed while being read.");
            }

            validatePdfSnapshot(candidate);
            pdfData = candidate;
            break;
          } catch (error) {
            readError = error;
          }
        }

        if (!pdfData) throw readError;
        const blob = new Blob([pdfData], { type: "application/pdf" });
        const nextBlobUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(nextBlobUrl);
          return;
        }

        setLoadedPdf({ path: pdfPath, url: nextBlobUrl });
      } catch (e) {
        // Missing PDFs are expected before the first compilation. Reading
        // directly avoids a separate `exists` IPC round-trip on every load.
        // A transient post-compile read failure must not destroy a still valid
        // canvas. New paths have no stale document to preserve.
        if (!cancelled && !isSamePathRefresh) setLoadedPdf(null);
      } finally {
        if (!cancelled) {
          setPdfLoadStatus({
            path: pdfPath,
            version: pdfRefreshTrigger,
            status: "settled",
          });
        }
      }
    };
    void loadPdf();
    return () => {
      cancelled = true;
    };
  }, [
    expectedPdfPath,
    pdfRefreshTrigger,
  ]);

  const handleSyncTexForward = useCallback(
    async (line: number, column: number) => {
      if (!activeTab || !activeTab.id || !isTexFile) return;

      try {
        const texPath = activeTab.id;
        const pdfPath = toPdfPath(texPath);
        if (!pdfPath) return;
        const lastSlash = texPath.lastIndexOf(
          texPath.includes("\\") ? "\\" : "/",
        );
        const cwd = texPath.substring(0, lastSlash);

        // Check if PDF file actually exists on disk
        const { exists } = await import("@tauri-apps/plugin-fs");
        const pdfExists = await exists(pdfPath);

        if (!pdfExists) {
          setCompileError(
            "PDF not available. Please compile your document first.",
          );
          return;
        }

        const args = [
          "view",
          "-i",
          `${line}:${column}:${texPath}`,
          "-o",
          pdfPath,
        ];

        const result = await invoke<string>("run_synctex_command", {
          args,
          cwd,
        });

        // Validate regex matches
        const pageMatch = result.match(/Page:(\d+)/);
        const xMatch = result.match(/x:([\d\.]+)/);
        const yMatch = result.match(/y:([\d\.]+)/);

        if (pageMatch) {
          const page = parseInt(pageMatch[1], 10);
          const x = xMatch ? parseFloat(xMatch[1]) : 0;
          const y = yMatch ? parseFloat(yMatch[1]) : 0;

          if (isNaN(page) || page < 1) {
            setCompileError("SyncTeX returned invalid page number.");
            return;
          }

          setSyncTexCoords({
            page,
            x,
            y,
            requestId: ++syncTexRequestIdRef.current,
          });
          onRequirePanelOpen?.();
        } else {
          setCompileError(
            "SyncTeX forward sync failed. Make sure you compiled with -synctex=1 flag.",
          );
        }
      } catch (e) {
        console.error("SyncTeX Forward Failed:", e);
        const errorMsg = String(e);
        if (errorMsg.includes("synctex.gz")) {
          setCompileError(
            "SyncTeX file not found. Please recompile your document with SyncTeX enabled.",
          );
        } else {
          setCompileError("SyncTeX forward search failed: " + errorMsg);
        }
      }
    },
    [activeTab?.id, isTexFile, setCompileError, onRequirePanelOpen],
  );

  const handleSyncTexInverse = useCallback(
    async (
      page: number,
      x: number,
      y: number,
    ): Promise<{ file: string; line: number } | null> => {
      if (!activeTab || !activeTab.id || !isTexFile) return null;

      try {
        const texPath = activeTab.id;
        const pdfPath = toPdfPath(texPath);
        if (!pdfPath) return null;
        const lastSlash = texPath.lastIndexOf(
          texPath.includes("\\") ? "\\" : "/",
        );
        const cwd = texPath.substring(0, lastSlash);

        // synctex edit -o page:x:y:file.pdf
        const args = ["edit", "-o", `${page}:${x}:${y}:${pdfPath}`];

        const result = await invoke<string>("run_synctex_command", {
          args,
          cwd,
        });

        // Output format:
        // Line:10
        // File:/path/to/file.tex
        const lineMatch = result.match(/Line:(\d+)/);
        const fileMatch = result.match(/File:(.+)/);

        if (lineMatch && fileMatch) {
          return {
            line: parseInt(lineMatch[1], 10),
            file: fileMatch[1].trim(),
          };
        }
        return null;
      } catch (e) {
        console.error("SyncTeX Inverse Failed:", e);
        return null;
      }
    },
    [activeTab?.id, isTexFile],
  );

  return {
    pdfPath: expectedPdfPath,
    pdfUrl,
    pdfLoading,
    syncTexCoords,
    setSyncTexCoords,
    handleSyncTexForward,
    handleSyncTexInverse,
  };
}
