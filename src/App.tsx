import { useState, useRef, useEffect, useCallback } from "react";
import {
  AppShell,
  Box,
  Group,
  MantineProvider,
  Loader,
  Center,
  Notification,
  ActionIcon,
  Text,
  Stack
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { invoke } from "@tauri-apps/api/core"; 

// --- Custom Theme ---
import { mantineTheme } from "./themes/mantine-theme";

// --- Layout Components ---
import { HeaderContent } from "./components/layout/Header";
import { Sidebar, SidebarSection, ViewType, AppTab, FileSystemNode } from "./components/layout/Sidebar";
import { EditorArea } from "./components/layout/EditorArea";
import { PdfPreview } from "./components/layout/PdfPreview";
import { StatusBar } from "./components/layout/StatusBar";

// --- UI Components ---
import { ResizerHandle } from "./components/ui/ResizerHandle";

// --- Wizards ---
import { WizardWrapper } from "./components/wizards/WizardWrapper";
import { PreambleWizard } from "./components/wizards/PreambleWizard";
import { TableWizard } from "./components/wizards/TableWizard";
import { TikzWizard } from "./components/wizards/TikzWizard";
import { PackageGallery } from "./components/wizards/PackageGallery";
import { SettingsPanel } from "./components/settings/SettingsPanel";

import { latexLanguage, latexConfiguration } from "./languages/latex";
import { dataTexDarkTheme } from "./themes/monaco-theme";
import { dataTexLightTheme } from "./themes/monaco-light";
import { dataTexHCTheme } from "./themes/monaco-hc";
import { useSettings } from "./hooks/useSettings";

export default function App() {
  const { settings, updateEditorSetting, updateGeneralSetting, setUiTheme } = useSettings();

  // --- Layout State ---
  const [activeActivity, setActiveActivity] = useState<SidebarSection>("files");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [activeView, setActiveView] = useState<ViewType>("editor");
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [rightPanelWidth, setRightPanelWidth] = useState(600);
  const [activePackageId, setActivePackageId] = useState<string>('amsmath');
  
  // --- Resizing State ---
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const rafRef = useRef<number | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  // --- Editor State ---
  // Start with Start Page tab
  const [tabs, setTabs] = useState<AppTab[]>([
    { id: 'start-page', title: 'Start Page', type: 'start-page' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('start-page');
  const editorRef = useRef<any>(null);

  // --- Compilation State ---
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  // --- File System & DB State ---
  const [projectData, setProjectData] = useState<FileSystemNode[]>([]);
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

  // --- Derived State ---
  const activeTab = tabs.find(t => t.id === activeTabId);
  const isTexFile = activeTab?.title.toLowerCase().endsWith('.tex') ?? false;
  
  const isWizardActive = activeView.startsWith('wizard-') || activeView === 'gallery';
  const showRightPanel = isWizardActive || (activeView === 'editor' && showPdf && isTexFile);

  // --- Handlers ---
  // --- Load Recent Projects on Mount ---
  useEffect(() => {
      const saved = localStorage.getItem('recentProjects');
      if (saved) {
          try {
              setRecentProjects(JSON.parse(saved));
          } catch (e) { console.error("Failed to parse recent projects", e); }
      }
  }, []);

  const addToRecent = (path: string) => {
      const newRecent = [path, ...recentProjects.filter(p => p !== path)].slice(0, 10);
      setRecentProjects(newRecent);
      localStorage.setItem('recentProjects', JSON.stringify(newRecent));
  };

  const handleToggleSidebar = (section: SidebarSection) => {
    if (activeActivity === section) {
      setIsSidebarOpen(!isSidebarOpen); 
    } else {
      setActiveActivity(section);
      setIsSidebarOpen(true); 
    }
  };

  // --- HELPER: Load Project Files ---
  const loadProjectFiles = async (path: string) => {
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
      const nodes = await processDir(path);
      setProjectData(nodes);
  };

  // --- CORE: Create Tab Logic ---
  const createTabWithContent = async (code: string, defaultTitle: string = 'Untitled.tex') => {
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
                await loadProjectFiles(parentDir);
            } catch(e) {}
            setActiveActivity("files");
            setIsSidebarOpen(true);
        }

        if (!tabs.find(t => t.id === filePath)) {
            const newTab: AppTab = { 
                id: filePath, 
                title: fileName, 
                type: 'editor', 
                content: code, 
                language: 'latex', 
                isDirty: false 
            };
            setTabs(prev => [...prev, newTab]);
        }
        
        // Use smart tab switch
        handleTabChange(filePath);
        setActiveView("editor");

    } catch (e) {
        console.error("Failed to create file:", e);
        setCompileError("Failed to create file: " + String(e));
    }
  };

  const handleRequestNewFile = () => {
    const existing = tabs.find(t => t.type === 'start-page');
    if (existing) handleTabChange(existing.id);
    else {
        const id = `start-${Date.now()}`;
        setTabs(prev => [...prev, { id, title: 'Start Page', type: 'start-page' }]);
        handleTabChange(id);
    }
  };

  const handleCreateFromTemplate = (code: string) => createTabWithContent(code, 'Untitled.tex');
  const handleOpenPreambleWizard = () => setActiveView('wizard-preamble');

  const handleOpenFolder = async () => {
    try {
      setLoadingFiles(true);
      // @ts-ignore
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedPath = await open({ directory: true, multiple: false, title: "Select Project Folder" });
      
      if (selectedPath && typeof selectedPath === 'string') {
        setRootPath(selectedPath); 
        await loadProjectFiles(selectedPath);
        setActiveActivity("files");
        addToRecent(selectedPath);
      }
    } catch (e) {
      setCompileError("Failed to open folder: " + String(e));
    } finally { setLoadingFiles(false); }
  };

  const handleOpenRecent = async (path: string) => {
      try {
          setLoadingFiles(true);
          setRootPath(path);
          await loadProjectFiles(path);
          setActiveActivity("files");
          addToRecent(path);
      } catch (e) {
          setCompileError("Failed to open recent project: " + String(e));
      } finally { setLoadingFiles(false); }
  };
  
  const handleCreateItem = async (name: string, type: 'file' | 'folder', parentPath: string) => {
      try {
          const basePath = parentPath === 'root' ? rootPath : parentPath;
          if (!basePath) { console.error("No project root defined"); return; }
          const separator = basePath.includes('\\') ? '\\' : '/';
          const fullPath = `${basePath}${separator}${name}`; 
          // @ts-ignore
          const { writeTextFile, mkdir } = await import('@tauri-apps/plugin-fs');
          if (type === 'file') {
              await writeTextFile(fullPath, ''); 
              const newTab: AppTab = { id: fullPath, title: name, type: 'editor', content: '', language: 'latex' };
              setTabs(prev => [...prev, newTab]);
              handleTabChange(fullPath);
          } else { await mkdir(fullPath); }
          if (rootPath) await loadProjectFiles(rootPath);
      } catch (e) { setCompileError(`Failed to create ${type}: ${String(e)}`); }
  };

  const handleRenameItem = async (node: FileSystemNode, newName: string) => {
      try {
          // @ts-ignore
          const { rename } = await import('@tauri-apps/plugin-fs');

          const lastSlashIndex = node.path.lastIndexOf(node.path.includes('\\') ? '\\' : '/');
          const parentDir = node.path.substring(0, lastSlashIndex);
          const separator = node.path.includes('\\') ? '\\' : '/';
          const newPath = `${parentDir}${separator}${newName}`;

          await rename(node.path, newPath);

          if (node.type === 'file') {
             setTabs(prev => prev.map(t => t.id === node.path ? { ...t, id: newPath, title: newName } : t));
             if (activeTabId === node.path) setActiveTabId(newPath); // No need to sync here usually
          }

          if (rootPath) await loadProjectFiles(rootPath);
      } catch (e) {
          setCompileError(`Failed to rename: ${String(e)}`);
      }
  };

  const handleDeleteItem = async (node: FileSystemNode) => {
      try {
          // @ts-ignore
          const { remove, exists } = await import('@tauri-apps/plugin-fs');
          // @ts-ignore
          const { confirm } = await import('@tauri-apps/plugin-dialog');

          const confirmed = await confirm(`Are you sure you want to delete '${node.name}'?`, { title: 'Delete Item', kind: 'warning' });
          if (!confirmed) return;

          await remove(node.path, { recursive: node.type === 'folder' });

          if (node.type === 'file') {
              const isOpen = tabs.find(t => t.id === node.path);
              if (isOpen) handleCloseTab(node.path, { stopPropagation: () => {} } as React.MouseEvent);
          }

          if (rootPath) await loadProjectFiles(rootPath);
      } catch (e) {
          setCompileError(`Failed to delete: ${String(e)}`);
      }
  };

  const handleOpenFileNode = async (node: FileSystemNode) => {
    if (node.type === 'folder') return;
    if (tabs.find(t => t.id === node.path)) { handleTabChange(node.path); return; }
    let content = "";
    try {
        // @ts-ignore
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        content = await readTextFile(node.path);
    } catch (e) { content = `Error reading file: ${String(e)}`; }
    const newTab: AppTab = { id: node.path, title: node.name, type: 'editor', content: content, language: 'latex' };
    setTabs([...tabs, newTab]);
    handleTabChange(node.path);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
        if (newTabs.length > 0) setActiveTabId(newTabs[newTabs.length - 1].id); // Just switch, no sync needed for closed tab
        else handleRequestNewFile();
    }
  };

  // --- PERFORMANCE FIX: Decoupled State Updates ---
  
  // 1. Sync Content on Tab Switch
  const handleTabChange = (newId: string) => {
      // Save the content of the PREVIOUS active tab to state
      if (activeTabId && editorRef.current && activeTab?.type === 'editor') {
          try {
             const currentContent = editorRef.current.getValue();
             setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: currentContent } : t));
          } catch(e) { /* ignore if editor not ready */ }
      }
      setActiveTabId(newId);
  };

  // 2. Editor Change (Only Dirty Flag)
  const handleEditorChange = (id: string, _val: string) => {
    // OPTIMIZATION: Do NOT update the full content in state on every keystroke.
    // Only update the 'isDirty' flag if it wasn't dirty before.
    setTabs(prev => {
        const tab = prev.find(t => t.id === id);
        if (tab && !tab.isDirty) {
            return prev.map(t => t.id === id ? { ...t, isDirty: true } : t);
        }
        return prev; // Prevents re-render if already dirty
    });
  };

  const handleInsertSnippet = (code: string) => {
    if (!activeTab || activeTab.type !== 'editor') return;
    if (editorRef.current) {
        const sel = editorRef.current.getSelection();
        const op = { range: sel || {startLineNumber:1,startColumn:1,endLineNumber:1,endColumn:1}, text: code, forceMoveMarkers: true };
        editorRef.current.executeEdits("wizard", [op]);
        editorRef.current.focus();
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    if (!monaco.languages.getLanguages().some((l: any) => l.id === "my-latex")) {
      monaco.languages.register({ id: "my-latex" });
      monaco.languages.setMonarchTokensProvider("my-latex", latexLanguage);
      monaco.languages.setLanguageConfiguration("my-latex", latexConfiguration);

      monaco.editor.defineTheme("data-tex-dark", dataTexDarkTheme);
      monaco.editor.defineTheme("data-tex-light", dataTexLightTheme);
      monaco.editor.defineTheme("data-tex-hc", dataTexHCTheme);
    }
    monaco.editor.setTheme(settings.editor.theme);
  };

  // --- PDF Logic ---
  useEffect(() => {
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
                setPdfUrl(activeBlobUrl);
              } else {
                setPdfUrl(null);
              }
            } catch (e) {
              console.warn("PDF check failed", e);
              setPdfUrl(null);
            }
         } else {
            setPdfUrl(null);
         }
      } else {
        setPdfUrl(null);
      }
    };
    loadPdf();
    return () => { if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl); };
  }, [activeTab?.id, activeTab?.title, activeTab?.type, pdfRefreshTrigger]);

  // --- Compilation ---
  const handleCompile = async () => {
    if (!activeTab || !activeTab.id || !isTexFile) return;
    try {
        setIsCompiling(true);
        setCompileError(null);
        
        // 3. Get Content Directly from Editor for Compilation
        // (Since state might be stale due to optimization)
        let contentToSave = activeTab.content || "";
        if (editorRef.current) {
            // If the active tab is active in Monaco, getValue() returns the latest
            // Monaco handles model switching by path, but getting value from current model is safest for active tab
            contentToSave = editorRef.current.getValue();
        }

        // @ts-ignore
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        await writeTextFile(activeTab.id, contentToSave);
        
        await invoke('compile_tex', { filePath: activeTab.id });
        setPdfRefreshTrigger(prev => prev + 1);
    } catch (error: any) {
        console.error("Compilation Failed:", error);
        setCompileError(typeof error === 'string' ? error : "Unknown error occurred during compilation");
    } finally {
        setIsCompiling(false);
    }
  };

  const handleStopCompile = () => {
      setIsCompiling(false);
      setCompileError("Compilation stopped by user (UI reset).");
  };

  // --- Handlers (DB, Files) ---
  const handleConnectDB = () => {
    if (dbConnected) { setDbConnected(false); setDbTables([]); } 
    else { setDbConnected(true); setDbTables(['users', 'documents', 'bibliography', 'settings']); }
  };

  const handleOpenTable = (tableName: string) => {
    const tabId = `table-${tableName}`;
    if (!tabs.find(t => t.id === tabId)) {
        setTabs([...tabs, { id: tabId, title: tableName, type: 'table', tableName: tableName }]);
    }
    handleTabChange(tabId);
  };

  // --- Resize Logic ---
  const startResizeSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    if (ghostRef.current) {
        ghostRef.current.style.display = 'block';
        ghostRef.current.style.left = `${e.clientX}px`;
    }
  }, []);

  const startResizeRightPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRightPanel(true);
    if (ghostRef.current) {
        ghostRef.current.style.display = 'block';
        ghostRef.current.style.left = `${e.clientX}px`;
    }
  }, []);
  
  // Sync state with CSS variables on mount and when state changes (programmatically)
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

        setIsResizingSidebar(false);
        setIsResizingRightPanel(false);

        if(rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    };

    if(isResizingSidebar || isResizingRightPanel) { 
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); document.body.style.cursor = 'col-resize'; 
    } else { document.body.style.cursor = 'default'; }
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isResizingSidebar, isResizingRightPanel]);

  // --- RENDER ---
  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme={settings.uiTheme} forceColorScheme={settings.uiTheme === 'auto' ? undefined : settings.uiTheme}>
      <AppShell header={{ height: 35 }} footer={{ height: 24 }} padding={0}>
        
        {/* HEADER */}
        <AppShell.Header withBorder={false} bg="dark.9" style={{ zIndex: 200 }}>
            <HeaderContent onNewFile={handleRequestNewFile} onOpenFile={handleOpenFolder} />
        </AppShell.Header>

        {/* MAIN LAYOUT */}
        <AppShell.Main bg="dark.9" style={{ display: "flex", flexDirection: "column", height: "100vh", paddingTop: 35, paddingBottom: 24, overflow: "hidden", boxSizing: 'border-box' }}>
            
            {(isResizingSidebar || isResizingRightPanel) && (
                <Box style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none' }} />
            )}

            <Box
              ref={ghostRef}
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                width: 4,
                backgroundColor: 'var(--mantine-color-blue-6)',
                zIndex: 10000,
                display: 'none',
                pointerEvents: 'none',
                cursor: 'col-resize'
              }}
            />

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
                    loadingFiles={loadingFiles} dbConnected={dbConnected} dbTables={dbTables} onConnectDB={handleConnectDB} onOpenTable={handleOpenTable}
                    onCreateItem={handleCreateItem}
                    onRenameItem={handleRenameItem}
                    onDeleteItem={handleDeleteItem}
                    onInsertSymbol={handleInsertSnippet}
                    activePackageId={activePackageId}
                    onSelectPackage={setActivePackageId}
                />
                
                {/* 2. CENTER: EDITOR AREA or SETTINGS */}
                <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
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
                            onContentChange={handleEditorChange} onMount={handleEditorDidMount}
                            showPdf={showPdf} onTogglePdf={() => setShowPdf(!showPdf)}
                            isTexFile={isTexFile} onCompile={handleCompile} isCompiling={isCompiling}
                            onStopCompile={handleStopCompile}
                            onCreateEmpty={() => createTabWithContent('', 'Untitled.tex')}
                            onOpenWizard={handleOpenPreambleWizard}
                            onCreateFromTemplate={handleCreateFromTemplate}
                            recentProjects={recentProjects}
                            onOpenRecent={handleOpenRecent}
                            editorSettings={settings.editor}
                        />
                    )}
                </Box>

                {/* 3. RIGHT PANEL */}
                {showRightPanel && (
                    <>
                        <ResizerHandle onMouseDown={startResizeRightPanel} isResizing={isResizingRightPanel} />
                        <Box w="var(--right-panel-width)" h="100%" style={{ flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {isWizardActive ? (
                                <>
                                    {activeView === "wizard-preamble" && (
                                        <WizardWrapper title="Preamble Wizard" onClose={() => setActiveView("editor")}>
                                            <PreambleWizard onInsert={createTabWithContent} />
                                        </WizardWrapper>
                                    )}
                                    {activeView === "wizard-table" && (
                                        <WizardWrapper title="Table Wizard" onClose={() => setActiveView("editor")}>
                                            <TableWizard onInsert={handleInsertSnippet} />
                                        </WizardWrapper>
                                    )}
                                    {activeView === "wizard-tikz" && (
                                        <WizardWrapper title="TikZ Wizard" onClose={() => setActiveView("editor")}>
                                            <TikzWizard onInsert={handleInsertSnippet} />
                                        </WizardWrapper>
                                    )}
                                    {activeView === "gallery" && (
                                        <WizardWrapper title="Package Gallery" onClose={() => setActiveView("editor")}>
                                            <PackageGallery 
                                                selectedPkgId={activePackageId}
                                                onInsert={handleInsertSnippet} 
                                                onClose={() => setActiveView("editor")} 
                                                onOpenWizard={setActiveView}
                                            />
                                        </WizardWrapper>
                                    )}
                                </>
                            ) : (
                                <Box h="100%" bg="dark.6" style={{ display: "flex", flexDirection: "column" }}>
                                    <Group justify="space-between" px="xs" py={4} bg="dark.7" style={{ borderBottom: "1px solid var(--mantine-color-dark-5)", flexShrink: 0 }}>
                                        <Text size="xs" fw={700} c="dimmed">PDF PREVIEW</Text>
                                        <Group gap={4}>
                                            {isCompiling && <Loader size="xs" />}
                                            <ActionIcon size="xs" variant="transparent" onClick={() => setShowPdf(false)}><FontAwesomeIcon icon={faTimes} style={{ width: 12, height: 12 }} /></ActionIcon>
                                        </Group>
                                    </Group>
                                    <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }} bg="gray.7">
                                        {pdfUrl ? (
                                            <PdfPreview pdfUrl={pdfUrl} />
                                        ) : (
                                            <Center h="100%">
                                                {isCompiling ? 
                                                    <Stack align="center" gap="xs"><Loader type="bars" /><Text size="xs" c="dimmed">Compiling...</Text></Stack> :
                                                    <Text c="dimmed" size="sm">No PDF Loaded</Text>
                                                }
                                            </Center>
                                        )}
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </>
                )}
            </Group>
        </AppShell.Main>

        {/* FOOTER */}
        <AppShell.Footer withBorder={false} p={0}>
            <StatusBar activeFile={tabs.find(f => f.id === activeTabId)} dbConnected={dbConnected} />
        </AppShell.Footer>

      </AppShell>
    </MantineProvider>
  );
}