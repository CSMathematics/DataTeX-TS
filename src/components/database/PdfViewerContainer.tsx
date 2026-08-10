import {
  useState,
  useCallback,
  memo,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import {
  Group,
  ActionIcon,
  Tooltip,
  Text,
  TextInput,
  Box,
  Select,
  Skeleton,
  ScrollArea,
  Divider,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBookmarks,
  IconChevronDown,
  IconChevronUp,
  IconDownload,
  IconPhoto,
  IconPrinter,
  IconRotateClockwise,
  IconSearch,
  IconX,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import { LoadingState, EmptyState } from "../ui";
import { debugLog } from "../../utils/debugLogger";

// Constants for virtual scrolling
const PAGE_BUFFER = 1; // Number of pages to pre-render above/below the active page
const PAGE_GAP = 20;
const PAGE_PADDING = 20;
const DEFAULT_PAGE_WIDTH = 595; // A4 width in points (approximate)
const DEFAULT_PAGE_HEIGHT = 842; // A4 height in points (approximate)
const PDFIUM_SUPERSAMPLING = 1.5;
const MIN_PDFIUM_DEVICE_PIXEL_RATIO = 1.5;
const MAX_PDFIUM_DEVICE_PIXEL_RATIO = 2;
const THUMBNAIL_WIDTH = 92;
const THUMBNAIL_BUFFER = 4;

interface PdfViewerContainerProps {
  pdfPath?: string | null;
  pdfUrl: string | null;
  isVisible?: boolean;
  onSyncTexInverse?: (page: number, x: number, y: number) => void;
  syncTexCoords?: {
    page: number;
    x: number;
    y: number;
    requestId?: number;
  } | null;
}

interface PageRange {
  start: number;
  end: number;
}

interface PdfOutlineItem {
  id: string;
  title: string;
  page: number | null;
  depth: number;
}

interface SearchMatch {
  page: number;
  matchCount: number;
}

type PdfSidePanel = "thumbnails" | "outline" | null;

interface PdfiumRendererStatus {
  available: boolean;
  message: string;
  libraryName: string;
  cacheDir?: string | null;
}

let pdfiumStatusRequest: Promise<PdfiumRendererStatus> | null = null;

const getPdfiumRendererStatus = () => {
  if (!pdfiumStatusRequest) {
    pdfiumStatusRequest = invoke<PdfiumRendererStatus>(
      "pdfium_renderer_status_cmd",
    ).catch((error) => {
      pdfiumStatusRequest = null;
      throw error;
    });
  }
  return pdfiumStatusRequest;
};

interface PdfiumPageSize {
  width: number;
  height: number;
}

interface PdfiumOpenDocumentResponse {
  docId: string;
  path: string;
  versionKey: string;
  numPages: number;
  pageSizes: PdfiumPageSize[];
  cacheDir: string;
  openTimeMs: number;
  cacheHit: boolean;
}

interface PdfiumRenderPageResponse {
  docId: string;
  pageNumber: number;
  imagePath: string;
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
  renderTimeMs: number;
  pageLoadTimeMs: number;
  rasterTimeMs: number;
  encodeTimeMs: number;
  cacheHit: boolean;
}

interface PdfiumPageTextResponse {
  docId: string;
  pageNumber: number;
  text: string;
}

interface PdfiumOutlineResponse {
  docId: string;
  items: PdfOutlineItem[];
}

interface PdfRenderMetric {
  backend: "pdfium";
  pageNumber: number;
  totalTimeMs: number;
  nativeTimeMs?: number;
  pageLoadTimeMs?: number;
  rasterTimeMs?: number;
  encodeTimeMs?: number;
  cacheHit?: boolean;
}

const EMPTY_PAGE_RANGE: PageRange = { start: 1, end: 0 };

const getPdfiumDevicePixelRatio = () => {
  const displayPixelRatio = window.devicePixelRatio || 1;
  return Math.min(
    MAX_PDFIUM_DEVICE_PIXEL_RATIO,
    Math.max(
      MIN_PDFIUM_DEVICE_PIXEL_RATIO,
      displayPixelRatio * PDFIUM_SUPERSAMPLING,
    ),
  );
};

const clampPage = (page: number, numPages: number) =>
  Math.max(1, Math.min(page, Math.max(1, numPages)));

const getViewportPageRange = (
  scrollTop: number,
  viewportHeight: number,
  rowStride: number,
  numPages: number,
): PageRange => {
  if (numPages <= 0 || rowStride <= 0) return EMPTY_PAGE_RANGE;

  const firstVisible = clampPage(
    Math.floor(Math.max(0, scrollTop - PAGE_PADDING) / rowStride) + 1,
    numPages,
  );
  const viewportEnd = Math.max(
    0,
    scrollTop + Math.max(1, viewportHeight) - PAGE_PADDING - 1,
  );
  const lastVisible = clampPage(
    Math.floor(viewportEnd / rowStride) + 1,
    numPages,
  );

  return {
    start: Math.max(1, firstVisible - PAGE_BUFFER),
    end: Math.min(numPages, Math.max(firstVisible, lastVisible) + PAGE_BUFFER),
  };
};

const getCurrentViewportPage = (
  scrollTop: number,
  viewportHeight: number,
  scrollHeight: number,
  rowStride: number,
  numPages: number,
) => {
  if (numPages <= 1 || scrollTop <= 1) return 1;
  if (scrollTop + viewportHeight >= scrollHeight - 1) return numPages;

  // Never look farther than half a row ahead. A viewport-relative-only probe
  // skips pages when several small pages fit at low zoom.
  const probeDistance = Math.min(viewportHeight * 0.4, rowStride * 0.5);
  return clampPage(
    Math.floor(
      Math.max(0, scrollTop + probeDistance - PAGE_PADDING) / rowStride,
    ) + 1,
    numPages,
  );
};

const waitForSearchIdle = () =>
  new Promise<void>((resolve) => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
    };
    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(() => resolve(), { timeout: 80 });
    } else {
      window.setTimeout(resolve, 0);
    }
  });

