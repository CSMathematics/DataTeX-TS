import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UsePdfStateOptions {
  activeTab: any;
  isTexFile: boolean;
  pdfRefreshTrigger: number;
  setCompileError: (error: string | null) => void;
}

interface UsePdfStateReturn {
  showPdf: boolean;
  setShowPdf: React.Dispatch<React.SetStateAction<boolean>>;
  pdfUrl: string | null;
  syncTexCoords: { page: number; x: number; y: number } | null;
  setSyncTexCoords: React.Dispatch<
    React.SetStateAction<{ page: number; x: number; y: number } | null>
  >;
  handleTogglePdf: () => void;
  handleSyncTexForward: (line: number, column: number) => Promise<void>;
}

export function usePdfState({
  activeTab,
  isTexFile,
  pdfRefreshTrigger,
  setCompileError,
}: UsePdfStateOptions): UsePdfStateReturn {
  const [showPdf, setShowPdf] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  // @ts-ignore
  const [syncTexCoords, setSyncTexCoords] = useState<{
    page: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let activeBlobUrl: string | null = null;

    const loadPdf = async () => {
      if (!activeTab || !activeTab.id || !isTexFile) {
        setPdfUrl(null);
        return;
      }

      try {
        const filePath = activeTab.id;
        const pdfPath = filePath.replace(/\.tex$/i, ".pdf");

        // Use Tauri to read the file as binary
        // @ts-ignore
        const { readFile, exists } = await import("@tauri-apps/plugin-fs");

        if (await exists(pdfPath)) {
          const pdfData = await readFile(pdfPath);
          const blob = new Blob([pdfData], { type: "application/pdf" });
          activeBlobUrl = URL.createObjectURL(blob);
          setPdfUrl(activeBlobUrl);
        } else {
          setPdfUrl(null);
        }
      } catch (e) {
        console.error("Failed to load PDF:", e);
        setPdfUrl(null);
      }
    };
    loadPdf();
    return () => {
      if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
    };
  }, [
    activeTab?.id,
    activeTab?.title,
    activeTab?.type,
    pdfRefreshTrigger,
    isTexFile,
  ]);

  const handleTogglePdf = useCallback(() => {
    setShowPdf((prev) => !prev);
  }, []);

  const handleSyncTexForward = useCallback(
    async (line: number, column: number) => {
      if (!activeTab || !activeTab.id || !isTexFile) return;

      try {
        const texPath = activeTab.id;
        const pdfPath = texPath.replace(/\.tex$/i, ".pdf");
        const lastSlash = texPath.lastIndexOf(
          texPath.includes("\\") ? "\\" : "/"
        );
        const cwd = texPath.substring(0, lastSlash);

        // Check if PDF file actually exists on disk
        // @ts-ignore
        const { exists } = await import("@tauri-apps/plugin-fs");
        const pdfExists = await exists(pdfPath);

        if (!pdfExists) {
          setCompileError(
            "PDF not available. Please compile your document first."
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
        console.log("SyncTeX View Result:", result);

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

          setSyncTexCoords({ page, x, y });
          setShowPdf(true);
        } else {
          setCompileError(
            "SyncTeX forward sync failed. Make sure you compiled with -synctex=1 flag."
          );
        }
      } catch (e) {
        console.error("SyncTeX Forward Failed:", e);
        const errorMsg = String(e);
        if (errorMsg.includes("synctex.gz")) {
          setCompileError(
            "SyncTeX file not found. Please recompile your document with SyncTeX enabled."
          );
        } else {
          setCompileError("SyncTeX forward search failed: " + errorMsg);
        }
      }
    },
    [activeTab, isTexFile, setCompileError]
  );

  return {
    showPdf,
    setShowPdf,
    pdfUrl,
    syncTexCoords,
    setSyncTexCoords,
    handleTogglePdf,
    handleSyncTexForward,
  };
}
