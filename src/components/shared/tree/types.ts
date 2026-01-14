import React from "react";

// ============================================================================
// UNIFIED TREE NODE TYPES
// ============================================================================

/**
 * Unified tree node that works for both Explorer and Database file trees.
 * This replaces both `FileSystemNode` and `FileTreeNode`.
 */
export interface TreeNode {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string;
  children?: TreeNode[];

  /** True for root folders (Explorer projects) or collection roots (Database) */
  isRoot?: boolean;

  /** Optional metadata for specific contexts */
  metadata?: {
    collectionName?: string; // Database: which collection this belongs to
    isLoaded?: boolean; // Database: is this collection loaded
    [key: string]: any;
  };
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for tree item behavior and features.
 * Allows enabling/disabling features per-context.
 */
export interface TreeItemConfig {
  /** Enable drag-and-drop (requires DndContext wrapper) */
  enableDragDrop?: boolean;

  /** Enable right-click context menu */
  enableContextMenu?: boolean;

  /** Enable inline renaming */
  enableRename?: boolean;

  /** Show checkbox (for Database collections) */
  enableCheckbox?: boolean;

  /** Custom icon for root nodes */
  rootIcon?: React.ReactNode;
}

// ============================================================================
// CALLBACK TYPES
// ============================================================================

/**
 * Callbacks for tree item interactions.
 */
export interface TreeItemCallbacks {
  /** Called when a file node is clicked */
  onFileClick: (node: TreeNode) => void;

  /** Called when a folder node is clicked */
  onFolderClick?: (node: TreeNode) => void;

  /** Called when a folder is expanded/collapsed */
  onFolderToggle?: (node: TreeNode, expanded: boolean) => void;

  // --- Optional advanced features ---

  /** Context menu handler (if enableContextMenu is true) */
  onContextMenu?: (node: TreeNode, e: React.MouseEvent) => void;

  /** Rename handler (if enableRename is true) */
  onRename?: (node: TreeNode, newName: string) => void;

  /** Delete handler */
  onDelete?: (node: TreeNode) => void;

  /** Create new item handler */
  onCreate?: (type: "file" | "folder", parentNode: TreeNode) => void;

  /** Drag-and-drop handler (if enableDragDrop is true) */
  onDrop?: (sourceNode: TreeNode, targetNode: TreeNode) => void;

  /** Remove folder from workspace (Explorer-specific) */
  onRemoveFolder?: (node: TreeNode) => void;

  /** Checkbox change handler (Database collections) */
  onCheckboxChange?: (node: TreeNode, checked: boolean) => void;
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

export interface UnifiedTreeItemProps {
  node: TreeNode;
  level: number;
  config: TreeItemConfig;
  callbacks: TreeItemCallbacks;

  // Selection state
  selectedPath: string | null;
  /** Path of the folder that is currently the 'context' for creation (highlighted) */
  contextFolderPath?: string | null;

  // Expand/collapse signals from parent
  expandSignal: number;
  collapseSignal: number;

  // Creation state (for inline new item input)
  creatingState?: {
    type: "file" | "folder";
    parentId: string;
  } | null;
  onCommitCreation?: (
    name: string,
    type: "file" | "folder",
    parentPath: string
  ) => void;
  onCancelCreation?: () => void;
}

export interface TreeToolbarProps {
  title: string;
  actions: ToolbarAction[];
  showExpandToggle?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export interface ToolbarAction {
  icon: any; // FontAwesome IconDefinition
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
  variant?: "subtle" | "light" | "filled";
}

export interface TreeSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
}

// ============================================================================
// TREE STATE TYPES (for useTreeState hook)
// ============================================================================

export interface TreeState<T extends TreeNode = TreeNode> {
  expandAllSignal: number;
  collapseAllSignal: number;
  isToggleExpanded: boolean;
  searchQuery: string;
  selectedNode: T | null;
}

export interface TreeStateActions {
  setSearchQuery: (query: string) => void;
  setSelectedNode: <T extends TreeNode>(node: T | null) => void;
  triggerExpandAll: () => void;
  triggerCollapseAll: () => void;
  toggleExpandState: () => void;
  filterNodes: <T extends TreeNode>(nodes: T[], query: string) => T[];
}
