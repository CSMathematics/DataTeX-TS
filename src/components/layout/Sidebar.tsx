import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Stack, ActionIcon, Tooltip, Text, Group, ScrollArea, Box, Collapse, UnstyledButton, Divider, TextInput, Button, Menu, NavLink } from '@mantine/core';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy, faSearch, faCodeBranch, faCog, faDatabase,
  faChevronRight, faChevronDown, faTable,
  faPenNib, faWandMagicSparkles,
  faFileCirclePlus, faFolderPlus, faFolderOpen, faMinusSquare,
  faFileCode, faBookOpen, faImage, faTrash, faPen,
  faFolder, faFile, faFilePdf, faSquareRootAlt, faCube,
  faPalette, faCalculator, faLayerGroup, faCode, faBoxOpen, faPlus,
  faExpand, faCompress, faList, faAnchor
} from "@fortawesome/free-solid-svg-icons";

// DnD Kit Imports
import { useDraggable, useDroppable } from '@dnd-kit/core';

import { SymbolSidebar } from './SymbolSidebar';
import { SymbolPanel } from './SymbolPanel';
import { SymbolCategory } from '../wizards/preamble/SymbolDB';
import { PACKAGES_DB, Category } from '../wizards/preamble/packages';
import { DatabaseSidebar } from '../database/DatabaseSidebar';

// --- Types ---
export type SidebarSection = "files" | "search" | "git" | "database" | "settings" | "symbols" | "gallery" | "outline";
export type ViewType = "editor" | "wizard-preamble" | "wizard-table" | "wizard-tikz" | "wizard-fancyhdr" | "gallery" | "settings" | "database";

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
  type: 'editor' | 'table' | 'start-page' | 'settings' | 'wizard';
  content?: string;
  tableName?: string;
  language?: string;
  isDirty?: boolean;
}

interface SidebarProps {
  width: number | string;
  isOpen: boolean; 
  onResizeStart: (e: React.MouseEvent) => void;
  activeSection: SidebarSection;
  onToggleSection: (s: SidebarSection) => void; 
  onNavigate: (view: ViewType) => void;
  
  // File System Props
  projectData: FileSystemNode[];
  onOpenFolder: () => void;
  onAddFolder?: () => void;
  onRemoveFolder?: (path: string) => void;
  onOpenFileNode: (node: FileSystemNode) => void;
  loadingFiles: boolean;
  openTabs: AppTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  
  onCreateItem?: (name: string, type: 'file' | 'folder', parentPath: string) => void;
  onRenameItem?: (node: FileSystemNode, newName: string) => void;
  onDeleteItem?: (node: FileSystemNode) => void;
  onMoveItem?: (sourcePath: string, targetPath: string) => void;

  dbConnected: boolean;
  dbTables: string[];
  onConnectDB: () => void;
  onOpenTable: (name: string) => void;

  onInsertSymbol?: (code: string) => void;
  activePackageId?: string;
  onSelectPackage?: (id: string) => void;

  outlineSource?: string;
  onScrollToLine?: (line: number) => void;
}

// --- Icons Helper ---
const getFileIcon = (name: string, type: 'file' | 'folder', expanded: boolean = false) => {
    if (type === 'folder') {
        return <FontAwesomeIcon icon={expanded ? faFolderOpen : faFolder} style={{ width: 16, height: 16, color: "#fab005" }} />;
    }
    const ext = name.split('.').pop()?.toLowerCase();
    switch(ext) {
        case 'tex': return <FontAwesomeIcon icon={faFileCode} style={{ width: 16, height: 16, color: "#4dabf7" }} />;
        case 'bib': return <FontAwesomeIcon icon={faBookOpen} style={{ width: 16, height: 16, color: "#fab005" }} />;
        case 'sty': return <FontAwesomeIcon icon={faCog} style={{ width: 16, height: 16, color: "#be4bdb" }} />;
        case 'pdf': return <FontAwesomeIcon icon={faFilePdf} style={{ width: 16, height: 16, color: "#fa5252" }} />;
        case 'png':
        case 'jpg':
        case 'jpeg': return <FontAwesomeIcon icon={faImage} style={{ width: 16, height: 16, color: "#40c057" }} />;
        default: return <FontAwesomeIcon icon={faFile} style={{ width: 16, height: 16, color: "#868e96" }} />;
    }
};

