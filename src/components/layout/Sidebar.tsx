import React, { useState, useMemo, useCallback } from 'react';
import { Stack, ActionIcon, Tooltip, Text, Group, ScrollArea, Box, UnstyledButton, NavLink } from '@mantine/core';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch, faCodeBranch, faCog, faDatabase, faTable,
  faSquareRootAlt, faCube,
  faPalette, faCalculator, faLayerGroup, faCode, faBoxOpen,
  faList, faAnchor, faImage
} from "@fortawesome/free-solid-svg-icons";

import { SymbolSidebar } from './SymbolSidebar';
import { SymbolPanel } from './SymbolPanel';
import { SymbolCategory } from '../wizards/preamble/SymbolDB';
import { PACKAGES_DB, Category } from '../wizards/preamble/packages';
import { DatabaseSidebar } from '../database/DatabaseSidebar';

// --- Types ---
export type SidebarSection = "search" | "git" | "database" | "settings" | "symbols" | "gallery" | "outline";
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

// Re-export getFileIcon from shared components for backward compatibility
export { getFileIcon } from '../shared/tree';


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
  onOpenFolder, onRemoveFolder, onOpenFileNode, onCreateItem, onRenameItem, onDeleteItem,
  onInsertSymbol,
  activePackageId, onSelectPackage,
  outlineSource, onScrollToLine
}) => {
  // --- Local State ---
  const [activeSymbolCategory, setActiveSymbolCategory] = useState<SymbolCategory | null>('greek');

  const getVariant = useCallback((section: SidebarSection) => activeSection === section && isOpen ? "light" : "subtle", [activeSection, isOpen]);
  const getColor = useCallback((section: SidebarSection) => activeSection === section && isOpen ? "blue" : "gray.7", [activeSection, isOpen]);

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
          {/* Database button now first since Explorer is merged into it */}
          <Tooltip label="Database" position="right">
              <ActionIcon size="md" variant={getVariant("database")} color={getColor("database")} onClick={() => onToggleSection("database")}><FontAwesomeIcon icon={faDatabase} style={{ width: 20, height: 20 }} /></ActionIcon>
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
            <ScrollArea style={{ flex: 1 }}> 

                {activeSection === "outline" && (
                    <OutlineView content={outlineSource || ''} onNavigate={onScrollToLine || (() => {})} />
                )}

                {/* Database & Gallery sections */}
                {activeSection === "database" && (
                     <DatabaseSidebar 
                        onOpenFolder={onOpenFolder}
                        onRemoveFolder={onRemoveFolder}
                        onOpenFileNode={onOpenFileNode}
                        onCreateItem={onCreateItem}
                        onRenameItem={onRenameItem}
                        onDeleteItem={onDeleteItem}
                        onNavigate={(view) => onNavigate(view as ViewType)}
                     />
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