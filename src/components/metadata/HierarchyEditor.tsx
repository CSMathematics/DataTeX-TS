// ============================================================================
// Hierarchy Editor Component
// Panel wrapper for HierarchyTree with store integration and data loading
// ============================================================================

import React, { useEffect, useCallback, useState } from "react";
import {
  Box,
  Paper,
  Title,
  Group,
  ActionIcon,
  LoadingOverlay,
  Button,
  Tooltip,
  Popover,
  TextInput,
} from "@mantine/core";
import {
  IconRefresh,
  IconPlus,
  IconArrowsMaximize,
  IconArrowsMinimize,
} from "@tabler/icons-react";
import { HierarchyTree, HierarchyType } from "./HierarchyTree";
import { useTypedMetadataStore } from "../../stores/typedMetadataStore";
import { useDatabaseStore } from "../../stores/databaseStore";

// ============================================================================
// Types
// ============================================================================

export interface HierarchyEditorProps {
  // Current selections (from file metadata)
  selectedFieldId?: string;
  selectedChapterIds?: string[];
  selectedSectionIds?: string[];
  selectedSubsectionIds?: string[];

  // Called when selections change - returns all selected IDs
  onChange?: (selections: {
    fieldId?: string;
    chapters: string[];
    sections: string[];
    subsections: string[];
  }) => void;

  // Mode
  mode?: "view" | "edit";

  // Compact mode for sidebar
  compact?: boolean;

  // Explicit collection scoping (if provided, overrides global activeCollection)
  collectionName?: string;
}

// ============================================================================
// Component
// ============================================================================

