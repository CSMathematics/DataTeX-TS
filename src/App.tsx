import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  AppShell,
  Box,
  Group,
  MantineProvider,
  Notification,
  Text,
  CSSVariablesResolver,
  Modal,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { debounce, throttle } from "lodash";
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";

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
import { TableWizard } from "./components/wizards/TableWizard";
import { TikzWizard } from "./components/wizards/TikzWizard";
import { FancyhdrWizard } from "./components/wizards/FancyhdrWizard";
import { PackageGallery } from "./components/wizards/PackageGallery";
import { SettingsPanel } from "./components/settings/SettingsPanel";
import { DatabaseView } from "./components/database/DatabaseView";
import { ResourceInspector } from "./components/database/ResourceInspector";

import {
  latexLanguage,
  latexConfiguration,
  setupLatexProviders,
} from "./languages/latex";
import { dataTexDarkTheme } from "./themes/monaco-theme";
import { dataTexLightTheme } from "./themes/monaco-light";
import { dataTexHCTheme } from "./themes/monaco-hc";
import { useSettings } from "./hooks/useSettings";

import { TexlabLspClient } from "./services/lspClient";
import {
  useTabsStore,
  useActiveTab,
  useIsTexFile,
} from "./stores/useTabsStore";

import { useProjectStore } from "./stores/projectStore";
import { useAppPanelResize } from "./hooks/useAppPanelResize";
import { useProjectFiles } from "./hooks/useProjectFiles";
import { useCompilation } from "./hooks/useCompilation";
import { usePdfState } from "./hooks/usePdfState";

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
  },
  light: {},
  dark: {},
});

