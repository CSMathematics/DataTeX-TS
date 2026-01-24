import React, { useState, useMemo, useCallback } from "react";
import {
  Stack,
  ActionIcon,
  Tooltip,
  Text,
  Group,
  ScrollArea,
  Box,
  UnstyledButton,
  NavLink,
  Button,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faCodeBranch,
  faCog,
  faDatabase,
  faTable,
  faSquareRootAlt,
  faCube,
  faPalette,
  faCalculator,
  faLayerGroup,
  faCode,
  faBoxOpen,
  faList,
  faImage,
  faClock,
} from "@fortawesome/free-solid-svg-icons";

import { SymbolSidebar } from "./SymbolSidebar";
import { SymbolPanel } from "./SymbolPanel";
import { SymbolCategory } from "../wizards/preamble/SymbolDB";
import { PACKAGES_DB, Category } from "../wizards/preamble/packages";
import { getWizardConfig } from "../wizards/preamble/wizardRegistry";
import { DatabaseSidebar } from "../database/DatabaseSidebar";
import { SearchPanel } from "../search/SearchPanel";
import { GitPanel } from "../git/GitPanel";
import { HistoryPanel } from "../history/HistoryPanel";
import { useDatabaseStore } from "../../stores/databaseStore";

// --- Types ---
export type SidebarSection =
  | "search"
  | "git"
  | "history"
  | "database"
  | "settings"
  | "symbols"
  | "gallery"
  | "outline";
export type ViewType =
  | "editor"
  | "wizard-preamble"
  | "wizard-table"
  | "wizard-tabularray"
  | "wizard-tikz"
  | "wizard-fancyhdr"
  | "wizard-pstricks"
  | "wizard-graphicx"
  | "wizard-math"
  | "gallery"
  | "settings"
  | "database"
  | "package-browser"
  | "ai-assistant";

export interface FileSystemNode {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileSystemNode[];
}

// Re-export AppTab from store to maintain compatibility
export type { AppTab } from "../../stores/useTabsStore";

interface SidebarProps {
  width: number | string;
  isOpen: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
  activeSection: SidebarSection;
  onToggleSection: (s: SidebarSection) => void;
  onNavigate: (view: ViewType) => void;

  // File System Props
  onOpenFolder: () => void;
  onAddFolder?: () => void;
  onRemoveFolder?: (path: string) => void;
  onOpenFileNode: (node: FileSystemNode) => void;
  onOpenFileAtLine?: (path: string, lineNumber: number) => void;

  onCreateItem?: (
    name: string,
    type: "file" | "folder",
    parentPath: string,
  ) => void;
  onRenameItem?: (node: FileSystemNode, newName: string) => void;
  onDeleteItem?: (node: FileSystemNode) => void;
  onMoveItem?: (sourcePath: string, targetPath: string) => void;

  onInsertSymbol?: (code: string) => void;
  activePackageId?: string;
  onSelectPackage?: (id: string) => void;

  outlineSource?: string;
  onScrollToLine?: (line: number) => void;

  // Git & History props
  projectPath?: string;
  activeFilePath?: string;
  activeFileContent?: string;
  onRestoreContent?: (content: string) => void;
  onExportDtex?: (resourceId?: string) => void;
  onExportToTex?: (resourceId?: string) => void;
}

// Re-export getFileIcon from shared components for backward compatibility
export { getFileIcon } from "../shared/tree";

import { useTranslation } from "react-i18next";

// ... existing imports ...

// --- Outline View Component ---
interface OutlineNode {
  id: string;
  title: string;
  level: number;
  lineNumber: number;
  children: OutlineNode[];
}