const countMatches = (text: string, query: string) => {
  if (!query) return 0;
  let count = 0;
  let index = text.indexOf(query);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(query, index + query.length);
  }
  return count;
};

// Memoized toolbar - completely stable, only updates via props
const PdfToolbar = memo(
  ({
    currentPage,
    numPages,
    scale,
    renderMetric,
    isSearchOpen,
    sidePanel,
    onPageChange,
    onZoomIn,
    onZoomOut,
    onScaleChange,
    onFitToWidth,
    onFitToPage,
    onRotateClockwise,
    onToggleSearch,
    onToggleSidePanel,
    onDownload,
    onPrint,
  }: {
    currentPage: number;
    numPages: number;
    scale: number;
    renderMetric: PdfRenderMetric | null;
    isSearchOpen: boolean;
    sidePanel: PdfSidePanel;
    onPageChange: (page: number) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onScaleChange: (scale: number) => void;
    onFitToWidth: () => void;
    onFitToPage: () => void;
    onRotateClockwise: () => void;
    onToggleSearch: () => void;
    onToggleSidePanel: (panel: Exclude<PdfSidePanel, null>) => void;
    onDownload: () => void;
    onPrint: () => void;
  }) => {
    const { t } = useTranslation();
    const handlePageInput = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          const value = parseInt((e.target as HTMLInputElement).value, 10);
          if (!isNaN(value) && value >= 1 && value <= numPages) {
            onPageChange(value);
          }
        }
      },
      [numPages, onPageChange],
    );

    return (
      <Group
        justify="space-between"
        gap={4}
        px={6}
        py={4}
        wrap="nowrap"
        className="pdf-viewer-toolbar"
        bg="var(--mantine-color-default)"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {/* Navigation */}
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Thumbnails">
            <ActionIcon
              variant={sidePanel === "thumbnails" ? "light" : "subtle"}
              color={sidePanel === "thumbnails" ? "blue" : "gray"}
              size="xs"
              onClick={() => onToggleSidePanel("thumbnails")}
            >
              <IconPhoto size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Outline">
            <ActionIcon
              variant={sidePanel === "outline" ? "light" : "subtle"}
              color={sidePanel === "outline" ? "blue" : "gray"}
              size="xs"
              onClick={() => onToggleSidePanel("outline")}
            >
              <IconBookmarks size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("pdfViewer.prevPage")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <IconArrowLeft size={16} />
            </ActionIcon>
          </Tooltip>
          <Group gap={4}>
            <TextInput
              size="xs"
              w={36}
              value={currentPage}
              onKeyDown={handlePageInput}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) onPageChange(val);
              }}
              styles={{ input: { textAlign: "center", padding: "0 4px" } }}
            />
            <Text size="xs" c="dimmed">
              / {numPages}
            </Text>
          </Group>
          <Tooltip label={t("pdfViewer.nextPage")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
              disabled={currentPage >= numPages}
            >
              <IconArrowRight size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Zoom Controls */}
        <Group gap={4} wrap="nowrap">
          <Tooltip label={t("pdfViewer.zoomOut")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={onZoomOut}
            >
              <IconZoomOut size={16} />
            </ActionIcon>
          </Tooltip>
          <Select
            size="xs"
            w={88}
            value={String(Math.round(scale * 100))}
            onChange={(val) => {
              if (val === "width") onFitToWidth();
              else if (val === "page") onFitToPage();
              else if (val === "actual") onScaleChange(1);
              else if (val) onScaleChange(parseInt(val, 10) / 100);
            }}
            data={[
              { value: "width", label: t("pdfViewer.fitWidth") },
              { value: "page", label: t("pdfViewer.fitPage") },
              { value: "actual", label: t("pdfViewer.actualSize") },
              { value: "50", label: "50%" },
              { value: "75", label: "75%" },
              { value: "100", label: "100%" },
              { value: "125", label: "125%" },
              { value: "150", label: "150%" },
              { value: "200", label: "200%" },
            ]}
            styles={{ input: { textAlign: "center" } }}
            allowDeselect={false}
          />
          <Tooltip label={t("pdfViewer.zoomIn")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={onZoomIn}
            >
              <IconZoomIn size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Rotate clockwise">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={onRotateClockwise}
            >
              <IconRotateClockwise size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Actions */}
        <Group gap={4} wrap="nowrap">
          {renderMetric && (
            <Tooltip
              label={`Page ${renderMetric.pageNumber}: ${renderMetric.totalTimeMs} ms displayed · ${renderMetric.nativeTimeMs ?? 0} ms native (${renderMetric.pageLoadTimeMs ?? 0} ms page load + ${renderMetric.rasterTimeMs ?? 0} ms raster + ${renderMetric.encodeTimeMs ?? 0} ms encode)${renderMetric.cacheHit ? " · disk cache hit" : ""}`}
            >
              <Text
                size="xs"
                c={renderMetric.cacheHit ? "teal" : "dimmed"}
                style={{
                  whiteSpace: "nowrap",
                  fontSize: 10,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                p{renderMetric.pageNumber} · {renderMetric.totalTimeMs}ms
                {renderMetric.cacheHit ? " · cache" : ""}
              </Text>
            </Tooltip>
          )}
          <Tooltip label="Search">
            <ActionIcon
              variant={isSearchOpen ? "light" : "subtle"}
              color={isSearchOpen ? "blue" : "gray"}
              size="xs"
              onClick={onToggleSearch}
            >
              <IconSearch size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("common.download")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={onDownload}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("common.print")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={onPrint}
            >
              <IconPrinter size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    );
  },
);

PdfToolbar.displayName = "PdfToolbar";

