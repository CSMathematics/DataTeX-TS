import { useState, useEffect } from 'react';
import { Box, Text, LoadingOverlay } from '@mantine/core';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Εισαγωγή των CSS της βιβλιοθήκης
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

// --- Worker URL Configuration ---
const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

interface PdfPreviewProps {
  pdfUrl: string | null;
  onSyncTexInverse?: (page: number, x: number, y: number) => void;
  syncTexCoords?: { page: number, x: number, y: number } | null;
}

export function PdfPreview({ pdfUrl, onSyncTexInverse, syncTexCoords }: PdfPreviewProps) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  
  // State για να ξέρουμε πότε φορτώνει το PDF
  const [ready, setReady] = useState(false);

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
          const { page } = syncTexCoords;
          // SyncTeX pages are 1-based. jumpToPage is 0-based.
          const pageIndex = Math.max(0, page - 1);
          defaultLayoutPluginInstance.toolbarPluginInstance.pageNavigationPluginInstance.jumpToPage(pageIndex);
      }
  }, [syncTexCoords, defaultLayoutPluginInstance]);

  const handleDocumentClick = (e: React.MouseEvent) => {
     if (e.ctrlKey && onSyncTexInverse) {
         // This is a rough approximation.
         // Ideally we need the page number and relative coordinates.
         // @react-pdf-viewer renders pages as divs with `data-testid="page-layer-X"` or similar structure.
         // We try to find the closest .rpv-core__page-layer element.

         const target = e.target as HTMLElement;
         const pageLayer = target.closest('.rpv-core__page-layer');

         if (pageLayer) {
             const rect = pageLayer.getBoundingClientRect();
             const x = e.clientX - rect.left;
             const y = e.clientY - rect.top;

             // Get page number from aria-label or data attribute if available.
             // DefaultLayout puts `data-page-number` on `.rpv-core__page-layer`.
             const pageNumberStr = pageLayer.getAttribute('data-page-number');
             if (pageNumberStr) {
                 const page = parseInt(pageNumberStr, 10);
                 // We pass these to the parent. Note these are screen coordinates relative to the page div.
                 // SyncTeX expects points. PDF usually 72dpi.
                 // Viewer scaling affects this.
                 // This is a "best effort" inverse search trigger.
                 onSyncTexInverse(page + 1, x, y);
             }
         }
     }
  };

  if (!pdfUrl) {
    return (
      <Box h="100%" display="flex" style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }} bg="dark.8">
        <Text c="dimmed" size="sm">No PDF loaded.</Text>
      </Box>
    );
  }

  return (
    <Box h="100%" bg="dark.8" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClickCapture={handleDocumentClick}>
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
}
