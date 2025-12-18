import React from 'react';
import { Stack, ScrollArea, Group, Box, Text, ActionIcon, Tooltip, Loader } from "@mantine/core";
import Editor, { OnMount } from "@monaco-editor/react";
import { 
    FileCode, BookOpen, FileCog, FileText, Image as ImageIcon, File, Table2, 
    X, Play, PanelRight, Code2, Puzzle, Square, Home, ChevronRight 
} from "lucide-react";
import { TableDataView } from "../database/TableDataView";
import { AppTab } from "./Sidebar"; 
import { StartPage } from "./StartPage"; // Import StartPage

interface EditorAreaProps {
  files: AppTab[];
  activeFileId: string;
  onFileSelect: (id: string) => void;
  onFileClose: (id: string, e: React.MouseEvent) => void;
  onContentChange: (id: string, content: string) => void;
  onMount: OnMount;
  showPdf: boolean;
  onTogglePdf: () => void;
  isTexFile: boolean;
  onCompile?: () => void;
  isCompiling?: boolean;
  onStopCompile?: () => void;
  onOpenGallery: () => void;
  
  // Start Page Props
  onCreateEmpty: () => void;
  onOpenWizard: () => void;
  onCreateFromTemplate: (code: string) => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({ 
  files, activeFileId, onFileSelect, onFileClose, onContentChange, onMount, 
  showPdf, onTogglePdf, isTexFile, onCompile, isCompiling, onStopCompile, onOpenGallery,
  onCreateEmpty, onOpenWizard, onCreateFromTemplate
}) => {
  
  const activeFile = files.find(f => f.id === activeFileId);

  const getFileIcon = (name: string, type: string) => {
    if (type === 'start-page') return <Home size={14} color="#fab005" />;
    const ext = name.split('.').pop()?.toLowerCase();
    switch(ext) {
        case 'tex': return <FileCode size={14} color="#4dabf7" />;
        case 'bib': return <BookOpen size={14} color="#fab005" />;
        case 'sty': return <FileCog size={14} color="#be4bdb" />;
        case 'pdf': return <FileText size={14} color="#fa5252" />;
        case 'png':
        case 'jpg': return <ImageIcon size={14} color="#40c057" />;
        default: return <File size={14} color="#868e96" />;
    }
  };

  return (
    <Stack gap={0} h="100%" w="100%" style={{ overflow: "hidden" }}>
      {/* Tabs Bar */}
      <ScrollArea type="hover" scrollbarSize={6} bg="dark.8" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)", whiteSpace: 'nowrap', flexShrink: 0 }}>
        <Group gap={1} pt={4} px={4} wrap="nowrap">
          {files.map(file => (
            <Box
              key={file.id}
              py={6} px={12}
              bg={file.id === activeFileId ? "dark.7" : "transparent"}
              style={{
                borderTop: file.id === activeFileId ? "2px solid #339af0" : "2px solid transparent",
                borderRight: "1px solid var(--mantine-color-dark-6)",
                borderTopRightRadius: 4, borderTopLeftRadius: 4,
                cursor: "pointer", minWidth: 120,
              }}
              onClick={() => onFileSelect(file.id)}
            >
              <Group gap={8} wrap="nowrap">
                {getFileIcon(file.title, file.type)}
                <Text size="xs" c={file.id === activeFileId ? "white" : "dimmed"}>{file.title}</Text>
                <ActionIcon size="xs" variant="transparent" color="gray" className="close-tab" onClick={(e) => onFileClose(file.id, e)} style={{ opacity: file.id === activeFileId ? 1 : 0.5 }}>
                  <X size={12} />
                </ActionIcon>
              </Group>
            </Box>
          ))}
        </Group>
      </ScrollArea>

      {/* Toolbar (Κρυμμένο αν είναι Start Page) */}
      {activeFile?.type !== 'start-page' && (
          <Group h={32} px="md" bg="dark.7" justify="space-between" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)", flexShrink: 0 }}>
              <Group gap={4}>
                <Text size="xs" c="dimmed">DataTex</Text>
                {activeFile && <><ChevronRight size={12} color="gray" /><Text size="xs" c="white" truncate>{activeFile.title}</Text></>}
              </Group>
              <Group gap="xs">
                 {isCompiling && <Tooltip label="Stop"><ActionIcon size="sm" variant="subtle" color="red" onClick={onStopCompile}><Square size={14} fill="currentColor" /></ActionIcon></Tooltip>}
                 <Tooltip label="Compile"><ActionIcon size="sm" variant="subtle" color="green" onClick={onCompile} loading={isCompiling} disabled={!isTexFile || isCompiling}>{!isCompiling && <Play size={14} />}</ActionIcon></Tooltip>
                 {activeFile?.type === 'editor' && isTexFile && <Tooltip label="Package Gallery"><ActionIcon size="sm" variant="subtle" color="blue" onClick={onOpenGallery}><Puzzle size={14} /></ActionIcon></Tooltip>}
                 {activeFile?.type === 'editor' && isTexFile && <Tooltip label="PDF"><ActionIcon size="sm" variant="subtle" color="blue" onClick={onTogglePdf}><PanelRight size={14} /></ActionIcon></Tooltip>}
              </Group>
          </Group>
      )}

      {/* Main Content */}
      <Box style={{ flex: 1, position: "relative", minWidth: 0, height: "100%", overflow: "hidden" }}>
          {activeFile?.type === 'editor' ? (
             <Editor path={activeFile.id} height="100%" defaultLanguage="my-latex" defaultValue={activeFile.content} value={activeFile.content} onMount={onMount} onChange={(value) => onContentChange(activeFile.id, value || '')} options={{ minimap: { enabled: true, scale: 0.75 }, fontSize: 14, fontFamily: "Consolas, monospace", scrollBeyondLastLine: false, automaticLayout: true, theme: "data-tex-dark", wordWrap: "on" }} />
          ) : activeFile?.type === 'table' ? (
             <TableDataView tableName={activeFile.tableName || ''} />
          ) : activeFile?.type === 'start-page' ? (
             <StartPage 
                onCreateEmpty={onCreateEmpty}
                onOpenWizard={onOpenWizard}
                onCreateFromTemplate={onCreateFromTemplate}
             />
          ) : (
             <Box h="100%" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                <Code2 size={48} color="#373A40" />
                <Text c="dimmed" mt="md">Select a file</Text>
             </Box>
          )}
      </Box>
    </Stack>
  );
};