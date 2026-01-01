import { useState, useEffect, useCallback, useRef } from 'react';
import { Stack, Text, Tabs, Group, ScrollArea, TextInput, Box, Button, Center, Loader } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle, faEye, faBook, faSave, faCode } from '@fortawesome/free-solid-svg-icons';
import { useDatabaseStore } from '../../stores/databaseStore';
// @ts-ignore
import { readFile, exists } from '@tauri-apps/plugin-fs';
import Editor from "@monaco-editor/react";
import { EditorToolbar } from '../layout/EditorToolbar';
import { LeftMathToolbar } from '../layout/LeftMathToolbar';
import { EditorActionBar } from '../layout/EditorActionBar';

// PDF Viewer imports
import { Viewer, Worker } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';

const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

interface ResourceInspectorProps {
    editorContent?: string;
    onContentChange?: (content: string) => void;
    onSave?: () => void;
    onCompile?: (engine?: string) => void;
    onStopCompile?: () => void;
    isCompiling?: boolean;
    editorSettings?: {
        fontSize?: number;
        fontFamily?: string;
        wordWrap?: string;
        minimap?: boolean;
        lineNumbers?: string;
        theme?: string;
    };
    isDirty?: boolean;
}

export const ResourceInspector = ({ 
    editorContent, 
    onContentChange, 
    onSave,
    onCompile,
    onStopCompile,
    isCompiling,
    editorSettings,
    isDirty
}: ResourceInspectorProps) => {
    const { allLoadedResources, activeResourceId } = useDatabaseStore();
    const resource = allLoadedResources.find(r => r.id === activeResourceId);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [editorInstance, setEditorInstance] = useState<any>(null);
    const isChangingLanguageRef = useRef(false);

    // Load PDF when resource changes
    useEffect(() => {
        let activeBlobUrl: string | null = null;
        
        const loadPdf = async () => {
            if (!resource) {
                setPdfUrl(null);
                setPdfError(null);
                return;
            }
            
            // Check if this is a tex file and look for corresponding PDF
            const isTexFile = resource.path.toLowerCase().endsWith('.tex');
            const pdfPath = isTexFile 
                ? resource.path.replace(/\.tex$/i, '.pdf')
                : resource.path.toLowerCase().endsWith('.pdf') 
                    ? resource.path 
                    : null;
            
            if (!pdfPath) {
                setPdfUrl(null);
                setPdfError('No PDF preview available for this file type.');
                return;
            }
            
            setPdfLoading(true);
            setPdfError(null);
            
            try {
                const pdfExists = await exists(pdfPath);
                
                if (pdfExists) {
                    const fileContents = await readFile(pdfPath);
                    const blob = new Blob([fileContents], { type: 'application/pdf' });
                    activeBlobUrl = URL.createObjectURL(blob);
                    setPdfUrl(activeBlobUrl);
                } else {
                    setPdfUrl(null);
                    setPdfError('No PDF available. Compile the document first.');
                }
            } catch (e) {
                console.warn("PDF load failed:", e);
                setPdfUrl(null);
                setPdfError(`Failed to load PDF: ${String(e)}`);
            } finally {
                setPdfLoading(false);
            }
        };
        
        loadPdf();
        
        return () => {
            if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
        };
    }, [resource?.path]);

    const handleEditorMount = useCallback((editor: any, monaco: any) => {
        setEditorInstance(editor);
        
        // Force set language to latex (registered as 'my-latex')
        const model = editor.getModel();
        if (model) {
            const currentLang = model.getLanguageId();
            if (currentLang !== 'my-latex') {
                monaco.editor.setModelLanguage(model, 'my-latex');
            }
        }
        
        // Handle Ctrl+S for saving
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            if (onSave) {
                onSave();
            }
        });
    }, [onSave, resource?.path]);

    const handleEditorChange = useCallback((value: string | undefined) => {
        // Skip if we're in the middle of changing language (this triggers false onChange)
        if (isChangingLanguageRef.current) return;
        
        if (onContentChange && value !== undefined) {
            onContentChange(value);
        }
    }, [onContentChange]);

    // Force language to my-latex when resource changes
    useEffect(() => {
        if (editorInstance && resource) {
            const model = editorInstance.getModel();
            if (model && model.getLanguageId() !== 'my-latex') {
                // @ts-ignore - monaco is globally available from @monaco-editor/react
                const monaco = window.monaco;
                if (monaco) {
                    // Set flag to prevent false dirty marking
                    isChangingLanguageRef.current = true;
                    monaco.editor.setModelLanguage(model, 'my-latex');
                    // Reset flag after a short delay
                    setTimeout(() => {
                        isChangingLanguageRef.current = false;
                    }, 100);
                }
            }
        }
    }, [resource?.path, resource?.id, editorInstance]);

    const editorOptions = {
        minimap: { enabled: editorSettings?.minimap ?? false, scale: 2 },
        fontSize: editorSettings?.fontSize ?? 13,
        fontFamily: editorSettings?.fontFamily ?? "Consolas, monospace",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: (editorSettings?.wordWrap ?? "on") as "on" | "off" | "wordWrapColumn" | "bounded",
        lineNumbers: (editorSettings?.lineNumbers ?? "on") as "on" | "off" | "relative" | "interval"
    };

    if (!resource) {
        return (
            <Box p="lg" ta="center">
                <Text c="dimmed">Select a resource to view details</Text>
            </Box>
        );
    }

    const filename = resource.path.split(/[/\\]/).pop() || resource.title || 'Untitled';

    return (
        <Stack h="100%" gap={0}>
             <Group p="xs" bg="var(--mantine-color-body)" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                 <Group gap="xs">
                     <FontAwesomeIcon icon={faInfoCircle} />
                     <Text fw={700} size="sm" truncate style={{ maxWidth: 150 }}>{filename}{isDirty ? ' ●' : ''}</Text>
                 </Group>
                 {editorInstance && (
                     <EditorActionBar 
                         editor={editorInstance}
                         onSave={onSave}
                         onCompile={onCompile}
                         onStopCompile={onStopCompile}
                         isCompiling={isCompiling}
                         compact={true}
                     />
                 )}
             </Group>
             
             <Tabs defaultValue="source" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Tabs.List>
                    <Tabs.Tab value="source" leftSection={<FontAwesomeIcon icon={faCode} />}>Source</Tabs.Tab>
                    <Tabs.Tab value="preview" leftSection={<FontAwesomeIcon icon={faEye} />}>Preview</Tabs.Tab>
                    <Tabs.Tab value="metadata" leftSection={<FontAwesomeIcon icon={faInfoCircle} />}>Meta</Tabs.Tab>
                    <Tabs.Tab value="bibliography" leftSection={<FontAwesomeIcon icon={faBook} />}>Bib</Tabs.Tab>
                </Tabs.List>

                {/* Source Tab - Monaco Editor with Toolbars */}
                <Tabs.Panel value="source" style={{ flex: 1, position: 'relative' }}>
                    <Box style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column' }}>
                        {/* Top Editor Toolbar */}
                        {editorInstance && (
                            <EditorToolbar editor={editorInstance} />
                        )}
                        
                        {/* Main Editor Area with Left Math Toolbar */}
                        <Box style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>
                            {/* Left Math Toolbar */}
                            {editorInstance && (
                                <LeftMathToolbar editor={editorInstance} />
                            )}
                            
                            {/* Monaco Editor */}
                            <Box style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
                                {editorContent !== undefined ? (
                                    <Editor
                                        path={resource.path}
                                        height="100%"
                                        language="latex"
                                        value={editorContent}
                                        onMount={handleEditorMount}
                                        onChange={handleEditorChange}
                                        options={editorOptions}
                                        theme={editorSettings?.theme || "vs-dark"}
                                    />
                                ) : (
                                    <Center h="100%">
                                        <Loader type="bars" />
                                    </Center>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Tabs.Panel>

                {/* Preview Tab - PDF */}
                <Tabs.Panel value="preview" style={{ flex: 1, position: 'relative' }}>
                    <Box style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                        {pdfLoading ? (
                            <Center h="100%">
                                <Stack align="center" gap="xs">
                                    <Loader type="bars" />
                                    <Text size="xs" c="dimmed">Loading PDF...</Text>
                                </Stack>
                            </Center>
                        ) : pdfUrl ? (
                            <Worker workerUrl={WORKER_URL}>
                                <Viewer fileUrl={pdfUrl} />
                            </Worker>
                        ) : (
                            <Center h="100%">
                                <Text c="dimmed" ta="center" size="sm">{pdfError || 'No preview available'}</Text>
                            </Center>
                        )}
                    </Box>
                </Tabs.Panel>

                {/* Metadata Tab */}
                <Tabs.Panel value="metadata" style={{ flex: 1, position: 'relative' }}>
                    <ScrollArea style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                        <Stack p="md">
                            <TextInput label="ID" value={resource.id} readOnly variant="filled" size="xs" />
                            <TextInput label="Title" defaultValue={resource.title || ''} size="xs" />
                            <TextInput label="Kind" value={resource.kind} readOnly size="xs" />
                            <TextInput label="Path" value={resource.path} readOnly size="xs" />
                            <TextInput label="Collection" value={resource.collection} readOnly size="xs" />
                            
                            {resource.metadata && Object.keys(resource.metadata).length > 0 && (
                                <>
                                    <Text size="xs" fw={700} mt="md">Custom Metadata</Text>
                                    {Object.entries(resource.metadata).map(([key, val]) => (
                                        <TextInput key={key} label={key} defaultValue={String(val)} size="xs" />
                                    ))}
                                </>
                            )}
                            <Button leftSection={<FontAwesomeIcon icon={faSave} />} mt="md" fullWidth variant="light" size="xs">Save Metadata</Button>
                        </Stack>
                    </ScrollArea>
                </Tabs.Panel>

                {/* Bibliography Tab */}
                <Tabs.Panel value="bibliography">
                    <Box p="md">
                         <Text c="dimmed" size="sm">Bibliography references will appear here.</Text>
                    </Box>
                </Tabs.Panel>
             </Tabs>
        </Stack>
    );
};

