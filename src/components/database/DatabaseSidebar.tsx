import React, { useEffect, useMemo, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Stack,
  Text,
  Loader,
  Box,
  Checkbox,
  UnstyledButton,
  Modal,
  Button,
  Group,
  ActionIcon,
  ScrollArea,
  Divider,
  TextInput,
  Menu,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faSync,
  faDatabase,
  faTrash,
  faFolder,
  faWandMagicSparkles,
  faTable,
  faPenNib,
  faEllipsisVertical, // New Icon
} from "@fortawesome/free-solid-svg-icons";
import { useDatabaseStore } from "../../stores/databaseStore";
import { useProjectStore } from "../../stores/projectStore";
import { open } from "@tauri-apps/plugin-dialog";

// Import shared tree components
import {
  TreeNode,
  TreeItemConfig,
  TreeItemCallbacks,
  UnifiedTreeItem,
  TreeToolbar,
  TreeSearchInput,
  useTreeState,
  ToolbarAction,
} from "../shared/tree";
import { FileSystemNode } from "../layout/Sidebar";

// View types for the sidebar
type SidebarViewType = "collections" | "projects";

// Props for project folder operations
interface DatabaseSidebarProps {
  // Project folder operations (passed from App.tsx)
  onOpenFolder?: () => void;
  onRemoveFolder?: (path: string) => void;
  onOpenFileNode?: (node: FileSystemNode) => void;
  onCreateItem?: (
    name: string,
    type: "file" | "folder",
    parentPath: string
  ) => void;
  onRenameItem?: (node: FileSystemNode, newName: string) => void;
  onDeleteItem?: (node: FileSystemNode) => void;
  // Navigation to wizards
  onNavigate?: (view: string) => void;
}

/**
 * Database Sidebar component.
 * Shows Collections, DB File Tree, or Project Folders (3-way toggle).
 * Now uses shared UnifiedTreeItem component for file trees.
 */
