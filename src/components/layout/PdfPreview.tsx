import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, LoadingOverlay, Text, ActionIcon, Group, Tooltip } from '@mantine/core';
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfPreviewProps {
  pdfUrl: string | null;
}

export function PdfPreview({ pdfUrl }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 3.0));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  if (!pdfUrl) {
    return (
      <Box h="100%" display="flex" style={{ alignItems: 'center', justifyContent: 'center' }} bg="gray.1">
        <Text c="dimmed">No PDF available. Compile the document to generate a preview.</Text>
      </Box>
    );
  }

  return (
    <Box h="100%" display="flex" style={{ flexDirection: 'column' }} bg="gray.2">
      <Group justify="space-between" p="xs" bg="white" style={{ borderBottom: '1px solid #dee2e6' }}>
        <Group>
          <Tooltip label="Zoom Out">
             <ActionIcon variant="light" onClick={handleZoomOut}><ZoomOut size={16} /></ActionIcon>
          </Tooltip>
          <Text size="sm" style={{ userSelect: 'none' }}>{Math.round(scale * 100)}%</Text>
          <Tooltip label="Zoom In">
            <ActionIcon variant="light" onClick={handleZoomIn}><ZoomIn size={16} /></ActionIcon>
          </Tooltip>
        </Group>
        <Group>
          <Tooltip label="Rotate">
             <ActionIcon variant="light" onClick={handleRotate}><RotateCw size={16} /></ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <Box style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: '20px' }} bg="gray.3">
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadStart={() => setLoading(true)}
          loading={<LoadingOverlay visible={loading} />}
          error={<Text c="red">Failed to load PDF.</Text>}
        >
          {Array.from(new Array(numPages), (_, index) => (
            <Box key={`page_${index + 1}`} mb="md" style={{ boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
              <Page
                pageNumber={index + 1}
                scale={scale}
                rotate={rotation}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </Box>
          ))}
        </Document>
      </Box>
    </Box>
  );
}
