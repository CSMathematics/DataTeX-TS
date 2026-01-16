import { useState, useCallback, memo, useRef, useEffect, useMemo } from "react";
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
  IconArrowsMaximize,
  IconArrowsHorizontal,
} from "@tabler/icons-react";
import { LoadingState, EmptyState } from "../ui";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure PDF.js worker - use local file for faster loading and offline capability
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// Constants for virtual scrolling
const PAGE_BUFFER = 2; // Number of pages to render above/below visible area
const DEFAULT_PAGE_HEIGHT = 842; // A4 height in points (approximate)

interface PdfViewerContainerProps {
  pdfUrl: string | null;
  onSyncTexInverse?: (page: number, x: number, y: number) => void;
  syncTexCoords?: { page: number; x: number; y: number } | null;
}

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
      [numPages, onPageChange]
    );

    return (
      <Group
        justify="space-between"
        p="xs"
        bg="var(--mantine-color-default)"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        {/* Page Navigation */}
        <Group gap="xs">
          <Tooltip label={t("pdfViewer.prevPage")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
            >
              <IconArrowLeft size={16} />
            </ActionIcon>
          </Tooltip>
          <Group gap={4}>
            <TextInput
              size="xs"
              w={40}
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
              size="sm"
              onClick={() => onPageChange(Math.min(numPages, currentPage + 1))}
              disabled={currentPage >= numPages}
            >
              <IconArrowRight size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Zoom Controls */}
        <Group gap="xs">
          <Tooltip label={t("pdfViewer.zoomOut")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onZoomOut}
            >
              <IconZoomOut size={16} />
            </ActionIcon>
          </Tooltip>
          <Select
            size="xs"
            w={100}
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
              size="sm"
              onClick={onZoomIn}
            >
              <IconZoomIn size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Actions */}
        <Group gap="xs">
          <Tooltip label={t("pdfViewer.fitWidth")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onFitToWidth}
            >
              <IconArrowsHorizontal size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("pdfViewer.fitPage")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onFitToPage}
            >
              <IconArrowsMaximize size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("common.download")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onDownload}
            >
              <IconDownload size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("common.print")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={onPrint}
            >
              <IconPrinter size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    );
  }
);

PdfToolbar.displayName = "PdfToolbar";

