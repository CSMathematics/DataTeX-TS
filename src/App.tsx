import { useState, useRef, useEffect, useCallback } from "react";
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
  Badge,
  MantineProvider,
  createTheme,
  Box,
  Menu,
  Collapse,
  Loader
} from "@mantine/core";

// --- [ΑΛΛΑΓΗ 1: Προσθήκη του πραγματικού Editor] ---
// Βεβαιώσου ότι έκανες: npm install @monaco-editor/react
import Editor from "@monaco-editor/react";

import { open } from "@tauri-apps/plugin-dialog";
import { readDir, DirEntry } from "@tauri-apps/plugin-fs";

import { latexLanguage, latexConfiguration } from "./languages/latex";
import { dataTexDarkTheme } from "./themes/monaco-theme";

import {
  Files,
  Database,
  Search,
  Settings,
  Wand2,
  Play,
  FileCode,
  Table2,
  Columns,
  X,
  ChevronDown,
  TerminalSquare,
  Maximize2,
  MoreVertical,
  ChevronRight,
  FolderOpen,
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
});

// --- Types ---
type SidebarSection = "files" | "search" | "database" | "wizards";
type ViewType = "editor" | "wizard-preamble" | "wizard-table" | "wizard-tikz";

// --- Unified Tab Interface ---
interface AppTab {
  id: string;
  title: string;
  type: 'editor' | 'table';
  // Editor properties
  content?: string;
  language?: string;
  isDirty?: boolean;
  // Table properties
  tableName?: string;
}

const MOCK_TABLES = [
  { name: "exercises_algebra", count: 150 },
  { name: "geometry_theorems", count: 45 },
  { name: "physics_problems", count: 89 },
];

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