export default function App() {
  const {
    settings,
    updateEditorSetting,
    updateEditorBehaviorSetting,
    updatePdfViewerSetting,
    updateCompilationSetting,
    updateDatabaseSetting,
    updateAccessibilitySetting,
    updateGeneralSetting,
    setUiTheme,
  } = useSettings();

  const activeTheme = getTheme(settings.uiTheme);

  // --- PERFORMANCE OPTIMIZATION: Memoize settings to prevent EditorArea re-renders ---
  // This is crucial. Without this, every time App re-renders (e.g., cursor move),
  // a new object is passed to EditorArea, breaking React.memo.
  const editorSettingsMemo = useMemo(() => settings.editor, [settings.editor]);

  // --- Layout State ---
  const [activeActivity, setActiveActivity] =
    useState<SidebarSection>("database");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<ViewType>("editor");
  const [activePackageId, setActivePackageId] = useState<string>("amsmath");

  // --- Resizing State (from custom hook) ---
  // Note: sidebarWidth/rightPanelWidth are applied via CSS variables in the hook
  const {
    databasePanelWidth,
    isResizing,
    ghostRef,
    startResizeSidebar,
    startResizeRightPanel,
    startResizeDatabase,
  } = useAppPanelResize();

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
  const [cursorPosition, setCursorPosition] = useState({
    lineNumber: 1,
    column: 1,
  });
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(false);

  // --- LSP State ---
  const lspClientRef = useRef<TexlabLspClient | null>(null);

  // --- Compilation State ---

  const [compileError, setCompileError] = useState<string | null>(null);

  // --- Word Count State ---
  const [showWordCount, setShowWordCount] = useState(false);
  const [wordCountResult, setWordCountResult] = useState<string>("");

  // --- File System & DB State ---
  const [dbConnected, setDbConnected] = useState(false);
  const [dbTables, setDbTables] = useState<string[]>([]);

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
    loadingFiles,
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
    onSetCompileError: setCompileError,
    onSetActiveActivity: (act) => setActiveActivity(act as SidebarSection),
    onAddToRecent: addToRecent,
    openTab,
    renameTab,
    closeTab: closeTabStore,
  });

  // --- Database Panel State ---
  const [showDatabasePanel, setShowDatabasePanel] = useState(true);

  // --- Right Sidebar (ResourceInspector) State ---
  const [showRightSidebar, setShowRightSidebar] = useState(true);

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
        // @ts-ignore
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(tab.id, contentToSave);

        // Update tab dirty state and content
        markDirty(targetId, false);
        updateTabContent(targetId, contentToSave);
      } catch (e) {
        console.error("Failed to save file:", e);
        setCompileError("Failed to save file: " + String(e));
      }
    },
    [tabs, activeTabId, markDirty, updateTabContent]
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
    setCompileError,
  });

  // --- PDF Hook ---
  const { showPdf, pdfUrl, handleTogglePdf, handleSyncTexForward } =
    usePdfState({
      activeTab,
      isTexFile,
      pdfRefreshTrigger,
      setCompileError,
    });

  const isWizardActive = useMemo(
    () => activeView.startsWith("wizard-") || activeView === "gallery",
    [activeView]
  );
  const showRightPanel = useMemo(
    () =>
      showRightSidebar &&
      (isWizardActive || (activeView === "editor" && showPdf && isTexFile)),
    [showRightSidebar, isWizardActive, activeView, showPdf, isTexFile]
  );

  // --- Sync projectData to projectStore for DatabaseSidebar ---
  const setProjectDataToStore = useProjectStore(
    (state) => state.setProjectData
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

  // --- Initialize LSP when rootPath changes ---
  useEffect(() => {
    const initLsp = async () => {
      if (rootPath && !lspClientRef.current) {
        try {
          const client = new TexlabLspClient();
          await client.initialize(`file://${rootPath}`);
          lspClientRef.current = client;
          console.log("LSP client initialized for:", rootPath);
        } catch (error) {
          console.error("Failed to initialize LSP:", error);
        }
      }
    };
    initLsp();

    return () => {
      // Cleanup on unmount or rootPath change
      if (lspClientRef.current) {
        lspClientRef.current.shutdown();
        lspClientRef.current = null;
      }
    };
  }, [rootPath]);

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
              : currentView
          );
        }

        // If clicking the same section, toggle sidebar visibility
        // If clicking a different section, open sidebar and switch to that section
        if (activeActivity === section) {
          setIsSidebarOpen((prev) => !prev);
        } else {
          setActiveActivity(section);
          setIsSidebarOpen(true);
        }
      }
    },
    [activeActivity]
  );

  // --- HELPER: Load Project Files ---
  // --- HELPER: Load Project Files (Moved to useProjectFiles) ---

  // --- CORE: Create Tab Logic ---
  const debouncedOutlineUpdate = useCallback(
    debounce((content: string) => {
      setOutlineSource(content);
    }, 1000),
    []
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
    [activeTabId, tabs, updateTabContent, setActiveTab]
  );

  const createTabWithContent = useCallback(
    async (code: string, defaultTitle: string = "Untitled.tex") => {
      try {
        let filePath: string | null = null;
        try {
          // @ts-ignore
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
          // @ts-ignore
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
        setCompileError("Failed to create file: " + String(e));
      }
    },
    [handleTabChange]
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
    [createTabWithContent]
  );
  const handleOpenPreambleWizard = useCallback(
    () => setActiveView("wizard-preamble"),
    []
  );

  // --- File Handlers (Moved to useProjectFiles) ---

  const handleCloseTab = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      const tab = tabs.find((t) => t.id === id);
      if (tab && tab.isDirty) {
        // @ts-ignore
        const { confirm } = await import("@tauri-apps/plugin-dialog");
        const confirmed = await confirm(
          `You have unsaved changes in '${tab.title}'.\nAre you sure you want to close it?`,
          {
            title: "Unsaved Changes",
            kind: "warning",
            okLabel: "Close",
            cancelLabel: "Cancel",
          }
        );
        if (!confirmed) return;
      }

      // Use store's closeTab - it handles everything
      const closed = closeTabStore(id);
      if (!closed) {
        // Tab had unsaved changes but user cancelled - shouldn't happen here since we already confirmed
      }
    },
    [tabs, closeTabStore]
  );

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
        // @ts-ignore
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
    [tabs, setActiveTab, openTab]
  );

  const handleCloseTabs = useCallback(
    (ids: string[]) => {
      closeTabsById(ids);
    },
    [closeTabsById]
  );

  const handleEditorChange = useCallback(
    (id: string, val: string) => {
      // Only update isDirty flag to avoid heavy re-renders
      const tab = tabs.find((t) => t.id === id);
      if (tab && !tab.isDirty) {
        markDirty(id, true);
      }

      if (activeActivity === "outline") {
        debouncedOutlineUpdate(val);
      }
    },
    [tabs, markDirty, activeActivity, debouncedOutlineUpdate]
  );

  // --- FIX: Update structure on view change ---
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

  // Throttled cursor position update
  const handleCursorChange = useCallback(
    throttle((line: number, column: number) => {
      setCursorPosition((prev) => {
        if (prev.lineNumber === line && prev.column === column) return prev;
        return { lineNumber: line, column };
      });
    }, 200),
    []
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
          latexConfiguration
        );

        setupLatexProviders(monaco);

        monaco.editor.defineTheme("data-tex-dark", dataTexDarkTheme);
        monaco.editor.defineTheme("data-tex-light", dataTexLightTheme);
        monaco.editor.defineTheme("data-tex-hc", dataTexHCTheme);
      }
      // settings is a dependency here
      monaco.editor.setTheme(settings.editor.theme);
    },
    [settings.editor.theme]
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
        texPath.includes("\\") ? "\\" : "/"
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
      setCompileError("Word count failed: " + String(e));
    }
  }, [activeTab, isTexFile]);

  // --- Handlers (DB) ---
  const handleConnectDB = useCallback(() => {
    setDbConnected((prev) => {
      if (prev) {
        setDbTables([]);
        return false;
      } else {
        setDbTables([
          "resources",
          "documents",
          "bibliography",
          "dependencies",
          "document_items",
        ]);
        return true;
      }
    });
  }, []);

  const handleOpenTable = useCallback(
    (tableName: string) => {
      const tabId = `table-${tableName}`;
      openTab({
        id: tabId,
        title: tableName,
        type: "table",
        tableName: tableName,
      });
    },
    [openTab]
  );

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
    },
    [handleOpenFileNode]
  );

  // --- Resize Logic moved to useAppPanelResize hook ---

  // --- DND Logic ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
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
    [handleOpenFileNode, handleMoveItem]
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
              onOpenFile={handleOpenFolder}
              showDatabasePanel={showDatabasePanel}
              onToggleDatabasePanel={() =>
                setShowDatabasePanel(!showDatabasePanel)
              }
              showRightSidebar={showRightSidebar}
              onToggleRightSidebar={() =>
                setShowRightSidebar(!showRightSidebar)
              }
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
              overflow: "hidden",
              boxSizing: "border-box",
              backgroundColor: "var(--app-bg)",
            }}
          >
            {compileError && (
              <Box
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  zIndex: 1000,
                  maxWidth: 400,
                }}
              >
                <Notification
                  color="red"
                  title="Error"
                  onClose={() => setCompileError(null)}
                  withBorder
                >
                  <pre style={{ fontSize: 10, whiteSpace: "pre-wrap" }}>
                    {compileError}
                  </pre>
                </Notification>
              </Box>
            )}

            <Group
              gap={0}
              wrap="nowrap"
              h="100%"
              align="stretch"
              style={{ flex: 1, overflow: "hidden", minHeight: 0 }}
            >
              {/* 1. SIDEBAR */}
              <Sidebar
                width="var(--sidebar-width)"
                isOpen={isSidebarOpen}
                onResizeStart={startResizeSidebar}
                activeSection={activeActivity}
                onToggleSection={handleToggleSidebar}
                onNavigate={setActiveView}
                openTabs={tabs}
                activeTabId={activeTabId}
                onTabSelect={handleTabChange}
                projectData={projectData}
                onOpenFolder={handleOpenFolder}
                onOpenFileNode={handleOpenFileNode}
                onAddFolder={handleAddFolder}
                onRemoveFolder={handleRemoveFolder}
                loadingFiles={loadingFiles}
                dbConnected={dbConnected}
                dbTables={dbTables}
                onConnectDB={handleConnectDB}
                onOpenTable={handleOpenTable}
                onCreateItem={handleCreateItem}
                onRenameItem={handleRenameItem}
                onDeleteItem={handleDeleteItem}
                onMoveItem={handleMoveItem}
                onInsertSymbol={handleInsertSnippet}
                activePackageId={activePackageId}
                onSelectPackage={setActivePackageId}
                outlineSource={outlineSource}
                onScrollToLine={handleRevealLine}
              />

              {/* 2. CENTER: DATABASE VIEW (when toggled) + EDITOR AREA */}
              <Box
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "row",
                  overflow: "hidden",
                  minHeight: 0,
                }}
              >
                {/* Database Table - LEFT SIDE (only when toggled ON and not in settings) */}
                {showDatabasePanel && activeView !== "settings" && (
                  <>
                    <Box
                      style={{
                        width: `${databasePanelWidth}px`,
                        minWidth: "250px",
                        maxWidth: "60%",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                      }}
                    >
                      <DatabaseView onOpenFile={handleOpenFileFromTable} />
                    </Box>

                    {/* Resize handle between Database and Editor */}
                    <ResizerHandle
                      onMouseDown={startResizeDatabase}
                      isResizing={isResizing}
                    />
                  </>
                )}

                {/* Editor/Settings - RIGHT SIDE (always visible) */}
                <Box
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    minHeight: 0,
                  }}
                >
                  {activeView === "settings" ? (
                    <SettingsPanel
                      settings={settings}
                      onUpdateEditor={updateEditorSetting}
                      onUpdateEditorBehavior={updateEditorBehaviorSetting}
                      onUpdatePdfViewer={updatePdfViewerSetting}
                      onUpdateCompilation={updateCompilationSetting}
                      onUpdateDatabase={updateDatabaseSetting}
                      onUpdateAccessibility={updateAccessibilitySetting}
                      onUpdateGeneral={updateGeneralSetting}
                      onUpdateUi={setUiTheme}
                    />
                  ) : (
                    <EditorArea
                      files={tabs}
                      activeFileId={activeTabId}
                      onFileSelect={handleTabChange}
                      onFileClose={handleCloseTab}
                      onCloseFiles={handleCloseTabs}
                      onContentChange={handleEditorChange}
                      onMount={handleEditorDidMount}
                      showPdf={showPdf}
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
                      // --- PASSING MEMOIZED SETTINGS ---
                      editorSettings={editorSettingsMemo}
                      logEntries={logEntries}
                      showLogPanel={showLogPanel}
                      onCloseLogPanel={handleCloseLogPanel}
                      onJumpToLine={handleRevealLine}
                      onCursorChange={handleCursorChange}
                      onSyncTexForward={handleSyncTexForward}
                      spellCheckEnabled={spellCheckEnabled}
                      onOpenFileFromTable={handleOpenFileFromTable}
                      lspClient={lspClientRef.current}
                    />
                  )}
                </Box>
              </Box>

              {/* 3. RIGHT PANEL WITH TRANSITION */}

              {/* Resizer for Right Panel */}
              {showRightPanel && (
                <ResizerHandle
                  onMouseDown={startResizeRightPanel}
                  isResizing={isResizing}
                />
              )}

              {/* Right Panel Content */}
              <Box
                w={showRightPanel ? "var(--right-panel-width)" : 0}
                h="100%"
                style={{
                  flexShrink: 0,
                  overflow: "hidden",
                  display: showRightPanel ? "flex" : "none",
                  flexDirection: "column",
                  minWidth: 0,
                  transition: isResizing
                    ? "none"
                    : "width 300ms ease-in-out, opacity 200ms ease-in-out",
                  opacity: showRightPanel ? 1 : 0,
                  whiteSpace: "nowrap",
                  backgroundColor: "var(--app-panel-bg)",
                  borderLeft: "1px solid var(--mantine-color-default-border)",
                }}
              >
                {/* Right Panel Content: Wizard > Gallery > ResourceInspector (when resource selected) > PDF Preview (default) */}
                {activeView.startsWith("wizard-") ? (
                  <WizardWrapper
                    title={activeView.replace("wizard-", "").toUpperCase()}
                    onClose={() => setActiveView("editor")}
                  >
                    {activeView === "wizard-preamble" && (
                      <PreambleWizard
                        onInsert={(code: string) => {
                          handleInsertSnippet(code);
                          setActiveView("editor");
                        }}
                      />
                    )}
                    {activeView === "wizard-table" && (
                      <TableWizard
                        onInsert={(code: string) => {
                          handleInsertSnippet(code);
                          setActiveView("editor");
                        }}
                      />
                    )}
                    {activeView === "wizard-tikz" && (
                      <TikzWizard
                        onInsert={(code: string) => {
                          handleInsertSnippet(code);
                          setActiveView("editor");
                        }}
                      />
                    )}
                    {activeView === "wizard-fancyhdr" && (
                      <FancyhdrWizard
                        onInsert={(code: string) => {
                          handleInsertSnippet(code);
                          setActiveView("editor");
                        }}
                      />
                    )}
                  </WizardWrapper>
                ) : activeView === "gallery" ? (
                  <PackageGallery
                    selectedPkgId={activePackageId}
                    onInsert={(code: string) => {
                      handleInsertSnippet(code);
                      setActiveView("editor");
                    }}
                    onClose={() => setActiveView("editor")}
                    onOpenWizard={setActiveView}
                  />
                ) : (
                  /* ResourceInspector with 3 tabs: PDF, Metadata, Bibliography */
                  <ResourceInspector mainEditorPdfUrl={pdfUrl} />
                )}
              </Box>
            </Group>
          </AppShell.Main>

          {/* FOOTER */}
          <AppShell.Footer withBorder={false} p={0}>
            <StatusBar
              activeFile={tabs.find((f) => f.id === activeTabId)}
              dbConnected={dbConnected}
              cursorPosition={cursorPosition}
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
        </AppShell>
      </DndContext>
    </MantineProvider>
  );
}