// Main container component
export const PdfViewerContainer = memo(
  ({ pdfUrl, onSyncTexInverse }: PdfViewerContainerProps) => {
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
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const isScrollingRef = useRef(false);

    // Performance: Debounced scale for smoother zoom
    const [debouncedScale] = useDebouncedValue(scale, 100);

    // Performance: Page cache for rendered pages
    const pageCacheRef = useRef<Map<number, string>>(new Map());

    // Performance: Virtual scrolling - compute visible page range
    const visibleRange = useMemo(() => {
      const start = Math.max(1, currentPage - PAGE_BUFFER);
      const end = Math.min(numPages, currentPage + PAGE_BUFFER);
      return { start, end };
    }, [currentPage, numPages]);

    // Estimated page height for placeholders
    const estimatedPageHeight = useMemo(() => {
      if (pageDimensions) {
        return pageDimensions.height * debouncedScale;
      }
      return DEFAULT_PAGE_HEIGHT * debouncedScale;
    }, [pageDimensions, debouncedScale]);

    // Reset page when URL changes
    useEffect(() => {
      console.log("PdfViewerContainer: pdfUrl changed to:", pdfUrl);
      setCurrentPage(1);
      setLoading(true);
      setError(null);
      setPageDimensions(null);
      pageRefs.current.clear();
      pageCacheRef.current.clear(); // Clear cache on new document
    }, [pdfUrl]);

    // Clear page cache when scale changes
    useEffect(() => {
      pageCacheRef.current.clear();
    }, [debouncedScale]);

    // Scroll observer to detect current page
    useEffect(() => {
      if (!containerRef.current || numPages === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (isScrollingRef.current) return; // Skip if programmatic scroll

          // Find the most visible page
          let maxRatio = 0;
          let visiblePage = currentPage;

          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
              maxRatio = entry.intersectionRatio;
              const pageNum = parseInt(
                entry.target.getAttribute("data-page-num") || "1",
                10
              );
              visiblePage = pageNum;
            }
          });

          if (visiblePage !== currentPage && maxRatio > 0.3) {
            setCurrentPage(visiblePage);
          }
        },
        {
          root: containerRef.current,
          threshold: [0.1, 0.3, 0.5, 0.7],
        }
      );

      // Observe all pages
      pageRefs.current.forEach((el) => {
        observer.observe(el);
      });

      return () => observer.disconnect();
    }, [numPages, currentPage]);

    // Handle page change from toolbar - scroll to page
    const handlePageChange = useCallback(
      (page: number) => {
        const targetPage = Math.max(1, Math.min(page, numPages));
        setCurrentPage(targetPage);

        const pageEl = pageRefs.current.get(targetPage);
        if (pageEl && containerRef.current) {
          isScrollingRef.current = true;
          pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
          // Reset flag after animation
          setTimeout(() => {
            isScrollingRef.current = false;
          }, 500);
        }
      },
      [numPages]
    );

    const onDocumentLoadSuccess = useCallback(
      ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
        setLoading(false);
        setError(null);
      },
      []
    );

    const onDocumentLoadError = useCallback((err: Error) => {
      console.error("PDF Load Error:", err);
      setLoading(false);
      setError(err.message || "Failed to load PDF");
    }, []);
    // Store ORIGINAL page dimensions (at scale 1.0) for correct fit calculations
    const onPageLoadSuccess = useCallback(
      (page: {
        width: number;
        height: number;
        originalWidth: number;
        originalHeight: number;
      }) => {
        // Use originalWidth/originalHeight which are the unscaled dimensions
        setPageDimensions({
          width: page.originalWidth,
          height: page.originalHeight,
        });
      },
      []
    );

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
        printWindow?.print();
      }
    }, [pdfUrl]);

    const handlePageClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.ctrlKey && onSyncTexInverse) {
          const target = e.target as HTMLElement;
          const pageElement = target.closest("[data-page-number]");
          if (pageElement) {
            const rect = pageElement.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const pageNum = parseInt(
              pageElement.getAttribute("data-page-number") || "1",
              10
            );
            onSyncTexInverse(pageNum, x, y);
          }
        }
      },
      [onSyncTexInverse]
    );

    if (!pdfUrl) {
      return <EmptyState message={t("database.inspector.noPdf")} />;
    }

    return (
      <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
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
            overflow: "auto",
            backgroundColor: "var(--mantine-color-default)",
          }}
          onClick={handlePageClick}
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
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "20px",
                  padding: "20px",
                }}
              >
                {Array.from({ length: numPages }, (_, index) => {
                  const pageNum = index + 1;
                  const isInRange =
                    pageNum >= visibleRange.start &&
                    pageNum <= visibleRange.end;

                  return (
                    <Box
                      key={pageNum}
                      data-page-num={pageNum}
                      ref={(el: HTMLDivElement | null) => {
                        if (el) pageRefs.current.set(pageNum, el);
                        else pageRefs.current.delete(pageNum);
                      }}
                      style={{
                        boxShadow: isInRange
                          ? "0 4px 12px rgba(0, 0, 0, 0.4)"
                          : "none",
                        background: "white",
                        // Keep consistent height for non-rendered pages to maintain scroll position
                        minHeight: !isInRange ? estimatedPageHeight : undefined,
                        width:
                          !isInRange && pageDimensions
                            ? pageDimensions.width * debouncedScale
                            : undefined,
                      }}
                    >
                      {isInRange ? (
                        <Page
                          pageNumber={pageNum}
                          scale={debouncedScale}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          onLoadSuccess={
                            pageNum === 1 ? onPageLoadSuccess : undefined
                          }
                          loading={
                            <Skeleton
                              height={estimatedPageHeight}
                              width={
                                pageDimensions
                                  ? pageDimensions.width * debouncedScale
                                  : undefined
                              }
                              animate={true}
                            />
                          }
                        />
                      ) : (
                        // Placeholder for non-visible pages (virtual scrolling)
                        <Skeleton
                          height={estimatedPageHeight}
                          width={
                            pageDimensions
                              ? pageDimensions.width * debouncedScale
                              : undefined
                          }
                          animate={false}
                          style={{ opacity: 0.3 }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Document>
        </Box>
      </Box>
    );
  }
);

PdfViewerContainer.displayName = "PdfViewerContainer";
