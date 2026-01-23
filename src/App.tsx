import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  AppShell,
  Box,
  Group,
  Stack,
  MantineProvider,
  Text,
  CSSVariablesResolver,
  Modal,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { debounce, throttle } from "lodash";
import { ScrollArea, Code, Button } from "@mantine/core";
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as FaIcons from "@fortawesome/free-solid-svg-icons"; // Import all for dynamic icons

// --- Custom Theme ---
import { getTheme } from "./themes/ui-themes";

// --- Layout Components ---
import { HeaderContent } from "./components/layout/Header";
import {
  Sidebar,
  SidebarSection,
  ViewType,
  FileSystemNode,
} from "./components/layout/Sidebar";
import { EditorArea } from "./components/layout/EditorArea";
import { StatusBar } from "./components/layout/StatusBar";

// --- UI Components ---
import { ResizerHandle } from "./components/ui/ResizerHandle";

// --- Wizards ---
import { WizardWrapper } from "./components/wizards/WizardWrapper";
import { PreambleWizard } from "./components/wizards/PreambleWizard";
import { UnifiedTableWizard } from "./components/wizards/UnifiedTableWizard";
import { TikzPgfPlotsWizard } from "./components/wizards/TikzPgfPlotsWizard";
import { FancyhdrWizard } from "./components/wizards/FancyhdrWizard";
import { PstricksWizard } from "./components/wizards/PstricksWizard";
import { MathWizard } from "./components/wizards/MathWizard";
import { GraphicxWizard } from "./components/wizards/GraphicxWizard";
import { PackageGallery } from "./components/wizards/PackageGallery";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { DatabaseView } from "./components/database/DatabaseView";

import { ResourceInspector } from "./components/database/ResourceInspector";
import { PackageBrowser } from "./components/tools/PackageBrowser";
import { templates, getTemplateById } from "./services/templateService";

import { AISidebar } from "./components/ai/AISidebar";
import { UnsavedChangesModal } from "./components/modals/UnsavedChangesModal";

import {
  latexLanguage,
  latexConfiguration,
  setupLatexProviders,
} from "./languages/latex";
import { dataTexDarkTheme } from "./themes/monaco-theme";
import { dataTexLightTheme } from "./themes/monaco-light";
import { dataTexHCTheme } from "./themes/monaco-hc";
import { monokaiTheme } from "./themes/monaco-monokai";
import { nordTheme } from "./themes/monaco-nord";
import { useSettings } from "./hooks/useSettings";

import { TexlabLspClient } from "./services/lspClient";
import {
  useTabsStore,
  useActiveTab,
  useIsTexFile,
} from "./stores/useTabsStore";

import { useProjectStore } from "./stores/projectStore";
import { useDatabaseStore } from "./stores/databaseStore";
import { useAppPanelResize } from "./hooks/useAppPanelResize";
import { useProjectFiles } from "./hooks/useProjectFiles";
import { useCompilation } from "./hooks/useCompilation";
import { usePdfState } from "./hooks/usePdfState";
import { useCursorStore } from "./stores/cursorStore";
import { usePendingWriteListener } from "./hooks/usePendingWriteListener";

// --- CSS Variables Resolver ---
const resolver: CSSVariablesResolver = (theme) => ({
  variables: {
    "--app-bg": theme.other?.appBg || "var(--mantine-color-body)",
    "--app-sidebar-bg":
      theme.other?.sidebarBg || "var(--mantine-color-default)",
    "--app-header-bg": theme.other?.headerBg || "var(--mantine-color-default)",
    "--app-status-bar-bg":
      theme.other?.statusBarBg || "var(--mantine-primary-color-filled)",
    "--app-panel-bg": theme.other?.panelBg || "var(--mantine-color-default)",
    "--app-accent-color":
      theme.other?.accentColor || "var(--mantine-primary-color-filled)",
    "--app-accent-color-dimmed":
      "color-mix(in srgb, var(--app-accent-color), transparent 90%)",
    "--app-border-color":
      theme.other?.borderColor || "var(--mantine-color-default-border)",
  },
  light: {},
  dark: {},
});

