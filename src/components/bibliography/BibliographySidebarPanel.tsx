import React, { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faBookOpen,
  faBroom,
  faCirclePlus,
  faDatabase,
  faFileLines,
  faFilter,
  faMagnifyingGlass,
  faTags,
} from "@fortawesome/free-solid-svg-icons";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useTranslation } from "react-i18next";
import {
  useBibliographyWorkspaceStore,
  type BibliographySmartView,
} from "../../stores/bibliographyWorkspaceStore";

interface BibliographySidebarPanelProps {
  activeFilePath?: string;
  activeFileContent?: string;
  onOpenWorkspace: () => void;
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

interface BibliographyTagSummary {
  id: string;
  name: string;
  entry_count: number;
}

interface BibliographyContentImportResult {
  source: {
    id: string;
    resource_id: string;
    path: string;
    parse_status: string;
    content_hash: string;
  };
  entries_imported: number;
  skipped_invalid: number;
  diagnostics: Array<{ message: string }>;
}

const SMART_VIEW_ITEMS: Array<{
  value: BibliographySmartView;
  label: string;
  color: string;
}> = [
  { value: "all", label: "all", color: "blue" },
  { value: "missing_metadata", label: "missing", color: "yellow" },
  { value: "duplicate_candidates", label: "duplicates", color: "orange" },
  { value: "without_doi", label: "noDoi", color: "red" },
  { value: "with_doi", label: "withDoi", color: "teal" },
];

export const BibliographySidebarPanel: React.FC<BibliographySidebarPanelProps> =
  ({ activeFilePath, activeFileContent, onOpenWorkspace }) => {
    const { t } = useTranslation();
    const [sources, setSources] = useState<BibliographySourceOption[]>([]);
    const [tags, setTags] = useState<BibliographyTagSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const query = useBibliographyWorkspaceStore((state) => state.query);
    const setQuery = useBibliographyWorkspaceStore((state) => state.setQuery);
    const selectedSourceId = useBibliographyWorkspaceStore(
      (state) => state.selectedSourceId,
    );
    const toggleSelectedSourceId = useBibliographyWorkspaceStore(
      (state) => state.toggleSelectedSourceId,
    );
    const selectedTag = useBibliographyWorkspaceStore(
      (state) => state.selectedTag,
    );
    const setSelectedTag = useBibliographyWorkspaceStore(
      (state) => state.setSelectedTag,
    );
    const smartView = useBibliographyWorkspaceStore((state) => state.smartView);
    const setSmartView = useBibliographyWorkspaceStore(
      (state) => state.setSmartView,
    );
    const clearFilters = useBibliographyWorkspaceStore(
      (state) => state.clearFilters,
    );
    const requestRefresh = useBibliographyWorkspaceStore(
      (state) => state.requestRefresh,
    );

    const activeDocument = useMemo(
      () => summarizeDocumentBibliography(activeFilePath, activeFileContent),
      [activeFileContent, activeFilePath],
    );

    const loadPanelData = useCallback(async () => {
      setLoading(true);
      try {
        const [nextSources, nextTags] = await Promise.all([
          invoke<BibliographySourceOption[]>("list_all_bibliography_sources_cmd"),
          invoke<BibliographyTagSummary[]>("list_bibliography_tags_cmd"),
        ]);
        setSources(nextSources);
        setTags(nextTags);
      } catch (caught) {
        console.warn("Failed to load bibliography sidebar:", caught);
        setMessage(String(caught));
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      void loadPanelData();
    }, [loadPanelData]);

    const reparseAll = useCallback(async () => {
      setBusy(true);
      setMessage(null);
      try {
        const resourceIds = [
          ...new Set(
            sources
              .map((source) => source.resource_id)
              .filter((resourceId) => resourceId.trim().length > 0),
          ),
        ];
        const results = await Promise.allSettled(
          resourceIds.map((resourceId) =>
            invoke("reparse_bibliography_resource_cmd", { resourceId }),
          ),
        );
        const failed = results.filter((result) => result.status === "rejected");
        setMessage(
          failed.length
            ? `Reparsed ${resourceIds.length - failed.length}/${resourceIds.length} sources.`
            : `Reparsed ${resourceIds.length} sources.`,
        );
        requestRefresh();
        await loadPanelData();
      } catch (caught) {
        console.warn("Failed to reparse bibliography sources:", caught);
        setMessage(String(caught));
      } finally {
        setBusy(false);
      }
    }, [loadPanelData, requestRefresh, sources]);

    const importBibFile = useCallback(async () => {
      setBusy(true);
      setMessage(null);
      try {
        const selected = await open({
          multiple: false,
          filters: [{ name: "Bibliography", extensions: ["bib", "ris", "json"] }],
        });
        if (typeof selected !== "string") return;

        const content = await readTextFile(selected);
        const result = await invoke<BibliographyContentImportResult>(
          "import_bibliography_content_cmd",
          {
            request: {
              content,
              format: importFormatFromPath(selected),
              sourceLabel: fileNameFromPath(selected),
            },
          },
        );
        setMessage(
          `Imported ${result.entries_imported} entries${
            result.skipped_invalid ? `, skipped ${result.skipped_invalid}` : ""
          }.`,
        );
        requestRefresh();
        await loadPanelData();
      } catch (caught) {
        console.warn("Failed to import bibliography file:", caught);
        setMessage(String(caught));
      } finally {
        setBusy(false);
      }
    }, [loadPanelData, requestRefresh]);

    const totalEntries = sources.reduce(
      (total, source) => total + source.entry_count,
      0,
    );
    const topTags = tags.slice(0, 8);

    return (
      <Stack h="100%" gap="sm" p="sm" style={{ overflow: "hidden" }}>
        <Group justify="space-between" gap="xs">
          <Box style={{ minWidth: 0 }}>
            <Group gap={6}>
              <FontAwesomeIcon icon={faBookOpen} />
              <Text fw={700} size="sm">
                {t("sidebar.bibliography", { defaultValue: "Bibliography" })}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {sources.length}{" "}
              {t("sidebar.bibliographyPanel.sources", {
                defaultValue: "sources",
              })}{" "}
              · {totalEntries}{" "}
              {t("sidebar.bibliographyPanel.entries", {
                defaultValue: "entries",
              })}
            </Text>
          </Box>
          {loading && <Loader size="xs" />}
        </Group>

        <TextInput
          size="xs"
          leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} />}
          placeholder={t("sidebar.bibliographyPanel.searchPlaceholder", {
            defaultValue: "Search bibliography...",
          })}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />

        <Group gap={6}>
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<FontAwesomeIcon icon={faBookOpen} />}
            onClick={onOpenWorkspace}
          >
            {t("sidebar.bibliographyPanel.open", { defaultValue: "Open" })}
          </Button>
          <Button
            size="compact-xs"
            variant="light"
            color="blue"
            leftSection={<FontAwesomeIcon icon={faCirclePlus} />}
            loading={busy}
            onClick={() => void importBibFile()}
          >
            {t("sidebar.bibliographyPanel.import", {
              defaultValue: "Import",
            })}
          </Button>
          <Tooltip
            label={t("sidebar.bibliographyPanel.reparseAll", {
              defaultValue: "Reparse all tracked .bib sources",
            })}
          >
            <ActionIcon
              size="sm"
              variant="light"
              loading={busy}
              onClick={() => void reparseAll()}
            >
              <FontAwesomeIcon icon={faArrowsRotate} />
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={t("sidebar.bibliographyPanel.clearFilters", {
              defaultValue: "Clear bibliography filters",
            })}
          >
            <ActionIcon size="sm" variant="subtle" onClick={clearFilters}>
              <FontAwesomeIcon icon={faBroom} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {message && (
          <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>
            {message}
          </Text>
        )}