// Main container component
export const PdfViewerContainer = memo(
  ({
    pdfPath,
    pdfUrl,
    isVisible = true,
    onSyncTexInverse,
    syncTexCoords,
  }: PdfViewerContainerProps) => {
    const { t } = useTranslation();
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pageDimensions, setPageDimensions] = useState<{
      width: number;
      height: number;
    } | null>(null);
    const [visibleRange, setVisibleRange] =
      useState<PageRange>(EMPTY_PAGE_RANGE);
    const [visiblePageRenderEpoch, setVisiblePageRenderEpoch] = useState(0);
    const [rotation, setRotation] = useState(0);
    const [pdfiumStatus, setPdfiumStatus] =
      useState<PdfiumRendererStatus | null>(null);
    const [pdfiumDocument, setPdfiumDocument] =
      useState<PdfiumOpenDocumentResponse | null>(null);
    const [pdfiumOpenError, setPdfiumOpenError] = useState<string | null>(null);
    const [renderMetric, setRenderMetric] = useState<PdfRenderMetric | null>(
      null,
    );
    const [sidePanel, setSidePanel] = useState<PdfSidePanel>(null);
    const [isSearchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
    const [activeSearchIndex, setActiveSearchIndex] = useState(0);
    const [searchIndexingPage, setSearchIndexingPage] = useState<number | null>(
      null,
    );
    const [outlineItems, setOutlineItems] = useState<PdfOutlineItem[]>([]);
    const [outlineLoading, setOutlineLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const pageDimensionsRef = useRef<typeof pageDimensions>(null);
    const currentPageRef = useRef(currentPage);
    const numPagesRef = useRef(numPages);
    const scrollFrameRef = useRef<number | null>(null);
    const resizeFrameRef = useRef<number | null>(null);
    const rowStrideRef = useRef(DEFAULT_PAGE_HEIGHT + PAGE_GAP);
    const appliedRowStrideRef = useRef(DEFAULT_PAGE_HEIGHT + PAGE_GAP);
    const viewportHeightRef = useRef(0);
    const lastSyncCoordsRef = useRef<string | null>(null);
    const searchRunRef = useRef(0);
    const wasVisibleRef = useRef(isVisible);
    const visibilityRefreshFrameRef = useRef<number | null>(null);
    const documentIdentityRef = useRef({ url: pdfUrl, generation: 1 });
    const loadedDocumentGenerationRef = useRef(0);

    if (documentIdentityRef.current.url !== pdfUrl) {
      documentIdentityRef.current = {
        url: pdfUrl,
        generation: documentIdentityRef.current.generation + 1,
      };
    }
    const documentGeneration = documentIdentityRef.current.generation;

    // Performance: Debounced scale for smoother zoom
    const [debouncedScale] = useDebouncedValue(scale, 100);
    const [debouncedSearchQuery] = useDebouncedValue(searchQuery.trim(), 250);
    const isQuarterTurn = rotation % 180 !== 0;
    const canUsePdfium = Boolean(pdfPath && pdfiumStatus?.available === true);
    const isPdfiumActive = Boolean(canUsePdfium && pdfiumDocument);

    // Estimated page height for placeholders
    const estimatedPageHeight = useMemo(() => {
      const baseHeight = isQuarterTurn
        ? (pageDimensions?.width ?? DEFAULT_PAGE_WIDTH)
        : (pageDimensions?.height ?? DEFAULT_PAGE_HEIGHT);
      if (pageDimensions) {
        return baseHeight * debouncedScale;
      }
      return baseHeight * debouncedScale;
    }, [debouncedScale, isQuarterTurn, pageDimensions]);

    const estimatedPageWidth = useMemo(() => {
      const baseWidth = isQuarterTurn
        ? (pageDimensions?.height ?? DEFAULT_PAGE_HEIGHT)
        : (pageDimensions?.width ?? DEFAULT_PAGE_WIDTH);
      return baseWidth * debouncedScale;
    }, [debouncedScale, isQuarterTurn, pageDimensions]);

    const rowStride = estimatedPageHeight + PAGE_GAP;
    currentPageRef.current = currentPage;
    numPagesRef.current = numPages;
    rowStrideRef.current = rowStride;

    const applyViewport = useCallback(
      (
        container: HTMLDivElement,
        totalPages = numPagesRef.current,
        updateCurrentPage = true,
      ) => {
        const stride = rowStrideRef.current;
        if (totalPages <= 0 || stride <= 0) {
          setVisibleRange((previous) =>
            previous.end === 0 ? previous : EMPTY_PAGE_RANGE,
          );
          return;
        }

        const nextRange = getViewportPageRange(
          container.scrollTop,
          container.clientHeight,
          stride,
          totalPages,
        );
        setVisibleRange((previous) =>
          previous.start === nextRange.start && previous.end === nextRange.end
            ? previous
            : nextRange,
        );

        if (!updateCurrentPage) return;
        const nextPage = getCurrentViewportPage(
          container.scrollTop,
          container.clientHeight,
          container.scrollHeight,
          stride,
          totalPages,
        );
        if (nextPage !== currentPageRef.current) {
          currentPageRef.current = nextPage;
          setCurrentPage(nextPage);
        }
      },
      [],
    );

    // Reset page when URL changes
    useLayoutEffect(() => {
      setNumPages(0);
      setCurrentPage(1);
      setVisibleRange(EMPTY_PAGE_RANGE);
      setLoading(true);
      setError(null);
      setPageDimensions(null);
      pageDimensionsRef.current = null;
      currentPageRef.current = 1;
      numPagesRef.current = 0;
      loadedDocumentGenerationRef.current = 0;
      lastSyncCoordsRef.current = null;
      searchRunRef.current += 1;
      setSearchQuery("");
      setSearchMatches([]);
      setActiveSearchIndex(0);
      setSearchIndexingPage(null);
      setOutlineItems([]);
      setOutlineLoading(false);
      setRotation(0);
      setPdfiumDocument(null);
      setPdfiumOpenError(null);
      setRenderMetric(null);
      setVisiblePageRenderEpoch(0);
      if (containerRef.current) containerRef.current.scrollTop = 0;
    }, [documentGeneration, pdfUrl]);

    useEffect(() => {
      localStorage.removeItem("datatex-pdf-render-backend");
      let cancelled = false;
      void getPdfiumRendererStatus()
        .then((status) => {
          if (!cancelled) {
            setPdfiumStatus(status);
          }
        })
        .catch((statusError) => {
          if (!cancelled) {
            debugLog("error", "PDFIUM_UI", "renderer-status-failed", {
              error: statusError,
            });
            setPdfiumStatus({
              available: false,
              message: String(statusError),
              libraryName: "pdfium",
              cacheDir: null,
            });
          }
        });

      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (!pdfUrl) {
        setPdfiumDocument(null);
        setPdfiumOpenError(null);
        setLoading(false);
        return;
      }

      if (!pdfPath) {
        const pathError =
          "Native PDF renderer requires a local PDF path for this document.";
        setPdfiumDocument(null);
        setPdfiumOpenError(pathError);
        setError(pathError);
        setLoading(false);
        return;
      }

      if (!pdfiumStatus) {
        setPdfiumDocument(null);
        setPdfiumOpenError(null);
        setLoading(true);
        return;
      }

      if (!pdfiumStatus.available) {
        const statusError = `Rust PDF renderer unavailable: ${pdfiumStatus.message}`;
        setPdfiumDocument(null);
        setPdfiumOpenError(statusError);
        setError(statusError);
        setLoading(false);
        return;
      }

      let cancelled = false;
      let openedDocId: string | null = null;
      setOutlineItems([]);
      setOutlineLoading(false);
      setPdfiumOpenError(null);
      setPdfiumDocument(null);
      setLoading(true);

      void invoke<PdfiumOpenDocumentResponse>("pdfium_open_document_cmd", {
        path: pdfPath,
      })
        .then((document) => {
          if (cancelled) {
            void invoke("pdfium_close_document_cmd", {
              docId: document.docId,
            }).catch(() => {});
            return;
          }

          openedDocId = document.docId;
          setPdfiumDocument(document);
          const firstPage = document.pageSizes[0];
          if (firstPage) {
            const dimensions = {
              width: firstPage.width,
              height: firstPage.height,
            };
            pageDimensionsRef.current = dimensions;
            setPageDimensions(dimensions);
          }

          loadedDocumentGenerationRef.current = documentGeneration;
          numPagesRef.current = document.numPages;
          currentPageRef.current = clampPage(
            currentPageRef.current,
            document.numPages,
          );
          setNumPages(document.numPages);
          setCurrentPage(currentPageRef.current);
          setError(null);
          setLoading(false);

          const container = containerRef.current;
          if (container) applyViewport(container, document.numPages, false);

          setOutlineLoading(true);
          void invoke<PdfiumOutlineResponse>("pdfium_extract_outline_cmd", {
            docId: document.docId,
          })
            .then((outline) => {
              if (
                cancelled ||
                loadedDocumentGenerationRef.current !== documentGeneration
              ) {
                return;
              }
              setOutlineItems(outline.items);
            })
            .catch((outlineError) => {
              if (cancelled) return;
              debugLog("error", "PDFIUM_UI", "outline-failed", {
                path: pdfPath,
                docId: document.docId,
                generation: documentGeneration,
                error: outlineError,
              });
              setOutlineItems([]);
            })
            .finally(() => {
              if (
                !cancelled &&
                loadedDocumentGenerationRef.current === documentGeneration
              ) {
                setOutlineLoading(false);
              }
            });
        })
        .catch((openError) => {
          if (cancelled) return;
          debugLog("error", "PDFIUM_UI", "open-failed", {
            path: pdfPath,
            generation: documentGeneration,
            error: openError,
          });
          setPdfiumDocument(null);
          const errorMessage = String(openError);
          setPdfiumOpenError(errorMessage);
          setError(`Rust PDF renderer failed: ${errorMessage}`);
          setLoading(false);
        });

      return () => {
        cancelled = true;
        if (openedDocId) {
          void invoke("pdfium_close_document_cmd", {
            docId: openedDocId,
          }).catch(() => {});
        }
      };
    }, [
      applyViewport,
      documentGeneration,
      pdfPath,
      pdfUrl,
      pdfiumStatus,
    ]);

    useLayoutEffect(() => {
      const becameVisible = isVisible && !wasVisibleRef.current;
      wasVisibleRef.current = isVisible;
      if (!becameVisible) return;

      if (visibilityRefreshFrameRef.current !== null) {
        cancelAnimationFrame(visibilityRefreshFrameRef.current);
      }

      visibilityRefreshFrameRef.current = requestAnimationFrame(() => {
        visibilityRefreshFrameRef.current = requestAnimationFrame(() => {
          visibilityRefreshFrameRef.current = null;
          const container = containerRef.current;
          if (!container || container.clientHeight <= 0) return;

          applyViewport(container);
          setVisiblePageRenderEpoch((epoch) => epoch + 1);
        });
      });
    }, [applyViewport, isVisible]);

    // Preserve the document position at the viewport centre when zoom or the
    // measured base page size changes the virtual row stride.
    useLayoutEffect(() => {
      const container = containerRef.current;
      const previousStride = appliedRowStrideRef.current;
      appliedRowStrideRef.current = rowStride;
      if (
        !container ||
        numPagesRef.current === 0 ||
        previousStride <= 0 ||
        Math.abs(previousStride - rowStride) < 0.01
      ) {
        return;
      }

      const viewportFocus = container.scrollTop + container.clientHeight / 2;
      const logicalFocus = Math.max(
        0,
        (viewportFocus - PAGE_PADDING) / previousStride,
      );
      container.scrollTop = Math.max(
        0,
        PAGE_PADDING + logicalFocus * rowStride - container.clientHeight / 2,
      );
      applyViewport(container);
    }, [applyViewport, rowStride]);

    // Height changes alter how many pages are visible. Width-only right-panel
    // drags are ignored here, so resizing does not cause React work per frame.
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      viewportHeightRef.current = container.clientHeight;

      const observer = new ResizeObserver((entries) => {
        const nextHeight = entries[0]?.contentRect.height ?? 0;
        if (Math.abs(nextHeight - viewportHeightRef.current) < 0.5) return;
        viewportHeightRef.current = nextHeight;
        if (resizeFrameRef.current !== null) return;

        resizeFrameRef.current = requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          if (containerRef.current) applyViewport(containerRef.current);
        });
      });
      observer.observe(container);
      return () => observer.disconnect();
    }, [applyViewport]);

    useEffect(
      () => () => {
        if (scrollFrameRef.current !== null) {
          cancelAnimationFrame(scrollFrameRef.current);
        }
        if (resizeFrameRef.current !== null) {
          cancelAnimationFrame(resizeFrameRef.current);
        }
        if (visibilityRefreshFrameRef.current !== null) {
          cancelAnimationFrame(visibilityRefreshFrameRef.current);
        }
      },
      [],
    );

    // Scroll work is coalesced to one O(1) range calculation per frame. The
    // rendered page count remains proportional to viewport height, not N.
    const handleScroll = useCallback(
      (event: React.UIEvent<HTMLDivElement>) => {
        const container = event.currentTarget;
        if (scrollFrameRef.current !== null) return;

        scrollFrameRef.current = requestAnimationFrame(() => {
          scrollFrameRef.current = null;
          applyViewport(container);
        });
      },
      [applyViewport],
    );

    // Handle page change from toolbar - scroll to page
    const handlePageChange = useCallback((page: number) => {
      const totalPages = numPagesRef.current;
      if (totalPages <= 0) return;

      const targetPage = clampPage(page, totalPages);
      const previousPage = currentPageRef.current;
      const container = containerRef.current;
      currentPageRef.current = targetPage;
      setCurrentPage(targetPage);

      if (container) {
        const targetTop = PAGE_PADDING + (targetPage - 1) * rowStrideRef.current;
        const virtualDocumentHeight =
          PAGE_PADDING * 2 + totalPages * rowStrideRef.current;
        const resolvedTop = Math.min(
          targetTop,
          Math.max(0, virtualDocumentHeight - container.clientHeight),
        );
        const targetRange = getViewportPageRange(
          resolvedTop,
          container.clientHeight,
          rowStrideRef.current,
          totalPages,
        );
        setVisibleRange(targetRange);
        container.scrollTo({
          top: resolvedTop,
          behavior:
            Math.abs(targetPage - previousPage) <= PAGE_BUFFER + 1
              ? "smooth"
              : "auto",
        });
      }
    }, []);

    const handleToggleSidePanel = useCallback(
      (panel: Exclude<PdfSidePanel, null>) => {
        setSidePanel((current) => (current === panel ? null : panel));
      },
      [],
    );

    const handleToggleSearch = useCallback(() => {
      setSearchOpen((current) => !current);
    }, []);

    const handleRotateClockwise = useCallback(() => {
      setRotation((current) => (current + 90) % 360);
      setVisiblePageRenderEpoch((epoch) => epoch + 1);
    }, []);

    const handleRenderMetric = useCallback((metric: PdfRenderMetric) => {
      if (metric.pageNumber !== currentPageRef.current) return;
      setRenderMetric(metric);
    }, []);

    const handleSearchStep = useCallback(
      (direction: 1 | -1) => {
        if (searchMatches.length === 0) return;
        setActiveSearchIndex((current) => {
          const next =
            (current + direction + searchMatches.length) %
            searchMatches.length;
          handlePageChange(searchMatches[next].page);
          return next;
        });
      },
      [handlePageChange, searchMatches],
    );

    // Re-evaluate current page only after the new virtual spacers have been
    // committed and scrollHeight represents this document generation.
    useLayoutEffect(() => {
      if (
        numPages <= 0 ||
        loadedDocumentGenerationRef.current !== documentGeneration
      ) {
        return;
      }
      const container = containerRef.current;
      if (container) applyViewport(container, numPages);
    }, [applyViewport, documentGeneration, numPages]);

    useEffect(() => {
      if (
        !syncTexCoords ||
        numPages === 0 ||
        loadedDocumentGenerationRef.current !== documentGeneration
      ) {
        return;
      }
      const key =
        syncTexCoords.requestId !== undefined
          ? `${documentGeneration}:request:${syncTexCoords.requestId}`
          : `${documentGeneration}:${syncTexCoords.page}:${syncTexCoords.x}:${syncTexCoords.y}`;
      if (lastSyncCoordsRef.current === key) return;
      lastSyncCoordsRef.current = key;
      handlePageChange(syncTexCoords.page);
    }, [documentGeneration, handlePageChange, numPages, syncTexCoords]);

    useEffect(() => {
      const normalizedQuery = debouncedSearchQuery.toLowerCase();
      const runId = searchRunRef.current + 1;
      searchRunRef.current = runId;

      if (
        !isSearchOpen ||
        normalizedQuery.length < 2 ||
        !pdfiumDocument ||
        numPages <= 0 ||
        loadedDocumentGenerationRef.current !== documentGeneration
      ) {
        setSearchMatches([]);
        setActiveSearchIndex(0);
        setSearchIndexingPage(null);
        return;
      }

      let cancelled = false;
      setSearchMatches([]);
      setActiveSearchIndex(0);
      setSearchIndexingPage(1);

      const indexSearch = async () => {
        const nextMatches: SearchMatch[] = [];
        for (let pageNumber = 1; pageNumber <= numPages; pageNumber += 1) {
          if (cancelled || searchRunRef.current !== runId) return;
          setSearchIndexingPage(pageNumber);

          try {
            const pageText = await invoke<PdfiumPageTextResponse>(
              "pdfium_extract_page_text_cmd",
              {
                docId: pdfiumDocument.docId,
                pageNumber,
              },
            );
            const text = pageText.text.toLowerCase();
            const matchCount = countMatches(text, normalizedQuery);
            if (matchCount > 0) {
              nextMatches.push({ page: pageNumber, matchCount });
              setSearchMatches([...nextMatches]);
            }
          } catch {
            // One unreadable page must not abort indexing the rest of the PDF.
          }

          await waitForSearchIdle();
        }

        if (!cancelled && searchRunRef.current === runId) {
          setSearchIndexingPage(null);
        }
      };

      void indexSearch();
      return () => {
        cancelled = true;
      };
    }, [
      debouncedSearchQuery,
      documentGeneration,
      isSearchOpen,
      numPages,
      pdfiumDocument,
    ]);

    const handleZoomIn = useCallback(() => {
      setScale((s) => Math.min(s + 0.25, 3));
    }, []);

    const handleZoomOut = useCallback(() => {
      setScale((s) => Math.max(s - 0.25, 0.5));
    }, []);

    const handleScaleChange = useCallback((newScale: number) => {
      setScale(Math.max(0.25, Math.min(newScale, 3)));
    }, []);

    const handleFitToWidth = useCallback(() => {
      if (containerRef.current && pageDimensions) {
        const containerWidth = containerRef.current.clientWidth - 40; // padding
        const pageWidth = isQuarterTurn
          ? pageDimensions.height
          : pageDimensions.width;
        const newScale = containerWidth / pageWidth;
        setScale(Math.max(0.25, Math.min(newScale, 3)));
      }
    }, [isQuarterTurn, pageDimensions]);

    const handleFitToPage = useCallback(() => {
      if (containerRef.current && pageDimensions) {
        const containerWidth = containerRef.current.clientWidth - 40;
        const containerHeight = containerRef.current.clientHeight - 40;
        const pageWidth = isQuarterTurn
          ? pageDimensions.height
          : pageDimensions.width;
        const pageHeight = isQuarterTurn
          ? pageDimensions.width
          : pageDimensions.height;
        const scaleX = containerWidth / pageWidth;
        const scaleY = containerHeight / pageHeight;
        const newScale = Math.min(scaleX, scaleY);
        setScale(Math.max(0.25, Math.min(newScale, 3)));
      }
    }, [isQuarterTurn, pageDimensions]);

    const handleDownload = useCallback(() => {
      if (pdfUrl) {
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = "document.pdf";
        a.click();
      }
    }, [pdfUrl]);

    const handlePrint = useCallback(() => {
      if (pdfPath) {
        void openPath(pdfPath).catch((printError) => {
          debugLog("error", "PDF_UI", "open-print-failed", {
            path: pdfPath,
            error: printError,
          });
          setError(String(printError));
        });
        return;
      }

      if (pdfUrl) {
        void openUrl(pdfUrl).catch((printError) => {
          debugLog("error", "PDF_UI", "open-url-print-failed", {
            url: pdfUrl,
            error: printError,
          });
          setError(String(printError));
        });
      }
    }, [pdfPath, pdfUrl]);

    const handlePageClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.ctrlKey && onSyncTexInverse) {
          const target = e.target as HTMLElement;
          const pageElement = target.closest("[data-page-number]");
          if (pageElement) {
            const rect = pageElement.getBoundingClientRect();
            const x = (e.clientX - rect.left) / debouncedScale;
            const y = (e.clientY - rect.top) / debouncedScale;
            const pageNum = parseInt(
              pageElement.getAttribute("data-page-number") || "1",
              10,
            );
            onSyncTexInverse(pageNum, x, y);
          }
        }
      },
      [debouncedScale, onSyncTexInverse],
    );

    const visiblePages = useMemo(
      () =>
        Array.from(
          { length: Math.max(0, visibleRange.end - visibleRange.start + 1) },
          (_, index) => visibleRange.start + index,
        ),
      [visibleRange.end, visibleRange.start],
    );
    const searchMatchTotal = useMemo(
      () =>
        searchMatches.reduce(
          (total, match) => total + match.matchCount,
          0,
        ),
      [searchMatches],
    );
    const thumbnailRenderRange = useMemo(
      () => ({
        start: Math.max(1, currentPage - THUMBNAIL_BUFFER),
        end: Math.min(numPages, currentPage + THUMBNAIL_BUFFER),
      }),
      [currentPage, numPages],
    );
    const topSpacerHeight =
      PAGE_PADDING + Math.max(0, visibleRange.start - 1) * rowStride;
    const bottomSpacerHeight =
      PAGE_PADDING + Math.max(0, numPages - visibleRange.end) * rowStride;

    if (!pdfUrl) {
      return <EmptyState message={t("database.inspector.noPdf")} />;
    }

    const viewerBody = (
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {sidePanel && (
          <Box
            className="pdf-viewer-side-panel"
            style={{
              display: "flex",
              flexDirection: "column",
              width: 152,
              minWidth: 152,
              borderRight: "1px solid var(--mantine-color-default-border)",
              backgroundColor: "var(--mantine-color-body)",
            }}
          >
            <Group justify="space-between" px={8} py={6} wrap="nowrap">
              <Text size="xs" fw={600}>
                {sidePanel === "thumbnails" ? "Pages" : "Outline"}
              </Text>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => setSidePanel(null)}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
            <Divider />
            <ScrollArea style={{ flex: 1, minHeight: 0 }}>
              {sidePanel === "thumbnails" ? (
                pdfiumDocument ? (
                  <StackPdfiumThumbnailList
                    docId={pdfiumDocument.docId}
                    currentPage={currentPage}
                    numPages={numPages}
                    pageSizes={pdfiumDocument.pageSizes}
                    rotation={rotation}
                    renderRange={thumbnailRenderRange}
                    thumbnailWidth={THUMBNAIL_WIDTH}
                    onPageChange={handlePageChange}
                  />
                ) : (
                  <Box p="xs">
                    <Text size="xs" c="dimmed">
                      Loading pages…
                    </Text>
                  </Box>
                )
              ) : outlineLoading ? (
                <Box p="xs">
                  <Text size="xs" c="dimmed">
                    Loading outline…
                  </Text>
                </Box>
              ) : outlineItems.length > 0 ? (
                <Box py={4}>
                  {outlineItems.map((item) => (
                    <button
                      key={item.id}
                      className="pdf-viewer-outline-item"
                      disabled={!item.page}
                      onClick={() => item.page && handlePageChange(item.page)}
                      style={{
                        paddingLeft: 8 + item.depth * 12,
                      }}
                    >
                      <span>{item.title}</span>
                      {item.page && <small>{item.page}</small>}
                    </button>
                  ))}
                </Box>
              ) : (
                <Box p="xs">
                  <Text size="xs" c="dimmed">
                    No outline in this PDF.
                  </Text>
                </Box>
              )}
            </ScrollArea>
          </Box>
        )}

        <Box
          ref={containerRef}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflow: "auto",
            overflowAnchor: "none",
            backgroundColor: "var(--mantine-color-default)",
          }}
          className="pdf-viewer-scroll"
          onClick={handlePageClick}
          onScroll={handleScroll}
        >
          {loading && <LoadingState message={t("common.loading")} />}
          {error && <EmptyState message={error} bg="transparent" />}
          {pdfiumOpenError && !error && !isPdfiumActive && (
            <Box px="sm" py={6}>
              <Text size="xs" c="orange">
                Rust renderer failed: {pdfiumOpenError}
              </Text>
            </Box>
          )}
          {numPages > 0 && (
            <Box
              className="pdf-viewer-page-window"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: "min-content",
              }}
            >
              <Box
                aria-hidden="true"
                style={{ height: topSpacerHeight, flex: "0 0 auto" }}
              />
              {visiblePages.map((pageNum) => (
                <Box
                  key={pageNum}
                  data-page-num={pageNum}
                  data-page-number={pageNum}
                  className="pdf-viewer-page"
                  style={{
                    width: estimatedPageWidth,
                    height: estimatedPageHeight,
                    marginBottom: PAGE_GAP,
                    flex: "0 0 auto",
                    boxShadow:
                      pageNum === currentPage
                        ? "0 4px 12px rgba(0, 0, 0, 0.4)"
                        : "0 2px 6px rgba(0, 0, 0, 0.25)",
                    background: "white",
                  }}
                >
                  {pdfiumDocument ? (
                    <PdfiumRenderedPage
                      key={`${pdfiumDocument.docId}:${visiblePageRenderEpoch}:${rotation}:${debouncedScale}:${pageNum}`}
                      docId={pdfiumDocument.docId}
                      pageNumber={pageNum}
                      scale={debouncedScale}
                      rotation={rotation}
                      width={estimatedPageWidth}
                      height={estimatedPageHeight}
                      isActive={pageNum === currentPage}
                      onRenderComplete={handleRenderMetric}
                    />
                  ) : (
                    <Skeleton
                      height={estimatedPageHeight}
                      width={estimatedPageWidth}
                      animate={pageNum === currentPage}
                    />
                  )}
                </Box>
              ))}
              <Box
                aria-hidden="true"
                style={{ height: bottomSpacerHeight, flex: "0 0 auto" }}
              />
            </Box>
          )}
        </Box>
      </Box>
    );

    return (
      <Box
        h="100%"
        className="pdf-viewer-container"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <PdfToolbar
          currentPage={currentPage}
          numPages={numPages}
          scale={scale}
          renderMetric={renderMetric}
          isSearchOpen={isSearchOpen}
          sidePanel={sidePanel}
          onPageChange={handlePageChange}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onScaleChange={handleScaleChange}
          onFitToWidth={handleFitToWidth}
          onFitToPage={handleFitToPage}
          onRotateClockwise={handleRotateClockwise}
          onToggleSearch={handleToggleSearch}
          onToggleSidePanel={handleToggleSidePanel}
          onDownload={handleDownload}
          onPrint={handlePrint}
        />

        {isSearchOpen && (
          <Group
            gap={6}
            px={6}
            py={5}
            wrap="nowrap"
            bg="var(--mantine-color-body)"
            style={{
              borderBottom: "1px solid var(--mantine-color-default-border)",
              flexShrink: 0,
            }}
          >
            <TextInput
              size="xs"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSearchStep(1);
                if (event.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Search in PDF"
              leftSection={<IconSearch size={14} />}
              style={{ flex: 1, minWidth: 120 }}
            />
            <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
              {searchIndexingPage
                ? `Indexing ${searchIndexingPage}/${numPages}`
                : searchMatches.length > 0
                  ? `${activeSearchIndex + 1}/${searchMatches.length} pages · ${searchMatchTotal} hits`
                  : debouncedSearchQuery.length >= 2
                    ? "No hits"
                    : "2+ chars"}
            </Text>
            <Tooltip label="Previous result">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                disabled={searchMatches.length === 0}
                onClick={() => handleSearchStep(-1)}
              >
                <IconChevronUp size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Next result">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                disabled={searchMatches.length === 0}
                onClick={() => handleSearchStep(1)}
              >
                <IconChevronDown size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Close search">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                onClick={() => setSearchOpen(false)}
              >
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}

        {viewerBody}
      </Box>
    );
  },
);

