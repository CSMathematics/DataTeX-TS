import React, { useEffect, useMemo, useCallback, useState } from "react";
import {
  Stack,
  Text,
  Box,
  Modal,
  Button,
  Group,
  ActionIcon,
  ScrollArea,
  Divider,
  Tree,
  TreeNodeData,
  useTree,
  Tooltip,
  TextInput,
  MultiSelect,
  Checkbox,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faSync,
  faFolder,
  faTrash,
  faTable,
  faFolderOpen,
  faFile,
  faChevronRight,
  faFilePdf,
  faFileImage,
  faFileCode,
  faBook,
  faDatabase,
  faSearch,
  faCompress,
  faExpand,
} from "@fortawesome/free-solid-svg-icons";
import { useDatabaseStore } from "../../stores/databaseStore";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";

// Import shared tree components
import {
  TreeNode,
  TreeToolbar,
  TreeSearchInput,
  useTreeState,
  ToolbarAction,
} from "../shared/tree";
import { FileSystemNode } from "../layout/Sidebar";

// Props for project folder operations
interface DatabaseSidebarProps {
  // Project folder operations (passed from App.tsx)
  onOpenFolder?: () => void;
  onRemoveFolder?: (path: string) => void;
  onOpenFileNode?: (node: FileSystemNode) => void;
  onCreateItem?: (
    name: string,
    type: "file" | "folder",
    parentPath: string,
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
export const DatabaseSidebar = ({ onOpenFileNode }: DatabaseSidebarProps) => {
  const { t } = useTranslation();

  // Granular selectors - prevents re-renders when unrelated state changes
  const collections = useDatabaseStore((state) => state.collections);
  const fetchCollections = useDatabaseStore((state) => state.fetchCollections);
  const loadedCollections = useDatabaseStore(
    (state) => state.loadedCollections,
  );
  const setLoadedCollections = useDatabaseStore(
    (state) => state.setLoadedCollections,
  );

  const importFolder = useDatabaseStore((state) => state.importFolder);

  const importFile = useDatabaseStore((state) => state.importFile);
  const deleteCollection = useDatabaseStore((state) => state.deleteCollection);

  const allLoadedResources = useDatabaseStore(
    (state) => state.allLoadedResources,
  );
  const selectResource = useDatabaseStore((state) => state.selectResource);
  const activeResourceId = useDatabaseStore((state) => state.activeResourceId);
  const createCollection = useDatabaseStore((state) => state.createCollection);

  const addFolderToCollection = useDatabaseStore(
    (state) => state.addFolderToCollection,
  );

  const createResource = useDatabaseStore((state) => state.createResource);
  const deleteResource = useDatabaseStore((state) => state.deleteResource);
  const createFolder = useDatabaseStore((state) => state.createFolder);
  const toggleCollectionLoaded = useDatabaseStore(
    (state) => state.toggleCollectionLoaded,
  );

  const tree = useTree();

  // Use shared tree state hook
  const {
    isToggleExpanded,
    searchQuery,
    setSearchQuery,
    toggleExpandState,
    filterNodes,
  } = useTreeState<TreeNode>();

  // Toggle tree expansion when toolbar button is clicked
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);

  // Helper to get all folder paths for expansion
  const getAllFolderPaths = useCallback((nodes: TreeNode[]): string[] => {
    let paths: string[] = [];
    nodes.forEach((node) => {
      if (node.type === "folder" || node.children) {
        paths.push(node.path);
        if (node.children) {
          paths = paths.concat(getAllFolderPaths(node.children));
        }
      }
    });
    return paths;
  }, []);

  // Toggle tree expansion when toolbar button is clicked
  const handleToggleExpand = useCallback(() => {
    // 1. Update visual state (icon)
    toggleExpandState();

    // 2. Perform actual expansion/collapse
    // We toggle based on the *current* state before update, so if it WAS expanded (true), we are collapsing.
    // Wait, toggleExpandState updates the state. We should look at the *next* state or just check the current value of isToggleExpanded.
    // If isToggleExpanded is true, it means we are currently in "Expanded" mode (showing collapse icon?), and clicking it means we want to COLLAPSE?
    // Let's check the toolbar icon logic.
    // Icon logic usually: if isToggleExpanded, show "Collapse All", else show "Expand All".
    // So if isToggleExpanded is currently TRUE, we want to COLLAPSE.

    // Actually, let's look at how it matches.
    // If isToggleExpanded is false (default), we want to expand.

    const nextStateIsExpanded = !isToggleExpanded;

    if (nextStateIsExpanded) {
      if (typeof (tree as any).expandAll === "function") {
        (tree as any).expandAll();
      } else if (typeof (tree as any).setExpandedState === "function") {
        const allPaths = getAllFolderPaths(fileTree);
        const newState = allPaths.reduce(
          (acc, path) => ({ ...acc, [path]: true }),
          {},
        );
        (tree as any).setExpandedState(newState);
      }
    } else {
      if (typeof (tree as any).collapseAll === "function") {
        (tree as any).collapseAll();
      } else if (typeof (tree as any).setExpandedState === "function") {
        (tree as any).setExpandedState({});
      }
    }
  }, [toggleExpandState, isToggleExpanded, tree, fileTree, getAllFolderPaths]);

  // Local state
  const [activeView, setActiveView] = useState<"collections" | "statistics">(
    "collections",
  );
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    type: "collection" | "file" | "folder";
    name: string;
    id: string; // For collection -> name, For file -> id
    path?: string; // Required for folder cascading delete
  } | null>(null);

