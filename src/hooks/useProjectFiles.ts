import { useState, useCallback } from "react";
import { FileSystemNode } from "../components/layout/Sidebar";
// Note: We'll import openTab/renameTab actions via props or store to keep hook reusable

interface UseProjectFilesOptions {
  onSetCompileError: (error: string | null) => void;
  onSetActiveActivity: (activity: string) => void;
  onAddToRecent: (path: string) => void;
  // Tab actions
  openTab: (tab: any) => void;
  renameTab: (oldId: string, newId: string, newTitle: string) => void;
  closeTab: (id: string) => void;
}

interface UseProjectFilesReturn {
  projectData: FileSystemNode[];
  projectRoots: string[];
  rootPath: string | null;
  loadingFiles: boolean;

  // Setters if needed directly
  setRootPath: React.Dispatch<React.SetStateAction<string | null>>;

  // Actions
  loadProjectFiles: (path: string) => Promise<void>;
  reloadProjectFiles: (roots: string[]) => Promise<void>;
  handleOpenFolder: () => Promise<void>;
  handleAddFolder: () => Promise<void>;
  handleRemoveFolder: (folderPath: string) => Promise<void>;
  handleOpenRecent: (path: string) => Promise<void>;
  handleCreateItem: (
    name: string,
    type: "file" | "folder",
    parentPath: string,
  ) => Promise<void>;
  handleRenameItem: (node: FileSystemNode, newName: string) => Promise<void>;
  handleDeleteItem: (node: FileSystemNode) => Promise<void>;
  handleMoveItem: (sourcePath: string, targetPath: string) => Promise<void>;
}