const OutlineView = ({
  content,
  onNavigate,
}: {
  content: string;
  onNavigate: (line: number) => void;
}) => {
  const { t } = useTranslation();
  const outline = useMemo(() => {
    const lines = content.split("\n");
    const regex =
      /\\(chapter|section|subsection|subsubsection|label)\*?(?:\[.*?\])?\{(.+?)\}/;
    const nodes: OutlineNode[] = [];

    lines.forEach((line, index) => {
      const match = line.match(regex);
      if (match) {
        const type = match[1];
        const title = match[2];
        let level = 0;

        if (type === "chapter") level = 1;
        else if (type === "section") level = 2;
        else if (type === "subsection") level = 3;
        else if (type === "subsubsection") level = 4;
        else if (type === "label") level = 5; // Treat labels as deeper or special

        const newNode: OutlineNode = {
          id: `${index}-${title}`,
          title:
            type === "label" ? `${t("sidebar.labelPrefix")}${title}` : title,
          level,
          lineNumber: index + 1,
          children: [],
        };

        // Simple flat list for now, or build tree
        // Let's stick to a flat list with indentation for simplicity and robustness
        nodes.push(newNode);
      }
    });
    return nodes;
  }, [content]);

  if (outline.length === 0) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">
          {t("sidebar.noStructure")}
        </Text>
      </Box>
    );
  }
  return (
    <ScrollArea h="100%">
      <Stack gap={2} p="xs">
        {outline.map((node) => (
          <UnstyledButton
            key={node.id}
            onClick={() => onNavigate(node.lineNumber)}
            style={{
              paddingLeft: (node.level - 1) * 12,
              paddingTop: 4,
              paddingBottom: 4,
              width: "100%",
              display: "block",
            }}
          >
            <Text size="xs" truncate>
              {node.title}
            </Text>
          </UnstyledButton>
        ))}
      </Stack>
    </ScrollArea>
  );
};

// Git Panel wrapper that falls back to loaded database collection paths
const GitPanelWithDbFallback: React.FC<{
  projectPath?: string;
  onOpenFile: (path: string) => void;
}> = ({ projectPath, onOpenFile }) => {
  const collections = useDatabaseStore((state) => state.collections);
  const loadedCollections = useDatabaseStore(
    (state) => state.loadedCollections,
  );

  // Get the first loaded collection's path as fallback
  const effectivePath = React.useMemo(() => {
    if (projectPath) return projectPath;

    // Find first loaded collection with a path
    for (const colName of loadedCollections) {
      const collection = collections.find((c) => c.name === colName);
      if (collection?.path) {
        return collection.path;
      }
    }
    return null;
  }, [projectPath, collections, loadedCollections]);

  return <GitPanel projectPath={effectivePath} onOpenFile={onOpenFile} />;
};

