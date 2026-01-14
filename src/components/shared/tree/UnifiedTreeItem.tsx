import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  UnstyledButton,
  Group,
  Text,
  Collapse,
  Menu,
  TextInput,
  Checkbox,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronRight,
  faChevronDown,
  faFolder,
  faFolderOpen,
  faFileCode,
  faFilePdf,
  faBookOpen,
  faCog,
  faImage,
  faFile,
  faBoxOpen,
  faFileCirclePlus,
  faFolderPlus,
  faPen,
  faCopy,
  faTrash,
  faMinusSquare,
} from "@fortawesome/free-solid-svg-icons";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { UnifiedTreeItemProps } from "./types";

// ============================================================================
// FILE ICON HELPER
// ============================================================================

/**
 * Returns the appropriate icon for a file based on its extension.
 */
export const getFileIcon = (
  name: string,
  type: "file" | "folder",
  expanded: boolean = false
) => {
  if (type === "folder") {
    return (
      <FontAwesomeIcon
        icon={expanded ? faFolderOpen : faFolder}
        style={{ width: 14, height: 14, color: "#fab005" }}
      />
    );
  }
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tex":
      return (
        <FontAwesomeIcon
          icon={faFileCode}
          style={{ width: 14, height: 14, color: "#4dabf7" }}
        />
      );
    case "bib":
      return (
        <FontAwesomeIcon
          icon={faBookOpen}
          style={{ width: 14, height: 14, color: "#fab005" }}
        />
      );
    case "sty":
      return (
        <FontAwesomeIcon
          icon={faCog}
          style={{ width: 14, height: 14, color: "#be4bdb" }}
        />
      );
    case "pdf":
      return (
        <FontAwesomeIcon
          icon={faFilePdf}
          style={{ width: 14, height: 14, color: "#fa5252" }}
        />
      );
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return (
        <FontAwesomeIcon
          icon={faImage}
          style={{ width: 14, height: 14, color: "#40c057" }}
        />
      );
    default:
      return (
        <FontAwesomeIcon
          icon={faFile}
          style={{ width: 14, height: 14, color: "#868e96" }}
        />
      );
  }
};

// ============================================================================
// INLINE INPUT COMPONENT (for renaming/creating)
// ============================================================================

interface InlineInputProps {
  type: "file" | "folder";
  defaultValue?: string;
  placeholder?: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

export const InlineInput = React.memo<InlineInputProps>(
  ({ type, defaultValue = "", placeholder, onCommit, onCancel }) => {
    const [name, setName] = useState(defaultValue);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && name.trim()) {
          onCommit(name.trim());
        } else if (e.key === "Escape") {
          onCancel();
        }
      },
      [name, onCommit, onCancel]
    );

    return (
      <Group gap={6} wrap="nowrap" px={8} py={4} style={{ paddingLeft: 20 }}>
        <FontAwesomeIcon
          icon={type === "folder" ? faFolder : faFile}
          style={{
            width: 16,
            height: 16,
            color: type === "folder" ? "#fab005" : "#4dabf7",
          }}
        />
        <TextInput
          ref={inputRef}
          size="xs"
          variant="unstyled"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Use timeout to allow click events to process before cancelling
            // This prevents race conditions where the input prevents clicking other elements
            setTimeout(() => onCancel(), 100);
          }}
          placeholder={
            placeholder || (type === "file" ? "filename.tex" : "folder_name")
          }
          styles={{
            input: {
              height: 18,
              minHeight: 18,
              padding: 0,
              color: "var(--mantine-color-text)",
              border: "1px solid var(--mantine-primary-color-filled)",
            },
          }}
        />
      </Group>
    );
  }
);

InlineInput.displayName = "InlineInput";

// ============================================================================
// UNIFIED TREE ITEM COMPONENT
// ============================================================================

/**
 * Unified tree item component that works for both Explorer and Database.
 * Supports: DnD, Context Menu, Inline Rename, Checkbox (all configurable)
 */
