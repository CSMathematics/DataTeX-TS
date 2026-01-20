import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDatabaseStore } from "../stores/databaseStore";
import { parseLatexLog, LogEntry } from "../utils/logParser";

interface UseCompilationOptions {
  activeTab: any; // Type should be imported if available
  isTexFile: boolean;
  onSave: (id: string) => Promise<void>;
  setCompileError: (error: string | null) => void;
}

interface UseCompilationReturn {
  isCompiling: boolean;
  logEntries: LogEntry[];
  showLogPanel: boolean;
  setShowLogPanel: React.Dispatch<React.SetStateAction<boolean>>;
  pdfRefreshTrigger: number;
  handleCompile: (engine?: string) => Promise<void>;
  handleStopCompile: () => void;
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
  const [pdfRefreshTrigger, setPdfRefreshTrigger] = useState(0);

  const handleCompile = useCallback(
    async (engine?: string) => {
      if (!activeTab || !activeTab.id || !isTexFile) {
        return;
      }

      // Save before compiling
      await onSave(activeTab.id);

      const filePath = activeTab.id;

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
          // Use the specific command that handles wrapping
          // We can ignore the returned path since we forced it to be standard filename.pdf
          await invoke("compile_resource_cmd", { id: resource.id });
        } else {
          // Standard Compilation
          await invoke("compile_tex", {
            filePath,
            engine: selectedEngine,
            args,
            outputDir,
          });
        }

        setPdfRefreshTrigger((prev) => prev + 1);
      } catch (error: any) {
        setCompileError(String(error));
      } finally {
        try {
          const { exists, readTextFile } =
            await import("@tauri-apps/plugin-fs");
          const logPath = filePath.replace(/\.tex$/i, ".log");
          const doesLogExist = await exists(logPath);
          if (doesLogExist) {
            const logContent = await readTextFile(logPath);
            const entries = await parseLatexLog(logContent);
            setLogEntries(entries);
            const hasErrors = entries.some((e: LogEntry) => e.type === "error");
            if (hasErrors) setShowLogPanel(true);
          }
        } catch (e) {
          // Failed to read/parse log file
        }
        setIsCompiling(false);
      }
    },
    [activeTab, isTexFile, onSave],
  );

  const handleStopCompile = useCallback(() => {
    setIsCompiling(false);
    setCompileError("Compilation stopped by user (UI reset).");
  }, []);

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