interface PdfiumRenderedPageProps {
  docId: string;
  pageNumber: number;
  scale: number;
  rotation: number;
  width: number;
  height: number;
  isActive: boolean;
  onRenderComplete: (metric: PdfRenderMetric) => void;
}

const PdfiumRenderedPage = memo(function PdfiumRenderedPage({
  docId,
  pageNumber,
  scale,
  rotation,
  width,
  height,
  isActive,
  onRenderComplete,
}: PdfiumRenderedPageProps) {
  const [renderedPage, setRenderedPage] =
    useState<PdfiumRenderPageResponse | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let deferredRenderTimer: number | null = null;
    setRenderedPage(null);
    setRenderError(null);

    const renderPage = () => {
      startedAtRef.current = performance.now();
      void invoke<PdfiumRenderPageResponse>("pdfium_render_page_cmd", {
        request: {
          docId,
          pageNumber,
          scale,
          rotation,
          devicePixelRatio: getPdfiumDevicePixelRatio(),
        },
      })
        .then((response) => {
          if (!cancelled) {
            setRenderedPage(response);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            debugLog("error", "PDFIUM_UI", "page-render-failed", {
              docId,
              pageNumber,
              scale,
              rotation,
              error,
            });
            setRenderError(String(error));
          }
        });
    };

    if (isActive) {
      renderPage();
    } else {
      // The native renderer is intentionally serialized. Give the active page
      // first access to it before pre-rendering viewport buffer pages.
      deferredRenderTimer = window.setTimeout(renderPage, 40);
    }

    return () => {
      cancelled = true;
      if (deferredRenderTimer !== null) {
        window.clearTimeout(deferredRenderTimer);
      }
    };
  }, [docId, pageNumber, rotation, scale]);

  if (renderError) {
    return (
      <Box
        h="100%"
        w="100%"
        bg="white"
        p="sm"
        style={{ display: "grid", placeItems: "center" }}
      >
        <Text size="xs" c="red" ta="center">
          Rust render failed: {renderError}
        </Text>
      </Box>
    );
  }

  if (!renderedPage) {
    return (
      <Skeleton
        height={height}
        width={width}
        animate={isActive}
      />
    );
  }

  return (
    <img
      src={convertFileSrc(renderedPage.imagePath)}
      alt={`PDF page ${pageNumber}`}
      draggable={false}
      className="pdf-viewer-rust-page-image"
      data-cache-hit={renderedPage.cacheHit || undefined}
      onLoad={() => {
        onRenderComplete({
          backend: "pdfium",
          pageNumber,
          totalTimeMs: Math.max(
            0,
            Math.round(performance.now() - startedAtRef.current),
          ),
          nativeTimeMs: renderedPage.renderTimeMs,
          pageLoadTimeMs: renderedPage.pageLoadTimeMs,
          rasterTimeMs: renderedPage.rasterTimeMs,
          encodeTimeMs: renderedPage.encodeTimeMs,
          cacheHit: renderedPage.cacheHit,
        });
      }}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        userSelect: "none",
      }}
    />
  );
});

