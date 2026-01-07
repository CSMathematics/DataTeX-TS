// Typed Metadata Form Components with Creatable Combobox Lookups
import React, { useState } from "react";
import {
  Stack,
  Textarea,
  NumberInput,
  Checkbox,
  Loader,
  Select,
  MultiSelect,
} from "@mantine/core";

import { useTypedMetadataStore } from "../../stores/typedMetadataStore";
import type { FileMetadata } from "../../types/typedMetadata";
import { HierarchyEditor } from "./HierarchyEditor";

// ============================================================================
// Reusable Creatable Select Component
// ============================================================================

// ============================================================================
// Reusable Creatable Select Component (using Standard Select)
// ============================================================================

export interface CreatableSelectProps {
  label: string;
  placeholder: string;
  data: { id: string; name: string }[];
  value?: string;
  onChange: (value: string | undefined) => void;
  onCreate: (name: string) => Promise<{ id: string; name: string }>;
  disabled?: boolean;
}

export const CreatableSelect: React.FC<CreatableSelectProps> = ({
  label,
  placeholder,
  data,
  value,
  onChange,
  onCreate,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);

  // Prepare data options - create fresh array each render
  const baseOptions = data.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  // Check if search value exists in options (case insensitive)
  const exactMatch = baseOptions.some(
    (opt) => opt.label.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  // Add "Create" option if typing and no exact match
  const options =
    searchQuery.trim() && !exactMatch && !creating
      ? [
          ...baseOptions,
          { value: "$create", label: `+ Create "${searchQuery}"` },
        ]
      : baseOptions;

  const handleChange = async (val: string | null) => {
    if (val === "$create") {
      if (!searchQuery.trim()) return;
      setCreating(true);
      try {
        const newItem = await onCreate(searchQuery.trim());
        setSearchQuery("");
        onChange(newItem.id);
      } catch (error) {
        console.error("Failed to create:", error);
      } finally {
        setCreating(false);
      }
    } else {
      setSearchQuery("");
      onChange(val || undefined);
    }
  };

  return (
    <Select
      label={label}
      placeholder={placeholder}
      data={options}
      value={value}
      onChange={handleChange}
      searchable
      clearable
      onSearchChange={setSearchQuery}
      nothingFoundMessage={creating ? "Creating..." : "No options"}
      disabled={disabled || creating}
      rightSection={creating ? <Loader size={16} /> : null}
    />
  );
};

// ============================================================================
// Reusable Creatable Multi-Select Component (using Standard MultiSelect)
// ============================================================================

export interface CreatableMultiSelectProps {
  label: string;
  placeholder: string;
  data: { id: string; name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  onCreate: (name: string) => Promise<{ id: string; name: string }>;
  disabled?: boolean;
}

export const CreatableMultiSelect: React.FC<CreatableMultiSelectProps> = ({
  label,
  placeholder,
  data,
  value,
  onChange,
  onCreate,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);

  // Prepare data options - create fresh array each render
  const baseOptions = data.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  // Check if search value exists in options (case insensitive)
  const exactMatch = baseOptions.some(
    (opt) => opt.label.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  // Add "Create" option if typing and no exact match
  const options =
    searchQuery.trim() && !exactMatch && !creating
      ? [
          ...baseOptions,
          { value: "$create", label: `+ Create "${searchQuery}"` },
        ]
      : baseOptions;

  const handleChange = async (vals: string[]) => {
    if (vals.includes("$create")) {
      if (!searchQuery.trim()) return;
      setCreating(true);
      try {
        const newItem = await onCreate(searchQuery.trim());
        setSearchQuery("");
        const newValues = vals
          .filter((v) => v !== "$create")
          .concat(newItem.id);
        onChange(newValues);
      } catch (error) {
        console.error("Failed to create:", error);
        onChange(vals.filter((v) => v !== "$create"));
      } finally {
        setCreating(false);
      }
    } else {
      setSearchQuery("");
      onChange(vals);
    }
  };

  return (
    <MultiSelect
      label={label}
      placeholder={placeholder}
      data={options}
      value={value}
      onChange={handleChange}
      searchable
      onSearchChange={setSearchQuery}
      nothingFoundMessage={creating ? "Creating..." : "No options"}
      disabled={disabled || creating}
      rightSection={creating ? <Loader size={16} /> : null}
    />
  );
};

// ============================================================================
// File Metadata Form
// ============================================================================

interface FileMetadataFormProps {
  resourceId: string;
  initialMetadata?: FileMetadata;
  onChange?: (metadata: FileMetadata) => void;
}

export const FileMetadataForm: React.FC<FileMetadataFormProps> = ({
  initialMetadata = {},
  onChange,
}) => {
  const [metadata, setMetadata] = useState<FileMetadata>(initialMetadata);

  // Only need fileTypes and exerciseTypes - HierarchyEditor handles hierarchy data
  const fileTypes = useTypedMetadataStore((state) => state.fileTypes);
  const exerciseTypes = useTypedMetadataStore((state) => state.exerciseTypes);
  const createFileType = useTypedMetadataStore((state) => state.createFileType);
  const createExerciseType = useTypedMetadataStore(
    (state) => state.createExerciseType
  );

  const handleChange = <K extends keyof FileMetadata>(
    field: K,
    value: FileMetadata[K]
  ) => {
    const updated = { ...metadata, [field]: value };
    setMetadata(updated);
    onChange?.(updated);
  };

  return (
    <Stack gap="md">
      {/* File Type - Creatable */}
      <CreatableSelect
        label="File Type"
        placeholder="Select or create file type..."
        data={fileTypes}
        value={metadata.fileTypeId}
        onChange={(value) => handleChange("fileTypeId", value)}
        onCreate={createFileType}
      />

      {/* Hierarchical Category Selection (Tree View) */}
      <HierarchyEditor
        selectedFieldId={metadata.fieldId}
        selectedChapterIds={metadata.chapters}
        selectedSectionIds={metadata.sections}
        selectedSubsectionIds={metadata.subsections}
        onChange={(selections) => {
          const updated = {
            ...metadata,
            fieldId: selections.fieldId,
            chapters:
              selections.chapters.length > 0 ? selections.chapters : undefined,
            sections:
              selections.sections.length > 0 ? selections.sections : undefined,
            subsections:
              selections.subsections.length > 0
                ? selections.subsections
                : undefined,
          };
          setMetadata(updated);
          onChange?.(updated);
        }}
        mode="edit"
      />

      {/* Exercise Types - Creatable MultiSelect */}
      <CreatableMultiSelect
        label="Exercise Types"
        placeholder="Select or create exercise types..."
        data={exerciseTypes}
        value={metadata.exerciseTypes || []}
        onChange={(value) =>
          handleChange("exerciseTypes", value.length > 0 ? value : undefined)
        }
        onCreate={createExerciseType}
      />

      <NumberInput
        label="Difficulty Level"
        placeholder="1-5"
        min={1}
        max={5}
        value={metadata.difficulty}
        onChange={(value) =>
          handleChange(
            "difficulty",
            typeof value === "number" ? value : undefined
          )
        }
      />

      <Textarea
        label="Description"
        placeholder="Describe the file content..."
        value={metadata.fileDescription || ""}
        onChange={(e) =>
          handleChange("fileDescription", e.currentTarget.value || undefined)
        }
        autosize
        minRows={2}
      />

      <CreatableSelect
        label="Build Command"
        placeholder="Select build command..."
        data={[
          { id: "pdflatex", name: "pdflatex" },
          { id: "xelatex", name: "xelatex" },
          { id: "lualatex", name: "lualatex" },
          { id: "latex", name: "latex" },
        ]}
        value={metadata.buildCommand}
        onChange={(value) => handleChange("buildCommand", value)}
        onCreate={async (name) => ({ id: name, name })} // No backend call needed
      />

      <Checkbox
        label="Solved / Prooved"
        checked={metadata.solvedProoved || false}
        onChange={(e) => handleChange("solvedProoved", e.currentTarget.checked)}
      />

      {/* Custom Tags - Freeform Creatable */}
      <CreatableMultiSelect
        label="Custom Tags"
        placeholder="Type and create custom tags..."
        data={(metadata.customTags || []).map((tag) => ({
          id: tag,
          name: tag,
        }))}
        value={metadata.customTags || []}
        onChange={(value) =>
          handleChange("customTags", value.length > 0 ? value : undefined)
        }
        onCreate={async (name) => ({ id: name, name })} // Freeform - no backend
      />
    </Stack>
  );
};
