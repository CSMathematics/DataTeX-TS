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
import { invoke } from "@tauri-apps/api/core"; 

import { X } from "lucide-react";

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

// --- Language Config ---
import { latexLanguage, latexConfiguration } from "./languages/latex";
import { dataTexDarkTheme } from "./themes/monaco-theme";

// --- Constants ---
const INITIAL_CODE = `\\documentclass{article}
\\usepackage{amsmath}

\\begin{document}
  \\section{Hello DataTex}
  Start typing...
\\end{document}`;

export default function App() {
  // --- Layout State ---
  const [activeActivity, setActiveActivity] = useState<SidebarSection>("files");
  const [activeView, setActiveView] = useState<ViewType>("editor");
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [rightPanelWidth, setRightPanelWidth] = useState(600);
  
  // --- Resizing State ---
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const rafRef = useRef<number | null>(null);

  // --- Editor State ---
  const [tabs, setTabs] = useState<AppTab[]>([
    { id: 'start', title: 'Start.tex', type: 'editor', content: INITIAL_CODE, language: 'latex' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('start');
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

  // --- PDF State ---
  const [showPdf, setShowPdf] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfRefreshTrigger, setPdfRefreshTrigger] = useState(0);

  // --- Derived State ---
  const activeTab = tabs.find(t => t.id === activeTabId);
  const isTexFile = activeTab?.title.toLowerCase().endsWith('.tex') ?? false;
  
  const isWizardActive = activeView.startsWith('wizard-') || activeView === 'gallery';
  const showRightPanel = isWizardActive || (activeView === 'editor' && showPdf && isTexFile);

  // --- PDF Logic ---
useEffect(() => {
    let activeBlobUrl: string | null = null;
    
    const loadPdf = async () => {
      if (activeTab && activeTab.type === 'editor' && activeTab.id) {
         // Check if it looks like a file path (contains separator)
         const isRealFile = activeTab.id.includes('/') || activeTab.id.includes('\\');
         const isTex = activeTab.title.toLowerCase().endsWith('.tex');

         if (isRealFile && isTex) {
            try {
              // @ts-ignore
              const { exists, readFile } = await import('@tauri-apps/plugin-fs');
              
              const pdfPath = activeTab.id.replace(/\.tex$/i, '.pdf');
              const doesExist = await exists(pdfPath);

              if (doesExist) {
                // Read PDF as binary Uint8Array
                const fileContents = await readFile(pdfPath);
                // Create Blob from binary data
                const blob = new Blob([fileContents], { type: 'application/pdf' });
                activeBlobUrl = URL.createObjectURL(blob);
                setPdfUrl(activeBlobUrl);
              } else {
                setPdfUrl(null);
              }
            } catch (e) {
              console.warn("PDF load error:", e);
              // Don't setPdfUrl(null) here immediately if it's just a permission error on first load, 
              // but usually we should.
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

    return () => {
        if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
    };
  }, [activeTab?.id, activeTab?.title, activeTab?.type, pdfRefreshTrigger]);

  // --- HELPER: RECURSIVE READ DIRECTORY ---
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
                  nodes.push({
                      id: fullPath,
                      name: name,
                      type: 'folder',
                      path: fullPath,
                      children: children
                  });
              } else {
                  const ext = name.split('.').pop()?.toLowerCase();
                  if (ext && ignoredExtensions.includes(ext)) continue;
                  
                  nodes.push({
                      id: fullPath,
                      name: name,
                      type: 'file',
                      path: fullPath,
                      children: []
                  });
              }
          }
          return nodes.sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === 'folder' ? -1 : 1;
          });
      };

      const nodes = await processDir(path);
      setProjectData(nodes);
  };

  // --- HANDLERS ---

  const handleConnectDB = () => {
    if (dbConnected) { setDbConnected(false); setDbTables([]); } 
    else { setDbConnected(true); setDbTables(['users', 'documents', 'bibliography', 'settings']); }
  };

  const handleOpenTable = (tableName: string) => {
    const tabId = `table-${tableName}`;
    if (!tabs.find(t => t.id === tabId)) {
        setTabs([...tabs, { id: tabId, title: tableName, type: 'table', tableName: tableName }]);
    }
    setActiveTabId(tabId);
  };

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
      }
    } catch (e) {
      console.error("Tauri v2 API failed to open folder:", e);
      setCompileError("Failed to open folder: " + String(e));
    } finally { setLoadingFiles(false); }
  };

  // --- CREATE ITEM HANDLER ---
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
              setActiveTabId(fullPath);
          } else {
              await mkdir(fullPath);
          }

          if (rootPath) await loadProjectFiles(rootPath);

      } catch (e) {
          console.error("Failed to create item:", e);
          setCompileError(`Failed to create ${type}: ${String(e)}`);
      }
  };

  const handleOpenFileNode = async (node: FileSystemNode) => {
    if (node.type === 'folder') return;
    if (tabs.find(t => t.id === node.path)) { setActiveTabId(node.path); return; }
    
    let content = "";
    try {
        // @ts-ignore
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        content = await readTextFile(node.path);
    } catch (e) {
        console.error("Failed to read file:", e);
        content = `Error reading file: ${node.path}\n\n${String(e)}`;
    }

    const newTab: AppTab = { id: node.path, title: node.name, type: 'editor', content: content, language: 'latex' };
    setTabs([...tabs, newTab]);
    setActiveTabId(node.path);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id && newTabs.length > 0) setActiveTabId(newTabs[newTabs.length - 1].id);
  };

  const handleEditorChange = (id: string, val: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, content: val, isDirty: true } : t));
  };

  const handleCreateDocument = (code: string) => {
    const id = `doc-${Date.now()}`;
    setTabs([...tabs, { id, title: `Untitled.tex`, type: 'editor', content: code, language: 'latex', isDirty: true }]);
    setActiveTabId(id);
    setActiveView("editor");
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
    }
    monaco.editor.setTheme("data-tex-dark");
  };

  // --- Compilation Logic ---
  const handleCompile = async () => {
    if (!activeTab || !activeTab.id || !isTexFile) return;

    try {
        setIsCompiling(true);
        setCompileError(null);

        // Save File
        // @ts-ignore
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        await writeTextFile(activeTab.id, activeTab.content || "");

        // Call Rust Command
        console.log("Compiling:", activeTab.id);
        const result = await invoke('compile_tex', { filePath: activeTab.id });
        console.log("Compilation Result:", result);

        // Refresh PDF
        setPdfRefreshTrigger(prev => prev + 1);
        
    } catch (error: any) {
        console.error("Compilation Failed:", error);
        setCompileError(typeof error === 'string' ? error : "Unknown error occurred during compilation");
    } finally {
        setIsCompiling(false);
    }
  };

  // --- Resize Logic ---
  const startResizeSidebar = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsResizingSidebar(true); }, []);
  const startResizeRightPanel = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsResizingRightPanel(true); }, []);
  
  useEffect(() => {
    const move = (e: MouseEvent) => {
       if (rafRef.current) return;
       rafRef.current = requestAnimationFrame(() => {
          if (isResizingSidebar) setSidebarWidth(Math.max(150, Math.min(600, e.clientX - 50)));
          if (isResizingRightPanel) {
             const newWidth = window.innerWidth - e.clientX;
             setRightPanelWidth(Math.max(300, Math.min(1200, newWidth)));
          }
          rafRef.current = null;
       });
    };
    const up = () => { setIsResizingSidebar(false); setIsResizingRightPanel(false); if(rafRef.current) cancelAnimationFrame(rafRef.current); };
    
    if(isResizingSidebar || isResizingRightPanel) { 
        window.addEventListener('mousemove', move); 
        window.addEventListener('mouseup', up); 
        document.body.style.cursor = 'col-resize'; 
    } else { 
        document.body.style.cursor = 'default'; 
    }
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isResizingSidebar, isResizingRightPanel]);

  return (
    <MantineProvider theme={mantineTheme} defaultColorScheme="dark">
      <AppShell header={{ height: 35 }} footer={{ height: 24 }} padding={0}>
        
        <AppShell.Header withBorder={false} bg="dark.9" style={{ zIndex: 200 }}>
            <HeaderContent 
                onNewFile={() => handleCreateDocument('')}
                onOpenFile={handleOpenFolder}
            />
        </AppShell.Header>

        <AppShell.Main bg="dark.9" style={{ display: "flex", flexDirection: "column", height: "100vh", paddingTop: 35, paddingBottom: 24, overflow: "hidden" }}>
          {(isResizingSidebar || isResizingRightPanel) && (
            <Box style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none' }} />
          )}
          
          <Group gap={0} wrap="nowrap" h="100%" align="stretch" style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            
            {/* LEFT: SIDEBAR */}
            <Sidebar 
                width={sidebarWidth}
                onResizeStart={startResizeSidebar}
                activeSection={activeActivity}
                setActiveSection={setActiveActivity}
                onNavigate={setActiveView}
                openTabs={tabs}
                activeTabId={activeTabId}
                onTabSelect={setActiveTabId}
                projectData={projectData}
                onOpenFolder={handleOpenFolder}
                onOpenFileNode={handleOpenFileNode}
                loadingFiles={loadingFiles}
                dbConnected={dbConnected}
                dbTables={dbTables}
                onConnectDB={handleConnectDB}
                onOpenTable={handleOpenTable}
                onCreateItem={handleCreateItem}
            />
            
            {/* CENTER: EDITOR AREA */}
            <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
                {/* Error Notification Overlay */}
                {compileError && (
                    <Box style={{position: 'absolute', top: 10, right: 10, zIndex: 1000, maxWidth: 400}}>
                        <Notification color="red" title="Compilation Failed" onClose={() => setCompileError(null)} withBorder>
                            <Box style={{ maxHeight: 200, overflow: 'auto' }}>
                                <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap' }}>{compileError}</pre>
                            </Box>
                        </Notification>
                    </Box>
                )}

                <EditorArea 
                    files={tabs} 
                    activeFileId={activeTabId} 
                    onFileSelect={setActiveTabId} 
                    onFileClose={handleCloseTab} 
                    onContentChange={handleEditorChange} 
                    onMount={handleEditorDidMount} 
                    showPdf={showPdf}
                    onTogglePdf={() => setShowPdf(!showPdf)}
                    isTexFile={isTexFile}
                    onCompile={handleCompile}
                    isCompiling={isCompiling}
                />
            </Box>

            {/* RIGHT PANEL (WIZARDS or PDF) */}
            {showRightPanel && (
                <>
                  <ResizerHandle onMouseDown={startResizeRightPanel} isResizing={isResizingRightPanel} />
                  <Box w={rightPanelWidth} h="100%" style={{ flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {isWizardActive ? (
                        <>
                            {activeView === "wizard-preamble" && (
                                <WizardWrapper title="Preamble Wizard" onClose={() => setActiveView("editor")}>
                                    <PreambleWizard onInsert={handleCreateDocument} />
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
                                        onInsert={handleInsertSnippet} 
                                        onClose={() => setActiveView("editor")} 
                                        onOpenWizard={setActiveView}
                                    />
                                </WizardWrapper>
                            )}
                        </>
                    ) : (
                        <Box h="100%" bg="dark.6" style={{ borderLeft: "1px solid var(--mantine-color-dark-5)", display: "flex", flexDirection: "column" }}>
                            <Group justify="space-between" px="xs" py={4} bg="dark.7" style={{ borderBottom: "1px solid var(--mantine-color-dark-5)", flexShrink: 0 }}>
                                <Text size="xs" fw={700} c="dimmed">PDF PREVIEW</Text>
                                <Group gap={4}>
                                    {isCompiling && <Loader size="xs" />}
                                    <ActionIcon size="xs" variant="transparent" onClick={() => setShowPdf(false)}><X size={12} /></ActionIcon>
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

        <AppShell.Footer withBorder={false} p={0}>
            <StatusBar activeFile={tabs.find(f => f.id === activeTabId)} dbConnected={dbConnected} />
        </AppShell.Footer>

      </AppShell>
    </MantineProvider>
  );
}