        <Divider />

        <Stack gap={6}>
          <Group gap={6}>
            <FontAwesomeIcon icon={faFilter} />
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              {t("sidebar.bibliographyPanel.smartViews", {
                defaultValue: "Smart views",
              })}
            </Text>
          </Group>
          <Group gap={6}>
            {SMART_VIEW_ITEMS.map((item) => (
              <Badge
                key={item.value}
                component="button"
                variant={smartView === item.value ? "filled" : "light"}
                color={item.color}
                style={{ cursor: "pointer", border: 0 }}
                onClick={() => setSmartView(item.value)}
              >
                {t(`sidebar.bibliographyPanel.smart.${item.label}`, {
                  defaultValue: item.label,
                })}
              </Badge>
            ))}
          </Group>
        </Stack>

        <Stack gap={6}>
          <Group gap={6}>
            <FontAwesomeIcon icon={faTags} />
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              {t("sidebar.bibliographyPanel.tags", {
                defaultValue: "Tags",
              })}
            </Text>
          </Group>
          {topTags.length === 0 ? (
            <Text size="xs" c="dimmed">
              {t("sidebar.bibliographyPanel.noTags", {
                defaultValue: "No tags yet.",
              })}
            </Text>
          ) : (
            <Group gap={6}>
              {topTags.map((tag) => (
                <Badge
                  key={tag.id}
                  component="button"
                  variant={selectedTag === tag.name ? "filled" : "light"}
                  color="teal"
                  style={{ cursor: "pointer", border: 0 }}
                  onClick={() =>
                    setSelectedTag(selectedTag === tag.name ? null : tag.name)
                  }
                >
                  {tag.name} · {tag.entry_count}
                </Badge>
              ))}
            </Group>
          )}
        </Stack>