// --- Helper Components ---
const NewItemInput = ({ type, onCommit, onCancel, defaultValue = '' }: { type: 'file' | 'folder', onCommit: (name: string) => void, onCancel: () => void, defaultValue?: string }) => {
    const [name, setName] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && name.trim()) onCommit(name.trim());
        else if (e.key === 'Escape') onCancel();
    };
    return (
        <Group gap={6} wrap="nowrap" px={8} py={4} style={{ paddingLeft: 20 }}>
            {type === 'folder' ? <FontAwesomeIcon icon={faFolder} style={{ width: 16, height: 16, color: "#fab005" }} /> : <FontAwesomeIcon icon={faFile} style={{ width: 16, height: 16, color: "#4dabf7" }} />}
            <TextInput 
                ref={inputRef} size="xs" variant="unstyled" value={name}
                onChange={(e) => setName(e.currentTarget.value)} onKeyDown={handleKeyDown} onBlur={onCancel} 
                styles={{ input: { height: 18, minHeight: 18, padding: 0, color: 'var(--mantine-color-text)', border: '1px solid var(--mantine-primary-color-filled)' } }}
                placeholder={type === 'file' ? 'filename.tex' : 'folder_name'}
            />
        </Group>
    );
};

// --- DnD Draggable Item ---
const FileTreeItem = ({
    node, level, onSelect, selectedId, onNodeClick,
    expandSignal, collapseSignal, creatingState, onCommitCreation, onCancelCreation,
    onRename, onDelete, onCreateRequest, onRemoveFolder
}: any) => {
  const isRoot = level === 0;
  const [expanded, setExpanded] = useState(isRoot); // Roots start expanded
  const [isRenaming, setIsRenaming] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);

  // DnD Hooks
  const { attributes, listeners, setNodeRef: setDragNodeRef, isDragging } = useDraggable({
    id: node.id,
    data: { node }
  });

  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: node.id,
    data: { node },
    disabled: node.type !== 'folder'
  });

  const isCreatingHere = creatingState?.parentId === node.id && node.type === 'folder';

  useEffect(() => { if (isCreatingHere) setExpanded(true); }, [isCreatingHere]);
  useEffect(() => { if (expandSignal > 0) setExpanded(true); }, [expandSignal]);
  useEffect(() => { if (collapseSignal > 0) setExpanded(false); }, [collapseSignal]);

  // LEFT CLICK: Select / Expand only
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling so Menu.Target doesn't see it (if trigger="click")
    
    if (isRenaming) return;
    onNodeClick(node);
    if (node.type === 'folder') setExpanded(!expanded);
    else onSelect(node);
  };

  // RIGHT CLICK: Open Menu only
  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); 
      setMenuOpened(true); // Manually open the menu
  };

  if (isRenaming) {
      return (
          <Box pl={level * 12 + 8} py={4}>
            <NewItemInput
                type={node.type} defaultValue={node.name}
                onCommit={(newName) => { setIsRenaming(false); onRename(node, newName); }}
                onCancel={() => setIsRenaming(false)}
            />
          </Box>
      );
  }

  // Styles based on level/root status
  const paddingLeft = isRoot ? 8 : (level * 12 + 8);
  const bgColor = isRoot 
      ? 'var(--app-header-bg)' 
      : (selectedId === node.id ? 'var(--mantine-primary-color-light)' : 'transparent');
  const textColor = selectedId === node.id ? 'var(--mantine-primary-color-text)' : 'var(--mantine-color-text)';
  const fontWeight = isRoot ? 700 : 400;
  const borderBottom = isRoot ? '1px solid var(--mantine-color-default-border)' : 'none';

  // Highlight drop target
  const dropStyle = isOver ? { backgroundColor: 'var(--mantine-color-blue-1)', border: '1px dashed var(--mantine-primary-color-filled)' } : {};

  return (
    <Box ref={setDropNodeRef} style={dropStyle}>
      <Menu shadow="md" width={200} opened={menuOpened} onChange={setMenuOpened} trigger="click">
        <Menu.Target>
            <Box style={{ width: '100%', opacity: isDragging ? 0.5 : 1 }}>
                <UnstyledButton
                    ref={setDragNodeRef}
                    {...listeners} {...attributes}
                    onClick={handleClick}        // Left click logic
                    onContextMenu={handleContextMenu} // Right click logic
                    style={{
                        width: '100%', 
                        padding: isRoot ? '8px 8px' : '4px 8px', 
                        paddingLeft: paddingLeft,
                        fontSize: 13,
                        color: textColor,
                        backgroundColor: bgColor,
                        borderBottom: borderBottom,
                        fontWeight: fontWeight,
                        display: 'flex', 
                        alignItems: 'center',
                        transition: 'background-color 0.2s',
                        ':hover': { backgroundColor: 'var(--mantine-color-default-hover)' }
                    }}
                >
                    <Group gap={isRoot ? 8 : 6} wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
                        {node.type === 'folder' && (
                            <Box style={{ 
                                transform: expanded ? (isRoot ? 'rotate(0deg)' : 'rotate(90deg)') : (isRoot ? 'rotate(-90deg)' : 'none'), 
                                transition: 'transform 0.2s', 
                                display: 'flex', opacity: 0.7
                            }}>
                                <FontAwesomeIcon icon={isRoot ? faChevronDown : faChevronRight} style={{ width: 10, height: 10 }} />
                            </Box>
                        )}
                        
                        {isRoot ? (
                            <FontAwesomeIcon icon={faBoxOpen} style={{ width: 14, height: 14, color: "var(--mantine-primary-color-filled)" }} />
                        ) : (
                            getFileIcon(node.name, node.type, expanded)
                        )}
                        
                        <Text size={isRoot ? "xs" : "xs"} truncate fw={isRoot ? 700 : 400} tt={isRoot ? "uppercase" : "none"}>
                            {node.name}
                        </Text>
                    </Group>
                </UnstyledButton>
            </Box>
        </Menu.Target>

        <Menu.Dropdown onContextMenu={(e) => e.preventDefault()}>
            <Menu.Label>{node.name}</Menu.Label>
            {node.type === 'folder' && (
                <>
                    <Menu.Item leftSection={<FontAwesomeIcon icon={faFileCirclePlus} style={{ width: 14, height: 14 }} />} onClick={() => onCreateRequest('file', node.id)}>New File</Menu.Item>
                    <Menu.Item leftSection={<FontAwesomeIcon icon={faFolderPlus} style={{ width: 14, height: 14 }} />} onClick={() => onCreateRequest('folder', node.id)}>New Folder</Menu.Item>
                    <Menu.Divider />
                </>
            )}
            {/* Root specific actions */}
            {isRoot && onRemoveFolder && (
                 <>
                    <Menu.Item color="orange" leftSection={<FontAwesomeIcon icon={faMinusSquare} style={{ width: 14, height: 14 }} />} onClick={() => onRemoveFolder(node.path)}>Remove Project Folder</Menu.Item>
                    <Menu.Divider />
                 </>
            )}
            {/* Standard file/folder actions */}
            {!isRoot && (
                <>
                    <Menu.Item leftSection={<FontAwesomeIcon icon={faPen} style={{ width: 14, height: 14 }} />} onClick={() => setIsRenaming(true)}>Rename</Menu.Item>
                    <Menu.Item leftSection={<FontAwesomeIcon icon={faCopy} style={{ width: 14, height: 14 }} />} onClick={() => navigator.clipboard.writeText(node.path)}>Copy Path</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item leftSection={<FontAwesomeIcon icon={faTrash} style={{ width: 14, height: 14 }} />} color="red" onClick={() => onDelete(node)}>Delete</Menu.Item>
                </>
            )}
        </Menu.Dropdown>
      </Menu>

      <Collapse in={expanded}>
        {node.children && node.children.map((child: any) => (
          <FileTreeItem
            key={child.id} node={child} level={level + 1}
            onSelect={onSelect} selectedId={selectedId} onNodeClick={onNodeClick}
            expandSignal={expandSignal} collapseSignal={collapseSignal}
            creatingState={creatingState} onCommitCreation={onCommitCreation} onCancelCreation={onCancelCreation}
            onRename={onRename} onDelete={onDelete} onCreateRequest={onCreateRequest}
            onRemoveFolder={onRemoveFolder}
          />
        ))}
        {isCreatingHere && creatingState && (
            <Box pl={(level + 1) * 12 + 8}>
                <NewItemInput type={creatingState.type} onCommit={(name) => onCommitCreation(name, node.path)} onCancel={onCancelCreation}/>
            </Box>
        )}
      </Collapse>
    </Box>
  );
};