export function useProjectFiles({
  onSetCompileError,
  onSetActiveActivity,
  onAddToRecent,
  openTab,
  renameTab,
  closeTab,
}: UseProjectFilesOptions): UseProjectFilesReturn {
  const [projectData, setProjectData] = useState<FileSystemNode[]>([]);
  const [projectRoots, setProjectRoots] = useState<string[]>([]);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // --- HELPER: Load Project Files ---
  const loadFolderNode = async (rootPath: string): Promise<FileSystemNode> => {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const ignoredExtensions = [
      "aux",
      "log",
      "out",
      "toc",
      "synctex.gz",
      "fdb_latexmk",
      "fls",
      "bbl",
      "blg",
      "xdv",
      "lof",
      "lot",
      "nav",
      "snm",
      "vrb",
    ];

    const processDir = async (dirPath: string): Promise<FileSystemNode[]> => {
      const entries = await readDir(dirPath);
      const nodes: FileSystemNode[] = [];
      for (const entry of entries) {
        const name = entry.name;
        if (name.startsWith(".")) continue;
        if (name === "node_modules" || name === ".git") continue;

        const separator =
          dirPath.endsWith("/") || dirPath.endsWith("\\")
            ? ""
            : dirPath.includes("\\")
              ? "\\"
              : "/";
        const fullPath = `${dirPath}${separator}${name}`;

        if (entry.isDirectory) {
          const children = await processDir(fullPath);
          nodes.push({
            id: fullPath,
            name: name,
            type: "folder",
            path: fullPath,
            children: children,
          });
        } else {
          const ext = name.split(".").pop()?.toLowerCase();
          if (ext && ignoredExtensions.includes(ext)) continue;
          nodes.push({
            id: fullPath,
            name: name,
            type: "file",
            path: fullPath,
            children: [],
          });
        }
      }
      return nodes.sort((a, b) =>
        a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type === "folder"
            ? -1
            : 1,
      );
    };

    const children = await processDir(rootPath);
    const separator = rootPath.includes("\\") ? "\\" : "/";
    const cleanPath = rootPath.endsWith(separator)
      ? rootPath.slice(0, -1)
      : rootPath;
    const folderName = cleanPath.split(separator).pop() || rootPath;

    return {
      id: rootPath,
      name: folderName.toUpperCase(),
      type: "folder",
      path: rootPath,
      children: children,
    };
  };

  const reloadProjectFiles = async (roots: string[]) => {
    if (roots.length === 0) {
      setProjectData([]);
      return;
    }
    setLoadingFiles(true);
    try {
      const promises = roots.map((root) => loadFolderNode(root));
      const rootNodes = await Promise.all(promises);
      setProjectData(rootNodes);
    } catch (e) {
      console.error("Failed to load project database", e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const loadProjectFiles = useCallback(async (path: string) => {
    await reloadProjectFiles([path]);
  }, []);

  // --- Handlers ---

  const handleOpenFolder = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      });

      if (selectedPath && typeof selectedPath === "string") {
        setRootPath(selectedPath);
        const newRoots = [selectedPath];
        setProjectRoots(newRoots);
        await reloadProjectFiles(newRoots);
        onSetActiveActivity("database");
        onAddToRecent(selectedPath);
      }
    } catch (e) {
      onSetCompileError("Failed to open folder: " + String(e));
    }
  }, [onAddToRecent, onSetActiveActivity, onSetCompileError]);

  const handleAddFolder = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Add Folder to Workspace",
      });

      if (selectedPath && typeof selectedPath === "string") {
        setProjectRoots((prev) => {
          if (prev.includes(selectedPath)) return prev;
          const newRoots = [...prev, selectedPath];
          reloadProjectFiles(newRoots);
          return newRoots;
        });
        onSetActiveActivity("database");
      }
    } catch (e) {
      onSetCompileError("Failed to add folder: " + String(e));
    }
  }, [onSetActiveActivity, onSetCompileError]);

  const handleRemoveFolder = useCallback(
    async (folderPath: string) => {
      setProjectRoots((prev) => {
        const newRoots = prev.filter((r) => r !== folderPath);
        reloadProjectFiles(newRoots);
        return newRoots;
      });
      if (rootPath === folderPath) setRootPath(null);
    },
    [rootPath],
  );

  const handleOpenRecent = useCallback(
    async (path: string) => {
      try {
        setRootPath(path);
        const newRoots = [path];
        setProjectRoots(newRoots);
        await reloadProjectFiles(newRoots);
        onSetActiveActivity("database");
        onAddToRecent(path);
      } catch (e) {
        onSetCompileError("Failed to open recent project: " + String(e));
      }
    },
    [onAddToRecent, onSetActiveActivity, onSetCompileError],
  );

  const handleCreateItem = useCallback(
    async (name: string, type: "file" | "folder", parentPath: string) => {
      try {
        const basePath = parentPath === "root" ? rootPath : parentPath;
        if (!basePath) {
          console.error("No project root defined");
          return;
        }
        const separator = basePath.includes("\\") ? "\\" : "/";
        const fullPath = `${basePath}${separator}${name}`;
        const { writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");
        if (type === "file") {
          await writeTextFile(fullPath, "");
          openTab({
            id: fullPath,
            title: name,
            type: "editor",
            content: "",
            language: "latex",
          });
        } else {
          await mkdir(fullPath);
        }

        setProjectRoots((currentRoots) => {
          reloadProjectFiles(currentRoots);
          return currentRoots;
        });
      } catch (e) {
        onSetCompileError(`Failed to create ${type}: ${String(e)}`);
      }
    },
    [rootPath, openTab, onSetCompileError],
  );

  const handleRenameItem = useCallback(
    async (node: FileSystemNode, newName: string) => {
      try {
        const { rename: renameFs } = await import("@tauri-apps/plugin-fs");

        const lastSlashIndex = node.path.lastIndexOf(
          node.path.includes("\\") ? "\\" : "/",
        );
        const parentDir = node.path.substring(0, lastSlashIndex);
        const separator = node.path.includes("\\") ? "\\" : "/";
        const newPath = `${parentDir}${separator}${newName}`;

        await renameFs(node.path, newPath);

        if (node.type === "file") {
          renameTab(node.path, newPath, newName);
        }

        setProjectRoots((currentRoots) => {
          reloadProjectFiles(currentRoots);
          return currentRoots;
        });
      } catch (e) {
        onSetCompileError(`Failed to rename: ${String(e)}`);
      }
    },
    [renameTab, onSetCompileError],
  );

  const handleDeleteItem = useCallback(
    async (node: FileSystemNode) => {
      try {
        const { remove } = await import("@tauri-apps/plugin-fs");
        const { confirm } = await import("@tauri-apps/plugin-dialog");

        const confirmed = await confirm(
          `Are you sure you want to delete '${node.name}'?`,
          { title: "Delete Item", kind: "warning" },
        );
        if (!confirmed) return;

        await remove(node.path, { recursive: node.type === "folder" });

        if (node.type === "file") {
          closeTab(node.path);
        }

        setProjectRoots((currentRoots) => {
          reloadProjectFiles(currentRoots);
          return currentRoots;
        });
      } catch (e) {
        onSetCompileError(`Failed to delete: ${String(e)}`);
      }
    },
    [closeTab, onSetCompileError],
  );

  const handleMoveItem = useCallback(
    async (sourcePath: string, targetPath: string) => {
      try {
        const { rename: renameFs } = await import("@tauri-apps/plugin-fs");

        const sourceName = sourcePath.split(/[/\\]/).pop();
        if (!sourceName) return;

        const separator = targetPath.includes("\\") ? "\\" : "/";
        const newPath = `${targetPath}${separator}${sourceName}`;

        if (sourcePath === newPath) return;

        await renameFs(sourcePath, newPath);

        // Update tabs if open
        // Note: checking if tab is open requires access to tabs list, which we don't have here.
        // We might need to pass checking logic or just blind rename.
        // For simplicity, we just call renameTab - it should handle non-existent tabs gracefully or we assume success.
        renameTab(sourcePath, newPath, sourceName);

        setProjectRoots((currentRoots) => {
          reloadProjectFiles(currentRoots);
          return currentRoots;
        });
      } catch (e) {
        onSetCompileError(`Failed to move item: ${String(e)}`);
      }
    },
    [renameTab, onSetCompileError],
  );

  return {
    projectData,
    projectRoots,
    rootPath,
    loadingFiles,
    setRootPath,
    loadProjectFiles,
    reloadProjectFiles,
    handleOpenFolder,
    handleAddFolder,
    handleRemoveFolder,
    handleOpenRecent,
    handleCreateItem,
    handleRenameItem,
    handleDeleteItem,
    handleMoveItem,
  };
}
