import React, { useState } from 'react';
import { 
  Stack, Box, Tooltip, ActionIcon, Group, Text, ScrollArea, Button, Collapse
} from '@mantine/core';
import { 
  Files, Search, Database, Wand2, Settings, MoreVertical, 
  ChevronDown, FileCode, FolderOpen, Folder, Plug, X, Table2
} from 'lucide-react';

// --- Types ---
export type SidebarSection = "files" | "search" | "database" | "wizards";
export type ViewType = "editor" | "wizard-preamble" | "wizard-table" | "wizard-tikz";

export interface AppTab {
  id: string;
  title: string;
  type: 'editor' | 'table';
  content?: string;
  language?: string;
  isDirty?: boolean;
  tableName?: string;
}

export interface FileSystemNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileSystemNode[];
}

interface SidebarProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  activeSection: SidebarSection;
  setActiveSection: (s: SidebarSection) => void;
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
}

// --- Activity Bar Component ---
const ActivityBar = ({
  active,
  setActive,
}: {
  active: SidebarSection;
  setActive: (v: SidebarSection) => void;
}) => {
  const items = [
    { icon: Files, label: "Αρχεία", id: "files" },
    { icon: Search, label: "Αναζήτηση", id: "search" },
    { icon: Database, label: "Βάση Δεδομένων", id: "database" },
    { icon: Wand2, label: "Wizards", id: "wizards" },
  ];

  return (
    <Stack w={50} h="100%" align="center" gap="md" py="md" bg="dark.8" style={{ borderRight: "1px solid var(--mantine-color-dark-6)", flexShrink: 0 }}>
      {items.map((item) => (
        <Tooltip key={item.id} label={item.label} position="right" withArrow>
          <ActionIcon 
            variant={active === item.id ? "filled" : "subtle"} 
            color={active === item.id ? "blue" : "gray"} 
            size="lg" 
            onClick={() => setActive(item.id as SidebarSection)}
          >
            <item.icon size={22} strokeWidth={1.5} />
          </ActionIcon>
        </Tooltip>
      ))}
      <Box style={{ marginTop: "auto" }}><ActionIcon variant="subtle" color="gray" size="lg"><Settings size={22} /></ActionIcon></Box>
    </Stack>
  );
};

// --- Resizer Handle Component ---
const ResizerHandle = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
  <Box
    onMouseDown={onMouseDown}
    w={6}
    h="100%"
    style={{
      cursor: "col-resize",
      zIndex: 50,
      position: 'relative',
      userSelect: 'none',
      backgroundColor: 'transparent',
      transition: "background-color 0.2s",
    }}
    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--mantine-color-blue-6)"}
    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
  />
);