// --- Outline View Component ---
interface OutlineNode {
    id: string;
    title: string;
    level: number;
    lineNumber: number;
    children: OutlineNode[];
}

const OutlineView = ({ content, onNavigate }: { content: string, onNavigate: (line: number) => void }) => {
    const outline = useMemo(() => {
        const lines = content.split('\n');
        const regex = /\\(chapter|section|subsection|subsubsection|label)\*?(?:\[.*?\])?\{(.+?)\}/;
        const nodes: OutlineNode[] = [];

        lines.forEach((line, index) => {
            const match = line.match(regex);
            if (match) {
                const type = match[1];
                const title = match[2];
                let level = 0;

                if (type === 'chapter') level = 1;
                else if (type === 'section') level = 2;
                else if (type === 'subsection') level = 3;
                else if (type === 'subsubsection') level = 4;
                else if (type === 'label') level = 5; // Treat labels as deeper or special

                const newNode: OutlineNode = {
                    id: `${index}-${title}`,
                    title: type === 'label' ? `Label: ${title}` : title,
                    level,
                    lineNumber: index + 1,
                    children: []
                };

                // Simple flat list for now, or build tree
                // Let's stick to a flat list with indentation for simplicity and robustness
                nodes.push(newNode);
            }
        });
        return nodes;
    }, [content]);

    if (outline.length === 0) {
        return <Box p="md"><Text size="sm" c="dimmed">No structure found.</Text></Box>;
    }

    return (
        <Stack gap={0} p="xs">
            {outline.map((node) => (
                <UnstyledButton
                    key={node.id}
                    onClick={() => onNavigate(node.lineNumber)}
                    style={{
                        padding: '4px 8px',
                        paddingLeft: (node.level - 1) * 12 + 8,
                        fontSize: 13,
                        color: 'var(--mantine-color-text)',
                        borderRadius: 4,
                        ':hover': { backgroundColor: 'var(--mantine-color-default-hover)' }
                    }}
                >
                    <Group gap={6}>
                        {node.title.startsWith('Label:') ?
                             <FontAwesomeIcon icon={faAnchor} style={{ width: 10, height: 10, color: "gray" }} /> :
                             <Text size="xs" fw={700} c="dimmed">H{node.level}</Text>
                        }
                        <Text size="xs" truncate>{node.title.replace('Label: ', '')}</Text>
                    </Group>
                </UnstyledButton>
            ))}
        </Stack>
    );
};