export const UnifiedTreeItem = React.memo<UnifiedTreeItemProps>(
  ({
    node,
    level,
    config,
    callbacks,
    selectedPath,
    expandSignal,
    collapseSignal,
    creatingState,
    onCommitCreation,
    onCancelCreation,
    contextFolderPath,
  }) => {
    const isRoot = node.isRoot || level === 0;
    const [expanded, setExpanded] = useState(isRoot);
    const [isRenaming, setIsRenaming] = useState(false);
    const [menuOpened, setMenuOpened] = useState(false);

    // Respond to expand/collapse signals from parent
    useEffect(() => {
      if (expandSignal > 0) setExpanded(true);
    }, [expandSignal]);

    useEffect(() => {
      if (collapseSignal > 0 && !isRoot) setExpanded(false);
    }, [collapseSignal, isRoot]);

    // Auto-expand when creating a child item
    const isCreatingHere =
      creatingState?.parentId === node.id && node.type === "folder";
    useEffect(() => {
      if (isCreatingHere) setExpanded(true);
    }, [isCreatingHere]);

    // --- DnD Hooks (only if enabled) ---
    const dragConfig = config.enableDragDrop
      ? {
          id: node.id,
          data: { node },
        }
      : { id: "disabled", disabled: true };

    const {
      attributes,
      listeners,
      setNodeRef: setDragNodeRef,
      isDragging,
    } = useDraggable(dragConfig);

    const dropConfig = config.enableDragDrop
      ? {
          id: node.id,
          data: { node },
          disabled: node.type !== "folder",
        }
      : { id: "disabled", disabled: true };

    const { setNodeRef: setDropNodeRef, isOver } = useDroppable(dropConfig);

    // --- Event Handlers ---
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isRenaming) return;

        if (node.type === "folder") {
          setExpanded((prev) => !prev);
          callbacks.onFolderToggle?.(node, !expanded);
          callbacks.onFolderClick?.(node);
        } else {
          callbacks.onFileClick(node);
        }
      },
      [node, isRenaming, expanded, callbacks]
    );

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => {
        if (!config.enableContextMenu) return;
        e.preventDefault();
        e.stopPropagation();
        setMenuOpened(true);
        callbacks.onContextMenu?.(node, e);
      },
      [config.enableContextMenu, node, callbacks]
    );

    const handleRenameCommit = useCallback(
      (newName: string) => {
        setIsRenaming(false);
        callbacks.onRename?.(node, newName);
      },
      [node, callbacks]
    );

    const handleCheckboxChange = useCallback(() => {
      callbacks.onCheckboxChange?.(node, !node.metadata?.isLoaded);
    }, [node, callbacks]);

    // --- Computed Styles ---
    const isSelected = node.path === selectedPath;
    const isFile = node.type === "file";
    const paddingLeft = isRoot ? 8 : isFile ? level * 10 + 28 : level * 10 + 12;

    // Style calculation
    const isContextFolder = contextFolderPath === node.path;

    const bgColor = useMemo(() => {
      // User requested: Active/Focused -> Blue, Inactive/Unfocused -> Gray, Opacity 0.5
      // Selected Item = Active
      if (isSelected)
        return "color-mix(in srgb, var(--mantine-color-blue-filled), transparent 50%)";
      // Context Folder (Target) = Inactive/Secondary
      if (isContextFolder)
        return "color-mix(in srgb, var(--mantine-color-gray-filled), transparent 50%)";

      return "transparent";
    }, [isSelected, isContextFolder]);

    const textColor = isSelected
      ? "var(--mantine-primary-color-text)"
      : "var(--mantine-color-text)";

    // Border logic
    const borderStyle = useMemo(() => {
      // Maintain subtle borders for structure, or remove if user implies only BG matters.
      // Keeping consistent with BG Logic:
      if (isSelected)
        return {
          border: "1px solid var(--mantine-color-blue-7)",
          borderRadius: 4,
        };
      if (isContextFolder)
        return {
          border: "1px solid var(--mantine-color-gray-6)",
          borderRadius: 4,
        };

      // Root might need a bottom border if it's acting as a separator, but user said "don't check root".
      // Assuming clean look is desired.
      if (isRoot)
        return {
          borderBottom: "1px solid var(--mantine-color-default-border)",
        };

      return { borderBottom: "none" };
    }, [isSelected, isContextFolder, isRoot]);

    const fontWeight = isRoot ? 700 : 400;

    // DnD drop target highlight
    const dropStyle = isOver
      ? {
          backgroundColor: "var(--mantine-color-blue-1)",
          border: "1px solid var(--mantine-color-blue-7)",
        }
      : {};

    // --- Render Inline Rename ---
    if (isRenaming) {
      return (
        <Box pl={level * 12 + 8} py={4}>
          <InlineInput
            type={node.type}
            defaultValue={node.name}
            onCommit={handleRenameCommit}
            onCancel={() => setIsRenaming(false)}
          />
        </Box>
      );
    }

    // --- Render Tree Item ---
    const itemContent = (
      <UnstyledButton
        ref={config.enableDragDrop ? setDragNodeRef : undefined}
        {...(config.enableDragDrop ? { ...listeners, ...attributes } : {})}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{
          width: "100%",
          padding: isRoot ? "8px 8px" : "4px 8px",
          paddingLeft: paddingLeft,
          fontSize: 13,
          color: textColor,
          backgroundColor: bgColor,
          fontWeight: fontWeight,
          display: "flex",
          alignItems: "center",
          transition: "background-color 0.2s",
          opacity: isDragging ? 0.5 : 1,
          ...borderStyle,
        }}
      >
        <Group
          gap={isRoot ? 8 : 6}
          wrap="nowrap"
          style={{ flex: 1, overflow: "hidden" }}
        >
          {/* Checkbox (for Database collections) */}
          {config.enableCheckbox && (
            <Checkbox
              checked={node.metadata?.isLoaded || false}
              onChange={handleCheckboxChange}
              size="xs"
              styles={{ input: { cursor: "pointer" } }}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {/* Expand/Collapse Chevron */}
          {node.type === "folder" && (
            <Box
              style={{
                transform: expanded
                  ? isRoot
                    ? "rotate(0deg)"
                    : "rotate(90deg)"
                  : isRoot
                  ? "rotate(-90deg)"
                  : "none",
                transition: "transform 0.2s",
                display: "flex",
                opacity: 0.7,
              }}
            >
              <FontAwesomeIcon
                icon={isRoot ? faChevronDown : faChevronRight}
                style={{ width: 10, height: 10 }}
              />
            </Box>
          )}

          {/* Icon */}
          {isRoot && config.rootIcon ? (
            config.rootIcon
          ) : isRoot ? (
            <FontAwesomeIcon
              icon={faBoxOpen}
              style={{
                width: 14,
                height: 14,
                color: "var(--mantine-primary-color-filled)",
              }}
            />
          ) : (
            getFileIcon(node.name, node.type, expanded)
          )}

          {/* Name */}
          <Text
            size="xs"
            truncate
            fw={isRoot ? 700 : 400}
            tt={isRoot ? "uppercase" : "none"}
          >
            {node.name}
          </Text>
        </Group>
      </UnstyledButton>
    );

    // --- Wrap with Context Menu if enabled ---
    const wrappedContent = config.enableContextMenu ? (
      <Menu
        shadow="md"
        width={200}
        opened={menuOpened}
        onChange={setMenuOpened}
        trigger="click"
      >
        <Menu.Target>
          <Box style={{ width: "100%" }}>{itemContent}</Box>
        </Menu.Target>

        <Menu.Dropdown onContextMenu={(e) => e.preventDefault()}>
          <Menu.Label>{node.name}</Menu.Label>

          {/* Folder actions */}
          {node.type === "folder" && (
            <>
              <Menu.Item
                leftSection={
                  <FontAwesomeIcon
                    icon={faFileCirclePlus}
                    style={{ width: 14, height: 14 }}
                  />
                }
                onClick={() => callbacks.onCreate?.("file", node)}
              >
                New File
              </Menu.Item>
              <Menu.Item
                leftSection={
                  <FontAwesomeIcon
                    icon={faFolderPlus}
                    style={{ width: 14, height: 14 }}
                  />
                }
                onClick={() => callbacks.onCreate?.("folder", node)}
              >
                New Folder
              </Menu.Item>
              <Menu.Divider />
            </>
          )}

          {/* Root-specific actions */}
          {isRoot && callbacks.onRemoveFolder && (
            <>
              <Menu.Item
                color="orange"
                leftSection={
                  <FontAwesomeIcon
                    icon={faMinusSquare}
                    style={{ width: 14, height: 14 }}
                  />
                }
                onClick={() => callbacks.onRemoveFolder?.(node)}
              >
                Remove Project Folder
              </Menu.Item>
              <Menu.Divider />
            </>
          )}

          {/* Standard file/folder actions (non-root) */}
          {!isRoot && (
            <>
              {config.enableRename && (
                <Menu.Item
                  leftSection={
                    <FontAwesomeIcon
                      icon={faPen}
                      style={{ width: 14, height: 14 }}
                    />
                  }
                  onClick={() => setIsRenaming(true)}
                >
                  Rename
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={
                  <FontAwesomeIcon
                    icon={faCopy}
                    style={{ width: 14, height: 14 }}
                  />
                }
                onClick={() => navigator.clipboard.writeText(node.path)}
              >
                Copy Path
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={
                  <FontAwesomeIcon
                    icon={faTrash}
                    style={{ width: 14, height: 14 }}
                  />
                }
                color="red"
                onClick={() => callbacks.onDelete?.(node)}
              >
                Delete
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    ) : (
      itemContent
    );

    return (
      <Box
        ref={config.enableDragDrop ? setDropNodeRef : undefined}
        style={dropStyle}
      >
        {wrappedContent}

        {/* Children */}
        <Collapse in={expanded}>
          {node.children?.map((child) => (
            <UnifiedTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              config={config}
              callbacks={callbacks}
              selectedPath={selectedPath}
              expandSignal={expandSignal}
              collapseSignal={collapseSignal}
              creatingState={creatingState}
              onCommitCreation={onCommitCreation}
              onCancelCreation={onCancelCreation}
            />
          ))}

          {/* Inline creation input */}
          {isCreatingHere &&
            creatingState &&
            onCommitCreation &&
            onCancelCreation && (
              <Box pl={(level + 1) * 12 + 8}>
                <InlineInput
                  type={creatingState.type}
                  onCommit={(name) =>
                    onCommitCreation(name, creatingState.type, node.path)
                  }
                  onCancel={onCancelCreation}
                />
              </Box>
            )}
        </Collapse>
      </Box>
    );
  }
);

UnifiedTreeItem.displayName = "UnifiedTreeItem";
