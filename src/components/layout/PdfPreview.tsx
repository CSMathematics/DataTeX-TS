import { useState, useEffect, useRef } from 'react';
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
    return (
      <Box h="100%" display="flex" style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }} bg="dark.8">
        <Text c="dimmed" size="sm">No PDF loaded.</Text>
      </Box>
    );
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
      
      {/* CSS Animation for Sync Pulse */}
      <style>{`
        @keyframes syncPulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(0.98);
          }
          100% {
            opacity: 0;
            transform: scale(1);
          }
        }
      `}</style>
    </Box>
  );
}