export default function App() {
  usePendingWriteListener();

  const {
    settings,
    updateEditorSetting,
    updateEditorBehaviorSetting,
    updatePdfViewerSetting,
    updateCompilationSetting,
    updateTexEngineSetting,
    updateDatabaseSetting,
    updateAccessibilitySetting,
    updateGeneralSetting,
    setUiTheme,
    updateCustomThemeOverride,
    addCustomTheme,
    removeCustomTheme,
  } = useSettings();

  const activeTheme = getTheme(
    settings.uiTheme,
    settings.customThemes,
    settings.customThemeOverrides,
  );

  // Memoize settings to prevent unnecessary EditorArea re-renders.
  const editorSettingsMemo = useMemo(() => settings.editor, [settings.editor]);

  // --- Layout State ---
  const [activeActivity, setActiveActivity] =
    useState<SidebarSection>("database");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<ViewType>("editor");
  const [activePackageId, setActivePackageId] = useState<string>("amsmath");

  // --- Resizing State (from custom hook) ---
  // Note: sidebarWidth/rightPanelWidth are applied via CSS variables in the hook
  const {
    sidebarWidth,
    isResizing,
    ghostRef,
    startResizeSidebar,
    startResizeRightPanel,
    startResizeDatabase,
    startResizeDatabaseHeight,
  } = useAppPanelResize({
    isSidebarOpen,
  });

  // --- Editor State (from Zustand) ---
  const tabs = useTabsStore((state) => state.tabs);
  const activeTabId = useTabsStore((state) => state.activeTabId);
  const setActiveTab = useTabsStore((state) => state.setActiveTab);
  const openTab = useTabsStore((state) => state.openTab);
  const closeTabStore = useTabsStore((state) => state.closeTab);
  const closeTabsById = useTabsStore((state) => state.closeTabsById);
  const markDirty = useTabsStore((state) => state.markDirty);
  const updateTabContent = useTabsStore((state) => state.updateTabContent);
  const renameTab = useTabsStore((state) => state.renameTab);
  const editorRef = useRef<any>(null);
  const [outlineSource, setOutlineSource] = useState<string>("");
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(false);

  // --- LSP State ---
  const lspClientRef = useRef<TexlabLspClient | null>(null);

  // --- Compilation State ---

  // --- Word Count State ---
  const [showWordCount, setShowWordCount] = useState(false);
  const [wordCountResult, setWordCountResult] = useState<string>("");

  // --- File System & DB State ---

  // --- Recent Projects State ---
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const addToRecent = useCallback((path: string) => {
    setRecentProjects((prev) => {
      const newRecent = [path, ...prev.filter((p) => p !== path)].slice(0, 10);
      localStorage.setItem("recentProjects", JSON.stringify(newRecent));
      return newRecent;
    });
  }, []);

  // --- Project Files Hook ---
  const {
    projectData,
    rootPath,

    setRootPath,
    reloadProjectFiles,
    handleOpenFolder,
    handleAddFolder,
    handleRemoveFolder,
    handleOpenRecent,
    handleCreateItem,
    handleRenameItem,
    handleDeleteItem,
    handleMoveItem,
  } = useProjectFiles({
    onSetCompileError: (err) => console.error("Project Error:", err),
    onSetActiveActivity: (act) => setActiveActivity(act as SidebarSection),
    onAddToRecent: addToRecent,
    openTab,
    renameTab,
    closeTab: closeTabStore,
  });

  // --- Database Panel State ---
  const [showDatabasePanel, setShowDatabasePanel] = useState(false);
  const [databasePanelPosition, setDatabasePanelPosition] = useState<
    "bottom" | "left"
  >("bottom");

  // --- Right Sidebar (ResourceInspector) State ---
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  // --- Database Logic: Auto-open table when collection checked ---
  const loadedCollections = useDatabaseStore(
    (state) => state.loadedCollections,
  );
  const prevLoadedCountRef = useRef(loadedCollections.length);

  useEffect(() => {
    // Auto-open panel when collection count increases (user checked one).
    if (loadedCollections.length > prevLoadedCountRef.current) {
      setShowDatabasePanel(true);
    }
    prevLoadedCountRef.current = loadedCollections.length;
  }, [loadedCollections]);

  // Auto-close resource inspector if no editor/table tabs are open.
  useEffect(() => {
    // Only keep right sidebar open if there are editor or table tabs
    // "start-page" and "settings" do not need the resource inspector
    const hasContentTabs = tabs.some(
      (t) => t.type === "editor" || t.type === "table",
    );

    if (!hasContentTabs) {
      setShowRightSidebar(false);
    }
  }, [tabs]);

  // --- Template Modal State ---
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  // --- Unsaved Changes Modal State ---
  const [unsavedChangesModalOpen, setUnsavedChangesModalOpen] = useState(false);
  const [tabToCloseId, setTabToCloseId] = useState<string | null>(null);

  // --- Derived State (from Zustand selectors) ---
  const activeTab = useActiveTab();
  const isTexFile = useIsTexFile();

  // --- Helper: Save File ---
  const handleSave = useCallback(
    async (tabId?: string) => {
      const targetId = tabId || activeTabId;
      const tab = tabs.find((t) => t.id === targetId);

      if (!tab || !tab.id) return;

      // Use current content from ref if it's the active tab, otherwise use stored content
      let contentToSave = tab.content || "";
      if (tab.id === activeTabId && editorRef.current) {
        contentToSave = editorRef.current.getValue();
      }

      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(tab.id, contentToSave);

        // Update tab dirty state and content
        markDirty(targetId, false);
        updateTabContent(targetId, contentToSave);

        // Save local history snapshot (fire and forget)
        invoke("save_history_snapshot_cmd", {
          filePath: tab.id,
          content: contentToSave,
          summary: null,
          isManual: false,
        }).catch((err) =>
          console.warn("Failed to save history snapshot:", err),
        );
      } catch (e) {
        console.error("Failed to save file:", e);
      }
    },
    [tabs, activeTabId, markDirty, updateTabContent],
  );

  // --- Compilation Hook ---
  const {
    isCompiling,
    logEntries,
    showLogPanel,
    pdfRefreshTrigger,
    handleCompile,
    handleStopCompile,
    handleCloseLogPanel,
  } = useCompilation({
    activeTab,
    isTexFile,
    onSave: handleSave,
    setCompileError: (msg) => console.error("Compile Error:", msg),
  });

  // --- PDF Hook ---
  const handleTogglePdf = useCallback(() => {
    setShowRightSidebar((prev) => !prev);
  }, []);

  const { pdfUrl, syncTexCoords, handleSyncTexForward } = usePdfState({
    activeTab,
    isTexFile,
    pdfRefreshTrigger,
    setCompileError: (msg) => console.error("PDF Error:", msg),
    onRequirePanelOpen: () => setShowRightSidebar(true),
  });

  const isWizardActive = useMemo(
    () =>
      activeView.startsWith("wizard-") ||
      activeView === "gallery" ||
      activeView === "package-browser" ||
      activeView === "ai-assistant",
    [activeView],
  );
  const showRightPanel = useMemo(
    () =>
      (showRightSidebar || isWizardActive) &&
      (isWizardActive || activeView === "editor" || activeView === "database"),
    [showRightSidebar, isWizardActive, activeView],
  );

  // --- Sync projectData to projectStore for DatabaseSidebar ---
  const setProjectDataToStore = useProjectStore(
    (state) => state.setProjectData,
  );
  useEffect(() => {
    setProjectDataToStore(projectData);
  }, [projectData, setProjectDataToStore]);

  // --- Handlers ---
  // --- Load Recent Projects on Mount ---
  useEffect(() => {
    const saved = localStorage.getItem("recentProjects");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRecentProjects(parsed);
      } catch (e) {
        console.error("Failed to parse recent projects", e);
      }
    }
  }, []);

  // --- Initialize LSP when rootPath or loaded collections change ---
  const collections = useDatabaseStore((state) => state.collections);

  useEffect(() => {
    // Determine workspace root: prefer rootPath, fallback to first collection path
    let workspaceRoot = rootPath;
    if (!workspaceRoot && collections.length > 0) {
      const collWithPath = collections.find((c) => c.path);
      if (collWithPath?.path) {
        workspaceRoot = collWithPath.path;
      }
    }

    const initLsp = async () => {
      if (workspaceRoot && !lspClientRef.current) {
        try {
          const client = new TexlabLspClient();
          await client.initialize(`file://${workspaceRoot}`);
          lspClientRef.current = client;
        } catch (error) {
          console.error("Failed to initialize LSP:", error);
        }
      }
    };
    initLsp();

    return () => {
      if (lspClientRef.current) {
        lspClientRef.current.shutdown();
        lspClientRef.current = null;
      }
    };
  }, [rootPath, collections]);

  const handleToggleSidebar = useCallback(
    (section: SidebarSection) => {
      if (section === "settings") {
        setActiveActivity("settings");
        setActiveView("settings");
        setIsSidebarOpen(false);
      } else {
        if (section === "database") {
          setActiveView("database");
        } else {
          setActiveView((currentView) =>
            currentView === "settings" || currentView === "database"
              ? "editor"
              : currentView,
          );
        }

        // Toggle sidebar if clicking same section; otherwise open new section.
        if (activeActivity === section) {
          setIsSidebarOpen((prev) => !prev);
        } else {
          setActiveActivity(section);
          setIsSidebarOpen(true);
        }
      }
    },
    [activeActivity],
  );

  // --- HELPER: Load Project Files ---
  // --- HELPER: Load Project Files (Moved to useProjectFiles) ---

  // --- CORE: Create Tab Logic ---
  const debouncedOutlineUpdate = useCallback(
    debounce((content: string) => {
      setOutlineSource(content);
    }, 1000),
    [],
  );

  const handleTabChange = useCallback(
    (newId: string) => {
      // Sync content from Monaco before switching
      const currentId = activeTabId;
      if (currentId && editorRef.current) {
        try {
          const currentContent = editorRef.current.getValue();
          updateTabContent(currentId, currentContent);
        } catch (e) {
          /* ignore */
        }
      }

      setActiveTab(newId);

      // Update outline source for new tab
      const newTab = tabs.find((t) => t.id === newId);
      if (newTab && newTab.content) {
        setOutlineSource(newTab.content);
      }
    },
    [activeTabId, tabs, updateTabContent, setActiveTab],
  );

  const createTabWithContent = useCallback(
    async (code: string, defaultTitle: string = "Untitled.tex") => {
      try {
        let filePath: string | null = null;
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          filePath = await save({
            defaultPath: defaultTitle,
            filters: [{ name: "LaTeX Document", extensions: ["tex"] }],
          });
        } catch (e) {
          console.warn("Tauri dialog failed, using fallback:", e);
          filePath = "/mock/" + defaultTitle;
        }

        if (!filePath) return;

        try {
          const { writeTextFile } = await import("@tauri-apps/plugin-fs");
          await writeTextFile(filePath, code);
        } catch (e) {
          console.warn("Tauri write failed, continuing in memory:", e);
        }

        const normalizedPath = filePath.replace(/\\/g, "/");
        const lastSlashIndex = normalizedPath.lastIndexOf("/");
        const parentDir = normalizedPath.substring(0, lastSlashIndex);
        const fileName = normalizedPath.substring(lastSlashIndex + 1);

        if (parentDir && parentDir !== "/mock") {
          setRootPath(parentDir);
          try {
            // We use reloadProjectFiles directly here or wrap it if needed.
            // loadProjectFiles is async, so we just call it.
            reloadProjectFiles([parentDir]);
          } catch (e) {}
          setActiveActivity("database");
          setIsSidebarOpen(true);
          addToRecent(parentDir);
        }

        // Open the new tab
        openTab({
          id: filePath!,
          title: fileName,
          type: "editor",
          content: code,
          language: "latex",
          isDirty: false,
        });
        setActiveView("editor");
      } catch (e) {
        console.error("Failed to create file:", e);
        console.error("Failed to create file: " + String(e));
      }
    },
    [handleTabChange],
  );

  const handleCreateEmpty = useCallback(() => {
    createTabWithContent("", "Untitled.tex");
  }, [createTabWithContent]);

  const handleRequestNewFile = useCallback(() => {
    const existing = tabs.find((t) => t.type === "start-page");
    if (existing) {
      setActiveTab(existing.id);
    } else {
      openTab({
        id: `start-${Date.now()}`,
        title: "Start Page",
        type: "start-page",
      });
    }
  }, [tabs, setActiveTab, openTab]);

  const handleCreateFromTemplate = useCallback(
    (code: string) => createTabWithContent(code, "Untitled.tex"),
    [createTabWithContent],
  );

  const handleOpenTemplateModal = useCallback(() => {
    setShowTemplateModal(true);
    if (templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, []);

  const handleTemplateClick = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
  }, []);

  const handleCreateSelectedTemplate = useCallback(() => {
    if (selectedTemplateId) {
      const template = getTemplateById(selectedTemplateId);
      if (template) {
        handleCreateFromTemplate(template.content);
        setShowTemplateModal(false);
      }
    }
  }, [selectedTemplateId, handleCreateFromTemplate]);

  const handleOpenPreambleWizard = useCallback(
    () => setActiveView("wizard-preamble"),
    [],
  );

  // --- File Handlers (Moved to useProjectFiles) ---

  const handleCloseTab = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      const tab = tabs.find((t) => t.id === id);
      if (tab && tab.isDirty) {
        setTabToCloseId(id);
        setUnsavedChangesModalOpen(true);
        return;
      }

      // Use store's closeTab - it handles everything
      const closed = closeTabStore(id);
      if (!closed) {
      }
    },
    [tabs, closeTabStore],
  );

  const handleConfirmSave = useCallback(async () => {
    if (tabToCloseId) {
      await handleSave(tabToCloseId);
      closeTabStore(tabToCloseId);
      setUnsavedChangesModalOpen(false);
      setTabToCloseId(null);
    }
  }, [tabToCloseId, handleSave, closeTabStore]);

  const handleConfirmDiscard = useCallback(() => {
    if (tabToCloseId) {
      closeTabsById([tabToCloseId]);
      setUnsavedChangesModalOpen(false);
      setTabToCloseId(null);
    }
  }, [tabToCloseId, closeTabsById]);

  const handleCancelClose = useCallback(() => {
    setUnsavedChangesModalOpen(false);
    setTabToCloseId(null);
  }, []);

  const handleOpenFileNode = useCallback(
    async (node: FileSystemNode) => {
      if (node.type === "folder") return;

      // Check if already open
      if (tabs.some((t) => t.id === node.path)) {
        setActiveTab(node.path);
        return;
      }

      let content = "";
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        content = await readTextFile(node.path);
      } catch (e) {
        content = `Error reading file: ${String(e)}`;
      }

      openTab({
        id: node.path,
        title: node.name,
        type: "editor",
        content,
        language: "latex",
      });
    },
    [tabs, setActiveTab, openTab],
  );

  const handleCloseTabs = useCallback(
    (ids: string[]) => {
      closeTabsById(ids);
    },
    [closeTabsById],
  );

  // Debounced markDirty to prevent re-renders on every keystroke
  const debouncedMarkDirty = useMemo(
    () =>
      debounce((id: string) => {
        useTabsStore.getState().markDirty(id, true);
      }, 500),
    [],
  );

  const handleEditorChange = useCallback(
    (id: string, val: string) => {
      // Access store directly to avoid dependency on 'tabs'
      const { tabs } = useTabsStore.getState();
      const tab = tabs.find((t) => t.id === id);

      if (tab && !tab.isDirty) {
        debouncedMarkDirty(id);
      }

      if (activeActivity === "outline") {
        debouncedOutlineUpdate(val);
      }
    },
    [activeActivity, debouncedOutlineUpdate, debouncedMarkDirty],
  );

  // --- FIX: Update structure on view change ---
  const handleOpenDatabase = useCallback(() => setShowDatabasePanel(true), []);
  const handleOpenPackageBrowser = useCallback(
    () => setActiveView("package-browser"),
    [],
  );
  const handleOpenExamGenerator = useCallback(() => {}, []);

  useEffect(() => {
    if (activeActivity === "outline") {
      const tab = tabs.find((t) => t.id === activeTabId);
      if (tab && tab.content) {
        setOutlineSource(tab.content);
      } else {
        // Also try to get from editor ref if content is stale in store
        if (editorRef.current) {
          try {
            setOutlineSource(editorRef.current.getValue());
          } catch (e) {
            /* ignore */
          }
        }
      }
    }
  }, [activeActivity, activeTabId, tabs]);

  // Keyboard shortcut: Ctrl+Shift+P for Package Browser
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setActiveView("package-browser");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+N for New from Template
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowTemplateModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Throttled cursor position update - uses store directly, no App re-render
  const handleCursorChange = useCallback(
    throttle((line: number, column: number) => {
      // Use store directly - does not trigger App.tsx re-render
      useCursorStore.getState().setCursor(line, column);
    }, 100),
    [],
  );

  const handleRevealLine = useCallback((line: number) => {
    if (editorRef.current) {
      editorRef.current.revealLine(line);
      editorRef.current.setPosition({ column: 1, lineNumber: line });
      editorRef.current.focus();
    }
  }, []);

  const handleInsertSnippet = useCallback((code: string) => {
    if (editorRef.current) {
      const sel = editorRef.current.getSelection();
      const op = {
        range: sel || {
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        },
        text: code,
        forceMoveMarkers: true,
      };
      editorRef.current.executeEdits("wizard", [op]);
      editorRef.current.focus();
    }
  }, []);

  const handleEditorDidMount = useCallback(
    (editor: any, monaco: any) => {
      editorRef.current = editor;
      if (
        !monaco.languages.getLanguages().some((l: any) => l.id === "my-latex")
      ) {
        monaco.languages.register({ id: "my-latex" });
        monaco.languages.setMonarchTokensProvider("my-latex", latexLanguage);
        monaco.languages.setLanguageConfiguration(
          "my-latex",
          latexConfiguration,
        );

        setupLatexProviders(monaco);

        monaco.editor.defineTheme("data-tex-dark", dataTexDarkTheme);
        monaco.editor.defineTheme("data-tex-light", dataTexLightTheme);
        monaco.editor.defineTheme("data-tex-hc", dataTexHCTheme);
        monaco.editor.defineTheme("data-tex-monokai", monokaiTheme);
        monaco.editor.defineTheme("data-tex-nord", nordTheme);
      }
      // settings is a dependency here
      monaco.editor.setTheme(settings.editor.theme);
    },
    [settings.editor.theme],
  );

  /* PDF -> Editor (Inverse) - commented out, SyncTeX integration moved to ResourceInspector
  const _handleSyncTexInverse = useCallback(async (page: number, x: number, y: number) => {
      if (!activeTab || !activeTab.id || !isTexFile) return;

      try {
          const texPath = activeTab.id;
          const pdfPath = texPath.replace(/\\.tex$/i, '.pdf');
          const lastSlash = texPath.lastIndexOf(texPath.includes('\\\\') ? '\\\\' : '/');
          const cwd = texPath.substring(0, lastSlash);

          const args = [
              "edit",
              "-o", `${page}:${x}:${y}:${pdfPath}`
          ];

          const result = await invoke<string>('run_synctex_command', { args, cwd });
          console.log("SyncTeX Edit Result:", result);
          
          const lineMatch = result.match(/Line:(\\d+)/);

          if (lineMatch) {
              const line = parseInt(lineMatch[1], 10);
              
              if (isNaN(line) || line < 1) {
                  setCompileError("SyncTeX returned invalid line number.");
                  return;
              }
              
              handleRevealLine(line);
          } else {
              setCompileError("SyncTeX inverse sync failed. Could not find corresponding line.");
          }

      } catch (e) {
          console.error("SyncTeX Inverse Failed:", e);
          const errorMsg = String(e);
          if (errorMsg.includes('synctex.gz')) {
              setCompileError("SyncTeX file not found. Please recompile your document with SyncTeX enabled.");
          } else {
              setCompileError("SyncTeX inverse search failed: " + errorMsg);
          }
      }
  }, [activeTab, isTexFile, handleRevealLine]);
  */

  // --- Word Count Logic ---
  const handleWordCount = useCallback(async () => {
    if (!activeTab || !activeTab.id || !isTexFile) return;

    try {
      const texPath = activeTab.id;
      const lastSlash = texPath.lastIndexOf(
        texPath.includes("\\") ? "\\" : "/",
      );
      const cwd = texPath.substring(0, lastSlash);

      const args = ["-brief", "-total", texPath];

      const result = await invoke<string>("run_texcount_command", {
        args,
        cwd,
      });
      setWordCountResult(result);
      setShowWordCount(true);
    } catch (e) {
      console.error("TexCount Failed:", e);
      console.error("Word count failed: " + String(e));
    }
  }, [activeTab, isTexFile]);

  // --- Handlers (DB) ---

  const handleOpenFileFromTable = useCallback(
    (path: string) => {
      // Adapt path to FileSystemNode
      const node: FileSystemNode = {
        id: path,
        name: path.split(/[/\\]/).pop() || path,
        type: "file",
        path: path,
        children: [],
      };
      handleOpenFileNode(node);

      // Auto-open Resource Inspector when file selected from Table
      setShowRightSidebar(true);
    },
    [handleOpenFileNode],
  );

  const handleOpenFileAtLine = useCallback(
    (path: string, lineNumber: number) => {
      // Open the file first
      const node: FileSystemNode = {
        id: path,
        name: path.split(/[/\\]/).pop() || path,
        type: "file",
        path: path,
        children: [],
      };
      handleOpenFileNode(node);

      // Then scroll to the line after a short delay to ensure editor is ready
      setTimeout(() => {
        handleRevealLine(lineNumber);
      }, 150);
    },
    [handleOpenFileNode, handleRevealLine],
  );

  const handleOpenFileDialog = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await open({
        multiple: false,
        title: "Open File",
        filters: [
          {
            name: "TeX Files",
            extensions: ["tex", "sty", "cls", "bib", "dtx", "ins"],
          },
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      });

      if (selectedPath && typeof selectedPath === "string") {
        handleOpenFileFromTable(selectedPath);
      }
    } catch (e) {
      console.error("Failed to open file dialog:", e);
    }
  }, [handleOpenFileFromTable]);

  // --- Resize Logic moved to useAppPanelResize hook ---

  // --- DND Logic ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        // Drop on Editor (Open File)
        if (over.id === "editor-zone") {
          const activeNode = active.data.current?.node as FileSystemNode;
          if (activeNode && activeNode.type === "file") {
            handleOpenFileNode(activeNode);
          }
          return;
        }

        // Drop on Folder (Move File)
        const activeNode = active.data.current?.node as FileSystemNode;
        const overNode = over.data.current?.node as FileSystemNode;

        if (activeNode && overNode && overNode.type === "folder") {
          handleMoveItem(activeNode.path, overNode.path);
        }
      }
    },
    [handleOpenFileNode, handleMoveItem],
  );

  // --- RENDER ---
  return (
    <MantineProvider
      theme={activeTheme.theme}
      forceColorScheme={activeTheme.type}
      cssVariablesResolver={resolver}
    >
      <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
        <AppShell header={{ height: 35 }} footer={{ height: 24 }} padding={0}>
          {/* HEADER */}
          <AppShell.Header
            withBorder={false}
            style={{ zIndex: 200, backgroundColor: "var(--app-header-bg)" }}
          >
            <HeaderContent
              onNewFile={handleRequestNewFile}
              onNewFromTemplate={handleOpenTemplateModal}
              onSaveFile={() => handleSave()}
              onOpenFile={handleOpenFileDialog}
              // Left Sidebar
              showLeftSidebar={isSidebarOpen}
              onToggleLeftSidebar={() => setIsSidebarOpen((prev) => !prev)}
              // Database
              showDatabasePanel={showDatabasePanel}
              onToggleDatabasePanel={() =>
                setShowDatabasePanel(!showDatabasePanel)
              }
              databasePanelPosition={databasePanelPosition}
              onToggleDatabasePosition={() =>
                setDatabasePanelPosition((pos) =>
                  pos === "bottom" ? "left" : "bottom",
                )
              }
              // Right Sidebar
              showRightSidebar={showRightSidebar}
              onToggleRightSidebar={() =>
                setShowRightSidebar(!showRightSidebar)
              }
              // Edit Actions
              onUndo={() => editorRef.current?.trigger(null, "undo", null)}
              onRedo={() => editorRef.current?.trigger(null, "redo", null)}
              onCut={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.clipboardCutAction",
                  null,
                )
              }
              onCopy={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.clipboardCopyAction",
                  null,
                )
              }
              onPaste={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.clipboardPasteAction",
                  null,
                )
              }
              onFind={() =>
                editorRef.current?.trigger(null, "actions.find", null)
              }
              // View Actions
              onToggleWordCount={handleWordCount}
              onZoomIn={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.fontZoomIn",
                  null,
                )
              }
              onZoomOut={() =>
                editorRef.current?.trigger(
                  null,
                  "editor.action.fontZoomOut",
                  null,
                )
              }
              // Tools
              onOpenWizard={(wizard) =>
                setActiveView(`wizard-${wizard}` as ViewType)
              }
              onOpenSettings={() => {
                setActiveActivity("settings");
                setActiveView("settings");
                setIsSidebarOpen(false);
              }}
              // Database Menu Actions
              onOpenDatabase={handleOpenFolder}
              onAddCollection={handleAddFolder}
              onRefreshDatabase={() =>
                reloadProjectFiles(projectData.map((node) => node.path))
              }
              // Build Actions
              onCompile={handleCompile}
              onStopCompile={handleStopCompile}
              // Package Browser
              onOpenPackageBrowser={() => setActiveView("package-browser")}
              // Insert Actions
              onInsertImage={async () => {
                if (editorRef.current) {
                  try {
                    // @ts-ignore
                    const { open } = await import("@tauri-apps/plugin-dialog");
                    const selectedPath = await open({
                      multiple: false,
                      title: "Select Image",
                      filters: [
                        {
                          name: "Images",
                          extensions: [
                            "png",
                            "jpg",
                            "jpeg",
                            "gif",
                            "pdf",
                            "eps",
                            "svg",
                          ],
                        },
                      ],
                    });

                    if (selectedPath && typeof selectedPath === "string") {
                      const imageCode = `\\begin{figure}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{${selectedPath}}
    \\caption{Caption here}
    \\label{fig:label}
\\end{figure}`;
                      const selection = editorRef.current.getSelection();
                      if (selection) {
                        editorRef.current.executeEdits("header-menu", [
                          {
                            range: selection,
                            text: imageCode,
                            forceMoveMarkers: true,
                          },
                        ]);
                        editorRef.current.focus();
                      }
                    }
                  } catch (e) {
                    console.error("Failed to open image dialog:", e);
                  }
                }
              }}
              onToggleAI={() => {
                if (activeView === "ai-assistant") {
                  setActiveView("editor");
                } else {
                  setActiveView("ai-assistant");
                }
              }}
            />
          </AppShell.Header>

          {/* Global Resize Overlay & Ghost Line - Placed here to avoid container clipping */}
          {isResizing && (
            <Box
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                cursor: "col-resize",
                userSelect: "none",
              }}
            />
          )}

          <Box
            ref={ghostRef}
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              width: 4,
              backgroundColor: "var(--mantine-primary-color-6)",
              zIndex: 10000,
              display: "none",
              pointerEvents: "none",
              cursor: "col-resize",
            }}
          />

          {/* MAIN LAYOUT */}
          <AppShell.Main
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100vh",
              paddingTop: 35,
              paddingBottom: 24,
              backgroundColor: "var(--app-bg)",
            }}
          >
            <Group gap={0} h="calc(100vh - 35px - 24px)" wrap="nowrap">
              {/* 1. SIDEBAR */}
              <Sidebar
                width={sidebarWidth}
                isOpen={isSidebarOpen}
                onResizeStart={startResizeSidebar}
                activeSection={activeActivity} // This assumes activeActivity is of type SidebarSection
                onToggleSection={handleToggleSidebar}
                onNavigate={setActiveView}
                // File System
                onOpenFolder={handleOpenFolder}
                onAddFolder={handleAddFolder}
                onRemoveFolder={handleRemoveFolder}
                onOpenFileNode={handleOpenFileNode}
                onOpenFileAtLine={handleOpenFileAtLine}
                onCreateItem={handleCreateItem}
                onRenameItem={handleRenameItem}
                onDeleteItem={handleDeleteItem}
                onMoveItem={handleMoveItem}
                // Tools
                onInsertSymbol={handleInsertSnippet}
                activePackageId={activePackageId}
                onSelectPackage={setActivePackageId}
                outlineSource={outlineSource}
                onScrollToLine={handleRevealLine}
                // Git & History
                projectPath={
                  projectData.length > 0 ? projectData[0].path : undefined
                }
                activeFilePath={activeTab?.id}
                activeFileContent={activeTab?.content}
                onRestoreContent={(content) => {
                  if (activeTab) {
                    updateTabContent(activeTab.id, content);
                    markDirty(activeTab.id, true);
                  }
                }}
              />

              {/* 2. CENTER: EDITOR / VIEWS */}
              <Box
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {activeView === "settings" ? (
                  <SettingsPanel
                    settings={settings}
                    onUpdateEditor={updateEditorSetting}
                    onUpdateEditorBehavior={updateEditorBehaviorSetting}
                    onUpdatePdfViewer={updatePdfViewerSetting}
                    onUpdateCompilation={updateCompilationSetting}
                    onUpdateTexEngine={updateTexEngineSetting}
                    onUpdateDatabase={updateDatabaseSetting}
                    onUpdateAccessibility={updateAccessibilitySetting}
                    onUpdateGeneral={updateGeneralSetting}
                    onUpdateUi={setUiTheme}
                    onUpdateCustomThemeOverride={updateCustomThemeOverride}
                    onAddCustomTheme={addCustomTheme}
                    onRemoveCustomTheme={removeCustomTheme}
                  />
                ) : /* Default: EDITOR AREA with optional Database Panel */
                databasePanelPosition === "left" && showDatabasePanel ? (
                  /* Horizontal layout: Database left, Editor right */
                  <Group gap={0} h="100%" wrap="nowrap">
                    <Box
                      style={{
                        width: "var(--database-panel-width)",
                        minWidth: 250,
                        maxWidth: 800,
                        height: "100%",
                        borderRight:
                          "1px solid var(--mantine-color-default-border)",
                        overflow: "hidden",
                      }}
                    >
                      <DatabaseView
                        onOpenFile={handleOpenFileFromTable}
                        canInsert={(() => {
                          if (!activeTab) return false;

                          // 1. Check Metadata
                          const resource = useDatabaseStore
                            .getState()
                            .allLoadedResources.find(
                              (r) =>
                                r.path === activeTab.id ||
                                r.id === activeTab.id,
                            );
                          if (resource && resource.kind === "document")
                            return true;

                          // 2. Fallback: Check content
                          if (
                            activeTab.content &&
                            activeTab.content.includes("\\documentclass")
                          )
                            return true;

                          return false;
                        })()}
                      />
                    </Box>
                    <ResizerHandle
                      onMouseDown={startResizeDatabase}
                      isResizing={isResizing}
                      orientation="vertical"
                    />
                    <Box
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: "100%",
                        overflow: "hidden",
                      }}
                    >
                      <EditorArea
                        files={tabs}
                        activeFileId={activeTabId}
                        onFileSelect={handleTabChange}
                        onFileClose={handleCloseTab}
                        onCloseFiles={handleCloseTabs}
                        onContentChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        showPdf={showRightPanel && activeView === "editor"}
                        onTogglePdf={handleTogglePdf}
                        isTexFile={isTexFile}
                        onCompile={handleCompile}
                        isCompiling={isCompiling}
                        onStopCompile={handleStopCompile}
                        onSave={handleSave}
                        onCreateEmpty={handleCreateEmpty}
                        onOpenWizard={handleOpenPreambleWizard}
                        onCreateFromTemplate={handleCreateFromTemplate}
                        recentProjects={recentProjects}
                        onOpenRecent={handleOpenRecent}
                        onOpenDatabase={handleOpenDatabase}
                        onOpenPackageBrowser={handleOpenPackageBrowser}
                        onOpenExamGenerator={handleOpenExamGenerator}
                        editorSettings={editorSettingsMemo}
                        logEntries={logEntries}
                        showLogPanel={showLogPanel}
                        onCloseLogPanel={handleCloseLogPanel}
                        onJumpToLine={handleRevealLine}
                        onCursorChange={handleCursorChange}
                        onSyncTexForward={handleSyncTexForward}
                        spellCheckEnabled={spellCheckEnabled}
                        onOpenFileFromTable={handleOpenFileFromTable}
                        onOpenFile={handleOpenFileFromTable} // handleOpenFileFromTable is stable
                        onOpenFileDialog={handleOpenFileDialog}
                        lspClient={lspClientRef.current}
                      />
                    </Box>
                  </Group>
                ) : (
                  /* Vertical layout: Editor top, Database bottom (or no database) */
                  <Stack gap={0} h="100%">
                    <Box
                      style={{
                        flex: 1,
                        minHeight: 0,
                        overflow: "hidden",
                      }}
                    >
                      <EditorArea
                        files={tabs}
                        activeFileId={activeTabId}
                        onFileSelect={handleTabChange}
                        onFileClose={handleCloseTab}
                        onCloseFiles={handleCloseTabs}
                        onContentChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        showPdf={showRightPanel && activeView === "editor"}
                        onTogglePdf={handleTogglePdf}
                        isTexFile={isTexFile}
                        onCompile={handleCompile}
                        isCompiling={isCompiling}
                        onStopCompile={handleStopCompile}
                        onSave={handleSave}
                        onCreateEmpty={handleCreateEmpty}
                        onOpenWizard={handleOpenPreambleWizard}
                        onCreateFromTemplate={handleCreateFromTemplate}
                        recentProjects={recentProjects}
                        onOpenRecent={handleOpenRecent}
                        onOpenDatabase={handleOpenDatabase}
                        onOpenPackageBrowser={handleOpenPackageBrowser}
                        onOpenExamGenerator={handleOpenExamGenerator}
                        onOpenTemplateModal={handleOpenTemplateModal}
                        editorSettings={editorSettingsMemo}
                        logEntries={logEntries}
                        showLogPanel={showLogPanel}
                        onCloseLogPanel={handleCloseLogPanel}
                        onJumpToLine={handleRevealLine}
                        onCursorChange={handleCursorChange}
                        onSyncTexForward={handleSyncTexForward}
                        spellCheckEnabled={spellCheckEnabled}
                        onOpenFileFromTable={handleOpenFileFromTable}
                        onOpenFile={handleOpenFileFromTable}
                        onOpenFileDialog={handleOpenFileDialog}
                        lspClient={lspClientRef.current}
                      />
                    </Box>
                    {showDatabasePanel && (
                      <>
                        <ResizerHandle
                          onMouseDown={startResizeDatabaseHeight}
                          isResizing={isResizing}
                          orientation="horizontal"
                        />
                        <Box
                          style={{
                            height: "var(--database-panel-height)",
                            minHeight: 100,
                            maxHeight: "80%",
                            borderTop:
                              "1px solid var(--mantine-color-default-border)",
                            overflow: "hidden",
                          }}
                        >
                          <DatabaseView
                            onOpenFile={handleOpenFileFromTable}
                            canInsert={(() => {
                              if (!activeTab) return false;

                              // 1. Check Metadata
                              const resource = useDatabaseStore
                                .getState()
                                .allLoadedResources.find(
                                  (r) =>
                                    r.path === activeTab.id ||
                                    r.id === activeTab.id,
                                );
                              if (resource && resource.kind === "document")
                                return true;

                              // 2. Fallback: Check content
                              if (
                                activeTab.content &&
                                activeTab.content.includes("\\documentclass")
                              )
                                return true;

                              return false;
                            })()}
                          />
                        </Box>
                      </>
                    )}
                  </Stack>
                )}
              </Box>

              {/* 3. RIGHT PANEL (PDF / Inspectors / Gallery) */}
              {showRightPanel && (
                <>
                  <ResizerHandle
                    onMouseDown={startResizeRightPanel}
                    isResizing={isResizing}
                  />
                  <Box
                    style={{
                      width: "var(--right-panel-width)",
                      height: "100%",
                      borderLeft:
                        "1px solid var(--mantine-color-default-border)",
                      backgroundColor: "var(--app-panel-bg)",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    {activeView === "gallery" ? (
                      <PackageGallery
                        selectedPkgId={activePackageId || ""}
                        onInsert={(code) => {
                          handleInsertSnippet(code);
                        }}
                        onClose={() => setActiveView("editor")}
                        onOpenWizard={setActiveView}
                        onOpenPackageBrowser={() =>
                          setActiveView("package-browser")
                        }
                      />
                    ) : activeView === "package-browser" ? (
                      <PackageBrowser
                        compact={true}
                        onClose={() => setActiveView("editor")}
                        onInsertPackage={(code) => {
                          handleInsertSnippet(code);
                        }}
                      />
                    ) : activeView === "wizard-preamble" ? (
                      <WizardWrapper
                        title="Preamble Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <PreambleWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-table" ||
                      activeView === "wizard-tabularray" ? (
                      <WizardWrapper
                        title="Table Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <UnifiedTableWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-math" ? (
                      <WizardWrapper
                        title="Math Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <MathWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-graphicx" ? (
                      <WizardWrapper
                        title="Graphicx Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <GraphicxWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-tikz" ? (
                      <WizardWrapper
                        title="TikZ Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <TikzPgfPlotsWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-fancyhdr" ? (
                      <WizardWrapper
                        title="Fancy Header Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <FancyhdrWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                        />
                      </WizardWrapper>
                    ) : activeView === "wizard-pstricks" ? (
                      <WizardWrapper
                        title="PSTricks Wizard"
                        onClose={() => setActiveView("editor")}
                      >
                        <PstricksWizard
                          onInsert={(code) => {
                            handleInsertSnippet(code);
                            setActiveView("editor");
                          }}
                          onChange={() => {}}
                        />
                      </WizardWrapper>
                    ) : activeView === "ai-assistant" ? (
                      <AISidebar
                        onInsertCode={(code) => handleInsertSnippet(code)}
                        onClose={() => setActiveView("editor")}
                      />
                    ) : (
                      <ResourceInspector
                        mainEditorPdfUrl={pdfUrl}
                        syncTexCoords={syncTexCoords}
                        pdfRefreshTrigger={pdfRefreshTrigger}
                        onInsertFragment={handleInsertSnippet}
                        canInsert={(() => {
                          if (!activeTab) return false;

                          // 1. Check Metadata
                          const resource = useDatabaseStore
                            .getState()
                            .allLoadedResources.find(
                              (r) =>
                                r.path === activeTab.id ||
                                r.id === activeTab.id,
                            );
                          if (resource && resource.kind === "document")
                            return true;

                          // 2. Fallback: Check content
                          if (
                            activeTab.content &&
                            activeTab.content.includes("\\documentclass")
                          )
                            return true;

                          return false;
                        })()}
                      />
                    )}
                  </Box>
                </>
              )}
            </Group>
          </AppShell.Main>

          {/* FOOTER */}
          <AppShell.Footer withBorder={false} p={0}>
            <StatusBar
              language={activeTab?.language}
              dbConnected={true}
              spellCheckEnabled={spellCheckEnabled}
              onToggleSpellCheck={() =>
                setSpellCheckEnabled(!spellCheckEnabled)
              }
              onWordCount={handleWordCount}
            />
          </AppShell.Footer>

          <Modal
            opened={showWordCount}
            onClose={() => setShowWordCount(false)}
            title="Word Count Result"
          >
            <Text style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
              {wordCountResult}
            </Text>
          </Modal>

          {/* Template Modal */}
          <Modal
            opened={showTemplateModal}
            onClose={() => setShowTemplateModal(false)}
            title="Create New Document from Template"
            size="xl"
            centered
            styles={{
              body: { height: "70vh", overflow: "hidden" },
            }}
          >
            <div
              style={{
                display: "flex",
                height: "100%",
                gap: "1rem",
              }}
            >
              {/* LEFT COLUMN: Template List */}
              <div
                style={{
                  width: "35%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <ScrollArea h="100%">
                  <Stack gap="sm">
                    {templates.map((template) => {
                      const isSelected = selectedTemplateId === template.id;
                      return (
                        <div
                          key={template.id}
                          onClick={() => handleTemplateClick(template.id)}
                          onDoubleClick={() => {
                            handleTemplateClick(template.id);
                            handleCreateSelectedTemplate();
                          }}
                          style={{
                            padding: "1rem",
                            border: `1px solid ${
                              isSelected
                                ? "var(--mantine-primary-color-filled)"
                                : "var(--mantine-color-default-border)"
                            }`,
                            borderRadius: "var(--mantine-radius-md)",
                            cursor: "pointer",
                            backgroundColor: isSelected
                              ? "var(--mantine-color-default-hover)"
                              : "transparent",
                            transition: "all 0.2s",
                          }}
                        >
                          <Group mb="xs" wrap="nowrap">
                            {/* @ts-ignore */}
                            <FontAwesomeIcon
                              icon={
                                FaIcons[
                                  (() => {
                                    switch (template.icon) {
                                      case "file-pen":
                                        return "faPenToSquare";
                                      case "list-check":
                                        return "faListCheck";
                                      case "book-open":
                                        return "faBookOpen";
                                      case "person-chalkboard":
                                        return "faChalkboardUser";
                                      case "newspaper":
                                        return "faNewspaper";
                                      case "graduation-cap":
                                        return "faGraduationCap";
                                      case "book":
                                        return "faBook";
                                      case "image":
                                        return "faImage";
                                      default:
                                        return "faFile";
                                    }
                                  })()
                                ] || FaIcons.faFile
                              }
                              style={{
                                width: "1.25rem",
                                height: "1.25rem",
                                color: isSelected
                                  ? "var(--mantine-primary-color-filled)"
                                  : "var(--mantine-color-dimmed)",
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <Text
                                fw={600}
                                size="sm"
                                c={isSelected ? "bright" : "dimmed"}
                                style={{
                                  color: isSelected
                                    ? "var(--mantine-color-text)"
                                    : undefined,
                                }}
                              >
                                {template.name}
                              </Text>
                              <Text size="xs" c="dimmed" lineClamp={2}>
                                {template.description}
                              </Text>
                            </div>
                          </Group>
                        </div>
                      );
                    })}
                  </Stack>
                </ScrollArea>
              </div>

              {/* RIGHT COLUMN: Preview & Action */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  borderLeft: "1px solid var(--mantine-color-default-border)",
                  paddingLeft: "1rem",
                }}
              >
                <Text fw={600} mb="xs">
                  Template Preview:
                </Text>
                <ScrollArea
                  flex={1}
                  type="auto"
                  style={{
                    border: "1px solid var(--mantine-color-default-border)",
                    borderRadius: "var(--mantine-radius-md)",
                    backgroundColor: "var(--mantine-color-default-active)",
                  }}
                >
                  <Code
                    block
                    style={{
                      backgroundColor: "transparent",
                      minHeight: "100%",
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                    }}
                  >
                    {selectedTemplateId
                      ? getTemplateById(selectedTemplateId)?.content
                      : "Select a template to view code..."}
                  </Code>
                </ScrollArea>

                <Group justify="flex-end" mt="md">
                  <Button
                    variant="default"
                    onClick={() => setShowTemplateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSelectedTemplate}>
                    Create Document
                  </Button>
                </Group>
              </div>
            </div>
          </Modal>
        </AppShell>
      </DndContext>
      <UnsavedChangesModal
        opened={unsavedChangesModalOpen}
        onClose={handleCancelClose}
        onDiscard={handleConfirmDiscard}
        onSave={handleConfirmSave}
        fileName={tabs.find((t) => t.id === tabToCloseId)?.title || "this file"}
      />
    </MantineProvider>
  );
}
