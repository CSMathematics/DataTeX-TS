import React, { useState, useEffect, useCallback } from "react";
import {
  Stack,
  Text,
  Group,
  ScrollArea,
  ActionIcon,
  Button,
  Tooltip,
  Badge,
  Box,
  Loader,
  Paper,
  Collapse,
  Textarea,
  Modal,
  Menu,
  TextInput,
  Checkbox,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCodeBranch,
  faPlus,
  faMinus,
  faCheck,
  faUndo,
  faChevronRight,
  faChevronDown,
  faSync,
  faEye,
  faFolderPlus,
  faTrash,
  faCodeBranch as faBranch,
  faArrowUp,
  faArrowDown,
  faFileCode,
} from "@fortawesome/free-solid-svg-icons";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useDebouncedCallback } from "use-debounce";
import { DiffViewer, StructuredDiff } from "./DiffViewer";
import { GitGraph } from "./GitGraph";
import { getFileIcon } from "../shared/tree";

// Types from Rust backend
interface GitRepoInfo {
  path: string;
  branch: string | null;
  remote_url: string | null;
  is_dirty: boolean;
  head_commit: string | null;
}

interface GitFileStatus {
  path: string;
  status: string;
  is_staged: boolean;
}

interface GitCommitInfo {
  id: string;
  short_id: string;
  message: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parent_ids: string[];
}

interface BranchInfo {
  name: string;
  is_head: boolean;
  is_remote: boolean;
}

interface RemoteInfo {
  name: string;
  url: string;
}

