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
import { Document, Page, pdfjs } from "react-pdf";
import {
  Group,
  ActionIcon,
  Tooltip,
  Text,
  TextInput,
  Box,
  Select,
  Skeleton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDownload,
  IconPrinter,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import { LoadingState, EmptyState } from "../ui";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker - use local file for faster loading and offline capability
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// Constants for virtual scrolling
const PAGE_BUFFER = 1; // Number of pages to pre-render above/below the active page
const PAGE_GAP = 20;
const PAGE_PADDING = 20;
const DEFAULT_PAGE_WIDTH = 595; // A4 width in points (approximate)
const DEFAULT_PAGE_HEIGHT = 842; // A4 height in points (approximate)
const MAX_DEVICE_PIXEL_RATIO = 1.5;

interface PdfViewerContainerProps {
  pdfUrl: string | null;
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

interface PdfDocumentInfo {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => {
      width: number;
      height: number;
    };
  }>;
}

const EMPTY_PAGE_RANGE: PageRange = { start: 1, end: 0 };

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

// Memoized toolbar - completely stable, only updates via props
const PdfToolbar = memo(
  ({
    currentPage,
    numPages,
    scale,
    onPageChange,
    onZoomIn,
    onZoomOut,
    onScaleChange,
    onFitToWidth,
    onFitToPage,
    onDownload,
    onPrint,
  }: {
    currentPage: number;
    numPages: number;
    scale: number;
    onPageChange: (page: number) => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onScaleChange: (scale: number) => void;
    onFitToWidth: () => void;
    onFitToPage: () => void;
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
        {/* Page Navigation */}
        <Group gap={4} wrap="nowrap">
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
        </Group>

        {/* Actions */}
        <Group gap={4} wrap="nowrap">
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
  ({ pdfUrl, onSyncTexInverse, syncTexCoords }: PdfViewerContainerProps) => {
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

    // Estimated page height for placeholders
    const estimatedPageHeight = useMemo(() => {
      if (pageDimensions) {
        return pageDimensions.height * debouncedScale;
      }
      return DEFAULT_PAGE_HEIGHT * debouncedScale;
    }, [pageDimensions, debouncedScale]);

    const estimatedPageWidth = useMemo(
      () =>
        (pageDimensions?.width ?? DEFAULT_PAGE_WIDTH) * debouncedScale,
      [pageDimensions, debouncedScale],
    );

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
      if (containerRef.current) containerRef.current.scrollTop = 0;
    }, [documentGeneration, pdfUrl]);

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

    const onDocumentLoadSuccess = useCallback(
      (document: PdfDocumentInfo) => {
        const loadedPageCount = document.numPages;
        if (
          documentIdentityRef.current.generation !== documentGeneration ||
          documentIdentityRef.current.url !== pdfUrl
        ) {
          return;
        }

        loadedDocumentGenerationRef.current = documentGeneration;
        const nextPage = clampPage(currentPageRef.current, loadedPageCount);
        numPagesRef.current = loadedPageCount;
        currentPageRef.current = nextPage;
        setNumPages(loadedPageCount);
        setCurrentPage(nextPage);
        setLoading(false);
        setError(null);

        // Read the canonical first-page geometry from the document itself.
        // Visible pages may finish out of order, especially after SyncTeX.
        void document
          .getPage(1)
          .then((page) => {
            if (
              loadedDocumentGenerationRef.current !== documentGeneration ||
              documentIdentityRef.current.generation !== documentGeneration ||
              pageDimensionsRef.current
            ) {
              return;
            }
            const viewport = page.getViewport({ scale: 1 });
            const dimensions = {
              width: viewport.width,
              height: viewport.height,
            };
            pageDimensionsRef.current = dimensions;
            setPageDimensions(dimensions);
          })
          .catch((dimensionError) => {
            console.debug("Could not read PDF page dimensions:", dimensionError);
          });

        const container = containerRef.current;
        if (container) {
          const maxTarget = PAGE_PADDING + (nextPage - 1) * rowStrideRef.current;
          container.scrollTop = Math.min(container.scrollTop, maxTarget);
          // The new spacers are not committed yet, so scrollHeight still
          // belongs to the loading/previous document. Update only the range.
          applyViewport(container, loadedPageCount, false);
        }
      },
      [applyViewport, documentGeneration, pdfUrl],
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

    const onDocumentLoadError = useCallback(
      (err: Error) => {
        if (
          documentIdentityRef.current.generation !== documentGeneration ||
          documentIdentityRef.current.url !== pdfUrl
        ) {
          return;
        }
        console.error("PDF Load Error:", err);
        setLoading(false);
        setError(err.message || "Failed to load PDF");
      },
      [documentGeneration, pdfUrl],
    );
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
        const newScale = containerWidth / pageDimensions.width;
        setScale(Math.max(0.25, Math.min(newScale, 3)));
      }
    }, [pageDimensions]);

    const handleFitToPage = useCallback(() => {
      if (containerRef.current && pageDimensions) {
        const containerWidth = containerRef.current.clientWidth - 40;
        const containerHeight = containerRef.current.clientHeight - 40;
        const scaleX = containerWidth / pageDimensions.width;
        const scaleY = containerHeight / pageDimensions.height;
        const newScale = Math.min(scaleX, scaleY);
        setScale(Math.max(0.25, Math.min(newScale, 3)));
      }
    }, [pageDimensions]);

    const handleDownload = useCallback(() => {
      if (pdfUrl) {
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = "document.pdf";
        a.click();
      }
    }, [pdfUrl]);

    const handlePrint = useCallback(() => {
      if (pdfUrl) {
        const printWindow = window.open(pdfUrl, "_blank");
        if (!printWindow) return;

        let printed = false;
        let fallbackTimer: number | null = null;
        const printWhenReady = () => {
          if (printed || printWindow.closed) return;
          printed = true;
          if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
          printWindow.focus();
          printWindow.print();
        };

        printWindow.addEventListener("load", printWhenReady, { once: true });
        // Some embedded PDF plugins do not forward a reliable load event.
        fallbackTimer = window.setTimeout(printWhenReady, 2000);
      }
    }, [pdfUrl]);

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
    const topSpacerHeight =
      PAGE_PADDING + Math.max(0, visibleRange.start - 1) * rowStride;
    const bottomSpacerHeight =
      PAGE_PADDING + Math.max(0, numPages - visibleRange.end) * rowStride;

    if (!pdfUrl) {
      return <EmptyState message={t("database.inspector.noPdf")} />;
    }

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
          onPageChange={handlePageChange}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onScaleChange={handleScaleChange}
          onFitToWidth={handleFitToWidth}
          onFitToPage={handleFitToPage}
          onDownload={handleDownload}
          onPrint={handlePrint}
        />
        <Box
          ref={containerRef}
          style={{
            flex: 1,
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
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
          >
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
                    <Page
                      pageNumber={pageNum}
                      scale={debouncedScale}
                      devicePixelRatio={Math.min(
                        window.devicePixelRatio || 1,
                        MAX_DEVICE_PIXEL_RATIO,
                      )}
                      renderTextLayer={pageNum === currentPage}
                      renderAnnotationLayer={pageNum === currentPage}
                      loading={
                        <Skeleton
                          height={estimatedPageHeight}
                          width={estimatedPageWidth}
                          animate={pageNum === currentPage}
                        />
                      }
                    />
                  </Box>
                ))}
                <Box
                  aria-hidden="true"
                  style={{ height: bottomSpacerHeight, flex: "0 0 auto" }}
                />
              </Box>
            )}
          </Document>
        </Box>
      </Box>
    );
  },
);

PdfViewerContainer.displayName = "PdfViewerContainer";
