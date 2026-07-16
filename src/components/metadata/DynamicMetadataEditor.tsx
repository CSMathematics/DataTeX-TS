// ============================================================================
// Dynamic Metadata Editor
// Main component that dynamically renders the correct form based on resource type
// ============================================================================

import React, { useState, useEffect } from "react";
import { Stack, Button, Group, Alert, Loader, Text } from "@mantine/core";
import { IconCheck, IconAlertCircle } from "@tabler/icons-react";
import { useTypedMetadataStore } from "../../stores/typedMetadataStore";
import { useDatabaseStore } from "../../stores/databaseStore";
import { FileMetadataForm } from "./TypedMetadataForms";
import {
  DocumentMetadataForm,
  TableMetadataForm,
  FigureMetadataForm,
  CommandMetadataForm,
  PackageMetadataForm,
  PreambleMetadataForm,
  ClassMetadataForm,
  BibliographyMetadataForm,
  DtxMetadataForm,
  InsMetadataForm,
} from "./AdditionalMetadataForms";
import type { ResourceType } from "../../types/typedMetadata";

// ============================================================================
// Types
// ============================================================================

interface DynamicMetadataEditorProps {
  resourceId: string;
  resourceType: ResourceType;
  onSave?: () => void;
  /** Optional initial metadata - if provided, will use this instead of loading from database */
  initialMetadata?: any;
  /** Optional callback when metadata changes - useful for .dtex files */
  onMetadataChange?: (metadata: any) => void;
  /** Skip saving to database (for standalone .dtex files not in DB) */
  skipDatabaseSave?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export const DynamicMetadataEditor: React.FC<DynamicMetadataEditorProps> = ({
  resourceId,
  resourceType,
  onSave,
  initialMetadata,
  onMetadataChange,
  skipDatabaseSave = false,
}) => {
  const [metadata, setMetadata] = useState<any>(initialMetadata || {});
  const [isLoading, setIsLoading] = useState(!initialMetadata);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resourceCollection, setResourceCollection] = useState<
    string | undefined
  >(undefined);

  const loadTypedMetadata = useTypedMetadataStore(
    (state) => state.loadTypedMetadata,
  );
  const saveTypedMetadata = useTypedMetadataStore(
    (state) => state.saveTypedMetadata,
  );
  const loadAllLookupData = useTypedMetadataStore(
    (state) => state.loadAllLookupData,
  );

  const getResourceById = useDatabaseStore((state) => state.getResourceById);

  // Load lookup data and resource metadata on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 1. Fetch resource to get its collection context (CRITICAL for scoping)
        const resource = await getResourceById(resourceId);
        const collection = resource?.collection;
        setResourceCollection(collection);

        // 2. Load lookup data (scoped to collection if found)
        await loadAllLookupData(collection);

        // If we have initial metadata (e.g., from .dtex file), use it
        if (initialMetadata) {
          setMetadata(initialMetadata);
        } else {
          // Load existing metadata from database
          const existingMetadata = await loadTypedMetadata(
            resourceId,
            resourceType,
          );
          // Reset to existing metadata OR empty object if none exists
          // This prevents previous file's metadata from persisting
          setMetadata(existingMetadata || {});
        }
      } catch (err) {
        console.error("Failed to load metadata:", err);
        setError("Failed to load metadata");
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [resourceId, resourceType, initialMetadata]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveSuccess(false);
      setError(null);

      // Save to database (unless skipDatabaseSave is true for standalone .dtex files)
      if (!skipDatabaseSave) {
        // 1. Save to typed metadata tables (for relational queries)
        await saveTypedMetadata(resourceId, resourceType, metadata);

        // 2. Sync to main resource metadata JSON (for UI display in table view)
        // This ensures the DatabaseView sees the changes immediately without re-fetching
        await useDatabaseStore
          .getState()
          .updateResourceMetadata(resourceId, metadata);
      }

      // Notify parent about metadata change (for .dtex file saving)
      onMetadataChange?.(metadata);

      setSaveSuccess(true);
      onSave?.();

      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save metadata:", err);
      setError("Failed to save metadata");
    } finally {
      setIsSaving(false);
    }
  };

  // Render appropriate form component
  const renderForm = () => {
    const formProps = {
      resourceId,
      initialMetadata: metadata,
      onChange: setMetadata,
      collectionName: resourceCollection,
    };

    switch (resourceType) {
      case "file":
        return <FileMetadataForm {...formProps} />;
      case "document":
        return <DocumentMetadataForm {...formProps} />;
      case "table":
        return <TableMetadataForm {...formProps} />;
      case "figure":
        return <FigureMetadataForm {...formProps} />;
      case "command":
        return <CommandMetadataForm {...formProps} />;
      case "package":
        return <PackageMetadataForm {...formProps} />;
      case "preamble":
        return <PreambleMetadataForm {...formProps} />;
      case "class":
        return <ClassMetadataForm {...formProps} />;
      case "bibliography":
        return <BibliographyMetadataForm {...formProps} />;
      case "dtx":
        return <DtxMetadataForm {...formProps} />;
      case "ins":
        return <InsMetadataForm {...formProps} />;
      default:
        return (
          <Alert color="red" title="Unsupported Resource Type">
            Cannot edit metadata for resource type: {resourceType}
          </Alert>
        );
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" gap="md" p="xl">
        <Loader size="md" />
        <Text c="dimmed">Loading metadata...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error"
          color="red"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {saveSuccess && (
        <Alert icon={<IconCheck size={16} />} title="Success" color="green">
          Metadata saved successfully!
        </Alert>
      )}

      {renderForm()}

      <Group justify="flex-end" mt="md">
        <Button onClick={handleSave} loading={isSaving} disabled={isLoading}>
          Save Metadata
        </Button>
      </Group>
    </Stack>
  );
};

// ============================================================================
// Simplified version without save button (for inline editing)
// ============================================================================

interface SimpleMetadataEditorProps {
  resourceId: string;
  resourceType: ResourceType;
  initialMetadata?: any;
  onChange?: (metadata: any) => void;
}

export const SimpleMetadataEditor: React.FC<SimpleMetadataEditorProps> = ({
  resourceId,
  resourceType,
  initialMetadata = {},
  onChange,
}) => {
  const getResourceById = useDatabaseStore((state) => state.getResourceById);
  const [collectionName, setCollectionName] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    getResourceById(resourceId).then((r) => {
      setCollectionName(r?.collection);
    });
  }, [resourceId, getResourceById]);

  const formProps = {
    resourceId,
    initialMetadata,
    onChange,
    collectionName,
  };

  switch (resourceType) {
    case "file":
      return <FileMetadataForm {...formProps} />;
    case "document":
      return <DocumentMetadataForm {...formProps} />;
    case "table":
      return <TableMetadataForm {...formProps} />;
    case "figure":
      return <FigureMetadataForm {...formProps} />;
    case "command":
      return <CommandMetadataForm {...formProps} />;
    case "package":
      return <PackageMetadataForm {...formProps} />;
    case "preamble":
      return <PreambleMetadataForm {...formProps} />;
    case "class":
      return <ClassMetadataForm {...formProps} />;
    case "dtx":
      return <DtxMetadataForm {...formProps} />;
    case "ins":
      return <InsMetadataForm {...formProps} />;
    default:
      return <Text c="dimmed">Unsupported resource type: {resourceType}</Text>;
  }
};