// --- SIDEBAR CONTENT COMPONENT ---
// Αυτό το component περιέχει όλη τη λογική εμφάνισης για Files, DB, Wizards
const SidebarContent = ({
  activeSection,
  onNavigate,
  openTabs,
  activeTabId,
  onTabSelect,
  projectData,
  onOpenFolder,
  onOpenFileNode,
  loadingFiles,
  dbConnected,
  dbTables,
  onConnectDB,
  onOpenTable
}: {
  activeSection: SidebarSection;
  onNavigate: (view: ViewType) => void;
  openTabs: AppTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  projectData: FileSystemNode[];
  onOpenFolder: () => void;
  onOpenFileNode: (node: FileSystemNode) => void;
  loadingFiles: boolean;
  dbConnected: boolean;
  dbTables: string[];
  onConnectDB: () => void;
  onOpenTable: (tableName: string) => void;
}) => {
  const [files, setFiles] = useState<DirEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        const entries = await readDir(selected);
        // Φιλτράρουμε για να δείχνουμε φακέλους και αρχεία .tex, .bib, .sty κτλ.
        // Για αρχή δείχνουμε τα πάντα.
        setFiles(entries);
        setCurrentPath(selected);
      }
    } catch (err) {
      console.error("Error opening folder:", err);
    }
  };

  return (
    <Stack gap={0} h="100%" bg="dark.7">
      <Group justify="space-between" px="xs" h={36} style={{ borderBottom: "1px solid var(--mantine-color-dark-6)" }}>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          {activeSection === "files" && "Explorer"}
          {activeSection === "database" && "DataTex DB"}
          {activeSection === "wizards" && "Wizards"}
        </Text>
        <MoreVertical size={14} color="gray" />
      </Group>

      <ScrollArea style={{ flex: 1 }}>
        {/* SECTION: FILES */}
        {activeSection === "files" && (
          <Stack gap={2} p="xs">
            {!currentPath ? (
              <Button
                variant="light"
                leftSection={<FolderOpen size={16} />}
                onClick={handleOpenFolder}
              >
                Open Folder
              </Button>
            ) : (
              <>
                <Group
                  gap={4}
                  py={4}
                  px={6}
                  style={{ cursor: "pointer", borderRadius: 4 }}
                  bg="dark.6"
                  onClick={handleOpenFolder} // Ξανα-ανοίγει το dialog για αλλαγή φακέλου
                >
                  <ChevronDown size={14} />
                  <Text size="xs" fw={700} truncate>
                    {currentPath.split(/[/\\]/).pop()}
                  </Text>
                </Group>
                {files
                  .sort((a, b) => {
                    // Folders first
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((f) => (
                    <Group
                      key={f.name}
                      gap={8}
                      pl={24}
                      py={4}
                      style={{ cursor: "pointer", borderRadius: 4 }}
                    >
                      {f.isDirectory ? (
                         <FolderOpen size={14} color="#ffd43b" />
                      ) : (
                        <FileCode size={14} color="#4dabf7" />
                      )}

                      <Text size="sm" c="gray.3" truncate>
                        {f.name}
                      </Text>
                    </Group>
                  ))}
              </>
            )}
          </Stack>
        )}

        {/* SECTION: WIZARDS */}
        {activeSection === "wizards" && (
          <Stack gap="xs" p="xs">
            <Button variant="light" color="violet" justify="start" leftSection={<FileCode size={16} />} onClick={() => onNavigate("wizard-preamble")}>Preamble Wizard</Button>
            <Button variant="light" color="green" justify="start" leftSection={<Table2 size={16} />} onClick={() => onNavigate("wizard-table")}>Table Generator</Button>
            <Button variant="light" color="orange" justify="start" leftSection={<Wand2 size={16} />} onClick={() => onNavigate("wizard-tikz")}>TikZ Builder</Button>
          </Stack>
        )}
        
        {/* SECTION: DATABASE */}
        {activeSection === "database" && (
          <Stack gap="md" p="xs">
            {!dbConnected ? (
               <Box ta="center" mt="xl">
                  <Database size={48} color="#373A40" style={{marginBottom: 16}} />
                  <Text size="sm" c="dimmed" mb="md">No Database Connected</Text>
                  <Button size="xs" leftSection={<Plug size={14} />} fullWidth variant="light" onClick={onConnectDB}>
                    Connect SQLite (.db)
                  </Button>
               </Box>
            ) : (
                <Box>
                    <Group justify="space-between" mb="sm">
                        <Text size="xs" fw={700} c="dimmed">TABLES ({dbTables.length})</Text>
                        <ActionIcon size="xs" variant="subtle" color="red" onClick={onConnectDB}><X size={12}/></ActionIcon>
                    </Group>
                    {dbTables.map((t) => (
                        <Group key={t} justify="space-between" mb={4} p={4} style={{ cursor: "pointer", borderRadius: 4 }} onClick={() => onOpenTable(t)}>
                            <Group gap={6}><Table2 size={14} color="#69db7c" /><Text size="sm" truncate>{t}</Text></Group>
                        </Group>
                    ))}
                </Box>
            )}
          </Stack>
        )}
      </ScrollArea>
    </Stack>
  );
};

// 3. Main Editor Area
const EditorArea = () => {

  return (
    <Stack gap={0} h="100%" w="100%">
      {/* Tabs Bar */}
      <ScrollArea type="hover" scrollbarSize={6} bg="dark.8" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)", whiteSpace: 'nowrap' }}>
        <Group gap={1} pt={4} px={4} wrap="nowrap">
          {files.map(file => (
            <Box
              key={file.id}
              py={6}
              px={12}
              bg={file.id === activeFileId ? "dark.7" : "transparent"}
              style={{
                borderTop: file.id === activeFileId ? "2px solid #339af0" : "2px solid transparent",
                borderRight: "1px solid var(--mantine-color-dark-6)",
                borderTopRightRadius: 4,
                borderTopLeftRadius: 4,
                cursor: "pointer",
                minWidth: 120,
              }}
              onClick={() => onFileSelect(file.id)}
            >
              <Group gap={8} wrap="nowrap">
                {file.type === 'editor' ? <FileCode size={14} color="#4dabf7" /> : <Table2 size={14} color="#69db7c" />}
                <Text size="xs" c={file.id === activeFileId ? "white" : "dimmed"}>
                  {file.title}
                </Text>
                <ActionIcon 
                  size="xs" 
                  variant="transparent" 
                  color="gray" 
                  className="close-tab"
                  onClick={(e) => onFileClose(file.id, e)}
                  style={{ opacity: file.id === activeFileId ? 1 : 0.5 }}
                >
                  <X size={12} />
                </ActionIcon>
              </Group>
            </Box>
          ))}
        </Group>
      </ScrollArea>

      {/* Breadcrumb Toolbar */}
      <Group
        h={32}
        px="md"
        bg="dark.7"
        justify="space-between"
        style={{ borderBottom: "1px solid var(--mantine-color-dark-6)" }}
      >
        <Group gap={4}>
          <Text size="xs" c="dimmed">DataTex</Text>
          {activeFile && (
            <>
              <ChevronRight size={12} color="gray" />
              <Text size="xs" c="white" truncate>{activeFile.title}</Text>
            </>
          )}
        </Group>
        <Group gap="xs">
          <Tooltip label="Compile">
            <ActionIcon size="sm" variant="subtle" color="green">
              <Play size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Main Content (Editor or Table View) */}
      <Group gap={0} style={{ flex: 1, overflow: "hidden", alignItems: "stretch" }}>
        <Box style={{ flex: 1, position: "relative" }}>
          <Editor
            height="100%"
            defaultLanguage="my-latex" // ΠΡΟΣΟΧΗ: Πρέπει να είναι ίδιο με το id στο register
            defaultValue={INITIAL_CODE}
            onMount={handleEditorDidMount} // Αυτό είναι το κλειδί για να τρέξουν τα παραπάνω
            options={{
              minimap: { enabled: true, scale: 0.75 },
              fontSize: 14,
              fontFamily: "Consolas, monospace",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </Box>

        {/* PDF Preview (Only for Editor) */}
        {activeFile?.type === 'editor' && (
          <Box w="50%" h="100%" bg="dark.6" style={{ borderLeft: "1px solid var(--mantine-color-dark-5)", display: "flex", flexDirection: "column" }}>
            <Group justify="space-between" px="xs" py={4} bg="dark.7" style={{ borderBottom: "1px solid var(--mantine-color-dark-5)" }}>
              <Text size="xs" fw={700} c="dimmed">PDF PREVIEW</Text>
              <ActionIcon size="xs" variant="transparent"><Maximize2 size={12} /></ActionIcon>
            </Group>
            <Box style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }} bg="gray.7">
              <Box w="80%" h="90%" bg="white" p="xl" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.3)", color: "black", overflowY: "auto" }}>
                <Text size="xl" fw={700} mb="md">1 Εισαγωγή</Text>
                <Text size="sm">Preview for: {activeFile?.title || 'Empty'}</Text>
              </Box>
            </Box>
          </Box>
        )}
      </Group>
    </Stack>
  );
};