export const Sidebar = React.memo<SidebarProps>(({
  width, isOpen, onResizeStart, activeSection, onToggleSection, onNavigate,
  projectData, onOpenFolder, onAddFolder, onRemoveFolder, onOpenFileNode, onCreateItem, onRenameItem, onDeleteItem,
  onInsertSymbol,
  activePackageId, onSelectPackage,
  outlineSource, onScrollToLine
}) => {
  
  // --- Global Expand/Collapse State ---
  const [expandAllSignal, setExpandAllSignal] = useState(0);
  const [collapseAllSignal, setCollapseAllSignal] = useState(0);
  const [isToggleExpanded, setIsToggleExpanded] = useState(false);

  const [selectedNode, setSelectedNode] = useState<FileSystemNode | null>(null);
  const [creatingItem, setCreatingItem] = useState<{ type: 'file' | 'folder', parentId: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSymbolCategory, setActiveSymbolCategory] = useState<SymbolCategory | null>('greek');

  // --- Memoized Handlers ---
  const handleNodeClick = useCallback((node: FileSystemNode) => setSelectedNode(node), []);
  const handleCancelCreation = useCallback(() => setCreatingItem(null), []);
  const handleClearSelected = useCallback(() => setSelectedNode(null), []);
  const handleClearSearch = useCallback(() => setSearchQuery(''), []);

  const handleStartCreation = useCallback((type: 'file' | 'folder', specificParentId?: string) => {
    if (projectData.length === 0) return; 
    let parentId = specificParentId;
    if (!parentId) {
        if (selectedNode) {
            if (selectedNode.type === 'folder') parentId = selectedNode.id;
            else {
                 const separator = selectedNode.path.includes('\\') ? '\\' : '/';
                 parentId = selectedNode.path.substring(0, selectedNode.path.lastIndexOf(separator));
            }
        } else {
            parentId = projectData[0].id;
        }
    }
    if (parentId) setCreatingItem({ type, parentId });
  }, [projectData, selectedNode]);

  const handleCommitCreation = useCallback((name: string, parentPath: string) => {
    if (onCreateItem && creatingItem) onCreateItem(name, creatingItem.type, parentPath);
    setCreatingItem(null);
  }, [onCreateItem, creatingItem]);

  const handleToggleExpand = useCallback(() => {
      if (isToggleExpanded) {
          setCollapseAllSignal(prev => prev + 1);
      } else {
          setExpandAllSignal(prev => prev + 1);
      }
      setIsToggleExpanded(prev => !prev);
  }, [isToggleExpanded]);

  const getVariant = useCallback((section: SidebarSection) => activeSection === section && isOpen ? "light" : "subtle", [activeSection, isOpen]);
  const getColor = useCallback((section: SidebarSection) => activeSection === section && isOpen ? "blue" : "gray.7", [activeSection, isOpen]);

  const filterNodes = (nodes: FileSystemNode[], query: string): FileSystemNode[] => {
      if (!query) return nodes;
      return nodes.reduce((acc: FileSystemNode[], node) => {
          const matches = node.name.toLowerCase().includes(query.toLowerCase());
          let children: FileSystemNode[] = [];
          if (node.children) children = filterNodes(node.children, query);
          if (matches || children.length > 0) acc.push({ ...node, children });
          return acc;
      }, []);
  };

  const displayNodes = useMemo(() => {
    if (activeSection !== 'files') return [];
    return searchQuery ? filterNodes(projectData, searchQuery) : projectData;
  }, [projectData, searchQuery, activeSection]);

  useEffect(() => {
      if (searchQuery) setExpandAllSignal(prev => prev + 1);
  }, [searchQuery]);

  const packageCategories: Record<string, React.ReactNode> = {
    'colors': <FontAwesomeIcon icon={faPalette} style={{ width: 16, height: 16 }} />,
    'math': <FontAwesomeIcon icon={faCalculator} style={{ width: 16, height: 16 }} />,
    'graphics': <FontAwesomeIcon icon={faImage} style={{ width: 16, height: 16 }} />,
    'tables': <FontAwesomeIcon icon={faTable} style={{ width: 16, height: 16 }} />,
    'code': <FontAwesomeIcon icon={faCode} style={{ width: 16, height: 16 }} />,
    'layout': <FontAwesomeIcon icon={faLayerGroup} style={{ width: 16, height: 16 }} />,
    'misc': <FontAwesomeIcon icon={faBoxOpen} style={{ width: 16, height: 16 }} />
  };

  return (
    <Group gap={0} h="100%" align="stretch" style={{ flexShrink: 0, zIndex: 10 }}>
      {/* Activity Bar */}
      <Stack w={48} h="100%" gap={0} justify="space-between" py="md" style={{ backgroundColor: "var(--app-sidebar-bg)", borderRight: "1px solid var(--mantine-color-default-border)", zIndex: 20 }}>
        <Stack gap={4} align="center">
          <Tooltip label="Explorer" position="right">
              <ActionIcon size="md" variant={getVariant("files")} color={getColor("files")} onClick={() => onToggleSection("files")}><FontAwesomeIcon icon={faFile} style={{ width: 20, height: 20 }} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Structure" position="right">
              <ActionIcon size="md" variant={getVariant("outline")} color={getColor("outline")} onClick={() => onToggleSection("outline")}><FontAwesomeIcon icon={faList} style={{ width: 20, height: 20 }} /></ActionIcon>
          </Tooltip>
          <Tooltip label="AMS Symbols" position="right">
              <ActionIcon size="md" variant={getVariant("symbols")} color={getColor("symbols")} onClick={() => onToggleSection("symbols")}><FontAwesomeIcon icon={faSquareRootAlt} style={{ width: 20, height: 20 }} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Package Gallery" position="right">
              <ActionIcon size="md" variant={getVariant("gallery")} color={getColor("gallery")} onClick={() => onToggleSection("gallery")}><FontAwesomeIcon icon={faCube} style={{ width: 20, height: 20 }} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Search" position="right">
              <ActionIcon size="md" variant={getVariant("search")} color={getColor("search")} onClick={() => onToggleSection("search")}><FontAwesomeIcon icon={faSearch} style={{ width: 20, height: 20 }} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Source Control" position="right">
              <ActionIcon size="md" variant={getVariant("git")} color={getColor("git")} onClick={() => onToggleSection("git")}><FontAwesomeIcon icon={faCodeBranch} style={{ width: 20, height: 20 }} /></ActionIcon>
          </Tooltip>
          <Tooltip label="Database" position="right">
              <ActionIcon size="md" variant={getVariant("database")} color={getColor("database")} onClick={() => onToggleSection("database")}><FontAwesomeIcon icon={faDatabase} style={{ width: 20, height: 20 }} /></ActionIcon>
          </Tooltip>
        </Stack>
        <Stack gap={4} align="center">
          <Tooltip label="Settings" position="right">
              <ActionIcon size="lg" variant={getVariant("settings")} color={getColor("settings")} onClick={() => onToggleSection("settings")}><FontAwesomeIcon icon={faCog} style={{ width: 20, height: 20 }} /></ActionIcon>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Sidebar Content Panel with Transition */}
      <>
        <Box 
            w={isOpen ? width : 0} 
            h="100%" 
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden', 
                backgroundColor: 'var(--app-sidebar-bg)',
                /* TRANSITION STYLES */
                minWidth: 0, 
                flexShrink: 0,
                transition: "width 300ms ease-in-out, opacity 200ms ease-in-out",
                opacity: isOpen ? 1 : 0,
                whiteSpace: "nowrap"
            }}
        >
            {activeSection !== "symbols" && (
                <Group h={35} px="sm" justify="space-between" style={{ backgroundColor: "var(--app-header-bg)", borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}>
                    <Text size="xs" fw={700} tt="uppercase" c="dimmed">{activeSection}</Text>
                </Group>
            )}
            
            {activeSection === "symbols" ? (
                <Group h="100%" gap={0} align="stretch" style={{ overflow: 'hidden' }}>
                    <SymbolSidebar activeCategory={activeSymbolCategory} onSelectCategory={setActiveSymbolCategory} />
                    {activeSymbolCategory ? (
                         <Box style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                             <SymbolPanel category={activeSymbolCategory} onInsert={(code) => onInsertSymbol && onInsertSymbol(code)} width="100%" />
                         </Box>
                    ) : (
                        <Box p="md" style={{ flex: 1 }}><Text c="dimmed" size="sm" ta="center">Select a category</Text></Box>
                    )}
                </Group>
            ) : (
            <ScrollArea style={{ flex: 1 }} onClick={handleClearSelected}> 
                {activeSection === "files" && (
                        <Stack gap={0}>
                            <Box p="xs">
                                <Text size="xs" fw={700} c="dimmed" mb={4}>QUICK TOOLS</Text>
                                <Group gap={4}>
                                    <Tooltip label="Preamble Wizard"><ActionIcon variant="light" size="sm" color="violet" onClick={() => onNavigate("wizard-preamble")}><FontAwesomeIcon icon={faWandMagicSparkles} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                                    <Tooltip label="Table Wizard"><ActionIcon variant="light" size="sm" color="green" onClick={() => onNavigate("wizard-table")}><FontAwesomeIcon icon={faTable} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                                    <Tooltip label="TikZ/Plots"><ActionIcon variant="light" size="sm" color="orange" onClick={() => onNavigate("wizard-tikz")}><FontAwesomeIcon icon={faPenNib} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                                </Group>
                            </Box>
                            <Divider my={4} color="default-border" />

                            <Box>
                                <Stack gap={4} px={0} mb="xs">
                                    <Group justify="space-between" px="xs" py={4} style={{ backgroundColor: "var(--app-header-bg)" }}>
                                        <Text size="xs" fw={700} c="dimmed">EXPLORER</Text>
                                        <Group gap={2}>
                                            <Tooltip label="New File"><ActionIcon variant="subtle" size="xs" color="gray" onClick={(e) => { e.stopPropagation(); handleStartCreation('file'); }}><FontAwesomeIcon icon={faFileCirclePlus} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                                            <Tooltip label="New Folder"><ActionIcon variant="subtle" size="xs" color="gray" onClick={(e) => { e.stopPropagation(); handleStartCreation('folder'); }}><FontAwesomeIcon icon={faFolderPlus} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                                            <Tooltip label="Add Project Folder"><ActionIcon variant="subtle" size="xs" color="gray" onClick={onAddFolder}><FontAwesomeIcon icon={faPlus} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>

                                            {/* TOGGLE EXPAND/COLLAPSE */}
                                            <Tooltip label={isToggleExpanded ? "Collapse All" : "Expand All"}>
                                                <ActionIcon variant="subtle" size="xs" color="gray" onClick={handleToggleExpand}>
                                                    <FontAwesomeIcon icon={isToggleExpanded ? faCompress : faExpand} style={{ width: 14, height: 14 }} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Group>
                                    <Box px="xs">
                                        <TextInput
                                            placeholder="Filter files..." size="xs"
                                            value={searchQuery} onChange={(e) => setSearchQuery(e.currentTarget.value)}
                                            rightSection={searchQuery && <ActionIcon size="xs" variant="transparent" onClick={handleClearSearch}><FontAwesomeIcon icon={faMinusSquare} style={{ width: 10, height: 10 }} /></ActionIcon>}
                                        />
                                    </Box>
                                </Stack>

                                {projectData.length === 0 ? (
                                    <Box p="md" ta="center">
                                        <Text size="xs" c="dimmed" mb="xs">No folder opened</Text>
                                        <Group justify="center">
                                            <Button size="xs" variant="default" onClick={onOpenFolder}>Open Folder</Button>
                                        </Group>
                                    </Box>
                                ) : (
                                    <Box>
                                        {displayNodes.map(node => (
                                            <FileTreeItem
                                                key={node.id}
                                                node={node}
                                                level={0}
                                                onSelect={onOpenFileNode} selectedId={selectedNode?.id || null} onNodeClick={handleNodeClick}
                                                expandSignal={expandAllSignal} collapseSignal={collapseAllSignal} creatingState={creatingItem}
                                                onCommitCreation={handleCommitCreation} onCancelCreation={handleCancelCreation}
                                                onRename={onRenameItem} onDelete={onDeleteItem} onCreateRequest={handleStartCreation}
                                                onRemoveFolder={onRemoveFolder}
                                            />
                                        ))}
                                    </Box>
                                )}
                            </Box>
                        </Stack>
                )}

                {activeSection === "outline" && (
                    <OutlineView content={outlineSource || ''} onNavigate={onScrollToLine || (() => {})} />
                )}

                {/* Database & Gallery sections */}
                {activeSection === "database" && (
                     <DatabaseSidebar />
                )}
                {activeSection === "gallery" && (
                    <Stack gap={4} p="xs">
                        {(Object.keys(packageCategories) as Category[]).map(cat => {
                            const pkgs = PACKAGES_DB.filter(p => p.category === cat);
                            if (pkgs.length === 0) return null;
                            return (
                                <Box key={cat} mb="sm">
                                    <Group gap="xs" px="xs" mb={4}>
                                        {packageCategories[cat]}
                                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">{cat}</Text>
                                    </Group>
                                    {pkgs.map(pkg => (
                                        <NavLink
                                            key={pkg.id}
                                            label={pkg.name}
                                            description={<Text size="xs" truncate>{pkg.description}</Text>}
                                            onClick={() => { if(onSelectPackage) onSelectPackage(pkg.id); onNavigate('gallery'); }}
                                            active={pkg.id === activePackageId}
                                            variant="light" style={{ borderRadius: 4 }}
                                        />
                                    ))}
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </ScrollArea>
            )}
        </Box>

        {/* Resizer Handle - Visible only when sidebar is effectively open */}
        {isOpen && (
            <Box
                onMouseDown={onResizeStart}
                w={4} h="100%" bg="transparent"
                style={{ cursor: "col-resize", ":hover": { backgroundColor: "var(--mantine-primary-color-6)" } }}
            />
        )}
      </>
    </Group>
  );
});