  const [creatingCollectionItem, setCreatingCollectionItem] = useState<{
    type: "file" | "folder";
    parentId: string;
    parentPath: string;
    collectionName: string;
  } | null>(null);

  // Focus state for visual selection
  const [focusedPath, setFocusedPath] = useState<string | null>(null);

  // Sync activeResource to focusedPath
  useEffect(() => {
    if (activeResourceId) {
      const resource = allLoadedResources.find(
        (r) => r.id === activeResourceId,
      );
      if (resource) {
        setFocusedPath(resource.path);
      }
    }
  }, [activeResourceId, allLoadedResources]);

  // Helper: Normalize path
  const normalizePath = useCallback(
    (p: string) => p.replace(/\\/g, "/").replace(/\/$/, ""),
    [],
  );

  // Helper: Find a node by path
  const findNodeByPath = useCallback(
    (nodes: TreeNode[], path: string): TreeNode | null => {
      const target = normalizePath(path);
      for (const node of nodes) {
        if (normalizePath(node.path) === target) return node;
        if (node.children) {
          const found = findNodeByPath(node.children, path);
          if (found) return found;
        }
      }
      return null;
    },
    [normalizePath],
  );

  // Handler for creating new collection
  const handleCreateCollection = useCallback(async () => {
    // Open native directory selection dialog
    // Use dynamic import for Tauri generic compatibility if needed, or assume standard
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Database Folder",
      });