// 4. Status Bar
const StatusBar = ({ activeFile }: { activeFile?: AppTab }) => (
  <Group h={24} px="xs" justify="space-between" bg="blue.8" c="white" style={{ fontSize: "11px", userSelect: "none" }}>
    <Group gap="lg">
      <Group gap={4}><TerminalSquare size={12} /><Text size="xs" inherit>Ready</Text></Group>
    </Group>
    <Group gap="lg">
      <Text size="xs" inherit>{activeFile?.language || 'Plain Text'}</Text>
      <Text size="xs" inherit>UTF-8</Text>
      <Group gap={4}><Database size={10} /><Text size="xs" inherit>DataTex DB: Connected</Text></Group>
    </Group>
  </Group>
);

const handleEditorDidMount = (_editor: any, monaco: any) => {
  // 1. Καταχώρηση της γλώσσας LaTeX
  monaco.languages.register({ id: "my-latex" });
  monaco.languages.setMonarchTokensProvider("my-latex", latexLanguage);
  monaco.languages.setLanguageConfiguration("my-latex", latexConfiguration);

  // 2. Καταχώρηση και εφαρμογή του Θέματος
  monaco.editor.defineTheme("data-tex-dark", dataTexDarkTheme);
  monaco.editor.setTheme("data-tex-dark");
};

// --- Main App ---