interface GitPanelProps {
  projectPath: string | null;
  onOpenFile: (path: string) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({
  projectPath,
  onOpenFile,
}) => {
  const [repoInfo, setRepoInfo] = useState<GitRepoInfo | null>(null);
  const [stagedFiles, setStagedFiles] = useState<GitFileStatus[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<GitFileStatus[]>([]);
  const [commits, setCommits] = useState<GitCommitInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [structuredDiff, setStructuredDiff] = useState<StructuredDiff | null>(
    null,
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);

  // Branch state
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  const [gitignoreOpen, setGitignoreOpen] = useState(false);
  const [gitignoreContent, setGitignoreContent] = useState("");

  const [viewMode, setViewMode] = useState<"list" | "graph">("graph");

  // Stash state
  interface StashInfo {
    index: number;
    message: string;
    commit_id: string;
  }
  const [stashes, setStashes] = useState<StashInfo[]>([]);
  const [showStashes, setShowStashes] = useState(false);
  const [stashMessage, setStashMessage] = useState("");
  const [stashModalOpen, setStashModalOpen] = useState(false);

  // Amend state
  const [amendMode, setAmendMode] = useState(false);

  // Multi-select state
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(
    new Set(),
  );
  const [selectedStaged, setSelectedStaged] = useState<Set<string>>(new Set());

  // Detect repo on project path change
  const detectRepo = useCallback(async () => {
    if (!projectPath) {
      setRepoInfo(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const info = await invoke<GitRepoInfo | null>("git_detect_repo_cmd", {
        path: projectPath,
      });
      setRepoInfo(info);

      if (info) {
        await refreshStatus(info.path);
      }
    } catch (err) {
      console.error("Failed to detect repo:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    detectRepo();
  }, [detectRepo]);

  // Debounced refresh
  const debouncedRefresh = useDebouncedCallback((path: string) => {
    refreshStatus(path);
  }, 500);

  // Watch for changes
  useEffect(() => {
    if (!repoInfo) return;

    let unlisten: (() => void) | undefined;

    const startWatching = async () => {
      // Start watcher backend
      try {
        await invoke("git_watch_repo_cmd", { repoPath: repoInfo.path });
      } catch (e) {
        console.warn("Failed to start git watcher:", e);
      }

      // Listen for event
      unlisten = await listen("git-refresh", () => {
        debouncedRefresh(repoInfo.path);
      });
    };

    startWatching();

    return () => {
      // Cleanup
      if (unlisten) unlisten();
      invoke("git_unwatch_repo_cmd").catch((e) =>
        console.warn("Failed to stop git watcher:", e),
      );
    };
  }, [repoInfo?.path, debouncedRefresh]); // Depends on path changes

  const refreshStatus = async (repoPath: string) => {
    try {
      const statuses = await invoke<GitFileStatus[]>("git_status_cmd", {
        repoPath,
      });

      setStagedFiles(statuses.filter((f) => f.is_staged));
      setUnstagedFiles(statuses.filter((f) => !f.is_staged));

      // Fetch branches
      const branchList = await invoke<BranchInfo[]>("git_list_branches_cmd", {
        repoPath,
      });
      setBranches(branchList.filter((b) => !b.is_remote)); // Filter out remote branches for main list if desired, or keep all. Backend sorts them.

      // Fetch remotes
      try {
        const remoteList = await invoke<RemoteInfo[]>("git_list_remotes_cmd", {
          repoPath,
        });
        setRemotes(remoteList);
      } catch (e) {
        console.warn("Failed to list remotes:", e);
      }

      // Refresh repo info to ensure current branch is up to date
      const info = await invoke<GitRepoInfo | null>("git_detect_repo_cmd", {
        path: repoPath,
      });
      if (info) setRepoInfo(info);
    } catch (err) {
      console.error("Failed to get status:", err);
    }
  };

  const handleCreateBranch = async () => {
    if (!repoInfo || !newBranchName.trim()) return;
    try {
      await invoke("git_create_branch_cmd", {
        repoPath: repoInfo.path,
        name: newBranchName.trim(),
      });
      setNewBranchName("");
      setCreateBranchOpen(false);
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Failed to create branch:", err);
      setError(String(err));
    }
  };

  const handleSwitchBranch = async (name: string) => {
    if (!repoInfo) return;
    try {
      await invoke("git_switch_branch_cmd", {
        repoPath: repoInfo.path,
        name,
      });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Failed to switch branch:", err);
      setError(String(err));
    }
  };

  const handleDeleteBranch = async (name: string) => {
    if (!repoInfo) return;
    try {
      await invoke("git_delete_branch_cmd", {
        repoPath: repoInfo.path,
        name,
      });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Failed to delete branch:", err);
      setError(String(err));
    }
  };

  const handlePush = async () => {
    if (!repoInfo || !repoInfo.branch) return;
    setLoading(true);
    try {
      const remote = remotes.length > 0 ? remotes[0].name : "origin";
      await invoke("git_push_remote_cmd", {
        repoPath: repoInfo.path,
        remote,
        branch: repoInfo.branch,
      });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Push failed:", err);
      setError("Push failed: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    if (!repoInfo || !repoInfo.branch) return;
    setLoading(true);
    try {
      const remote = remotes.length > 0 ? remotes[0].name : "origin";
      await invoke("git_pull_remote_cmd", {
        repoPath: repoInfo.path,
        remote,
        branch: repoInfo.branch,
      });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Pull failed:", err);
      setError("Pull failed: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    if (!repoInfo) return;
    setLoading(true);
    try {
      const remote = remotes.length > 0 ? remotes[0].name : "origin";
      await invoke("git_fetch_remote_cmd", { repoPath: repoInfo.path, remote });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Fetch failed:", err);
      setError("Fetch failed: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGitignore = async () => {
    if (!repoInfo) return;
    try {
      const content = await invoke<string>("git_read_gitignore_cmd", {
        repoPath: repoInfo.path,
      });
      setGitignoreContent(content);
      setGitignoreOpen(true);
    } catch (err) {
      console.error("Failed to read .gitignore:", err);
      setError("Failed to read .gitignore: " + String(err));
    }
  };

  const handleSaveGitignore = async () => {
    if (!repoInfo) return;
    try {
      await invoke("git_write_gitignore_cmd", {
        repoPath: repoInfo.path,
        content: gitignoreContent,
      });
      setGitignoreOpen(false);
      refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Failed to write .gitignore:", err);
      setError("Failed to write .gitignore: " + String(err));
    }
  };

  // ============================================================================
  // Stash Handlers
  // ============================================================================

  const loadStashes = async () => {
    if (!repoInfo) return;
    try {
      const list = await invoke<StashInfo[]>("git_list_stashes_cmd", {
        repoPath: repoInfo.path,
      });
      setStashes(list);
    } catch (err) {
      console.error("Failed to load stashes:", err);
    }
  };

  const handleCreateStash = async () => {
    if (!repoInfo) return;
    try {
      await invoke("git_create_stash_cmd", {
        repoPath: repoInfo.path,
        message: stashMessage || null,
      });
      setStashMessage("");
      setStashModalOpen(false);
      await refreshStatus(repoInfo.path);
      await loadStashes();
    } catch (err) {
      console.error("Failed to create stash:", err);
      setError("Failed to create stash: " + String(err));
    }
  };

  const handleApplyStash = async (index: number) => {
    if (!repoInfo) return;
    try {
      await invoke("git_apply_stash_cmd", { repoPath: repoInfo.path, index });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Failed to apply stash:", err);
      setError("Failed to apply stash: " + String(err));
    }
  };

  const handlePopStash = async (index: number) => {
    if (!repoInfo) return;
    try {
      await invoke("git_pop_stash_cmd", { repoPath: repoInfo.path, index });
      await refreshStatus(repoInfo.path);
      await loadStashes();
    } catch (err) {
      console.error("Failed to pop stash:", err);
      setError("Failed to pop stash: " + String(err));
    }
  };

  const handleDropStash = async (index: number) => {
    if (!repoInfo) return;
    try {
      await invoke("git_drop_stash_cmd", { repoPath: repoInfo.path, index });
      await loadStashes();
    } catch (err) {
      console.error("Failed to drop stash:", err);
      setError("Failed to drop stash: " + String(err));
    }
  };

  // ============================================================================
  // Amend Handler
  // ============================================================================

  const handleAmendToggle = async (checked: boolean) => {
    setAmendMode(checked);
    if (checked && repoInfo) {
      // Pre-fill message from last commit
      try {
        const lastMsg = await invoke<string>(
          "git_get_last_commit_message_cmd",
          { repoPath: repoInfo.path },
        );
        setCommitMessage(lastMsg);
      } catch (err) {
        console.error("Failed to get last commit message:", err);
      }
    }
  };

  // ============================================================================
  // Multi-select Handlers
  // ============================================================================

  const toggleUnstagedSelection = (path: string) => {
    setSelectedUnstaged((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleStagedSelection = (path: string) => {
    setSelectedStaged((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleStageSelected = async () => {
    if (!repoInfo || selectedUnstaged.size === 0) return;
    setLoading(true);
    try {
      for (const path of selectedUnstaged) {
        await invoke("git_stage_file_cmd", {
          repoPath: repoInfo.path,
          filePath: path,
        });
      }
      setSelectedUnstaged(new Set());
      await refreshStatus(repoInfo.path);
    } catch (err) {
      setError("Failed to stage files: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUnstageSelected = async () => {
    if (!repoInfo || selectedStaged.size === 0) return;
    setLoading(true);
    try {
      for (const path of selectedStaged) {
        await invoke("git_unstage_file_cmd", {
          repoPath: repoInfo.path,
          filePath: path,
        });
      }
      setSelectedStaged(new Set());
      await refreshStatus(repoInfo.path);
    } catch (err) {
      setError("Failed to unstage files: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadCommitHistory = async () => {
    if (!repoInfo) return;

    try {
      const log = await invoke<GitCommitInfo[]>("git_log_cmd", {
        repoPath: repoInfo.path,
        limit: 200,
        all: true,
      });
      setCommits(log);
    } catch (err) {
      console.error("Failed to load commits:", err);
    }
  };

  useEffect(() => {
    if (showHistory && repoInfo) {
      loadCommitHistory();
    }
  }, [showHistory, repoInfo]);

  const handleStageFile = async (file: GitFileStatus) => {
    if (!repoInfo) return;

    try {
      await invoke("git_stage_file_cmd", {
        repoPath: repoInfo.path,
        filePath: file.path,
      });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Failed to stage file:", err);
    }
  };

  const handleUnstageFile = async (file: GitFileStatus) => {
    if (!repoInfo) return;

    try {
      await invoke("git_unstage_file_cmd", {
        repoPath: repoInfo.path,
        filePath: file.path,
      });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Failed to unstage file:", err);
    }
  };

  const handleStageAll = async () => {
    if (!repoInfo) return;

    try {
      await invoke("git_stage_all_cmd", { repoPath: repoInfo.path });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Failed to stage all:", err);
    }
  };

  const handleCommit = async () => {
    if (!repoInfo || !commitMessage.trim()) return;

    try {
      await invoke("git_commit_cmd", {
        repoPath: repoInfo.path,
        message: commitMessage,
      });
      setCommitMessage("");
      await refreshStatus(repoInfo.path);
      await loadCommitHistory();
    } catch (err) {
      console.error("Failed to commit:", err);
      setError(String(err));
    }
  };

  const handleDiscardChanges = async (file: GitFileStatus) => {
    if (!repoInfo) return;

    if (!window.confirm(`Discard changes in ${file.path}?`)) return;

    try {
      await invoke("git_discard_changes_cmd", {
        repoPath: repoInfo.path,
        filePath: file.path,
      });
      await refreshStatus(repoInfo.path);
    } catch (err) {
      console.error("Failed to discard changes:", err);
    }
  };

  const handleInitRepo = async () => {
    if (!projectPath) return;

    setInitLoading(true);
    setError(null);

    try {
      const info = await invoke<GitRepoInfo>("git_init_repo_cmd", {
        path: projectPath,
      });
      setRepoInfo(info);
    } catch (err) {
      console.error("Failed to initialize repo:", err);
      setError(String(err));
    } finally {
      setInitLoading(false);
    }
  };

  const handleViewDiff = async (file: GitFileStatus) => {
    if (!repoInfo) return;

    setSelectedFile(file.path);
    try {
      const diff = await invoke<StructuredDiff>("git_get_structured_diff_cmd", {
        repoPath: repoInfo.path,
        filePath: file.path,
      });
      setStructuredDiff(diff);
    } catch (err) {
      console.error("Failed to get diff:", err);
      setError("Failed to load diff: " + String(err));
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts * 1000);
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "modified":
        return "yellow";
      case "new":
      case "untracked":
        return "green";
      case "deleted":
        return "red";
      case "renamed":
        return "blue";
      default:
        return "gray";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "modified":
        return "M";
      case "new":
      case "untracked":
        return "A";
      case "deleted":
        return "D";
      case "renamed":
        return "R";
      default:
        return "?";
    }
  };

  if (!projectPath) {
    return (
      <Stack align="center" justify="center" h="100%" gap="sm">
        <FontAwesomeIcon
          icon={faCodeBranch}
          size="2x"
          style={{ opacity: 0.3 }}
        />
        <Text size="sm" c="dimmed">
          No project opened
        </Text>
      </Stack>
    );
  }

  if (loading) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Detecting repository...
        </Text>
      </Stack>
    );
  }

  if (!repoInfo) {
    return (
      <Stack align="center" justify="center" h="100%" gap="sm" p="md">
        <FontAwesomeIcon
          icon={faCodeBranch}
          size="2x"
          style={{ opacity: 0.3 }}
        />
        <Text size="sm" c="dimmed">
          Not a Git repository
        </Text>
        <Text size="xs" c="dimmed" ta="center" maw={200}>
          Initialize Git to track changes in this database
        </Text>
        <Button
          size="sm"
          variant="light"
          leftSection={<FontAwesomeIcon icon={faFolderPlus} />}
          onClick={handleInitRepo}
          loading={initLoading}
        >
          Initialize Repository
        </Button>
        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="sm" p="sm" h="100%" style={{ overflow: "hidden" }}>
      {/* Header */}
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs">
          <Menu shadow="md" width={250} position="bottom-start" withArrow>
            <Menu.Target>
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                leftSection={<FontAwesomeIcon icon={faBranch} />}
                rightSection={
                  <FontAwesomeIcon icon={faChevronDown} size="xs" />
                }
                styles={{
                  root: {
                    paddingLeft: 4,
                    paddingRight: 4,
                    height: 24,
                  },
                  label: {
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  },
                }}
              >
                {repoInfo.branch || "HEAD"}
              </Button>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Switch Branch</Menu.Label>
              <ScrollArea.Autosize mah={200}>
                {branches.length === 0 ? (
                  <Menu.Item disabled>No branches found</Menu.Item>
                ) : (
                  branches.map((branch) => (
                    <Menu.Item
                      key={branch.name}
                      leftSection={
                        branch.is_head ? (
                          <FontAwesomeIcon icon={faCheck} size="xs" />
                        ) : (
                          <Box w={12} />
                        )
                      }
                      onClick={() => handleSwitchBranch(branch.name)}
                      rightSection={
                        !branch.is_head &&
                        !branch.is_remote && (
                          <ActionIcon
                            size="xs"
                            color="red"
                            variant="subtle"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBranch(branch.name);
                            }}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </ActionIcon>
                        )
                      }
                    >
                      <Text size="xs" truncate>
                        {branch.name}
                      </Text>
                    </Menu.Item>
                  ))
                )}
              </ScrollArea.Autosize>
              <Menu.Divider />
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faPlus} />}
                onClick={() => setCreateBranchOpen(true)}
              >
                Create Branch...
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          {repoInfo.is_dirty && (
            <Badge size="xs" color="yellow">
              Uncommitted
            </Badge>
          )}
        </Group>
        <Group gap={0}>
          <Menu shadow="md" width={150}>
            <Menu.Target>
              <Tooltip label="Sync">
                <ActionIcon variant="subtle" size="sm">
                  <FontAwesomeIcon icon={faArrowUp} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Remote Operations</Menu.Label>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faSync} />}
                onClick={handleFetch}
              >
                Fetch
              </Menu.Item>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faArrowDown} />}
                onClick={handlePull}
              >
                Pull
              </Menu.Item>
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faArrowUp} />}
                onClick={handlePush}
              >
                Push
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<FontAwesomeIcon icon={faFileCode} />}
                onClick={handleOpenGitignore}
              >
                Edit .gitignore
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Tooltip label="Refresh">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => refreshStatus(repoInfo.path)}
            >
              <FontAwesomeIcon icon={faSync} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Error */}
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}

      {/* Commit Message */}
      <Textarea
        placeholder="Commit message..."
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        minRows={2}
        maxRows={4}
        size="xs"
      />

      <Group gap="xs">
        <Checkbox
          size="xs"
          label="Amend"
          checked={amendMode}
          onChange={(e) => handleAmendToggle(e.currentTarget.checked)}
          disabled={commits.length === 0}
        />
        <Tooltip label="Stash changes">
          <Button
            size="xs"
            variant="light"
            onClick={() => setStashModalOpen(true)}
            disabled={unstagedFiles.length === 0 && stagedFiles.length === 0}
          >
            Stash
          </Button>
        </Tooltip>
      </Group>

      <Button
        size="xs"
        disabled={
          !commitMessage.trim() || (stagedFiles.length === 0 && !amendMode)
        }
        onClick={handleCommit}
        leftSection={<FontAwesomeIcon icon={faCheck} />}
      >
        {amendMode ? "Amend Commit" : `Commit (${stagedFiles.length} staged)`}
      </Button>

      <ScrollArea style={{ flex: 1 }}>
        <Stack gap="xs">
          {/* Staged Changes */}
          <Box>
            <Group justify="space-between" mb={4}>
              <Group gap="xs">
                <Checkbox
                  size="xs"
                  checked={
                    selectedStaged.size === stagedFiles.length &&
                    stagedFiles.length > 0
                  }
                  indeterminate={
                    selectedStaged.size > 0 &&
                    selectedStaged.size < stagedFiles.length
                  }
                  onChange={(e) => {
                    if (e.currentTarget.checked) {
                      setSelectedStaged(
                        new Set(stagedFiles.map((f) => f.path)),
                      );
                    } else {
                      setSelectedStaged(new Set());
                    }
                  }}
                />
                <Text size="xs" fw={500} tt="uppercase" c="dimmed">
                  Staged Changes ({stagedFiles.length})
                </Text>
              </Group>
              {selectedStaged.size > 0 && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={handleUnstageSelected}
                >
                  Unstage Selected
                </Button>
              )}
            </Group>
            {stagedFiles.length === 0 ? (
              <Text size="xs" c="dimmed" fs="italic">
                No staged changes
              </Text>
            ) : (
              <Stack gap={2}>
                {stagedFiles.map((file) => (
                  <Paper key={file.path} p={4} withBorder>
                    <Group justify="space-between" wrap="nowrap">
                      <Group
                        gap="xs"
                        wrap="nowrap"
                        style={{ overflow: "hidden" }}
                      >
                        <Checkbox
                          size="xs"
                          checked={selectedStaged.has(file.path)}
                          onChange={() => toggleStagedSelection(file.path)}
                        />
                        <Badge
                          size="xs"
                          color={getStatusColor(file.status)}
                          variant="light"
                          style={{ minWidth: 22 }}
                        >
                          {getStatusIcon(file.status)}
                        </Badge>
                        {getFileIcon(
                          file.path.split("/").pop() || file.path,
                          "file",
                        )}
                        <Text
                          size="xs"
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {file.path.split("/").pop()}
                        </Text>
                      </Group>
                      <Group gap={2}>
                        <Tooltip label="Unstage">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            onClick={() => handleUnstageFile(file)}
                          >
                            <FontAwesomeIcon icon={faMinus} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>

          {/* Unstaged Changes */}
          <Box>
            <Group justify="space-between" mb={4}>
              <Group gap="xs">
                <Checkbox
                  size="xs"
                  checked={
                    selectedUnstaged.size === unstagedFiles.length &&
                    unstagedFiles.length > 0
                  }
                  indeterminate={
                    selectedUnstaged.size > 0 &&
                    selectedUnstaged.size < unstagedFiles.length
                  }
                  onChange={(e) => {
                    if (e.currentTarget.checked) {
                      setSelectedUnstaged(
                        new Set(unstagedFiles.map((f) => f.path)),
                      );
                    } else {
                      setSelectedUnstaged(new Set());
                    }
                  }}
                />
                <Text size="xs" fw={500} tt="uppercase" c="dimmed">
                  Changes ({unstagedFiles.length})
                </Text>
              </Group>
              <Group gap={2}>
                {selectedUnstaged.size > 0 && (
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    onClick={handleStageSelected}
                  >
                    Stage Selected
                  </Button>
                )}
                {unstagedFiles.length > 0 && (
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    onClick={handleStageAll}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                  </ActionIcon>
                )}
              </Group>
            </Group>
            {unstagedFiles.length === 0 ? (
              <Text size="xs" c="dimmed" fs="italic">
                No changes
              </Text>
            ) : (
              <Stack gap={2}>
                {unstagedFiles.map((file) => (
                  <Paper key={file.path} p={4} withBorder>
                    <Group justify="space-between" wrap="nowrap">
                      <Group
                        gap="xs"
                        wrap="nowrap"
                        style={{ overflow: "hidden" }}
                      >
                        <Checkbox
                          size="xs"
                          checked={selectedUnstaged.has(file.path)}
                          onChange={() => toggleUnstagedSelection(file.path)}
                        />
                        <Badge
                          size="xs"
                          color={getStatusColor(file.status)}
                          variant="light"
                          style={{ minWidth: 22 }}
                        >
                          {getStatusIcon(file.status)}
                        </Badge>
                        {getFileIcon(
                          file.path.split("/").pop() || file.path,
                          "file",
                        )}
                        <Text
                          size="xs"
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            onOpenFile(repoInfo.path + "/" + file.path)
                          }
                        >
                          {file.path.split("/").pop()}
                        </Text>
                      </Group>
                      <Group gap={2}>
                        <Tooltip label="View diff">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            onClick={() => handleViewDiff(file)}
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Stage">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            onClick={() => handleStageFile(file)}
                          >
                            <FontAwesomeIcon icon={faPlus} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Discard">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => handleDiscardChanges(file)}
                          >
                            <FontAwesomeIcon icon={faUndo} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>

          {/* Diff Modal */}
          <Modal
            opened={structuredDiff !== null}
            onClose={() => {
              setStructuredDiff(null);
              setSelectedFile(null);
            }}
            title={`Diff: ${selectedFile?.split("/").pop() || "File"}`}
            size="90%"
            styles={{
              body: { height: "70vh", padding: 0 },
            }}
          >
            {structuredDiff && <DiffViewer diff={structuredDiff} />}
          </Modal>

          {/* Commit History */}
          <Box>
            <Group
              gap="xs"
              mb={4}
              style={{ cursor: "pointer" }}
              onClick={() => setShowHistory(!showHistory)}
            >
              <FontAwesomeIcon
                icon={showHistory ? faChevronDown : faChevronRight}
                size="xs"
              />
              <Text size="xs" fw={500} tt="uppercase" c="dimmed">
                History
              </Text>
              {showHistory && (
                <Group gap={2} style={{ marginLeft: "auto" }}>
                  <Tooltip label="Graph View">
                    <ActionIcon
                      size="xs"
                      variant={viewMode === "graph" ? "light" : "subtle"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode("graph");
                      }}
                    >
                      <FontAwesomeIcon icon={faCodeBranch} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="List View">
                    <ActionIcon
                      size="xs"
                      variant={viewMode === "list" ? "light" : "subtle"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewMode("list");
                      }}
                    >
                      <FontAwesomeIcon icon={faFileCode} />
                      {/* Using faFileCode as list icon placeholder, maybe faList better but not imported */}
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )}
            </Group>
            <Collapse in={showHistory}>
              <Box h={400} style={{ position: "relative" }}>
                {/* Fixed height for graph container, or use flex if possible */}
                {viewMode === "graph" ? (
                  <GitGraph
                    commits={commits}
                    activeCommitId={repoInfo?.head_commit || null}
                    onSelectCommit={(commit) => {
                      // Handle commit selection (maybe show details modal?)
                      console.log("Selected commit", commit);
                    }}
                  />
                ) : (
                  <Stack gap={2}>
                    {commits.slice(0, 50).map((commit) => (
                      <Paper key={commit.id} p={4} withBorder>
                        <Group gap="xs" wrap="nowrap">
                          <Badge size="xs" variant="light" color="gray">
                            {commit.short_id}
                          </Badge>
                          <Text
                            size="xs"
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {commit.message.split("\n")[0]}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {commit.author_name} •{" "}
                          {formatTimestamp(commit.timestamp)}
                        </Text>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </Collapse>
          </Box>
        </Stack>
      </ScrollArea>
      <Modal
        opened={createBranchOpen}
        onClose={() => setCreateBranchOpen(false)}
        title="Create New Branch"
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Branch Name"
            placeholder="feature/new-feature"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.currentTarget.value)}
            data-autofocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newBranchName.trim()) {
                handleCreateBranch();
              }
            }}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setCreateBranchOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBranch}
              disabled={!newBranchName.trim()}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={gitignoreOpen}
        onClose={() => setGitignoreOpen(false)}
        title="Edit .gitignore"
        size="lg"
      >
        <Stack>
          <Text size="xs" c="dimmed">
            Each line is a pattern to exclude files/folders from version
            control.
          </Text>
          <Textarea
            value={gitignoreContent}
            onChange={(e) => setGitignoreContent(e.currentTarget.value)}
            minRows={10}
            maxRows={20}
            autosize
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setGitignoreOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGitignore}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Stash Modal */}
      <Modal
        opened={stashModalOpen}
        onClose={() => setStashModalOpen(false)}
        title="Create Stash"
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Stash Message (optional)"
            placeholder="WIP on feature..."
            value={stashMessage}
            onChange={(e) => setStashMessage(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setStashModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateStash}>Create Stash</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Stash List Section - Collapsible */}
      {stashes.length > 0 && (
        <Box mt="xs">
          <Group
            gap="xs"
            mb={4}
            style={{ cursor: "pointer" }}
            onClick={() => setShowStashes(!showStashes)}
          >
            <FontAwesomeIcon
              icon={showStashes ? faChevronDown : faChevronRight}
              size="xs"
            />
            <Text size="xs" fw={500} tt="uppercase" c="dimmed">
              Stashes ({stashes.length})
            </Text>
          </Group>
          <Collapse in={showStashes}>
            <Stack gap={2}>
              {stashes.map((stash) => (
                <Paper key={stash.commit_id} p={4} withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="xs" truncate flex={1}>
                      {stash.message}
                    </Text>
                    <Group gap={2}>
                      <Tooltip label="Apply">
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onClick={() => handleApplyStash(stash.index)}
                        >
                          <FontAwesomeIcon icon={faCheck} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Pop">
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="green"
                          onClick={() => handlePopStash(stash.index)}
                        >
                          <FontAwesomeIcon icon={faUndo} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Drop">
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => handleDropStash(stash.index)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}
    </Stack>
  );
};
