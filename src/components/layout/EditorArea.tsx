import React from 'react';
import { Stack, ScrollArea, Group, Box, Text, ActionIcon, Tooltip } from "@mantine/core";
import Editor, { OnMount } from "@monaco-editor/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileCode, faBookOpen, faCog, faImage, faFile,
  faTimes, faPlay, faColumns, faCode, faCube, faStop, faHome, faChevronRight,
  faFilePdf
} from "@fortawesome/free-solid-svg-icons";
import { debounce } from "lodash";
import { TableDataView } from "../database/TableDataView";
import { AppTab } from "./Sidebar"; 
import { StartPage } from "./StartPage"; // Import StartPage
import { EditorToolbar } from "./EditorToolbar";
import { SymbolSidebar } from "./SymbolSidebar";
import { SymbolPanel } from "./SymbolPanel";
import { SymbolCategory } from "../wizards/preamble/SymbolDB";

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

  recentProjects?: string[];
  onOpenRecent?: (path: string) => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({ 
  files, activeFileId, onFileSelect, onFileClose, onContentChange, onMount, 
  onTogglePdf, isTexFile, onCompile, isCompiling, onStopCompile, onOpenGallery,
  onCreateEmpty, onOpenWizard, onCreateFromTemplate, recentProjects, onOpenRecent
}) => {
  
  const activeFile = files.find(f => f.id === activeFileId);
  const [editorInstance, setEditorInstance] = React.useState<any>(null);
  const [activeSymbolCategory, setActiveSymbolCategory] = React.useState<SymbolCategory | null>(null);
  const [symbolPanelWidth, setSymbolPanelWidth] = React.useState(250);
  const [isResizingSymbolPanel, setIsResizingSymbolPanel] = React.useState(false);

  const ghostRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const offsetRef = React.useRef(0);

  const startResizingSymbolPanel = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingSymbolPanel(true);

      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          offsetRef.current = rect.left + 40; // Container left + SymbolSidebar width
      }

      if (ghostRef.current) {
          ghostRef.current.style.display = 'block';
          ghostRef.current.style.left = `${e.clientX}px`;
      }
  }, []);

  const stopResizingSymbolPanel = React.useCallback(() => {
      if (isResizingSymbolPanel && ghostRef.current) {
          const currentLeft = parseInt(ghostRef.current.style.left || '0', 10);
          if (currentLeft > 0) {
              // Calculate width relative to the start of the symbol panel
              const newWidth = currentLeft - offsetRef.current;
              if (newWidth > 150 && newWidth < 600) {
                  setSymbolPanelWidth(newWidth);
              }
          }
          ghostRef.current.style.display = 'none';
      }
      setIsResizingSymbolPanel(false);
  }, [isResizingSymbolPanel]);

  const resizeSymbolPanel = React.useCallback(
      (mouseMoveEvent: MouseEvent) => {
          if (isResizingSymbolPanel && ghostRef.current) {
              // Just update the ghost handle position directly
              const x = mouseMoveEvent.clientX;
              // Constrain the ghost handle movement if desired, or let it move freely and clamp on mouseup
              // Clamping here for visual feedback
              const minX = 40 + 150;
              const maxX = 40 + 600;

              if (x >= minX && x <= maxX) {
                 ghostRef.current.style.left = `${x}px`;
              }
          }
      },
      [isResizingSymbolPanel]
  );

  React.useEffect(() => {
      if (isResizingSymbolPanel) {
        window.addEventListener("mousemove", resizeSymbolPanel);
        window.addEventListener("mouseup", stopResizingSymbolPanel);
        document.body.style.cursor = 'col-resize';
      } else {
        document.body.style.cursor = 'default';
      }
      return () => {
          window.removeEventListener("mousemove", resizeSymbolPanel);
          window.removeEventListener("mouseup", stopResizingSymbolPanel);
      };
  }, [isResizingSymbolPanel, resizeSymbolPanel, stopResizingSymbolPanel]);

  // Debounce the content change to improve performance
  const debouncedChange = React.useMemo(
    () => debounce((id: string, val: string) => {
        onContentChange(id, val);
    }, 300),
    [onContentChange]
  );

  React.useEffect(() => {
    return () => {
      debouncedChange.cancel();
    };
  }, [debouncedChange]);

  const handleEditorChange = (value: string | undefined) => {
      if (activeFileId && value !== undefined) {
          debouncedChange(activeFileId, value);
      }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    setEditorInstance(editor);
    if (onMount) onMount(editor, monaco);
  };

  const handleInsertSymbol = (text: string) => {
    if (editorInstance) {
        const selection = editorInstance.getSelection();
        if (!selection) return;
        const op = { range: selection, text: text, forceMoveMarkers: true };
        editorInstance.executeEdits("symbol-panel", [op]);
        editorInstance.focus();
    }
  };

  const getFileIcon = (name: string, type: string) => {
    if (type === 'start-page') return <FontAwesomeIcon icon={faHome} style={{ width: 14, height: 14, color: "#fab005" }} />;
    const ext = name.split('.').pop()?.toLowerCase();
    switch(ext) {
        case 'tex': return <FontAwesomeIcon icon={faFileCode} style={{ width: 14, height: 14, color: "#4dabf7" }} />;
        case 'bib': return <FontAwesomeIcon icon={faBookOpen} style={{ width: 14, height: 14, color: "#fab005" }} />;
        case 'sty': return <FontAwesomeIcon icon={faCog} style={{ width: 14, height: 14, color: "#be4bdb" }} />;
        case 'pdf': return <FontAwesomeIcon icon={faFilePdf} style={{ width: 14, height: 14, color: "#fa5252" }} />;
        case 'png':
        case 'jpg': return <FontAwesomeIcon icon={faImage} style={{ width: 14, height: 14, color: "#40c057" }} />;
        default: return <FontAwesomeIcon icon={faFile} style={{ width: 14, height: 14, color: "#868e96" }} />;
    }
  };

  return (
    <Stack gap={0} h="100%" w="100%" style={{ overflow: "hidden" }}>
      {/* Ghost Handle for Resizing */}
      <Box
        ref={ghostRef}
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: 'var(--mantine-color-blue-6)',
          zIndex: 10000,
          display: 'none',
          pointerEvents: 'none',
          cursor: 'col-resize'
        }}
      />

      {/* Overlay to catch events during resizing */}
      {isResizingSymbolPanel && (
         <Box style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, cursor: 'col-resize', userSelect: 'none' }} />
      )}

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
                  <FontAwesomeIcon icon={faTimes} style={{ width: 12, height: 12 }} />
                </ActionIcon>
              </Group>
            </Box>
          ))}
        </Group>
      </ScrollArea>

      {/* Toolbar (Κρυμμένο αν είναι Start Page) */}
      {activeFile?.type !== 'start-page' && (
          <Stack gap={0} style={{ flexShrink: 0 }}>
            <Group h={32} px="md" bg="dark.7" justify="space-between" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)" }}>
                <Group gap={4}>
                  <Text size="xs" c="dimmed">DataTex</Text>
                  {activeFile && <><FontAwesomeIcon icon={faChevronRight} style={{ width: 12, height: 12, color: "gray" }} /><Text size="xs" c="white" truncate>{activeFile.title}</Text></>}
                </Group>
                <Group gap="xs">
                  {isCompiling && <Tooltip label="Stop"><ActionIcon size="sm" variant="subtle" color="red" onClick={onStopCompile}><FontAwesomeIcon icon={faStop} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>}
                  <Tooltip label="Compile"><ActionIcon size="sm" variant="subtle" color="green" onClick={onCompile} loading={isCompiling} disabled={!isTexFile || isCompiling}>{!isCompiling && <FontAwesomeIcon icon={faPlay} style={{ width: 14, height: 14 }} />}</ActionIcon></Tooltip>
                  {activeFile?.type === 'editor' && isTexFile && <Tooltip label="Package Gallery"><ActionIcon size="sm" variant="subtle" color="#ca3ff5ff" onClick={onOpenGallery}><FontAwesomeIcon icon={faCube} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>}
                  {activeFile?.type === 'editor' && isTexFile && <Tooltip label="PDF"><ActionIcon size="sm" variant="subtle" color="blue" onClick={onTogglePdf}><FontAwesomeIcon icon={faColumns} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>}
                </Group>
            </Group>
            {activeFile?.type === 'editor' && isTexFile && editorInstance && (
                <EditorToolbar editor={editorInstance} />
            )}
          </Stack>
      )}

      {/* Main Content */}
      <Box style={{ flex: 1, position: "relative", minWidth: 0, height: "100%", overflow: "hidden" }}>
          {activeFile?.type === 'editor' ? (
             <Box ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
                 {isTexFile && (
                     <>
                        <SymbolSidebar activeCategory={activeSymbolCategory} onSelectCategory={setActiveSymbolCategory} />
                         <Box
                             style={{
                                 width: activeSymbolCategory ? symbolPanelWidth : 0,
                                 transition: isResizingSymbolPanel ? 'none' : 'width 0.3s ease',
                                 overflow: 'hidden',
                                 display: 'flex',
                                 flexDirection: 'row'
                             }}
                         >
                            {activeSymbolCategory && (
                                <>
                                    <SymbolPanel category={activeSymbolCategory} onInsert={handleInsertSymbol} width={symbolPanelWidth} />
                                    <Box
                                        onMouseDown={startResizingSymbolPanel}
                                        style={{
                                            width: 4,
                                            height: '100%',
                                            cursor: 'col-resize',
                                            backgroundColor: isResizingSymbolPanel ? 'var(--mantine-color-blue-6)' : 'transparent',
                                            transition: 'background-color 0.2s',
                                            borderRight: '1px solid var(--mantine-color-dark-6)',
                                            flexShrink: 0,
                                            zIndex: 10
                                        }}
                                        className="resize-handle-symbol"
                                    />
                                </>
                            )}
                         </Box>
                     </>
                 )}
                 <Box style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
                    <Editor
                        path={activeFile.id}
                        height="100%"
                        defaultLanguage="my-latex"
                        defaultValue={activeFile.content}
                        // Removed value prop to make it uncontrolled
                        onMount={handleEditorMount}
                        onChange={handleEditorChange}
                        options={{
                            minimap: { enabled: true, scale: 2 },
                            fontSize: 14,
                            fontFamily: "Consolas, monospace",
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            theme: "data-tex-dark",
                            wordWrap: "on"
                        }}
                    />
                 </Box>
             </Box>
          ) : activeFile?.type === 'table' ? (
             <TableDataView tableName={activeFile.tableName || ''} />
          ) : activeFile?.type === 'start-page' ? (
             <StartPage 
                onCreateEmpty={onCreateEmpty}
                onOpenWizard={onOpenWizard}
                onCreateFromTemplate={onCreateFromTemplate}
                recentProjects={recentProjects || []}
                onOpenRecent={onOpenRecent || (() => {})}
             />
          ) : (
             <Box h="100%" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                <FontAwesomeIcon icon={faCode} style={{ width: 48, height: 48, color: "#373A40" }} />
                <Text c="dimmed" mt="md">Select a file</Text>
             </Box>
          )}
      </Box>
    </Stack>
  );
};