        <Card withBorder p="xs" radius="md">
          <Group justify="space-between" gap="xs" mb={6}>
            <Group gap={6}>
              <FontAwesomeIcon icon={faFileLines} />
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                {t("sidebar.bibliographyPanel.currentDocument", {
                  defaultValue: "Current document",
                })}
              </Text>
            </Group>
            <Badge size="xs" variant="light" color="blue">
              {activeDocument.citationCount}
            </Badge>
          </Group>
          <Text size="sm" fw={600} truncate>
            {activeDocument.fileName ||
              t("sidebar.bibliographyPanel.noActiveDocument", {
                defaultValue: "No active document",
              })}
          </Text>
          <Text size="xs" c="dimmed">
            {activeDocument.declarations.length
              ? activeDocument.declarations.join(", ")
              : activeDocument.fileName
                ? t("sidebar.bibliographyPanel.noDeclarations", {
                    defaultValue: "No bibliography declarations detected.",
                  })
                : t("sidebar.bibliographyPanel.openTexContext", {
                    defaultValue:
                      "Open a LaTeX document to see citation context.",
                  })}
          </Text>
        </Card>

        <Divider />

        <Group gap={6}>
          <FontAwesomeIcon icon={faDatabase} />
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            {t("sidebar.bibliographyPanel.sourcesHeading", {
              defaultValue: "Sources",
            })}
          </Text>
        </Group>
        <ScrollArea type="auto" style={{ flex: 1, minHeight: 0 }}>
          <Stack gap={6}>
            {sources.length === 0 ? (
              <Text size="xs" c="dimmed">
                {t("sidebar.bibliographyPanel.noSources", {
                  defaultValue: "No parsed bibliography sources yet.",
                })}
              </Text>
            ) : (
              sources.map((source) => (
                <Card
                  key={source.id}
                  withBorder
                  p="xs"
                  radius="md"
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
                        {source.title || fileNameFromPath(source.path)}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {source.collection || shortPath(source.path)}
                      </Text>
                    </Box>
                    <Stack gap={3} align="flex-end">
                      <Badge size="xs" color={sourceStatusColor(source)}>
                        {source.entry_count}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {source.parse_status}
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    );
  };

function summarizeDocumentBibliography(
  activeFilePath?: string,
  activeFileContent?: string,
) {
  const fileName = activeFilePath ? fileNameFromPath(activeFilePath) : "";
  const content = activeFileContent || "";
  const citationCount =
    content.match(/\\(?:cite|citep|citet|parencite|textcite|autocite|footcite|supercite)\*?(?:\[[^\]]*\]){0,2}\{[^}]+\}/g)
      ?.length || 0;
  const declarations = [...content.matchAll(/\\(?:bibliography|addbibresource)(?:\[[^\]]*\])?\{([^}]+)\}/g)]
    .flatMap((match) => match[1].split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 4);

  return { fileName, citationCount, declarations };
}

function importFormatFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".ris")) return "ris";
  if (lower.endsWith(".json")) return "csl-json";
  return "bibtex";
}

function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

function shortPath(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join("/")}`;
}

function sourceStatusColor(source: BibliographySourceOption): string {
  if (source.parse_status === "ok") return "teal";
  if (source.parse_status === "warning") return "yellow";
  if (source.parse_status === "error") return "red";
  return "gray";
}