export default function App() {
  const [activeActivity, setActiveActivity] = useState<SidebarSection>("files");
  const [activeView, setActiveView] = useState<ViewType>("editor");
  
  // --- Resizing State ---
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [wizardWidth, setWizardWidth] = useState(450);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingWizard, setIsResizingWizard] = useState(false);
  const rafRef = useRef<number | null>(null);

  // --- Tabs Management ---
  const [tabs, setTabs] = useState<AppTab[]>([
    { id: 'start', title: 'Start.tex', type: 'editor', content: INITIAL_CODE, language: 'latex' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('start');
  
  // --- File System State ---
  const [projectData, setProjectData] = useState<FileSystemNode[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // --- Database State ---
  const [dbConnected, setDbConnected] = useState(false);
  const [dbTables, setDbTables] = useState<string[]>([]);

  const editorRef = useRef<any>(null);

  // --- DERIVED STATE ---
  const activeTab = tabs.find(t => t.id === activeTabId);

  // --- ACTIONS ---

  // Database Mock Connect
  const handleConnectDB = () => {
    if (dbConnected) {
        setDbConnected(false);
        setDbTables([]);
    } else {
        setDbConnected(true);
        setDbTables(['users', 'documents', 'bibliography', 'settings']);
    }
  };

  const handleOpenTable = (tableName: string) => {
    const tabId = `table-${tableName}`;
    if (!tabs.find(t => t.id === tabId)) {
        const newTab: AppTab = {
            id: tabId,
            title: tableName,
            type: 'table',
            tableName: tableName
        };
        setTabs([...tabs, newTab]);
    }
    setActiveTabId(tabId);
  };

  // --- TAURI v2 FILE SYSTEM LOGIC ---
  const handleOpenFolder = async () => {
    try {
      setLoadingFiles(true);
      
      // Dynamic imports for Tauri v2 Plugins
      // @ts-ignore
      const { open } = await import('@tauri-apps/plugin-dialog');
      // @ts-ignore
      const { readDir } = await import('@tauri-apps/plugin-fs');

      const selectedPath = await open({ directory: true, multiple: false });
      
      if (selectedPath && typeof selectedPath === 'string') {
        // Διαβάζουμε αναδρομικά το φάκελο
        // @ts-ignore
        const entries = await readDir(selectedPath); 
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const process = (ents: any[], parentPath: string): FileSystemNode[] => ents.map(e => ({
            id: `${parentPath}/${e.name}`, 
            name: e.name || '', 
            type: e.isDirectory ? 'folder' : 'file', 
            path: `${parentPath}/${e.name}`, 
            children: [] 
        }));
        
        setProjectData(process(entries, selectedPath));
      }
    } catch (e) {
      console.warn("Tauri v2 API failed (likely running in browser). Loading Mock Data.", e);
      // Fallback Mock Data
      setProjectData([{ id: 'root', name: 'Mock Project', type: 'folder', path: '/root', children: [
          { id: 'f1', name: 'main.tex', type: 'file', path: '/root/main.tex' },
          { id: 'f2', name: 'chapter1.tex', type: 'file', path: '/root/chapter1.tex' }
      ]}]);
    } finally { setLoadingFiles(false); }
  };

  const handleOpenFileNode = async (node: FileSystemNode) => {
    if (tabs.find(t => t.id === node.path)) { setActiveTabId(node.path); return; }
    
    let content = "";
    try {
        // @ts-ignore
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        content = await readTextFile(node.path);
    } catch (e) {
        console.warn("Using mock content for file", e);
        content = `% Content of ${node.name}\n\\section{${node.name}}\n`;
    }

    const newTab: AppTab = {
        id: node.path,
        title: node.name,
        type: 'editor',
        content: content,
        language: 'latex'
    };
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

  // --- RESIZE HANDLERS ---
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

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    if (!monaco.languages.getLanguages().some((l: any) => l.id === "my-latex")) {
      monaco.languages.register({ id: "my-latex" });
      monaco.languages.setMonarchTokensProvider("my-latex", latexLanguage);
      monaco.languages.setLanguageConfiguration("my-latex", latexConfiguration);
      monaco.editor.defineTheme("data-tex-dark", dataTexDarkTheme);
    }
    monaco.editor.setTheme("data-tex-dark");
  };

  // Wrapper for Wizards
  const WizardWrapper = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
    <Stack gap={0} h="100%" bg="dark.8" style={{ borderLeft: "1px solid var(--mantine-color-dark-6)" }}>
      <Group h={40} px="md" bg="dark.7" justify="space-between" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)" }}>
        <Text size="sm" fw={700}>{title}</Text>
        <ActionIcon variant="subtle" size="sm" onClick={onClose} aria-label="Close Wizard"><X size={16} /></ActionIcon>
      </Group>
      <Box style={{ flex: 1, overflow: "hidden" }}>{children}</Box>
    </Stack>
  );

  const HeaderContent = () => (
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
                    <Menu.Item leftSection={<FilePlus size={14}/>} onClick={() => handleCreateDocument('')}>New File</Menu.Item>
                    <Menu.Item leftSection={<FolderOpen size={14}/>} onClick={handleOpenFolder}>Open Folder</Menu.Item>
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
  );

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <AppShell header={{ height: 35 }} footer={{ height: 24 }} padding={0}>
        <AppShell.Header withBorder={false} bg="dark.9" style={{ zIndex: 200 }}><HeaderContent /></AppShell.Header>
        <AppShell.Main bg="dark.9" style={{ display: "flex", flexDirection: "column", height: "100vh", paddingTop: 35, paddingBottom: 24 }}>
          {(isResizingSidebar || isResizingWizard) && (
            <Box style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none' }} />
          )}
          <Group gap={0} h="100%" align="stretch" style={{ flex: 1, overflow: "hidden" }}>
            
            {/* 1. ACTIVITY BAR (LEFT MOST) */}
            <Stack w={50} h="100%" align="center" gap="md" py="md" bg="dark.8" style={{ borderRight: "1px solid var(--mantine-color-dark-6)", flexShrink: 0 }}>
              {[
                { icon: Files, label: "Αρχεία", id: "files" },
                { icon: Search, label: "Αναζήτηση", id: "search" },
                { icon: Database, label: "Βάση Δεδομένων", id: "database" },
                { icon: Wand2, label: "Wizards", id: "wizards" },
              ].map((item) => (
                <Tooltip key={item.id} label={item.label} position="right" withArrow>
                  <ActionIcon 
                    variant={activeActivity === item.id ? "filled" : "subtle"} 
                    color={activeActivity === item.id ? "blue" : "gray"} 
                    size="lg" 
                    onClick={() => setActiveActivity(item.id as SidebarSection)}
                  >
                    <item.icon size={22} strokeWidth={1.5} />
                  </ActionIcon>
                </Tooltip>
              ))}
              <Box style={{ marginTop: "auto" }}><ActionIcon variant="subtle" color="gray" size="lg"><Settings size={22} /></ActionIcon></Box>
            </Stack>

            {/* 2. SIDEBAR CONTENT */}
            <Box w={sidebarWidth} h="100%" style={{ borderRight: "1px solid var(--mantine-color-dark-6)", flexShrink: 0 }}>
              <SidebarContent 
                activeSection={activeActivity} onNavigate={setActiveView} 
                openTabs={tabs} activeTabId={activeTabId} onTabSelect={setActiveTabId}
                projectData={projectData} onOpenFolder={handleOpenFolder} onOpenFileNode={handleOpenFileNode} loadingFiles={loadingFiles}
                dbConnected={dbConnected} dbTables={dbTables} onConnectDB={handleConnectDB} onOpenTable={handleOpenTable}
              />
            </Box>
            <ResizerHandle onMouseDown={startResizeSidebar} isResizing={isResizingSidebar} />
            
            {/* 3. MAIN EDITOR/WIZARD SPLIT */}
            <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
              <Box style={{ flex: 1, minWidth: 200, height: '100%' }}>
                <EditorArea files={tabs} activeFileId={activeTabId} onFileSelect={setActiveTabId} onFileClose={handleCloseTab} onContentChange={handleEditorChange} onMount={handleEditorDidMount} />
              </Box>
              {activeView !== "editor" && (
                <>
                  <ResizerHandle onMouseDown={startResizeWizard} isResizing={isResizingWizard} />
                  <Box w={wizardWidth} h="100%" style={{ flexShrink: 0 }}>
                    {activeView === "wizard-preamble" && <WizardWrapper title="Preamble Wizard" onClose={() => setActiveView("editor")}><PreambleWizard onInsert={handleCreateDocument} /></WizardWrapper>}
                    {activeView === "wizard-table" && <WizardWrapper title="Table Wizard" onClose={() => setActiveView("editor")}><TableWizard onInsert={handleInsertSnippet} /></WizardWrapper>}
                    {activeView === "wizard-tikz" && <WizardWrapper title="TikZ Wizard" onClose={() => setActiveView("editor")}><TikzWizard onInsert={handleInsertSnippet} /></WizardWrapper>}
                  </Box>
                </>
              )}
            </Box>
          </Group>
        </AppShell.Main>
        <AppShell.Footer withBorder={false} p={0}><StatusBar activeFile={tabs.find(f => f.id === activeTabId)} /></AppShell.Footer>
      </AppShell>
    </MantineProvider>
  );
}