export const DatabaseSidebar = ({
  onOpenFolder,
  onRemoveFolder,
  onOpenFileNode,
  onCreateItem,
  onRenameItem,
  onDeleteItem,
  onNavigate,
}: DatabaseSidebarProps) => {
  // Granular selectors - prevents re-renders when unrelated state changes
  const collections = useDatabaseStore((state) => state.collections);
  const fetchCollections = useDatabaseStore((state) => state.fetchCollections);
  const loadedCollections = useDatabaseStore(
    (state) => state.loadedCollections
  );
  const toggleCollectionLoaded = useDatabaseStore(
    (state) => state.toggleCollectionLoaded
  );
  const isLoading = useDatabaseStore((state) => state.isLoading);
  const importFolder = useDatabaseStore((state) => state.importFolder);
  const deleteCollection = useDatabaseStore((state) => state.deleteCollection);
  const allLoadedResources = useDatabaseStore(
    (state) => state.allLoadedResources
  );
  const selectResource = useDatabaseStore((state) => state.selectResource);
  const activeResourceId = useDatabaseStore((state) => state.activeResourceId);
  const createCollection = useDatabaseStore((state) => state.createCollection);
  const addFolderToCollection = useDatabaseStore(
    (state) => state.addFolderToCollection
  );

  // Project folder state from store
  const { projectData } = useProjectStore();

  // Use shared tree state hook
  const {
    expandAllSignal,
    collapseAllSignal,
    isToggleExpanded,
    searchQuery,
    setSearchQuery,
    toggleExpandState,
  } = useTreeState<TreeNode>();

  // Local state - 3-way view toggle
  const [activeView, setActiveView] = useState<SidebarViewType>("collections");
  const [projectSearch, setProjectSearch] = useState("");
  const [hoveredCollection, setHoveredCollection] = useState<string | null>(
    null
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(
    null
  );
  const [creatingItem, setCreatingItem] = useState<{
    type: "file" | "folder";
    parentId: string;
  } | null>(null);
  const [selectedProjectNode] = useState<FileSystemNode | null>(null);

  // NEW State for Create Collection Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  // Handler for creating new collection
  const handleCreateCollection = useCallback(async () => {
    if (!newCollectionName.trim()) return;
    await createCollection(newCollectionName);
    setNewCollectionName("");
    setCreateModalOpen(false);
  }, [newCollectionName, createCollection]);

  // Handler for adding folder to existing collection
  const handleAddFolderToCollection = useCallback(
    async (collectionName: string) => {
      try {
        const selected = await open({
          directory: true,
          title: `Add Folder to ${collectionName}`,
        });
        if (selected && typeof selected === "string") {
          await addFolderToCollection(collectionName, selected);
        }
      } catch (e) {
        console.error("Add folder failed", e);
      }
    },
    [addFolderToCollection]
  );

  // Fetch collections on mount
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // --- Handlers ---
  const handleImport = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        title: "Select Folder to Import",
      });
      if (selected && typeof selected === "string") {
        const separator = selected.includes("\\") ? "\\" : "/";
        const name = selected.split(separator).pop() || "Imported";
        // Default to importing as a new collection if adding folder logic isn't used here.
        // But wait, the user wants "Import Folder" to be "Add Folder to Collection" contextually?
        // The previous "Import Folder" button creates a new collection.
        // We will keep createCollection logic separate.
        // For now, this global import creates a new collection.
        await importFolder(selected, name);
      }
    } catch (e) {
      console.error("Import failed", e);
    }
  }, [importFolder]);

  const handleToggleCollection = useCallback(
    (name: string) => {
      toggleCollectionLoaded(name);
    },
    [toggleCollectionLoaded]
  );

  const handleDeleteClick = useCallback((name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollectionToDelete(name);
    setDeleteModalOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (collectionToDelete) {
      await deleteCollection(collectionToDelete);
      setDeleteModalOpen(false);
      setCollectionToDelete(null);
    }
  }, [collectionToDelete, deleteCollection]);

  const cancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setCollectionToDelete(null);
  }, []);

  // --- Collections filtering ---
  const filteredCollections = useMemo(() => {
    if (!searchQuery) return collections;
    return collections.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [collections, searchQuery]);

  // --- Build file tree from resources (FETCH FROM RUST) ---
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);

  useEffect(() => {
    let active = true;
    const fetchTree = async () => {
      if (loadedCollections.length === 0) {
        setFileTree([]);
        return;
      }
      try {
        const tree = await invoke<TreeNode[]>("get_file_tree_cmd", {
          collections: loadedCollections,
        });
        if (active) setFileTree(tree);
      } catch (err) {
        console.error("Failed to fetch file tree", err);
      }
    };
    fetchTree();
    return () => {
      active = false;
    };
  }, [loadedCollections, allLoadedResources.length]); // Re-fetch when collections change or resources count changes (e.g. added file)

  // --- File click handler ---
  const handleFileClick = useCallback(
    (node: TreeNode) => {
      const resource = allLoadedResources.find((r) => r.path === node.path);
      if (resource) {
        selectResource(resource.id);
      }
    },
    [allLoadedResources, selectResource]
  );

  // --- Selected path for highlighting ---
  const selectedPath = useMemo(() => {
    const activeResource = allLoadedResources.find(
      (r) => r.id === activeResourceId
    );
    return activeResource?.path || null;
  }, [allLoadedResources, activeResourceId]);

  // --- Tree item config (enables context menu for file operations) ---
  const treeConfig: TreeItemConfig = useMemo(
    () => ({
      enableDragDrop: false, // Will enable in Phase 4
      enableContextMenu: true, // NEW: Context menu for Database tree
      enableRename: false, // Database files aren't renamed through this UI
      enableCheckbox: false,
    }),
    []
  );

  // --- Tree item callbacks ---
  const treeCallbacks: TreeItemCallbacks = useMemo(
    () => ({
      onFileClick: handleFileClick,
      onFolderToggle: undefined,
      onContextMenu: undefined, // Use default context menu from UnifiedTreeItem
      onRename: undefined,
      onDelete: undefined,
      onCreate: undefined,
      onDrop: undefined,
    }),
    [handleFileClick]
  );

  // --- Toolbar actions ---

  const collectionsToolbarActions: ToolbarAction[] = useMemo(
    () => [
      {
        icon: faSync,
        tooltip: "Refresh",
        onClick: () => fetchCollections(),
      },
      {
        icon: faPlus,
        tooltip: "Create Collection", // Changed from "Import Folder" to "Create Collection" (Import is now adding folder)
        // Wait, user still wants "Import Folder" as quick access?
        // Plan said: "Create Empty Collection" button will be added.
        // "Import Folder" button will continue to function...
        onClick: () => setCreateModalOpen(true), // New button for Empty Collection
      },
      {
        icon: faFolder, // Using Folder icon for "Import Folder" legacy action?
        // Or maybe separate "New Collection" (faDatabase + plus) vs "Import Folder" (faFolder + plus)
        tooltip: "Import Folder as Collection",
        onClick: handleImport,
      },

      {
        icon: faFolder,
        tooltip: "Project Folders",
        onClick: () => setActiveView("projects"),
        variant: "subtle" as const,
        color: "orange",
      },
    ],
    [fetchCollections, handleImport, loadedCollections.length]
  );

  // Get current view title and actions
  const currentTitle =
    activeView === "collections" ? "COLLECTIONS" : "PROJECT FOLDERS";
  const currentActions =
    activeView === "collections" ? collectionsToolbarActions : [];
  const showExpandToggle = activeView !== "collections";

  return (
    <Stack p="xs" gap="xs" h="100%" style={{ overflow: "hidden" }}>
      {/* Header Toolbar */}
      <TreeToolbar
        title={currentTitle}
        actions={currentActions}
        showExpandToggle={showExpandToggle}
        isExpanded={isToggleExpanded}
        onToggleExpand={toggleExpandState}
      />

      {/* Search box */}
      <Box px={4}>
        <TreeSearchInput
          value={activeView === "projects" ? projectSearch : searchQuery}
          onChange={
            activeView === "projects" ? setProjectSearch : setSearchQuery
          }
          onClear={() =>
            activeView === "projects"
              ? setProjectSearch("")
              : setSearchQuery("")
          }
          placeholder={
            activeView === "projects"
              ? "Filter files..."
              : "Search collections..."
          }
        />
      </Box>

      {/* Loading state */}
      {isLoading && collections.length === 0 && <Loader size="xs" mx="auto" />}

      {/* LOADING STATE - no change needed, handled above */}

      {/* PROJECT FOLDERS VIEW */}
      {activeView === "projects" ? (
        <ScrollArea style={{ flex: 1 }}>
          {/* Quick Tools */}
          <Box p="xs">
            <Text size="xs" fw={700} c="dimmed" mb={4}>
              QUICK TOOLS
            </Text>
            <Group gap={4}>
              {onNavigate && (
                <>
                  <ActionIcon
                    variant="light"
                    size="sm"
                    color="violet"
                    onClick={() => onNavigate("wizard-preamble")}
                  >
                    <FontAwesomeIcon
                      icon={faWandMagicSparkles}
                      style={{ width: 14, height: 14 }}
                    />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    size="sm"
                    color="green"
                    onClick={() => onNavigate("wizard-table")}
                  >
                    <FontAwesomeIcon
                      icon={faTable}
                      style={{ width: 14, height: 14 }}
                    />
                  </ActionIcon>
                  <ActionIcon
                    variant="light"
                    size="sm"
                    color="orange"
                    onClick={() => onNavigate("wizard-tikz")}
                  >
                    <FontAwesomeIcon
                      icon={faPenNib}
                      style={{ width: 14, height: 14 }}
                    />
                  </ActionIcon>
                </>
              )}
            </Group>
          </Box>
          <Divider my={4} color="default-border" />

          {/* Project Folders Tree */}
          {projectData.length === 0 ? (
            <Box p="md" ta="center">
              <Text size="xs" c="dimmed" mb="xs">
                No folder opened
              </Text>
              {onOpenFolder && (
                <Group justify="center">
                  <Button size="xs" variant="default" onClick={onOpenFolder}>
                    Open Folder
                  </Button>
                </Group>
              )}
            </Box>
          ) : (
            <Box>
              {projectData.map((node) => {
                const treeNode: TreeNode = {
                  ...node,
                  isRoot: true,
                  children: node.children as TreeNode[] | undefined,
                };

                const projectConfig: TreeItemConfig = {
                  enableDragDrop: true,
                  enableContextMenu: true,
                  enableRename: true,
                };

                const projectCallbacks: TreeItemCallbacks = {
                  onFileClick: (n) =>
                    onOpenFileNode && onOpenFileNode(n as FileSystemNode),
                  onRename: onRenameItem
                    ? (n, newName) => onRenameItem(n as FileSystemNode, newName)
                    : undefined,
                  onDelete: onDeleteItem
                    ? (n) => onDeleteItem(n as FileSystemNode)
                    : undefined,
                  onCreate: (type, parentNode) => {
                    setCreatingItem({ type, parentId: parentNode.id });
                  },
                  onRemoveFolder: onRemoveFolder
                    ? (n) => onRemoveFolder(n.path)
                    : undefined,
                };

                return (
                  <UnifiedTreeItem
                    key={node.id}
                    node={treeNode}
                    level={0}
                    config={projectConfig}
                    callbacks={projectCallbacks}
                    selectedPath={selectedProjectNode?.path || null}
                    expandSignal={expandAllSignal}
                    collapseSignal={collapseAllSignal}
                    creatingState={creatingItem}
                    onCommitCreation={(name, type, parentPath) => {
                      if (onCreateItem) onCreateItem(name, type, parentPath);
                      setCreatingItem(null);
                    }}
                    onCancelCreation={() => setCreatingItem(null)}
                  />
                );
              })}
            </Box>
          )}
        </ScrollArea>
      ) : (
        /* COLLECTIONS VIEW */
        <>
          {collections.length === 0 && !isLoading && (
            <Text size="xs" c="dimmed" ta="center">
              No collections found.
            </Text>
          )}

          <Box style={{ flex: 1, overflowY: "auto" }} px={4}>
            <Stack gap={4}>
              {filteredCollections.map((col) => {
                const isLoaded = loadedCollections.includes(col.name);
                return (
                  <React.Fragment key={col.name}>
                    <Group
                      gap={0}
                      wrap="nowrap"
                      onMouseEnter={() => setHoveredCollection(col.name)}
                      onMouseLeave={() => setHoveredCollection(null)}
                      style={{
                        borderRadius: 4,
                        backgroundColor: isLoaded
                          ? "rgba(64, 192, 87, 0.1)"
                          : "transparent",
                        transition: "background-color 0.15s ease",
                        paddingRight: 4,
                      }}
                    >
                      <UnstyledButton
                        onClick={() => handleToggleCollection(col.name)}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                        }}
                      >
                        <Checkbox
                          checked={isLoaded}
                          onChange={() => {}}
                          size="xs"
                          styles={{
                            input: { cursor: "pointer" },
                          }}
                          tabIndex={-1}
                        />
                        <FontAwesomeIcon
                          icon={faDatabase}
                          style={{
                            width: 14,
                            height: 14,
                            color: isLoaded ? "#40c057" : "#868e96",
                            transition: "color 0.15s ease",
                          }}
                        />
                        <Text
                          size="sm"
                          truncate
                          style={{
                            color: isLoaded ? "#c9c9c9" : "#868e96",
                          }}
                        >
                          {col.name}
                        </Text>
                      </UnstyledButton>

                      <Menu shadow="md" width={200} position="bottom-end">
                        <Menu.Target>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="gray"
                            style={{
                              opacity: hoveredCollection === col.name ? 1 : 0,
                              transition: "opacity 0.2s",
                            }}
                          >
                            <FontAwesomeIcon
                              icon={faEllipsisVertical}
                              style={{ width: 14, height: 14 }}
                            />
                          </ActionIcon>
                        </Menu.Target>

                        <Menu.Dropdown>
                          <Menu.Label>Collection Options</Menu.Label>
                          <Menu.Item
                            leftSection={
                              <FontAwesomeIcon
                                icon={faPlus}
                                style={{ width: 14 }}
                              />
                            }
                            onClick={() =>
                              handleAddFolderToCollection(col.name)
                            }
                          >
                            Add Folder...
                          </Menu.Item>
                          <Divider my={4} />
                          <Menu.Item
                            color="red"
                            leftSection={
                              <FontAwesomeIcon
                                icon={faTrash}
                                style={{ width: 14 }}
                              />
                            }
                            onClick={(e) =>
                              handleDeleteClick(col.name, e as any)
                            }
                          >
                            Delete Collection
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>

                    {/* Render Nested File Tree if Loaded */}
                    {isLoaded && (
                      <Box pl={0}>
                        {(() => {
                          // Find the root node for this collection in the pre-built fileTree
                          const collectionNode = fileTree.find(
                            (n) => n.name === col.name
                          ); // Usually name matches id or we matched them in generation
                          if (
                            !collectionNode ||
                            !collectionNode.children ||
                            collectionNode.children.length === 0
                          ) {
                            return (
                              <Text
                                size="xs"
                                c="dimmed"
                                fs="italic"
                                pl="lg"
                                py={4}
                              >
                                Empty
                              </Text>
                            );
                          }
                          return collectionNode.children.map((childNode) => (
                            <UnifiedTreeItem
                              key={childNode.id}
                              node={childNode}
                              level={1} // Indent level 1
                              config={treeConfig}
                              callbacks={treeCallbacks}
                              selectedPath={selectedPath}
                              expandSignal={expandAllSignal}
                              collapseSignal={collapseAllSignal}
                            />
                          ));
                        })()}
                      </Box>
                    )}
                  </React.Fragment>
                );
              })}
            </Stack>
          </Box>
          {loadedCollections.length > 0 && (
            <Box
              px={4}
              py={4}
              style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
            >
              <Text size="xs" c="dimmed">
                {loadedCollections.length} collection
                {loadedCollections.length > 1 ? "s" : ""} loaded
              </Text>
            </Box>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={cancelDelete}
        title="Διαγραφή Συλλογής"
        centered
        size="md"
      >
        <Stack gap="md">
          <Text>
            Είστε σίγουροι ότι θέλετε να διαγράψετε τη συλλογή{" "}
            <Text component="span" fw={700}>
              "{collectionToDelete}"
            </Text>
            ;
          </Text>
          <Text size="sm" c="dimmed">
            ⚠️ Προσοχή: Αυτή η ενέργεια θα διαγράψει τη συλλογή και όλα τα
            resources της από τη βάση δεδομένων, αλλά{" "}
            <Text component="span" fw={700}>
              ΔΕΝ θα διαγράψει
            </Text>{" "}
            τα αρχεία από το σύστημα αρχείων σας.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={cancelDelete}>
              Ακύρωση
            </Button>
            <Button color="red" onClick={confirmDelete}>
              Διαγραφή
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Create Collection Modal */}
      <Modal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="New Collection"
        centered
        size="sm"
      >
        <Stack>
          <TextInput
            label="Collection Name"
            placeholder="e.g., Mathematics, Physics"
            data-autofocus
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateCollection();
            }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCollection}>Create</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