export const Sidebar = React.memo<SidebarProps>(
  ({
    width,
    isOpen,
    onResizeStart,
    activeSection,
    onToggleSection,
    onNavigate,
    onOpenFolder,
    onRemoveFolder,
    onOpenFileNode,
    onOpenFileAtLine,
    onCreateItem,
    onRenameItem,
    onDeleteItem,
    onInsertSymbol,
    activePackageId,
    onSelectPackage,
    outlineSource,
    onScrollToLine,
    projectPath,
    activeFilePath,
    activeFileContent,
    onRestoreContent,
    onExportDtex,
    onExportToTex,
  }) => {
    // --- Local State ---
    const { t } = useTranslation();
    const [activeSymbolCategory, setActiveSymbolCategory] =
      useState<SymbolCategory | null>("greek");

    const getVariant = useCallback(
      (section: SidebarSection) =>
        activeSection === section && isOpen ? "light" : "subtle",
      [activeSection, isOpen],
    );
    const getColor = useCallback(
      (section: SidebarSection) =>
        activeSection === section && isOpen ? "blue" : "gray.5",
      [activeSection, isOpen],
    );

    const packageCategories: Record<string, React.ReactNode> = {
      colors: (
        <FontAwesomeIcon icon={faPalette} style={{ width: 16, height: 16 }} />
      ),
      math: (
        <FontAwesomeIcon
          icon={faCalculator}
          style={{ width: 16, height: 16 }}
        />
      ),
      graphics: (
        <FontAwesomeIcon icon={faImage} style={{ width: 16, height: 16 }} />
      ),
      tables: (
        <FontAwesomeIcon icon={faTable} style={{ width: 16, height: 16 }} />
      ),
      code: <FontAwesomeIcon icon={faCode} style={{ width: 16, height: 16 }} />,
      layout: (
        <FontAwesomeIcon
          icon={faLayerGroup}
          style={{ width: 16, height: 16 }}
        />
      ),
      misc: (
        <FontAwesomeIcon icon={faBoxOpen} style={{ width: 16, height: 16 }} />
      ),
    };

    return (
      <Group
        gap={0}
        h="100%"
        align="stretch"
        style={{ flexShrink: 0, zIndex: 10 }}
      >
        {/* Activity Bar */}
        <Stack
          w={48}
          h="100%"
          gap={0}
          justify="space-between"
          py="md"
          style={{
            backgroundColor: "var(--app-sidebar-bg)",
            borderRight: "1px solid var(--mantine-color-default-border)",
            zIndex: 20,
          }}
        >
          <Stack gap={20} align="center">
            {/* Database button now first since Explorer is merged into it */}
            <Tooltip label={t("sidebar.database")} position="right">
              <ActionIcon
                size="sm"
                variant={getVariant("database")}
                color={getColor("database")}
                onClick={() => onToggleSection("database")}
              >
                <FontAwesomeIcon
                  icon={faDatabase}
                  style={{ width: 20, height: 20 }}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("sidebar.structure")} position="right">
              <ActionIcon
                size="sm"
                variant={getVariant("outline")}
                color={getColor("outline")}
                onClick={() => onToggleSection("outline")}
              >
                <FontAwesomeIcon
                  icon={faList}
                  style={{ width: 20, height: 20 }}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("sidebar.symbols")} position="right">
              <ActionIcon
                size="sm"
                variant={getVariant("symbols")}
                color={getColor("symbols")}
                onClick={() => onToggleSection("symbols")}
              >
                <FontAwesomeIcon
                  icon={faSquareRootAlt}
                  style={{ width: 20, height: 20 }}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("sidebar.gallery")} position="right">
              <ActionIcon
                size="sm"
                variant={getVariant("gallery")}
                color={getColor("gallery")}
                onClick={() => onToggleSection("gallery")}
              >
                <FontAwesomeIcon
                  icon={faCube}
                  style={{ width: 20, height: 20 }}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("sidebar.search")} position="right">
              <ActionIcon
                size="sm"
                variant={getVariant("search")}
                color={getColor("search")}
                onClick={() => onToggleSection("search")}
              >
                <FontAwesomeIcon
                  icon={faSearch}
                  style={{ width: 20, height: 20 }}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("sidebar.git")} position="right">
              <ActionIcon
                size="sm"
                variant={getVariant("git")}
                color={getColor("git")}
                onClick={() => onToggleSection("git")}
              >
                <FontAwesomeIcon
                  icon={faCodeBranch}
                  style={{ width: 20, height: 20 }}
                />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t("sidebar.history")} position="right">
              <ActionIcon
                size="sm"
                variant={getVariant("history")}
                color={getColor("history")}
                onClick={() => onToggleSection("history")}
              >
                <FontAwesomeIcon
                  icon={faClock}
                  style={{ width: 20, height: 20 }}
                />
              </ActionIcon>
            </Tooltip>
          </Stack>
          <Stack gap={4} align="center">
            <Tooltip label={t("sidebar.settings")} position="right">
              <ActionIcon
                size="sm"
                variant={getVariant("settings")}
                color={getColor("settings")}
                onClick={() => onToggleSection("settings")}
              >
                <FontAwesomeIcon
                  icon={faCog}
                  style={{ width: 20, height: 20 }}
                />
              </ActionIcon>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Sidebar Content Panel with Transition */}
        <>
          <Box
            w={isOpen ? width : 0}
            h="100%"
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              backgroundColor: "var(--app-sidebar-bg)",
              /* TRANSITION STYLES */
              minWidth: 0,
              flexShrink: 0,
              transition: "width 300ms ease-in-out, opacity 200ms ease-in-out",
              opacity: isOpen ? 1 : 0,
              whiteSpace: "nowrap",
            }}
          >
            {activeSection !== "symbols" && (
              <Group
                h={35}
                px="sm"
                justify="space-between"
                style={{
                  backgroundColor: "var(--app-header-bg)",
                  borderBottom: "1px solid var(--mantine-color-default-border)",
                  flexShrink: 0,
                }}
              >
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  {t(`sidebar.${activeSection}`, {
                    defaultValue: activeSection,
                  })}
                </Text>
              </Group>
            )}

            {activeSection === "symbols" ? (
              <Group
                h="100%"
                gap={0}
                align="stretch"
                style={{ overflow: "hidden" }}
              >
                <SymbolSidebar
                  activeCategory={activeSymbolCategory}
                  onSelectCategory={setActiveSymbolCategory}
                />
                {activeSymbolCategory ? (
                  <Box style={{ flex: 1, height: "100%", overflow: "hidden" }}>
                    <SymbolPanel
                      category={activeSymbolCategory}
                      onInsert={(code) =>
                        onInsertSymbol && onInsertSymbol(code)
                      }
                      width="100%"
                    />
                  </Box>
                ) : (
                  <Box p="md" style={{ flex: 1 }}>
                    <Text c="dimmed" size="sm" ta="center">
                      {t("sidebar.selectCategory")}
                    </Text>
                  </Box>
                )}
              </Group>
            ) : (
              <ScrollArea style={{ flex: 1 }}>
                {activeSection === "outline" && (
                  <OutlineView
                    content={outlineSource || ""}
                    onNavigate={onScrollToLine || (() => {})}
                  />
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
                    onExportDtex={onExportDtex}
                    onExportToTex={onExportToTex}
                  />
                )}

                {activeSection === "search" && (
                  <SearchPanel
                    onOpenFile={(path, lineNumber) => {
                      if (onOpenFileAtLine) {
                        onOpenFileAtLine(path, lineNumber);
                      } else {
                        // Fallback to normal file opening
                        const node: FileSystemNode = {
                          id: path,
                          name: path.split(/[/\\]/).pop() || path,
                          type: "file",
                          path,
                          children: [],
                        };
                        onOpenFileNode(node);
                      }
                    }}
                  />
                )}

                {activeSection === "git" && (
                  <GitPanelWithDbFallback
                    projectPath={projectPath}
                    onOpenFile={(path) => {
                      const node: FileSystemNode = {
                        id: path,
                        name: path.split(/[/\\]/).pop() || path,
                        type: "file",
                        path,
                        children: [],
                      };
                      onOpenFileNode(node);
                    }}
                  />
                )}

                {activeSection === "history" && (
                  <HistoryPanel
                    activeFilePath={activeFilePath || null}
                    currentContent={activeFileContent || ""}
                    onRestoreContent={onRestoreContent || (() => {})}
                  />
                )}

                {activeSection === "gallery" && (
                  <Stack gap={4} p="xs">
                    <Button
                      variant="light"
                      color="blue"
                      size="xs"
                      fullWidth
                      leftSection={<FontAwesomeIcon icon={faDatabase} />}
                      onClick={() => onNavigate("package-browser")}
                      mb="sm"
                    >
                      {t("sidebar.openPackageDatabase")}
                    </Button>
                    {(Object.keys(packageCategories) as Category[]).map(
                      (cat) => {
                        const pkgs = PACKAGES_DB.filter(
                          (p) => p.category === cat,
                        );
                        if (pkgs.length === 0) return null;
                        return (
                          <Box key={cat} mb="sm">
                            <Group gap="xs" px="xs" mb={4}>
                              {packageCategories[cat]}
                              <Text
                                size="xs"
                                fw={700}
                                tt="uppercase"
                                c="dimmed"
                              >
                                {cat}
                              </Text>
                            </Group>
                            {pkgs.map((pkg) => (
                              <NavLink
                                key={pkg.id}
                                label={pkg.name}
                                description={
                                  <Text size="xs" truncate>
                                    {pkg.description}
                                  </Text>
                                }
                                onClick={() => {
                                  if (onSelectPackage) onSelectPackage(pkg.id);
                                  // Direct navigation if package has a wizard view
                                  const wizardConfig = getWizardConfig(pkg.id);
                                  if (wizardConfig?.wizardView) {
                                    onNavigate(wizardConfig.wizardView);
                                  } else {
                                    onNavigate("gallery");
                                  }
                                }}
                                active={pkg.id === activePackageId}
                                variant="light"
                                style={{ borderRadius: 4 }}
                              />
                            ))}
                          </Box>
                        );
                      },
                    )}
                  </Stack>
                )}
              </ScrollArea>
            )}
          </Box>

          {/* Resizer Handle - Visible only when sidebar is effectively open */}
          {isOpen && (
            <Box
              onMouseDown={onResizeStart}
              w={4}
              h="100%"
              bg="transparent"
              style={{
                cursor: "col-resize",
                ":hover": { backgroundColor: "var(--mantine-primary-color-6)" },
              }}
            />
          )}
        </>
      </Group>
    );
  },
);
