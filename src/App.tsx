import React, { useState, useRef, useEffect, useCallback } from "react";
import { debounce } from "lodash";
import {
  AppShell,
  Group,
  Stack,
  Text,
  ActionIcon,
  Tooltip,
  Button,
  ScrollArea,
  TextInput,
  MantineProvider,
  createTheme,
  Box,
  Menu,
  rem
} from "@mantine/core";

// Editor Import
import Editor, { OnMount } from "@monaco-editor/react";

// Imports Components
import { PreambleWizard } from "./components/wizards/PreambleWizard";
import { TableWizard } from "./components/wizards/TableWizard";
import { TikzWizard } from "./components/wizards/TikzWizard";
import { TableDataView } from "./components/database/TableDataView";
import { PdfPreview } from "./components/layout/PdfPreview";
import { Sidebar, SidebarSection, ViewType, AppTab, FileSystemNode } from "./components/layout/Sidebar";
import { StatusBar } from "./components/layout/StatusBar";

import { latexLanguage, latexConfiguration } from "./languages/latex";
import { dataTexDarkTheme } from "./themes/monaco-theme";

import {
  Database,
  Search,
  Play,
  FileCode,
  Table2,
  X,
  ChevronRight,
  Save,
  FolderOpen,
  FilePlus,
  Code2,
  FileText, 
  BookOpen, 
  Image as ImageIcon, 
  FileCog, 
  File,
  PanelRight
} from "lucide-react";

// --- Theme Configuration ---
const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "sm",
  fontFamily: "Inter, sans-serif",
  colors: {
    dark: [
      "#C1C2C5", "#A6A7AB", "#909296", "#5c5f66", "#373A40",
      "#2C2E33", "#25262b", "#1A1B1E", "#141517", "#101113",
    ],
  },
  components: {
    Switch: {
      defaultProps: { thumbIcon: null },
      styles: {
        root: { display: 'flex', alignItems: 'center' },
        track: {
          border: '1px solid #4A4B50', 
          backgroundColor: '#2C2E33', 
          cursor: 'pointer',
          height: rem(22),
          minWidth: rem(42), 
          padding: 2, 
          transition: 'background-color 0.2s, border-color 0.2s',
          '&[data-checked]': { 
            backgroundColor: 'var(--mantine-color-blue-6)',
            borderColor: 'var(--mantine-color-blue-6)',
          },
        },
        thumb: {
          height: rem(16), 
          width: rem(16),
          backgroundColor: '#fff', 
          borderRadius: '50%',
          border: 'none',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
        },
        label: { paddingLeft: 10, fontWeight: 500, color: '#C1C2C5' }
      }
    }
  }
});

const INITIAL_CODE = `\\documentclass{article}
\\usepackage{amsmath}

\\begin{document}
  \\section{Hello DataTex}
  Start typing...
\\end{document}`;

const ResizerHandle = ({ onMouseDown, isResizing }: { onMouseDown: (e: React.MouseEvent) => void, isResizing: boolean }) => (
  <Box
    onMouseDown={onMouseDown}
    w={6}
    h="100%"
    bg={isResizing ? "blue.6" : "transparent"}
    style={{
      cursor: "col-resize",
      transition: "background-color 0.2s",
      zIndex: 50,
      position: 'relative',
      userSelect: 'none',
      ":hover": { backgroundColor: "var(--mantine-color-blue-6)" }
    }}
  />
);

