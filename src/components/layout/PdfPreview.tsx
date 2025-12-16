import { useState, useEffect } from 'react';
import { Box, Text, LoadingOverlay } from '@mantine/core';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';

// Εισαγωγή των CSS της βιβλιοθήκης
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

// --- Worker URL Configuration ---
// Χρησιμοποιούμε CDN με συγκεκριμένη έκδοση (3.11.174) για να αποφύγουμε 
// τα προβλήματα του import '?url' που χτυπάνε ως syntax error στην TypeScript.
const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

interface PdfPreviewProps {
  pdfUrl: string | null;
}

export function PdfPreview({ pdfUrl }: PdfPreviewProps) {
  // Αρχικοποίηση του default layout plugin (Toolbar, Sidebar κλπ)
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

  if (!pdfUrl) {
    return (
      <Box h="100%" display="flex" style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }} bg="dark.8">
        <Text c="dimmed" size="sm">No PDF loaded.</Text>
      </Box>
    );
  }

  return (
    <Box h="100%" bg="dark.8" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                    // onLoadError={(e) => console.error('PDF Load Error:', e)}
                />
            ) : (
                 <LoadingOverlay visible={true} overlayProps={{ radius: "sm", blur: 2 }} />
            )}
        </div>
      </Worker>
    </Box>
  );
}