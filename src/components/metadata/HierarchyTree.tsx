// ============================================================================
// Hierarchy Tree Component
// Tree view for Field → Chapter → Section → Subsection with checkbox selection
// ============================================================================

import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Box,
  Checkbox,
  Collapse,
  Group,
  ActionIcon,
  TextInput,
  Text,
  UnstyledButton,
  Menu,
} from "@mantine/core";
import {
  IconChevronRight,
  IconChevronDown,
  IconPlus,
  IconBook,
  IconFolder,
  IconFile,
  IconSubtask,
  IconDotsVertical,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useTypedMetadataStore } from "../../stores/typedMetadataStore";
import type {
  Field,
  Chapter,
  Section,
  Subsection,
} from "../../types/typedMetadata";

// ============================================================================
// Types
// ============================================================================

export type HierarchyType = "field" | "chapter" | "section" | "subsection";

export interface HierarchyNode {
  id: string;
  name: string;
  type: HierarchyType;
  parentId?: string;
  children?: HierarchyNode[];
}

export interface HierarchyTreeProps {
  // Checked items (controlled)
  checkedFieldIds?: string[];
  checkedChapterIds?: string[];
  checkedSectionIds?: string[];
  checkedSubsectionIds?: string[];

  // Callbacks
  onCheck?: (type: HierarchyType, id: string, checked: boolean) => void;
  onCreate?: (type: HierarchyType, name: string, parentId?: string) => void;
  onDelete?: (type: HierarchyType, id: string) => void;
  onRename?: (type: HierarchyType, id: string, newName: string) => void;

  // Mode
  mode?: "view" | "edit";

  // Optional: only show specific field's hierarchy
  filterFieldId?: string;

  // Control expansion
  expandAll?: boolean | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildHierarchyTree(
  fields: Field[],
  chapters: Chapter[],
  sections: Section[],
  subsections: Subsection[],
  filterFieldId?: string
): HierarchyNode[] {
  const filteredFields = filterFieldId
    ? fields.filter((f) => f.id === filterFieldId)
    : fields;

  return filteredFields.map((field) => ({
    id: field.id,
    name: field.name,
    type: "field" as const,
    children: chapters
      .filter((ch) => ch.fieldId === field.id)
      .map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
        type: "chapter" as const,
        parentId: field.id,
        children: sections
          .filter((sec) => sec.chapterId === chapter.id)
          .map((section) => ({
            id: section.id,
            name: section.name,
            type: "section" as const,
            parentId: chapter.id,
            children: subsections
              .filter((sub) => sub.sectionId === section.id)
              .map((subsection) => ({
                id: subsection.id,
                name: subsection.name,
                type: "subsection" as const,
                parentId: section.id,
              })),
          })),
      })),
  }));
}

// ============================================================================
// Tree Node Component
// ============================================================================

interface HierarchyTreeNodeProps {
  node: HierarchyNode;
  level: number;
  isChecked: boolean;
  onCheck: (type: HierarchyType, id: string, checked: boolean) => void;
  onCreate?: (type: HierarchyType, name: string, parentId?: string) => void;
  onDelete?: (type: HierarchyType, id: string) => void;
  onRename?: (type: HierarchyType, id: string, newName: string) => void;
  checkedIds: {
    field: Set<string>;
    chapter: Set<string>;
    section: Set<string>;
    subsection: Set<string>;
  };
  mode: "view" | "edit";
  expandAll?: boolean | null;
}

const ICONS: Record<HierarchyType, React.ReactNode> = {
  field: <IconBook size={16} />,
  chapter: <IconFolder size={16} />,
  section: <IconFile size={16} />,
  subsection: <IconSubtask size={16} />,
};

const CHILD_TYPE: Record<HierarchyType, HierarchyType | null> = {
  field: "chapter",
  chapter: "section",
  section: "subsection",
  subsection: null,
};

