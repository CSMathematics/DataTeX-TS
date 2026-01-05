import { useState, useEffect, useMemo } from 'react';
import { Stack, Text, Select, Group, TextInput, Checkbox, TagsInput, Textarea, Button, ScrollArea, Tabs, Box } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faInfoCircle, faFilePdf, faBook, faTimes, faMagic } from '@fortawesome/free-solid-svg-icons';
import { PreambleWizard } from '../wizards/PreambleWizard';
import { useDatabaseStore } from '../../stores/databaseStore';
// @ts-ignore
import { readFile, exists } from '@tauri-apps/plugin-fs';
import { PdfViewerContainer } from './PdfViewerContainer';
import { LoadingState, EmptyState, PanelHeader, ToolbarButton } from '../ui';
import '../../styles/pdf-viewer.css';

interface ResourceInspectorProps {
    /** PDF URL from main editor */
    mainEditorPdfUrl?: string | null;
}

// Classification Options
const RESOURCE_KINDS = [
    { value: 'file', label: 'LaTeX File Fragment' },
    { value: 'document', label: 'Full Document' },
    { value: 'bibliography', label: 'Bibliography (.bib)' },
    { value: 'table', label: 'Table' },
    { value: 'figure', label: 'Figure/Image' },
    { value: 'command', label: 'LaTeX Command/Macro' },
    { value: 'package', label: 'LaTeX Package (.sty)' },
    { value: 'class', label: 'LaTeX Class (.cls)' },
    { value: 'preamble', label: 'Preamble' },
];

const CONTENT_TYPES = [
    { value: 'exercise', label: 'Exercise' },
    { value: 'note', label: 'Note/Remark' },
    { value: 'definition', label: 'Definition' },
    { value: 'theorem', label: 'Theorem' },
    { value: 'table', label: 'Table Content' },
    { value: 'tikz_plot', label: 'TikZ Plot (2D)' },
    { value: 'statistics_table', label: 'Statistics Table' },
    { value: 'other', label: 'Other' },
];

const BUILD_COMMANDS = [
    { value: 'pdflatex', label: 'PdfLaTeX' },
    { value: 'xelatex', label: 'XeLaTeX' },
    { value: 'lualatex', label: 'LuaLaTeX' },
    { value: 'latex', label: 'LaTeX' },
];

