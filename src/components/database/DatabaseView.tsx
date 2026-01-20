import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  ScrollArea,
  Group,
  Text,
  TextInput,
  Badge,
  Paper,
  Tooltip,
  ActionIcon,
  Box,
  Menu,
  Select,
  Checkbox,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSort,
  faSortUp,
  faSortDown,
  faTrash,
  faExternalLinkAlt,
  faFolderOpen,
  faPlus,
  faFile,
  faFileAlt,
  faMagic,
  faProjectDiagram,
  faTable,
  faColumns,
  faExchangeAlt,
  faFileImport,
} from "@fortawesome/free-solid-svg-icons";
import { useDatabaseStore } from "../../stores/databaseStore";
import { invoke } from "@tauri-apps/api/core";
import { VisualGraphView } from "./VisualGraphView";
// import { PreambleWizard } from '../wizards/PreambleWizard'; // Moved to ResourceInspector
import {
  KIND_OPTIONS,
  getColumnsWithDiscoveredMeta,
  loadColumnPreferences,
  saveColumnPreferences,
  ColumnDef,
} from "../../config/columnConfig";

interface DatabaseViewProps {
  onOpenFile?: (path: string) => void;
  onOpenTemplateModal?: () => void;
  canInsert?: boolean;
}

type SortDirection = "asc" | "desc" | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