interface StackPdfiumThumbnailListProps {
  docId: string;
  currentPage: number;
  numPages: number;
  pageSizes: PdfiumPageSize[];
  rotation: number;
  renderRange: PageRange;
  thumbnailWidth: number;
  onPageChange: (page: number) => void;
}

const StackPdfiumThumbnailList = memo(function StackPdfiumThumbnailList({
  docId,
  currentPage,
  numPages,
  pageSizes,
  rotation,
  renderRange,
  thumbnailWidth,
  onPageChange,
}: StackPdfiumThumbnailListProps) {
  return (
    <Box p={8}>
      {Array.from({ length: numPages }, (_, index) => {
        const pageNum = index + 1;
        const pageSize = pageSizes[index];
        const isQuarterTurn = rotation % 180 !== 0;
        const displayWidth = isQuarterTurn
          ? (pageSize?.height ?? DEFAULT_PAGE_HEIGHT)
          : (pageSize?.width ?? DEFAULT_PAGE_WIDTH);
        const displayHeight = isQuarterTurn
          ? (pageSize?.width ?? DEFAULT_PAGE_WIDTH)
          : (pageSize?.height ?? DEFAULT_PAGE_HEIGHT);
        const previewHeight = Math.max(
          1,
          Math.round(thumbnailWidth * (displayHeight / displayWidth)),
        );
        const shouldRenderPage =
          pageNum >= renderRange.start && pageNum <= renderRange.end;

        return (
          <button
            key={pageNum}
            className="pdf-viewer-thumbnail"
            data-active={pageNum === currentPage || undefined}
            onClick={() => onPageChange(pageNum)}
          >
            <Box
              className="pdf-viewer-thumbnail-preview"
              style={{
                width: thumbnailWidth,
                height: previewHeight,
              }}
            >
              {shouldRenderPage && pageSize ? (
                <PdfiumThumbnailPreview
                  docId={docId}
                  pageNumber={pageNum}
                  pageSize={pageSize}
                  rotation={rotation}
                  thumbnailWidth={thumbnailWidth}
                  isActive={pageNum === currentPage}
                />
              ) : (
                <Text size="xs" c="dimmed">
                  {pageNum}
                </Text>
              )}
            </Box>
            <Text size="xs" c={pageNum === currentPage ? "blue" : "dimmed"}>
              {pageNum}
            </Text>
          </button>
        );
      })}
    </Box>
  );
});

