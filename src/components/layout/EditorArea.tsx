import React from 'react';
import { Stack, ScrollArea, Group, Box, Text, ActionIcon, Tooltip } from "@mantine/core";
import Editor, { OnMount } from "@monaco-editor/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileCode, faBookOpen, faCog, faImage, faFile,
  faTimes, faPlay, faColumns, faCode, faStop, faHome, faChevronRight,
  faFilePdf
} from "@fortawesome/free-solid-svg-icons";
import { TableDataView } from "../database/TableDataView";
import { AppTab } from "./Sidebar"; 
import { StartPage } from "./StartPage";
import { EditorToolbar } from "./EditorToolbar";
import { EditorSettings } from '../../hooks/useSettings';

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
  
  // Start Page Props
  onCreateEmpty: () => void;
  onOpenWizard: () => void;
  onCreateFromTemplate: (code: string) => void;

  recentProjects?: string[];
  onOpenRecent?: (path: string) => void;
  editorSettings?: EditorSettings;
}

export const EditorArea = React.memo<EditorAreaProps>(({
  files, activeFileId, onFileSelect, onFileClose, onContentChange, onMount, 
  onTogglePdf, isTexFile, onCompile, isCompiling, onStopCompile,
  onCreateEmpty, onOpenWizard, onCreateFromTemplate, recentProjects, onOpenRecent,
  editorSettings
}) => {
  
  const activeFile = files.find(f => f.id === activeFileId);
  const [editorInstance, setEditorInstance] = React.useState<any>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    setEditorInstance(editor);
    if (onMount) onMount(editor, monaco);
  };

  // Update editor options when settings change
  React.useEffect(() => {
    if (editorInstance && editorSettings) {
        editorInstance.updateOptions({
            fontSize: editorSettings.fontSize,
            fontFamily: editorSettings.fontFamily,
            wordWrap: editorSettings.wordWrap,
            minimap: { enabled: editorSettings.minimap, scale: 2 },
            lineNumbers: editorSettings.lineNumbers,
        });
        // Theme is set globally in App.tsx via monaco.editor.setTheme
    }
  }, [editorInstance, editorSettings]);

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

      {/* Toolbar */}
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
             <Box style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
                 <Box style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
                    <Editor
                        path={activeFile.id}
                        height="100%"
                        defaultLanguage="my-latex"
                        defaultValue={activeFile.content}
                        onMount={handleEditorMount}
                        onChange={(value) => onContentChange(activeFile.id, value || '')}
                        options={{
                            minimap: { enabled: editorSettings?.minimap ?? true, scale: 2 },
                            fontSize: editorSettings?.fontSize ?? 14,
                            fontFamily: editorSettings?.fontFamily ?? "Consolas, monospace",
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            theme: editorSettings?.theme ?? "data-tex-dark",
                            wordWrap: editorSettings?.wordWrap ?? "on",
                            lineNumbers: editorSettings?.lineNumbers ?? "on"
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
});