      if (selected && typeof selected === "string") {
        const name = selected.split(/[/\\]/).pop() || "New Database";
        // We could ask for a name override, but simplest is folder name.
        await createCollection(name, selected);
      }
    } catch (err) {
      console.error("Failed to pick folder:", err);
    }
  }, [createCollection]);

  // --- Build file tree from resources (FETCH FROM RUST) ---

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // --- New Logic to Populate File Tree ---
  useEffect(() => {
    if (!collections || collections.length === 0) {
      setFileTree([]);
      return;
    }

    const buildTree = () => {
      // 1. Create root nodes for each collection
      const roots: TreeNode[] = collections.map((col) => ({
        id: col.name, // Using name as ID for root (matches logic elsewhere)
        name: col.name,
        type: "folder",
        path: col.path || "",
        children: [],
      }));

      // 2. Populate each collection with its resources
      allLoadedResources.forEach((resource) => {
        // Find which collection this resource belongs to
        const root = roots.find((r) => r.name === resource.collection);
        if (!root) return;

        // Skip if resource has no path
        if (!resource.path) return;

        // Determine relative path parts (basic implementation)
        // Ensure paths are normalized
        const rootPath = normalizePath(root.path);
        const resourcePath = normalizePath(resource.path);

        // If resource is not inside collection path, we might just list it at root?
        // Or we try to build hierarchy.
        // Let's assume standard behavior: resource.path starts with root.path
        let relativePath = "";
        if (resourcePath.startsWith(rootPath)) {
          relativePath = resourcePath.substring(rootPath.length);
        } else {
          // Fallback: just use full path or filename if outside logic
          relativePath = "/" + resourcePath.split("/").pop();
        }

        // Remove leading slash
        if (relativePath.startsWith("/")) relativePath = relativePath.slice(1);

        const parts = relativePath.split("/");
        let currentNode = root;

        parts.forEach((part, index) => {
          const isFile = index === parts.length - 1;
          const currentPath =
            rootPath + "/" + parts.slice(0, index + 1).join("/");

          if (!currentNode.children) currentNode.children = [];

          let child = currentNode.children.find((c) => c.name === part);

          if (!child) {
            const nodeType = isFile
              ? resource.kind === "folder"
                ? "folder"
                : "file"
              : "folder";
            child = {
              id: currentPath,
              name: part,
              type: nodeType,
              path: currentPath,
              children: [],
            };
            currentNode.children.push(child);
          }
          currentNode = child;
        });
      });

      // Sort: Folders first, then files, alphabetical
      const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === "folder" ? -1 : 1;
        });
        nodes.forEach((node) => {
          if (node.children) sortNodes(node.children);
        });
      };

      sortNodes(roots);

      setFileTree(roots);
    };

    buildTree();
  }, [collections, allLoadedResources, normalizePath]);

  // --- Handlers ---
  const handleImport = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        title: t("database.selectImportFolder"),
      });
      if (selected && typeof selected === "string") {
        const separator = selected.includes("\\") ? "\\" : "/";
        const name = selected.split(separator).pop() || "Imported";
        await importFolder(selected, name);
      }
    } catch (e) {
      console.error("Import failed", e);
    }
  }, [importFolder, t]);

  const handleAddFolderToCollection = useCallback(
    async (collectionName: string) => {
      try {
        const selected = await open({
          directory: true,
          multiple: false,
          title: t("database.selectFolderToAdd"),
        });

        if (selected && typeof selected === "string") {
          await addFolderToCollection(collectionName, selected);
          await fetchCollections();
        }
      } catch (err) {
        console.error("Failed to add folder:", err);
      }
    },
    [addFolderToCollection, t, fetchCollections],
  );

  const handleImportFileToCollection = useCallback(
    async (collectionName: string) => {
      try {
        const selected = await open({
          directory: false,
          multiple: true,
          title: t("database.selectFileToImport"),
          filters: [
            {
              name: "TeX Files",
              extensions: ["tex", "sty", "cls", "bib", "pdf", "png", "jpg"],
            },
          ],
        });

        if (selected) {
          console.log("Selected files for import:", selected);
          const files = Array.isArray(selected) ? selected : [selected];
          for (const file of files) {
            console.log(
              "Importing file:",
              file,
              "to collection:",
              collectionName,
            );
            await importFile(file, collectionName);
          }
          await fetchCollections();
        }
      } catch (err) {
        console.error("Failed to import file:", err);
      }
    },
    [importFile, t, fetchCollections],
  );

  const handleDeleteClick = useCallback(
    (
      item: {
        type: "collection" | "file" | "folder";
        name: string;
        id: string;
        path?: string;
      },
      e: React.MouseEvent,
    ) => {
      e.stopPropagation();
      setItemToDelete(item);
      setDeleteModalOpen(true);
    },
    [],
  );

  const confirmDelete = useCallback(async () => {
    if (itemToDelete) {
      if (itemToDelete.type === "collection") {
        await deleteCollection(itemToDelete.id); // Collection ID is its name
      } else if (itemToDelete.type === "file") {
        await deleteResource(itemToDelete.id);
      } else if (itemToDelete.type === "folder") {
        // Folder deletion: Delete the explicit folder resource (if exists)
        // AND all descendant resources (implicit deletion of contents)

        const targets = allLoadedResources.filter((r) => {
          // Match explicit folder or descendants
          if (itemToDelete.id && r.id === itemToDelete.id) return true;
          if (itemToDelete.path) {
            const rPath = normalizePath(r.path);
            const folderPath = normalizePath(itemToDelete.path);
            return rPath === folderPath || rPath.startsWith(folderPath + "/");
          }
          return false;
        });

        // Delete all identified resources
        for (const target of targets) {
          await deleteResource(target.id);
        }
      }
      setDeleteModalOpen(false);
      setItemToDelete(null);
    }
  }, [
    itemToDelete,
    deleteCollection,
    deleteResource,
    allLoadedResources,
    normalizePath,
  ]);

  const cancelDelete = useCallback(() => {
    setDeleteModalOpen(false);
    setItemToDelete(null);
  }, []);

  const handleStartCreation = useCallback(
    (collectionName: string, type: "file" | "folder") => {
      // Find collection in store to get its path (if newly created)
      const collection = collections.find((c) => c.name === collectionName);
      let targetPath = collection?.path || "";

      // Find collection root node in tree (if it has files)
      const collectionNode = fileTree.find((n) => n.name === collectionName);

      let targetNode = collectionNode;

      // If no tree node (empty collection), use collection path
      if (!collectionNode) {
        if (!targetPath) {
          console.warn(
            `Collection '${collectionName}' not found or has no path.`,
          );
          return;
        }
      } else {
        // We have a tree node, maybe we are selecting a subfolder?
        if (targetNode) targetPath = targetNode.path;
      }

      // Check if we have a focused path (file or folder) that belongs to this collection
      if (focusedPath && collectionNode) {
        // Verify the focused path belongs to this collection tree
        const targetInCollection = findNodeByPath(
          [collectionNode],
          focusedPath,
        );

        if (targetInCollection) {
          const selectedNode = targetInCollection;
          if (selectedNode.type === "folder") {
            targetPath = selectedNode.path;
            targetNode = selectedNode;
          } else {
            // If selected item is file, find its parent
            const findParent = (
              paramsNodes: TreeNode[],
              tgt: string,
            ): TreeNode | null => {
              for (const node of paramsNodes) {
                if (node.children) {
                  if (
                    node.children.some(
                      (c) => normalizePath(c.path) === normalizePath(tgt),
                    )
                  )
                    return node;
                  const found = findParent(node.children, tgt);
                  if (found) return found;
                }
              }
              return null;
            };
            const parent = findParent([collectionNode], focusedPath);
            if (parent) {
              targetPath = parent.path;
              targetNode = parent;
            }
          }
        }
      }

      if (!targetPath) {
        return;
      }

      // Delay setting state to allow Menu to close and restore focus
      setTimeout(() => {
        setCreatingCollectionItem({
          type,
          parentId: targetNode?.id || collectionName,
          parentPath: targetPath,
          collectionName: collectionName, // Store collection name directly
        });
      }, 100);
    },
    [fileTree, collections, findNodeByPath, focusedPath, normalizePath],
  );

  // --- Collections filtering ---

  const mapNode = useCallback(
    (node: TreeNode): TreeNodeData => {
      const ALLOWED_EXTENSIONS = [
        "tex",
        "bib",
        "pdf",
        "png",
        "jpg",
        "jpeg",
        "sty",
        "cls",
        "dtx",
        "ins",
      ];

      let children: TreeNodeData[] = [];
      if (node.children) {
        children = node.children
          .filter((child) => {
            if (child.type === "folder") return true;
            const ext = child.name.split(".").pop()?.toLowerCase();
            return ALLOWED_EXTENSIONS.includes(ext || "");
          })
          .map(mapNode);
      }

      // Inject "Creating" node if matches
      if (
        creatingCollectionItem &&
        creatingCollectionItem.parentPath === node.path
      ) {
        children.push({
          value: `__creating__${node.path}`,
          label: "",
          nodeProps: {
            "data-type": "creating_input",
            "data-collection": "UNKNOWN_IN_RECURSION",
          },
        });
      }

      return {
        value: node.path,
        label: node.name,
        children: children.length > 0 ? children : undefined,
        nodeProps: {
          "data-type": node.type,
          "data-path": node.path,
        },
      };
    },
    [creatingCollectionItem],
  );

  const handleCommitCreation = useCallback(
    async (name: string, type: "file" | "folder") => {
      if (!creatingCollectionItem) {
        return;
      }

      // Use the stored collection name from state
      const collectionName = creatingCollectionItem.collectionName;
      const parentPath = creatingCollectionItem.parentPath;

      if (!collectionName) {
        console.error("Collection name not found in creating state");
        return;
      }

      // Construct full path
      const separator = parentPath.includes("\\") ? "\\" : "/";
      let fullPath = `${parentPath}${separator}${name}`;

      // Add extension for files if missing (custom logic or rely on user?)
      if (type === "file" && !name.includes(".")) {
        fullPath += ".tex"; // Default to .tex if no extension provided? Or just let user type.
      }

      try {
        // Ensure the collection is loaded so the new resource will appear
        if (!loadedCollections.includes(collectionName)) {
          await toggleCollectionLoaded(collectionName);
        }

        if (type === "file") {
          await createResource(fullPath, collectionName, "");
        } else {
          await createFolder(fullPath, collectionName);
        }
        // Wait a bit for the store's refresh to complete
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch (err) {
        console.error("Failed to create item:", err);
      } finally {
        setCreatingCollectionItem(null);
      }
    },
    [
      creatingCollectionItem,
      fileTree,
      collections,
      createResource,
      createFolder,
    ],
  );

  // --- Folder click handler ---
  const handleFolderClick = useCallback((node: TreeNode) => {
    setFocusedPath(node.path);
  }, []);

  // --- File click handler ---
  const handleFileClick = useCallback(
    (node: TreeNode) => {
      // Visual select
      setFocusedPath(node.path);

      const resource = allLoadedResources.find((r) => r.path === node.path);
      if (resource) {
        selectResource(resource.id);
        if (onOpenFileNode) {
          onOpenFileNode({
            id: resource.path,
            name: node.name,
            path: resource.path,
            type: "file",
            children: [],
          });
        }
      }
    },
    [allLoadedResources, selectResource, onOpenFileNode],
  );

  // --- Statistics Logic ---
  const statistics = useMemo(() => {
    return loadedCollections.map((colName) => {
      const colResources = allLoadedResources.filter(
        (r) => r.collection === colName,
      );
      const fileCount = colResources.length;
      let chapterCount = 0;
      let sectionCount = 0;
      let imageCount = 0;
      let citationCount = 0;
      let lastModified: string | null = null;
      const fileTypes: Record<string, number> = {};

      colResources.forEach((r) => {
        // Track last modified
        if (r.updated_at) {
          if (
            !lastModified ||
            new Date(r.updated_at) > new Date(lastModified)
          ) {
            lastModified = r.updated_at;
          }
        }

        // Track file types
        if (r.path) {
          const ext = r.path.split(".").pop()?.toLowerCase() || "unknown";
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }

        if (r.metadata) {
          // Check if metadata has chapters/sections arrays or counts
          if (Array.isArray(r.metadata.chapters)) {
            chapterCount += r.metadata.chapters.length;
          }
          if (Array.isArray(r.metadata.sections)) {
            sectionCount += r.metadata.sections.length;
          }
          if (Array.isArray(r.metadata.requiredImages)) {
            imageCount += r.metadata.requiredImages.length;
          }
          if (Array.isArray(r.metadata.bibliography)) {
            citationCount += r.metadata.bibliography.length;
          }
        }
      });

      return {
        name: colName,
        fileCount,
        chapterCount,
        sectionCount,
        imageCount,
        citationCount,
        lastModified,
        fileTypes,
      };
    });
  }, [loadedCollections, allLoadedResources]);

  const handleDeleteSelected = useCallback(() => {
    if (!focusedPath) return;

    // 1. Check if it's a Collection (Root) - often name == path for roots in some logic, or name is key.
    // In fileTree, roots have id=name, path=path.
    // focusedPath is the 'path' property.

    // Check if focusedPath matches a collection's path
    const collectionByPath = collections.find(
      (c) => normalizePath(c.path || "") === normalizePath(focusedPath),
    );
    const collectionByName = collections.find((c) => c.name === focusedPath); // fallback if focusedPath is just name

    const collection = collectionByPath || collectionByName;

    if (collection) {
      handleDeleteClick(
        { type: "collection", name: collection.name, id: collection.name },
        { stopPropagation: () => {} } as any,
      );
      return;
    }

    // 2. Resource or Implicit Folder
    // We check for any resource matching the path.
    const resource = allLoadedResources.find(
      (r) => normalizePath(r.path) === normalizePath(focusedPath),
    );

    if (resource) {
      const type = resource.kind === "folder" ? "folder" : "file";
      handleDeleteClick(
        {
          type: type as "file" | "folder",
          name:
            resource.path.split(/[/\\]/).pop() ||
            (type === "folder" ? "Folder" : "File"),
          id: resource.id,
          path: resource.path,
        },
        { stopPropagation: () => {} } as any,
      );
      return;
    }

    // 3. Implicit Folder (not a resource itself, but deeper path in tree)
    // Check if any resources start with this path
    const isImplicitFolder = allLoadedResources.some((r) =>
      normalizePath(r.path).startsWith(normalizePath(focusedPath) + "/"),
    );

    if (isImplicitFolder) {
      handleDeleteClick(
        {
          type: "folder",
          name: focusedPath.split(/[/\\]/).pop() || "Folder",
          id: "", // No direct ID
          path: focusedPath,
        },
        { stopPropagation: () => {} } as any,
      );
      return;
    }
  }, [
    focusedPath,
    collections,
    allLoadedResources,
    handleDeleteClick,
    normalizePath,
  ]);

  // Toolbar Actions including View Toggle
  const toolbarActions: ToolbarAction[] = useMemo(() => {
    const actions: ToolbarAction[] = [
      {
        icon: faPlus,
        tooltip: t("database.createCollection"),
        onClick: () => handleCreateCollection(),
      },
      {
        icon: faSearch,
        tooltip: "Toggle Search",
        variant: isSearchVisible ? "filled" : "light",
        onClick: () => setIsSearchVisible((v) => !v),
      },
      // Toggle View Action
      {
        icon: activeView === "collections" ? faTable : faDatabase, // Icon to switch TO the other view
        tooltip:
          activeView === "collections" ? "Show Statistics" : "Show Files",
        onClick: () =>
          setActiveView((v) =>
            v === "collections" ? "statistics" : "collections",
          ),
        variant: "subtle",
      },
      {
        icon: isToggleExpanded ? faCompress : faExpand,
        tooltip: isToggleExpanded ? t("file.collapseAll") : t("file.expandAll"),
        onClick: handleToggleExpand,
      },
      {
        icon: faSync,
        tooltip: t("common.refresh"),
        onClick: () => fetchCollections(),
      },
    ];

    if (activeView === "collections") {
      actions.splice(3, 0, {
        icon: faFolder,
        tooltip: t("database.importFolderAsCollection"),
        onClick: handleImport,
      });
    }

    return actions;
  }, [
    activeView,
    fetchCollections,
    handleCreateCollection,
    handleImport,
    t,
    isToggleExpanded,
    handleToggleExpand,
  ]);

  const renderTreeNode = useCallback(
    ({ node, expanded, elementProps, level }: any) => {
      const type = node.nodeProps?.["data-type"];
      const indentSize = 1.2;

      if (type === "empty_placeholder") {
        return (
          <Text
            size="xs"
            c="dimmed"
            fs="italic"
            py={4}
            pl={`calc(${level * indentSize}rem + 24px)`}
          >
            {node.label}
          </Text>
        );
      }

      if (type === "creating_input") {
        return (
          <Box
            py={2}
            style={{
              width: "100%",
              paddingLeft: `calc(${level * indentSize}rem + 24px)`,
            }}
          >
            <TextInput
              size="xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCommitCreation(
                    e.currentTarget.value,
                    creatingCollectionItem!.type,
                  );
                } else if (e.key === "Escape") {
                  setCreatingCollectionItem(null);
                }
              }}
              onBlur={() => setCreatingCollectionItem(null)}
              placeholder="Name..."
            />
          </Box>
        );
      }

      // File/Folder Node
      const isFolder = type === "folder";
      const path = node.value as string;
      const isCollectionRoot = level === 1; // Assuming collections are at level 1

      const getFileIcon = (name: string) => {
        const ext = name.split(".").pop()?.toLowerCase();
        switch (ext) {
          case "tex":
            return { icon: faFileCode, color: "#4dabf7" };
          case "bib":
            return { icon: faBook, color: "#ffa94d" };
          case "pdf":
            return { icon: faFilePdf, color: "#e03131" };
          case "png":
          case "jpg":
          case "jpeg":
            return { icon: faFileImage, color: "#be4bdb" };
          case "sty":
            return { icon: faFileCode, color: "#fcc419" };
          case "cls":
            return { icon: faFileCode, color: "#40c057" };
          case "dtx":
          case "ins":
            return { icon: faFile, color: "#adb5bd" };
          default:
            return { icon: faFile, color: "#4dabf7" };
        }
      };

      const { icon: fileIcon, color: fileColor } = isFolder
        ? { icon: expanded ? faFolderOpen : faFolder, color: "#dcb67a" }
        : getFileIcon(node.label as string);

      return (
        <React.Fragment>
          {isCollectionRoot && node.value !== filteredTreeData[0]?.value && (
            <Divider my="xs" variant="dashed" />
          )}
          <Group
            gap={6}
            wrap="nowrap"
            {...elementProps}
            onClick={(e) => {
              elementProps.onClick(e);
              if (isFolder) {
                handleFolderClick({
                  path,
                  name: node.label,
                  type: "folder",
                  id: path,
                } as any);
              } else {
                handleFileClick({
                  path,
                  name: node.label,
                  type: "file",
                  id: path,
                } as any);
              }
            }}
            style={{
              paddingLeft: `calc(${level * indentSize}rem + 0px)`,
              paddingTop: 2,
              paddingBottom: 2,
              cursor: "pointer",
              backgroundColor:
                focusedPath === path
                  ? "var(--mantine-color-blue-light-hover)"
                  : "transparent",
              border:
                focusedPath === path
                  ? "1px solid var(--mantine-color-blue-light-color)"
                  : "1px solid transparent",
              borderRadius: 4,
              alignItems: "center",
              width: "100%",
            }}
          >
            {/* Chevron for expansion */}
            <Box
              w={14}
              style={{
                display: "flex",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isFolder && (
                <FontAwesomeIcon
                  icon={faChevronRight}
                  style={{
                    width: 10,
                    height: 10,
                    transition: "transform 0.2s",
                    transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                    color: "#868e96",
                  }}
                />
              )}
            </Box>

            <FontAwesomeIcon
              icon={fileIcon}
              style={{
                color: fileColor,
                width: 12,
                height: 12,
              }}
            />
            <Text size="xs" truncate style={{ lineHeight: 1.2, flex: 1 }}>
              {node.label}
            </Text>

            {isCollectionRoot && (
              <Group gap={1} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                <Tooltip label={t("database.newFile")} withArrow position="top">
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray.4"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartCreation(node.label as string, "file");
                    }}
                  >
                    <FontAwesomeIcon icon={faFile} style={{ height: 12 }} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  label={t("database.newFolder")}
                  withArrow
                  position="top"
                >
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray.4"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartCreation(node.label as string, "folder");
                    }}
                  >
                    <FontAwesomeIcon icon={faFolder} style={{ height: 12 }} />
                  </ActionIcon>
                </Tooltip>
                {/* Import Actions */}
                <Tooltip
                  label={t("database.importFile")}
                  withArrow
                  position="top"
                >
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray.4"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImportFileToCollection(node.label as string);
                    }}
                  >
                    <FontAwesomeIcon icon={faPlus} style={{ height: 12 }} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  label={t("database.addFolder")}
                  withArrow
                  position="top"
                >
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray.4"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddFolderToCollection(node.label as string);
                    }}
                  >
                    <FontAwesomeIcon
                      icon={faFolderOpen}
                      style={{ height: 12 }}
                    />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label={t("common.delete")} withArrow position="top">
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    disabled={
                      !focusedPath ||
                      !normalizePath(focusedPath).startsWith(
                        normalizePath(node.value as string),
                      )
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSelected();
                    }}
                  >
                    <FontAwesomeIcon icon={faTrash} style={{ height: 12 }} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Group>
        </React.Fragment>
      );
    },
    [
      focusedPath,
      creatingCollectionItem,
      handleFolderClick,
      handleFileClick,
      handleCommitCreation,
      setCreatingCollectionItem,
    ],
  );

  const filteredTreeData = useMemo(() => {
    // 1. Filter roots by loaded collections
    const visibleRoots = fileTree.filter((node) =>
      loadedCollections.includes(node.id),
    );

    // 2. Filter content by search query
    const searchedRoots = filterNodes(visibleRoots, searchQuery);

    // 3. Map to Mantine data format
    return searchedRoots.map(mapNode);
  }, [fileTree, loadedCollections, searchQuery, filterNodes, mapNode]);

  return (
    <Stack p="xs" gap="xs" h="100%" style={{ overflow: "hidden" }}>
      {/* Header Toolbar */}
      <TreeToolbar
        title={
          activeView === "collections" ? t("database.title") : "Statistics"
        }
        actions={toolbarActions}
        // showExpandToggle={activeView === "collections"}
        isExpanded={isToggleExpanded}
        onToggleExpand={toggleExpandState}
      />

      {/* Toggleable Search Bar at Top */}
      {isSearchVisible && activeView === "collections" && (
        <Box
          px="xs"
          pb="xs"
          style={{
            borderBottom: "1px solid var(--mantine-color-default-border)",
          }}
        >
          <TreeSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery("")}
            placeholder={t("database.searchCollections")}
          />
        </Box>
      )}

      {/* Collections MultiSelect - Always visible or only in Collections view? 
           User said "Eπιλέγοντας μια βάση... εμφανίζεται από κάτω ένα tree view".
           And "Searchbar στο κάτω μέρος" (old request).
           I will keep MultiSelect at top as it drives content for both views.
       */}
      <Stack gap="xs">
        <MultiSelect
          data={collections.map((c) => c.name)}
          value={loadedCollections}
          onChange={(val) => setLoadedCollections(val)}
          searchable
          clearable
          placeholder={t("database.selectCollections")}
          nothingFoundMessage={t("common.noResults")}
          size="sm"
          renderOption={({ option, checked }) => (
            <Group gap="sm">
              <Checkbox checked={checked} readOnly tabIndex={-1} size="xs" />
              <FontAwesomeIcon
                icon={faDatabase}
                style={{
                  width: 14,
                  height: 14,
                  color: checked ? "#4bc719ff" : "var(--app-color-text)",
                }}
              />
              <Text size="sm">{option.label}</Text>
            </Group>
          )}
          styles={{
            input: {
              backgroundColor: "var(--mantine-color-body)",
            },
          }}
        />
      </Stack>

      {/* Main Content Area */}
      <Box style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {activeView === "collections" ? (
          <ScrollArea h="100%">
            {loadedCollections.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" mt="xl">
                {t("database.selectCollectionToView")}
              </Text>
            ) : (
              <Tree
                data={filteredTreeData}
                levelOffset={14}
                expandOnClick={true}
                renderNode={renderTreeNode}
                tree={tree}
              />
            )}
            {/* Bottom padding */}
            <Box h={20} />
          </ScrollArea>
        ) : (
          <ScrollArea h="100%">
            <Stack gap="md" p="xs">
              {statistics.map((stat) => (
                <Box
                  key={stat.name}
                  p="sm"
                  style={{
                    border: "1px solid var(--mantine-color-default-border)",
                    borderRadius: "var(--mantine-radius-md)",
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <Text fw={700} size="sm">
                      {stat.name}
                    </Text>
                    <FontAwesomeIcon
                      icon={faDatabase}
                      style={{ color: "#4bc719" }}
                    />
                  </Group>
                  <Group gap="xl" mb="xs">
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">
                        Files
                      </Text>
                      <Text size="lg" fw={500}>
                        {stat.fileCount}
                      </Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">
                        Chapters
                      </Text>
                      <Text size="lg" fw={500}>
                        {stat.chapterCount}
                      </Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">
                        Sections
                      </Text>
                      <Text size="lg" fw={500}>
                        {stat.sectionCount}
                      </Text>
                    </Stack>
                  </Group>

                  {/* Enhanced Stats */}
                  <Group gap="xl" mb="xs">
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">
                        Images
                      </Text>
                      <Text size="lg" fw={500}>
                        {stat.imageCount}
                      </Text>
                    </Stack>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">
                        Citations
                      </Text>
                      <Text size="lg" fw={500}>
                        {stat.citationCount}
                      </Text>
                    </Stack>
                  </Group>

                  {/* File Types */}
                  <Text size="xs" c="dimmed" mt="xs" mb={4}>
                    File Types
                  </Text>
                  <Group gap="xs" style={{ flexWrap: "wrap" }}>
                    {Object.entries(stat.fileTypes).map(([ext, count]) => (
                      <Box
                        key={ext}
                        px={6}
                        py={2}
                        style={{
                          backgroundColor: "var(--mantine-color-default-hover)",
                          borderRadius: 4,
                        }}
                      >
                        <Text size="xs">
                          {ext}: {count}
                        </Text>
                      </Box>
                    ))}
                  </Group>

                  {/* Last Modified */}
                  {stat.lastModified && (
                    <Text size="xs" c="dimmed" mt="md" ta="right">
                      Updated:{" "}
                      {new Date(stat.lastModified).toLocaleDateString()}
                    </Text>
                  )}
                </Box>
              ))}
              {statistics.length === 0 && (
                <Text size="sm" c="dimmed" ta="center">
                  No databases loaded.
                </Text>
              )}
            </Stack>
          </ScrollArea>
        )}
      </Box>

      {/* Modals */}
      <Modal
        opened={deleteModalOpen}
        onClose={cancelDelete}
        title={t("database.deleteCollectionTitle")}
        centered
        size="md"
      >
        <Stack gap="md">
          <Text>
            {t("database.deleteCollectionConfirm")}{" "}
            <Text component="span" fw={700}>
              "{itemToDelete?.name || itemToDelete?.id}"
            </Text>
            ?
          </Text>
          <Text size="sm" c="dimmed">
            {t("database.deleteCollectionWarning")}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={cancelDelete}>
              {t("common.cancel")}
            </Button>
            <Button color="red" onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
