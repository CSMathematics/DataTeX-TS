import React, { useState, useEffect, useRef } from 'react';
import { Stack, ActionIcon, Tooltip, Text, Group, ScrollArea, Box, Collapse, UnstyledButton, Divider, TextInput, Button } from '@mantine/core';
import { 
  Files, Search, GitBranch, Settings, Database, 
  ChevronRight, FileText, Folder, Table2, 
  PenTool, Wand2, // Puzzle removed from here
  FilePlus, FolderPlus, FolderOpen, ChevronsUpDown, MinusSquare
} from 'lucide-react';
import { IconFolderFilled, IconFileFilled } from '@tabler/icons-react';

// --- Types ---
export type SidebarSection = "files" | "search" | "git" | "database" | "settings";
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
  type: 'editor' | 'table' | 'start-page'; // Added start-page
  content?: string;
  tableName?: string;
  language?: string;
  isDirty?: boolean;
}

interface SidebarProps {
  width: number;
  isOpen: boolean; 
  onResizeStart: (e: React.MouseEvent) => void;
  activeSection: SidebarSection;
  onToggleSection: (s: SidebarSection) => void; 
  onNavigate: (view: ViewType) => void;
  
  // File System Props
  projectData: FileSystemNode[];
  onOpenFolder: () => void;
  onOpenFileNode: (node: FileSystemNode) => void;
  loadingFiles: boolean;
  openTabs: AppTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  
  onCreateItem?: (name: string, type: 'file' | 'folder', parentPath: string) => void;

  dbConnected: boolean;
  dbTables: string[];
  onConnectDB: () => void;
  onOpenTable: (name: string) => void;
}

// --- Helper Components (NewItemInput & FileTreeItem remain same) ---
const NewItemInput = ({ type, onCommit, onCancel }: { type: 'file' | 'folder', onCommit: (name: string) => void, onCancel: () => void }) => {
    const [name, setName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim()) onCommit(name.trim());
        else if (e.key === 'Escape') onCancel();
    };
    return (
        <Group gap={6} wrap="nowrap" px={8} py={4} style={{ paddingLeft: 20 }}>
            {type === 'folder' ? <IconFolderFilled size={16} color="#fab005" /> : <IconFileFilled size={16} color="#4dabf7" />}
            <TextInput 
                ref={inputRef} size="xs" variant="unstyled" value={name}
                onChange={(e) => setName(e.currentTarget.value)} onKeyDown={handleKeyDown} onBlur={onCancel} 
                styles={{ input: { height: 18, minHeight: 18, padding: 0, color: 'white', border: '1px solid #339af0' } }}
                placeholder={type === 'file' ? 'filename.tex' : 'folder_name'}
            />
        </Group>
    );
};