export const HierarchyEditor: React.FC<HierarchyEditorProps> = ({
  selectedFieldId,
  selectedChapterIds = [],
  selectedSectionIds = [],
  selectedSubsectionIds = [],
  onChange,
  mode = "edit",
  compact = false,
  collectionName,
}) => {
  // Store actions
  const activeCollectionFromStore = useDatabaseStore(
    (state) => state.activeCollection,
  );
  // Use explicit collectionName if provided (e.g. from editor), otherwise fallback to sidebar selection
  const effectiveCollection =
    collectionName !== undefined ? collectionName : activeCollectionFromStore;

  const loadFields = useTypedMetadataStore((state) => state.loadFields);
  const loadChapters = useTypedMetadataStore((state) => state.loadChapters);
  const loadSections = useTypedMetadataStore((state) => state.loadSections);
  const loadSubsections = useTypedMetadataStore(
    (state) => state.loadSubsections,
  );
  const createChapter = useTypedMetadataStore((state) => state.createChapter);
  const createSection = useTypedMetadataStore((state) => state.createSection);
  const createSubsection = useTypedMetadataStore(
    (state) => state.createSubsection,
  );
  const createField = useTypedMetadataStore((state) => state.createField);

  // Delete actions
  const deleteField = useTypedMetadataStore((state) => state.deleteField);
  const deleteChapter = useTypedMetadataStore((state) => state.deleteChapter);
  const deleteSection = useTypedMetadataStore((state) => state.deleteSection);
  const deleteSubsection = useTypedMetadataStore(
    (state) => state.deleteSubsection,
  );
  // Rename actions
  const renameField = useTypedMetadataStore((state) => state.renameField);
  const renameChapter = useTypedMetadataStore((state) => state.renameChapter);
  const renameSection = useTypedMetadataStore((state) => state.renameSection);
  const renameSubsection = useTypedMetadataStore(
    (state) => state.renameSubsection,
  );
  const chapters = useTypedMetadataStore((state) => state.chapters);
  const sections = useTypedMetadataStore((state) => state.sections);
  const subsections = useTypedMetadataStore((state) => state.subsections);
  const isLoading = useTypedMetadataStore((state) => state.isLoadingLookupData);

  // Backend metadata may contain null for an empty optional array. Normalize
  // at the component boundary so all controlled checkbox state stays iterable.
  const normalizedChapterIds = Array.isArray(selectedChapterIds)
    ? selectedChapterIds
    : [];
  const normalizedSectionIds = Array.isArray(selectedSectionIds)
    ? selectedSectionIds
    : [];
  const normalizedSubsectionIds = Array.isArray(selectedSubsectionIds)
    ? selectedSubsectionIds
    : [];

  // Local checked state
  const [checkedFieldIds, setCheckedFieldIds] = useState<string[]>(
    selectedFieldId ? [selectedFieldId] : [],
  );
  const [checkedChapterIds, setCheckedChapterIds] =
    useState<string[]>(normalizedChapterIds);
  const [checkedSectionIds, setCheckedSectionIds] =
    useState<string[]>(normalizedSectionIds);
  const [checkedSubsectionIds, setCheckedSubsectionIds] = useState<string[]>(
    normalizedSubsectionIds,
  );

  // UI State
  const [expandAll, setExpandAll] = useState<boolean | null>(null);
  const [newFieldPopoverOpened, setNewFieldPopoverOpened] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");

  // Sync with props - use JSON.stringify for stable comparison
  const selectedFieldIdStr = selectedFieldId || "";
  const selectedChapterIdsStr = JSON.stringify(normalizedChapterIds);
  const selectedSectionIdsStr = JSON.stringify(normalizedSectionIds);
  const selectedSubsectionIdsStr = JSON.stringify(normalizedSubsectionIds);

  useEffect(() => {
    setCheckedFieldIds(selectedFieldId ? [selectedFieldId] : []);
  }, [selectedFieldIdStr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCheckedChapterIds(normalizedChapterIds);
  }, [selectedChapterIdsStr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCheckedSectionIds(normalizedSectionIds);
  }, [selectedSectionIdsStr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setCheckedSubsectionIds(normalizedSubsectionIds);
  }, [selectedSubsectionIdsStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of changes
  const notifyChange = useCallback(
    (
      fields: string[],
      chapters: string[],
      sections: string[],
      subsections: string[],
    ) => {
      onChange?.({
        fieldId: fields[0], // Only one field allowed
        chapters,
        sections,
        subsections,
      });
    },
    [onChange],
  );

  // Handle check/uncheck
  const handleCheck = useCallback(
    (type: HierarchyType, id: string, checked: boolean) => {
      let newFields = checkedFieldIds || [];
      let newChapters = checkedChapterIds || [];
      let newSections = checkedSectionIds || [];
      let newSubsections = checkedSubsectionIds || [];

      switch (type) {
        case "field":
          // Only one field at a time
          newFields = checked ? [id] : [];
          setCheckedFieldIds(newFields);
          break;
        case "chapter":
          newChapters = checked
            ? [...(checkedChapterIds || []), id]
            : (checkedChapterIds || []).filter((cid) => cid !== id);
          setCheckedChapterIds(newChapters);
          break;
        case "section":
          newSections = checked
            ? [...(checkedSectionIds || []), id]
            : (checkedSectionIds || []).filter((sid) => sid !== id);
          setCheckedSectionIds(newSections);
          break;
        case "subsection":
          newSubsections = checked
            ? [...(checkedSubsectionIds || []), id]
            : (checkedSubsectionIds || []).filter((ssid) => ssid !== id);
          setCheckedSubsectionIds(newSubsections);
          break;
      }

      notifyChange(newFields, newChapters, newSections, newSubsections);
    },
    [
      checkedFieldIds,
      checkedChapterIds,
      checkedSectionIds,
      checkedSubsectionIds,
      notifyChange,
    ],
  );

  // Handle create
  const handleCreate = useCallback(
    async (type: HierarchyType, name: string, parentId?: string) => {
      try {
        switch (type) {
          case "chapter":
            if (parentId)
              await createChapter(
                name,
                parentId,
                effectiveCollection || undefined,
              );
            break;
          case "section":
            if (parentId)
              await createSection(
                name,
                parentId,
                effectiveCollection || undefined,
              );
            break;
          case "subsection":
            if (parentId)
              await createSubsection(
                name,
                parentId,
                effectiveCollection || undefined,
              );
            break;
        }
      } catch (error) {
        console.error(`Failed to create ${type}:`, error);
      }
    },
    [createChapter, createSection, createSubsection, effectiveCollection],
  );

  // Refresh data
  const handleRefresh = useCallback(() => {
    loadFields(effectiveCollection || undefined);
    loadChapters(undefined, effectiveCollection || undefined);
    loadSections(undefined, effectiveCollection || undefined);
    loadSubsections(undefined, effectiveCollection || undefined);
  }, [
    loadFields,
    loadChapters,
    loadSections,
    loadSubsections,
    effectiveCollection,
  ]);

  // Handle delete for any hierarchy type
  const handleDelete = useCallback(
    async (type: HierarchyType, id: string) => {
      try {
        const removedChapterIds = new Set<string>();
        const removedSectionIds = new Set<string>();
        const removedSubsectionIds = new Set<string>();

        if (type === "field") {
          chapters
            .filter((chapter) => chapter.fieldId === id)
            .forEach((chapter) => removedChapterIds.add(chapter.id));
        } else if (type === "chapter") {
          removedChapterIds.add(id);
        }
        if (removedChapterIds.size > 0) {
          sections
            .filter((section) => removedChapterIds.has(section.chapterId))
            .forEach((section) => removedSectionIds.add(section.id));
        } else if (type === "section") {
          removedSectionIds.add(id);
        }
        if (removedSectionIds.size > 0) {
          subsections
            .filter((subsection) =>
              removedSectionIds.has(subsection.sectionId),
            )
            .forEach((subsection) =>
              removedSubsectionIds.add(subsection.id),
            );
        } else if (type === "subsection") {
          removedSubsectionIds.add(id);
        }

        switch (type) {
          case "field":
            await deleteField(id);
            break;
          case "chapter":
            await deleteChapter(id);
            break;
          case "section":
            await deleteSection(id);
            break;
          case "subsection":
            await deleteSubsection(id);
            break;
        }

        const nextFields =
          type === "field"
            ? checkedFieldIds.filter((fieldId) => fieldId !== id)
            : checkedFieldIds;
        const nextChapters = checkedChapterIds.filter(
          (chapterId) => !removedChapterIds.has(chapterId),
        );
        const nextSections = checkedSectionIds.filter(
          (sectionId) => !removedSectionIds.has(sectionId),
        );
        const nextSubsections = checkedSubsectionIds.filter(
          (subsectionId) => !removedSubsectionIds.has(subsectionId),
        );
        setCheckedFieldIds(nextFields);
        setCheckedChapterIds(nextChapters);
        setCheckedSectionIds(nextSections);
        setCheckedSubsectionIds(nextSubsections);
        notifyChange(
          nextFields,
          nextChapters,
          nextSections,
          nextSubsections,
        );
      } catch (error) {
        console.error(`Failed to delete ${type}:`, error);
      }
    },
    [
      chapters,
      sections,
      subsections,
      checkedFieldIds,
      checkedChapterIds,
      checkedSectionIds,
      checkedSubsectionIds,
      deleteField,
      deleteChapter,
      deleteSection,
      deleteSubsection,
      notifyChange,
    ],
  );

  // Handle rename for any hierarchy type
  const handleRename = useCallback(
    async (type: HierarchyType, id: string, newName: string) => {
      try {
        switch (type) {
          case "field":
            await renameField(id, newName);
            break;
          case "chapter":
            await renameChapter(id, newName);
            break;
          case "section":
            await renameSection(id, newName);
            break;
          case "subsection":
            await renameSubsection(id, newName);
            break;
        }
      } catch (error) {
        console.error(`Failed to rename ${type}:`, error);
      }
    },
    [renameField, renameChapter, renameSection, renameSubsection],
  );

  const handleCreateField = useCallback(async () => {
    if (!newFieldName.trim()) return;
    try {
      await createField(newFieldName.trim(), effectiveCollection || undefined);
      setNewFieldName("");
      setNewFieldPopoverOpened(false);
    } catch (error) {
      console.error("Failed to create field:", error);
    }
  }, [createField, newFieldName, effectiveCollection]);

  return (
    <Paper
      p={compact ? "xs" : "sm"}
      withBorder={!compact}
      style={{ position: "relative" }}
    >
      <LoadingOverlay visible={isLoading} />

      {!compact && (
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Title order={6}>Fields - Chapters - Sections - Subsections</Title>
            <ActionIcon size="sm" variant="subtle" onClick={handleRefresh}>
              <IconRefresh size={14} />
            </ActionIcon>
          </Group>

          {mode === "edit" && (
            <Group gap={4}>
              <Popover
                opened={newFieldPopoverOpened}
                onChange={setNewFieldPopoverOpened}
                width={200}
                position="bottom-end"
                withArrow
                shadow="md"
              >
                <Popover.Target>
                  <Tooltip label="New Field">
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      onClick={() => setNewFieldPopoverOpened((o) => !o)}
                    >
                      <IconPlus size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Popover.Target>
                <Popover.Dropdown>
                  <Group gap="xs">
                    <TextInput
                      size="xs"
                      placeholder="Field name"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateField();
                      }}
                      autoFocus
                    />
                    <Button size="xs" onClick={handleCreateField} fullWidth>
                      Create
                    </Button>
                  </Group>
                </Popover.Dropdown>
              </Popover>
              <Tooltip label="Expand All">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => setExpandAll(true)}
                >
                  <IconArrowsMaximize size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Collapse All">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={() => setExpandAll(false)}
                >
                  <IconArrowsMinimize size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>
      )}

      <Box style={{ maxHeight: compact ? 300 : 400, overflowY: "auto" }}>
        <HierarchyTree
          checkedFieldIds={checkedFieldIds}
          checkedChapterIds={checkedChapterIds}
          checkedSectionIds={checkedSectionIds}
          checkedSubsectionIds={checkedSubsectionIds}
          onCheck={handleCheck}
          onCreate={mode === "edit" ? handleCreate : undefined}
          onDelete={mode === "edit" ? handleDelete : undefined}
          onRename={mode === "edit" ? handleRename : undefined}
          mode={mode}
          expandAll={expandAll}
        />
      </Box>
    </Paper>
  );
};

export default HierarchyEditor;
