import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  AppShell,
  Box,
  Group,
  MantineProvider,
  Notification,
  Text,
  CSSVariablesResolver,
  Modal
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core"; 
import { debounce, throttle } from "lodash";
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';

// --- Custom Theme ---
import { getTheme } from "./themes/ui-themes";

// --- Layout Components ---
import { HeaderContent } from "./components/layout/Header";
import { Sidebar, SidebarSection, ViewType, FileSystemNode } from "./components/layout/Sidebar";
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

import { latexLanguage, latexConfiguration, setupLatexProviders } from "./languages/latex";
import { dataTexDarkTheme } from "./themes/monaco-theme";
import { dataTexLightTheme } from "./themes/monaco-light";
import { dataTexHCTheme } from "./themes/monaco-hc";
import { useSettings } from "./hooks/useSettings";
import { parseLatexLog, LogEntry } from "./utils/logParser";
import { TexlabLspClient } from "./services/lspClient";
import { useTabsStore, useActiveTab, useIsTexFile } from "./stores/useTabsStore";
import { useDatabaseStore } from "./stores/databaseStore";
import { useProjectStore } from "./stores/projectStore";

// --- CSS Variables Resolver ---
const resolver: CSSVariablesResolver = (theme) => ({
  variables: {
    '--app-bg': theme.other?.appBg || 'var(--mantine-color-body)',
    '--app-sidebar-bg': theme.other?.sidebarBg || 'var(--mantine-color-default)',
    '--app-header-bg': theme.other?.headerBg || 'var(--mantine-color-default)',
    '--app-status-bar-bg': theme.other?.statusBarBg || 'var(--mantine-primary-color-filled)',
    '--app-panel-bg': theme.other?.panelBg || 'var(--mantine-color-default)',
  },
  light: {},
  dark: {},
});

