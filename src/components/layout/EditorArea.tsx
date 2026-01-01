import React, { useMemo, useCallback } from 'react';
import { Stack, ScrollArea, Group, Box, Text, ActionIcon, Tooltip, Menu } from "@mantine/core";
import Editor, { OnMount } from "@monaco-editor/react";
import { useDroppable } from '@dnd-kit/core';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileCode, faBookOpen, faCog, faImage, faFile,
  faTimes, faPlay, faCode, faStop, faHome, faChevronRight,
  faFilePdf, faArrowRight, faCopy, faSave, faUndo, faRedo, faSearch, faCut, faPaste
} from "@fortawesome/free-solid-svg-icons";
import { IconLayoutBottombarCollapseFilled, IconLayoutSidebarLeftCollapseFilled } from '@tabler/icons-react';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { TableDataView } from "../database/TableDataView";
import { AppTab } from "./Sidebar"; 
import { StartPage } from "./StartPage";
import { EditorToolbar } from "./EditorToolbar";
import { LeftMathToolbar } from "./LeftMathToolbar";
import { EditorSettings } from '../../hooks/useSettings';
import { LogPanel } from "../ui/LogPanel";
import { LogEntry } from "../../utils/logParser";
import { TexlabLspClient } from "../../services/lspClient";

interface EditorAreaProps {
  files: AppTab[];
  activeFileId: string;
  onFileSelect: (id: string) => void;
  onFileClose: (id: string, e?: React.MouseEvent) => void;
  onCloseFiles?: (ids: string[]) => void;
  onContentChange: (id: string, content: string) => void;
  onMount: OnMount;
  showPdf: boolean;
  onTogglePdf: () => void;
  isTexFile: boolean;
  onCompile?: (engine?: string) => void;
  isCompiling?: boolean;
  onStopCompile?: () => void;
  onSave?: () => void;
  
  // Start Page Props
  onCreateEmpty: () => void;
  onOpenWizard: () => void;
  onCreateFromTemplate: (code: string) => void;

  recentProjects?: string[];
  onOpenRecent?: (path: string) => void;
  editorSettings?: EditorSettings;

  // Log Panel Props
  logEntries?: LogEntry[];
  showLogPanel?: boolean;
  onCloseLogPanel?: () => void;
  onJumpToLine?: (line: number) => void;

  // New Props
  onCursorChange?: (line: number, column: number) => void;
  onSyncTexForward?: (line: number, column: number) => void;
  spellCheckEnabled?: boolean;
  onOpenFileFromTable?: (path: string) => void;
  lspClient?: TexlabLspClient | null;
}

const getFileIcon = (name: string, type: string) => {
    if (type === 'start-page') return <FontAwesomeIcon icon={faHome} style={{ width: 14, height: 14, color: "#1f8ee9ff" }} />;
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

const TabItem = React.memo(({
    file, activeFileId, onSelect, onClose, onCloseOthers, onCloseRight, onCopyPath
}: {
    file: AppTab,
    activeFileId: string,
    onSelect: (id: string) => void,
    onClose: (id: string, e?: React.MouseEvent) => void,
    onCloseOthers: (id: string) => void,
    onCloseRight: (id: string) => void,
    onCopyPath: (id: string) => void
}) => {
    const [menuOpened, setMenuOpened] = React.useState(false);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        onSelect(file.id); // Select on right click too
        setMenuOpened(true);
    };

    return (
        <Menu shadow="md" width={200} opened={menuOpened} onChange={setMenuOpened}>
            <Menu.Target>
                <Box
                    onContextMenu={handleContextMenu}
                    onClick={() => onSelect(file.id)}
                    py={6} px={12}
                    bg={file.id === activeFileId ? "dark.7" : "transparent"}
                    style={{
                        borderTop: file.id === activeFileId ? "2px solid #339af0" : "2px solid transparent",
                        borderRight: "1px solid var(--mantine-color-dark-6)",
                        borderTopRightRadius: 1, borderTopLeftRadius: 1,
                        cursor: "pointer", minWidth: 120,
                    }}
                >
                    {/* Hidden Menu Target Overlay for positioning */}
                    <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

                    <Group gap={8} wrap="nowrap">
                        {getFileIcon(file.title, file.type)}
                        <Text size="xs" c={file.id === activeFileId ? "white" : "dimmed"}>{file.title}{file.isDirty ? ' ●' : ''}</Text>
                        <ActionIcon size="xs" variant="transparent" color="gray" className="close-tab" onClick={(e) => onClose(file.id, e)} style={{ opacity: file.id === activeFileId ? 1 : 0.5 }}>
                            <FontAwesomeIcon icon={faTimes} style={{ width: 12, height: 12 }} />
                        </ActionIcon>
                    </Group>
                </Box>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item leftSection={<FontAwesomeIcon icon={faTimes} style={{ width: 14, height: 14 }} />} onClick={() => onCloseOthers(file.id)}>
                    Close Others
                </Menu.Item>
                <Menu.Item leftSection={<FontAwesomeIcon icon={faArrowRight} style={{ width: 14, height: 14 }} />} onClick={() => onCloseRight(file.id)}>
                    Close to the Right
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<FontAwesomeIcon icon={faCopy} style={{ width: 14, height: 14 }} />} onClick={() => onCopyPath(file.id)}>
                    Copy Path
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
});