export const DatabaseView = React.memo(
  ({ onOpenFile, onOpenTemplateModal, canInsert }: DatabaseViewProps) => {
    const { t } = useTranslation();
    // Granular selectors - prevents re-renders when unrelated state changes
    const allLoadedResources = useDatabaseStore(
      (state) => state.allLoadedResources,
    );
    const loadedCollections = useDatabaseStore(
      (state) => state.loadedCollections,
    );
    const selectResource = useDatabaseStore((state) => state.selectResource);
    const activeResourceId = useDatabaseStore(
      (state) => state.activeResourceId,
    );
    const deleteResource = useDatabaseStore((state) => state.deleteResource);
    const moveResource = useDatabaseStore((state) => state.moveResource);
    const fullCollections = useDatabaseStore((state) => state.collections); // Get all collections for move list
    const insertMode = useDatabaseStore((state) => state.insertMode);
    const toggleInsertMode = useDatabaseStore(
      (state) => state.toggleInsertMode,
    );
    const insertTargetDocumentId = useDatabaseStore(
      (state) => state.insertTargetDocumentId,
    );
    const [globalSearch, setGlobalSearch] = useState("");
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
      {},
    );
    const [sort, setSort] = useState<SortState>({
      column: null,
      direction: null,
    });
    const [viewMode, setViewMode] = useState<"table" | "graph">("table");
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

    // Multi-selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Last clicked ID for shift-selection range
    const [lastClickedId, setLastClickedId] = useState<string | null>(null);

    // New: Kind filter and column visibility state with persistence
    const [kindFilter, setKindFilter] = useState<string>(() => {
      return loadColumnPreferences().kindFilter;
    });
    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
      const saved = loadColumnPreferences().visibleColumns;
      return saved.length > 0
        ? saved
        : ["title", "collection", "kind", "difficulty", "field"];
    });

    // Save preferences when they change
    useEffect(() => {
      saveColumnPreferences(visibleColumns, kindFilter);
    }, [visibleColumns, kindFilter]);

    useEffect(() => {
      // Scroll to active resource when switching to table view or changing selection
      if (
        viewMode === "table" &&
        activeResourceId &&
        rowRefs.current[activeResourceId]
      ) {
        rowRefs.current[activeResourceId]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, [viewMode, activeResourceId]);

    // Filter resources by kind first, then by .tex extension
    const filteredByKind = useMemo(() => {
      let result = allLoadedResources.filter(
        (r) =>
          r.path.toLowerCase().endsWith(".tex") ||
          r.path.toLowerCase().endsWith(".bib") ||
          r.path.toLowerCase().endsWith(".sty") ||
          r.path.toLowerCase().endsWith(".cls") ||
          r.path.toLowerCase().endsWith(".dtx") ||
          r.path.toLowerCase().endsWith(".ins"),
      );
      if (kindFilter && kindFilter !== "all") {
        result = result.filter((r) => r.kind === kindFilter);
      }
      return result;
    }, [allLoadedResources, kindFilter]);

    // Scan all resources to find all unique metadata keys
    const discoveredMetaKeys = useMemo(() => {
      const metaKeys = new Set<string>();
      filteredByKind.forEach((r) => {
        if (r.metadata) {
          Object.keys(r.metadata).forEach((k) => metaKeys.add(k));
        }
      });
      return metaKeys;
    }, [filteredByKind]);

    // Get columns based on kindFilter with discovered metadata merged in
    const availableColumns: ColumnDef[] = useMemo(() => {
      const activeKind = kindFilter === "all" ? "file" : kindFilter;
      return getColumnsWithDiscoveredMeta(activeKind, discoveredMetaKeys);
    }, [kindFilter, discoveredMetaKeys]);

    // Final visible columns filtered by user preferences
    const columns = useMemo(() => {
      return availableColumns.filter((col) => visibleColumns.includes(col.key));
    }, [availableColumns, visibleColumns]);

    const toggleColumnVisibility = useCallback((key: string) => {
      setVisibleColumns((prev) => {
        if (prev.includes(key)) {
          return prev.filter((k) => k !== key);
        }
        return [...prev, key];
      });
    }, []);

    const handleColumnFilterChange = (col: string, value: string) => {
      setColumnFilters((prev) => ({
        ...prev,
        [col]: value,
      }));
    };

    const handleSort = (col: string) => {
      setSort((prev) => {
        if (prev.column !== col) return { column: col, direction: "asc" };
        if (prev.direction === "asc") return { column: col, direction: "desc" };
        return { column: null, direction: null };
      });
    };

    const filteredData = useMemo(() => {
      let result = filteredByKind;

      // 1. Global Search
      if (globalSearch) {
        const searchLower = globalSearch.toLowerCase();
        result = result.filter(
          (r) =>
            r.title?.toLowerCase().includes(searchLower) ||
            r.id.toLowerCase().includes(searchLower) ||
            r.collection.toLowerCase().includes(searchLower) ||
            JSON.stringify(r.metadata).toLowerCase().includes(searchLower),
        );
      }

      // 2. Column Filters
      Object.entries(columnFilters).forEach(([col, filterValue]) => {
        if (!filterValue) return;
        const filterLower = filterValue.toLowerCase();
        result = result.filter((row) => {
          let val = "";
          if (col === "title")
            val = row.title || row.path.split(/[/\\]/).pop() || row.id;
          else if (col === "collection") val = row.collection;
          else if (col === "kind") val = row.kind;
          else val = row.metadata?.[col] || "";

          return String(val).toLowerCase().includes(filterLower);
        });
      });

      // 3. Sorting
      if (sort.column && sort.direction) {
        result = [...result].sort((a, b) => {
          let valA = "";
          let valB = "";

          const getValue = (row: typeof a, col: string) => {
            if (col === "title")
              return row.title || row.path.split(/[/\\]/).pop() || row.id;
            if (col === "collection") return row.collection;
            if (col === "kind") return row.kind;
            return row.metadata?.[col] || "";
          };

          valA = String(getValue(a, sort.column!)).toLowerCase();
          valB = String(getValue(b, sort.column!)).toLowerCase();

          if (valA < valB) return sort.direction === "asc" ? -1 : 1;
          if (valA > valB) return sort.direction === "asc" ? 1 : -1;
          return 0;
        });
      }

      return result;
    }, [allLoadedResources, globalSearch, columnFilters, sort]);

    const handleRowClick = useCallback(
      (id: string, path: string, event: React.MouseEvent) => {
        // Multi-selection logic
        if (event.ctrlKey || event.metaKey) {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
              next.delete(id);
            } else {
              next.add(id);
            }
            return next;
          });
          setLastClickedId(id);
          // Also set active resource for preview if it's the only one or just clicked
          selectResource(id);
        } else if (event.shiftKey && lastClickedId) {
          // Find range
          const allIds = filteredData.map((r) => r.id);
          const start = allIds.indexOf(lastClickedId);
          const end = allIds.indexOf(id);

          if (start !== -1 && end !== -1) {
            const range = allIds.slice(
              Math.min(start, end),
              Math.max(start, end) + 1,
            );
            setSelectedIds(new Set(range));
          }
          selectResource(id);
        } else {
          // Single select
          setSelectedIds(new Set([id]));
          setLastClickedId(id);
          selectResource(id);
        }

        // In Insert Mode, do NOT open files in main editor - just select for preview
        if (onOpenFile && !event.ctrlKey && !event.shiftKey && !insertMode) {
          // Optional: automatically open file on single click?
          // current behavior in original code was select + open
          // Keeping it consistent but maybe debounce this if single click is select
          onOpenFile(path); // This was original behavior
        }
      },
      [selectResource, onOpenFile, filteredData, lastClickedId, insertMode],
    );

    const activeResource = useMemo(
      () => allLoadedResources.find((r) => r.id === activeResourceId),
      [allLoadedResources, activeResourceId],
    );

    const handleRevealInFileExplorer = async () => {
      if (activeResource?.path) {
        // Reveal parent directory using system commands.
        try {
          // Remove filename to get parent directory
          const parentDir = activeResource.path.replace(/[/\\][^/\\]*$/, "");

          try {
            await invoke("reveal_path_cmd", { path: parentDir });
          } catch (e) {
            console.error("Failed to open explorer", e);
          }
        } catch (e) {
          console.error("Failed to calculate parent dir", e);
        }
      }
    };

    const handleDelete = useCallback(async () => {
      if (activeResourceId) {
        if (
          confirm(
            "Are you sure you want to remove this file from the database? The physical file will NOT be deleted.",
          )
        ) {
          await deleteResource(activeResourceId);
        }
      }
    }, [activeResourceId, deleteResource]);

    const handleOpenInEditor = useCallback(() => {
      if (activeResource && onOpenFile) {
        onOpenFile(activeResource.path);
      }
    }, [activeResource, onOpenFile]);

    // Wizard and Template State
    // const [wizardOpen, setWizardOpen] = useState(false); // Moved to store
    const setWizardOpen = useDatabaseStore((state) => state.setWizardOpen);

    const createFileWithContent = async (content: string) => {
      const collection = loadedCollections[0];
      try {
        const selectedPath = await import("@tauri-apps/plugin-dialog").then(
          ({ save }) =>
            save({
              defaultPath: "Untitled.tex",
              filters: [
                {
                  name: "TeX Document",
                  extensions: ["tex"],
                },
              ],
            }),
        );

        if (selectedPath) {
          await useDatabaseStore
            .getState()
            .createResource(selectedPath, collection, content);
        }
      } catch (err) {
        console.error("Failed to create file", err);
      }
    };

    const handleCreateFile = async (type: "empty" | "template" | "wizard") => {
      if (loadedCollections.length === 0) {
        alert("Please select a collection first.");
        return;
      }

      if (type === "empty") {
        await createFileWithContent("");
      } else if (type === "wizard") {
        setWizardOpen(true);
      } else if (type === "template") {
        if (onOpenTemplateModal) {
          onOpenTemplateModal();
        }
      }
    };

    const handleAddExistingFile = async () => {
      if (loadedCollections.length === 0) {
        alert("Please select a collection first.");
        return;
      }
      const collection = loadedCollections[0];

      try {
        const selectedPath = await import("@tauri-apps/plugin-dialog").then(
          ({ open }) =>
            open({
              multiple: false,
              filters: [
                {
                  name: "TeX/Bib/Images",
                  extensions: [
                    "tex",
                    "bib",
                    "sty",
                    "cls",
                    "dtx",
                    "ins",
                    "png",
                    "jpg",
                    "pdf",
                  ],
                },
              ],
            }),
        );

        if (selectedPath) {
          const pathStr = Array.isArray(selectedPath)
            ? selectedPath[0]
            : selectedPath;
          if (pathStr) {
            await useDatabaseStore.getState().importFile(pathStr, collection);
          }
        }
      } catch (err) {
        console.error("Failed to import file", err);
      }
    };

    if (loadedCollections.length === 0) {
      return (
        <Text p="xl" c="dimmed" ta="center">
          Select one or more collections to view their contents.
        </Text>
      );
    }

    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--mantine-color-gray-8)",
          border: insertMode ? "2px solid var(--app-accent-color)" : undefined,
        }}
      >
        {/* Toolbar */}
        <Paper
          p="xs"
          style={{
            borderBottom: "1px solid var(--mantine-color-default-border)",
            zIndex: 10,
          }}
        >
          <Group justify="space-between">
            <Group gap="xs">
              <Text fw={700} size="sm">
                {loadedCollections.length === 1
                  ? loadedCollections[0]
                  : `${loadedCollections.length} Collections`}
              </Text>
              <Badge size="xs" variant="light">
                {filteredData.length} files
              </Badge>
              {insertMode && (
                <Badge size="xs" color="blue" variant="filled">
                  INSERT MODE
                </Badge>
              )}
            </Group>

            <Group gap="xs">
              {/* Kind Filter */}
              <Select
                size="xs"
                placeholder="Τύπος"
                data={KIND_OPTIONS}
                value={kindFilter}
                onChange={(val) => setKindFilter(val || "all")}
                clearable={false}
                styles={{ input: { width: 100 } }}
              />

              {/* Column Visibility */}
              <Menu shadow="md" width={200} closeOnItemClick={false}>
                <Menu.Target>
                  <Tooltip label="Στήλες">
                    <ActionIcon variant="default" size="md">
                      <FontAwesomeIcon icon={faColumns} style={{ width: 14 }} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Ορατές Στήλες</Menu.Label>
                  {availableColumns.map((col) => (
                    <Menu.Item
                      key={col.key}
                      onClick={() => toggleColumnVisibility(col.key)}
                    >
                      <Group gap="xs">
                        <Checkbox
                          checked={visibleColumns.includes(col.key)}
                          onChange={() => toggleColumnVisibility(col.key)}
                          size="xs"
                          readOnly
                        />
                        <Text size="xs">{col.label}</Text>
                      </Group>
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>

              {/* View Toggle */}
              <ActionIcon.Group>
                <ActionIcon
                  variant={viewMode === "table" ? "filled" : "default"}
                  onClick={() => setViewMode("table")}
                  title="Table View"
                >
                  <FontAwesomeIcon icon={faTable} />
                </ActionIcon>
                <ActionIcon
                  variant={viewMode === "graph" ? "filled" : "default"}
                  onClick={() => setViewMode("graph")}
                  title="Graph View"
                >
                  <FontAwesomeIcon icon={faProjectDiagram} />
                </ActionIcon>
              </ActionIcon.Group>

              {/* Action Toolbar - Only visible when a resource is selected */}
              {activeResourceId && (
                <Group
                  gap="2px"
                  style={{
                    backgroundColor: "var(--mantine-color-default)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                  }}
                >
                  <Menu shadow="md" width={200}>
                    <Tooltip label={t("common.create")}>
                      <Menu.Target>
                        <ActionIcon size="xs" color="gray.5" variant="subtle">
                          <FontAwesomeIcon
                            icon={faPlus}
                            style={{ height: 12 }}
                          />
                        </ActionIcon>
                      </Menu.Target>
                    </Tooltip>
                    <Menu.Dropdown>
                      <Menu.Label>{t("common.create")}</Menu.Label>
                      <Menu.Item
                        onClick={() => handleCreateFile("empty")}
                        leftSection={
                          <FontAwesomeIcon
                            icon={faFile}
                            style={{ height: 14 }}
                          />
                        }
                      >
                        {t("database.actions.emptyFile")}
                      </Menu.Item>
                      <Menu.Item
                        onClick={() => handleCreateFile("template")}
                        leftSection={
                          <FontAwesomeIcon
                            icon={faFileAlt}
                            style={{ height: 14 }}
                          />
                        }
                      >
                        {t("database.actions.fromTemplate")}
                      </Menu.Item>
                      <Menu.Item
                        onClick={() => handleCreateFile("wizard")}
                        leftSection={
                          <FontAwesomeIcon
                            icon={faMagic}
                            style={{ height: 14 }}
                          />
                        }
                      >
                        {t("database.actions.preambleWizard")}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>

                  <Tooltip label={t("database.actions.addExistingFile")}>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray.5"
                      onClick={handleAddExistingFile}
                    >
                      <FontAwesomeIcon
                        icon={faFolderOpen}
                        style={{ height: 12 }}
                      />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t("database.actions.openInEditor")}>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={handleOpenInEditor}
                      color="gray.5"
                    >
                      <FontAwesomeIcon
                        icon={faExternalLinkAlt}
                        style={{ height: 12 }}
                      />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t("database.actions.revealInExplorer")}>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={handleRevealInFileExplorer}
                      color="gray.5"
                    >
                      <FontAwesomeIcon
                        icon={faFolderOpen}
                        style={{ height: 12 }}
                      />
                    </ActionIcon>
                  </Tooltip>

                  <Menu shadow="md" width={200}>
                    <Tooltip label={t("database.actions.moveToCollection")}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" size="xs" color="gray.5">
                          <FontAwesomeIcon
                            icon={faExchangeAlt}
                            style={{ height: 12 }}
                          />
                        </ActionIcon>
                      </Menu.Target>
                    </Tooltip>
                    <Menu.Dropdown>
                      <Menu.Label>{t("database.actions.moveTo")}</Menu.Label>
                      {activeResource &&
                        fullCollections
                          .filter((c) => c.name !== activeResource.collection)
                          .map((c) => (
                            <Menu.Item
                              key={c.name}
                              onClick={() =>
                                moveResource(activeResource.id, c.name)
                              }
                            >
                              {c.name}
                            </Menu.Item>
                          ))}
                    </Menu.Dropdown>
                  </Menu>
                  <Tooltip label={t("database.actions.removeFromDatabase")}>
                    <ActionIcon
                      variant="subtle"
                      size="xs"
                      onClick={handleDelete}
                      color="red"
                    >
                      <FontAwesomeIcon icon={faTrash} style={{ height: 12 }} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )}

              {/* Insert Mode Toggle Button */}
              {canInsert && (
                <Tooltip
                  label={insertMode ? "Exit Insert Mode" : "Enter Insert Mode"}
                >
                  <ActionIcon
                    size="sm"
                    variant={insertMode ? "filled" : "default"}
                    color={insertMode ? "blue" : "gray"}
                    onClick={() => toggleInsertMode(insertTargetDocumentId)}
                  >
                    <FontAwesomeIcon
                      icon={faFileImport}
                      style={{ height: 14 }}
                    />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Group>
        </Paper>

        {/* Content Area */}
        <Box
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {viewMode === "graph" ? (
            <VisualGraphView onOpenFile={onOpenFile} />
          ) : (
            <>
              {/* Table Area */}
              <ScrollArea style={{ flex: 1 }} viewportRef={scrollViewportRef}>
                <Table stickyHeader highlightOnHover striped>
                  <Table.Thead>
                    <Table.Tr>
                      {columns.map((col) => {
                        const isSorted = sort.column === col.key;
                        return (
                          <Table.Th
                            key={col.key}
                            style={{ whiteSpace: "nowrap", minWidth: 100 }}
                          >
                            <Box
                              onClick={() => handleSort(col.key)}
                              style={{
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                marginBottom: 4,
                              }}
                            >
                              <Text
                                size="xs"
                                fw={700}
                                style={{ userSelect: "none" }}
                              >
                                {col.label}
                              </Text>
                              <FontAwesomeIcon
                                icon={
                                  isSorted
                                    ? sort.direction === "asc"
                                      ? faSortUp
                                      : faSortDown
                                    : faSort
                                }
                                style={{
                                  opacity: isSorted ? 1 : 0.3,
                                  width: 10,
                                }}
                              />
                            </Box>
                            <TextInput
                              placeholder={`${col.label}...`}
                              size="xs"
                              value={columnFilters[col.key] || ""}
                              onChange={(e) =>
                                handleColumnFilterChange(
                                  col.key,
                                  e.currentTarget.value,
                                )
                              }
                              variant="filled"
                              styles={{
                                input: {
                                  height: 22,
                                  fontSize: 10,
                                  padding: "0 4px",
                                },
                              }}
                              onClick={(e) => e.stopPropagation()} // Prevent sort when clicking input
                            />
                          </Table.Th>
                        );
                      })}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredData.map((row) => {
                      const isSelected = row.id === activeResourceId;
                      const filename =
                        row.path.split(/[/\\]/).pop() || row.title || row.id;

                      return (
                        <Table.Tr
                          key={row.id}
                          ref={(el: any) => {
                            if (el) rowRefs.current[row.id] = el;
                          }}
                          onClick={(e) => handleRowClick(row.id, row.path, e)}
                          bg={
                            selectedIds.has(row.id) || isSelected
                              ? "var(--app-accent-color-dimmed)"
                              : undefined
                          }
                          style={{ cursor: "pointer" }}
                        >
                          {columns.map((col) => {
                            let val = "";
                            if (col.key === "title")
                              val = row.title || filename;
                            else if (col.key === "collection")
                              val = row.collection;
                            else if (col.key === "kind") val = row.kind;
                            else val = row.metadata?.[col.key] || "";

                            return (
                              <Table.Td key={`${row.id}-${col.key}`}>
                                <Text size="xs" truncate>
                                  {String(val)}
                                </Text>
                              </Table.Td>
                            );
                          })}
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              <Group style={{ position: "sticky", bottom: 0, zIndex: 10 }}>
                <TextInput
                  flex={1}
                  style={{ padding: 4 }}
                  placeholder={t("database.searchPlaceholder")}
                  leftSection={
                    <FontAwesomeIcon
                      icon={faSearch}
                      style={{ width: 12, height: 12 }}
                    />
                  }
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.currentTarget.value)}
                  size="xs"
                  styles={{ input: { height: 28 } }}
                />
              </Group>
            </>
          )}
        </Box>
      </div>
    );
  },
);
