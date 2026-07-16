import { useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDatabaseStore } from "../stores/databaseStore";
import { parseLatexLog, LogEntry } from "../utils/logParser";
import { getPreambleContent } from "../data/preambles";

interface UseCompilationOptions {
  activeTab: any; // Type should be imported if available
  isTexFile: boolean;
  onSave: (id: string) => Promise<boolean>;
  setCompileError: (error: string | null) => void;
}

interface UseCompilationReturn {
  isCompiling: boolean;
  logEntries: LogEntry[];
  showLogPanel: boolean;
  setShowLogPanel: React.Dispatch<React.SetStateAction<boolean>>;
  pdfRefreshTrigger: number;
  handleCompile: (engine?: string) => Promise<void>;
  handleStopCompile: () => Promise<void>;
  handleCloseLogPanel: () => void;
}

export function useCompilation({
  activeTab,
  isTexFile,
  onSave,
  setCompileError,
}: UseCompilationOptions): UseCompilationReturn {
  const [isCompiling, setIsCompiling] = useState(false);
  // compileError managed externally
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [pdfRefreshVersions, setPdfRefreshVersions] = useState<
    Record<string, number>
  >({});
  const pdfRefreshTrigger = activeTab?.id
    ? (pdfRefreshVersions[activeTab.id] ?? 0)
    : 0;
  const compilationBusyRef = useRef(false);
  const activeCompilationIdRef = useRef<string | null>(null);

  const handleCompile = useCallback(
    async (engine?: string) => {
      if (!activeTab || !activeTab.id || !isTexFile) {
        return;
      }
      if (compilationBusyRef.current) return;
      compilationBusyRef.current = true;

      // Save before compiling
      let saved = false;
      try {
        saved = await onSave(activeTab.id);
      } catch (error) {
        setCompileError(String(error));
      }
      if (!saved) {
        compilationBusyRef.current = false;
        return;
      }

      const filePath = activeTab.id;
      const compilationId =
        globalThis.crypto?.randomUUID?.() ??
        `compile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      activeCompilationIdRef.current = compilationId;

      try {
        setIsCompiling(true);
        setCompileError(null);

        let selectedEngine = engine || "pdflatex";
        let args = ["-interaction=nonstopmode", "-synctex=1"];
        const outputDir = "";

        // If no engine explicitly passed, check config
        if (!engine) {
          const savedConfig = localStorage.getItem("tex-engine-config");
          if (savedConfig) {
            try {
              const config = JSON.parse(savedConfig);
              const engineKey = config.defaultEngine || "pdflatex";
              if (engineKey === "xelatex")
                selectedEngine = config.xelatexPath || "xelatex";
              else if (engineKey === "lualatex")
                selectedEngine = config.lualatexPath || "lualatex";
              else selectedEngine = config.pdflatexPath || "pdflatex";

              args = ["-interaction=nonstopmode"];
              if (config.synctex) args.push("-synctex=1");
              if (config.shellEscape) args.push("-shell-escape");
            } catch (e) {
              // Failed to parse config, using defaults
            }
          }
        }

        // --- DYNAMIC COMPILATION CHECK ---
        const allResources = useDatabaseStore.getState().allLoadedResources;
        // Normalize paths for comparison if needed (though usually identical)
        const resource = allResources.find((r) => r.path === filePath);

        if (resource && resource.metadata && resource.metadata.preamble) {
          // Modular resource detected, using compile_resource_cmd
          // We can ignore the returned path since we forced it to be standard filename.pdf

          let preambleOverride = undefined;
          if (resource.metadata.preamble.startsWith("builtin:")) {
            preambleOverride = getPreambleContent(resource.metadata.preamble);
          }

          await invoke("compile_resource_cmd", {
            id: resource.id,
            preambleOverride, // Pass optional override
            compilationId,
          });
        } else {
          // Standard Compilation
          await invoke("compile_tex", {
            filePath,
            engine: selectedEngine,
            args,
            outputDir,
            compilationId,
          });
        }

        setPdfRefreshVersions((previous) => ({
          ...previous,
          [filePath]: (previous[filePath] ?? 0) + 1,
        }));
      } catch (error: any) {
        setCompileError(String(error));
      } finally {
        try {
          const { exists } = await import("@tauri-apps/plugin-fs");
          const logPath = filePath.replace(/\.tex$/i, ".log");
          const doesLogExist = await exists(logPath);
          if (doesLogExist) {
            // Optimization: Pass path to Rust backend to avoid reading large logs in JS
            const entries = await parseLatexLog(logPath);
            setLogEntries(entries);
            const hasErrors = entries.some((e: LogEntry) => e.type === "error");
            if (hasErrors) setShowLogPanel(true);
          }
        } catch (e) {
          // Failed to read/parse log file
        }
        setIsCompiling(false);
        compilationBusyRef.current = false;
        if (activeCompilationIdRef.current === compilationId) {
          activeCompilationIdRef.current = null;
        }
      }
    },
    [activeTab, isTexFile, onSave, setCompileError],
  );

  const handleStopCompile = useCallback(async () => {
    const compilationId = activeCompilationIdRef.current;
    if (!compilationId) return;

    setCompileError("Stopping compilation…");
    try {
      await invoke("stop_compile", { compilationId });
      setCompileError("Compilation stopped by user.");
    } catch (error) {
      setCompileError(`Failed to stop compilation: ${String(error)}`);
    }
  }, [setCompileError]);

  const handleCloseLogPanel = useCallback(() => {
    setShowLogPanel(false);
  }, []);

  return {
    isCompiling,
    logEntries,
    showLogPanel,
    setShowLogPanel,
    pdfRefreshTrigger,
    handleCompile,
    handleStopCompile,
    handleCloseLogPanel,
  };
}