export const EditorArea = React.memo<EditorAreaProps>(({ 
  files, activeFileId, onFileSelect, onFileClose, onCloseFiles,
  onContentChange, onMount, onTogglePdf, isTexFile, onCompile, isCompiling, onStopCompile, onSave,
  onCreateEmpty, onOpenWizard, onCreateFromTemplate,
  recentProjects, onOpenRecent,
  editorSettings,
  logEntries, showLogPanel, onCloseLogPanel, onJumpToLine,
  onCursorChange, onSyncTexForward, spellCheckEnabled,
  onOpenFileFromTable,
  lspClient: _lspClient // Prefixed with underscore to indicate intentionally unused
}) => {
  
  const activeFile = files.find(f => f.id === activeFileId);
  const [editorInstance, setEditorInstance] = React.useState<any>(null);

  // Toolbar visibility states
  const [showLeftMathToolbar, setShowLeftMathToolbar] = React.useState(true);
  const [showTopEditorToolbar, setShowTopEditorToolbar] = React.useState(true);

  // Local state for compile engine
  const [selectedEngine, setSelectedEngine] = React.useState<string>('pdflatex');

  // --- Memoized Handlers for Performance ---
  const handleSelectEngine = useCallback((engine: string) => setSelectedEngine(engine), []);
  const handleToggleTopToolbar = useCallback(() => setShowTopEditorToolbar(prev => !prev), []);
  const handleToggleMathToolbar = useCallback(() => setShowLeftMathToolbar(prev => !prev), []);
  const handleSaveClick = useCallback(() => onSave?.(), [onSave]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    setEditorInstance(editor);

    // Listen for cursor changes
    editor.onDidChangeCursorPosition((e) => {
        if (onCursorChange) {
            onCursorChange(e.position.lineNumber, e.position.column);
        }
    });

    // Handle SyncTeX Forward Search (Ctrl + Click)
    editor.onMouseDown((e: any) => {
        if (e.event.ctrlKey && e.target.position) {
             const { lineNumber, column } = e.target.position;
             
             // Add visual feedback - use more visible inline style
             const decoration = editor.deltaDecorations([], [{
                 range: new monaco.Range(lineNumber, 1, lineNumber, Number.MAX_VALUE),
                 options: {
                     isWholeLine: true,
                     inlineClassName: 'synctex-highlight-line',
                     linesDecorationsClassName: 'synctex-glyph',
                     className: 'synctex-highlight-line'
                 }
             }]);
             
             // Remove decoration after animation
             setTimeout(() => {
                 editor.deltaDecorations(decoration, []);
             }, 1200);
             
             if (onSyncTexForward) {
                 onSyncTexForward(lineNumber, column);
             }
        }
    });



    // Handle Ctrl+S for saving
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (onSave) {
            onSave();
        }
    });

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

  // Handle Spell Check (Naive implementation via DOM)
  React.useEffect(() => {
      // Monaco renders lines in "view-lines" class.
      // We can try to set spellcheck on the textarea or the contenteditable div if available.
      // Monaco uses a hidden textarea for input.
      if (editorInstance) {
          const domNode = editorInstance.getDomNode();
          if (domNode) {
              // Try to find the input area
              const textArea = domNode.querySelector('textarea.inputarea');
              if (textArea) {
                  textArea.setAttribute('spellcheck', spellCheckEnabled ? 'true' : 'false');
              }
              // Also try the main container, though Monaco's custom rendering might ignore it.
              // However, this signals "intent" and is the standard way to try to enable browser spellcheck in editors.
          }
      }
  }, [editorInstance, spellCheckEnabled]);

  const handleCloseOthers = useCallback((currentId: string) => {
      const idsToClose = files
          .filter(f => f.id !== currentId && f.type !== 'start-page')
          .map(f => f.id);

      if (onCloseFiles && idsToClose.length > 0) {
          onCloseFiles(idsToClose);
      } else {
          // Fallback if onCloseFiles is not provided, though race condition exists
          idsToClose.forEach(id => onFileClose(id));
      }
  }, [files, onCloseFiles, onFileClose]);

  const handleCloseRight = useCallback((currentId: string) => {
      const index = files.findIndex(f => f.id === currentId);
      if (index !== -1) {
          const idsToClose = files
              .slice(index + 1)
              .filter(f => f.type !== 'start-page')
              .map(f => f.id);

          if (onCloseFiles && idsToClose.length > 0) {
              onCloseFiles(idsToClose);
          } else {
              idsToClose.forEach(id => onFileClose(id));
          }
      }
  }, [files, onCloseFiles, onFileClose]);

  const handleCopyPath = useCallback((path: string) => {
      navigator.clipboard.writeText(path);
  }, []);

  // DnD Drop Zone for Editor
  const { setNodeRef, isOver } = useDroppable({
    id: 'editor-zone',
  });

  const editorOptions = useMemo(() => ({
    minimap: { enabled: editorSettings?.minimap ?? true, scale: 2 },
    fontSize: editorSettings?.fontSize ?? 14,
    fontFamily: editorSettings?.fontFamily ?? "Consolas, monospace",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    theme: editorSettings?.theme ?? "data-tex-dark",
    wordWrap: editorSettings?.wordWrap ?? "on",
    lineNumbers: editorSettings?.lineNumbers ?? "on"
  }), [editorSettings]);

  const handleCompileClick = () => {
      if (onCompile) {
          onCompile(selectedEngine);
      }
  };

  const handleCopy = async () => {
      if (!editorInstance) return;
      const selection = editorInstance.getSelection();
      const model = editorInstance.getModel();
      
      if (selection && model && !selection.isEmpty()) {
          const text = model.getValueInRange(selection);
          if (text) {
              try {
                  await writeText(text);
              } catch (error) {
                  console.error('Failed to copy to clipboard:', error);
              }
          }
      }
  };

  const handleCut = async () => {
      if (!editorInstance) return;
      const selection = editorInstance.getSelection();
      const model = editorInstance.getModel();
      
      if (selection && model && !selection.isEmpty()) {
          const text = model.getValueInRange(selection);
          if (text) {
              try {
                  await writeText(text);
                  editorInstance.executeEdits('toolbar', [{ 
                      range: selection, 
                      text: '', 
                      forceMoveMarkers: true 
                  }]);
              } catch (error) {
                  console.error('Failed to cut to clipboard:', error);
              }
          }
      }
  };

  const handlePaste = async () => {
      if (!editorInstance) return;
      const model = editorInstance.getModel();
      if (!model) return;
      
      try {
          const text = await readText();
          if (text) {
              const selection = editorInstance.getSelection();
              if (selection) {
                  editorInstance.executeEdits('toolbar', [{
                      range: selection,
                      text: text,
                      forceMoveMarkers: true
                  }]);
                  // Move cursor to end of pasted text
                  const lines = text.split('\n');
                  const lastLine = lines[lines.length - 1];
                  const newPosition = {
                      lineNumber: selection.startLineNumber + lines.length - 1,
                      column: lines.length === 1 ? selection.startColumn + lastLine.length : lastLine.length + 1
                  };
                  editorInstance.setPosition(newPosition);
              }
          }
      } catch (e) {
          console.error("Failed to read from clipboard:", e);
      }
  };
  
  const handleUndo = () => {
      editorInstance?.focus();
      editorInstance?.trigger('toolbar', 'undo');
  };
  const handleRedo = () => {
      editorInstance?.focus();
      editorInstance?.trigger('toolbar', 'redo');
  };
  const handleFind = () => {
      editorInstance?.focus();
      editorInstance?.trigger('toolbar', 'actions.find');
  };

  return (
    <Stack gap={0} h="100%" w="100%" style={{ overflow: "hidden" }}>
      {/* Tabs Bar */}
      <ScrollArea type="hover" scrollbarSize={6} bg="dark.8" style={{ borderBottom: "1px solid var(--mantine-color-dark-6)", whiteSpace: 'nowrap', flexShrink: 0 }}>
        <Group gap={1} pt={4} px={4} wrap="nowrap">
          {files.map(file => (
              <TabItem
                key={file.id}
                file={file}
                activeFileId={activeFileId}
                onSelect={onFileSelect}
                onClose={onFileClose}
                onCloseOthers={handleCloseOthers}
                onCloseRight={handleCloseRight}
                onCopyPath={handleCopyPath}
              />
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
                <Group gap="4px">

                  {/* Compile Split Button */}
                  <Group gap={0} style={{ backgroundColor: 'transparent' }}>
                      <Tooltip label={`Compile (${selectedEngine})`}>
                          <ActionIcon 
                              size="xs" 
                              variant="subtle" 
                              color="green" 
                              onClick={handleCompileClick} 
                              loading={isCompiling} 
                              disabled={!isTexFile || isCompiling}
                              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                          >
                              {!isCompiling && <FontAwesomeIcon icon={faPlay} style={{ width: 14, height: 14 }} />}
                          </ActionIcon>
                      </Tooltip>
                      <Menu shadow="md" width={150} position="bottom-end">
                          <Menu.Target>
                              <ActionIcon 
                                  size="xs" 
                                  variant="subtle" 
                                  color="green" 
                                  disabled={!isTexFile || isCompiling}
                                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.1)' }}
                              >
                                  <FontAwesomeIcon icon={faChevronRight} style={{ width: 8, height: 8, transform: 'rotate(90deg)' }} />
                              </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown bg="dark.7">
                              <Menu.Label>Select Engine</Menu.Label>
                              <Menu.Item onClick={() => handleSelectEngine('pdflatex')} rightSection={selectedEngine === 'pdflatex' && <Text size="xs" c="dimmed">✓</Text>}>PdfLaTeX</Menu.Item>
                              <Menu.Item onClick={() => handleSelectEngine('xelatex')} rightSection={selectedEngine === 'xelatex' && <Text size="xs" c="dimmed">✓</Text>}>XeLaTeX</Menu.Item>
                              <Menu.Item onClick={() => handleSelectEngine('lualatex')} rightSection={selectedEngine === 'lualatex' && <Text size="xs" c="dimmed">✓</Text>}>LuaLaTeX</Menu.Item>
                              <Menu.Item onClick={() => handleSelectEngine('pythontex')} rightSection={selectedEngine === 'pythontex' && <Text size="xs" c="dimmed">✓</Text>}>PythonTeX</Menu.Item>
                              <Menu.Divider />
                              <Menu.Item onClick={() => handleSelectEngine('latex')} rightSection={selectedEngine === 'latex' && <Text size="xs" c="dimmed">✓</Text>}>LaTeX</Menu.Item>
                              <Menu.Item onClick={() => handleSelectEngine('bibtex')} rightSection={selectedEngine === 'bibtex' && <Text size="xs" c="dimmed">✓</Text>}>BibTeX</Menu.Item>
                              <Menu.Item onClick={() => handleSelectEngine('biber')} rightSection={selectedEngine === 'biber' && <Text size="xs" c="dimmed">✓</Text>}>Biber</Menu.Item>
                          </Menu.Dropdown>
                      </Menu>
                  </Group>

                  {isCompiling && <Tooltip label="Stop"><ActionIcon size="xs" variant="subtle" color="red" onClick={onStopCompile}><FontAwesomeIcon icon={faStop} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>}
                  {activeFile?.type === 'editor' && isTexFile && <Tooltip label="PDF"><ActionIcon size="xs" variant="subtle" color="gray.4" onClick={onTogglePdf}><FontAwesomeIcon icon={faFilePdf} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>}
                  {/* Editor Toolbars Toggles */}
                  {activeFile?.type === 'editor' && isTexFile && (
                      <>
                        <Tooltip label="Save changes"><ActionIcon size="xs" variant="subtle" color="gray.4" onClick={handleSaveClick}><FontAwesomeIcon icon={faSave} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                        <Box bg="dark.3" h="16px" w="1px"></Box>
                        <Tooltip label="Copy"><ActionIcon size="xs" variant="subtle" color="gray.4" onClick={handleCopy}><FontAwesomeIcon icon={faCopy} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                        <Tooltip label="Cut"><ActionIcon size="xs" variant="subtle" color="gray.4" onClick={handleCut}><FontAwesomeIcon icon={faCut} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                        <Tooltip label="Paste"><ActionIcon size="xs" variant="subtle" color="gray.4" onClick={handlePaste}><FontAwesomeIcon icon={faPaste} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                        <Tooltip label="Undo"><ActionIcon size="xs" variant="subtle" color="gray.4" onClick={handleUndo}><FontAwesomeIcon icon={faUndo} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                        <Tooltip label="Redo"><ActionIcon size="xs" variant="subtle" color="gray.4" onClick={handleRedo}><FontAwesomeIcon icon={faRedo} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>
                        <Tooltip label="Find"><ActionIcon size="xs" variant="subtle" color="gray.4" onClick={handleFind}><FontAwesomeIcon icon={faSearch} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>

                        <Box bg="dark.3" h="16px" w="1px"></Box>
                        <Tooltip label={showTopEditorToolbar ? "Hide Editor Toolbar" : "Show Editor Toolbar"}>
                            <ActionIcon size="xs" variant="subtle" color="gray.4" onClick={handleToggleTopToolbar}>
                                <IconLayoutBottombarCollapseFilled style={{ transform: 'rotate(180deg)' }} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={showLeftMathToolbar ? "Hide Math Sidebar" : "Show Math Sidebar"}>
                            <ActionIcon size="xs" variant="subtle" color="gray.4" onClick={handleToggleMathToolbar}>
                                <IconLayoutSidebarLeftCollapseFilled />
                            </ActionIcon>
                        </Tooltip>
                      </>
                  )}
                </Group>
            </Group>
            {activeFile?.type === 'editor' && isTexFile && editorInstance && showTopEditorToolbar && (
                <EditorToolbar editor={editorInstance} />
            )}
          </Stack>
      )}

      {/* Main Content */}
      <Box ref={setNodeRef} style={{ flex: 1, position: "relative", minWidth: 0, height: "100%", overflow: "hidden", border: isOver ? '2px dashed var(--mantine-primary-color-filled)' : 'none', display: 'flex', flexDirection: 'column' }}>
          {activeFile?.type === 'editor' ? (
             <>
                <Box style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
                    {isTexFile && editorInstance && showLeftMathToolbar && (
                        <LeftMathToolbar editor={editorInstance} />
                    )}
                    <Box style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
                        <Editor
                            path={activeFile.id}
                            height="100%"
                            defaultLanguage="my-latex"
                            defaultValue={activeFile.content}
                            onMount={handleEditorMount}
                            onChange={(value) => onContentChange(activeFile.id, value || '')}
                            options={editorOptions}
                        />
                    </Box>
                </Box>
                {showLogPanel && (
                    <Box h={200} style={{ flexShrink: 0, borderTop: '1px solid var(--mantine-color-dark-4)' }}>
                        <LogPanel
                            entries={logEntries || []}
                            onClose={onCloseLogPanel || (() => {})}
                            onJump={onJumpToLine || (() => {})}
                        />
                    </Box>
                )}
             </>
          ) : activeFile?.type === 'table' ? (
             <TableDataView tableName={activeFile.tableName || ''} onOpenFile={onOpenFileFromTable} />
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
