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
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInfoCircle,
  faFilePdf,
  faBook,
  faTimes,
  faMagic,
  faPlus,
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

  // Do two separate lookups so an earlier activeResourceId match cannot win
  // over the resource that belongs to the active editor tab.
  const { resource, isActiveEditorResource } = useMemo(() => {
    const activeEditorPath = activeEditorTab?.id
      ? normalizePath(activeEditorTab.id)
      : null;
    const editorResource = activeEditorTab?.id
      ? allLoadedResources.find(
          (candidate) =>
            normalizePath(candidate.path) === activeEditorPath ||
            candidate.id === activeEditorTab.id,
        )
      : undefined;
    const fallbackResource = activeResourceId
      ? allLoadedResources.find(
          (candidate) => candidate.id === activeResourceId,
        )
      : undefined;

    return {
      resource: editorResource ?? fallbackResource,
      isActiveEditorResource: Boolean(editorResource),
    };
  }, [allLoadedResources, activeEditorTab?.id, activeResourceId]);
  const mainEditorOwnsPdf = Boolean(
    isActiveEditorResource &&
      activeEditorTab?.id &&
      PDF_SOURCE_EXTENSION.test(activeEditorTab.id),
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

  const hasMetadataTab = Boolean(
    resource ||
      (activeEditorTab?.isDtexFile && activeEditorTab.dtexMetadata),
  );
  const hasBibliographyTab = Boolean(
    resource && resource.kind !== "bibliography",
  );
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
                {/* Hide Bibliography tab for bibliography files as it's redundant */}
                {resource && resource.kind !== "bibliography" && (
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
                  pdfUrl={effectivePdfUrl}
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

          {/* Bibliography Tab - only when resource is selected and not bibliography type */}
          {resource && resource.kind !== "bibliography" && (
            <Tabs.Panel value="bibliography">
              <Box p="md">
                <Text c="dimmed" size="sm">
                  {t("database.inspector.bibMessage")}
                </Text>
              </Box>
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
                      theme="data-tex-dark"
                      options={{
                        readOnly: true,
                        minimap: { enabled: true, scale: 2 },
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        fontSize: 12,
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