const MetadataEditor = ({ resource }: { resource: any, onPreviewAvailable?: (url: string) => void }) => {
    const { updateResourceMetadata, allLoadedResources } = useDatabaseStore();
    const metadata = (resource.metadata || {}) as any;
    
    // Local state for form fields
    const [chapters, setChapters] = useState<string[]>(metadata.chapters || []);
    const [sections, setSections] = useState<string[]>(metadata.sections || []);
    const [difficulty, setDifficulty] = useState<string | null>(metadata.difficulty ? String(metadata.difficulty) : null);
    const [field, setField] = useState<string>(metadata.field || '');
    const [contentType, setContentType] = useState<string | null>(metadata.contentType || null);
    const [description, setDescription] = useState<string>(metadata.description || '');
    const [buildCommand, setBuildCommand] = useState<string | null>(metadata.buildCommand || null);
    const [preamble, setPreamble] = useState<string | null>(metadata.preamble || null);
    
    // Compilation State (removed as handled by main editor now)
    // const [isCompiling, setIsCompiling] = useState(false);

    const [solved, setSolved] = useState<boolean>(!!metadata.solved_prooved);
    const [label, setLabel] = useState<string>(metadata.label || '');
    const [packages, setPackages] = useState<string[]>(metadata.requiredPackages || []);
    
    // Solution State
    const [linkedSolution, setLinkedSolution] = useState<any | null>(null);
    const { getLinkedResources, createResource, linkResources, loadedCollections } = useDatabaseStore();

    // Derived Preambles
    const availablePreambles = useMemo(() => {
        const userPreambles = allLoadedResources
            .filter(r => r.kind === 'preamble' || r.path.endsWith('preamble.tex'))
            .map(r => ({ value: r.id, label: r.title || r.path.split('/').pop() || 'Untitled Preamble' }));
        
        return [
            { group: 'Built-in', items: [{ value: 'builtin:standard', label: 'Standard Article' }, { value: 'builtin:beamer', label: 'Beamer Presentation' }] },
            { group: 'User Preambles', items: userPreambles }
        ];
    }, [allLoadedResources]);

    // Sync with resource change
    useEffect(() => {
        const meta = resource.metadata || {};
        setChapters(meta.chapters || []);
        setSections(meta.sections || []);
        setDifficulty(meta.difficulty ? String(meta.difficulty) : null);
        setField(meta.field || '');
        setContentType(meta.contentType || null);
        setDescription(meta.description || '');
        setBuildCommand(meta.buildCommand || null);
        setPreamble(meta.preamble || null);
        setSolved(!!meta.solved_prooved);
        setLabel(meta.label || '');
        setPackages(meta.requiredPackages || []);
        
        // Fetch linked solution
        if (resource.id) {
            getLinkedResources(resource.id, 'solution').then(solutions => {
                if (solutions && solutions.length > 0) {
                    setLinkedSolution(solutions[0]);
                } else {
                    setLinkedSolution(null);
                }
            });
        }
    }, [resource.id, resource.metadata]);

    const handleSave = async () => {
        const newMetadata = {
            ...metadata,
            chapters,
            sections,
            difficulty: difficulty ? parseInt(difficulty) : undefined,
            field,
            contentType,
            description,
            buildCommand,
            preamble,
            solved_prooved: solved,
            label,
            requiredPackages: packages
        };
        await updateResourceMetadata(resource.id, newMetadata);
    };

    // handleCompile removed - using main editor's compile button

    const handleCreateSolution = async () => {
        if (!loadedCollections || loadedCollections.length === 0) {
            alert("No active collection found to create solution file.");
            return;
        }
        
        // Assume active collection of the resource, or the first loaded one
        // loadedCollections is string[] of names
        const collectionName = resource.collection || loadedCollections[0];
        
        // Generate filename: [basename]_sol.tex
        // resource.path is absolute, need to parse it. 
        // For simplicity, let's use the resource ID or title to make a unique name or prompt user?
        // Let's try to derive from path if possible, or just ask user? 
        // Requirement said "decide automatically". 
        // Let's append _sol to the filename.
        
        // We don't have easy path manipulation here without backend invoke usually, but we can do string manipulation
        let newName = "solution.tex";
        let fileName = null;
        if (resource.path) {
             const pathParts = resource.path.split(/[/\\]/);
             fileName = pathParts.pop() || null;
             if (fileName) {
                 const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
                 newName = `${nameWithoutExt}_sol.tex`;
             }
        }

        const confirm = await window.confirm(`Create solution file '${newName}'?`);
        if (!confirm) return;

        try {
            // 1. Create the file (empty or template)
            // Ideally we'd have a 'createResource' that returns the created resource or ID, 
            // but currently it fetches all. We can assume success if no error.
            const template = `\\begin{solution}\n% Solution for ${resource.title || resource.id}\n\n\\end{solution}`;
            
            // We need the full path for createResource... actually createResource takes a "path" which usually implies full path or relative?
            // The store's createResource calls invoke('create_resource_cmd', { path, collectionName, content }).
            // The backend likely expects a full path or handles it. 
            // Wait, proper file creation usually involves a dialog or knowing the directory.
            // If we just send a filename, where does it go? 
            // The backend `createResource` implementation likely needs a full path.
            
            // We'll use the parent directory of the current resource.
            const parentDir = resource.path.substring(0, resource.path.length - (fileName?.length || 0));
            const fullPath = `${parentDir}${newName}`;

            await createResource(fullPath, collectionName, template);
            
            // 2. We need the ID of the new resource to link it. 
            // Since we don't get it back, we can fetch it? or guess it?
            // The ID is usually the path or hash. databaseStore uses path as ID often or DB generated.
            // SQL: id TEXT PRIMARY KEY. logic in backend: id = Uuid::new_v4().
            // So we DO need to fetch it.
            
            // Strategy: Search for the resource by path? 
            // There isn't a direct "getResourceByPath" exposed in store yet, but we can refresh and find it.
            // Or better: update createResource to return the ID. 
            // For now, let's fetch linked resources after a short delay or re-fetch collection.
            
            // Wait, we need to link NEW -> OLD or OLD -> NEW?
            // Exercise (Source) -> Solution (Target) with relation 'solution'.
            
            // We need to find the ID of the newly created file.
            // Let's assume we can find it in `allLoadedResources` after refresh.
            const { allLoadedResources } = useDatabaseStore.getState();
            const newRes = allLoadedResources.find(r => r.path === fullPath);
            
            if (newRes) {
                await linkResources(resource.id, newRes.id, 'solution');
                setLinkedSolution(newRes);
            } else {
                 // Fallback or retry? 
                 // Maybe trigger a reload?
                 alert("Created file, but could not link automatically. Please refresh.");
            }

        } catch (e: any) {
             alert("Error creating solution: " + e.toString());
        }
    };
    
    const openLinkedSolution = () => {
         // Logic to open the PDF or file. 
         // For now maybe just alert or select it? 
         // Ideally select it in the inspector?
         if (linkedSolution) {
             // We can use a store action to select it?
             // useDatabaseStore.getState().selectResource(linkedSolution.id);
             // But simpler: just open it? 
             alert(`Solution found: ${linkedSolution.path}`);
         }
    };

    return (
        <Stack>
            <Text fw={600} size="sm">Classification</Text>
            
            <Select 
                label="Content Type" 
                placeholder="Select content type"
                data={CONTENT_TYPES}
                value={contentType}
                onChange={setContentType}
                searchable
                clearable
            />

            <Textarea
                label="Description"
                placeholder="Brief description of the file content..."
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                autosize
                minRows={2}
            />

            <Group grow>
                <Select 
                    label="Preamble" 
                    placeholder="Select preamble"
                    data={availablePreambles}
                    value={preamble}
                    onChange={setPreamble}
                    searchable
                    clearable
                    nothingFoundMessage="No preambles found"
                />
                <Select 
                    label="Build Command" 
                    placeholder="Auto"
                    data={BUILD_COMMANDS}
                    value={buildCommand}
                    onChange={setBuildCommand}
                    clearable
                />
            </Group>

            <Group grow>
                 <TextInput 
                    label="Field" 
                    placeholder="e.g. Algebra" 
                    value={field}
                    onChange={(e) => setField(e.currentTarget.value)}
                />
                 <Select 
                    label="Difficulty" 
                    data={['1', '2', '3', '4', '5']} 
                    value={difficulty}
                    onChange={setDifficulty}
                    placeholder="Level"
                />
            </Group>

            <TagsInput
                label="Chapters"
                placeholder="Press Enter to add"
                value={chapters}
                onChange={setChapters}
                // data={[]} // Fetch suggestions later
            />

            <TagsInput
                label="Sections"
                placeholder="Press Enter to add"
                value={sections}
                onChange={setSections}
            />

            <Text fw={600} size="sm" mt="sm">Identity & Status</Text>
            
            <TextInput 
                label="LaTeX Label" 
                placeholder="\label{...}" 
                value={label}
                onChange={(e) => setLabel(e.currentTarget.value)}
                leftSection={<Text size="xs" c="dimmed">lbl:</Text>}
            />

            <Checkbox 
                label="Solved / Prooved" 
                checked={solved}
                onChange={(e) => setSolved(e.currentTarget.checked)}
            />
            
            {solved && (
                <Button 
                    variant="light" 
                    color={linkedSolution ? "green" : "blue"}
                    onClick={linkedSolution ? openLinkedSolution : handleCreateSolution}
                    fullWidth
                    size="xs"
                >
                    {linkedSolution ? "Open Linked Solution" : "Create Solution File"}
                </Button>
            )}

            <Text fw={600} size="sm" mt="sm">Dependencies</Text>
            
             <TagsInput
                label="Required Packages"
                description="Packages needed (excluding standard)"
                placeholder="e.g. tikz"
                value={packages}
                onChange={setPackages}
            />

            <Button 
                onClick={handleSave} 
                leftSection={<FontAwesomeIcon icon={faSave} />} 
                fullWidth 
                mt="md"
            >
                Save Metadata
            </Button>
        </Stack>
    );
};