const HierarchyTreeNode: React.FC<HierarchyTreeNodeProps> = ({
  node,
  level,
  isChecked,
  onCheck,
  onCreate,
  onDelete,
  onRename,
  checkedIds,
  mode,
  expandAll,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  // Sync expanded state when expandAll prop changes
  useEffect(() => {
    if (expandAll !== null && expandAll !== undefined) {
      setExpanded(expandAll);
    }
  }, [expandAll]);

  const hasChildren = node.children && node.children.length > 0;
  const childType = CHILD_TYPE[node.type];
  const canAddChild = mode === "edit" && childType !== null;

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleCheck = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheck(node.type, node.id, e.target.checked);
    },
    [node.type, node.id, onCheck]
  );

  const handleStartCreate = useCallback(() => {
    setIsCreating(true);
    setNewName("");
  }, []);

  const handleCommitCreate = useCallback(() => {
    if (newName.trim() && onCreate && childType) {
      onCreate(childType, newName.trim(), node.id);
      setNewName("");
      setIsCreating(false);
      setExpanded(true);
    }
  }, [newName, onCreate, childType, node.id]);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setNewName("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleCommitCreate();
      } else if (e.key === "Escape") {
        handleCancelCreate();
      }
    },
    [handleCommitCreate, handleCancelCreate]
  );

  // Rename handlers
  const handleStartRename = useCallback(() => {
    setIsRenaming(true);
    setNewName(node.name);
  }, [node.name]);

  const handleCommitRename = useCallback(() => {
    if (newName.trim() && onRename && newName.trim() !== node.name) {
      onRename(node.type, node.id, newName.trim());
    }
    setIsRenaming(false);
    setNewName("");
  }, [newName, onRename, node.type, node.id, node.name]);

  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setNewName("");
  }, []);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleCommitRename();
      } else if (e.key === "Escape") {
        handleCancelRename();
      }
    },
    [handleCommitRename, handleCancelRename]
  );

  // Delete handler
  const handleDelete = useCallback(() => {
    if (onDelete) {
      onDelete(node.type, node.id);
    }
  }, [onDelete, node.type, node.id]);

  return (
    <Box>
      <Group
        gap={4}
        py={4}
        px={8}
        pl={level * 20 + 8}
        style={{
          borderRadius: 4,
          cursor: "pointer",
          backgroundColor: isHovered
            ? "var(--mantine-color-dark-6)"
            : "transparent",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Expand/Collapse Toggle */}
        <UnstyledButton
          onClick={handleToggle}
          style={{
            width: 20,
            visibility: hasChildren || canAddChild ? "visible" : "hidden",
          }}
        >
          {expanded ? (
            <IconChevronDown size={14} />
          ) : (
            <IconChevronRight size={14} />
          )}
        </UnstyledButton>

        {/* Checkbox */}
        <Checkbox
          size="xs"
          checked={isChecked}
          onChange={handleCheck}
          onClick={(e) => e.stopPropagation()}
        />

        {/* Icon */}
        <Box style={{ color: "var(--mantine-color-dimmed)" }}>
          {ICONS[node.type]}
        </Box>

        {/* Name or Rename Input */}
        {isRenaming ? (
          <TextInput
            size="xs"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleCommitRename}
            autoFocus
            style={{ flex: 1 }}
          />
        ) : (
          <Text size="sm" style={{ flex: 1 }}>
            {node.name}
          </Text>
        )}

        {/* Action buttons (hover) */}
        {mode === "edit" && isHovered && !isRenaming && (
          <>
            {/* Add child button */}
            {canAddChild && (
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartCreate();
                }}
                title={`Add ${childType}`}
              >
                <IconPlus size={12} />
              </ActionIcon>
            )}

            {/* Context menu */}
            <Menu shadow="md" width={140} position="bottom-end">
              <Menu.Target>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconDotsVertical size={12} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconPencil size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartRename();
                  }}
                >
                  Rename
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        )}
      </Group>

      {/* Children */}
      <Collapse in={expanded}>
        {/* Existing children */}
        {node.children?.map((child) => (
          <HierarchyTreeNode
            key={child.id}
            node={child}
            level={level + 1}
            isChecked={checkedIds[child.type].has(child.id)}
            onCheck={onCheck}
            onCreate={onCreate}
            onDelete={onDelete}
            onRename={onRename}
            checkedIds={checkedIds}
            mode={mode}
            expandAll={expandAll}
          />
        ))}

        {/* Inline creation input */}
        {isCreating && childType && (
          <Group gap={4} py={4} px={8} pl={(level + 1) * 20 + 8}>
            <Box style={{ width: 20 }} />
            <Box style={{ width: 16 }} />
            <Box style={{ color: "var(--mantine-color-dimmed)" }}>
              {ICONS[childType]}
            </Box>
            <TextInput
              size="xs"
              placeholder={`New ${childType}...`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleCancelCreate}
              autoFocus
              style={{ flex: 1 }}
            />
          </Group>
        )}
      </Collapse>
    </Box>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const HierarchyTree: React.FC<HierarchyTreeProps> = ({
  checkedFieldIds = [],
  checkedChapterIds = [],
  checkedSectionIds = [],
  checkedSubsectionIds = [],
  onCheck,
  onCreate,
  onDelete,
  onRename,
  mode = "view",
  filterFieldId,
  expandAll,
}) => {
  // Get data from store
  const fields = useTypedMetadataStore((state) => state.fields);
  const chapters = useTypedMetadataStore((state) => state.chapters);
  const sections = useTypedMetadataStore((state) => state.sections);
  const subsections = useTypedMetadataStore((state) => state.subsections);

  // Build tree structure
  const tree = useMemo(
    () =>
      buildHierarchyTree(
        fields,
        chapters,
        sections,
        subsections,
        filterFieldId
      ),
    [fields, chapters, sections, subsections, filterFieldId]
  );

  // Create Sets for O(1) lookups
  const checkedIds = useMemo(
    () => ({
      field: new Set(checkedFieldIds),
      chapter: new Set(checkedChapterIds),
      section: new Set(checkedSectionIds),
      subsection: new Set(checkedSubsectionIds),
    }),
    [
      checkedFieldIds,
      checkedChapterIds,
      checkedSectionIds,
      checkedSubsectionIds,
    ]
  );

  // Default handlers
  const handleCheck = useCallback(
    (type: HierarchyType, id: string, checked: boolean) => {
      onCheck?.(type, id, checked);
    },
    [onCheck]
  );

  const handleCreate = useCallback(
    (type: HierarchyType, name: string, parentId?: string) => {
      onCreate?.(type, name, parentId);
    },
    [onCreate]
  );

  const handleDelete = useCallback(
    (type: HierarchyType, id: string) => {
      onDelete?.(type, id);
    },
    [onDelete]
  );

  const handleRename = useCallback(
    (type: HierarchyType, id: string, newName: string) => {
      onRename?.(type, id, newName);
    },
    [onRename]
  );

  if (tree.length === 0) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">
          No hierarchy data available
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      {tree.map((node) => (
        <HierarchyTreeNode
          key={node.id}
          node={node}
          level={0}
          isChecked={checkedIds[node.type].has(node.id)}
          onCheck={handleCheck}
          onCreate={mode === "edit" ? handleCreate : undefined}
          onDelete={mode === "edit" ? handleDelete : undefined}
          onRename={mode === "edit" ? handleRename : undefined}
          checkedIds={checkedIds}
          mode={mode}
          expandAll={expandAll}
        />
      ))}
    </Box>
  );
};

export default HierarchyTree;