// --- 3. MAIN EDITOR AREA COMPONENT ---
const EditorArea = React.memo(({
  files, 
  activeFileId, 
  onFileSelect, 
  onFileClose,
  onContentChange,
  onMount 
}: { 
  files: AppTab[], 
  activeFileId: string, 
  onFileSelect: (id: string) => void,
  onFileClose: (id: string, e: React.MouseEvent) => void,
  onContentChange: (id: string, content: string) => void,
  onMount: OnMount 
}) => {
  
  const activeFile = files.find(f => f.id === activeFileId);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  
  // Έλεγχος αν το αρχείο είναι .tex
  const isTexFile = activeFile?.title.toLowerCase().endsWith('.tex');
  
  // --- PDF Preview State ---
  const [showPdf, setShowPdf] = useState(true);
  const [pdfWidth, setPdfWidth] = useState(600);
  const [isResizingPdf, setIsResizingPdf] = useState(false);
  const pdfResizeRef = useRef<number | null>(null);

  useEffect(() => {
    let activeBlobUrl: string | null = null;
    const checkPdf = async () => {
      if (activeFile && activeFile.type === 'editor' && activeFile.id) {
         const isRealFile = activeFile.id.includes('/') || activeFile.id.includes('\\');
         const isTex = activeFile.title.toLowerCase().endsWith('.tex');

         if (isRealFile && isTex) {
            try {
              // @ts-ignore
              const { exists, readFile } = await import('@tauri-apps/plugin-fs');
              const pdfPath = activeFile.id.replace(/\.tex$/i, '.pdf');
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
              console.warn("PDF check failed or running in browser", e);
              setPdfUrl(null);
            }
         } else {
            setPdfUrl(null);
         }
      } else {
        setPdfUrl(null);
      }
    };
    checkPdf();
    return () => {
        if (activeBlobUrl) {
            URL.revokeObjectURL(activeBlobUrl);
        }
    };
  }, [activeFile?.id, activeFile?.title, activeFile?.type]);

  const startResizePdf = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingPdf(true);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
       if (pdfResizeRef.current) return;
       pdfResizeRef.current = requestAnimationFrame(() => {
          if (isResizingPdf) {
            const newWidth = window.innerWidth - e.clientX - 50; 
            setPdfWidth(Math.max(300, Math.min(1200, newWidth)));
          }
          pdfResizeRef.current = null;
       });
    };
    const up = () => { setIsResizingPdf(false); if(pdfResizeRef.current) cancelAnimationFrame(pdfResizeRef.current); };
    if(isResizingPdf) { window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); document.body.style.cursor = 'col-resize'; }
    else { document.body.style.cursor = 'default'; }
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isResizingPdf]);

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch(ext) {
        case 'tex': return <FileCode size={14} color="#4dabf7" />;
        case 'bib': return <BookOpen size={14} color="#fab005" />;
        case 'sty': return <FileCog size={14} color="#be4bdb" />;
        case 'pdf': return <FileText size={14} color="#fa5252" />;
        case 'png': case 'jpg': return <ImageIcon size={14} color="#40c057" />;
        default: return <File size={14} color="#868e96" />;
    }
  };

  const debouncedOnChange = useRef<((id: string, value: string) => void) | null>(null);

  useEffect(() => {
    debouncedOnChange.current = debounce((id: string, value: string) => {
        onContentChange(id, value);
    }, 500);
    return () => {
        if (debouncedOnChange.current) {
            // @ts-ignore
            debouncedOnChange.current.cancel();
        }
    };
  }, [onContentChange]);

  // Flush debounced changes when switching files to prevent data loss
  useEffect(() => {
    return () => {
        if (debouncedOnChange.current) {
            // @ts-ignore
            debouncedOnChange.current.flush();
        }
    };
  }, [activeFileId]);

  const handleEditorChange = useCallback((value: string | undefined) => {
      if (activeFile && debouncedOnChange.current) {
          debouncedOnChange.current(activeFile.id, value || '');
      }
  }, [activeFile]);

  return (
    <Stack gap={0} h="100%" w="100%" style={{ overflow: "hidden" }}>
      {/* Tabs Bar */}
      <ScrollArea type="hover" scrollbarSize={6} bg="dark.8" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)", whiteSpace: 'nowrap', flexShrink: 0 }}>
        <Group gap={1} pt={4} px={4} wrap="nowrap">
          {files.map(file => (
            <Box
              key={file.id}
              py={6} px={12}
              bg={file.id === activeFileId ? "dark.7" : "transparent"}
              style={{
                borderTop: file.id === activeFileId ? "2px solid #339af0" : "2px solid transparent",
                borderRight: "1px solid var(--mantine-color-dark-6)",
                borderTopRightRadius: 4, borderTopLeftRadius: 4,
                cursor: "pointer", minWidth: 120,
              }}
              onClick={() => onFileSelect(file.id)}
            >
              <Group gap={8} wrap="nowrap">
                {file.type === 'editor' ? getFileIcon(file.title) : <Table2 size={14} color="#69db7c" />}
                <Text size="xs" c={file.id === activeFileId ? "white" : "dimmed"}>{file.title}</Text>
                <ActionIcon size="xs" variant="transparent" color="gray" className="close-tab" onClick={(e) => onFileClose(file.id, e)} style={{ opacity: file.id === activeFileId ? 1 : 0.5 }}>
                  <X size={12} />
                </ActionIcon>
              </Group>
            </Box>
          ))}
        </Group>
      </ScrollArea>

      {/* Breadcrumb Toolbar */}
      <Group h={32} px="md" bg="dark.7" justify="space-between" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)", flexShrink: 0 }}>
        <Group gap={4}>
          <Text size="xs" c="dimmed">DataTex</Text>
          {activeFile && <><ChevronRight size={12} color="gray" /><Text size="xs" c="white" truncate>{activeFile.title}</Text></>}
        </Group>
        <Group gap="xs">
          <Tooltip label="Compile"><ActionIcon size="sm" variant="subtle" color="green"><Play size={14} /></ActionIcon></Tooltip>
          {activeFile?.type === 'editor' && isTexFile && (
              <Tooltip label={showPdf ? "Hide PDF Preview" : "Show PDF Preview"}>
                <ActionIcon size="sm" variant={showPdf ? "light" : "subtle"} color={showPdf ? "blue" : "gray"} onClick={() => setShowPdf(!showPdf)}>
                  <PanelRight size={14} />
                </ActionIcon>
              </Tooltip>
          )}
        </Group>
      </Group>

      {/* Main Content Area - FIXED LAYOUT FOR SCROLLING */}
      {/* wrap="nowrap" ensures columns don't break. minHeight: 0 ensures inner scrollbars work */}
      <Group gap={0} wrap="nowrap" style={{ flex: 1, overflow: "hidden", alignItems: "stretch", minHeight: 0 }}>
        
        {/* Editor Container */}
        <Box style={{ flex: 1, position: "relative", minWidth: 0, height: "100%", overflow: "hidden" }}>
          {activeFile?.type === 'editor' ? (
            <Editor
              path={activeFile.id} 
              height="100%"
              defaultLanguage="my-latex"
              defaultValue={activeFile.content}
              key={activeFile.id}
              onMount={onMount}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: true, scale: 0.75 },
                fontSize: 14,
                fontFamily: "Consolas, monospace",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                theme: "data-tex-dark",
                wordWrap: "on"
              }}
            />
          ) : activeFile?.type === 'table' ? (
             <TableDataView tableName={activeFile.tableName || ''} />
          ) : (
             <Box h="100%" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                <Code2 size={48} color="#373A40" />
                <Text c="dimmed" mt="md">Select a file to start editing</Text>
             </Box>
          )}
        </Box>

        {/* PDF Preview */}
        {activeFile?.type === 'editor' && isTexFile && showPdf && (
            <>
                <ResizerHandle onMouseDown={startResizePdf} isResizing={isResizingPdf} />
                <Box w={pdfWidth} h="100%" bg="dark.6" style={{ borderLeft: "1px solid var(--mantine-color-dark-5)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
                    <Group justify="space-between" px="xs" py={4} bg="dark.7" style={{ borderBottom: "1px solid var(--mantine-color-dark-5)", flexShrink: 0 }}>
                        <Text size="xs" fw={700} c="dimmed">PDF PREVIEW</Text>
                        <ActionIcon size="xs" variant="transparent" onClick={() => setShowPdf(false)}><X size={12} /></ActionIcon>
                    </Group>
                    {/* Parent of PdfPreview needs overflow hidden/auto depending on internal implementation, but flex:1 is key */}
                    <Box style={{ flex: 1, position: 'relative', overflow: 'hidden' }} bg="gray.7">
                        <PdfPreview pdfUrl={pdfUrl} />
                    </Box>
                </Box>
            </>
        )}
      </Group>
    </Stack>
  );
});

