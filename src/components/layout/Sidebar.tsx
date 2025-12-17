import React, { useState } from 'react';
import { Stack, ActionIcon, Tooltip, Text, Group, ScrollArea, Box, Collapse, UnstyledButton, Button } from '@mantine/core';
import { 
  Files, Search, GitBranch, Settings, Database, 
  ChevronRight, FileText, Folder, Table2, 
  PenTool, Wand2, Puzzle // Puzzle icon for Gallery
} from 'lucide-react';

// --- Types ---
export type SidebarSection = "files" | "search" | "git" | "database" | "settings";
// UPDATE: Added 'gallery' to ViewType
export type ViewType = "editor" | "wizard-preamble" | "wizard-table" | "wizard-tikz" | "gallery";

export interface FileSystemNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileSystemNode[];
}

export interface AppTab {
  id: string;
  title: string;
  type: 'editor' | 'table';
  content?: string;
  tableName?: string;
  language?: string;
  isDirty?: boolean;
}

interface SidebarProps {
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  activeSection: SidebarSection;
  setActiveSection: (s: SidebarSection) => void;
  onNavigate: (view: ViewType) => void;
  
  // File System Props
  projectData: FileSystemNode[];
  onOpenFolder: () => void;
  onOpenFileNode: (node: FileSystemNode) => void;
  loadingFiles: boolean;
  openTabs: AppTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;

  // DB Props
  dbConnected: boolean;
  dbTables: string[];
  onConnectDB: () => void;
  onOpenTable: (name: string) => void;
}

