import React, { useMemo, useCallback } from 'react';
import { Stack, ScrollArea, Group, Box, Text, ActionIcon, Tooltip, Menu } from "@mantine/core";
import Editor, { OnMount } from "@monaco-editor/react";
import { useDroppable } from '@dnd-kit/core';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileCode, faBookOpen, faCog, faImage, faFile,
  faTimes, faPlay, faCode, faStop, faHome, faChevronRight,
  faFilePdf, faArrowRight, faCopy
} from "@fortawesome/free-solid-svg-icons";
import { IconLayoutBottombarCollapseFilled, IconLayoutSidebarLeftCollapseFilled } from '@tabler/icons-react';
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
                        borderTopRightRadius: 4, borderTopLeftRadius: 4,
                        cursor: "pointer", minWidth: 120,
                    }}
                >
                    {/* Hidden Menu Target Overlay for positioning */}
                    <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

                    <Group gap={8} wrap="nowrap">
                        {getFileIcon(file.title, file.type)}
                        <Text size="xs" c={file.id === activeFileId ? "white" : "dimmed"}>{file.title}</Text>
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
  onContentChange, onMount, onTogglePdf, isTexFile, onCompile, isCompiling, onStopCompile,
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

    // === LSP Integration ===
    // DISABLED: Texlab returns empty completions despite proper configuration
    // Infrastructure is complete and ready - texlab requires either:
    //   1. .texlabroot file in project root, OR
    //   2. Incremental sync implementation (complex diff algorithm)
    // Using snippet-based completion for now (working perfectly)
    /*
    if (lspClient && lspClient.isReady()) {
        console.log('🔌 Registering LSP providers for Monaco');

        // Get existing snippet provider suggestions
        const getSnippetSuggestions = (model: any, position: any) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };

            return [
                {
                    label: 'itemize',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: ['\\begin{itemize}', '\t\\item $0', '\\end{itemize}'].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Bulleted list environment',
                    range
                },
                {
                    label: 'enumerate',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: ['\\begin{enumerate}', '\t\\item $0', '\\end{enumerate}'].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Numbered list environment',
                    range
                },
                {
                    label: 'equation',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: ['\\begin{equation}', '\t$0', '\\end{equation}'].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Equation environment',
                    range
                },
                {
                    label: 'align',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: ['\\begin{align}', '\t$0', '\\end{align}'].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Align environment',
                    range
                },
                {
                    label: 'figure',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: ['\\begin{figure}[h]', '\t\\centering', '\t\\includegraphics[width=0.8\\textwidth]{$1}', '\t\\caption{$2}', '\t\\label{fig:$3}', '\\end{figure}'].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Figure environment',
                    range
                },
                {
                    label: 'table',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: ['\\begin{table}[h]', '\t\\centering', '\t\\begin{tabular}{|c|c|}', '\t\t\\hline', '\t\t$1 & $2 \\\\', '\t\t\\hline', '\t\\end{tabular}', '\t\\caption{$3}', '\t\\label{tab:$4}', '\\end{table}'].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Table environment',
                    range
                },
            ];
        };

        // Register COMBINED Completion Provider (LSP + Snippets)
        monaco.languages.registerCompletionItemProvider('my-latex', {
            triggerCharacters: ['\\', '{', '['],
            async provideCompletionItems(model: any, position: any) {
                console.log('🔍 Completion triggered at', position.lineNumber, position.column);
                
                // Always provide snippets as fallback
                const snippetSuggestions = getSnippetSuggestions(model, position);
                
                // Try to get LSP completions
                if (!lspClient.isReady()) {
                    console.warn('⚠️ LSP not ready, returning only snippets');
                    return { suggestions: snippetSuggestions };
                }

                try {
                    const uri = `file://${model.uri.path}`;
                    console.log('📡 Requesting LSP completions for', uri);
                    
                    const items = await lspClient.completion(uri, position.lineNumber, position.column);
                    console.log('✅ LSP returned', items.length, 'items');

                    const lspSuggestions = items.map(item => ({
                        label: item.label,
                        kind: item.kind,
                        insertText: item.insertText || item.label,
                        detail: item.detail,
                        documentation: typeof item.documentation === 'string' 
                            ? item.documentation 
                            : item.documentation?.value,
                        sortText: item.sortText,
                        filterText: item.filterText,
                    }));

                    // Combine LSP suggestions with snippets
                    const combined = [...lspSuggestions, ...snippetSuggestions];
                    console.log('📝 Total suggestions:', combined.length);
                    
                    return { suggestions: combined };
                } catch (error) {
                    console.error('❌ LSP completion error:', error);
                    // Return snippets on error
                    return { suggestions: snippetSuggestions };
                }
            }
        });

        // Register Hover Provider
        monaco.languages.registerHoverProvider('my-latex', {
            async provideHover(model: any, position: any) {
                if (!lspClient.isReady()) return null;

                try {
                    const uri = `file://${model.uri.path}`;
                    const hover = await lspClient.hover(uri, position.lineNumber, position.column);

                    if (!hover) return null;

                    // Parse hover contents
                    let contents: string;
                    if (typeof hover.contents === 'string') {
                        contents = hover.contents;
                    } else if (Array.isArray(hover.contents)) {
                        contents = hover.contents.map(c => 
                            typeof c === 'string' ? c : c.value
                        ).join('\n\n');
                    } else {
                        contents = hover.contents.value;
                    }

                    return {
                        contents: [{ value: contents }],
                        range: hover.range
                    };
                } catch (error) {
                    console.error('LSP hover error:', error);
                    return null;
                }
            }
        });

        // Register Definition Provider  
        monaco.languages.registerDefinitionProvider('my-latex', {
            async provideDefinition(model: any, position: any) {
                if (!lspClient.isReady()) return null;

                try {
                    const uri = `file://${model.uri.path}`;
                    const location = await lspClient.definition(uri, position.lineNumber, position.column);

                    if (!location) return null;

                    return {
                        uri: monaco.Uri.parse(location.uri),
                        range: location.range
                    };
                } catch (error) {
                    console.error('LSP definition error:', error);
                    return null;
                }
            }
        });

        console.log('✅ LSP providers registered successfully');
    }
    */

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

  // === LSP Document Synchronization ===
  // DISABLED: LSP integration disabled - see above
  /*
  // Notify LSP when active file changes (didOpen)
  React.useEffect(() => {
      if (lspClient && lspClient.isReady() && activeFile && activeFile.type === 'editor' && editorInstance) {
          const uri = `file://${activeFile.id}`;
          const text = editorInstance.getValue() || activeFile.content || '';
          
          console.log(`📂 Triggering didOpen for ${uri}`);
          lspClient.didOpen(uri, 'latex', text);
      }
  }, [activeFileId, lspClient, editorInstance]);

  // Notify LSP when content changes (didChange) - debounced
  React.useEffect(() => {
      if (!editorInstance || !lspClient || !lspClient.isReady() || !activeFile || activeFile.type !== 'editor') {
          return;
      }

      const disposable = editorInstance.onDidChangeModelContent(() => {
          const text = editorInstance.getValue();
          const uri = `file://${activeFile.id}`;
          
          // Debounce to avoid too many requests
          const timeoutId = setTimeout(() => {
              console.log(`📝 Triggering didChange for ${uri}`);
              lspClient.didChange(uri, text);
          }, 500);

          return () => clearTimeout(timeoutId);
      });

      return () => disposable.dispose();
  }, [editorInstance, lspClient, activeFile]);
  */

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
                <Group gap="xs">

                  {isCompiling && <Tooltip label="Stop"><ActionIcon size="sm" variant="subtle" color="red" onClick={onStopCompile}><FontAwesomeIcon icon={faStop} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>}
                  <Tooltip label="Compile"><ActionIcon size="xs" variant="subtle" color="green" onClick={onCompile} loading={isCompiling} disabled={!isTexFile || isCompiling}>{!isCompiling && <FontAwesomeIcon icon={faPlay} style={{ width: 14, height: 14 }} />}</ActionIcon></Tooltip>
                  {activeFile?.type === 'editor' && isTexFile && <Tooltip label="PDF"><ActionIcon size="xs" variant="subtle" color="gray.4" onClick={onTogglePdf}><FontAwesomeIcon icon={faFilePdf} style={{ width: 14, height: 14 }} /></ActionIcon></Tooltip>}
                  {/* Editor Toolbars Toggles */}
                  {activeFile?.type === 'editor' && isTexFile && (
                      <>
                        <Tooltip label={showTopEditorToolbar ? "Hide Editor Toolbar" : "Show Editor Toolbar"}>
                            <ActionIcon size="xs" variant={showTopEditorToolbar ? "light" : "subtle"} color="gray.4" onClick={() => setShowTopEditorToolbar(!showTopEditorToolbar)}>
                                <IconLayoutBottombarCollapseFilled style={{ transform: 'rotate(180deg)' }} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={showLeftMathToolbar ? "Hide Math Sidebar" : "Show Math Sidebar"}>
                            <ActionIcon size="xs" variant={showLeftMathToolbar ? "light" : "subtle"} color="gray.4" onClick={() => setShowLeftMathToolbar(!showLeftMathToolbar)}>
                                <IconLayoutSidebarLeftCollapseFilled />
                            </ActionIcon>
                        </Tooltip>
                        <Box style={{ width: 1, height: 16, backgroundColor: 'var(--mantine-color-dark-4)' }} />
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
