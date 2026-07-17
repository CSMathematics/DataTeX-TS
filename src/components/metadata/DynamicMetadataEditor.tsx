// ============================================================================
// Dynamic Metadata Editor
// Main component that dynamically renders the correct form based on resource type
// ============================================================================

import React, { useState, useEffect, useRef } from "react";
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

const metadataId = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id.trim() || undefined : undefined;
  }
  return undefined;
};

interface LookupOption {
  id: string;
  name: string;
}

interface LegacyLookupSnapshot {
  fields: LookupOption[];
  chapters: LookupOption[];
  sections: LookupOption[];
  subsections: LookupOption[];
  exerciseTypes: LookupOption[];
  fileTypes: LookupOption[];
  documentTypes: LookupOption[];
  tableTypes: LookupOption[];
  figureTypes: LookupOption[];
  packageTopics: LookupOption[];
  macroCommandTypes: LookupOption[];
  commandTypes: LookupOption[];
  preambleTypes: LookupOption[];
}

/**
 * Legacy metadata sometimes stores a lookup's display name (or a `{ id, name }`
 * object) where the typed schema expects an ID. Resolve an existing ID first,
 * then a unique exact name. Unknown values are stale references and must not be
 * submitted as foreign keys.
 */
const resolveLegacyLookupValue = (
  value: unknown,
  options: LookupOption[],
): string | undefined => {
  const candidateId = metadataId(value);
  if (candidateId && options.some((option) => option.id === candidateId)) {
    return candidateId;
  }

  const candidateName =
    value && typeof value === "object" && "name" in value
      ? (value as { name?: unknown }).name
      : value;
  const name =
    typeof candidateName === "string" ? candidateName.trim() : undefined;
  if (!name) return undefined;

  const matches = options.filter((option) => option.name.trim() === name);
  return matches.length === 1 ? matches[0].id : undefined;
};

const resolveLegacyLookupArray = (
  value: unknown,
  options: LookupOption[],
): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((candidate) => resolveLegacyLookupValue(candidate, options))
        .filter((id): id is string => Boolean(id)),
    ),
  );
};

/**
 * Reconcile only legacy/resource-JSON/.dtex input. Typed rows are deliberately
 * excluded: a valid typed ID may be outside the collection-scoped UI snapshot.
 */
const reconcileLegacyLookupMetadata = (
  source: Record<string, any>,
  resourceType: ResourceType,
  lookups: LegacyLookupSnapshot,
) => {
  const reconciled = { ...source };
  const scalar = (key: string, options: LookupOption[]) => {
    reconciled[key] = resolveLegacyLookupValue(reconciled[key], options);
  };
  const array = (key: string, options: LookupOption[]) => {
    reconciled[key] = resolveLegacyLookupArray(reconciled[key], options);
  };
  const hierarchy = () => {
    scalar("fieldId", lookups.fields);
    array("chapters", lookups.chapters);
    array("sections", lookups.sections);
    array("subsections", lookups.subsections);
  };

  switch (resourceType) {
    case "file":
      hierarchy();
      scalar("fileTypeId", lookups.fileTypes);
      array("exerciseTypes", lookups.exerciseTypes);
      break;
    case "document":
      hierarchy();
      scalar("documentTypeId", lookups.documentTypes);
      break;
    case "table":
      hierarchy();
      scalar("tableTypeId", lookups.tableTypes);
      break;
    case "figure":
      hierarchy();
      scalar("figureTypeId", lookups.figureTypes);
      break;
    case "command":
      scalar("commandTypeId", lookups.commandTypes);
      break;
    case "package":
      scalar("topicId", lookups.packageTopics);
      array("topics", lookups.packageTopics);
      break;
    case "preamble":
      scalar("preambleTypeId", lookups.preambleTypes);
      array("commandTypes", lookups.macroCommandTypes);
      break;
    case "class":
      scalar("fileTypeId", lookups.fileTypes);
      break;
  }

  return reconciled;
};

const FK_REFERENCE_KEYS = [
  "fieldId",
  "chapters",
  "sections",
  "subsections",
  "exerciseTypes",
  "fileTypeId",
  "documentTypeId",
  "tableTypeId",
  "figureTypeId",
  "commandTypeId",
  "topicId",
  "topics",
  "preambleTypeId",
  "commandTypes",
  "preambleId",
  "solutionDocumentId",
  "targetDtxId",
] as const;

const metadataReferenceDiagnostics = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const record = metadata as Record<string, unknown>;
  return Object.fromEntries(
    FK_REFERENCE_KEYS.filter((key) => key in record).map((key) => [
      key,
      record[key],
    ]),
  );
};

/**
 * Convert legacy resource/.dtex aliases to the keys consumed by the typed
 * forms. Unknown keys stay intact so format-specific metadata is not lost.
 */