interface PdfiumThumbnailPreviewProps {
  docId: string;
  pageNumber: number;
  pageSize: PdfiumPageSize;
  rotation: number;
  thumbnailWidth: number;
  isActive: boolean;
}

const PdfiumThumbnailPreview = memo(function PdfiumThumbnailPreview({
  docId,
  pageNumber,
  pageSize,
  rotation,
  thumbnailWidth,
  isActive,
}: PdfiumThumbnailPreviewProps) {
  const [renderedPage, setRenderedPage] =
    useState<PdfiumRenderPageResponse | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  const isQuarterTurn = rotation % 180 !== 0;
  const displayWidth = isQuarterTurn ? pageSize.height : pageSize.width;
  const scale = thumbnailWidth / Math.max(1, displayWidth);

  useEffect(() => {
    let cancelled = false;
    let deferredRenderTimer: number | null = null;
    setRenderedPage(null);
    setRenderError(null);

    const renderThumbnail = () => {
      void invoke<PdfiumRenderPageResponse>("pdfium_render_page_cmd", {
        request: {
          docId,
          pageNumber,
          scale,
          rotation,
          devicePixelRatio: 1,
        },
      })
        .then((response) => {
          if (!cancelled) setRenderedPage(response);
        })
        .catch((error) => {
          if (!cancelled) {
            debugLog("error", "PDFIUM_UI", "thumbnail-render-failed", {
              docId,
              pageNumber,
              scale,
              rotation,
              error,
            });
            setRenderError(String(error));
          }
        });
    };

    if (isActive) {
      renderThumbnail();
    } else {
      deferredRenderTimer = window.setTimeout(renderThumbnail, 80);
    }

    return () => {
      cancelled = true;
      if (deferredRenderTimer !== null) {
        window.clearTimeout(deferredRenderTimer);
      }
    };
  }, [docId, isActive, pageNumber, rotation, scale]);

  if (renderError) {
    return (
      <Text size="xs" c="red" ta="center">
        {pageNumber}
      </Text>
    );
  }

  if (!renderedPage) {
    return <Skeleton height="100%" width="100%" animate={isActive} />;
  }

  return (
    <img
      src={convertFileSrc(renderedPage.imagePath)}
      alt={`PDF page ${pageNumber} thumbnail`}
      draggable={false}
      className="pdf-viewer-rust-thumbnail-image"
    />
  );
});

PdfViewerContainer.displayName = "PdfViewerContainer";