export default function App() {
  const { settings, updateEditorSetting, updateGeneralSetting, setUiTheme } = useSettings();

  const activeTheme = getTheme(settings.uiTheme);

  // --- PERFORMANCE OPTIMIZATION: Memoize settings to prevent EditorArea re-renders ---
  // This is crucial. Without this, every time App re-renders (e.g., cursor move),
  // a new object is passed to EditorArea, breaking React.memo.
  const editorSettingsMemo = useMemo(() => settings.editor, [settings.editor]);

  // --- Layout State ---
  const [activeActivity, setActiveActivity] = useState<SidebarSection>("database");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [activeView, setActiveView] = useState<ViewType>("editor");
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [rightPanelWidth, setRightPanelWidth] = useState(600);
  const [activePackageId, setActivePackageId] = useState<string>('amsmath');
  
  // --- Resizing State ---
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [isResizingDatabase, setIsResizingDatabase] = useState(false);
  const [databasePanelWidth, setDatabasePanelWidth] = useState(400);
  const rafRef = useRef<number | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);


  // --- Editor State (from Zustand) ---
  const tabs = useTabsStore(state => state.tabs);
  const activeTabId = useTabsStore(state => state.activeTabId);
  const setActiveTab = useTabsStore(state => state.setActiveTab);
  const openTab = useTabsStore(state => state.openTab);
  const closeTabStore = useTabsStore(state => state.closeTab);
  const closeTabsById = useTabsStore(state => state.closeTabsById);
  const markDirty = useTabsStore(state => state.markDirty);
  const updateTabContent = useTabsStore(state => state.updateTabContent);
  const renameTab = useTabsStore(state => state.renameTab);
  const editorRef = useRef<any>(null);
  const [outlineSource, setOutlineSource] = useState<string>("");
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(false);

  // --- LSP State ---
  const lspClientRef = useRef<TexlabLspClient | null>(null);

  // --- Compilation State ---
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [showLogPanel, setShowLogPanel] = useState(false);

  // --- Word Count State ---
  const [showWordCount, setShowWordCount] = useState(false);
  const [wordCountResult, setWordCountResult] = useState<string>("");

  // --- File System & DB State ---
  const [projectData, setProjectData] = useState<FileSystemNode[]>([]);
  // @ts-ignore
  const [projectRoots, setProjectRoots] = useState<string[]>([]);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [dbTables, setDbTables] = useState<string[]>([]);

  // --- Recent Projects State ---
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  // --- PDF State ---
  const [showPdf, setShowPdf] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfRefreshTrigger, setPdfRefreshTrigger] = useState(0);
  // @ts-ignore - syncTexCoords may be used for SyncTeX in future
  const [_syncTexCoords, setSyncTexCoords] = useState<{page: number, x: number, y: number} | null>(null);

  // --- Database Panel State ---
  const [showDatabasePanel, setShowDatabasePanel] = useState(true);

  // --- Derived State (from Zustand selectors) ---
  const activeTab = useActiveTab();
  const isTexFile = useIsTexFile();
  

  const isWizardActive = useMemo(() => activeView.startsWith('wizard-') || activeView === 'gallery', [activeView]);
  const showRightPanel = useMemo(() => isWizardActive || (activeView === 'editor' && showPdf && isTexFile), [isWizardActive, activeView, showPdf, isTexFile]);

  // --- Sync projectData to projectStore for DatabaseSidebar ---
  const setProjectDataToStore = useProjectStore(state => state.setProjectData);
  useEffect(() => {
      setProjectDataToStore(projectData);
  }, [projectData, setProjectDataToStore]);

  // --- Handlers ---
  // --- Load Recent Projects on Mount ---
  useEffect(() => {
      const saved = localStorage.getItem('recentProjects');
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              setRecentProjects(parsed);
          } catch (e) { console.error("Failed to parse recent projects", e); }
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
                  console.log('LSP client initialized for:', rootPath);
              } catch (error) {
                  console.error('Failed to initialize LSP:', error);
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

  const addToRecent = useCallback((path: string) => {
      setRecentProjects(prev => {
          const newRecent = [path, ...prev.filter(p => p !== path)].slice(0, 10);
          localStorage.setItem('recentProjects', JSON.stringify(newRecent));
          return newRecent;
      });
  }, []);

  const handleToggleSidebar = useCallback((section: SidebarSection) => {
    if (section === 'settings') {
      setActiveActivity('settings');
      setActiveView('settings');
      setIsSidebarOpen(false); 
    } else {
      if (section === 'database') {
          setActiveView('database');
      } else {
          setActiveView((currentView) => currentView === 'settings' || currentView === 'database' ? 'editor' : currentView);
      }

      setActiveActivity((currentActivity) => {
        setIsSidebarOpen((isOpen) => {
            if (currentActivity === section) return !isOpen;
            return true;
        });
        return section;
      });
    }
  }, []);

  // --- HELPER: Load Project Files ---
  const loadFolderNode = async (rootPath: string): Promise<FileSystemNode> => {
      // @ts-ignore
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const ignoredExtensions = ['aux', 'log', 'out', 'toc', 'synctex.gz', 'fdb_latexmk', 'fls', 'bbl', 'blg', 'xdv', 'lof', 'lot', 'nav', 'snm', 'vrb'];

      const processDir = async (dirPath: string): Promise<FileSystemNode[]> => {
          const entries = await readDir(dirPath);
          const nodes: FileSystemNode[] = [];
          for (const entry of entries) {
              const name = entry.name;
              if (name.startsWith('.')) continue; 
              if (name === 'node_modules' || name === '.git') continue;
              
              const separator = dirPath.endsWith('/') || dirPath.endsWith('\\') ? '' : (dirPath.includes('\\') ? '\\' : '/');
              const fullPath = `${dirPath}${separator}${name}`;
              
              if (entry.isDirectory) {
                  const children = await processDir(fullPath);
                  nodes.push({ id: fullPath, name: name, type: 'folder', path: fullPath, children: children });
              } else {
                  const ext = name.split('.').pop()?.toLowerCase();
                  if (ext && ignoredExtensions.includes(ext)) continue;
                  nodes.push({ id: fullPath, name: name, type: 'file', path: fullPath, children: [] });
              }
          }
          return nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
      };

      const children = await processDir(rootPath);
      const separator = rootPath.includes('\\') ? '\\' : '/';
      const cleanPath = rootPath.endsWith(separator) ? rootPath.slice(0, -1) : rootPath;
      const folderName = cleanPath.split(separator).pop() || rootPath;

      return {
          id: rootPath,
          name: folderName.toUpperCase(),
          type: 'folder',
          path: rootPath,
          children: children
      };
  };

  const reloadProjectFiles = async (roots: string[]) => {
      if (roots.length === 0) {
          setProjectData([]);
          return;
      }
      setLoadingFiles(true);
      try {
          const promises = roots.map(root => loadFolderNode(root));
          const rootNodes = await Promise.all(promises);
          setProjectData(rootNodes);
      } catch (e) {
          console.error("Failed to load project database", e);
      } finally {
          setLoadingFiles(false);
      }
  };

  // @ts-ignore
  const loadProjectFiles = useCallback(async (path: string) => {
      await reloadProjectFiles([path]);
  }, []);

  // --- CORE: Create Tab Logic ---
  const debouncedOutlineUpdate = useCallback(
      debounce((content: string) => {
          setOutlineSource(content);
      }, 1000),
      []
  );

  const handleTabChange = useCallback((newId: string) => {
    // Sync content from Monaco before switching
    const currentId = activeTabId;
    if (currentId && editorRef.current) {
        try {
           const currentContent = editorRef.current.getValue();
           updateTabContent(currentId, currentContent);
        } catch(e) { /* ignore */ }
    }
    
    setActiveTab(newId);
    
    // Update outline source for new tab
    const newTab = tabs.find(t => t.id === newId);
    if (newTab && newTab.content) {
        setOutlineSource(newTab.content);
    }
  }, [activeTabId, tabs, updateTabContent, setActiveTab]);

  const createTabWithContent = useCallback(async (code: string, defaultTitle: string = 'Untitled.tex') => {
    try {
        let filePath: string | null = null;
        try {
            // @ts-ignore
            const { save } = await import('@tauri-apps/plugin-dialog');
            filePath = await save({
                defaultPath: defaultTitle,
                filters: [{ name: 'LaTeX Document', extensions: ['tex'] }]
            });
        } catch (e) {
            console.warn("Tauri dialog failed, using fallback:", e);
            filePath = '/mock/' + defaultTitle;
        }

        if (!filePath) return; 

        try {
            // @ts-ignore
            const { writeTextFile } = await import('@tauri-apps/plugin-fs');
            await writeTextFile(filePath, code);
        } catch(e) {
             console.warn("Tauri write failed, continuing in memory:", e);
        }

        const normalizedPath = filePath.replace(/\\/g, '/');
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        const parentDir = normalizedPath.substring(0, lastSlashIndex);
        const fileName = normalizedPath.substring(lastSlashIndex + 1);

        if (parentDir && parentDir !== '/mock') {
            setRootPath(parentDir);
            try {
                // We use reloadProjectFiles directly here or wrap it if needed.
                // loadProjectFiles is async, so we just call it.
                reloadProjectFiles([parentDir]);
            } catch(e) {}
            setActiveActivity("database");
            setIsSidebarOpen(true);
            addToRecent(parentDir);
        }

        // Open the new tab
        openTab({
            id: filePath!,
            title: fileName,
            type: 'editor',
            content: code,
            language: 'latex',
            isDirty: false
        });
        setActiveView("editor");

    } catch (e) {
        console.error("Failed to create file:", e);
        setCompileError("Failed to create file: " + String(e));
    }
  }, [handleTabChange]);

  const handleCreateEmpty = useCallback(() => {
    createTabWithContent('', 'Untitled.tex');
  }, [createTabWithContent]);

  const handleRequestNewFile = useCallback(() => {
    const existing = tabs.find(t => t.type === 'start-page');
    if (existing) {
        setActiveTab(existing.id);
    } else {
        openTab({ id: `start-${Date.now()}`, title: 'Start Page', type: 'start-page' });
    }
  }, [tabs, setActiveTab, openTab]);

  const handleCreateFromTemplate = useCallback((code: string) => createTabWithContent(code, 'Untitled.tex'), [createTabWithContent]);
  const handleOpenPreambleWizard = useCallback(() => setActiveView('wizard-preamble'), []);

  const handleOpenFolder = useCallback(async () => {
    try {
      // @ts-ignore
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedPath = await open({ directory: true, multiple: false, title: "Select Project Folder" });
      
      if (selectedPath && typeof selectedPath === 'string') {
        setRootPath(selectedPath);
        const newRoots = [selectedPath];
        setProjectRoots(newRoots);
        await reloadProjectFiles(newRoots);
        setActiveActivity("database");
        addToRecent(selectedPath);
      }
    } catch (e) {
      setCompileError("Failed to open folder: " + String(e));
    }
  }, [addToRecent]);

  const handleAddFolder = useCallback(async () => {
    try {
      // @ts-ignore
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedPath = await open({ directory: true, multiple: false, title: "Add Folder to Workspace" });

      if (selectedPath && typeof selectedPath === 'string') {
        setProjectRoots(prev => {
            if (prev.includes(selectedPath)) return prev;
            const newRoots = [...prev, selectedPath];
            reloadProjectFiles(newRoots);
            return newRoots;
        });
        setActiveActivity("database");
      }
    } catch (e) {
        setCompileError("Failed to add folder: " + String(e));
    }
  }, []);

  const handleRemoveFolder = useCallback(async (folderPath: string) => {
      setProjectRoots(prev => {
          const newRoots = prev.filter(r => r !== folderPath);
          reloadProjectFiles(newRoots);
          return newRoots;
      });
      if (rootPath === folderPath) setRootPath(null); // Simplified
  }, [rootPath]);

  const handleOpenRecent = useCallback(async (path: string) => {
      try {
          setRootPath(path);
          const newRoots = [path];
          setProjectRoots(newRoots);
          await reloadProjectFiles(newRoots);
          setActiveActivity("database");
          addToRecent(path);
      } catch (e) {
          setCompileError("Failed to open recent project: " + String(e));
      }
  }, [addToRecent]);
  
  const handleCreateItem = useCallback(async (name: string, type: 'file' | 'folder', parentPath: string) => {
      try {
          const basePath = parentPath === 'root' ? rootPath : parentPath;
          if (!basePath) { console.error("No project root defined"); return; }
          const separator = basePath.includes('\\') ? '\\' : '/';
          const fullPath = `${basePath}${separator}${name}`; 
          // @ts-ignore
          const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs');
          if (type === 'file') {
              await writeTextFile(fullPath, ''); 
              openTab({ id: fullPath, title: name, type: 'editor', content: '', language: 'latex' });
          } else { await mkdir(fullPath); }
          
          setProjectRoots(currentRoots => {
               reloadProjectFiles(currentRoots);
               return currentRoots;
          });
      } catch (e) { setCompileError(`Failed to create ${type}: ${String(e)}`); }
  }, [rootPath, handleTabChange]);

  const handleRenameItem = useCallback(async (node: FileSystemNode, newName: string) => {
      try {
          // @ts-ignore
          const { rename: renameFs } = await import('@tauri-apps/plugin-fs');

          const lastSlashIndex = node.path.lastIndexOf(node.path.includes('\\') ? '\\' : '/');
          const parentDir = node.path.substring(0, lastSlashIndex);
          const separator = node.path.includes('\\') ? '\\' : '/';
          const newPath = `${parentDir}${separator}${newName}`;

          await renameFs(node.path, newPath);

          if (node.type === 'file') {
             renameTab(node.path, newPath, newName);
          }

          setProjectRoots(currentRoots => {
               reloadProjectFiles(currentRoots);
               return currentRoots;
          });
      } catch (e) {
          setCompileError(`Failed to rename: ${String(e)}`);
      }
  }, [renameTab]);

  const handleCloseTab = useCallback(async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const tab = tabs.find(t => t.id === id);
    if (tab && tab.isDirty) {
        // @ts-ignore
        const { confirm } = await import('@tauri-apps/plugin-dialog');
        const confirmed = await confirm(
            `You have unsaved changes in '${tab.title}'.\nAre you sure you want to close it?`,
            { title: 'Unsaved Changes', kind: 'warning', okLabel: 'Close', cancelLabel: 'Cancel' }
        );
        if (!confirmed) return;
    }

    // Use store's closeTab - it handles everything
    const closed = closeTabStore(id);
    if (!closed) {
        // Tab had unsaved changes but user cancelled - shouldn't happen here since we already confirmed
    }
  }, [tabs, closeTabStore]);

  const handleDeleteItem = useCallback(async (node: FileSystemNode) => {
      try {
          // @ts-ignore
          const { remove, exists } = await import('@tauri-apps/plugin-fs');
          // @ts-ignore
          const { confirm } = await import('@tauri-apps/plugin-dialog');

          const confirmed = await confirm(`Are you sure you want to delete '${node.name}'?`, { title: 'Delete Item', kind: 'warning' });
          if (!confirmed) return;

          await remove(node.path, { recursive: node.type === 'folder' });

          if (node.type === 'file') {
              handleCloseTab(node.path, { stopPropagation: () => {} } as React.MouseEvent);
          }

          setProjectRoots(currentRoots => {
               reloadProjectFiles(currentRoots);
               return currentRoots;
          });
      } catch (e) {
          setCompileError(`Failed to delete: ${String(e)}`);
      }
  }, [handleCloseTab]);

  const handleMoveItem = useCallback(async (sourcePath: string, targetPath: string) => {
      try {
          // @ts-ignore
          const { rename: renameFs } = await import('@tauri-apps/plugin-fs');

          const sourceName = sourcePath.split(/[/\\]/).pop();
          if (!sourceName) return;

          const separator = targetPath.includes('\\') ? '\\' : '/';
          const newPath = `${targetPath}${separator}${sourceName}`;

          if (sourcePath === newPath) return;

          await renameFs(sourcePath, newPath);

          // Update tabs if open
          if (tabs.some(t => t.id === sourcePath)) {
              renameTab(sourcePath, newPath, sourceName);
          }

          setProjectRoots(currentRoots => {
               reloadProjectFiles(currentRoots);
               return currentRoots;
          });

      } catch (e) {
          setCompileError(`Failed to move item: ${String(e)}`);
      }
  }, [tabs, renameTab]);

  const handleOpenFileNode = useCallback(async (node: FileSystemNode) => {
    if (node.type === 'folder') return;

    // Check if already open
    if (tabs.some(t => t.id === node.path)) {
        setActiveTab(node.path);
        return;
    }

    let content = "";
    try {
        // @ts-ignore
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        content = await readTextFile(node.path);
    } catch (e) { content = `Error reading file: ${String(e)}`; }

    openTab({ id: node.path, title: node.name, type: 'editor', content, language: 'latex' });
  }, [tabs, setActiveTab, openTab]);

  const handleCloseTabs = useCallback((ids: string[]) => {
      closeTabsById(ids);
  }, [closeTabsById]);

  const handleEditorChange = useCallback((id: string, val: string) => {
    // Only update isDirty flag to avoid heavy re-renders
    const tab = tabs.find(t => t.id === id);
    if (tab && !tab.isDirty) {
        markDirty(id, true);
    }

    if (activeActivity === 'outline') {
        debouncedOutlineUpdate(val);
    }
  }, [tabs, markDirty, activeActivity, debouncedOutlineUpdate]);

  // --- FIX: Update structure on view change ---
  useEffect(() => {
      if (activeActivity === 'outline') {
          const tab = tabs.find(t => t.id === activeTabId);
          if (tab && tab.content) {
              setOutlineSource(tab.content);
          } else {
            // Also try to get from editor ref if content is stale in store
            if (editorRef.current) {
                try {
                    setOutlineSource(editorRef.current.getValue());
                } catch(e) {/* ignore */}
            }
          }
      }
  }, [activeActivity, activeTabId, tabs]);

  // Throttled cursor position update
  const handleCursorChange = useCallback(
    throttle((line: number, column: number) => {
        setCursorPosition(prev => {
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
        const op = { range: sel || {startLineNumber:1,startColumn:1,endLineNumber:1,endColumn:1}, text: code, forceMoveMarkers: true };
        editorRef.current.executeEdits("wizard", [op]);
        editorRef.current.focus();
    }
  }, []); 

  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    if (!monaco.languages.getLanguages().some((l: any) => l.id === "my-latex")) {
      monaco.languages.register({ id: "my-latex" });
      monaco.languages.setMonarchTokensProvider("my-latex", latexLanguage);
      monaco.languages.setLanguageConfiguration("my-latex", latexConfiguration);

      setupLatexProviders(monaco);

      monaco.editor.defineTheme("data-tex-dark", dataTexDarkTheme);
      monaco.editor.defineTheme("data-tex-light", dataTexLightTheme);
      monaco.editor.defineTheme("data-tex-hc", dataTexHCTheme);
    }
    // settings is a dependency here
    monaco.editor.setTheme(settings.editor.theme);
  }, [settings.editor.theme]);

  // --- PDF Logic ---
  useEffect(() => {
    console.log('[App.tsx PDF Logic] activeTab:', activeTab?.id, 'type:', activeTab?.type, 'title:', activeTab?.title);
    let activeBlobUrl: string | null = null;
    const loadPdf = async () => {
      if (activeTab && activeTab.type === 'editor' && activeTab.id) {
         const isRealFile = activeTab.id.includes('/') || activeTab.id.includes('\\');
         const isTex = activeTab.title.toLowerCase().endsWith('.tex');

         if (isRealFile && isTex) {
            try {
              // @ts-ignore
              const { exists, readFile } = await import('@tauri-apps/plugin-fs');
              const pdfPath = activeTab.id.replace(/\.tex$/i, '.pdf');
              const doesExist = await exists(pdfPath);

              if (doesExist) {
                const fileContents = await readFile(pdfPath);
                const blob = new Blob([fileContents], { type: 'application/pdf' });
                activeBlobUrl = URL.createObjectURL(blob);
                console.log('[App.tsx PDF Logic] Setting pdfUrl to:', activeBlobUrl);
                setPdfUrl(activeBlobUrl);
              } else {
                console.log('[App.tsx PDF Logic] PDF does not exist at:', pdfPath);
                setPdfUrl(null);
              }
            } catch (e) {
              console.warn("PDF check failed", e);
              setPdfUrl(null);
            }
         } else {
            console.log('[App.tsx PDF Logic] Not a real file or not .tex');
            setPdfUrl(null);
         }
      } else {
        console.log('[App.tsx PDF Logic] No active tab or not editor type');
        setPdfUrl(null);
      }
    };
    loadPdf();
    return () => { if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl); };
  }, [activeTab?.id, activeTab?.title, activeTab?.type, pdfRefreshTrigger]);

  const handleTogglePdf = useCallback(() => {
      setShowPdf(prev => !prev);
  }, []);

  const handleCloseLogPanel = useCallback(() => {
      setShowLogPanel(false);
  }, []);

  // --- SyncTeX Logic ---

  // Editor -> PDF (Forward)
  const handleSyncTexForward = useCallback(async (line: number, column: number) => {
     if (!activeTab || !activeTab.id || !isTexFile) return;

     try {
         const texPath = activeTab.id;
         const pdfPath = texPath.replace(/\.tex$/i, '.pdf');
         const lastSlash = texPath.lastIndexOf(texPath.includes('\\') ? '\\' : '/');
         const cwd = texPath.substring(0, lastSlash);
         
         // Check if PDF file actually exists on disk
         // @ts-ignore
         const { exists } = await import('@tauri-apps/plugin-fs');
         const pdfExists = await exists(pdfPath);
         
         if (!pdfExists) {
             setCompileError("PDF not available. Please compile your document first.");
             return;
         }

         const args = [
             "view",
             "-i", `${line}:${column}:${texPath}`,
             "-o", pdfPath
         ];

         const result = await invoke<string>('run_synctex_command', { args, cwd });
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
             setCompileError("SyncTeX forward sync failed. Make sure you compiled with -synctex=1 flag.");
         }

     } catch (e) {
         console.error("SyncTeX Forward Failed:", e);
         const errorMsg = String(e);
         if (errorMsg.includes('synctex.gz')) {
             setCompileError("SyncTeX file not found. Please recompile your document with SyncTeX enabled.");
         } else {
             setCompileError("SyncTeX forward search failed: " + errorMsg);
         }
     }
  }, [activeTab, isTexFile]);

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
          const lastSlash = texPath.lastIndexOf(texPath.includes('\\') ? '\\' : '/');
          const cwd = texPath.substring(0, lastSlash);

          const args = ["-brief", "-total", texPath];

          const result = await invoke<string>('run_texcount_command', { args, cwd });
          setWordCountResult(result);
          setShowWordCount(true);
      } catch (e) {
          console.error("TexCount Failed:", e);
          setCompileError("Word count failed: " + String(e));
      }
  }, [activeTab, isTexFile]);

  // --- Helper: Save File ---
  const handleSave = useCallback(async (tabId?: string) => {
    const targetId = tabId || activeTabId;
    const tab = tabs.find(t => t.id === targetId);

    if (!tab || !tab.id) return;

    // Use current content from ref if it's the active tab, otherwise use stored content
    let contentToSave = tab.content || "";
    if (tab.id === activeTabId && editorRef.current) {
        contentToSave = editorRef.current.getValue();
    }

    try {
        // @ts-ignore
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        await writeTextFile(tab.id, contentToSave);
        
        // Update tab dirty state and content
        markDirty(targetId, false);
        updateTabContent(targetId, contentToSave);
        
    } catch (e) {
        console.error("Failed to save file:", e);
        setCompileError("Failed to save file: " + String(e));
    }
  }, [tabs, activeTabId, markDirty, updateTabContent]);

  // --- Compilation ---
  const handleCompile = useCallback(async (engine?: string) => {
    if (!activeTab || !activeTab.id || !isTexFile) {
        console.warn("[COMPILER DEBUG] Compile aborted: No active tab or not a tex file.");
        return;
    }

    // Save before compiling
    await handleSave(activeTab.id);

    const filePath = activeTab.id;
    console.log(`[COMPILER DEBUG] Starting compilation for: ${filePath} with engine: ${engine || 'default'}`);

    try {
        setIsCompiling(true);
        setCompileError(null);
        
        let selectedEngine = engine || 'pdflatex';
        let args = ['-interaction=nonstopmode', '-synctex=1'];
        const outputDir = ''; 

        // If no engine explicitly passed, check config
        if (!engine) {
            const savedConfig = localStorage.getItem('tex-engine-config');
            if (savedConfig) {
                try {
                    const config = JSON.parse(savedConfig);
                    const engineKey = config.defaultEngine || 'pdflatex';
                    if (engineKey === 'xelatex') selectedEngine = config.xelatexPath || 'xelatex';
                    else if (engineKey === 'lualatex') selectedEngine = config.lualatexPath || 'lualatex';
                    else selectedEngine = config.pdflatexPath || 'pdflatex';

                    args = ['-interaction=nonstopmode'];
                    if (config.synctex) args.push('-synctex=1');
                    if (config.shellEscape) args.push('-shell-escape');
                } catch (e) {
                    console.warn("[COMPILER DEBUG] Failed to parse config, using defaults", e);
                }
            }
        }

        // --- DYNAMIC COMPILATION CHECK ---
        const allResources = useDatabaseStore.getState().allLoadedResources;
        // Normalize paths for comparison if needed (though usually identical)
        const resource = allResources.find(r => r.path === filePath);

        if (resource && resource.metadata && resource.metadata.preamble) {
             console.log(`[COMPILER DEBUG] Modular resource detected (Preamble: ${resource.metadata.preamble}). Using compile_resource_cmd.`);
             // Use the specific command that handles wrapping
             // We can ignore the returned path since we forced it to be standard filename.pdf
             await invoke('compile_resource_cmd', { id: resource.id });
        } else {
             // Standard Compilation
             await invoke('compile_tex', { filePath, engine: selectedEngine, args, outputDir });
        }

        setPdfRefreshTrigger(prev => prev + 1);

    } catch (error: any) {
        console.error("[COMPILER DEBUG] Compilation Failed (Rust Error):", error);
    } finally {
        try {
            // @ts-ignore
            const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
            const logPath = filePath.replace(/\.tex$/i, '.log');
            const doesLogExist = await exists(logPath);
            if (doesLogExist) {
                const logContent = await readTextFile(logPath);
                const entries = parseLatexLog(logContent);
                setLogEntries(entries);
                const hasErrors = entries.some(e => e.type === 'error');
                if (hasErrors) setShowLogPanel(true);
            }
        } catch(e) {
            console.error("[COMPILER DEBUG] Failed to read/parse log file:", e);
        }
        setIsCompiling(false);
    }
  }, [activeTab, isTexFile, handleSave]);

  const handleStopCompile = useCallback(() => {
      setIsCompiling(false);
      setCompileError("Compilation stopped by user (UI reset).");
  }, []);

  // --- Handlers (DB) ---
  const handleConnectDB = useCallback(() => {
    setDbConnected(prev => {
        if (prev) { setDbTables([]); return false; }
        else { setDbTables(['resources', 'documents', 'bibliography', 'dependencies', 'document_items']); return true; }
    });
  }, []);

  const handleOpenTable = useCallback((tableName: string) => {
    const tabId = `table-${tableName}`;
    openTab({ id: tabId, title: tableName, type: 'table', tableName: tableName });
  }, [openTab]);

  const handleOpenFileFromTable = useCallback((path: string) => {
      // Adapt path to FileSystemNode
      const node: FileSystemNode = {
          id: path,
          name: path.split(/[/\\]/).pop() || path,
          type: 'file',
          path: path,
          children: []
      };
      handleOpenFileNode(node);
  }, [handleOpenFileNode]);

  // --- Resize Logic ---
  // --- Resize Logic ---
  const startResizeSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop DndKit from capturing
    console.log('[Resize] Start Sidebar');
    setIsResizingSidebar(true);
    if (ghostRef.current) {
        ghostRef.current.style.display = 'block';
        ghostRef.current.style.left = `${e.clientX}px`;
    }
  }, []);

  const startResizeRightPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop DndKit from capturing
    console.log('[Resize] Start Right Panel');
    setIsResizingRightPanel(true);
    if (ghostRef.current) {
        ghostRef.current.style.display = 'block';
        ghostRef.current.style.left = `${e.clientX}px`;
    }
  }, []);

  const startResizeDatabase = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop DndKit from capturing
    console.log('[Resize] Start Database');
    setIsResizingDatabase(true);
    if (ghostRef.current) {
        ghostRef.current.style.display = 'block';
        ghostRef.current.style.left = `${e.clientX}px`;
    }
  }, []);
  
  // Sync state with CSS variables
  useEffect(() => {
     document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  }, [sidebarWidth]);

  useEffect(() => {
     document.documentElement.style.setProperty('--right-panel-width', `${rightPanelWidth}px`);
  }, [rightPanelWidth]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
       if (rafRef.current) return;
       rafRef.current = requestAnimationFrame(() => {
          if (isResizingSidebar) {
             const x = Math.max(200, Math.min(650, e.clientX));
             if (ghostRef.current) ghostRef.current.style.left = `${x}px`;
          }
          if (isResizingRightPanel) {
             const minX = window.innerWidth - 1200;
             const maxX = window.innerWidth - 300;
             const x = Math.max(minX, Math.min(maxX, e.clientX));
             if (ghostRef.current) ghostRef.current.style.left = `${x}px`;
          }
          if (isResizingDatabase) {
             const x = Math.max(250, Math.min(window.innerWidth * 0.6, e.clientX));
             if (ghostRef.current) ghostRef.current.style.left = `${x}px`;
          }
          rafRef.current = null;
       });
    };

    const up = () => {
        if (isResizingSidebar) {
            if (ghostRef.current) {
                const x = parseInt(ghostRef.current.style.left || '0', 10);
                if (x > 0) {
                    const w = Math.max(150, Math.min(600, x - 50));
                    setSidebarWidth(w);
                }
                ghostRef.current.style.display = 'none';
            }
        }
        if (isResizingRightPanel) {
            if (ghostRef.current) {
                const x = parseInt(ghostRef.current.style.left || '0', 10);
                if (x > 0) {
                    const newWidth = window.innerWidth - x;
                    const w = Math.max(300, Math.min(1200, newWidth));
                    setRightPanelWidth(w);
                }
                ghostRef.current.style.display = 'none';
            }
        }
        if (isResizingDatabase) {
            if (ghostRef.current) {
                const x = parseInt(ghostRef.current.style.left || '0', 10);
                if (x > 0) {
                    const w = Math.max(250, Math.min(window.innerWidth * 0.6, x - (isSidebarOpen ? sidebarWidth : 0) - 50));
                    setDatabasePanelWidth(w);
                }
                ghostRef.current.style.display = 'none';
            }
        }

        setIsResizingSidebar(false);
        setIsResizingRightPanel(false);
        setIsResizingDatabase(false);

        if(rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    };

    if(isResizingSidebar || isResizingRightPanel || isResizingDatabase) { 
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); document.body.style.cursor = 'col-resize'; 
    } else { document.body.style.cursor = 'default'; }
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isResizingSidebar, isResizingRightPanel, isResizingDatabase, isSidebarOpen, sidebarWidth]);

  // --- DND Logic ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 10,
        },
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {

          // Drop on Editor (Open File)
          if (over.id === 'editor-zone') {
               const activeNode = active.data.current?.node as FileSystemNode;
               if (activeNode && activeNode.type === 'file') {
                   handleOpenFileNode(activeNode);
               }
               return;
          }

          // Drop on Folder (Move File)
          const activeNode = active.data.current?.node as FileSystemNode;
          const overNode = over.data.current?.node as FileSystemNode;

          if (activeNode && overNode && overNode.type === 'folder') {
              handleMoveItem(activeNode.path, overNode.path);
          }
      }
  }, [handleOpenFileNode, handleMoveItem]);

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
        <AppShell.Header withBorder={false} style={{ zIndex: 200, backgroundColor: 'var(--app-header-bg)' }}>
            <HeaderContent 
                onNewFile={handleRequestNewFile} 
                onOpenFile={handleOpenFolder} 
                showDatabasePanel={showDatabasePanel}
                onToggleDatabasePanel={() => setShowDatabasePanel(!showDatabasePanel)}
                showSidebar={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />

        </AppShell.Header>

        {/* Global Resize Overlay & Ghost Line - Placed here to avoid container clipping */}
        {(isResizingSidebar || isResizingRightPanel || isResizingDatabase) && (
            <Box style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none' }} />
        )}

        <Box
            ref={ghostRef}
            style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                width: 4,
                backgroundColor: 'var(--mantine-primary-color-6)',
                zIndex: 10000,
                display: 'none',
                pointerEvents: 'none',
                cursor: 'col-resize'
            }}
        />

        {/* MAIN LAYOUT */}
        <AppShell.Main style={{ display: "flex", flexDirection: "column", height: "100vh", paddingTop: 35, paddingBottom: 24, overflow: "hidden", boxSizing: 'border-box', backgroundColor: 'var(--app-bg)' }}>



            {compileError && (
                <Box style={{position: 'absolute', top: 10, right: 10, zIndex: 1000, maxWidth: 400}}>
                    <Notification color="red" title="Error" onClose={() => setCompileError(null)} withBorder>
                        <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap' }}>{compileError}</pre>
                    </Notification>
                </Box>
            )}

            <Group gap={0} wrap="nowrap" h="100%" align="stretch" style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
                
                {/* 1. SIDEBAR */}
                <Sidebar 
                    width="var(--sidebar-width)"
                    isOpen={isSidebarOpen}
                    onResizeStart={startResizeSidebar}
                    activeSection={activeActivity} 
                    onToggleSection={handleToggleSidebar}
                    onNavigate={setActiveView}
                    openTabs={tabs} activeTabId={activeTabId} onTabSelect={handleTabChange}
                    projectData={projectData} onOpenFolder={handleOpenFolder} onOpenFileNode={handleOpenFileNode}
                    onAddFolder={handleAddFolder} onRemoveFolder={handleRemoveFolder}
                    loadingFiles={loadingFiles} dbConnected={dbConnected} dbTables={dbTables} onConnectDB={handleConnectDB} onOpenTable={handleOpenTable}
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
                <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
                    {/* Database Table - LEFT SIDE (only when toggled ON) */}
                    {showDatabasePanel && (
                        <>
                            <Box style={{ 
                                width: `${databasePanelWidth}px`,
                                minWidth: '250px',
                                maxWidth: '60%',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}>
                                <DatabaseView onOpenFile={handleOpenFileFromTable} />
                            </Box>
                            
                            {/* Resize handle between Database and Editor */}
                            <ResizerHandle onMouseDown={startResizeDatabase} isResizing={isResizingDatabase} />
                        </>
                    )}

                    {/* Editor/Settings - RIGHT SIDE (always visible) */}
                    <Box style={{ 
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        minHeight: 0
                    }}>
                        {activeView === 'settings' ? (
                            <SettingsPanel
                                settings={settings}
                                onUpdateEditor={updateEditorSetting}
                                onUpdateGeneral={updateGeneralSetting}
                                onUpdateUi={setUiTheme}
                            />
                        ) : (
                            <EditorArea
                                files={tabs} activeFileId={activeTabId}
                                onFileSelect={handleTabChange} onFileClose={handleCloseTab}
                                onCloseFiles={handleCloseTabs}
                                onContentChange={handleEditorChange} onMount={handleEditorDidMount}
                                showPdf={showPdf} onTogglePdf={handleTogglePdf}
                                isTexFile={isTexFile} onCompile={handleCompile} isCompiling={isCompiling}
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
                {(showRightPanel || showDatabasePanel) && (
                    <ResizerHandle onMouseDown={startResizeRightPanel} isResizing={isResizingRightPanel} />
                )}

                {/* Right Panel Content */}
                <Box 
                    w={(showRightPanel || showDatabasePanel) ? "var(--right-panel-width)" : 0} 
                    h="100%" 
                    style={{ 
                        flexShrink: 0, 
                        overflow: 'hidden', 
                        display: (showRightPanel || showDatabasePanel) ? 'flex' : 'none', 
                        flexDirection: 'column',
                        minWidth: 0, 
                        transition: isResizingRightPanel ? 'none' : "width 300ms ease-in-out, opacity 200ms ease-in-out",
                        opacity: (showRightPanel || showDatabasePanel) ? 1 : 0,
                        whiteSpace: "nowrap",
                        backgroundColor: 'var(--app-panel-bg)',
                        borderLeft: '1px solid var(--mantine-color-default-border)'
                    }}
                >
                    {/* Right Panel Content: Wizard > Gallery > ResourceInspector (when resource selected) > PDF Preview (default) */}
                    {activeView.startsWith('wizard-') ? (
                        <WizardWrapper
                            title={activeView.replace('wizard-', '').toUpperCase()}
                            onClose={() => setActiveView('editor')}
                        >
                            {activeView === 'wizard-preamble' && <PreambleWizard onInsert={(code: string) => { handleInsertSnippet(code); setActiveView('editor'); }} />}
                            {activeView === 'wizard-table' && <TableWizard onInsert={(code: string) => { handleInsertSnippet(code); setActiveView('editor'); }} />}
                            {activeView === 'wizard-tikz' && <TikzWizard onInsert={(code: string) => { handleInsertSnippet(code); setActiveView('editor'); }} />}
                            {activeView === 'wizard-fancyhdr' && <FancyhdrWizard onInsert={(code: string) => { handleInsertSnippet(code); setActiveView('editor'); }} />}
                        </WizardWrapper>
                    ) : activeView === 'gallery' ? (
                        <PackageGallery 
                            selectedPkgId={activePackageId}
                            onInsert={(code: string) => { handleInsertSnippet(code); setActiveView('editor'); }} 
                            onClose={() => setActiveView('editor')}
                            onOpenWizard={setActiveView}
                        />
                    ) : (
                        /* ResourceInspector with 3 tabs: PDF, Metadata, Bibliography */
                        <ResourceInspector 
                            mainEditorPdfUrl={pdfUrl}
                        />
                    )}
                </Box>
            </Group>
        </AppShell.Main>

        {/* FOOTER */}
        <AppShell.Footer withBorder={false} p={0}>
            <StatusBar
                activeFile={tabs.find(f => f.id === activeTabId)}
                dbConnected={dbConnected}
                cursorPosition={cursorPosition}
                spellCheckEnabled={spellCheckEnabled}
                onToggleSpellCheck={() => setSpellCheckEnabled(!spellCheckEnabled)}
                onWordCount={handleWordCount}
            />
        </AppShell.Footer>

        <Modal opened={showWordCount} onClose={() => setShowWordCount(false)} title="Word Count Result">
            <Text style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{wordCountResult}</Text>
        </Modal>

      </AppShell>
      </DndContext>
    </MantineProvider>
  );
}