const FileTreeItem = ({ node, level, onSelect, selectedId, onNodeClick, expandSignal, collapseSignal, creatingState, onCommitCreation, onCancelCreation }: any) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;
  const isCreatingHere = creatingState?.parentId === node.id && node.type === 'folder';
  useEffect(() => { if (isCreatingHere) setExpanded(true); }, [isCreatingHere]);
  useEffect(() => { if (expandSignal > 0 && hasChildren) setExpanded(true); }, [expandSignal, hasChildren]);
  useEffect(() => { if (collapseSignal > 0 && hasChildren) setExpanded(false); }, [collapseSignal, hasChildren]);
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); onNodeClick(node);
    if (node.type === 'folder') setExpanded(!expanded);
    else onSelect(node);
  };
  return (
    <>
      <UnstyledButton onClick={handleClick} style={{ width: '100%', padding: '4px 8px', paddingLeft: level * 12 + 8, fontSize: 13, color: selectedId === node.id ? 'white' : '#C1C2C5', backgroundColor: selectedId === node.id ? '#1971c240' : 'transparent', display: 'flex', alignItems: 'center', ':hover': { backgroundColor: '#2C2E33' } }}>
        <Group gap={6} wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
          {node.type === 'folder' && (<Box style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s', display: 'flex' }}><ChevronRight size={10} /></Box>)}
          {node.type === 'folder' ? <IconFolderFilled size={16} color="#fab005" /> : <IconFileFilled size={16} color="#4dabf7" />}
          <Text size="xs" truncate>{node.name}</Text>
        </Group>
      </UnstyledButton>
      <Collapse in={expanded}>
        {node.children && node.children.map((child: any) => (
          <FileTreeItem key={child.id} node={child} level={level + 1} onSelect={onSelect} selectedId={selectedId} onNodeClick={onNodeClick} expandSignal={expandSignal} collapseSignal={collapseSignal} creatingState={creatingState} onCommitCreation={onCommitCreation} onCancelCreation={onCancelCreation} />
        ))}
        {isCreatingHere && creatingState && (<Box pl={(level + 1) * 12 + 8}><NewItemInput type={creatingState.type} onCommit={(name) => onCommitCreation(name, node.path)} onCancel={onCancelCreation}/></Box>)}
      </Collapse>
    </>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  width, isOpen, onResizeStart, activeSection, onToggleSection, onNavigate,
  projectData, onOpenFolder, onOpenFileNode, onCreateItem,
  dbConnected, dbTables, onConnectDB, onOpenTable
}) => {
  
  const [expandAllSignal, setExpandAllSignal] = useState(0);
  const [collapseAllSignal, setCollapseAllSignal] = useState(0);
  const [selectedNode, setSelectedNode] = useState<FileSystemNode | null>(null);
  const [creatingItem, setCreatingItem] = useState<{ type: 'file' | 'folder', parentId: string } | null>(null);

  const handleNodeClick = (node: FileSystemNode) => setSelectedNode(node);

  const handleStartCreation = (type: 'file' | 'folder') => {
    if (projectData.length === 0) return; 
    let parentId = 'root'; 
    if (selectedNode) {
        if (selectedNode.type === 'folder') parentId = selectedNode.id;
        else parentId = 'root';
    }
    setCreatingItem({ type, parentId });
  };

  const handleCommitCreation = (name: string, parentPath: string) => {
    if (onCreateItem) onCreateItem(name, creatingItem!.type, parentPath);
    setCreatingItem(null);
  };

  const getVariant = (section: SidebarSection) => activeSection === section && isOpen ? "light" : "subtle";
  const getColor = (section: SidebarSection) => activeSection === section && isOpen ? "blue" : "gray";

  return (
    <Group gap={0} h="100%" align="stretch" style={{ flexShrink: 0, zIndex: 10 }}>
      {/* Activity Bar */}
      <Stack w={48} h="100%" bg="dark.8" gap={0} justify="space-between" py="md" style={{ borderRight: "1px solid var(--mantine-color-dark-6)", zIndex: 20 }}>
        <Stack gap={4} align="center">
          <Tooltip label="Explorer" position="right">
              <ActionIcon size="lg" variant={getVariant("files")} color={getColor("files")} onClick={() => onToggleSection("files")}><Files size={20} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Search" position="right">
              <ActionIcon size="lg" variant={getVariant("search")} color={getColor("search")} onClick={() => onToggleSection("search")}><Search size={20} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Source Control" position="right">
              <ActionIcon size="lg" variant={getVariant("git")} color={getColor("git")} onClick={() => onToggleSection("git")}><GitBranch size={20} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Database" position="right">
              <ActionIcon size="lg" variant={getVariant("database")} color={getColor("database")} onClick={() => onToggleSection("database")}><Database size={20} /></ActionIcon>
          </Tooltip>
        </Stack>
        <Stack gap={4} align="center">
          <Tooltip label="Settings" position="right">
              <ActionIcon size="lg" variant={getVariant("settings")} color={getColor("settings")} onClick={() => onToggleSection("settings")}><Settings size={20} /></ActionIcon>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Sidebar Content Panel */}
      {isOpen && (
          <>
            <Box w={width} h="100%" bg="dark.7" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Group h={35} px="sm" justify="space-between" bg="dark.8" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)", flexShrink: 0 }}>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">{activeSection}</Text>
                </Group>
                
                <ScrollArea style={{ flex: 1 }} onClick={() => setSelectedNode(null)}> 
                {activeSection === "files" && (
                    <Stack gap={0}>
                        <Box p="xs">
                            <Text size="xs" fw={700} c="dimmed" mb={4}>WIZARDS</Text>
                            <Group gap={4}>
                                <Tooltip label="Preamble"><ActionIcon variant="light" size="sm" color="violet" onClick={() => onNavigate("wizard-preamble")}><Wand2 size={14}/></ActionIcon></Tooltip>
                                <Tooltip label="Table"><ActionIcon variant="light" size="sm" color="green" onClick={() => onNavigate("wizard-table")}><Table2 size={14}/></ActionIcon></Tooltip>
                                <Tooltip label="TikZ/Plots"><ActionIcon variant="light" size="sm" color="orange" onClick={() => onNavigate("wizard-tikz")}><PenTool size={14}/></ActionIcon></Tooltip>
                            </Group>
                        </Box>
                        <Divider my={4} color="dark.6" />
                        
                        <Box>
                            <Group justify="space-between" px="xs" py={4} mb={2} bg="dark.7">
                                <Text size="xs" fw={700} c="dimmed">PROJECT</Text>
                                <Group gap={2}>
                                    <Tooltip label="New File"><ActionIcon variant="subtle" size="xs" color="gray" onClick={(e) => { e.stopPropagation(); handleStartCreation('file'); }}><FilePlus size={14}/></ActionIcon></Tooltip>
                                    <Tooltip label="New Folder"><ActionIcon variant="subtle" size="xs" color="gray" onClick={(e) => { e.stopPropagation(); handleStartCreation('folder'); }}><FolderPlus size={14}/></ActionIcon></Tooltip>
                                    <Tooltip label="Open Folder"><ActionIcon variant="subtle" size="xs" color="gray" onClick={onOpenFolder}><FolderOpen size={14}/></ActionIcon></Tooltip>
                                    <Tooltip label="Expand All"><ActionIcon variant="subtle" size="xs" color="gray" onClick={() => setExpandAllSignal(s => s + 1)}><ChevronsUpDown size={14}/></ActionIcon></Tooltip>
                                    <Tooltip label="Collapse All"><ActionIcon variant="subtle" size="xs" color="gray" onClick={() => setCollapseAllSignal(s => s + 1)}><MinusSquare size={14}/></ActionIcon></Tooltip>
                                </Group>
                            </Group>

                            {projectData.length === 0 ? (
                                <Box p="md" ta="center">
                                    <Text size="xs" c="dimmed" mb="xs">No folder opened</Text>
                                    <Button size="xs" variant="default" onClick={onOpenFolder}>Open Folder</Button>
                                </Box>
                            ) : (
                                <Box>
                                    {projectData.map(node => (
                                        <FileTreeItem 
                                            key={node.id} node={node} level={0} 
                                            onSelect={onOpenFileNode} selectedId={selectedNode?.id || null} onNodeClick={handleNodeClick}
                                            expandSignal={expandAllSignal} collapseSignal={collapseAllSignal} creatingState={creatingItem}
                                            onCommitCreation={handleCommitCreation} onCancelCreation={() => setCreatingItem(null)}
                                        />
                                    ))}
                                    {creatingItem && creatingItem.parentId === 'root' && (
                                        <NewItemInput type={creatingItem.type} onCommit={(name) => handleCommitCreation(name, 'root')} onCancel={() => setCreatingItem(null)} />
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Stack>
                )}
                {/* Database section */}
                {activeSection === "database" && (
                    <Stack p="xs" gap="xs">
                        <Button size="xs" variant={dbConnected ? "light" : "filled"} color={dbConnected ? "green" : "blue"} onClick={onConnectDB} fullWidth>
                            {dbConnected ? "Connected (SQLite)" : "Connect to DB"}
                        </Button>
                        {dbConnected && (
                            <Stack gap={2}>
                                <Text size="xs" c="dimmed" fw={700}>TABLES</Text>
                                {dbTables.map(t => (
                                    <UnstyledButton key={t} onClick={() => onOpenTable(t)} style={{ padding: '4px 8px', fontSize: 13, borderRadius: 4, color: '#C1C2C5', display: 'flex', alignItems: 'center', gap: 8, ':hover': { backgroundColor: '#2C2E33' } }}>
                                        <Table2 size={14} color="#69db7c"/> {t}
                                    </UnstyledButton>
                                ))}
                            </Stack>
                        )}
                    </Stack>
                )}
                </ScrollArea>
            </Box>

            <Box
                onMouseDown={onResizeStart}
                w={4} h="100%" bg="transparent"
                style={{ cursor: "col-resize", ":hover": { backgroundColor: "var(--mantine-color-blue-6)" } }}
            />
          </>
      )}
    </Group>
  );
};