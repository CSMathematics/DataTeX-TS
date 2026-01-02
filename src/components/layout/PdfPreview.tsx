import React, { useState, useEffect, useRef } from 'react';
import { Box, LoadingOverlay } from '@mantine/core';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Εισαγωγή των CSS της βιβλιοθήκης
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '../../styles/pdf-viewer.css';

import { IconArrowLeft, IconArrowRight, IconDownload, IconMaximize, IconPrinter, IconSearch, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import type { ToolbarSlot, ToolbarProps } from '@react-pdf-viewer/default-layout';
import { EmptyState } from '../ui';

// --- Worker URL Configuration ---
const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

interface PdfPreviewProps {
  pdfUrl: string | null;
  onSyncTexInverse?: (page: number, x: number, y: number) => void;
  syncTexCoords?: { page: number, x: number, y: number } | null;
}

export const PdfPreview = React.memo(function PdfPreview({ pdfUrl, onSyncTexInverse, syncTexCoords }: PdfPreviewProps) {
  // Configure defaultLayoutPlugin to hide sidebar and customize layout
  // Note: Cannot use useMemo here as defaultLayoutPlugin uses hooks internally
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    // Hide all sidebar tabs (bookmarks, thumbnails, attachments)
    sidebarTabs: () => [],
    // Configure toolbar with custom rendering
    renderToolbar: (Toolbar: (props: ToolbarProps) => React.ReactElement) => (
      <Toolbar>
        {(slots: ToolbarSlot) => {
          const {
            CurrentPageInput,
            Download,
            EnterFullScreen,
            GoToNextPage,
            GoToPreviousPage,
            NumberOfPages,
            Print,
            ShowSearchPopover,
            Zoom,
            ZoomIn,
            ZoomOut,
          } = slots;
          return (
            <div
              style={{
                alignItems: 'center',
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                padding: '4px 8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ padding: '0px 2px' }}>
                  <ShowSearchPopover>
                    {(props) => (
                      <Tooltip label="Search" position="bottom" withArrow>
                        <ActionIcon variant="subtle" color="gray" size="xs" onClick={props.onClick}>
                          <IconSearch size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </ShowSearchPopover>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <GoToPreviousPage>
                    {(props) => (
                      <Tooltip label="Previous Page" position="bottom" withArrow>
                        <ActionIcon variant="subtle" color="gray" size="xs" onClick={props.onClick} disabled={props.isDisabled}>
                          <IconArrowLeft size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </GoToPreviousPage>
                   <div style={{ display: 'flex', alignItems: 'center', margin: '0 4px' }} className="pdf-page-controls">
                    <CurrentPageInput />
                    <span style={{ margin: '0 4px', fontSize: '12px', color: '#868e96' }}>/</span>
                    <NumberOfPages/>
                  </div>
                  <GoToNextPage>
                    {(props) => (
                       <Tooltip label="Next Page" position="bottom" withArrow>
                        <ActionIcon variant="subtle" color="gray" size="xs" onClick={props.onClick} disabled={props.isDisabled}>
                          <IconArrowRight size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </GoToNextPage>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                 <ZoomOut>
                  {(props) => (
                    <Tooltip label="Zoom Out" position="bottom" withArrow>
                      <ActionIcon variant="subtle" color="gray" size="xs" onClick={props.onClick}>
                        <IconZoomOut size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </ZoomOut>
                <div style={{ margin: '0 4px' }} className="pdf-zoom-controls">
                    <Zoom />
                </div>
                <ZoomIn>
                  {(props) => (
                    <Tooltip label="Zoom In" position="bottom" withArrow>
                      <ActionIcon variant="subtle" color="gray" size="xs" onClick={props.onClick}>
                        <IconZoomIn size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </ZoomIn>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                 <EnterFullScreen>
                  {(props) => (
                    <Tooltip label="Full Screen" position="bottom" withArrow>
                      <ActionIcon variant="subtle" color="gray" size="xs" onClick={props.onClick}>
                        <IconMaximize size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </EnterFullScreen>
                 <Download>
                  {(props) => (
                    <Tooltip label="Download" position="bottom" withArrow>
                      <ActionIcon variant="subtle" color="gray" size="xs" onClick={props.onClick}>
                        <IconDownload size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Download>
                <Print>
                  {(props) => (
                    <Tooltip label="Print" position="bottom" withArrow>
                      <ActionIcon variant="subtle" color="gray" size="xs" onClick={props.onClick}>
                        <IconPrinter size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Print>
              </div>
            </div>
          );
        }}
      </Toolbar>
    ),
  });
  
  // State για να ξέρουμε πότε φορτώνει το PDF
  const [ready, setReady] = useState(false);
  // State για visual feedback στο SyncTeX
  const [showSyncHighlight, setShowSyncHighlight] = useState(false);
  // Ref to track the highlight timer
  const highlightTimerRef = useRef<number | null>(null);
  // Ref to track last processed coords to prevent loops
  const lastCoordsRef = useRef<string | null>(null);

  useEffect(() => {
    // Κάθε φορά που αλλάζει το URL, κάνουμε reset το state
    if (pdfUrl) {
      setReady(false);
      // Μικρό delay για να προλαβαίνει να καθαρίσει το UI πριν το νέο render
      const timer = setTimeout(() => setReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [pdfUrl]);

  // Handle Forward Search (Jump to Location)
  useEffect(() => {
      if (syncTexCoords && defaultLayoutPluginInstance.toolbarPluginInstance.pageNavigationPluginInstance) {
          // Create a unique key for these coords
          const coordsKey = `${syncTexCoords.page}-${syncTexCoords.x}-${syncTexCoords.y}`;
          
          // Check if we've already processed these exact coords
          if (lastCoordsRef.current === coordsKey) {
              return; // Skip if same coords
          }
          
          lastCoordsRef.current = coordsKey;
          
          // Clear any existing timer
          if (highlightTimerRef.current) {
              clearTimeout(highlightTimerRef.current);
              highlightTimerRef.current = null;
          }
          
          const { page } = syncTexCoords;
          // SyncTeX pages are 1-based. jumpToPage is 0-based.
          const pageIndex = Math.max(0, page - 1);
          defaultLayoutPluginInstance.toolbarPluginInstance.pageNavigationPluginInstance.jumpToPage(pageIndex);
          
          // Show visual feedback
          setShowSyncHighlight(true);
          highlightTimerRef.current = setTimeout(() => {
              setShowSyncHighlight(false);
              highlightTimerRef.current = null;
          }, 1500);
      }
  }, [syncTexCoords, defaultLayoutPluginInstance]);
  
  // Cleanup on unmount
  useEffect(() => {
      return () => {
          if (highlightTimerRef.current) {
              clearTimeout(highlightTimerRef.current);
              highlightTimerRef.current = null;
          }
      };
  }, []);

  const handleDocumentClick = (e: React.MouseEvent) => {
     if (e.ctrlKey && onSyncTexInverse) {
         const target = e.target as HTMLElement;
         
         // Try multiple ways to find the page layer and number
         let pageLayer = target.closest('.rpv-core__page-layer');
         
         // If not found, try alternative selectors
         if (!pageLayer) {
             pageLayer = target.closest('[data-testid^="core__page-layer"]');
         }

         if (pageLayer) {
             const rect = pageLayer.getBoundingClientRect();
             const x = e.clientX - rect.left;
             const y = e.clientY - rect.top;

             // Try multiple methods to get page number
             let pageNumberStr = pageLayer.getAttribute('data-page-number');
             
             if (!pageNumberStr) {
                 // Try aria-label
                 const ariaLabel = pageLayer.getAttribute('aria-label');
                 if (ariaLabel) {
                     const match = ariaLabel.match(/page\s+(\d+)/i);
                     if (match) pageNumberStr = match[1];
                 }
             }
             
             if (!pageNumberStr) {
                 // Try to get from class name like rpv-core__page-layer--1
                 const classMatch = pageLayer.className.match(/page-layer--(\d+)/);
                 if (classMatch) pageNumberStr = classMatch[1];
             }
             
             if (!pageNumberStr) {
                 // Last resort: find page index from siblings
                 const parent = pageLayer.parentElement;
                 if (parent) {
                     const pages = Array.from(parent.children);
                     const index = pages.indexOf(pageLayer);
                     if (index >= 0) pageNumberStr = String(index);
                 }
             }
             
             if (pageNumberStr) {
                 const page = parseInt(pageNumberStr, 10);
                 onSyncTexInverse(page + 1, x, y);
             }
         }
     }
  };

  if (!pdfUrl) {
    return <EmptyState message="No PDF loaded." />;
  }

  return (
    <Box h="100%" bg="dark.8" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }} onClickCapture={handleDocumentClick}>
      {/* SyncTeX Visual Feedback Overlay */}
      {showSyncHighlight && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            pointerEvents: 'none',
            border: '3px solid #339af0',
            animation: 'syncPulse 1.5s ease-in-out',
            boxShadow: '0 0 20px rgba(51, 154, 240, 0.6)',
          }}
        />
      )}
      
      {/* Ο Worker χρειάζεται για να γίνει το parsing του PDF */}
      <Worker workerUrl={WORKER_URL}>
        {/* Χρησιμοποιούμε το 'rpv-core__viewer--dark' class για native Dark Mode */}
        <div
            style={{
                height: '100%',
                width: '100%',
                backgroundColor: '#2C2E33', // Mantine dark.7
            }}
            className="rpv-core__viewer--dark"
        >
            {ready ? (
                <Viewer
                    fileUrl={pdfUrl}
                    plugins={[defaultLayoutPluginInstance]}
                    theme="dark"
                    onDocumentLoad={() => console.log('PDF Loaded Successfully')}
                />
            ) : (
                 <LoadingOverlay visible={true} overlayProps={{ radius: "sm", blur: 2 }} />
            )}
        </div>
      </Worker>
    </Box>
  );
});