// Helper: Recursive File Tree Component
const FileTreeItem = ({ node, level, onSelect }: { node: FileSystemNode, level: number, onSelect: (n: FileSystemNode) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;

  const handleClick = () => {
    if (node.type === 'folder') setExpanded(!expanded);
    else onSelect(node);
  };

  return (
    <>
      <UnstyledButton 
        onClick={handleClick}
        style={{ 
          width: '100%', padding: '4px 8px', 
          paddingLeft: level * 12 + 8,
          fontSize: 13, color: '#C1C2C5',
          display: 'flex', alignItems: 'center',
          ':hover': { backgroundColor: '#2C2E33' }
        }}
      >
        <Group gap={6} wrap="nowrap">
          {node.type === 'folder' && (
             <Box style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }}>
                <ChevronRight size={10} />
             </Box>
          )}
          {node.type === 'folder' ? <Folder size={14} color="#fab005" /> : <FileText size={14} color="#4dabf7" />}
          <Text size="xs" truncate>{node.name}</Text>
        </Group>
      </UnstyledButton>
      {hasChildren && (
        <Collapse in={expanded}>
          {node.children!.map(child => (
            <FileTreeItem key={child.id} node={child} level={level + 1} onSelect={onSelect} />
          ))}
        </Collapse>
      )}
    </>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  width, onResizeStart, activeSection, setActiveSection, onNavigate,
  projectData, onOpenFolder, onOpenFileNode,
  dbConnected, dbTables, onConnectDB, onOpenTable
}) => {
  
  return (
    <Group gap={0} h="100%" align="stretch" style={{ flexShrink: 0, zIndex: 10 }}>
      {/* Activity Bar (Icons) */}
      <Stack w={48} h="100%" bg="dark.8" gap={0} justify="space-between" py="md" style={{ borderRight: "1px solid var(--mantine-color-dark-6)" }}>
        <Stack gap={4} align="center">
          <Tooltip label="Explorer" position="right"><ActionIcon size="lg" variant={activeSection === "files" ? "light" : "subtle"} onClick={() => setActiveSection("files")}><Files size={20} /></ActionIcon></Tooltip>
          <Tooltip label="Search" position="right"><ActionIcon size="lg" variant={activeSection === "search" ? "light" : "subtle"} onClick={() => setActiveSection("search")}><Search size={20} /></ActionIcon></Tooltip>
          <Tooltip label="Source Control" position="right"><ActionIcon size="lg" variant={activeSection === "git" ? "light" : "subtle"} onClick={() => setActiveSection("git")}><GitBranch size={20} /></ActionIcon></Tooltip>
          <Tooltip label="Database" position="right"><ActionIcon size="lg" variant={activeSection === "database" ? "light" : "subtle"} onClick={() => setActiveSection("database")}><Database size={20} /></ActionIcon></Tooltip>
        </Stack>
        <Stack gap={4} align="center">
          <Tooltip label="Settings" position="right"><ActionIcon size="lg" variant={activeSection === "settings" ? "light" : "subtle"} onClick={() => setActiveSection("settings")}><Settings size={20} /></ActionIcon></Tooltip>
        </Stack>
      </Stack>

      {/* Sidebar Content Panel */}
      <Box w={width} h="100%" bg="dark.7" style={{ display: 'flex', flexDirection: 'column' }}>
        <Group h={35} px="sm" justify="space-between" bg="dark.8" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)" }}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">{activeSection}</Text>
        </Group>
        
        <ScrollArea style={{ flex: 1 }}>
          {activeSection === "files" && (
            <Stack gap={0}>
                {/* WIZARDS SHORTCUTS */}
                <Box p="xs">
                    <Text size="xs" fw={700} c="dimmed" mb={4}>WIZARDS</Text>
                    <Group gap={4}>
                        <Tooltip label="Preamble"><ActionIcon variant="light" size="sm" color="violet" onClick={() => onNavigate("wizard-preamble")}><Wand2 size={14}/></ActionIcon></Tooltip>
                        <Tooltip label="Table"><ActionIcon variant="light" size="sm" color="green" onClick={() => onNavigate("wizard-table")}><Table2 size={14}/></ActionIcon></Tooltip>
                        <Tooltip label="TikZ/Plots"><ActionIcon variant="light" size="sm" color="orange" onClick={() => onNavigate("wizard-tikz")}><PenTool size={14}/></ActionIcon></Tooltip>
                        {/* Added Gallery Button */}
                        <Tooltip label="Package Gallery"><ActionIcon variant="light" size="sm" color="blue" onClick={() => onNavigate("gallery")}><Puzzle size={14}/></ActionIcon></Tooltip>
                    </Group>
                </Box>
                <Divider my={4} color="dark.6" />
                
                {/* FILE TREE */}
                <Box>
                    <Group justify="space-between" px="xs" py={4}>
                        <Text size="xs" fw={700} c="dimmed">PROJECT</Text>
                    </Group>
                    {projectData.length === 0 ? (
                        <Box p="md" ta="center">
                            <Button size="xs" variant="default" onClick={onOpenFolder}>Open Folder</Button>
                        </Box>
                    ) : (
                        projectData.map(node => <FileTreeItem key={node.id} node={node} level={0} onSelect={onOpenFileNode} />)
                    )}
                </Box>
            </Stack>
          )}

          {activeSection === "database" && (
             <Stack p="xs" gap="xs">
                <Button size="xs" variant={dbConnected ? "light" : "filled"} color={dbConnected ? "green" : "blue"} onClick={onConnectDB} fullWidth>
                    {dbConnected ? "Connected (SQLite)" : "Connect to DB"}
                </Button>
                {dbConnected && (
                    <Stack gap={2}>
                        <Text size="xs" c="dimmed" fw={700}>TABLES</Text>
                        {dbTables.map(t => (
                            <UnstyledButton 
                                key={t} 
                                onClick={() => onOpenTable(t)}
                                style={{ 
                                    padding: '4px 8px', fontSize: 13, borderRadius: 4,
                                    color: '#C1C2C5', display: 'flex', alignItems: 'center', gap: 8,
                                    ':hover': { backgroundColor: '#2C2E33' } 
                                }}
                            >
                                <Table2 size={14} color="#69db7c"/> {t}
                            </UnstyledButton>
                        ))}
                    </Stack>
                )}
             </Stack>
          )}
        </ScrollArea>
      </Box>

      {/* Resize Handle */}
      <Box
        onMouseDown={onResizeStart}
        w={4} h="100%" bg="transparent"
        style={{ cursor: "col-resize", ":hover": { backgroundColor: "var(--mantine-color-blue-6)" } }}
      />
    </Group>
  );
};

// Required Divider import missing in main code block fix
import { Divider } from '@mantine/core';