const normalizeMetadataForEditor = (
  source: unknown,
  resourceType: ResourceType,
) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};

  const raw = source as Record<string, any>;
  const normalized = { ...raw };
  const taxonomy =
    raw.taxonomy && typeof raw.taxonomy === "object" ? raw.taxonomy : {};

  if (resourceType === "file") {
    normalized.fieldId ??= metadataId(raw.field) ?? metadataId(taxonomy.field);
    normalized.solvedProoved ??= raw.solved_prooved;
    normalized.fileDescription ??= raw.description;
    // Early .dtex exports used 0 to mean "not specified", while both the UI
    // and typed schema define difficulty as 1-5.
    if (normalized.difficulty === 0) normalized.difficulty = undefined;
  }

  if (["file", "document", "table", "figure"].includes(resourceType)) {
    const chapterId = metadataId(taxonomy.chapter);
    const sectionId = metadataId(taxonomy.section);
    const subsectionId = metadataId(taxonomy.subsection);
    normalized.fieldId ??= metadataId(taxonomy.field);
    normalized.chapters = Array.isArray(raw.chapters)
      ? raw.chapters
      : chapterId
        ? [chapterId]
        : [];
    normalized.sections = Array.isArray(raw.sections)
      ? raw.sections
      : sectionId
        ? [sectionId]
        : [];
    normalized.subsections = Array.isArray(raw.subsections)
      ? raw.subsections
      : subsectionId
        ? [subsectionId]
        : [];
  }

  return normalized;
};

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
  const [metadata, setMetadata] = useState<any>(() =>
    normalizeMetadataForEditor(initialMetadata, resourceType),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resourceCollection, setResourceCollection] = useState<
    string | undefined
  >(undefined);
  const reconcileLegacyBeforeSaveRef = useRef(false);

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
    let cancelled = false;

    const initialize = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 1. Fetch resource to get its collection context (CRITICAL for scoping)
        const resource = await getResourceById(resourceId);
        if (cancelled) return;
        const collection = resource?.collection;
        setResourceCollection(collection);

        // 2. Load lookup data (scoped to collection if found)
        await loadAllLookupData(collection);
        if (cancelled) return;

        // If we have initial metadata (e.g., from .dtex file), use it
        if (initialMetadata) {
          const normalized = normalizeMetadataForEditor(
            initialMetadata,
            resourceType,
          );
          // A standalone .dtex file can legitimately reference a source DB
          // that is not loaded. Reconcile only when this payload will be sent
          // to the active database.
          reconcileLegacyBeforeSaveRef.current = !skipDatabaseSave;
          setMetadata(
            skipDatabaseSave
              ? normalized
              : reconcileLegacyLookupMetadata(
                  normalized,
                  resourceType,
                  useTypedMetadataStore.getState(),
                ),
          );
        } else {
          // Load existing metadata from database
          const existingMetadata = await loadTypedMetadata(
            resourceId,
            resourceType,
          );
          if (cancelled) return;
          // Older/imported resources may only have JSON metadata. Preserve it
          // as the migration source until the first typed save creates rows.
          const normalized = normalizeMetadataForEditor(
            existingMetadata ?? resource?.metadata ?? {},
            resourceType,
          );
          const isLegacyFallback = existingMetadata == null;
          reconcileLegacyBeforeSaveRef.current = isLegacyFallback;
          setMetadata(
            isLegacyFallback
              ? reconcileLegacyLookupMetadata(
                  normalized,
                  resourceType,
                  useTypedMetadataStore.getState(),
                )
              : normalized,
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load metadata:", err);
        setError(`Failed to load metadata: ${String(err)}`);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [resourceId, resourceType, initialMetadata, skipDatabaseSave]);

  const handleSave = async () => {
    let attemptedMetadata = metadata;
    try {
      setIsSaving(true);
      setSaveSuccess(false);
      setError(null);
      let savedMetadata = metadata;

      // Save to database (unless skipDatabaseSave is true for standalone .dtex files)
      if (!skipDatabaseSave) {
        const metadataToSave = reconcileLegacyBeforeSaveRef.current
          ? reconcileLegacyLookupMetadata(
              metadata,
              resourceType,
              useTypedMetadataStore.getState(),
            )
          : metadata;
        attemptedMetadata = metadataToSave;
        if (metadataToSave !== metadata) setMetadata(metadataToSave);

        // The backend persists typed tables and resources.metadata in one
        // transaction, then returns the exact normalized snapshot it stored.
        savedMetadata = await saveTypedMetadata(
          resourceId,
          resourceType,
          metadataToSave,
        );
        reconcileLegacyBeforeSaveRef.current = false;
        setMetadata(savedMetadata);
        useDatabaseStore
          .getState()
          .setResourceMetadataLocal(resourceId, savedMetadata);
      }

      // Notify parent about metadata change (for .dtex file saving)
      onMetadataChange?.(savedMetadata);

      setSaveSuccess(true);
      onSave?.();

      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save metadata:", {
        error: err,
        resourceId,
        resourceType,
        references: metadataReferenceDiagnostics(attemptedMetadata),
      });
      setError(`Failed to save metadata: ${String(err)}`);
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
