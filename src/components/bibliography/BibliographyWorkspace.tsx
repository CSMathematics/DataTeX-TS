import React, { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
  MultiSelect,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faArrowLeft,
  faBookOpen,
  faBroom,
  faDatabase,
  faDownload,
  faFileImport,
  faFilter,
  faMagnifyingGlass,
  faTags,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import {
  ALL_BIBLIOGRAPHY_ENTRY_TYPES,
  useBibliographyWorkspaceStore,
} from "../../stores/bibliographyWorkspaceStore";

interface BibliographyWorkspaceProps {
  onClose?: () => void;
}

interface BibliographyEntrySummary {
  id: string;
  source_id: string;
  entry_type: string;
  citation_key: string;
  title?: string | null;
  year?: string | null;
  date?: string | null;
  doi?: string | null;
  url?: string | null;
  raw_entry?: string | null;
  tags: string[];
  fields: Record<string, unknown>;
}

interface BibliographyTagSummary {
  id: string;
  name: string;
  entry_count: number;
}

interface BibliographySourceOption {
  id: string;
  resource_id: string;
  title?: string | null;
  collection?: string | null;
  path: string;
  parse_status: string;
  entry_count: number;
}

interface BibliographyReparseEvent {
  resourceId?: string | null;
  sourceId?: string | null;
  path: string;
  entriesImported?: number | null;
  parseStatus?: string | null;
  diagnosticsCount?: number | null;
  skipped: boolean;
  error?: string | null;
}

interface BibliographyContentImportResult {
  source: {
    id: string;
    resource_id: string;
    path: string;
    parse_status: string;
    content_hash: string;
  };
  format: string;
  entries_imported: number;
  skipped_invalid: number;
  diagnostics: Array<{
    message: string;
    byte_start: number;
    byte_end: number;
  }>;
}

interface BibliographyDoiLookupResult {
  provider: string;
  doi: string;
  entry_type: string;
  citation_key?: string | null;
  fields: Record<string, string>;
}

interface BibliographyEntryNoteSummary {
  id: string;
  entry_id: string;
  body: string;
  note_kind: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface BibliographyEntryAttachmentSummary {
  id: string;
  entry_id: string;
  resource_id?: string | null;
  path: string;
  title?: string | null;
  attachment_kind: string;
  mime_type?: string | null;
  file_size?: number | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

interface BibliographyPdfAnnotationSummary {
  id: string;
  entry_id: string;
  attachment_id: string;
  attachment_path: string;
  attachment_title?: string | null;
  page: number;
  annotation_kind: string;
  selected_text?: string | null;
  comment?: string | null;
  color?: string | null;
  rects: unknown;
  external_annotation_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface BibliographyEntryUsageSummary {
  resource_id: string;
  resource_path: string;
  resource_title?: string | null;
  resource_type: string;
  collection: string;
  occurrence_count: number;
  first_byte_start?: number | null;
  commands: string[];
  scan_statuses: string[];
}

interface BibliographyRelatedEntrySummary {
  entry_id: string;
  citation_key: string;
  entry_type: string;
  title?: string | null;
  year?: string | null;
  resource_count: number;
  occurrence_count: number;
}

interface BibliographyCitationGraphSummary {
  entry_id: string;
  citation_key: string;
  used_by: BibliographyEntryUsageSummary[];
  related_entries: BibliographyRelatedEntrySummary[];
  resource_count: number;
  occurrence_count: number;
}

interface BibliographyCollectionFederationSummary {
  id?: string | null;
  collection: string;
  remote_kind: string;
  remote_url?: string | null;
  sync_mode: string;
  conflict_policy: string;
  is_enabled: boolean;
  sync_status: string;
  last_sync_at?: string | null;
  last_error?: string | null;
  source_count: number;
  entry_count: number;
  created_at?: string | null;
  updated_at?: string | null;
}

const ENTRY_LIMIT = 500;
const ALL_TYPES = ALL_BIBLIOGRAPHY_ENTRY_TYPES;
const DOI_PROVIDERS = [
  { value: "auto", label: "Auto" },
  { value: "crossref", label: "Crossref" },
  { value: "datacite", label: "DataCite" },
];
const EXPORT_FORMATS = [
  { value: "bibtex", label: "BibTeX/BibLaTeX" },
  { value: "csl-json", label: "CSL JSON / Zotero" },
];
type CitationPreviewStyle = "apa" | "mla" | "chicago";
const CITATION_PREVIEW_STYLES: Array<{
  value: CitationPreviewStyle;
  label: string;
}> = [
  { value: "apa", label: "APA" },
  { value: "mla", label: "MLA" },
  { value: "chicago", label: "Chicago" },
];
const NOTE_KIND_OPTIONS = [
  { value: "note", label: "Note" },
  { value: "quote", label: "Quote" },
  { value: "idea", label: "Idea" },
  { value: "todo", label: "To-do" },
];
const PDF_ANNOTATION_KIND_OPTIONS = [
  { value: "highlight", label: "Highlight" },
  { value: "note", label: "Note" },
  { value: "quote", label: "Quote" },
  { value: "bookmark", label: "Bookmark" },
];
const FEDERATION_REMOTE_KIND_OPTIONS = [
  { value: "shared_folder", label: "Shared folder" },
  { value: "git", label: "Git repository" },
  { value: "zotero", label: "Zotero library" },
  { value: "webdav", label: "WebDAV" },
  { value: "custom", label: "Custom" },
];
const FEDERATION_SYNC_MODE_OPTIONS = [
  { value: "manual", label: "Manual" },
  { value: "pull_only", label: "Pull only" },
  { value: "push_pull", label: "Push / pull" },
];
const FEDERATION_CONFLICT_POLICY_OPTIONS = [
  { value: "manual", label: "Manual review" },
  { value: "local_wins", label: "Local wins" },
  { value: "remote_wins", label: "Remote wins" },
];
const SMART_VIEWS = [
  { value: "all", label: "All entries" },
  { value: "missing_metadata", label: "Missing metadata" },
  { value: "duplicate_candidates", label: "Duplicate candidates" },
  { value: "with_doi", label: "With DOI" },
  { value: "without_doi", label: "Without DOI" },
];
const ENTRY_TYPES = [
  ALL_TYPES,
  "article",
  "book",
  "inbook",
  "incollection",
  "inproceedings",
  "proceedings",
  "misc",
  "online",
  "thesis",
  "phdthesis",
  "mastersthesis",
  "unpublished",
];
const COMMON_FIELDS = [
  "author",
  "editor",
  "title",
  "subtitle",
  "journal",
  "booktitle",
  "publisher",
  "year",
  "date",
  "doi",
  "url",
  "isbn",
  "abstract",
];

interface EntryDraft {
  entryType: string;
  citationKey: string;
  fields: Record<string, string>;
  rawEntry: string;
}

interface CitationPreviewInput {
  entryType: string;
  citationKey: string;
  fields: Record<string, string>;
}

export const BibliographyWorkspace: React.FC<BibliographyWorkspaceProps> = ({
  onClose,
}) => {
  const { t } = useTranslation();
  const [sources, setSources] = useState<BibliographySourceOption[]>([]);
  const [tags, setTags] = useState<BibliographyTagSummary[]>([]);
  const [entries, setEntries] = useState<BibliographyEntrySummary[]>([]);
  const [federationSettings, setFederationSettings] = useState<
    BibliographyCollectionFederationSummary[]
  >([]);
  const selectedSourceId = useBibliographyWorkspaceStore(
    (state) => state.selectedSourceId,
  );
  const setSelectedSourceId = useBibliographyWorkspaceStore(
    (state) => state.setSelectedSourceId,
  );
  const toggleSelectedSourceId = useBibliographyWorkspaceStore(
    (state) => state.toggleSelectedSourceId,
  );
  const entryType = useBibliographyWorkspaceStore((state) => state.entryType);
  const setEntryType = useBibliographyWorkspaceStore(
    (state) => state.setEntryType,
  );
  const smartView = useBibliographyWorkspaceStore((state) => state.smartView);
  const setSmartView = useBibliographyWorkspaceStore(
    (state) => state.setSmartView,
  );
  const selectedTag = useBibliographyWorkspaceStore(
    (state) => state.selectedTag,
  );
  const setSelectedTag = useBibliographyWorkspaceStore(
    (state) => state.setSelectedTag,
  );
  const query = useBibliographyWorkspaceStore((state) => state.query);
  const setQuery = useBibliographyWorkspaceStore((state) => state.setQuery);
  const clearFilters = useBibliographyWorkspaceStore(
    (state) => state.clearFilters,
  );
  const refreshRevision = useBibliographyWorkspaceStore(
    (state) => state.refreshRevision,
  );
  const [selectedFederationCollection, setSelectedFederationCollection] =
    useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [federationBusy, setFederationBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState("bibtex");
  const [editorMode, setEditorMode] = useState<string | null>("structured");
  const [citationPreviewStyle, setCitationPreviewStyle] =
    useState<CitationPreviewStyle>("apa");
  const [draft, setDraft] = useState<EntryDraft | null>(null);
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [entryTagInput, setEntryTagInput] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [batchFieldName, setBatchFieldName] = useState("note");
  const [batchFieldValue, setBatchFieldValue] = useState("");
  const [batchTagName, setBatchTagName] = useState("");
  const [doiQuery, setDoiQuery] = useState("");
  const [doiProvider, setDoiProvider] = useState("auto");
  const [doiBusy, setDoiBusy] = useState(false);
  const [doiLookup, setDoiLookup] =
    useState<BibliographyDoiLookupResult | null>(null);
  const [entryNotes, setEntryNotes] = useState<BibliographyEntryNoteSummary[]>(
    [],
  );
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [entryAttachments, setEntryAttachments] = useState<
    BibliographyEntryAttachmentSummary[]
  >([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [pdfAnnotations, setPdfAnnotations] = useState<
    BibliographyPdfAnnotationSummary[]
  >([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(false);
  const [annotationBusy, setAnnotationBusy] = useState(false);
  const [citationGraph, setCitationGraph] =
    useState<BibliographyCitationGraphSummary | null>(null);
  const [citationGraphLoading, setCitationGraphLoading] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(
    null,
  );
  const [annotationAttachmentId, setAnnotationAttachmentId] = useState<
    string | null
  >(null);
  const [annotationPage, setAnnotationPage] = useState("1");
  const [annotationKind, setAnnotationKind] = useState("highlight");
  const [annotationSelectedText, setAnnotationSelectedText] = useState("");
  const [annotationComment, setAnnotationComment] = useState("");
  const [annotationColor, setAnnotationColor] = useState("#ffd43b");
  const [federationRemoteKind, setFederationRemoteKind] =
    useState("shared_folder");
  const [federationRemoteUrl, setFederationRemoteUrl] = useState("");
  const [federationSyncMode, setFederationSyncMode] = useState("manual");
  const [federationConflictPolicy, setFederationConflictPolicy] =
    useState("manual");
  const [federationEnabled, setFederationEnabled] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteKind, setNoteKind] = useState("note");
  const [notePinned, setNotePinned] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSources, nextTags, nextEntries, nextFederationSettings] =
        await Promise.all([
          invoke<BibliographySourceOption[]>(
            "list_all_bibliography_sources_cmd",
          ),
          invoke<BibliographyTagSummary[]>("list_bibliography_tags_cmd"),
          invoke<BibliographyEntrySummary[]>(
            "list_bibliography_workspace_entries_cmd",
            {
              sourceId: selectedSourceId,
              query: debouncedQuery,
              entryType: entryType === ALL_TYPES ? null : entryType,
              smartView,
              tag: selectedTag,
              limit: ENTRY_LIMIT,
            },
          ),
          invoke<BibliographyCollectionFederationSummary[]>(
            "list_bibliography_collection_federation_cmd",
          ),
        ]);
      setSources(nextSources);
      setTags(nextTags);
      setEntries(nextEntries);
      setFederationSettings(nextFederationSettings);
      setSelectedFederationCollection((current) =>
        current &&
        nextFederationSettings.some((setting) => setting.collection === current)
          ? current
          : nextFederationSettings[0]?.collection ?? null,
      );
      setSelectedEntryIds((current) => {
        const available = new Set(nextEntries.map((entry) => entry.id));
        return new Set([...current].filter((id) => available.has(id)));
      });
      setSelectedEntryId((current) =>
        current && nextEntries.some((entry) => entry.id === current)
          ? current
          : nextEntries[0]?.id ?? null,
      );
    } catch (caught) {
      console.error("Failed to load bibliography workspace:", caught);
      setError(String(caught));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedQuery,
    entryType,
    refreshRevision,
    selectedSourceId,
    selectedTag,
    smartView,
  ]);

  const refreshWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentSources = await invoke<BibliographySourceOption[]>(
        "list_all_bibliography_sources_cmd",
      );
      const resourceIds = [
        ...new Set(
          currentSources
            .map((source) => source.resource_id)
            .filter((resourceId) => resourceId && resourceId.trim().length > 0),
        ),
      ];

      const results = await Promise.allSettled(
        resourceIds.map((resourceId) =>
          invoke("reparse_bibliography_resource_cmd", { resourceId }),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected");

      await loadWorkspace();

      if (failed.length > 0) {
        setError(`Failed to reparse ${failed.length} bibliography source(s).`);
      }
    } catch (caught) {
      console.error("Failed to refresh bibliography workspace:", caught);
      setError(String(caught));
      setLoading(false);
    }
  }, [loadWorkspace]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    invoke("watch_bibliography_resources_cmd").catch((caught) => {
      console.warn("Failed to start bibliography watcher:", caught);
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    listen<BibliographyReparseEvent>("bibliography-resource-reparsed", (event) => {
      if (event.payload.skipped) return;
      if (event.payload.error) {
        console.warn("Bibliography watcher reparse failed:", event.payload.error);
        return;
      }
      void loadWorkspace();
    })
      .then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          cleanup = unlisten;
        }
      })
      .catch((caught) => {
        console.warn("Failed to listen for bibliography changes:", caught);
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [loadWorkspace]);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? null,
    [entries, selectedEntryId],
  );
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedEntry?.source_id),
    [selectedEntry?.source_id, sources],
  );
  const selectedFederationSetting = useMemo(
    () =>
      federationSettings.find(
        (setting) => setting.collection === selectedFederationCollection,
      ) ?? null,
    [federationSettings, selectedFederationCollection],
  );
  const citationPreview = useMemo(() => {
    if (!selectedEntry || !draft) return null;
    return buildCitationPreview(
      {
        entryType: draft.entryType,
        citationKey: draft.citationKey,
        fields: draft.fields,
      },
      citationPreviewStyle,
    );
  }, [citationPreviewStyle, draft, selectedEntry]);
  useEffect(() => {
    if (!selectedEntry) {
      setDraft(null);
      setEntryNotes([]);
      setEntryAttachments([]);
      setPdfAnnotations([]);
      setCitationGraph(null);
      return;
    }
    setDraft({
      entryType: selectedEntry.entry_type,
      citationKey: selectedEntry.citation_key,
      fields: fieldsToStringRecord(selectedEntry.fields),
      rawEntry: selectedEntry.raw_entry || buildRawPreview(selectedEntry),
    });
    setTagDraft(selectedEntry.tags || []);
    setNewFieldName("");
    setEntryTagInput("");
  }, [selectedEntry]);
  useEffect(() => {
    if (!selectedFederationSetting) {
      setFederationRemoteKind("shared_folder");
      setFederationRemoteUrl("");
      setFederationSyncMode("manual");
      setFederationConflictPolicy("manual");
      setFederationEnabled(false);
      return;
    }
    setFederationRemoteKind(selectedFederationSetting.remote_kind);
    setFederationRemoteUrl(selectedFederationSetting.remote_url || "");
    setFederationSyncMode(selectedFederationSetting.sync_mode);
    setFederationConflictPolicy(selectedFederationSetting.conflict_policy);
    setFederationEnabled(selectedFederationSetting.is_enabled);
  }, [selectedFederationSetting]);
  useEffect(() => {
    let cancelled = false;
    setEditingNoteId(null);
    setNoteDraft("");
    setNoteKind("note");
    setNotePinned(false);
    if (!selectedEntry) {
      setEntryNotes([]);
      return;
    }
    setNotesLoading(true);
    invoke<BibliographyEntryNoteSummary[]>("list_bibliography_entry_notes_cmd", {
      entryId: selectedEntry.id,
    })
      .then((notes) => {
        if (!cancelled) setEntryNotes(notes);
      })
      .catch((caught) => {
        console.error("Failed to load bibliography entry notes:", caught);
        if (!cancelled) {
          setEntryNotes([]);
          setError(String(caught));
        }
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEntry]);
  useEffect(() => {
    let cancelled = false;
    if (!selectedEntry) {
      setCitationGraph(null);
      return;
    }
    setCitationGraphLoading(true);
    invoke<BibliographyCitationGraphSummary>("bibliography_citation_graph_cmd", {
      entryId: selectedEntry.id,
      limit: 80,
    })
      .then((graph) => {
        if (!cancelled) setCitationGraph(graph);
      })
      .catch((caught) => {
        console.error("Failed to load bibliography citation graph:", caught);
        if (!cancelled) {
          setCitationGraph(null);
          setError(String(caught));
        }
      })
      .finally(() => {
        if (!cancelled) setCitationGraphLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEntry]);
  useEffect(() => {
    let cancelled = false;
    setPdfAnnotations([]);
    if (!selectedEntry) {
      setEntryAttachments([]);
      return;
    }
    setAttachmentsLoading(true);
    invoke<BibliographyEntryAttachmentSummary[]>(
      "list_bibliography_entry_attachments_cmd",
      {
        entryId: selectedEntry.id,
      },
    )
      .then((attachments) => {
        if (!cancelled) {
          setEntryAttachments(attachments.sort(compareEntryAttachments));
        }
      })
      .catch((caught) => {
        console.error("Failed to load bibliography entry attachments:", caught);
        if (!cancelled) {
          setEntryAttachments([]);
          setError(String(caught));
        }
      })
      .finally(() => {
        if (!cancelled) setAttachmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEntry]);
  useEffect(() => {
    let cancelled = false;
    setEditingAnnotationId(null);
    setAnnotationPage("1");
    setAnnotationKind("highlight");
    setAnnotationSelectedText("");
    setAnnotationComment("");
    setAnnotationColor("#ffd43b");
    if (!selectedEntry) {
      setPdfAnnotations([]);
      return;
    }
    setAnnotationsLoading(true);
    invoke<BibliographyPdfAnnotationSummary[]>(
      "list_bibliography_pdf_annotations_cmd",
      { entryId: selectedEntry.id },
    )
      .then((annotations) => {
        if (!cancelled) {
          setPdfAnnotations(annotations.sort(comparePdfAnnotations));
        }
      })
      .catch((caught) => {
        console.error("Failed to load bibliography PDF annotations:", caught);
        if (!cancelled) {
          setPdfAnnotations([]);
          setError(String(caught));
        }
      })
      .finally(() => {
        if (!cancelled) setAnnotationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEntry]);
  useEffect(() => {
    if (entryAttachments.length === 0) {
      setAnnotationAttachmentId(null);
      return;
    }
    if (
      annotationAttachmentId &&
      entryAttachments.some((attachment) => attachment.id === annotationAttachmentId)
    ) {
      return;
    }
    setAnnotationAttachmentId(
      entryAttachments.find((attachment) => attachment.is_primary)?.id ||
        entryAttachments[0].id,
    );
  }, [annotationAttachmentId, entryAttachments]);
  const sourceOptions = useMemo(
    () => [
      {
        value: "__all__",
        label: t("bibliography.workspace.allSources", {
          defaultValue: "All sources",
        }),
      },
      ...sources.map((source) => ({
        value: source.id,
        label: sourceLabel(source),
      })),
    ],
    [sources, t],
  );
  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const tagOptions = useMemo(
    () => tags.map((tag) => ({ value: tag.name, label: `${tag.name} (${tag.entry_count})` })),
    [tags],
  );
  const totalEntries = sources.reduce(
    (total, source) => total + source.entry_count,
    0,
  );
  const filtersActive = Boolean(
    selectedSourceId ||
      selectedTag ||
      query.trim() ||
      entryType !== ALL_TYPES ||
      smartView !== "all",
  );
  const selectedCount = selectedEntryIds.size;
  const exportTargetIds = useMemo(
    () => (selectedCount > 0 ? [...selectedEntryIds] : entries.map((entry) => entry.id)),
    [entries, selectedCount, selectedEntryIds],
  );
  const allVisibleSelected = entries.length > 0 && entries.every((entry) => selectedEntryIds.has(entry.id));
  const partiallySelected = selectedCount > 0 && !allVisibleSelected;
  const saveDraft = useCallback(async () => {
    if (!selectedEntry || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await invoke<BibliographyEntrySummary>(
        "update_bibliography_entry_cmd",
        {
          request:
            editorMode === "raw"
              ? {
                  entryId: selectedEntry.id,
                  rawEntry: draft.rawEntry,
                }
              : {
                  entryId: selectedEntry.id,
                  entryType: draft.entryType,
                  citationKey: draft.citationKey,
                  fields: removeEmptyFields(draft.fields),
                },
        },
      );
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setSelectedEntryId(updated.id);
      setDraft({
        entryType: updated.entry_type,
        citationKey: updated.citation_key,
        fields: fieldsToStringRecord(updated.fields),
        rawEntry: updated.raw_entry || buildRawPreview(updated),
      });
    } catch (caught) {
      console.error("Failed to save bibliography entry:", caught);
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  }, [draft, editorMode, selectedEntry]);
  const saveEntryNote = useCallback(async () => {
    if (!selectedEntry || !noteDraft.trim()) return;
    setNoteSaving(true);
    setError(null);
    try {
      const saved = await invoke<BibliographyEntryNoteSummary>(
        "save_bibliography_entry_note_cmd",
        {
          request: {
            id: editingNoteId,
            entryId: selectedEntry.id,
            body: noteDraft,
            noteKind,
            isPinned: notePinned,
          },
        },
      );
      setEntryNotes((current) => {
        const withoutSaved = current.filter((note) => note.id !== saved.id);
        return [saved, ...withoutSaved].sort(compareEntryNotes);
      });
      setEditingNoteId(null);
      setNoteDraft("");
      setNoteKind("note");
      setNotePinned(false);
    } catch (caught) {
      console.error("Failed to save bibliography entry note:", caught);
      setError(String(caught));
    } finally {
      setNoteSaving(false);
    }
  }, [editingNoteId, noteDraft, noteKind, notePinned, selectedEntry]);
  const deleteEntryNote = useCallback(
    async (noteId: string) => {
      setNoteSaving(true);
      setError(null);
      try {
        await invoke("delete_bibliography_entry_note_cmd", { noteId });
        setEntryNotes((current) =>
          current.filter((note) => note.id !== noteId),
        );
        if (editingNoteId === noteId) {
          setEditingNoteId(null);
          setNoteDraft("");
          setNoteKind("note");
          setNotePinned(false);
        }
      } catch (caught) {
        console.error("Failed to delete bibliography entry note:", caught);
        setError(String(caught));
      } finally {
        setNoteSaving(false);
      }
    },
    [editingNoteId],
  );
  const attachPdfToEntry = useCallback(async () => {
    if (!selectedEntry) return;
    setAttachmentBusy(true);
    setError(null);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await open({
        multiple: false,
        filters: [{ name: "PDF files", extensions: ["pdf"] }],
      });
      if (!selectedPath || Array.isArray(selectedPath)) return;
      const attached = await invoke<BibliographyEntryAttachmentSummary>(
        "attach_bibliography_entry_file_cmd",
        {
          request: {
            entryId: selectedEntry.id,
            path: selectedPath,
            attachmentKind: "pdf",
          },
        },
      );
      setEntryAttachments((current) => {
        const withoutAttached = current.filter(
          (attachment) => attachment.id !== attached.id,
        );
        return [attached, ...withoutAttached].sort(compareEntryAttachments);
      });
    } catch (caught) {
      console.error("Failed to attach bibliography PDF:", caught);
      setError(String(caught));
    } finally {
      setAttachmentBusy(false);
    }
  }, [selectedEntry]);
  const setPrimaryAttachment = useCallback(
    async (attachment: BibliographyEntryAttachmentSummary) => {
      if (!selectedEntry) return;
      setAttachmentBusy(true);
      setError(null);
      try {
        const updated = await invoke<BibliographyEntryAttachmentSummary>(
          "attach_bibliography_entry_file_cmd",
          {
            request: {
              entryId: selectedEntry.id,
              path: attachment.path,
              title: attachment.title,
              attachmentKind: attachment.attachment_kind,
              isPrimary: true,
            },
          },
        );
        setEntryAttachments((current) =>
          current
            .map((item) => ({
              ...item,
              is_primary: item.id === updated.id,
            }))
            .map((item) => (item.id === updated.id ? updated : item))
            .sort(compareEntryAttachments),
        );
      } catch (caught) {
        console.error("Failed to set primary bibliography PDF:", caught);
        setError(String(caught));
      } finally {
        setAttachmentBusy(false);
      }
    },
    [selectedEntry],
  );
  const savePdfAnnotation = useCallback(async () => {
    if (!selectedEntry || !annotationAttachmentId) return;
    const page = Number.parseInt(annotationPage, 10);
    if (!Number.isFinite(page) || page < 1) {
      setError("PDF annotation page must be 1 or greater");
      return;
    }
    setAnnotationBusy(true);
    setError(null);
    try {
      const saved = await invoke<BibliographyPdfAnnotationSummary>(
        "save_bibliography_pdf_annotation_cmd",
        {
          request: {
            id: editingAnnotationId,
            entryId: selectedEntry.id,
            attachmentId: annotationAttachmentId,
            page,
            annotationKind,
            selectedText: annotationSelectedText,
            comment: annotationComment,
            color: annotationColor,
            rects: [],
          },
        },
      );
      setPdfAnnotations((current) => {
        const withoutSaved = current.filter(
          (annotation) => annotation.id !== saved.id,
        );
        return [saved, ...withoutSaved].sort(comparePdfAnnotations);
      });
      setEditingAnnotationId(null);
      setAnnotationPage("1");
      setAnnotationKind("highlight");
      setAnnotationSelectedText("");
      setAnnotationComment("");
      setAnnotationColor("#ffd43b");
    } catch (caught) {
      console.error("Failed to save bibliography PDF annotation:", caught);
      setError(String(caught));
    } finally {
      setAnnotationBusy(false);
    }
  }, [
    annotationAttachmentId,
    annotationColor,
    annotationComment,
    annotationKind,
    annotationPage,
    annotationSelectedText,
    editingAnnotationId,
    selectedEntry,
  ]);
  const deletePdfAnnotation = useCallback(async (annotationId: string) => {
    setAnnotationBusy(true);
    setError(null);
    try {
      await invoke("delete_bibliography_pdf_annotation_cmd", {
        annotationId,
      });
      setPdfAnnotations((current) =>
        current.filter((annotation) => annotation.id !== annotationId),
      );
      if (editingAnnotationId === annotationId) {
        setEditingAnnotationId(null);
        setAnnotationPage("1");
        setAnnotationKind("highlight");
        setAnnotationSelectedText("");
        setAnnotationComment("");
        setAnnotationColor("#ffd43b");
      }
    } catch (caught) {
      console.error("Failed to delete bibliography PDF annotation:", caught);
      setError(String(caught));
    } finally {
      setAnnotationBusy(false);
    }
  }, [editingAnnotationId]);
  const openAttachment = useCallback(async (path: string) => {
    try {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(path);
    } catch (caught) {
      console.error("Failed to open bibliography attachment:", caught);
      setError(String(caught));
    }
  }, []);
  const revealAttachment = useCallback(async (path: string) => {
    try {
      await invoke("reveal_path_cmd", { path });
    } catch (caught) {
      console.error("Failed to reveal bibliography attachment:", caught);
      setError(String(caught));
    }
  }, []);
  const deleteEntryAttachment = useCallback(
    async (attachmentId: string) => {
      setAttachmentBusy(true);
      setError(null);
      try {
        await invoke("delete_bibliography_entry_attachment_cmd", {
          attachmentId,
        });
        if (selectedEntry) {
          const attachments = await invoke<BibliographyEntryAttachmentSummary[]>(
            "list_bibliography_entry_attachments_cmd",
            { entryId: selectedEntry.id },
          );
          const annotations = await invoke<BibliographyPdfAnnotationSummary[]>(
            "list_bibliography_pdf_annotations_cmd",
            { entryId: selectedEntry.id },
          );
          setEntryAttachments(attachments.sort(compareEntryAttachments));
          setPdfAnnotations(annotations.sort(comparePdfAnnotations));
        } else {
          setEntryAttachments((current) =>
            current.filter((attachment) => attachment.id !== attachmentId),
          );
        }
      } catch (caught) {
        console.error("Failed to delete bibliography attachment:", caught);
        setError(String(caught));
      } finally {
        setAttachmentBusy(false);
      }
    },
    [selectedEntry],
  );
  const saveFederationStrategy = useCallback(async () => {
    if (!selectedFederationCollection) return;
    setFederationBusy(true);
    setError(null);
    try {
      const saved = await invoke<BibliographyCollectionFederationSummary>(
        "save_bibliography_collection_federation_cmd",
        {
          request: {
            collection: selectedFederationCollection,
            remoteKind: federationRemoteKind,
            remoteUrl: federationRemoteUrl,
            syncMode: federationSyncMode,
            conflictPolicy: federationConflictPolicy,
            isEnabled: federationEnabled,
          },
        },
      );
      setFederationSettings((current) =>
        current.map((setting) =>
          setting.collection === saved.collection ? saved : setting,
        ),
      );
    } catch (caught) {
      console.error("Failed to save bibliography federation strategy:", caught);
      setError(String(caught));
    } finally {
      setFederationBusy(false);
    }
  }, [
    federationConflictPolicy,
    federationEnabled,
    federationRemoteKind,
    federationRemoteUrl,
    federationSyncMode,
    selectedFederationCollection,
  ]);
  const deleteFederationStrategy = useCallback(async () => {
    if (!selectedFederationCollection) return;
    setFederationBusy(true);
    setError(null);
    try {
      await invoke("delete_bibliography_collection_federation_cmd", {
        collection: selectedFederationCollection,
      });
      const settings = await invoke<BibliographyCollectionFederationSummary[]>(
        "list_bibliography_collection_federation_cmd",
      );
      setFederationSettings(settings);
    } catch (caught) {
      console.error("Failed to delete bibliography federation strategy:", caught);
      setError(String(caught));
    } finally {
      setFederationBusy(false);
    }
  }, [selectedFederationCollection]);
  const exportEntries = useCallback(async () => {
    if (exportTargetIds.length === 0) return;
    setBatchBusy(true);
    setError(null);
    try {
      const content = await invoke<string>("export_bibliography_entries_as_cmd", {
        entryIds: exportTargetIds,
        format: exportFormat,
      });
      const { save } = await import("@tauri-apps/plugin-dialog");
      const extension = exportFormat === "csl-json" ? "json" : "bib";
      const filePath = await save({
        defaultPath:
          selectedCount > 0
            ? `selected-bibliography.${extension}`
            : `filtered-bibliography.${extension}`,
        filters:
          exportFormat === "csl-json"
            ? [{ name: "CSL JSON / Zotero", extensions: ["json"] }]
            : [{ name: "BibTeX", extensions: ["bib"] }],
      });
      if (!filePath) return;
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(filePath, content);
    } catch (caught) {
      console.error("Failed to export bibliography entries:", caught);
      setError(String(caught));
    } finally {
      setBatchBusy(false);
    }
  }, [exportFormat, exportTargetIds, selectedCount]);
  const importExternalBibliography = useCallback(async () => {
    setImportBusy(true);
    setError(null);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selectedPath = await open({
        multiple: false,
        filters: [
          {
            name: "Bibliography imports",
            extensions: ["ris", "json", "csl", "enw", "nbib", "txt"],
          },
          { name: "RIS", extensions: ["ris"] },
          { name: "CSL JSON", extensions: ["json", "csl"] },
          { name: "EndNote", extensions: ["enw", "txt"] },
          { name: "PubMed/NBIB", extensions: ["nbib", "txt"] },
        ],
      });
      if (!selectedPath || Array.isArray(selectedPath)) return;

      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const content = await readTextFile(selectedPath);
      const result = await invoke<BibliographyContentImportResult>(
        "import_bibliography_content_cmd",
        {
          request: {
            content,
            format: importFormatFromPath(selectedPath),
            sourceLabel:
              selectedPath.split(/[/\\]/).pop() || "Imported bibliography",
          },
        },
      );
      if (result.entries_imported === 0 && result.diagnostics.length > 0) {
        setError(result.diagnostics.map((item) => item.message).join("\n"));
      }
      await loadWorkspace();
      setSelectedSourceId(result.source.id);
    } catch (caught) {
      console.error("Failed to import bibliography:", caught);
      setError(String(caught));
    } finally {
      setImportBusy(false);
    }
  }, [loadWorkspace]);
  const lookupDoi = useCallback(async () => {
    const doi = doiQuery.trim();
    if (!doi) return;
    setDoiBusy(true);
    setError(null);
    try {
      const result = await invoke<BibliographyDoiLookupResult>(
        "lookup_bibliography_doi_cmd",
        {
          request: {
            doi,
            provider: doiProvider,
          },
        },
      );
      setDoiLookup(result);
    } catch (caught) {
      console.error("Failed to lookup DOI:", caught);
      setDoiLookup(null);
      setError(String(caught));
    } finally {
      setDoiBusy(false);
    }
  }, [doiProvider, doiQuery]);
  const importDoi = useCallback(async () => {
    const doi = doiQuery.trim();
    if (!doi) return;
    setDoiBusy(true);
    setError(null);
    try {
      const result = await invoke<BibliographyContentImportResult>(
        "import_bibliography_doi_cmd",
        {
          request: {
            doi,
            provider: doiProvider,
          },
        },
      );
      await loadWorkspace();
      setSelectedSourceId(result.source.id);
      setDoiLookup(null);
      setDoiQuery("");
    } catch (caught) {
      console.error("Failed to import DOI:", caught);
      setError(String(caught));
    } finally {
      setDoiBusy(false);
    }
  }, [doiProvider, doiQuery, loadWorkspace]);
  const applyBatchField = useCallback(
    async (mode: "set" | "clear") => {
      const fieldName = sanitizeFieldName(batchFieldName);
      if (!fieldName || selectedEntryIds.size === 0) return;
      setBatchBusy(true);
      setError(null);
      try {
        const updated = await invoke<BibliographyEntrySummary[]>(
          "batch_update_bibliography_entries_cmd",
          {
            request: {
              entryIds: [...selectedEntryIds],
              setFields:
                mode === "set" ? { [fieldName]: batchFieldValue } : {},
              removeFields: mode === "clear" ? [fieldName] : [],
            },
          },
        );
        const byId = new Map(updated.map((entry) => [entry.id, entry]));
      setEntries((current) =>
        current.map((entry) => byId.get(entry.id) || entry),
      );
      void loadWorkspace();
      if (mode === "set") setBatchFieldValue("");
      } catch (caught) {
        console.error("Failed to batch edit bibliography entries:", caught);
        setError(String(caught));
      } finally {
        setBatchBusy(false);
      }
    },
    [batchFieldName, batchFieldValue, loadWorkspace, selectedEntryIds],
  );
  const saveEntryTags = useCallback(async () => {
    if (!selectedEntry) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await invoke<BibliographyEntrySummary>(
        "set_bibliography_entry_tags_cmd",
        {
          entryId: selectedEntry.id,
          tags: tagDraft,
        },
      );
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
      setTagDraft(updated.tags || []);
      void loadWorkspace();
    } catch (caught) {
      console.error("Failed to save bibliography tags:", caught);
      setError(String(caught));
    } finally {
      setSaving(false);
    }
  }, [loadWorkspace, selectedEntry, tagDraft]);
  const applyBatchTag = useCallback(
    async (mode: "add" | "remove") => {
      const tagName = normalizeTagName(batchTagName);
      if (!tagName || selectedEntryIds.size === 0) return;
      setBatchBusy(true);
      setError(null);
      try {
        await invoke<BibliographyEntrySummary[]>(
          "batch_update_bibliography_entries_cmd",
          {
            request: {
              entryIds: [...selectedEntryIds],
              addTags: mode === "add" ? [tagName] : [],
              removeTags: mode === "remove" ? [tagName] : [],
            },
          },
        );
        setBatchTagName("");
        await loadWorkspace();
      } catch (caught) {
        console.error("Failed to batch update bibliography tags:", caught);
        setError(String(caught));
      } finally {
        setBatchBusy(false);
      }
    },
    [batchTagName, loadWorkspace, selectedEntryIds],
  );

  return (
    <Box
      h="100%"
      p="md"
      style={{
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        background: "var(--app-main-bg)",
      }}
    >
      <Stack h="100%" gap="md" style={{ minHeight: 0, overflow: "hidden" }}>
        <Group justify="space-between" align="flex-start" flex="0 0 auto">
          <Box>
            <Group gap="xs">
              <FontAwesomeIcon icon={faBookOpen} />
              <Title order={3}>
                {t("bibliography.workspace.title", {
                  defaultValue: "Bibliography Workspace",
                })}
              </Title>
            </Group>
            <Text size="sm" c="dimmed">
              {t("bibliography.workspace.subtitle", {
                defaultValue:
                  "Manage parsed bibliography entries across all loaded collections.",
              })}
            </Text>
          </Box>
          <Group gap="xs">
            <Badge variant="light" color="blue">
              {sources.length}{" "}
              {t("bibliography.workspace.sources", {
                defaultValue: "sources",
              })}
            </Badge>
            <Badge variant="light" color="teal">
              {totalEntries}{" "}
              {t("bibliography.workspace.entries", {
                defaultValue: "entries",
              })}
            </Badge>
            <Button
              size="xs"
              variant="light"
              color="gray"
              leftSection={<FontAwesomeIcon icon={faArrowLeft} />}
              onClick={onClose}
            >
              {t("bibliography.workspace.backToDatabase", {
                defaultValue: "Database",
              })}
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<FontAwesomeIcon icon={faArrowsRotate} />}
              loading={loading}
              onClick={() => void refreshWorkspace()}
            >
              {t("common.refresh", { defaultValue: "Refresh" })}
            </Button>
            <Button
              size="xs"
              variant="light"
              color="blue"
              leftSection={<FontAwesomeIcon icon={faFileImport} />}
              loading={importBusy}
              onClick={() => void importExternalBibliography()}
            >
              {t("bibliography.workspace.import", {
                defaultValue: "Import",
              })}
            </Button>
            <Select
              size="xs"
              w={150}
              data={EXPORT_FORMATS}
              value={exportFormat}
              onChange={(value) => setExportFormat(value || "bibtex")}
            />
            <Button
              size="xs"
              variant="light"
              color="teal"
              leftSection={<FontAwesomeIcon icon={faDownload} />}
              loading={batchBusy}
              disabled={exportTargetIds.length === 0}
              onClick={() => void exportEntries()}
            >
              {selectedCount > 0
                ? `Export selected (${selectedCount})`
                : "Export filtered"}
            </Button>
          </Group>
        </Group>

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <Group
          align="stretch"
          gap="md"
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <Paper
            withBorder
            p="sm"
            style={{ width: 280, minWidth: 240, overflow: "hidden" }}
          >
            <Stack h="100%" gap="sm">
              <TextInput
                size="xs"
                leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} />}
                placeholder={t("bibliography.workspace.searchPlaceholder", {
                  defaultValue: "Search key, author, title, year, DOI…",
                })}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              <Select
                size="xs"
                leftSection={<FontAwesomeIcon icon={faFilter} />}
                data={sourceOptions}
                value={selectedSourceId ?? "__all__"}
                onChange={(value) =>
                  setSelectedSourceId(value === "__all__" ? null : value)
                }
                searchable
              />
              <Select
                size="xs"
                leftSection={<FontAwesomeIcon icon={faTags} />}
                data={ENTRY_TYPES.map((type) => ({
                  value: type,
                  label: type === ALL_TYPES ? "All entry types" : `@${type}`,
                }))}
                value={entryType}
                onChange={(value) => setEntryType(value || ALL_TYPES)}
                searchable
              />
              <Select
                size="xs"
                data={SMART_VIEWS}
                value={smartView}
                onChange={(value) => setSmartView(value || "all")}
              />
              <Select
                size="xs"
                leftSection={<FontAwesomeIcon icon={faTags} />}
                data={[
                  { value: "__all__", label: "All tags" },
                  ...tagOptions,
                ]}
                value={selectedTag ?? "__all__"}
                onChange={(value) =>
                  setSelectedTag(value === "__all__" ? null : value)
                }
                searchable
              />
              {filtersActive && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="gray"
                  leftSection={<FontAwesomeIcon icon={faBroom} />}
                  onClick={clearFilters}
                >
                  {t("bibliography.workspace.clearFilters", {
                    defaultValue: "Clear filters",
                  })}
                </Button>
              )}
              <Divider />
              <Stack gap={6}>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  {t("bibliography.workspace.doiLookup", {
                    defaultValue: "DOI lookup",
                  })}
                </Text>
                <Group gap={6} align="end">
                  <TextInput
                    size="xs"
                    style={{ flex: 1 }}
                    placeholder="10.xxxx/..."
                    value={doiQuery}
                    onChange={(event) => {
                      setDoiQuery(event.currentTarget.value);
                      setDoiLookup(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void lookupDoi();
                    }}
                  />
                  <Select
                    size="xs"
                    w={92}
                    data={DOI_PROVIDERS}
                    value={doiProvider}
                    onChange={(value) => setDoiProvider(value || "auto")}
                  />
                </Group>
                <Group gap={6}>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} />}
                    loading={doiBusy}
                    disabled={!doiQuery.trim()}
                    onClick={() => void lookupDoi()}
                  >
                    {t("bibliography.workspace.lookup", {
                      defaultValue: "Lookup",
                    })}
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    leftSection={<FontAwesomeIcon icon={faFileImport} />}
                    loading={doiBusy}
                    disabled={!doiQuery.trim()}
                    onClick={() => void importDoi()}
                  >
                    {t("bibliography.workspace.importDoi", {
                      defaultValue: "Import DOI",
                    })}
                  </Button>
                </Group>
                {doiLookup && (
                  <Card withBorder p="xs">
                    <Stack gap={4}>
                      <Group justify="space-between" gap={4}>
                        <Badge size="xs" variant="light" color="blue">
                          {doiLookup.provider}
                        </Badge>
                        <Badge size="xs" variant="outline" color="gray">
                          @{doiLookup.entry_type}
                        </Badge>
                      </Group>
                      <Text size="xs" fw={600} lineClamp={2}>
                        {doiLookup.fields.title || doiLookup.doi}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {[
                          doiLookup.fields.author,
                          doiLookup.fields.year,
                          doiLookup.fields.journal,
                          doiLookup.fields.publisher,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </Stack>
                  </Card>
                )}
              </Stack>
              <Divider />
              <Stack gap={4}>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  {t("bibliography.workspace.smartViews", {
                    defaultValue: "Smart views",
                  })}
                </Text>
                <Group gap={6}>
                  {SMART_VIEWS.filter((view) => view.value !== "all").map(
                    (view) => (
                      <Badge
                        key={view.value}
                        component="button"
                        variant={smartView === view.value ? "filled" : "light"}
                        color={
                          view.value === "duplicate_candidates"
                            ? "orange"
                            : view.value === "missing_metadata"
                              ? "yellow"
                              : "blue"
                        }
                        style={{ cursor: "pointer", border: 0 }}
                        onClick={() =>
                          setSmartView(
                            smartView === view.value ? "all" : view.value,
                          )
                        }
                      >
                        {view.label}
                      </Badge>
                    ),
                  )}
	                </Group>
	              </Stack>
	              <Divider />
	              <Stack gap="xs">
	                <Group justify="space-between" gap="xs">
	                  <Box>
	                    <Text size="xs" fw={700} tt="uppercase" c="dimmed">
	                      Team / federation
	                    </Text>
	                    <Text size="xs" c="dimmed">
	                      Collection-level sharing strategy
	                    </Text>
	                  </Box>
	                  {selectedFederationSetting?.is_enabled && (
	                    <Badge
	                      size="xs"
	                      variant="light"
	                      color={federationStatusColor(
	                        selectedFederationSetting.sync_status,
	                      )}
	                    >
	                      {selectedFederationSetting.sync_status}
	                    </Badge>
	                  )}
	                </Group>
	                {federationSettings.length === 0 ? (
	                  <Text size="xs" c="dimmed">
	                    No bibliography collections yet.
	                  </Text>
	                ) : (
	                  <>
	                    <Select
	                      size="xs"
	                      label="Collection"
	                      value={selectedFederationCollection}
	                      data={federationSettings.map((setting) => ({
	                        value: setting.collection,
	                        label: `${setting.collection} · ${setting.entry_count} entries`,
	                      }))}
	                      allowDeselect={false}
	                      onChange={setSelectedFederationCollection}
	                    />
	                    <Group grow gap="xs">
	                      <Select
	                        size="xs"
	                        label="Remote"
	                        value={federationRemoteKind}
	                        data={FEDERATION_REMOTE_KIND_OPTIONS}
	                        allowDeselect={false}
	                        onChange={(value) =>
	                          setFederationRemoteKind(value || "shared_folder")
	                        }
	                      />
	                      <Select
	                        size="xs"
	                        label="Mode"
	                        value={federationSyncMode}
	                        data={FEDERATION_SYNC_MODE_OPTIONS}
	                        allowDeselect={false}
	                        onChange={(value) =>
	                          setFederationSyncMode(value || "manual")
	                        }
	                      />
	                    </Group>
	                    <TextInput
	                      size="xs"
	                      label="Remote URL / path"
	                      placeholder="file:///shared/refs, git URL, Zotero library id..."
	                      value={federationRemoteUrl}
	                      onChange={(event) =>
	                        setFederationRemoteUrl(event.currentTarget.value)
	                      }
	                    />
	                    <Group grow gap="xs" align="end">
	                      <Select
	                        size="xs"
	                        label="Conflicts"
	                        value={federationConflictPolicy}
	                        data={FEDERATION_CONFLICT_POLICY_OPTIONS}
	                        allowDeselect={false}
	                        onChange={(value) =>
	                          setFederationConflictPolicy(value || "manual")
	                        }
	                      />
	                      <Checkbox
	                        size="xs"
	                        label="Enabled"
	                        checked={federationEnabled}
	                        onChange={(event) =>
	                          setFederationEnabled(event.currentTarget.checked)
	                        }
	                      />
	                    </Group>
	                    <Group gap="xs" justify="space-between">
	                      <Group gap={4}>
	                        <Badge size="xs" variant="light" color="gray">
	                          {selectedFederationSetting?.source_count || 0} sources
	                        </Badge>
	                        <Badge size="xs" variant="light" color="gray">
	                          {selectedFederationSetting?.entry_count || 0} entries
	                        </Badge>
	                      </Group>
	                      <Group gap={4}>
	                        <Button
	                          size="xs"
	                          variant="subtle"
	                          color="red"
	                          loading={federationBusy}
	                          disabled={!selectedFederationSetting?.id}
	                          onClick={() => void deleteFederationStrategy()}
	                        >
	                          Reset
	                        </Button>
	                        <Button
	                          size="xs"
	                          variant="light"
	                          loading={federationBusy}
	                          disabled={!selectedFederationCollection}
	                          onClick={() => void saveFederationStrategy()}
	                        >
	                          Save
	                        </Button>
	                      </Group>
	                    </Group>
	                  </>
	                )}
	              </Stack>
	              <Divider />
	              <Group justify="space-between">
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  {t("bibliography.workspace.sourceFiles", {
                    defaultValue: "Source files",
                  })}
                </Text>
                {loading && <Loader size="xs" />}
              </Group>
              <ScrollArea style={{ flex: 1 }}>
                <Stack gap={6}>
                  {sources.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      {t("bibliography.workspace.noSources", {
                        defaultValue:
                          "No parsed .bib sources yet. Reparse a bibliography resource first.",
                      })}
                    </Text>
                  ) : (
                    sources.map((source) => (
                      <Card
                        key={source.id}
                        withBorder
                        p="xs"
                        style={{
                          cursor: "pointer",
                          background:
                            selectedSourceId === source.id
                              ? "var(--mantine-color-blue-light)"
                              : undefined,
                        }}
                        onClick={() => toggleSelectedSourceId(source.id)}
                      >
                        <Group justify="space-between" gap="xs" wrap="nowrap">
                          <Box style={{ minWidth: 0 }}>
                            <Text size="sm" fw={600} truncate>
                              {sourceLabel(source)}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              {source.collection || shortPath(source.path)}
                            </Text>
                          </Box>
                          <Badge size="xs" color={sourceStatusColor(source)}>
                            {source.entry_count}
                          </Badge>
                        </Group>
                      </Card>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>

          <Paper
            withBorder
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Group justify="space-between" p="sm">
              <Box>
                <Text fw={700}>
                  {t("bibliography.workspace.results", {
                    defaultValue: "Entries",
                  })}
                </Text>
                <Text size="xs" c="dimmed">
                  {entries.length} / {ENTRY_LIMIT}{" "}
                  {t("bibliography.workspace.loaded", {
                    defaultValue: "loaded",
                  })}
                  {filtersActive ? " · filtered" : ""}
                </Text>
              </Box>
              {loading && <Loader size="sm" />}
            </Group>
            {selectedCount > 0 && (
              <>
                <Divider />
                <Group gap="xs" p="sm" wrap="nowrap">
                  <Badge variant="light" color="blue">
                    {selectedCount} selected
                  </Badge>
                  <TextInput
                    size="xs"
                    placeholder="field"
                    value={batchFieldName}
                    onChange={(event) =>
                      setBatchFieldName(event.currentTarget.value)
                    }
                    style={{ width: 120 }}
                  />
                  <TextInput
                    size="xs"
                    placeholder="value"
                    value={batchFieldValue}
                    onChange={(event) =>
                      setBatchFieldValue(event.currentTarget.value)
                    }
                    style={{ flex: 1 }}
                  />
                  <Button
                    size="xs"
                    loading={batchBusy}
                    disabled={!sanitizeFieldName(batchFieldName)}
                    onClick={() => void applyBatchField("set")}
                  >
                    Set
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    loading={batchBusy}
                    disabled={!sanitizeFieldName(batchFieldName)}
                    onClick={() => void applyBatchField("clear")}
                  >
                    Clear
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => setSelectedEntryIds(new Set())}
                  >
                    Deselect
                  </Button>
                </Group>
                <Group gap="xs" px="sm" pb="sm" wrap="nowrap">
                  <TextInput
                    size="xs"
                    placeholder="tag"
                    value={batchTagName}
                    onChange={(event) =>
                      setBatchTagName(event.currentTarget.value)
                    }
                    style={{ flex: 1 }}
                  />
                  <Button
                    size="xs"
                    variant="light"
                    color="teal"
                    loading={batchBusy}
                    disabled={!normalizeTagName(batchTagName)}
                    onClick={() => void applyBatchTag("add")}
                  >
                    Add tag
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    loading={batchBusy}
                    disabled={!normalizeTagName(batchTagName)}
                    onClick={() => void applyBatchTag("remove")}
                  >
                    Remove tag
                  </Button>
                </Group>
              </>
            )}
            <Divider />
            <ScrollArea style={{ flex: 1 }}>
              <Table striped highlightOnHover stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={42}>
                      <Checkbox
                        size="xs"
                        checked={allVisibleSelected}
                        indeterminate={partiallySelected}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setSelectedEntryIds((current) => {
                            const next = new Set(current);
                            for (const entry of entries) {
                              if (checked) next.add(entry.id);
                              else next.delete(entry.id);
                            }
                            return next;
                          });
                        }}
                      />
                    </Table.Th>
                    <Table.Th>Citation key</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>Year</Table.Th>
                    <Table.Th>Tags</Table.Th>
                    <Table.Th>Source</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {entries.map((entry) => {
                    const source = sourceById.get(entry.source_id);
                    return (
                      <Table.Tr
                        key={entry.id}
                        onClick={() => setSelectedEntryId(entry.id)}
                        style={{
                          cursor: "pointer",
                          background:
                            selectedEntryId === entry.id
                              ? "var(--mantine-color-blue-light)"
                              : undefined,
                        }}
                      >
                        <Table.Td onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            size="xs"
                            checked={selectedEntryIds.has(entry.id)}
                            onChange={(event) => {
                              const checked = event.currentTarget.checked;
                              setSelectedEntryIds((current) => {
                                const next = new Set(current);
                                if (checked) next.add(entry.id);
                                else next.delete(entry.id);
                                return next;
                              });
                            }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {entry.citation_key}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="xs" variant="light">
                            @{entry.entry_type}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" lineClamp={1}>
                            {entry.title || fieldString(entry, "title") || "—"}
                          </Text>
                        </Table.Td>
                        <Table.Td>{entry.year || entry.date || "—"}</Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            {(entry.tags || []).slice(0, 3).map((tag) => (
                              <Badge key={tag} size="xs" variant="light" color="teal">
                                {tag}
                              </Badge>
                            ))}
                            {(entry.tags || []).length > 3 && (
                              <Badge size="xs" variant="light" color="gray">
                                +{entry.tags.length - 3}
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed" truncate maw={180}>
                            {source ? sourceLabel(source) : "—"}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
              {!loading && entries.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  {t("bibliography.workspace.noEntries", {
                    defaultValue: "No bibliography entries match the filters.",
                  })}
                </Text>
              )}
            </ScrollArea>
          </Paper>

          <Paper
            withBorder
            p="sm"
            style={{
              width: 380,
              minWidth: 320,
              maxHeight: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ScrollArea
              type="always"
              offsetScrollbars
              scrollbarSize={8}
              style={{ flex: 1, height: "100%", minHeight: 0 }}
            >
              {selectedEntry && draft ? (
                <Stack gap="sm">
                  <Group gap="xs">
                    <FontAwesomeIcon icon={faDatabase} />
                    <Text fw={700}>{selectedEntry.citation_key}</Text>
                    <Badge size="xs" variant="light">
                      @{selectedEntry.entry_type}
                    </Badge>
                  </Group>
                  <Detail
                    label="Source"
                    value={
                      selectedSource
                        ? `${sourceLabel(selectedSource)} · ${shortPath(
                            selectedSource.path,
                          )}`
                        : undefined
                    }
                  />
                  <Card withBorder p="xs" radius="md">
                    <Group justify="space-between" align="end" gap="xs">
                      <Box>
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                          Citation preview
                        </Text>
                        <Text size="xs" c="dimmed">
                          CSL-style rendering from the structured fields
                        </Text>
                      </Box>
                      <Select
                        size="xs"
                        value={citationPreviewStyle}
                        data={CITATION_PREVIEW_STYLES}
                        allowDeselect={false}
                        onChange={(value) => {
                          if (isCitationPreviewStyle(value)) {
                            setCitationPreviewStyle(value);
                          }
                        }}
                        style={{ width: 128 }}
                      />
                    </Group>
                    <Paper
                      withBorder
                      p="xs"
                      radius="sm"
                      mt="xs"
                      style={{
                        background: "var(--mantine-color-default-hover)",
                      }}
                    >
                      <Text
                        size="sm"
                        style={{
                          overflowWrap: "anywhere",
                          lineHeight: 1.45,
                        }}
                      >
                        {citationPreview?.bibliography ||
                          "Not enough metadata for a useful preview yet."}
                      </Text>
                    </Paper>
		                    {citationPreview?.inText && (
		                      <Text size="xs" c="dimmed" mt={6}>
		                        In-text: {citationPreview.inText}
		                      </Text>
		                    )}
		                  </Card>
		                  <Card withBorder p="xs" radius="md">
		                    <Group justify="space-between" gap="xs">
		                      <Box>
		                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
		                          Used by / citation graph
		                        </Text>
		                        <Text size="xs" c="dimmed">
		                          Documents that cite this entry and entries cited with it
		                        </Text>
		                      </Box>
		                      {citationGraphLoading ? (
		                        <Loader size="xs" />
		                      ) : (
		                        <Group gap={4}>
		                          <Badge size="xs" variant="light" color="blue">
		                            {citationGraph?.resource_count || 0} files
		                          </Badge>
		                          <Badge size="xs" variant="light" color="grape">
		                            {citationGraph?.related_entries.length || 0} links
		                          </Badge>
		                        </Group>
		                      )}
		                    </Group>
		                    <Stack gap="xs" mt="xs">
		                      {!citationGraphLoading &&
		                      (!citationGraph || citationGraph.used_by.length === 0) ? (
		                        <Text size="xs" c="dimmed">
		                          No scanned resources cite this entry yet. Open or scan a LaTeX
		                          resource to populate usage.
		                        </Text>
		                      ) : (
		                        <>
		                          <Text size="xs" fw={700} c="dimmed">
		                            Used by
		                          </Text>
		                          {citationGraph?.used_by.slice(0, 6).map((usage) => (
		                            <Paper
		                              key={usage.resource_id}
		                              withBorder
		                              p="xs"
		                              radius="sm"
		                            >
		                              <Group justify="space-between" gap="xs" wrap="nowrap">
		                                <Box style={{ minWidth: 0 }}>
		                                  <Text size="sm" fw={600} truncate>
		                                    {usage.resource_title ||
		                                      fileNameFromPath(usage.resource_path)}
		                                  </Text>
		                                  <Text size="xs" c="dimmed" truncate>
		                                    {usage.collection} · {usage.resource_type} ·{" "}
		                                    {shortPath(usage.resource_path)}
		                                  </Text>
		                                  <Group gap={4} mt={4}>
		                                    <Badge size="xs" variant="light" color="blue">
		                                      {usage.occurrence_count} cite
		                                      {usage.occurrence_count === 1 ? "" : "s"}
		                                    </Badge>
		                                    {usage.commands.slice(0, 3).map((command) => (
		                                      <Badge
		                                        key={command}
		                                        size="xs"
		                                        variant="light"
		                                        color="gray"
		                                      >
		                                        {`\\${command}`}
		                                      </Badge>
		                                    ))}
		                                  </Group>
		                                </Box>
		                                <Button
		                                  size="compact-xs"
		                                  variant="subtle"
		                                  onClick={() =>
		                                    void revealAttachment(usage.resource_path)
		                                  }
		                                >
		                                  Reveal
		                                </Button>
		                              </Group>
		                            </Paper>
		                          ))}
		                          {citationGraph &&
		                            citationGraph.related_entries.length > 0 && (
		                              <>
		                                <Divider />
		                                <Text size="xs" fw={700} c="dimmed">
		                                  Co-cited entries
		                                </Text>
		                                {citationGraph.related_entries
		                                  .slice(0, 8)
		                                  .map((related) => (
		                                    <Paper
		                                      key={related.entry_id}
		                                      withBorder
		                                      p="xs"
		                                      radius="sm"
		                                    >
		                                      <Group
		                                        justify="space-between"
		                                        gap="xs"
		                                        wrap="nowrap"
		                                      >
		                                        <Box style={{ minWidth: 0 }}>
		                                          <Group gap={4}>
		                                            <Badge
		                                              size="xs"
		                                              variant="light"
		                                              color="gray"
		                                            >
		                                              @{related.entry_type}
		                                            </Badge>
		                                            {related.year && (
		                                              <Badge
		                                                size="xs"
		                                                variant="light"
		                                                color="blue"
		                                              >
		                                                {related.year}
		                                              </Badge>
		                                            )}
		                                          </Group>
		                                          <Text size="sm" fw={600} truncate mt={4}>
		                                            {related.citation_key}
		                                          </Text>
		                                          <Text size="xs" c="dimmed" lineClamp={1}>
		                                            {related.title || "Untitled entry"}
		                                          </Text>
		                                        </Box>
		                                        <Badge size="xs" variant="light" color="grape">
		                                          {related.resource_count} file
		                                          {related.resource_count === 1 ? "" : "s"}
		                                        </Badge>
		                                      </Group>
		                                    </Paper>
		                                  ))}
		                              </>
		                            )}
		                        </>
		                      )}
		                    </Stack>
		                  </Card>
		                  <Card withBorder p="xs" radius="md">
	                    <Group justify="space-between" gap="xs">
	                      <Box>
	                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
	                          PDF attachments
	                        </Text>
	                        <Text size="xs" c="dimmed">
	                          Attach source PDFs to this bibliography entry
	                        </Text>
	                      </Box>
	                      <Button
	                        size="xs"
	                        variant="light"
	                        loading={attachmentBusy}
	                        onClick={() => void attachPdfToEntry()}
	                      >
	                        Attach PDF
	                      </Button>
	                    </Group>
	                    <Stack gap="xs" mt="xs">
	                      {attachmentsLoading ? (
	                        <Group gap="xs">
	                          <Loader size="xs" />
	                          <Text size="xs" c="dimmed">
	                            Loading attachments...
	                          </Text>
	                        </Group>
	                      ) : entryAttachments.length === 0 ? (
	                        <Text size="xs" c="dimmed">
	                          No PDFs attached yet.
	                        </Text>
	                      ) : (
	                        entryAttachments.map((attachment) => (
	                          <Paper
	                            key={attachment.id}
	                            withBorder
	                            p="xs"
	                            radius="sm"
	                          >
	                            <Group justify="space-between" gap="xs" wrap="nowrap">
	                              <Box style={{ minWidth: 0 }}>
	                                <Group gap={4}>
	                                  <Badge size="xs" variant="light" color="red">
	                                    PDF
	                                  </Badge>
	                                  {attachment.is_primary && (
	                                    <Badge size="xs" variant="light" color="blue">
	                                      primary
	                                    </Badge>
	                                  )}
	                                  {attachment.resource_id && (
	                                    <Badge size="xs" variant="light" color="teal">
	                                      resource
	                                    </Badge>
	                                  )}
	                                </Group>
	                                <Text size="sm" fw={600} truncate mt={4}>
	                                  {attachment.title ||
	                                    fileNameFromPath(attachment.path)}
	                                </Text>
	                                <Text size="xs" c="dimmed" truncate>
	                                  {shortPath(attachment.path)}
	                                  {attachment.file_size
	                                    ? ` · ${formatFileSize(attachment.file_size)}`
	                                    : ""}
	                                </Text>
	                              </Box>
	                            </Group>
	                            <Group justify="flex-end" gap={4} mt={6}>
	                              <Button
	                                size="compact-xs"
	                                variant="subtle"
	                                onClick={() =>
	                                  void openAttachment(attachment.path)
	                                }
	                              >
	                                Open
	                              </Button>
	                              <Button
	                                size="compact-xs"
	                                variant="subtle"
	                                onClick={() =>
	                                  void revealAttachment(attachment.path)
	                                }
	                              >
	                                Reveal
	                              </Button>
	                              {!attachment.is_primary && (
	                                <Button
	                                  size="compact-xs"
	                                  variant="subtle"
	                                  onClick={() =>
	                                    void setPrimaryAttachment(attachment)
	                                  }
	                                >
	                                  Primary
	                                </Button>
	                              )}
	                              <Button
	                                size="compact-xs"
	                                variant="subtle"
	                                color="red"
	                                loading={attachmentBusy}
	                                onClick={() =>
	                                  void deleteEntryAttachment(attachment.id)
	                                }
	                              >
	                                Delete
	                              </Button>
	                            </Group>
	                          </Paper>
	                        ))
	                      )}
	                    </Stack>
	                  </Card>
	                  <Card withBorder p="xs" radius="md">
	                    <Group justify="space-between" gap="xs">
	                      <Box>
	                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
	                          PDF annotation links
	                        </Text>
	                        <Text size="xs" c="dimmed">
	                          Link pages, highlights, quotes, and comments to this entry
	                        </Text>
	                      </Box>
	                      {annotationsLoading ? (
	                        <Loader size="xs" />
	                      ) : (
	                        <Badge size="xs" variant="light" color="gray">
	                          {pdfAnnotations.length}
	                        </Badge>
	                      )}
	                    </Group>
	                    <Stack gap="xs" mt="xs">
	                      {entryAttachments.length === 0 ? (
	                        <Text size="xs" c="dimmed">
	                          Attach a PDF first, then link annotations.
	                        </Text>
	                      ) : pdfAnnotations.length === 0 && !annotationsLoading ? (
	                        <Text size="xs" c="dimmed">
	                          No PDF annotation links yet.
	                        </Text>
	                      ) : (
	                        pdfAnnotations.map((annotation) => (
	                          <Paper
	                            key={annotation.id}
	                            withBorder
	                            p="xs"
	                            radius="sm"
	                          >
	                            <Group justify="space-between" gap="xs" mb={4}>
	                              <Group gap={4}>
	                                <Badge
	                                  size="xs"
	                                  variant="light"
	                                  color={pdfAnnotationKindColor(
	                                    annotation.annotation_kind,
	                                  )}
	                                >
	                                  {annotation.annotation_kind}
	                                </Badge>
	                                <Badge size="xs" variant="light" color="gray">
	                                  p. {annotation.page}
	                                </Badge>
	                              </Group>
	                              {annotation.color && (
	                                <Box
	                                  title={annotation.color}
	                                  style={{
	                                    width: 14,
	                                    height: 14,
	                                    borderRadius: 4,
	                                    background: annotation.color,
	                                    border:
	                                      "1px solid var(--mantine-color-default-border)",
	                                  }}
	                                />
	                              )}
	                            </Group>
	                            <Text size="xs" c="dimmed" truncate mb={4}>
	                              {annotation.attachment_title ||
	                                fileNameFromPath(annotation.attachment_path)}
	                            </Text>
	                            {annotation.selected_text && (
	                              <Text
	                                size="sm"
	                                fs="italic"
	                                style={{
	                                  whiteSpace: "pre-wrap",
	                                  overflowWrap: "anywhere",
	                                }}
	                              >
	                                “{annotation.selected_text}”
	                              </Text>
	                            )}
	                            {annotation.comment && (
	                              <Text
	                                size="sm"
	                                mt={annotation.selected_text ? 4 : 0}
	                                style={{
	                                  whiteSpace: "pre-wrap",
	                                  overflowWrap: "anywhere",
	                                }}
	                              >
	                                {annotation.comment}
	                              </Text>
	                            )}
	                            <Group justify="flex-end" gap={4} mt={6}>
	                              <Button
	                                size="compact-xs"
	                                variant="subtle"
	                                onClick={() =>
	                                  void openAttachment(
	                                    annotation.attachment_path,
	                                  )
	                                }
	                              >
	                                Open PDF
	                              </Button>
	                              <Button
	                                size="compact-xs"
	                                variant="subtle"
	                                onClick={() => {
	                                  setEditingAnnotationId(annotation.id);
	                                  setAnnotationAttachmentId(
	                                    annotation.attachment_id,
	                                  );
	                                  setAnnotationPage(String(annotation.page));
	                                  setAnnotationKind(
	                                    annotation.annotation_kind,
	                                  );
	                                  setAnnotationSelectedText(
	                                    annotation.selected_text || "",
	                                  );
	                                  setAnnotationComment(
	                                    annotation.comment || "",
	                                  );
	                                  setAnnotationColor(
	                                    annotation.color || "#ffd43b",
	                                  );
	                                }}
	                              >
	                                Edit
	                              </Button>
	                              <Button
	                                size="compact-xs"
	                                variant="subtle"
	                                color="red"
	                                loading={annotationBusy}
	                                onClick={() =>
	                                  void deletePdfAnnotation(annotation.id)
	                                }
	                              >
	                                Delete
	                              </Button>
	                            </Group>
	                          </Paper>
	                        ))
	                      )}
	                      {entryAttachments.length > 0 && (
	                        <>
	                          <Divider />
	                          <Group grow gap="xs" align="end">
	                            <Select
	                              size="xs"
	                              label="PDF"
	                              value={annotationAttachmentId}
	                              data={entryAttachments.map((attachment) => ({
	                                value: attachment.id,
	                                label:
	                                  attachment.title ||
	                                  fileNameFromPath(attachment.path),
	                              }))}
	                              allowDeselect={false}
	                              onChange={setAnnotationAttachmentId}
	                            />
	                            <TextInput
	                              size="xs"
	                              label="Page"
	                              value={annotationPage}
	                              onChange={(event) =>
	                                setAnnotationPage(event.currentTarget.value)
	                              }
	                            />
	                          </Group>
	                          <Group grow gap="xs" align="end">
	                            <Select
	                              size="xs"
	                              label="Kind"
	                              value={annotationKind}
	                              data={PDF_ANNOTATION_KIND_OPTIONS}
	                              allowDeselect={false}
	                              onChange={(value) =>
	                                setAnnotationKind(value || "highlight")
	                              }
	                            />
	                            <TextInput
	                              size="xs"
	                              label="Color"
	                              value={annotationColor}
	                              onChange={(event) =>
	                                setAnnotationColor(
	                                  event.currentTarget.value,
	                                )
	                              }
	                            />
	                          </Group>
	                          <Textarea
	                            size="xs"
	                            autosize
	                            minRows={2}
	                            label="Selected text / quote"
	                            value={annotationSelectedText}
	                            onChange={(event) =>
	                              setAnnotationSelectedText(
	                                event.currentTarget.value,
	                              )
	                            }
	                          />
	                          <Textarea
	                            size="xs"
	                            autosize
	                            minRows={2}
	                            label="Comment"
	                            value={annotationComment}
	                            onChange={(event) =>
	                              setAnnotationComment(event.currentTarget.value)
	                            }
	                          />
	                          <Group justify="flex-end" gap="xs">
	                            {editingAnnotationId && (
	                              <Button
	                                size="xs"
	                                variant="subtle"
	                                color="gray"
	                                onClick={() => {
	                                  setEditingAnnotationId(null);
	                                  setAnnotationPage("1");
	                                  setAnnotationKind("highlight");
	                                  setAnnotationSelectedText("");
	                                  setAnnotationComment("");
	                                  setAnnotationColor("#ffd43b");
	                                }}
	                              >
	                                Cancel
	                              </Button>
	                            )}
	                            <Button
	                              size="xs"
	                              loading={annotationBusy}
	                              disabled={!annotationAttachmentId}
	                              onClick={() => void savePdfAnnotation()}
	                            >
	                              {editingAnnotationId
	                                ? "Save link"
	                                : "Add annotation link"}
	                            </Button>
	                          </Group>
	                        </>
	                      )}
	                    </Stack>
	                  </Card>
	                  <Card withBorder p="xs" radius="md">
	                    <Group justify="space-between" gap="xs">
	                      <Box>
	                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
	                          Research notes
	                        </Text>
	                        <Text size="xs" c="dimmed">
	                          Private notes attached to this bibliography entry
	                        </Text>
	                      </Box>
	                      {notesLoading ? (
	                        <Loader size="xs" />
	                      ) : (
	                        <Badge size="xs" variant="light" color="gray">
	                          {entryNotes.length}
	                        </Badge>
	                      )}
	                    </Group>
	                    <Stack gap="xs" mt="xs">
	                      {entryNotes.length === 0 && !notesLoading ? (
	                        <Text size="xs" c="dimmed">
	                          No notes yet.
	                        </Text>
	                      ) : (
	                        entryNotes.map((note) => (
	                          <Paper key={note.id} withBorder p="xs" radius="sm">
	                            <Group justify="space-between" gap="xs" mb={4}>
	                              <Group gap={4}>
	                                <Badge
	                                  size="xs"
	                                  variant="light"
	                                  color={noteKindColor(note.note_kind)}
	                                >
	                                  {note.note_kind}
	                                </Badge>
	                                {note.is_pinned && (
	                                  <Badge size="xs" variant="light" color="yellow">
	                                    pinned
	                                  </Badge>
	                                )}
	                              </Group>
	                              <Text size="xs" c="dimmed">
	                                {formatShortDate(note.updated_at)}
	                              </Text>
	                            </Group>
	                            <Text
	                              size="sm"
	                              style={{
	                                whiteSpace: "pre-wrap",
	                                overflowWrap: "anywhere",
	                              }}
	                            >
	                              {note.body}
	                            </Text>
	                            <Group justify="flex-end" gap={4} mt={6}>
	                              <Button
	                                size="compact-xs"
	                                variant="subtle"
	                                onClick={() => {
	                                  setEditingNoteId(note.id);
	                                  setNoteDraft(note.body);
	                                  setNoteKind(note.note_kind);
	                                  setNotePinned(note.is_pinned);
	                                }}
	                              >
	                                Edit
	                              </Button>
	                              <Button
	                                size="compact-xs"
	                                variant="subtle"
	                                color="red"
	                                loading={noteSaving && editingNoteId !== note.id}
	                                onClick={() => void deleteEntryNote(note.id)}
	                              >
	                                Delete
	                              </Button>
	                            </Group>
	                          </Paper>
	                        ))
	                      )}
	                      <Divider />
	                      <Textarea
	                        size="xs"
	                        minRows={3}
	                        autosize
	                        label={editingNoteId ? "Edit note" : "New note"}
	                        placeholder="Add a reading note, quote, idea, or follow-up task..."
	                        value={noteDraft}
	                        onChange={(event) =>
	                          setNoteDraft(event.currentTarget.value)
	                        }
	                      />
	                      <Group grow gap="xs" align="end">
	                        <Select
	                          size="xs"
	                          label="Kind"
	                          value={noteKind}
	                          data={NOTE_KIND_OPTIONS}
	                          allowDeselect={false}
	                          onChange={(value) => setNoteKind(value || "note")}
	                        />
	                        <Checkbox
	                          size="xs"
	                          label="Pinned"
	                          checked={notePinned}
	                          onChange={(event) =>
	                            setNotePinned(event.currentTarget.checked)
	                          }
	                        />
	                      </Group>
	                      <Group justify="flex-end" gap="xs">
	                        {editingNoteId && (
	                          <Button
	                            size="xs"
	                            variant="subtle"
	                            color="gray"
	                            onClick={() => {
	                              setEditingNoteId(null);
	                              setNoteDraft("");
	                              setNoteKind("note");
	                              setNotePinned(false);
	                            }}
	                          >
	                            Cancel
	                          </Button>
	                        )}
	                        <Button
	                          size="xs"
	                          loading={noteSaving}
	                          disabled={!noteDraft.trim()}
	                          onClick={() => void saveEntryNote()}
	                        >
	                          {editingNoteId ? "Save note" : "Add note"}
	                        </Button>
	                      </Group>
	                    </Stack>
	                  </Card>
	                  <MultiSelect
                    size="xs"
                    label="Tags"
                    data={[
                      ...tagOptions.map((option) => option.value),
                      ...tagDraft,
                    ].filter((value, index, array) => array.indexOf(value) === index)}
                    value={tagDraft}
                    onChange={setTagDraft}
                    searchable
                    clearable
                    hidePickedOptions
                  />
                  <Group gap="xs" align="end">
                    <TextInput
                      size="xs"
                      label="Add tag"
                      placeholder="e.g. algebra"
                      value={entryTagInput}
                      onChange={(event) =>
                        setEntryTagInput(event.currentTarget.value)
                      }
                      style={{ flex: 1 }}
                    />
                    <Button
                      size="xs"
                      variant="light"
                      disabled={!normalizeTagName(entryTagInput)}
                      onClick={() => {
                        const tagName = normalizeTagName(entryTagInput);
                        if (!tagName) return;
                        setTagDraft((current) =>
                          current.includes(tagName)
                            ? current
                            : [...current, tagName],
                        );
                        setEntryTagInput("");
                      }}
                    >
                      Add
                    </Button>
                  </Group>
                  <Group justify="flex-end">
                    <Button
                      size="xs"
                      variant="light"
                      loading={saving}
                      onClick={() => void saveEntryTags()}
                    >
                      Save tags
                    </Button>
                  </Group>
                  <Tabs value={editorMode} onChange={setEditorMode}>
                    <Tabs.List grow>
                      <Tabs.Tab value="structured">Structured</Tabs.Tab>
                      <Tabs.Tab value="raw">Raw BibTeX</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="structured" pt="sm">
                      <Stack gap="xs">
                        <Group grow gap="xs">
                          <TextInput
                            size="xs"
                            label="Type"
                            value={draft.entryType}
                            onChange={(event) =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      entryType: event.currentTarget.value,
                                    }
                                  : current,
                              )
                            }
                          />
                          <TextInput
                            size="xs"
                            label="Citation key"
                            value={draft.citationKey}
                            onChange={(event) =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      citationKey: event.currentTarget.value,
                                    }
                                  : current,
                              )
                            }
                          />
                        </Group>
                        {COMMON_FIELDS.map((fieldName) => {
                          const isLong = fieldName === "abstract";
                          const value = draft.fields[fieldName] || "";
                          const Component = isLong ? Textarea : TextInput;
                          return (
                            <Component
                              key={fieldName}
                              size="xs"
                              label={fieldName}
                              autosize={isLong || undefined}
                              minRows={isLong ? 3 : undefined}
                              value={value}
                              onChange={(event) =>
                                updateDraftField(
                                  setDraft,
                                  fieldName,
                                  event.currentTarget.value,
                                )
                              }
                            />
                          );
                        })}
                        <Divider />
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                          Custom fields
                        </Text>
                        {Object.keys(draft.fields)
                          .filter(
                            (fieldName) => !COMMON_FIELDS.includes(fieldName),
                          )
                          .sort()
                          .map((fieldName) => (
                            <Group key={fieldName} align="end" gap="xs">
                              <TextInput
                                size="xs"
                                label={fieldName}
                                style={{ flex: 1 }}
                                value={draft.fields[fieldName] || ""}
                                onChange={(event) =>
                                  updateDraftField(
                                    setDraft,
                                    fieldName,
                                    event.currentTarget.value,
                                  )
                                }
                              />
                              <Button
                                size="xs"
                                variant="subtle"
                                color="red"
                                onClick={() =>
                                  setDraft((current) =>
                                    current
                                      ? {
                                          ...current,
                                          fields: omitField(
                                            current.fields,
                                            fieldName,
                                          ),
                                        }
                                      : current,
                                  )
                                }
                              >
                                Remove
                              </Button>
                            </Group>
                          ))}
                        <Group gap="xs" align="end">
                          <TextInput
                            size="xs"
                            label="Add field"
                            placeholder="e.g. pages"
                            value={newFieldName}
                            onChange={(event) =>
                              setNewFieldName(event.currentTarget.value)
                            }
                            style={{ flex: 1 }}
                          />
                          <Button
                            size="xs"
                            variant="light"
                            disabled={!newFieldName.trim()}
                            onClick={() => {
                              const fieldName = sanitizeFieldName(newFieldName);
                              if (!fieldName) return;
                              updateDraftField(setDraft, fieldName, "");
                              setNewFieldName("");
                            }}
                          >
                            Add
                          </Button>
                        </Group>
                      </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="raw" pt="sm">
                      <Textarea
                        size="xs"
                        minRows={16}
                        autosize
                        value={draft.rawEntry}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  rawEntry: event.currentTarget.value,
                                }
                              : current,
                          )
                        }
                      />
                    </Tabs.Panel>
                  </Tabs>
                  <Group justify="space-between" mt="xs">
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() =>
                        setDraft({
                          entryType: selectedEntry.entry_type,
                          citationKey: selectedEntry.citation_key,
                          fields: fieldsToStringRecord(selectedEntry.fields),
                          rawEntry:
                            selectedEntry.raw_entry ||
                            buildRawPreview(selectedEntry),
                        })
                      }
                    >
                      Reset
                    </Button>
                    <Button
                      size="xs"
                      loading={saving}
                      onClick={() => void saveDraft()}
                    >
                      Save entry
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("bibliography.workspace.selectEntry", {
                    defaultValue: "Select an entry to inspect its metadata.",
                  })}
                </Text>
              )}
            </ScrollArea>
          </Paper>
        </Group>
      </Stack>
    </Box>
  );
};

function buildCitationPreview(
  entry: CitationPreviewInput,
  style: CitationPreviewStyle,
): { bibliography: string; inText: string } {
  switch (style) {
    case "mla":
      return buildMlaPreview(entry);
    case "chicago":
      return buildChicagoPreview(entry);
    case "apa":
    default:
      return buildApaPreview(entry);
  }
}

function buildApaPreview(entry: CitationPreviewInput): {
  bibliography: string;
  inText: string;
} {
  const people = entryPeople(entry);
  const year = previewYear(entry);
  const title = previewTitle(entry);
  const container = previewContainer(entry);
  const volume = previewField(entry, "volume");
  const issue = previewField(entry, "number", "issue");
  const pages = previewPages(entry, false);
  const locator = previewDoiOrUrl(entry);
  const publisher = previewField(entry, "publisher");
  const names = formatApaPeople(people);
  const date = year ? `(${year}).` : "(n.d.).";
  const bibliography = compactSentence([
    names || entry.citationKey,
    date,
    title ? `${sentenceCaseTitle(title)}.` : undefined,
    isArticleLike(entry.entryType) && container
      ? `${container}${volume ? `, ${volume}${issue ? `(${issue})` : ""}` : ""}${
          pages ? `, ${pages}` : ""
        }.`
      : undefined,
    !isArticleLike(entry.entryType) && publisher ? `${publisher}.` : undefined,
    locator,
  ]);
  return {
    bibliography,
    inText: `(${shortAuthorLabel(people, entry.citationKey)}, ${year || "n.d."})`,
  };
}

function buildMlaPreview(entry: CitationPreviewInput): {
  bibliography: string;
  inText: string;
} {
  const people = entryPeople(entry);
  const title = previewTitle(entry);
  const container = previewContainer(entry);
  const volume = previewField(entry, "volume");
  const issue = previewField(entry, "number", "issue");
  const year = previewYear(entry);
  const pages = previewPages(entry, true);
  const publisher = previewField(entry, "publisher");
  const locator = previewDoiOrUrl(entry);
  const titlePart =
    isArticleLike(entry.entryType) || container
      ? title
        ? `"${title}."`
        : undefined
      : title
        ? `${title}.`
        : undefined;
  const bibliography = compactSentence([
    formatMlaPeople(people) || entry.citationKey,
    titlePart,
    container ? `${container},` : undefined,
    volume ? `vol. ${volume},` : undefined,
    issue ? `no. ${issue},` : undefined,
    !container && publisher ? `${publisher},` : publisher && entry.entryType === "book" ? `${publisher},` : undefined,
    year ? `${year},` : undefined,
    pages ? `${pages}.` : undefined,
    locator,
  ]).replace(/,\s*\./g, ".");
  return {
    bibliography,
    inText: `(${shortAuthorLabel(people, entry.citationKey)})`,
  };
}

function buildChicagoPreview(entry: CitationPreviewInput): {
  bibliography: string;
  inText: string;
} {
  const people = entryPeople(entry);
  const title = previewTitle(entry);
  const container = previewContainer(entry);
  const volume = previewField(entry, "volume");
  const issue = previewField(entry, "number", "issue");
  const year = previewYear(entry);
  const pages = previewPages(entry, false);
  const publisher = previewField(entry, "publisher");
  const locator = previewDoiOrUrl(entry);
  const titlePart =
    isArticleLike(entry.entryType) || container
      ? title
        ? `"${title}."`
        : undefined
      : title
        ? `${title}.`
        : undefined;
  const journalPart = container
    ? `${container}${volume ? ` ${volume}` : ""}${issue ? `, no. ${issue}` : ""}${
        year ? ` (${year})` : ""
      }${pages ? `: ${pages}` : ""}.`
    : undefined;
  const bookPart =
    !container && publisher
      ? `${publisher}${year ? `, ${year}` : ""}.`
      : !container && year
        ? `${year}.`
        : undefined;
  const bibliography = compactSentence([
    formatChicagoPeople(people) || entry.citationKey,
    titlePart,
    journalPart,
    bookPart,
    locator,
  ]);
  return {
    bibliography,
    inText: `(${shortAuthorLabel(people, entry.citationKey)} ${year || "n.d."})`,
  };
}

function isCitationPreviewStyle(
  value: string | null,
): value is CitationPreviewStyle {
  return value === "apa" || value === "mla" || value === "chicago";
}

function entryPeople(entry: CitationPreviewInput): BibPerson[] {
  const peopleField =
    previewField(entry, "author") ||
    previewField(entry, "editor") ||
    previewField(entry, "translator") ||
    "";
  return splitBibPeople(peopleField);
}

function splitBibPeople(value: string): BibPerson[] {
  return value
    .split(/\s+and\s+/i)
    .map((part) => parseBibPerson(stripBibTexMarkup(part)))
    .filter((person) => person.family || person.given);
}

interface BibPerson {
  family: string;
  given: string;
}

function parseBibPerson(value: string): BibPerson {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return { family: "", given: "" };
  const commaParts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    return {
      family: commaParts[0] || "",
      given: commaParts.slice(1).join(" ") || "",
    };
  }
  const words = cleaned.split(" ");
  if (words.length === 1) return { family: words[0], given: "" };
  return {
    family: words[words.length - 1] || "",
    given: words.slice(0, -1).join(" "),
  };
}

function formatApaPeople(people: BibPerson[]): string {
  const formatted = people.map((person) =>
    [person.family, initials(person.given)].filter(Boolean).join(", "),
  );
  if (formatted.length <= 2) return formatted.join(" & ");
  return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
}

function formatMlaPeople(people: BibPerson[]): string {
  if (people.length === 0) return "";
  const [first, ...rest] = people;
  const firstName = [first.family, first.given].filter(Boolean).join(", ");
  if (rest.length === 0) return firstName;
  if (rest.length === 1) {
    return `${firstName}, and ${fullName(rest[0])}`;
  }
  return `${firstName}, et al.`;
}

function formatChicagoPeople(people: BibPerson[]): string {
  if (people.length === 0) return "";
  const [first, ...rest] = people;
  const firstName = [first.family, first.given].filter(Boolean).join(", ");
  if (rest.length === 0) return firstName;
  if (rest.length === 1) {
    return `${firstName}, and ${fullName(rest[0])}`;
  }
  return `${firstName}, ${rest.slice(0, -1).map(fullName).join(", ")}, and ${fullName(
    rest[rest.length - 1],
  )}`;
}

function fullName(person: BibPerson): string {
  return [person.given, person.family].filter(Boolean).join(" ");
}

function initials(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase()}.`)
    .join(" ");
}

function shortAuthorLabel(people: BibPerson[], fallback: string): string {
  if (people.length === 0) return fallback;
  if (people.length === 1) return people[0].family || fullName(people[0]) || fallback;
  if (people.length === 2) {
    return `${people[0].family || fullName(people[0])} & ${
      people[1].family || fullName(people[1])
    }`;
  }
  return `${people[0].family || fullName(people[0])} et al.`;
}

function previewTitle(entry: CitationPreviewInput): string | null {
  const title = previewField(entry, "title");
  const subtitle = previewField(entry, "subtitle");
  return [title, subtitle].filter(Boolean).join(": ") || null;
}

function previewContainer(entry: CitationPreviewInput): string | null {
  return previewField(
    entry,
    "journaltitle",
    "journal",
    "booktitle",
    "container-title",
    "series",
  );
}

function previewYear(entry: CitationPreviewInput): string | null {
  const date = previewField(entry, "year", "date", "issued");
  return date?.match(/\d{4}/)?.[0] ?? null;
}

function previewPages(entry: CitationPreviewInput, withPrefix: boolean): string | null {
  const pages = previewField(entry, "pages", "page");
  if (!pages) return null;
  const normalized = pages.replace(/--/g, "–");
  return withPrefix ? `pp. ${normalized}` : normalized;
}

function previewDoiOrUrl(entry: CitationPreviewInput): string | null {
  const doi = previewField(entry, "doi", "DOI");
  if (doi) {
    return doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
  }
  return previewField(entry, "url", "URL");
}

function previewField(
  entry: CitationPreviewInput,
  ...fieldNames: string[]
): string | null {
  for (const fieldName of fieldNames) {
    const value = entry.fields[fieldName] ?? entry.fields[fieldName.toLowerCase()];
    if (typeof value === "string" && value.trim()) {
      return stripBibTexMarkup(value);
    }
  }
  return null;
}

function isArticleLike(entryType: string): boolean {
  return /article|periodical|inproceedings|incollection|conference/i.test(entryType);
}

function sentenceCaseTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function stripBibTexMarkup(value: string): string {
  return value
    .replace(/[{}]/g, "")
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/\\_/g, "_")
    .replace(/\\textit\s*/g, "")
    .replace(/\\emph\s*/g, "")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSentence(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .replace(/\s+([,.:;])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function compareEntryNotes(
  left: BibliographyEntryNoteSummary,
  right: BibliographyEntryNoteSummary,
): number {
  if (left.is_pinned !== right.is_pinned) return left.is_pinned ? -1 : 1;
  return right.updated_at.localeCompare(left.updated_at);
}

function compareEntryAttachments(
  left: BibliographyEntryAttachmentSummary,
  right: BibliographyEntryAttachmentSummary,
): number {
  if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
  return right.updated_at.localeCompare(left.updated_at);
}

function comparePdfAnnotations(
  left: BibliographyPdfAnnotationSummary,
  right: BibliographyPdfAnnotationSummary,
): number {
  if (left.page !== right.page) return left.page - right.page;
  return right.updated_at.localeCompare(left.updated_at);
}

function noteKindColor(noteKind: string): string {
  switch (noteKind) {
    case "quote":
      return "grape";
    case "idea":
      return "teal";
    case "todo":
      return "orange";
    default:
      return "blue";
  }
}

function pdfAnnotationKindColor(annotationKind: string): string {
  switch (annotationKind) {
    case "note":
      return "blue";
    case "quote":
      return "grape";
    case "bookmark":
      return "gray";
    default:
      return "yellow";
  }
}

function federationStatusColor(status: string): string {
  switch (status) {
    case "idle":
      return "teal";
    case "syncing":
      return "blue";
    case "error":
      return "red";
    default:
      return "gray";
  }
}

function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() || path;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Box>
      <Text size="xs" fw={700} c="dimmed">
        {label}
      </Text>
      <Text size="sm" style={{ overflowWrap: "anywhere" }}>
        {value}
      </Text>
    </Box>
  );
}

function updateDraftField(
  setDraft: React.Dispatch<React.SetStateAction<EntryDraft | null>>,
  fieldName: string,
  value: string,
) {
  setDraft((current) =>
    current
      ? {
          ...current,
          fields: {
            ...current.fields,
            [fieldName]: value,
          },
        }
      : current,
  );
}

function fieldsToStringRecord(
  fields: Record<string, unknown> | undefined,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields || {})) {
    record[key] = typeof value === "string" ? value : String(value ?? "");
  }
  return record;
}

function removeEmptyFields(fields: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const fieldName = sanitizeFieldName(key);
    const trimmed = value.trim();
    if (fieldName && trimmed) cleaned[fieldName] = trimmed;
  }
  return cleaned;
}

function omitField(
  fields: Record<string, string>,
  fieldName: string,
): Record<string, string> {
  const next = { ...fields };
  delete next[fieldName];
  return next;
}

function sanitizeFieldName(value: string): string | null {
  const fieldName = value.trim().toLowerCase().replace(/^@/, "");
  return /^[a-z0-9_-]+$/.test(fieldName) ? fieldName : null;
}

function normalizeTagName(value: string): string | null {
  const tagName = value
    .trim()
    .replace(/^#/, "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tagName ? tagName : null;
}

function buildRawPreview(entry: BibliographyEntrySummary): string {
  const fields = fieldsToStringRecord(entry.fields);
  const fieldNames = Object.keys(fields).sort((left, right) =>
    fieldSortKey(left).localeCompare(fieldSortKey(right)),
  );
  const lines = [`@${entry.entry_type}{${entry.citation_key}`];
  for (const fieldName of fieldNames) {
    const value = fields[fieldName]?.trim();
    if (!value) continue;
    lines.push(`  ${fieldName} = {${value.replace(/\r/g, "")}}`);
  }
  return `${lines.join(",\n")}\n}`;
}

function fieldSortKey(fieldName: string): string {
  const priority = [
    "author",
    "editor",
    "title",
    "subtitle",
    "journal",
    "booktitle",
    "publisher",
    "year",
    "date",
    "doi",
    "url",
    "isbn",
    "abstract",
  ];
  const index = priority.indexOf(fieldName);
  return `${index === -1 ? priority.length : index}`.padStart(2, "0") + fieldName;
}

function sourceLabel(source: BibliographySourceOption): string {
  return source.title || shortPath(source.path);
}

function shortPath(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).slice(-2).join("/");
}

function importFormatFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "ris":
      return "ris";
    case "json":
    case "csl":
      return "csl-json";
    case "enw":
      return "endnote";
    case "nbib":
      return "pubmed";
    default:
      return "auto";
  }
}

function sourceStatusColor(source: BibliographySourceOption): string {
  if (source.parse_status === "ok") return "teal";
  if (source.parse_status === "warning") return "yellow";
  return "red";
}

function fieldString(
  entry: BibliographyEntrySummary,
  fieldName: string,
): string | null {
  const value = entry.fields?.[fieldName];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