// --- File Tree Item Component ---
const FileTreeItem = ({ 
  node, 
  depth, 
  activeTabId, 
  onOpenFileNode,
  getFileIcon
}: { 
  node: FileSystemNode;
  depth: number;
  activeTabId: string;
  onOpenFileNode: (node: FileSystemNode) => void;
  getFileIcon: (name: string) => React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Box>
      <Group 
        gap={4} py={2} px={8} 
        style={{ paddingLeft: depth * 12 + 8, cursor: 'pointer', userSelect: 'none' }}
        onClick={(e) => {
          e.stopPropagation();
          if (node.type === 'folder') setIsOpen(!isOpen);
          else onOpenFileNode(node);
        }}
        bg={node.type === 'file' && activeTabId === node.path ? 'rgba(51, 154, 240, 0.15)' : 'transparent'}
        c={node.type === 'file' && activeTabId === node.path ? 'blue.3' : 'gray.4'}
      >
        <Box style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s', opacity: node.type === 'folder' ? 1 : 0 }}>
           <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} /> 
           {/* Note: Original code used ChevronRight rotated. Simplified here logic */}
        </Box>
        {node.type === 'folder' ? (isOpen ? <FolderOpen size={14} color="#EADFA5" /> : <Folder size={14} color="#EADFA5" />) : getFileIcon(node.name)}
        <Text size="sm" truncate>{node.name}</Text>
      </Group>
      {node.type === 'folder' && node.children && (
        <Collapse in={isOpen}>
          <Stack gap={0}>
            {node.children
              .sort((a, b) => {
                  if (a.type === b.type) return a.name.localeCompare(b.name);
                  return a.type === 'folder' ? -1 : 1;
              })
              .map(child => <FileTreeItem key={child.id} node={child} depth={depth + 1} activeTabId={activeTabId} onOpenFileNode={onOpenFileNode} getFileIcon={getFileIcon} />)
            }
          </Stack>
        </Collapse>
      )}
    </Box>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  width,
  onResizeStart,
  activeSection,
  setActiveSection,
  onNavigate,
  openTabs,
  activeTabId,
  onTabSelect,
  projectData,
  onOpenFolder,
  onOpenFileNode,
  dbConnected,
  dbTables,
  onConnectDB,
  onOpenTable
}) => {

  const getFileIcon = (_name: string) => {
    // Helper to get icon (moved inside or passed as prop, here simplified logic duplicated from App for self-containment or passed down)
    // For simplicity, we define basic ones here or expect Lucide imports
    return <FileCode size={14} color="#4dabf7" />; 
  };

  return (
    <>
      <ActivityBar active={activeSection} setActive={setActiveSection} />
      
      <Box w={width} h="100%" style={{ borderRight: "1px solid var(--mantine-color-dark-6)", flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
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
            {/* FILES SECTION */}
            {activeSection === "files" && (
              <Stack gap={0}>
                {openTabs.length > 0 && (
                  <>
                    <Group gap={4} py={4} px={6} bg="dark.6"><ChevronDown size={14} /><Text size="xs" fw={700} tt="uppercase">Open Editors</Text></Group>
                    <Stack gap={1} p={4} mb="md">
                      {openTabs.map((t) => (
                        <Group
                          key={t.id} gap={8} pl={16} py={4}
                          style={{ cursor: "pointer", borderRadius: 4, backgroundColor: t.id === activeTabId ? 'var(--mantine-color-blue-9)' : 'transparent' }}
                          onClick={() => onTabSelect(t.id)}
                        >
                          {t.type === 'editor' ? <FileCode size={14} color="#4dabf7" /> : <Table2 size={14} color="#69db7c" />}
                          <Text size="sm" c={t.id === activeTabId ? "white" : "gray.4"} truncate>{t.title}</Text>
                          {t.isDirty && <Box w={6} h={6} bg="white" style={{borderRadius:'50%'}} />}
                        </Group>
                      ))}
                    </Stack>
                  </>
                )}
                <Group gap={4} py={4} px={6} bg="dark.6"><ChevronDown size={14} /><Text size="xs" fw={700} tt="uppercase">Project</Text></Group>
                
                {projectData.length === 0 ? (
                  <Box p="md" ta="center">
                    <Text size="xs" c="dimmed" mb="sm">Δεν έχει ανοίξει φάκελος</Text>
                    <Button size="xs" variant="light" onClick={onOpenFolder}>Άνοιγμα Φακέλου</Button>
                  </Box>
                ) : (
                  <Box>
                    {projectData.map(node => (
                      <FileTreeItem 
                        key={node.id} 
                        node={node} 
                        depth={0} 
                        activeTabId={activeTabId}
                        onOpenFileNode={onOpenFileNode}
                        getFileIcon={getFileIcon}
                      />
                    ))}
                  </Box>
                )}
              </Stack>
            )}

            {/* WIZARDS SECTION */}
            {activeSection === "wizards" && (
              <Stack gap="xs" p="xs">
                <Button variant="light" justify="start" leftSection={<FileCode size={16} />} onClick={() => onNavigate("wizard-preamble")}>Preamble Wizard</Button>
                <Button variant="light" justify="start" leftSection={<Table2 size={16} />} onClick={() => onNavigate("wizard-table")}>Table Generator</Button>
                <Button variant="light" justify="start" leftSection={<Wand2 size={16} />} onClick={() => onNavigate("wizard-tikz")}>TikZ Builder</Button>
              </Stack>
            )}
            
            {/* DATABASE SECTION */}
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
      </Box>
      <ResizerHandle onMouseDown={onResizeStart} />
    </>
  );
};