const WizardWrapper = React.memo(({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <Stack gap={0} h="100%" bg="dark.8" style={{ borderLeft: "1px solid var(--mantine-color-dark-6)" }}>
    <Group h={40} px="md" bg="dark.7" justify="space-between" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)" }}>
      <Text size="sm" fw={700}>{title}</Text>
      <ActionIcon variant="subtle" size="sm" onClick={onClose} aria-label="Close Wizard"><X size={16} /></ActionIcon>
    </Group>
    <Box style={{ flex: 1, overflow: "hidden" }}>{children}</Box>
  </Stack>
));

const HeaderContent = React.memo(() => (
  <Group h="100%" px="md" justify="space-between" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)" }} data-tauri-drag-region>
    <Group data-tauri-drag-region>
      <Group gap={6} mr="lg" style={{ userSelect: 'none' }}>
        <Database size={18} color="#339af0" />
        <Text fw={700} size="sm" c="gray.3">DataTex <Text span size="xs" c="dimmed">v2.0</Text></Text>
      </Group>
      <Group gap={0} visibleFrom="sm">
        {["File", "Edit", "View", "Go", "Help"].map((label) => (
          <Menu key={label} shadow="md" width={200}>
            <Menu.Target><Button variant="subtle" color="gray" size="compact-xs" radius="sm" fw={400} style={{ fontSize: 12 }}>{label}</Button></Menu.Target>
            <Menu.Dropdown>
               {label === 'File' && (
                <>
                  <Menu.Item leftSection={<FilePlus size={14}/>} onClick={() => {}} /* Placeholder */>New File</Menu.Item>
                  <Menu.Item leftSection={<FolderOpen size={14}/>} onClick={() => {}} /* Placeholder */>Open Folder</Menu.Item>
                  <Menu.Item leftSection={<Save size={14}/>}>Save</Menu.Item>
                </>
              )}
              <Menu.Item>Placeholder Action</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ))}
      </Group>
    </Group>
    <Box style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: '30%' }}>
      <TextInput placeholder="DataTex Search (Ctrl+P)" leftSection={<Search size={12} />} size="xs" radius="md" styles={{ input: { height: 24, minHeight: 24, backgroundColor: "var(--mantine-color-dark-6)", borderColor: "transparent", color: "#fff", textAlign: 'center' } }} />
    </Box>
    <Box w={100} />
  </Group>
));

