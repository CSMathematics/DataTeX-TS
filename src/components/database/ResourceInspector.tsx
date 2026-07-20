import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Stack,
  Text,
  Select,
  Group,
  TextInput,
  ScrollArea,
  Tabs,
  Box,
  Badge,
  Button,
  Table,
  Alert,
  Divider,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInfoCircle,
  faFilePdf,
  faBook,
  faTimes,
  faMagic,
  faPlus,
  faSyncAlt,
} from "@fortawesome/free-solid-svg-icons";
import { BUILTIN_PREAMBLES } from "../../data/preambles";
import { useDatabaseStore } from "../../stores/databaseStore";
import { useTypedMetadataStore } from "../../stores/typedMetadataStore";
import { useTabsStore } from "../../stores/useTabsStore";
import { readFile } from "@tauri-apps/plugin-fs";
import { PdfViewerContainer } from "./PdfViewerContainer";
import { LoadingState, EmptyState, PanelHeader, ToolbarButton } from "../ui";
import { faCode } from "@fortawesome/free-solid-svg-icons";
import { loadLocalMonaco } from "../../services/monacoLoader";
import { configureLatexMonaco } from "../../services/latexMonaco";
import { useSettingsStore } from "../../stores/settingsStore";
import "../../styles/pdf-viewer.css";

const PreambleWizard = lazy(() =>
  import("../wizards/PreambleWizard").then((module) => ({
    default: module.PreambleWizard,
  })),
);

const DynamicMetadataEditor = lazy(() =>
  import("../metadata/DynamicMetadataEditor").then((module) => ({
    default: module.DynamicMetadataEditor,
  })),
);

const CodeEditor = lazy(() =>
  loadLocalMonaco().then(({ reactMonaco }) => ({
    default: reactMonaco.default,
  })),
);

const PDF_SOURCE_EXTENSION = /\.(?:tex|sty|cls|bib|dtx|ins)$/i;
const normalizePath = (path: string) => path.replace(/\\/g, "/");

interface BibliographyDiagnostic {
  message: string;
  byte_start: number;
  byte_end: number;
}

interface BibliographyImportResult {
  source: {
    id: string;
    resource_id: string;
    path: string;
    parse_status: "pending" | "ok" | "warning" | "error" | string;
    content_hash: string;
  };
  entries_imported: number;
  diagnostics: BibliographyDiagnostic[];
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
  tags?: string[];
  fields: Record<string, string>;
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

interface BibliographyDeclarationSummary {
  command_name: string;
  requested: string;
  normalized_name: string;
  byte_start: number;
  byte_end: number;
  matches: BibliographySourceOption[];
}

interface BibliographyAutoLinkResult {
  resource_id: string;
  declarations: BibliographyDeclarationSummary[];
  linked_sources: BibliographySourceOption[];
  linked_count: number;
  unresolved_count: number;
  ambiguous_count: number;
}

interface CitationOccurrenceSummary {
  command_name: string;
  citation_key: string;
  byte_start: number;
  byte_end: number;
  scan_status: "resolved" | "missing" | "ambiguous" | string;
  entry_id?: string | null;
  entry_type?: string | null;
  title?: string | null;
  year?: string | null;
}

interface CitationScanResult {
  resource_id: string;
  linked_source_count: number;
  total: number;
  resolved: number;
  missing: number;
  ambiguous: number;
  occurrences: CitationOccurrenceSummary[];
}

const BIBLIOGRAPHY_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "resolved", label: "Resolved" },
  { value: "missing", label: "Missing" },
  { value: "ambiguous", label: "Ambiguous" },
];

// Classification Options
const RESOURCE_KINDS = [
  { value: "file", label: "LaTeX File Fragment" },
  { value: "document", label: "Full Document" },
  { value: "bibliography", label: "Bibliography (.bib)" },
  { value: "table", label: "Table" },
  { value: "figure", label: "Figure/Image" },
  { value: "command", label: "LaTeX Command/Macro" },
  { value: "package", label: "LaTeX Package (.sty)" },
  { value: "class", label: "LaTeX Class (.cls)" },
  { value: "preamble", label: "Preamble" },
  { value: "dtx", label: "LaTeX DTX (.dtx)" },
  { value: "ins", label: "LaTeX INS (.ins)" },
];

interface ResourceInspectorProps {
  /** PDF URL from main editor */
  mainEditorPdfPath?: string | null;
  mainEditorPdfUrl?: string | null;
  mainEditorPdfLoading?: boolean;
  syncTexCoords?: {
    page: number;
    x: number;
    y: number;
    requestId?: number;
  } | null;
  onInsertFragment?: (code: string) => void;
  canInsert?: boolean;
  onSyncTexInverse?: (page: number, x: number, y: number) => void;

  /** Active editor tab (for .dtex file metadata) */
  activeEditorTab?: import("../../stores/useTabsStore").AppTab;
}

const sameSyncTexCoords = (
  previous: ResourceInspectorProps["syncTexCoords"],
  next: ResourceInspectorProps["syncTexCoords"],
) =>
  previous === next ||
  (previous?.page === next?.page &&
    previous?.x === next?.x &&
    previous?.y === next?.y &&
    previous?.requestId === next?.requestId);

const sameInspectorProps = (
  previous: ResourceInspectorProps,
  next: ResourceInspectorProps,
) =>
  previous.mainEditorPdfUrl === next.mainEditorPdfUrl &&
  previous.mainEditorPdfPath === next.mainEditorPdfPath &&
  previous.mainEditorPdfLoading === next.mainEditorPdfLoading &&
  sameSyncTexCoords(previous.syncTexCoords, next.syncTexCoords) &&
  previous.onInsertFragment === next.onInsertFragment &&
  previous.canInsert === next.canInsert &&
  previous.onSyncTexInverse === next.onSyncTexInverse &&
  previous.activeEditorTab?.id === next.activeEditorTab?.id &&
  previous.activeEditorTab?.isDtexFile === next.activeEditorTab?.isDtexFile &&
  previous.activeEditorTab?.dtexMetadata ===
    next.activeEditorTab?.dtexMetadata;