interface ResourceInspectorProps {
    /** PDF URL from main editor */
    mainEditorPdfUrl?: string | null;
}


export const ResourceInspector = ({ 
    mainEditorPdfUrl
}: ResourceInspectorProps) => {
    const { allLoadedResources, activeResourceId } = useDatabaseStore();
    const resource = allLoadedResources.find(r => r.id === activeResourceId);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);

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

    const { isWizardOpen, setWizardOpen, createResource } = useDatabaseStore();

    const handleWizardFinish = async (code: string) => {
        setWizardOpen(false);
         // Find a valid collection
         const collections = useDatabaseStore.getState().loadedCollections;
         if (collections.length === 0) {
             alert('Please select a collection first.');
             return;
         }
         const collection = collections[0];

        try {
             const selectedPath = await import('@tauri-apps/plugin-dialog').then(({ save }) => save({
                defaultPath: 'Untitled.tex',
                filters: [{
                    name: 'TeX Document',
                    extensions: ['tex']
                }]
            }));

            if (selectedPath) {
                await createResource(selectedPath, collection, code);
            }
        } catch (err) {
            console.error('Failed to create file', err);
        }
    };

    if (isWizardOpen) {
        return (
            <Stack h="100%" gap={0}>
                 <PanelHeader 
                     icon={faMagic} 
                     title="Preamble Wizard" 
                     actions={
                         <ToolbarButton 
                             label="Close" 
                             icon={faTimes} 
                             onClick={() => setWizardOpen(false)} 
                         />
                     }
                 />
                 <ScrollArea style={{ flex: 1 }}>
                    <PreambleWizard onInsert={handleWizardFinish} />
                 </ScrollArea>
            </Stack>
        );
    }

    // Use mainEditorPdfUrl when no resource, otherwise use resource PDF
    // Prioritize locally compiled preview
    // We need to access the setPreviewPdfUrl from MetadataEditor? 
    // Wait, MetadataEditor is a separate component. Scope issue.
    // Ideally state should be lifted. 
    // Refactoring: Lift compilation state to ResourceInspector or store.
    // For now, let's keep it in MetadataEditor but we need to tell ResourceInspector the URL.
    
    // Quick Fix: Move `previewPdfUrl` logic up to ResourceInspector OR
    // pass a callback to MetadataEditor.
    // Let's refactor MetadataEditor props.
    // But `MetadataEditor` is defined first.
    
    // Better: Lift `previewPdfUrl` to `ResourceInspector`.
    
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    
    const effectivePdfUrl = previewUrl || pdfUrl || mainEditorPdfUrl;
    const filename = resource ? (resource.path.split(/[/\\]/).pop() || resource.title || 'Untitled') : 'PDF Preview';
    
    const { updateResourceKind } = useDatabaseStore();

    return (<>
        <Stack h="100%" gap={0}>
             <PanelHeader 
                 icon={faInfoCircle}
                 title={filename}
             />
             
             <Tabs defaultValue="preview" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--mantine-color-dark-8)' }}>
                <Tabs.List>
                    <Tabs.Tab value="preview" leftSection={<FontAwesomeIcon icon={faFilePdf} />}>PDF</Tabs.Tab>
                    {/* Metadata and Bibliography only when resource is selected */}
                    {resource && (
                        <>
                            <Tabs.Tab value="metadata" leftSection={<FontAwesomeIcon icon={faInfoCircle} />}>Metadata</Tabs.Tab>
                            <Tabs.Tab value="bibliography" leftSection={<FontAwesomeIcon icon={faBook} />}>Bibliography</Tabs.Tab>
                        </>
                    )}
                </Tabs.List>

                {/* Preview Tab - PDF */}
                <Tabs.Panel value="preview" style={{ flex: 1, position: 'relative' }}>
                    <Box style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                        {pdfLoading ? (
                            <LoadingState message="Loading PDF..." />
                        ) : effectivePdfUrl ? (
                            <PdfViewerContainer key={effectivePdfUrl} pdfUrl={effectivePdfUrl} />
                        ) : (
                            <EmptyState message={pdfError || 'No PDF available. Compile the document first.'} />
                        )}
                    </Box>
                </Tabs.Panel>

                {/* Metadata Tab - only when resource is selected */}
                {resource && (
                    <Tabs.Panel value="metadata" style={{ flex: 1, position: 'relative' }}>
                        <ScrollArea style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
                            <Stack p="md" gap="md">
                                <Group grow>
                                    <TextInput label="Title" 
                                        defaultValue={resource.title || ''} 
                                        onChange={(e) => {
                                           // Ideally update title too, but for now focusing on metadata
                                        }}
                                    />
                                    <Select 
                                        label="File Tyle" 
                                        data={RESOURCE_KINDS}
                                        value={resource.kind}
                                        onChange={(val) => {
                                            if (val) updateResourceKind(resource.id, val);
                                        }}
                                        allowDeselect={false}
                                    />
                                </Group>
                                <Group grow>
                                    <TextInput label="ID" value={resource.id} readOnly variant="filled" c="dimmed" />
                                    <TextInput label="Collection" value={resource.collection} readOnly variant="filled" c="dimmed" />
                                    <TextInput label="Created" value={resource.created_at || '-'} readOnly variant="filled" c="dimmed" />
                                </Group>
                                
                                <MetadataEditor 
                                    resource={resource} 
                                    onPreviewAvailable={setPreviewUrl}
                                />

                            </Stack>
                        </ScrollArea>
                    </Tabs.Panel>
                )}

                {/* Bibliography Tab - only when resource is selected */}
                {resource && (
                    <Tabs.Panel value="bibliography">
                        <Box p="md">
                             <Text c="dimmed" size="sm">Bibliography references will appear here.</Text>
                        </Box>
                    </Tabs.Panel>
                )}
             </Tabs>
        </Stack>
    </>);
};

