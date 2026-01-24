import { useState, useEffect } from "react";
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
import { PreambleWizard } from "../wizards/PreambleWizard";
import { useDatabaseStore } from "../../stores/databaseStore";
import { DynamicMetadataEditor } from "../metadata/DynamicMetadataEditor";
import { useTypedMetadataStore } from "../../stores/typedMetadataStore";
import { useTabsStore } from "../../stores/useTabsStore";
import { readFile, exists } from "@tauri-apps/plugin-fs";
import { PdfViewerContainer } from "./PdfViewerContainer";
import { LoadingState, EmptyState, PanelHeader, ToolbarButton } from "../ui";
import Editor from "@monaco-editor/react";
import { faCode } from "@fortawesome/free-solid-svg-icons";
import "../../styles/pdf-viewer.css";

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
  syncTexCoords?: { page: number; x: number; y: number } | null;
  pdfRefreshTrigger?: number;
  onInsertFragment?: (code: string) => void;
  canInsert?: boolean;

  /** Active editor tab (for .dtex file metadata) */
  activeEditorTab?: import("../../stores/useTabsStore").AppTab;
}

export const ResourceInspector = ({
  mainEditorPdfUrl,
  syncTexCoords,
  pdfRefreshTrigger,
  onInsertFragment,
  canInsert,
  activeEditorTab,
}: ResourceInspectorProps) => {
  const { t } = useTranslation();
  const { allLoadedResources, activeResourceId } = useDatabaseStore();
  const { updateTabMetadata, markMetadataDirty } = useTabsStore();
  const resource = allLoadedResources.find((r) => r.id === activeResourceId);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Code Preview state
  const [codeContent, setCodeContent] = useState<string>("");
  const [codeLoading, setCodeLoading] = useState(false);
  const insertMode = useDatabaseStore((state) => state.insertMode);

  // Initialize typed metadata lookup data
  const loadAllLookupData = useTypedMetadataStore(
    (state) => state.loadAllLookupData,
  );

  useEffect(() => {
    loadAllLookupData();
  }, []);

  // Load PDF when resource changes
  useEffect(() => {
    let activeBlobUrl: string | null = null;

    const loadPdf = async () => {
      if (!resource) {
        setPdfUrl(null);
        setPdfError(null);
        return;
      }

      // Check if this is a tex file and look for corresponding PDF
      const isTexFile = resource.path.toLowerCase().endsWith(".tex");
      const pdfPath = isTexFile
        ? resource.path.replace(/\.tex$/i, ".pdf")
        : resource.path.toLowerCase().endsWith(".pdf")
          ? resource.path
          : null;

      if (!pdfPath) {
        setPdfUrl(null);
        setPdfError("No PDF preview available for this file type.");
        return;
      }

      setPdfLoading(true);
      setPdfError(null);

      try {
        const pdfExists = await exists(pdfPath);

        if (pdfExists) {
          const fileContents = await readFile(pdfPath);
          const blob = new Blob([fileContents], { type: "application/pdf" });
          activeBlobUrl = URL.createObjectURL(blob);
          setPdfUrl(activeBlobUrl);
        } else {
          setPdfUrl(null);
          setPdfError("No PDF available. Compile the document first.");
        }
      } catch (e) {
        console.warn("PDF load failed:", e);
        setPdfUrl(null);
        setPdfError(`Failed to load PDF: ${String(e)}`);
      } finally {
        setPdfLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
    };
  }, [resource?.path, pdfRefreshTrigger]);

  // Load Code when resource changes
  useEffect(() => {
    const loadCode = async () => {
      if (!resource) {
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
      try {
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(resource.path);
        setCodeContent(content);
      } catch (e) {
        console.warn("Code load failed:", e);
        setCodeContent(`% Failed to load: ${String(e)}`);
      } finally {
        setCodeLoading(false);
      }
    };

    loadCode();
  }, [resource?.path]);

  const { isWizardOpen, setWizardOpen, createResource } = useDatabaseStore();

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
          <PreambleWizard onInsert={handleWizardFinish} />
        </ScrollArea>
      </Stack>
    );
  }

  // const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrl: string | null = null; // Placeholder for future preview functionality

  const effectivePdfUrl = previewUrl || pdfUrl || mainEditorPdfUrl;
  const filename = resource
    ? resource.title || resource.path.split(/[/\\]/).pop() || "Untitled"
    : "PDF Preview";

  const { updateResourceKind } = useDatabaseStore();

  return (
    <>
      <Stack h="100%" gap={0}>
        <PanelHeader icon={faInfoCircle} title={filename} />

        <Tabs
          defaultValue="preview"
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
          <Tabs.Panel value="preview" style={{ flex: 1, position: "relative" }}>
            <Box
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
              }}
            >
              {pdfLoading ? (
                <LoadingState message={t("common.loading")} />
              ) : effectivePdfUrl ? (
                <PdfViewerContainer
                  key={effectivePdfUrl}
                  pdfUrl={effectivePdfUrl}
                  syncTexCoords={syncTexCoords}
                />
              ) : (
                <EmptyState
                  message={pdfError || t("database.inspector.noPdf")}
                />
              )}
            </Box>
          </Tabs.Panel>

          {/* Metadata Tab - show for either database resource OR .dtex file */}
          {(resource ||
            (activeEditorTab?.isDtexFile && activeEditorTab?.dtexMetadata)) && (
            <Tabs.Panel
              value="metadata"
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
                  <DynamicMetadataEditor
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
                    onMetadataChange={async (newMetadata) => {
                      // For .dtex files, also save to file
                      // For .dtex files, update store to trigger auto-save hook
                      if (activeEditorTab?.isDtexFile && activeEditorTab.id) {
                        updateTabMetadata(activeEditorTab.id, newMetadata);
                        markMetadataDirty(activeEditorTab.id, true);
                      }
                    }}
                    skipDatabaseSave={activeEditorTab?.isDtexFile && !resource}
                    onSave={() => {
                      // Metadata saved
                    }}
                  />
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
          {resource && (insertMode || resource.path.endsWith(".tex")) && (
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
                  <Editor
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