const ResourceInspectorComponent = ({
  mainEditorPdfUrl,
  mainEditorPdfPath,
  mainEditorPdfLoading,
  syncTexCoords,
  onInsertFragment,
  canInsert,
  onSyncTexInverse,
  activeEditorTab,
}: ResourceInspectorProps) => {
  const { t } = useTranslation();
  const allLoadedResources = useDatabaseStore(
    (state) => state.allLoadedResources,
  );
  const resources = useDatabaseStore((state) => state.resources);
  const activeResourceId = useDatabaseStore(
    (state) => state.activeResourceId,
  );
  const insertMode = useDatabaseStore((state) => state.insertMode);
  const isWizardOpen = useDatabaseStore((state) => state.isWizardOpen);
  const setWizardOpen = useDatabaseStore((state) => state.setWizardOpen);
  const createResource = useDatabaseStore((state) => state.createResource);
  const updateResourceKind = useDatabaseStore(
    (state) => state.updateResourceKind,
  );
  const updateTabMetadata = useTabsStore((state) => state.updateTabMetadata);
  const markMetadataDirty = useTabsStore(
    (state) => state.markMetadataDirty,
  );
  const editorTheme = useSettingsStore((state) => state.settings.editor.theme);

  // Do two separate lookups so an earlier activeResourceId match cannot win
  // over the resource that belongs to the active editor tab.
  const { resource, isActiveEditorResource } = useMemo(() => {
    const activeEditorPath = activeEditorTab?.id
      ? normalizePath(activeEditorTab.id)
      : null;
    const findResource = (
      predicate: (candidate: (typeof resources)[number]) => boolean,
    ) => allLoadedResources.find(predicate) ?? resources.find(predicate);
    const editorResource = activeEditorTab?.id
      ? findResource(
          (candidate) =>
            normalizePath(candidate.path) === activeEditorPath ||
            candidate.id === activeEditorTab.id,
        )
      : undefined;
    // A standalone .dtex editor owns its metadata. Falling back to the last
    // selected database row here could save that metadata onto an unrelated
    // resource when the .dtex file has not been imported into the database.
    const fallbackResource = !activeEditorTab?.isDtexFile && activeResourceId
      ? findResource(
          (candidate) => candidate.id === activeResourceId,
        )
      : undefined;

    return {
      resource: editorResource ?? fallbackResource,
      isActiveEditorResource: Boolean(editorResource),
    };
  }, [
    allLoadedResources,
    resources,
    activeEditorTab?.id,
    activeEditorTab?.isDtexFile,
    activeResourceId,
  ]);
  const mainEditorOwnsPdf = Boolean(
    isActiveEditorResource &&
      activeEditorTab?.id &&
      PDF_SOURCE_EXTENSION.test(activeEditorTab.id),
  );
  const canScanResourceCitations = Boolean(
    resource &&
      resource.kind !== "bibliography" &&
      /\.(?:tex|dtx)$/i.test(resource.path),
  );
  const expectedLocalPdfPath = useMemo(() => {
    if (!resource || mainEditorOwnsPdf) return null;
    if (PDF_SOURCE_EXTENSION.test(resource.path)) {
      return resource.path.replace(PDF_SOURCE_EXTENSION, ".pdf");
    }
    return resource.path.toLowerCase().endsWith(".pdf")
      ? resource.path
      : null;
  }, [mainEditorOwnsPdf, resource?.path]);
  const localPdfTypeUnsupported = Boolean(
    resource && !mainEditorOwnsPdf && !expectedLocalPdfPath,
  );

  const [activeInspectorTab, setActiveInspectorTab] =
    useState<string | null>("preview");
  const metadataIdentity =
    resource?.id ||
    (activeEditorTab?.isDtexFile ? activeEditorTab.id : undefined);
  const [mountedMetadataIdentity, setMountedMetadataIdentity] = useState<
    string | undefined
  >();
  const [loadedLocalPdf, setLoadedLocalPdf] = useState<{
    path: string;
    url: string;
  } | null>(null);
  const [localPdfLoadStatus, setLocalPdfLoadStatus] = useState<{
    path: string;
    status: "loading" | "settled";
  } | null>(null);
  const [localPdfError, setLocalPdfError] = useState<{
    path: string;
    message: string;
  } | null>(null);
  const pdfUrl =
    expectedLocalPdfPath && loadedLocalPdf?.path === expectedLocalPdfPath
      ? loadedLocalPdf.url
      : null;
  const pdfLoading =
    expectedLocalPdfPath !== null &&
    (!localPdfLoadStatus ||
      localPdfLoadStatus.path !== expectedLocalPdfPath ||
      localPdfLoadStatus.status === "loading");
  const pdfError = localPdfTypeUnsupported
    ? "No PDF preview available for this file type."
    : localPdfError?.path === expectedLocalPdfPath
      ? localPdfError.message
      : null;

  // Code Preview state
  const [codeContent, setCodeContent] = useState<string>("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [bibliographyEntries, setBibliographyEntries] = useState<
    BibliographyEntrySummary[]
  >([]);
  const [availableBibliographySources, setAvailableBibliographySources] =
    useState<BibliographySourceOption[]>([]);
  const [linkedBibliographySources, setLinkedBibliographySources] = useState<
    BibliographySourceOption[]
  >([]);
  const [sourceToLink, setSourceToLink] = useState<string | null>(null);
  const [autoLinkResult, setAutoLinkResult] =
    useState<BibliographyAutoLinkResult | null>(null);
  const [bibliographyDeclarations, setBibliographyDeclarations] = useState<
    BibliographyDeclarationSummary[]
  >([]);
  const [bibliographyImport, setBibliographyImport] =
    useState<BibliographyImportResult | null>(null);
  const [citationScan, setCitationScan] =
    useState<CitationScanResult | null>(null);
  const [bibliographyQuery, setBibliographyQuery] = useState("");
  const [bibliographyStatusFilter, setBibliographyStatusFilter] =
    useState("all");
  const [selectedBibliographyEntryId, setSelectedBibliographyEntryId] =
    useState<string | null>(null);
  const [selectedCitationIndex, setSelectedCitationIndex] = useState<
    number | null
  >(null);
  const [bibliographyLoading, setBibliographyLoading] = useState(false);
  const [bibliographyError, setBibliographyError] = useState<string | null>(
    null,
  );

  const hasMetadataTab = Boolean(
    resource ||
      (activeEditorTab?.isDtexFile && activeEditorTab.dtexMetadata),
  );
  const hasBibliographyTab = Boolean(resource);
  const hasCodeTab = Boolean(
    resource && insertMode && resource.path.toLowerCase().endsWith(".tex"),
  );

  useEffect(() => {
    const activeTabIsAvailable =
      activeInspectorTab === "preview" ||
      (activeInspectorTab === "metadata" && hasMetadataTab) ||
      (activeInspectorTab === "bibliography" && hasBibliographyTab) ||
      (activeInspectorTab === "code" && hasCodeTab);

    if (!activeTabIsAvailable) setActiveInspectorTab("preview");
  }, [
    activeInspectorTab,
    hasMetadataTab,
    hasBibliographyTab,
    hasCodeTab,
  ]);

  useEffect(() => {
    if (activeInspectorTab === "metadata") {
      setMountedMetadataIdentity(metadataIdentity);
    }
  }, [activeInspectorTab, metadataIdentity]);

  const shouldMountMetadata =
    activeInspectorTab === "metadata" ||
    (Boolean(metadataIdentity) &&
      mountedMetadataIdentity === metadataIdentity);

  // Initialize typed metadata lookup data
  const loadAllLookupData = useTypedMetadataStore(
    (state) => state.loadAllLookupData,
  );

  useEffect(() => {
    if (activeInspectorTab !== "metadata") return;
    void loadAllLookupData(resource?.collection).catch((error) => {
      console.error("Failed to load metadata lookup data:", error);
    });
  }, [activeInspectorTab, loadAllLookupData, resource?.collection]);

  useEffect(() => {
    if (!loadedLocalPdf) return;
    return () => URL.revokeObjectURL(loadedLocalPdf.url);
  }, [loadedLocalPdf]);

  // Load PDF when resource changes
  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      // The main editor hook owns the PDF for the active editor. Reading it
      // again here doubles filesystem/IPC work and creates a second Blob.
      if (!expectedLocalPdfPath) {
        setLoadedLocalPdf(null);
        setLocalPdfError(null);
        setLocalPdfLoadStatus(null);
        return;
      }

      const pdfPath = expectedLocalPdfPath;
      setLocalPdfLoadStatus({ path: pdfPath, status: "loading" });
      setLocalPdfError(null);
      setLoadedLocalPdf((current) =>
        current?.path === pdfPath ? current : null,
      );

      try {
        // A direct read avoids a separate exists IPC round-trip.
        const fileContents = await readFile(pdfPath);
        if (cancelled) return;
        if (fileContents.byteLength === 0) {
          throw new Error("The PDF file is empty.");
        }

        const blob = new Blob([fileContents], { type: "application/pdf" });
        const nextBlobUrl = URL.createObjectURL(blob);
        setLoadedLocalPdf({ path: pdfPath, url: nextBlobUrl });
      } catch (e) {
        if (cancelled) return;
        console.warn("PDF load failed:", e);
        setLoadedLocalPdf(null);
        const message = String(e);
        setLocalPdfError({
          path: pdfPath,
          message: /not found|os error 2|no such file/i.test(message)
            ? "No PDF available. Compile the document first."
            : `Failed to load PDF: ${message}`,
        });
      } finally {
        if (!cancelled) {
          setLocalPdfLoadStatus({ path: pdfPath, status: "settled" });
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
    };
  }, [expectedLocalPdfPath]);

  // Load code only when its tab is actually visible. Inactive Mantine panels
  // are unmounted below, so this also avoids a hidden Monaco instance.
  useEffect(() => {
    let cancelled = false;

    const loadCode = async () => {
      if (activeInspectorTab !== "code" || !hasCodeTab || !resource) {
        setCodeLoading(false);
        return;
      }

      if (!resource.path) {
        setCodeContent("");
        return;
      }

      // Only load code for .tex, .sty, .cls, .bib files
      const codeExtensions = [".tex", ".sty", ".cls", ".bib", ".dtx", ".ins"];
      const hasCodeExtension = codeExtensions.some((ext) =>
        resource.path.toLowerCase().endsWith(ext),
      );

      if (!hasCodeExtension) {
        setCodeContent("");
        return;
      }

      setCodeLoading(true);
      setCodeContent("");
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(resource.path);
        if (!cancelled) setCodeContent(content);
      } catch (e) {
        if (cancelled) return;
        console.warn("Code load failed:", e);
        setCodeContent(`% Failed to load: ${String(e)}`);
      } finally {
        if (!cancelled) setCodeLoading(false);
      }
    };

    void loadCode();
    return () => {
      cancelled = true;
    };
  }, [activeInspectorTab, hasCodeTab, resource?.path]);

  const loadBibliography = useCallback(async () => {
    if (!resource) return;

    setBibliographyLoading(true);
    setBibliographyError(null);

    try {
      if (resource.kind === "bibliography") {
        const result = await invoke<BibliographyImportResult>(
          "reparse_bibliography_resource_cmd",
          { resourceId: resource.id },
        );
        setBibliographyImport(result);
        setCitationScan(null);
        setBibliographyDeclarations([]);
        setAutoLinkResult(null);
        invoke("watch_bibliography_resources_cmd").catch((caught) => {
          console.warn("Failed to refresh bibliography watcher:", caught);
        });
      } else if (canScanResourceCitations) {
        const [sources, linkedSources, declarations, result] = await Promise.all([
          invoke<BibliographySourceOption[]>(
            "list_all_bibliography_sources_cmd",
          ),
          invoke<BibliographySourceOption[]>(
            "list_linked_bibliography_sources_cmd",
            { resourceId: resource.id },
          ),
          invoke<BibliographyDeclarationSummary[]>(
            "detect_bibliography_declarations_cmd",
            { resourceId: resource.id },
          ),
          invoke<CitationScanResult>("scan_resource_citations_cmd", {
            resourceId: resource.id,
          }),
        ]);
        setAvailableBibliographySources(sources);
        setLinkedBibliographySources(linkedSources);
        setBibliographyDeclarations(declarations);
        setCitationScan(result);
        setBibliographyImport(null);
      } else {
        setBibliographyImport(null);
        setCitationScan(null);
        setAutoLinkResult(null);
        setBibliographyDeclarations([]);
        setAvailableBibliographySources([]);
        setLinkedBibliographySources([]);
      }

      const entries = resource.kind === "bibliography"
        ? await invoke<BibliographyEntrySummary[]>(
            "list_bibliography_entries_for_resource_cmd",
            { resourceId: resource.id },
          )
        : [];
      setBibliographyEntries(entries);
    } catch (error) {
      console.error("Failed to load bibliography:", error);
      setBibliographyImport(null);
      setCitationScan(null);
      setAutoLinkResult(null);
      setBibliographyDeclarations([]);
      setBibliographyEntries([]);
      setAvailableBibliographySources([]);
      setLinkedBibliographySources([]);
      setBibliographyError(String(error));
    } finally {
      setBibliographyLoading(false);
    }
  }, [canScanResourceCitations, resource?.id, resource?.kind]);

  useEffect(() => {
    if (activeInspectorTab !== "bibliography" || !resource) return;
    void loadBibliography();
  }, [activeInspectorTab, loadBibliography, resource?.id]);

  useEffect(() => {
    if (activeInspectorTab !== "bibliography" || !resource) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;
    listen<BibliographyReparseEvent>("bibliography-resource-reparsed", (event) => {
      if (event.payload.skipped || event.payload.error) return;
      if (
        resource.kind === "bibliography" &&
        event.payload.resourceId !== resource.id
      ) {
        return;
      }
      void loadBibliography();
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
  }, [activeInspectorTab, loadBibliography, resource?.id, resource?.kind]);

  useEffect(() => {
    const linkedIds = new Set(
      linkedBibliographySources.map((source) => source.id),
    );
    if (sourceToLink && linkedIds.has(sourceToLink)) {
      setSourceToLink(null);
    }
  }, [linkedBibliographySources, sourceToLink]);

  const bibliographySourceOptions = useMemo(() => {
    const linkedIds = new Set(
      linkedBibliographySources.map((source) => source.id),
    );
    return availableBibliographySources
      .filter((source) => !linkedIds.has(source.id))
      .map((source) => ({
        value: source.id,
        label: `${source.title || source.path.split(/[/\\]/).pop() || source.path} (${source.entry_count})`,
      }));
  }, [availableBibliographySources, linkedBibliographySources]);

  const normalizedBibliographyQuery = bibliographyQuery.trim().toLowerCase();

  const filteredBibliographyEntries = useMemo(() => {
    if (!normalizedBibliographyQuery) return bibliographyEntries;
    return bibliographyEntries.filter((entry) =>
      [
        entry.citation_key,
        entry.entry_type,
        entry.title,
        entry.year,
        entry.date,
        entry.doi,
        entry.url,
        entry.fields?.author,
        entry.fields?.editor,
        entry.fields?.publisher,
        entry.fields?.journal,
        entry.fields?.booktitle,
        ...(entry.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedBibliographyQuery),
    );
  }, [bibliographyEntries, normalizedBibliographyQuery]);

  const filteredCitationOccurrences = useMemo(() => {
    const occurrences = citationScan?.occurrences || [];
    return occurrences.filter((occurrence) => {
      if (
        bibliographyStatusFilter !== "all" &&
        occurrence.scan_status !== bibliographyStatusFilter
      ) {
        return false;
      }
      if (!normalizedBibliographyQuery) return true;
      return [
        occurrence.command_name,
        occurrence.citation_key,
        occurrence.scan_status,
        occurrence.entry_type,
        occurrence.title,
        occurrence.year,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedBibliographyQuery);
    });
  }, [bibliographyStatusFilter, citationScan?.occurrences, normalizedBibliographyQuery]);

  const selectedBibliographyEntry = useMemo(
    () =>
      bibliographyEntries.find(
        (entry) => entry.id === selectedBibliographyEntryId,
      ) || filteredBibliographyEntries[0],
    [bibliographyEntries, filteredBibliographyEntries, selectedBibliographyEntryId],
  );

  const selectedCitationOccurrence = useMemo(() => {
    if (selectedCitationIndex === null) return filteredCitationOccurrences[0];
    return filteredCitationOccurrences[selectedCitationIndex] || filteredCitationOccurrences[0];
  }, [filteredCitationOccurrences, selectedCitationIndex]);

  useEffect(() => {
    setSelectedBibliographyEntryId(null);
    setSelectedCitationIndex(null);
    setBibliographyQuery("");
    setBibliographyStatusFilter("all");
  }, [resource?.id]);

  const linkSelectedBibliographySource = useCallback(async () => {
    if (!resource || !sourceToLink) return;
    setBibliographyLoading(true);
    setBibliographyError(null);
    try {
      await invoke("link_bibliography_source_cmd", {
        resourceId: resource.id,
        sourceId: sourceToLink,
      });
      setSourceToLink(null);
      await loadBibliography();
    } catch (error) {
      console.error("Failed to link bibliography source:", error);
      setBibliographyError(String(error));
    } finally {
      setBibliographyLoading(false);
    }
  }, [loadBibliography, resource?.id, sourceToLink]);

  const autoLinkDeclaredBibliographySources = useCallback(async () => {
    if (!resource) return;
    setBibliographyLoading(true);
    setBibliographyError(null);
    try {
      const result = await invoke<BibliographyAutoLinkResult>(
        "auto_link_declared_bibliography_sources_cmd",
        { resourceId: resource.id },
      );
      setAutoLinkResult(result);
      await loadBibliography();
    } catch (error) {
      console.error("Failed to auto-link bibliography sources:", error);
      setBibliographyError(String(error));
    } finally {
      setBibliographyLoading(false);
    }
  }, [loadBibliography, resource?.id]);

  const unlinkBibliographySource = useCallback(
    async (sourceId: string) => {
      if (!resource) return;
      setBibliographyLoading(true);
      setBibliographyError(null);
      try {
        await invoke("unlink_bibliography_source_cmd", {
          resourceId: resource.id,
          sourceId,
        });
        await loadBibliography();
      } catch (error) {
        console.error("Failed to unlink bibliography source:", error);
        setBibliographyError(String(error));
      } finally {
        setBibliographyLoading(false);
      }
    },
    [loadBibliography, resource?.id],
  );

  const handleMetadataChange = useCallback(
    (newMetadata: any) => {
      if (activeEditorTab?.isDtexFile && activeEditorTab.id) {
        updateTabMetadata(activeEditorTab.id, newMetadata);
        markMetadataDirty(activeEditorTab.id, true);
      }
    },
    [
      activeEditorTab?.id,
      activeEditorTab?.isDtexFile,
      updateTabMetadata,
      markMetadataDirty,
    ],
  );

  const handleWizardFinish = async (code: string) => {
    setWizardOpen(false);
    // Find a valid collection
    const collections = useDatabaseStore.getState().loadedCollections;
    if (collections.length === 0) {
      alert("Please select a collection first.");
      return;
    }
    const collection = collections[0];

    try {
      const selectedPath = await import("@tauri-apps/plugin-dialog").then(
        ({ save }) =>
          save({
            defaultPath: "Untitled.tex",
            filters: [
              {
                name: "TeX Document",
                extensions: ["tex"],
              },
            ],
          }),
      );

      if (selectedPath) {
        await createResource(selectedPath, collection, code);
      }
    } catch (err) {
      console.error("Failed to create file", err);
    }
  };

  if (isWizardOpen) {
    return (
      <Stack h="100%" gap={0}>
        <PanelHeader
          icon={faMagic}
          title="Preamble Wizard"
          actions={
            <ToolbarButton
              label="Close"
              icon={faTimes}
              onClick={() => setWizardOpen(false)}
            />
          }
        />
        <ScrollArea style={{ flex: 1 }}>
          <Suspense fallback={<LoadingState message={t("common.loading")} />}>
            <PreambleWizard onInsert={handleWizardFinish} />
          </Suspense>
        </ScrollArea>
      </Stack>
    );
  }

  // const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrl: string | null = null; // Placeholder for future preview functionality

  const effectivePdfUrl = mainEditorOwnsPdf
    ? mainEditorPdfUrl
    : previewUrl || pdfUrl || (!resource ? mainEditorPdfUrl : null);
  const effectivePdfPath = mainEditorOwnsPdf
    ? mainEditorPdfPath
    : expectedLocalPdfPath || (!resource ? mainEditorPdfPath : null);
  const effectivePdfLoading = mainEditorOwnsPdf || !resource
    ? Boolean(mainEditorPdfLoading)
    : pdfLoading;
  const filename = resource
    ? resource.title || resource.path.split(/[/\\]/).pop() || "Untitled"
    : "PDF Preview";

  return (
    <>
      <Stack h="100%" gap={0}>
        <PanelHeader icon={faInfoCircle} title={filename} />

        <Tabs
          value={activeInspectorTab}
          onChange={setActiveInspectorTab}
          keepMounted={false}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--mantine-color-body)",
          }}
        >
          <Tabs.List>
            <Tabs.Tab
              value="preview"
              leftSection={<FontAwesomeIcon icon={faFilePdf} />}
            >
              PDF
            </Tabs.Tab>
            {/* Metadata tab: show for database resources OR .dtex files */}
            {(resource ||
              (activeEditorTab?.isDtexFile &&
                activeEditorTab?.dtexMetadata)) && (
              <>
                <Tabs.Tab
                  value="metadata"
                  leftSection={<FontAwesomeIcon icon={faInfoCircle} />}
                >
                  {t("database.tabs.metadata")}
                </Tabs.Tab>
                {resource && (
                  <Tabs.Tab
                    value="bibliography"
                    leftSection={<FontAwesomeIcon icon={faBook} />}
                  >
                    {t("database.tabs.bibliography")}
                  </Tabs.Tab>
                )}
              </>
            )}
            {/* Code tab - only show in Insert Mode or for tex files */}
            {resource && insertMode && resource.path.endsWith(".tex") && (
              <Tabs.Tab
                value="code"
                leftSection={<FontAwesomeIcon icon={faCode} />}
              >
                Code
              </Tabs.Tab>
            )}
          </Tabs.List>

          {/* Preview Tab - PDF */}
          <Tabs.Panel
            value="preview"
            keepMounted
            style={{ flex: 1, position: "relative" }}
          >
            <Box
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              }}
            >
              {effectivePdfUrl ? (
                <PdfViewerContainer
                  pdfPath={effectivePdfPath}
                  pdfUrl={effectivePdfUrl}
                  isVisible={activeInspectorTab === "preview"}
                  syncTexCoords={syncTexCoords}
                  onSyncTexInverse={onSyncTexInverse}
                />
              ) : effectivePdfLoading ? (
                <LoadingState message={t("common.loading")} />
              ) : (
                <EmptyState
                  message={pdfError || t("database.inspector.noPdf")}
                />
              )}
            </Box>
          </Tabs.Panel>

          {/* Metadata Tab - show for either database resource OR .dtex file */}
          {hasMetadataTab && shouldMountMetadata && (
            <Tabs.Panel
              value="metadata"
              keepMounted
              style={{ flex: 1, position: "relative" }}
            >
              <ScrollArea
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <Stack p="md" gap="md">
                  {/* Header info - show for .dtex files */}
                  {activeEditorTab?.isDtexFile &&
                    activeEditorTab?.dtexMetadata && (
                      <Text size="xs" c="dimmed">
                        DTEX File - Changes save to file and database
                      </Text>
                    )}

                  {/* Title and File Type row */}
                  <Group grow>
                    <TextInput
                      readOnly
                      label={t("database.inspector.fields.title")}
                      key={resource?.id || activeEditorTab?.id}
                      defaultValue={
                        resource?.title ||
                        activeEditorTab?.dtexMetadata?.id ||
                        ""
                      }
                      onChange={() => {
                        // TODO: Update title
                      }}
                    />
                    <Select
                      label={t("database.inspector.fields.fileType")}
                      data={RESOURCE_KINDS}
                      value={
                        resource?.kind ||
                        activeEditorTab?.dtexMetadata?.fileType ||
                        "file"
                      }
                      onChange={(val) => {
                        if (val && resource) {
                          updateResourceKind(resource.id, val);
                        }
                        // TODO: For .dtex files, update fileType in dtexMetadata
                      }}
                      allowDeselect={false}
                    />
                  </Group>

                  {/* Preamble Selector - Only for File Fragments, Tables, and Figures (not for Full Documents which have their own preamble) */}
                  {(resource?.kind === "file" ||
                    resource?.kind === "table" ||
                    resource?.kind === "figure" ||
                    activeEditorTab?.dtexMetadata?.fileType === "file" ||
                    activeEditorTab?.dtexMetadata?.fileType === "table" ||
                    activeEditorTab?.dtexMetadata?.fileType === "figure") && (
                    <Select
                      label="Fragment Preamble"
                      placeholder="Select a preamble for compilation..."
                      data={[
                        { value: "", label: "None (Full Document)" },
                        ...BUILTIN_PREAMBLES.map((p) => ({
                          value: p.id,
                          label: p.label,
                        })),
                      ]}
                      value={resource?.metadata?.preamble || ""}
                      onChange={async (val) => {
                        if (resource) {
                          const newMetadata = { ...resource.metadata };
                          if (val) {
                            newMetadata.preamble = val;
                          } else {
                            delete newMetadata.preamble;
                          }
                          await useDatabaseStore
                            .getState()
                            .updateResourceMetadata(resource.id, newMetadata);
                        }
                      }}
                      clearable
                      searchable
                    />
                  )}

                  {/* ID, Collection, Created row - only for database resources */}
                  {resource && (
                    <Group grow>
                      <TextInput
                        label={t("database.inspector.fields.id")}
                        value={resource.id}
                        readOnly
                        variant="filled"
                        c="dimmed"
                      />
                      <TextInput
                        label={t("database.inspector.fields.collection")}
                        value={resource.collection}
                        readOnly
                        variant="filled"
                        c="dimmed"
                      />
                      <TextInput
                        label={t("database.inspector.fields.created")}
                        value={resource.created_at || "-"}
                        readOnly
                        variant="filled"
                        c="dimmed"
                      />
                    </Group>
                  )}

                  {/* Dynamic Typed Metadata Editor - works for both database and .dtex */}
                  <Suspense
                    fallback={<LoadingState message={t("common.loading")} />}
                  >
                    <DynamicMetadataEditor
                      key={`${resource?.id || activeEditorTab?.id || ""}:${
                        resource?.kind ||
                        activeEditorTab?.dtexMetadata?.fileType ||
                        "file"
                      }`}
                      resourceId={resource?.id || activeEditorTab?.id || ""}
                      resourceType={
                        (resource?.kind ||
                          activeEditorTab?.dtexMetadata?.fileType ||
                          "file") as any
                      }
                      initialMetadata={
                        activeEditorTab?.isDtexFile
                          ? activeEditorTab.dtexMetadata
                          : undefined
                      }
                      onMetadataChange={handleMetadataChange}
                      skipDatabaseSave={
                        activeEditorTab?.isDtexFile && !resource
                      }
                    />
                  </Suspense>
                </Stack>
              </ScrollArea>
            </Tabs.Panel>
          )}

          {/* Bibliography Tab */}
          {resource && (
            <Tabs.Panel
              value="bibliography"
              style={{ flex: 1, position: "relative" }}
            >
              <ScrollArea
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <Stack p="md" gap="sm">
                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <Text fw={600} size="sm">
                        {resource.kind === "bibliography"
                          ? t("database.inspector.bibliography.entries")
                          : canScanResourceCitations
                            ? t("database.inspector.bibliography.citations")
                          : t("database.tabs.bibliography")}
                      </Text>
                      {resource.kind === "bibliography" &&
                        bibliographyImport && (
                          <Badge
                            size="sm"
                            variant="light"
                            color={
                              bibliographyImport.source.parse_status === "ok"
                                ? "green"
                                : bibliographyImport.source.parse_status ===
                                    "warning"
                                  ? "yellow"
                                  : "red"
                            }
                          >
                            {bibliographyImport.source.parse_status}
                          </Badge>
                        )}
                      {resource.kind === "bibliography" && (
                        <Badge size="sm" variant="light" color="blue">
                          {bibliographyEntries.length}
                        </Badge>
                      )}
                      {canScanResourceCitations && citationScan && (
                        <>
                          <Badge size="sm" variant="light" color="blue">
                            {citationScan.total}
                          </Badge>
                          {citationScan.missing > 0 && (
                            <Badge size="sm" variant="light" color="red">
                              {citationScan.missing}{" "}
                              {t(
                                "database.inspector.bibliography.missing",
                              )}
                            </Badge>
                          )}
                          {citationScan.ambiguous > 0 && (
                            <Badge size="sm" variant="light" color="yellow">
                              {citationScan.ambiguous}{" "}
                              {t(
                                "database.inspector.bibliography.ambiguous",
                              )}
                            </Badge>
                          )}
                        </>
                      )}
                    </Group>

                    {(resource.kind === "bibliography" ||
                      canScanResourceCitations) && (
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<FontAwesomeIcon icon={faSyncAlt} />}
                        loading={bibliographyLoading}
                        onClick={() => void loadBibliography()}
                      >
                        {t("database.inspector.bibliography.refresh")}
                      </Button>
                    )}
                  </Group>

                  {(resource.kind === "bibliography" ||
                    canScanResourceCitations) && (
                    <Stack gap="xs">
                      <Group gap="xs" align="end">
                        <TextInput
                          size="xs"
                          style={{ flex: 1 }}
                          placeholder={t(
                            "database.inspector.bibliography.search",
                            {
                              defaultValue:
                                "Filter by key, title, author, DOI, tag...",
                            },
                          )}
                          value={bibliographyQuery}
                          onChange={(event) =>
                            setBibliographyQuery(event.currentTarget.value)
                          }
                        />
                        {canScanResourceCitations && (
                          <Select
                            size="xs"
                            w={140}
                            data={BIBLIOGRAPHY_STATUS_FILTERS.map(
                              (filter) => ({
                                value: filter.value,
                                label: t(
                                  `database.inspector.bibliography.statusFilters.${filter.value}`,
                                  { defaultValue: filter.label },
                                ),
                              }),
                            )}
                            value={bibliographyStatusFilter}
                            onChange={(value) =>
                              setBibliographyStatusFilter(value || "all")
                            }
                          />
                        )}
                      </Group>

                      <Group gap="xs">
                        {resource.kind === "bibliography" ? (
                          <>
                            <Badge size="sm" variant="light" color="blue">
                              {t(
                                "database.inspector.bibliography.filteredEntries",
                                {
                                  shown: filteredBibliographyEntries.length,
                                  total: bibliographyEntries.length,
                                  defaultValue:
                                    "{{shown}} / {{total}} entries",
                                },
                              )}
                            </Badge>
                            {bibliographyImport && (
                              <Badge size="sm" variant="light" color="gray">
                                SHA {bibliographyImport.source.content_hash.slice(0, 8)}
                              </Badge>
                            )}
                          </>
                        ) : citationScan ? (
                          <>
                            <Badge size="sm" variant="light" color="green">
                              {citationScan.resolved}{" "}
                              {t(
                                "database.inspector.bibliography.resolved",
                              )}
                            </Badge>
                            <Badge
                              size="sm"
                              variant="light"
                              color={citationScan.missing > 0 ? "red" : "gray"}
                            >
                              {citationScan.missing}{" "}
                              {t("database.inspector.bibliography.missing")}
                            </Badge>
                            <Badge
                              size="sm"
                              variant="light"
                              color={
                                citationScan.ambiguous > 0 ? "yellow" : "gray"
                              }
                            >
                              {citationScan.ambiguous}{" "}
                              {t("database.inspector.bibliography.ambiguous")}
                            </Badge>
                          </>
                        ) : null}
                      </Group>
                    </Stack>
                  )}

                  {resource.kind !== "bibliography" &&
                  !canScanResourceCitations ? (
                    <Text c="dimmed" size="sm">
                      {t("database.inspector.bibMessage")}
                    </Text>
                  ) : resource.kind !== "bibliography" ? (
                    <>
                      <Stack gap="xs">
                        <Group align="end" gap="xs">
                          <Select
                            size="xs"
                            style={{ flex: 1 }}
                            label={t(
                              "database.inspector.bibliography.linkSource",
                            )}
                            placeholder={t(
                              "database.inspector.bibliography.sourcePlaceholder",
                            )}
                            data={bibliographySourceOptions}
                            value={sourceToLink}
                            onChange={setSourceToLink}
                            searchable
                            disabled={
                              bibliographyLoading ||
                              bibliographySourceOptions.length === 0
                            }
                          />
                          <Button
                            size="xs"
                            variant="light"
                            disabled={!sourceToLink || bibliographyLoading}
                            onClick={() =>
                              void linkSelectedBibliographySource()
                            }
                          >
                            {t("database.inspector.bibliography.link")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            disabled={bibliographyLoading}
                            onClick={() =>
                              void autoLinkDeclaredBibliographySources()
                            }
                          >
                            {t("database.inspector.bibliography.autoLink")}
                          </Button>
                        </Group>

                        <Group gap="xs">
                          <Text size="xs" c="dimmed">
                            {t(
                              "database.inspector.bibliography.linkedSources",
                            )}
                          </Text>
                          {linkedBibliographySources.length === 0 ? (
                            <Badge size="xs" variant="light" color="gray">
                              {t(
                                "database.inspector.bibliography.globalFallback",
                              )}
                            </Badge>
                          ) : (
                            linkedBibliographySources.map((source) => (
                              <Badge
                                key={source.id}
                                size="sm"
                                variant="light"
                                color="blue"
                                rightSection={
                                  <Box
                                    component="button"
                                    type="button"
                                    onClick={() =>
                                      void unlinkBibliographySource(source.id)
                                    }
                                    style={{
                                      border: 0,
                                      background: "transparent",
                                      color: "inherit",
                                      cursor: "pointer",
                                      padding: 0,
                                      lineHeight: 1,
                                    }}
                                    aria-label={t(
                                      "database.inspector.bibliography.unlink",
                                    )}
                                  >
                                    ×
                                  </Box>
                                }
                              >
                                {source.title ||
                                  source.path.split(/[/\\]/).pop() ||
                                  source.path}
                              </Badge>
                            ))
                          )}
                        </Group>

                        {autoLinkResult && (
                          <Alert
                            color={
                              autoLinkResult.unresolved_count > 0 ||
                              autoLinkResult.ambiguous_count > 0
                                ? "yellow"
                                : "green"
                            }
                            variant="light"
                          >
                            <Text size="xs">
                              {t(
                                "database.inspector.bibliography.autoLinkResult",
                                {
                                  linked: autoLinkResult.linked_count,
                                  unresolved:
                                    autoLinkResult.unresolved_count,
                                  ambiguous: autoLinkResult.ambiguous_count,
                                },
                              )}
                            </Text>
                          </Alert>
                        )}

                        {bibliographyDeclarations.length > 0 && (
                          <Stack gap={4}>
                            <Text size="xs" fw={700} c="dimmed">
                              {t(
                                "database.inspector.bibliography.declarations",
                                { defaultValue: "Detected declarations" },
                              )}
                            </Text>
                            <Group gap={6}>
                              {bibliographyDeclarations.map(
                                (declaration, index) => (
                                  <Badge
                                    key={`${declaration.byte_start}-${index}`}
                                    size="sm"
                                    variant="light"
                                    color={
                                      declaration.matches.length === 1
                                        ? "green"
                                        : declaration.matches.length > 1
                                          ? "yellow"
                                          : "gray"
                                    }
                                  >
                                    {`\\${declaration.command_name}{${declaration.requested}}`}
                                    {declaration.matches.length > 0
                                      ? ` · ${declaration.matches.length}`
                                      : ""}
                                  </Badge>
                                ),
                              )}
                            </Group>
                          </Stack>
                        )}
                      </Stack>

                      {bibliographyLoading && !citationScan ? (
                        <LoadingState
                          message={t(
                            "database.inspector.bibliography.scanning",
                          )}
                        />
                      ) : bibliographyError ? (
                        <Alert color="red" variant="light">
                          <Text size="sm">{bibliographyError}</Text>
                        </Alert>
                      ) : !citationScan || citationScan.total === 0 ? (
                        <EmptyState
                          message={t(
                            "database.inspector.bibliography.noCitations",
                          )}
                        />
                      ) : filteredCitationOccurrences.length === 0 ? (
                        <EmptyState
                          message={t(
                            "database.inspector.bibliography.noFilteredCitations",
                            {
                              defaultValue:
                                "No citations match the current filters.",
                            },
                          )}
                        />
                      ) : (
                        <Stack gap="sm">
                          <Table
                            striped
                            highlightOnHover
                            withColumnBorders={false}
                            verticalSpacing="xs"
                          >
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>
                                  {t(
                                    "database.inspector.bibliography.command",
                                  )}
                                </Table.Th>
                                <Table.Th>
                                  {t("database.inspector.bibliography.key")}
                                </Table.Th>
                                <Table.Th>
                                  {t(
                                    "database.inspector.bibliography.status",
                                  )}
                                </Table.Th>
                                <Table.Th>
                                  {t("database.inspector.bibliography.title")}
                                </Table.Th>
                                <Table.Th>
                                  {t("database.inspector.bibliography.year")}
                                </Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {filteredCitationOccurrences.map(
                                (occurrence, index) => (
                                  <Table.Tr
                                    key={`${occurrence.byte_start}-${index}`}
                                    onClick={() => setSelectedCitationIndex(index)}
                                    style={{ cursor: "pointer" }}
                                  >
                                  <Table.Td>
                                    <Text
                                      component="span"
                                      ff="monospace"
                                      size="xs"
                                    >
                                      {`\\${occurrence.command_name}`}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text
                                      component="span"
                                      ff="monospace"
                                      size="xs"
                                      fw={600}
                                    >
                                      {occurrence.citation_key}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Badge
                                      size="xs"
                                      variant="light"
                                      color={
                                        occurrence.scan_status === "resolved"
                                          ? "green"
                                          : occurrence.scan_status ===
                                              "ambiguous"
                                            ? "yellow"
                                            : "red"
                                      }
                                    >
                                      {t(
                                        `database.inspector.bibliography.${occurrence.scan_status}`,
                                      )}
                                    </Badge>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="xs" lineClamp={2}>
                                      {occurrence.title || "-"}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="xs">
                                      {occurrence.year || "-"}
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                                ),
                              )}
                            </Table.Tbody>
                          </Table>
                          {selectedCitationOccurrence && (
                            <Box
                              p="xs"
                              style={{
                                border:
                                  "1px solid var(--mantine-color-default-border)",
                                borderRadius: 8,
                              }}
                            >
                              <Group justify="space-between" gap="xs">
                                <Text size="xs" fw={700}>
                                  {selectedCitationOccurrence.citation_key}
                                </Text>
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color={
                                    selectedCitationOccurrence.scan_status ===
                                    "resolved"
                                      ? "green"
                                      : selectedCitationOccurrence.scan_status ===
                                          "ambiguous"
                                        ? "yellow"
                                        : "red"
                                  }
                                >
                                  {t(
                                    `database.inspector.bibliography.${selectedCitationOccurrence.scan_status}`,
                                  )}
                                </Badge>
                              </Group>
                              <Text size="xs" c="dimmed">
                                {`\\${selectedCitationOccurrence.command_name}`} · bytes{" "}
                                {selectedCitationOccurrence.byte_start}–
                                {selectedCitationOccurrence.byte_end}
                              </Text>
                              <Text size="sm" mt={4}>
                                {selectedCitationOccurrence.title || "—"}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {[
                                  selectedCitationOccurrence.entry_type,
                                  selectedCitationOccurrence.year,
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </Text>
                            </Box>
                          )}
                        </Stack>
                      )}
                    </>
                  ) : bibliographyLoading &&
                    bibliographyEntries.length === 0 ? (
                    <LoadingState
                      message={t(
                        "database.inspector.bibliography.loading",
                      )}
                    />
                  ) : bibliographyError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{bibliographyError}</Text>
                    </Alert>
                  ) : (
                    <>
                      {bibliographyImport?.diagnostics.length ? (
                        <Alert color="yellow" variant="light">
                          <Stack gap={4}>
                            {bibliographyImport.diagnostics
                              .slice(0, 5)
                              .map((diagnostic, index) => (
                                <Text
                                  key={`${diagnostic.byte_start}-${index}`}
                                  size="xs"
                                >
                                  {diagnostic.message}
                                </Text>
                              ))}
                            {bibliographyImport.diagnostics.length > 5 && (
                              <Text size="xs" c="dimmed">
                                +
                                {bibliographyImport.diagnostics.length - 5}{" "}
                                more
                              </Text>
                            )}
                          </Stack>
                        </Alert>
                      ) : null}

                      {bibliographyEntries.length === 0 ? (
                        <EmptyState
                          message={t(
                            "database.inspector.bibliography.empty",
                          )}
                        />
                      ) : filteredBibliographyEntries.length === 0 ? (
                        <EmptyState
                          message={t(
                            "database.inspector.bibliography.noFilteredEntries",
                            {
                              defaultValue:
                                "No bibliography entries match the current filters.",
                            },
                          )}
                        />
                      ) : (
                        <Stack gap="sm">
                          <Table
                            striped
                            highlightOnHover
                            withColumnBorders={false}
                            verticalSpacing="xs"
                          >
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>
                                  {t(
                                    "database.inspector.bibliography.key",
                                  )}
                                </Table.Th>
                                <Table.Th>
                                  {t(
                                    "database.inspector.bibliography.type",
                                  )}
                                </Table.Th>
                                <Table.Th>
                                  {t(
                                    "database.inspector.bibliography.title",
                                  )}
                                </Table.Th>
                                <Table.Th>
                                  {t(
                                    "database.inspector.bibliography.year",
                                  )}
                                </Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {filteredBibliographyEntries.map((entry) => (
                                <Table.Tr
                                  key={entry.id}
                                  onClick={() =>
                                    setSelectedBibliographyEntryId(entry.id)
                                  }
                                  style={{ cursor: "pointer" }}
                                >
                                  <Table.Td>
                                    <Text
                                      component="span"
                                      ff="monospace"
                                      size="xs"
                                      fw={600}
                                    >
                                      {entry.citation_key}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Badge
                                      size="xs"
                                      variant="outline"
                                      color="gray"
                                    >
                                      {entry.entry_type}
                                    </Badge>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="xs" lineClamp={2}>
                                      {entry.title ||
                                        entry.fields?.booktitle ||
                                        "-"}
                                    </Text>
                                    {entry.doi && (
                                      <Text size="xs" c="dimmed">
                                        DOI: {entry.doi}
                                      </Text>
                                    )}
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="xs">
                                      {entry.year || entry.date || "-"}
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>

                          {selectedBibliographyEntry && (
                            <Box
                              p="xs"
                              style={{
                                border:
                                  "1px solid var(--mantine-color-default-border)",
                                borderRadius: 8,
                              }}
                            >
                              <Group justify="space-between" align="start">
                                <Stack gap={2} style={{ flex: 1 }}>
                                  <Text size="xs" fw={700} ff="monospace">
                                    {selectedBibliographyEntry.citation_key}
                                  </Text>
                                  <Text size="sm" fw={600} lineClamp={2}>
                                    {selectedBibliographyEntry.title ||
                                      selectedBibliographyEntry.fields
                                        ?.booktitle ||
                                      "—"}
                                  </Text>
                                </Stack>
                                <Badge size="xs" variant="outline" color="gray">
                                  @{selectedBibliographyEntry.entry_type}
                                </Badge>
                              </Group>
                              <Divider my="xs" />
                              <Stack gap={4}>
                                {[
                                  [
                                    t(
                                      "database.inspector.bibliography.authors",
                                      { defaultValue: "Authors" },
                                    ),
                                    selectedBibliographyEntry.fields?.author,
                                  ],
                                  [
                                    t(
                                      "database.inspector.bibliography.publisher",
                                      { defaultValue: "Publisher" },
                                    ),
                                    selectedBibliographyEntry.fields?.publisher,
                                  ],
                                  [
                                    "DOI",
                                    selectedBibliographyEntry.doi ||
                                      selectedBibliographyEntry.fields?.doi,
                                  ],
                                  [
                                    "URL",
                                    selectedBibliographyEntry.url ||
                                      selectedBibliographyEntry.fields?.url,
                                  ],
                                ]
                                  .filter(([, value]) => Boolean(value))
                                  .map(([label, value]) => (
                                    <Group
                                      key={String(label)}
                                      gap="xs"
                                      align="start"
                                      wrap="nowrap"
                                    >
                                      <Text
                                        size="xs"
                                        c="dimmed"
                                        style={{ minWidth: 64 }}
                                      >
                                        {label}
                                      </Text>
                                      <Text size="xs" lineClamp={2}>
                                        {String(value)}
                                      </Text>
                                    </Group>
                                  ))}
                                {(selectedBibliographyEntry.tags || [])
                                  .length > 0 && (
                                  <Group gap={4}>
                                    {selectedBibliographyEntry.tags?.map(
                                      (tag) => (
                                        <Badge
                                          key={tag}
                                          size="xs"
                                          variant="light"
                                          color="teal"
                                        >
                                          {tag}
                                        </Badge>
                                      ),
                                    )}
                                  </Group>
                                )}
                              </Stack>
                            </Box>
                          )}
                        </Stack>
                      )}
                    </>
                  )}
                </Stack>
              </ScrollArea>
            </Tabs.Panel>
          )}

          {/* Code Tab - Read-only Monaco Editor */}
          {hasCodeTab && resource && (
            <Tabs.Panel value="code" style={{ flex: 1, position: "relative" }}>
              <Box
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Insert button header */}
                {insertMode && canInsert && onInsertFragment && (
                  <Group
                    p="xs"
                    style={{
                      borderBottom:
                        "1px solid var(--mantine-color-default-border)",
                      backgroundColor:
                        "color-mix(in srgb, var(--app-accent-color), transparent 90%)",
                    }}
                  >
                    <Text size="xs" fw={600} c="blue">
                      INSERT MODE
                    </Text>
                    <ToolbarButton
                      label="Insert at Cursor"
                      icon={faPlus}
                      onClick={() => {
                        if (codeContent) {
                          const snippet =
                            `% Inserted from: ${resource.title || resource.path}\n` +
                            codeContent;
                          onInsertFragment(snippet);
                        }
                      }}
                    />
                  </Group>
                )}

                {codeLoading ? (
                  <LoadingState message="Loading code..." />
                ) : codeContent ? (
                  <Suspense fallback={<LoadingState message="Loading editor..." />}>
                    <CodeEditor
                      value={codeContent}
                      language="my-latex"
                      beforeMount={configureLatexMonaco}
                      theme={editorTheme}
                      options={{
                        readOnly: true,
                        minimap: { enabled: true, scale: 2 },
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        fontSize: 12,
                        matchBrackets: "always",
                        bracketPairColorization: {
                          enabled: true,
                          independentColorPoolPerBracketType: true,
                        },
                        guides: {
                          bracketPairs: true,
                          bracketPairsHorizontal: "active",
                          highlightActiveBracketPair: true,
                        },
                      }}
                    />
                  </Suspense>
                ) : (
                  <EmptyState message="No code content available." />
                )}
              </Box>
            </Tabs.Panel>
          )}
        </Tabs>
      </Stack>
    </>
  );
};

export const ResourceInspector = memo(
  ResourceInspectorComponent,
  sameInspectorProps,
);

ResourceInspector.displayName = "ResourceInspector";