// --- MAIN APP COMPONENT ---

export default function App() {
  const [activeActivity, setActiveActivity] = useState<SidebarSection>("files");
  const [activeView, setActiveView] = useState<ViewType>("editor");
  
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [wizardWidth, setWizardWidth] = useState(450);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingWizard, setIsResizingWizard] = useState(false);
  const rafRef = useRef<number | null>(null);

  const [tabs, setTabs] = useState<AppTab[]>([
    { id: 'start', title: 'Start.tex', type: 'editor', content: INITIAL_CODE, language: 'latex' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('start');
  const [projectData, setProjectData] = useState<FileSystemNode[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [dbTables, setDbTables] = useState<string[]>([]);
  const editorRef = useRef<any>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // --- ACTIONS ---
  const handleConnectDB = () => {
    if (dbConnected) { setDbConnected(false); setDbTables([]); } 
    else { setDbConnected(true); setDbTables(['users', 'documents', 'bibliography', 'settings']); }
  };

  const handleOpenTable = useCallback((tableName: string) => {
    const tabId = `table-${tableName}`;
    setTabs(prev => {
        if (!prev.find(t => t.id === tabId)) {
            return [...prev, { id: tabId, title: tableName, type: 'table', tableName: tableName }];
        }
        return prev;
    });
    setActiveTabId(tabId);
  }, []);

  const handleOpenFolder = async () => {
    try {
      setLoadingFiles(true);
      // @ts-ignore
      const { open } = await import('@tauri-apps/plugin-dialog');
      // @ts-ignore
      const { readDir } = await import('@tauri-apps/plugin-fs');

      const selectedPath = await open({ directory: true, multiple: false });
      
      if (selectedPath && typeof selectedPath === 'string') {
        // @ts-ignore
        const entries = await readDir(selectedPath); 
        const ignoredExtensions = ['aux', 'log', 'out', 'toc', 'synctex.gz', 'fdb_latexmk', 'fls', 'bbl', 'blg', 'xdv', 'lof', 'lot'];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const process = (ents: any[], parentPath: string): FileSystemNode[] => {
            return ents.filter(e => {
                  if (e.isDirectory) return true;
                  const name = e.name || '';
                  const ext = name.split('.').pop()?.toLowerCase();
                  if (ext && ignoredExtensions.includes(ext)) return false;
                  return true;
              }).map(e => ({
                id: `${parentPath}/${e.name}`, name: e.name || '', type: e.isDirectory ? 'folder' : 'file', path: `${parentPath}/${e.name}`, children: [] 
            }));
        };
        setProjectData(process(entries, selectedPath));
      }
    } catch (e) {
      console.warn("Tauri v2 API failed", e);
      setProjectData([{ id: 'root', name: 'Mock Project', type: 'folder', path: '/root', children: [
          { id: 'f1', name: 'main.tex', type: 'file', path: '/root/main.tex' },
          { id: 'f2', name: 'chapter1.tex', type: 'file', path: '/root/chapter1.tex' }
      ]}]);
    } finally { setLoadingFiles(false); }
  };

  const handleOpenFileNode = useCallback(async (node: FileSystemNode) => {
    // Need to check tabs in functional update or use ref, but tabs is dependency anyway?
    // To make it stable for sidebar resize, it shouldn't depend on things that change during resize.
    // Tabs don't change during resize. So depending on tabs is fine.
    // Wait, if tabs change (file opened), Sidebar re-renders. This is correct.
    // But we want to avoid re-rendering Sidebar when SIDEBAR WIDTH changes.
    // Sidebar width changes -> App re-renders -> handleOpenFileNode recreated -> Sidebar re-renders.
    // So we need useCallback.
    // But if we depend on 'tabs', and 'tabs' doesn't change during resize, then handleOpenFileNode is stable.

    // We can optimization: Check existence inside setTabs?
    // But we need to set activeTabId.
    // We can access current tabs via ref if needed, but for now just depending on tabs is enough
    // because tabs don't change during resize.

    // Actually, to read current tabs inside async function without adding 'tabs' to dependency:
    // This is tricky. Let's just use tabs dependency for now, as it's better than nothing.

    setTabs(prev => {
        if (prev.find(t => t.id === node.path)) return prev;
        return prev; // We need to handle the async part outside or differently
    });

    // Since this is async and complicated, let's just wrap it.
    // If we use 'tabs' in dependency, it won't break resizing performance
    // because 'tabs' is stable during resize.
    const exists = tabs.find(t => t.id === node.path);
    if (exists) { setActiveTabId(node.path); return; }

    let content = "";
    try {
        // @ts-ignore
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        content = await readTextFile(node.path);
    } catch (e) {
        content = `% Content of ${node.name}\n\\section{${node.name}}\n`;
    }
    const newTab: AppTab = { id: node.path, title: node.name, type: 'editor', content: content, language: 'latex' };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(node.path);
  }, [tabs]);

  const handleCloseTab = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Use functional update to avoid 'tabs' dependency if possible?
    // But we need to calculate next active tab.
    // Depending on 'tabs' is fine as it doesn't change during resize.
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id && newTabs.length > 0) setActiveTabId(newTabs[newTabs.length - 1].id);
  }, [tabs, activeTabId]);

  const handleEditorChange = useCallback((id: string, val: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, content: val, isDirty: true } : t));
  }, []);

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

  const startResizeSidebar = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsResizingSidebar(true); }, []);
  const startResizeWizard = useCallback((e: React.MouseEvent) => { e.preventDefault(); setIsResizingWizard(true); }, []);
  
  useEffect(() => {
    const move = (e: MouseEvent) => {
       if (rafRef.current) return;
       rafRef.current = requestAnimationFrame(() => {
          if (isResizingSidebar) setSidebarWidth(Math.max(150, Math.min(600, e.clientX - 50)));
          if (isResizingWizard) setWizardWidth(Math.max(300, Math.min(900, window.innerWidth - e.clientX)));
          rafRef.current = null;
       });
    };
    const up = () => { setIsResizingSidebar(false); setIsResizingWizard(false); if(rafRef.current) cancelAnimationFrame(rafRef.current); };
    if(isResizingSidebar || isResizingWizard) { window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); document.body.style.cursor = 'col-resize'; }
    else document.body.style.cursor = 'default';
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isResizingSidebar, isResizingWizard]);

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    if (!monaco.languages.getLanguages().some((l: any) => l.id === "my-latex")) {
      monaco.languages.register({ id: "my-latex" });
      monaco.languages.setMonarchTokensProvider("my-latex", latexLanguage);
      monaco.languages.setLanguageConfiguration("my-latex", latexConfiguration);
      monaco.editor.defineTheme("data-tex-dark", dataTexDarkTheme);
    }
    monaco.editor.setTheme("data-tex-dark");
  }, []);


  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AppShell header={{ height: 35 }} footer={{ height: 24 }} padding={0}>
        <AppShell.Header withBorder={false} bg="dark.9" style={{ zIndex: 200 }}><HeaderContent /></AppShell.Header>
        {/* FIXED LAYOUT OVERLAP FIX: Use 100vh height with exact padding for header and footer */}
        <AppShell.Main bg="dark.9" style={{ display: "flex", flexDirection: "column", height: "100vh", paddingTop: 35, paddingBottom: 24, overflow: "hidden" }}>
          {(isResizingSidebar || isResizingWizard) && (
            <Box style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none' }} />
          )}
          {/* Main Layout Group - FIXED LAYOUT */}
          <Group gap={0} wrap="nowrap" h="100%" align="stretch" style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            
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
            />
            
            <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
              <Box style={{ flex: 1, minWidth: 200, height: '100%', overflow: "hidden" }}>
                <EditorArea files={tabs} activeFileId={activeTabId} onFileSelect={setActiveTabId} onFileClose={handleCloseTab} onContentChange={handleEditorChange} onMount={handleEditorDidMount} />
              </Box>
              {activeView !== "editor" && (
                <>
                  <ResizerHandle onMouseDown={startResizeWizard} isResizing={isResizingWizard} />
                  <Box w={wizardWidth} h="100%" style={{ flexShrink: 0, overflow: "hidden" }}>
                    {activeView === "wizard-preamble" && <WizardWrapper title="Preamble Wizard" onClose={() => setActiveView("editor")}><PreambleWizard onInsert={handleCreateDocument} /></WizardWrapper>}
                    {activeView === "wizard-table" && <WizardWrapper title="Table Wizard" onClose={() => setActiveView("editor")}><TableWizard onInsert={handleInsertSnippet} /></WizardWrapper>}
                    {activeView === "wizard-tikz" && <WizardWrapper title="TikZ Wizard" onClose={() => setActiveView("editor")}><TikzWizard onInsert={handleInsertSnippet} /></WizardWrapper>}
                  </Box>
                </>
              )}
            </Box>
          </Group>
        </AppShell.Main>
        <AppShell.Footer withBorder={false} p={0}><StatusBar activeFile={tabs.find(f => f.id === activeTabId)} dbConnected={dbConnected} /></AppShell.Footer>
      </AppShell>
    </MantineProvider>
  );
}