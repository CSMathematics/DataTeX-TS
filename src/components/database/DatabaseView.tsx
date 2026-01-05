import React, { useState, useMemo, useCallback } from 'react';
import { Table, ScrollArea, Group, Text, TextInput, Badge, Paper, Tooltip, ActionIcon, Box, Menu, Modal, Grid } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; 
import { faSearch, faSort, faSortUp, faSortDown, faTrash, faExternalLinkAlt, faFolderOpen, faPlus, faFile, faFileAlt, faMagic } from '@fortawesome/free-solid-svg-icons';
import { useDatabaseStore } from '../../stores/databaseStore';
import { invoke } from '@tauri-apps/api/core';
// import { PreambleWizard } from '../wizards/PreambleWizard'; // Moved to ResourceInspector
import { DOCUMENT_TEMPLATES } from '../../templates/documentTemplates';

interface DatabaseViewProps {
    onOpenFile?: (path: string) => void;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
    column: string | null;
    direction: SortDirection;
}

export const DatabaseView = React.memo(({ onOpenFile }: DatabaseViewProps) => {
    const { allLoadedResources, loadedCollections, selectResource, activeResourceId, deleteResource } = useDatabaseStore();
    const [globalSearch, setGlobalSearch] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [sort, setSort] = useState<SortState>({ column: null, direction: null });
    
    // Filter to only .tex files for the table view
    const texResources = useMemo(() => 
        allLoadedResources.filter(r => r.path.toLowerCase().endsWith('.tex')),
    [allLoadedResources]);

    // Derived columns from metadata
    // We scan all resources in current view to find all unique metadata keys
    const columns = useMemo(() => {
        const standardCols = ['title', 'collection', 'kind']; // Standard fields - title first
        const metaKeys = new Set<string>();
        texResources.forEach(r => {
            if (r.metadata) {
                Object.keys(r.metadata).forEach(k => metaKeys.add(k));
            }
        });
        return [...standardCols, ...Array.from(metaKeys)];
    }, [texResources]);

    const handleColumnFilterChange = (col: string, value: string) => {
        setColumnFilters(prev => ({
            ...prev,
            [col]: value
        }));
    };

    const handleSort = (col: string) => {
        setSort(prev => {
            if (prev.column !== col) return { column: col, direction: 'asc' };
            if (prev.direction === 'asc') return { column: col, direction: 'desc' };
            return { column: null, direction: null };
        });
    };

    const filteredData = useMemo(() => {
        let result = texResources;

        // 1. Global Search
        if (globalSearch) {
            const searchLower = globalSearch.toLowerCase();
            result = result.filter(r => 
                r.title?.toLowerCase().includes(searchLower) ||
                r.id.toLowerCase().includes(searchLower) ||
                r.collection.toLowerCase().includes(searchLower) ||
                JSON.stringify(r.metadata).toLowerCase().includes(searchLower)
            );
        }

        // 2. Column Filters
        Object.entries(columnFilters).forEach(([col, filterValue]) => {
            if (!filterValue) return;
            const filterLower = filterValue.toLowerCase();
            result = result.filter(row => {
               let val = '';
                if (col === 'title') val = row.title || row.path.split(/[/\\]/).pop() || row.id;
                else if (col === 'collection') val = row.collection;
                else if (col === 'kind') val = row.kind;
                else val = row.metadata?.[col] || '';
                
                return String(val).toLowerCase().includes(filterLower);
            });
        });

        // 3. Sorting
        if (sort.column && sort.direction) {
            result = [...result].sort((a, b) => {
                let valA = '';
                let valB = '';
                
                const getValue = (row: typeof a, col: string) => {
                    if (col === 'title') return row.title || row.path.split(/[/\\]/).pop() || row.id;
                    if (col === 'collection') return row.collection;
                    if (col === 'kind') return row.kind;
                    return row.metadata?.[col] || '';
                };

                valA = String(getValue(a, sort.column!)).toLowerCase();
                valB = String(getValue(b, sort.column!)).toLowerCase();

                if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [allLoadedResources, globalSearch, columnFilters, sort]);

    const handleRowClick = useCallback((id: string, path: string) => {
        selectResource(id);
        if (onOpenFile) {
             // Optional: automatically open file on single click? 
             // current behavior in original code was select + open
             // Keeping it consistent
            onOpenFile(path);
        }
    }, [selectResource, onOpenFile]);

    const activeResource = useMemo(() => 
        allLoadedResources.find(r => r.id === activeResourceId), 
    [allLoadedResources, activeResourceId]);

    const handleRevealInFileExplorer = async () => {
        if (activeResource?.path) {
            // Reveal the parent directory
            // We use standard shell command or tauri plugin if available.
            // Assuming we just want to open the parent folder.
             try {
                // Determine OS and run appropriate command is complex without a specific plugin
                // But we can try to use the 'open' command on the parent dir
                // Or use the shell plugin if configured.
                // For now, let's assume we can just confirm it with user or use a simple hack? 
                // Actually, simple usage of 'open' on parent dir usually works.
                // Or better, let's just open the file itself which usually highlights it or opens default app.
                // But user asked for "show in explorer".
                // Let's try opening the parent directory.
                
                
                // Remove filename to get parent directory
                const parentDir = activeResource.path.replace(/[/\\][^/\\]*$/, '');
                
                try {
                    await invoke('reveal_path_cmd', { path: parentDir });
                } catch (e) {
                    console.error("Failed to open explorer", e);
                }
            } catch (e) {
                console.error("Failed to calculate parent dir", e);
            }
        }
    };

    const handleDelete = useCallback(async () => {
        if (activeResourceId) {
             if (confirm('Are you sure you want to remove this file from the database? The physical file will NOT be deleted.')) {
                await deleteResource(activeResourceId);
            }
        }
    }, [activeResourceId, deleteResource]);
    
    const handleOpenInEditor = useCallback(() => {
         if (activeResource && onOpenFile) {
            onOpenFile(activeResource.path);
        }
    }, [activeResource, onOpenFile]);

    // Wizard and Template State
    // const [wizardOpen, setWizardOpen] = useState(false); // Moved to store
    const setWizardOpen = useDatabaseStore(state => state.setWizardOpen);
    const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);

    const createFileWithContent = async (content: string) => {
        const collection = loadedCollections[0];
        try {
             const selectedPath = await import('@tauri-apps/plugin-dialog').then(({ save }) => save({
                defaultPath: 'Untitled.tex',
                filters: [{
                    name: 'TeX Document',
                    extensions: ['tex']
                }]
            }));

            if (selectedPath) {
                await useDatabaseStore.getState().createResource(selectedPath, collection, content);
            }
        } catch (err) {
            console.error('Failed to create file', err);
        }
    };

    const handleCreateFile = async (type: 'empty' | 'template' | 'wizard') => {
        if (loadedCollections.length === 0) {
            alert('Please select a collection first.');
            return;
        }
        
        if (type === 'empty') {
            await createFileWithContent('');
        } else if (type === 'wizard') {
            setWizardOpen(true);
        } else if (type === 'template') {
            setTemplateSelectorOpen(true);
        }
    };

    // Wizard finish is now handled in ResourceInspector or we keep it here?
    // User requested wizard to be in sidebar.
    // If wizard is in sidebar (ResourceInspector), DatabaseView doesn't handle the finish directly unless passed as prop?
    // But ResourceInspector is a sibling/child.
    // The previous implementation had the Modal here.
    // We strictly remove the Modal from here.

    const handleTemplateSelect = async (templateCode: string) => {
        setTemplateSelectorOpen(false);
        await createFileWithContent(templateCode);
    };

    const handleAddExistingFile = async () => {
        if (loadedCollections.length === 0) {
            alert('Please select a collection first.');
            return;
        }
        const collection = loadedCollections[0];

        try {
            const selectedPath = await import('@tauri-apps/plugin-dialog').then(({ open }) => open({
                multiple: false,
                filters: [{
                    name: 'TeX/Bib/Images',
                    extensions: ['tex', 'bib', 'sty', 'cls', 'png', 'jpg', 'pdf']
                }]
            }));

            if (selectedPath) {
                 const pathStr = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath;
                 if (pathStr) {
                    await useDatabaseStore.getState().importFile(pathStr, collection);
                 }
            }
        } catch (err) {
            console.error('Failed to import file', err);
        }
    };

    if (loadedCollections.length === 0) {
        return <Text p="xl" c="dimmed" ta="center">Select one or more collections to view their contents.</Text>;
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--mantine-color-gray-8)' }}>


            <Modal opened={templateSelectorOpen} onClose={() => setTemplateSelectorOpen(false)} title="Select Template" size="lg">
                <Grid>
                    {DOCUMENT_TEMPLATES.map(t => (
                        <Grid.Col span={6} key={t.id}>
                            <Paper withBorder p="md" onClick={() => handleTemplateSelect(t.code)} style={{ cursor: 'pointer', height: '100%' }}>
                                <Text fw={700}>{t.name}</Text>
                                <Text size="sm" c="dimmed">{t.description}</Text>
                            </Paper>
                        </Grid.Col>
                    ))}
                </Grid>
            </Modal>

            {/* Toolbar */}
             <Paper p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', zIndex: 10 }}>
                <Group justify="space-between">
                    <Group gap="xs">

                        <Text fw={700} size="sm">
                            {loadedCollections.length === 1 
                                ? loadedCollections[0] 
                                : `${loadedCollections.length} Collections`}
                        </Text>
                        <Badge size="xs" variant="light">{filteredData.length} files</Badge>
                    </Group>
                    
                    {/* Action Toolbar - Only visible when a resource is selected */}
                    {activeResourceId && (
                         <Group gap= '2px' style={{ backgroundColor: 'var(--mantine-color-dark-7)', padding: '4px 8px', borderRadius: '4px' }}>
                        <Menu shadow="md" width={200}>
                            <Tooltip label="Create new">
                            <Menu.Target>
                                <ActionIcon size="xs" color='gray.7' variant='subtle'>
                                    <FontAwesomeIcon icon={faPlus} style={{height: 12}}/>
                                </ActionIcon>
                            </Menu.Target>
                            </Tooltip>
                            <Menu.Dropdown>
                                <Menu.Label>Create new</Menu.Label>
                                <Menu.Item onClick={() => handleCreateFile('empty')} leftSection={<FontAwesomeIcon icon={faFile} style={{ height: 14 }} />}>
                                    Empty LaTeX File
                                </Menu.Item>
                                <Menu.Item onClick={() => handleCreateFile('template')} leftSection={<FontAwesomeIcon icon={faFileAlt} style={{ height: 14 }} />}>
                                    From Template...
                                </Menu.Item>
                                <Menu.Item onClick={() => handleCreateFile('wizard')} leftSection={<FontAwesomeIcon icon={faMagic} style={{ height: 14 }} />}>
                                    Preamble Wizard...
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>

                        <Tooltip label="Add existing file">
                        <ActionIcon size="xs" variant="subtle" color='gray.7' onClick={handleAddExistingFile}>
                            <FontAwesomeIcon icon={faFolderOpen} style={{height: 12}}/>
                        </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Open in Main Editor">
                        <ActionIcon variant="subtle" size="xs" onClick={handleOpenInEditor} color="gray.7">
                            <FontAwesomeIcon icon={faExternalLinkAlt} style={{ height: 12 }} />
                        </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Reveal in Explorer">
                        <ActionIcon variant="subtle" size="xs" onClick={handleRevealInFileExplorer} color="gray.7">
                            <FontAwesomeIcon icon={faFolderOpen} style={{ height: 12 }} />
                        </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Remove from Database">
                        <ActionIcon variant="subtle" size="xs" onClick={handleDelete} color="red">
                                    <FontAwesomeIcon icon={faTrash} style={{ height: 12 }} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    )}

                </Group>
             </Paper>

            {/* Table Area */}
            <ScrollArea style={{ flex: 1 }}>
                <Table stickyHeader highlightOnHover striped>
                    <Table.Thead>
                        <Table.Tr>
                            {columns.map(col => {
                                const isSorted = sort.column === col;
                                return (
                                    <Table.Th key={col} style={{ whiteSpace: 'nowrap', minWidth: 100 }}>
                                        <Box 
                                            onClick={() => handleSort(col)} 
                                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}
                                        >
                                            <Text size="xs" fw={700} tt="capitalize" style={{ userSelect: 'none' }}>{col}</Text>
                                            <FontAwesomeIcon 
                                                icon={isSorted ? (sort.direction === 'asc' ? faSortUp : faSortDown) : faSort} 
                                                style={{ opacity: isSorted ? 1 : 0.3, width: 10 }} 
                                            />
                                        </Box>
                                        <TextInput 
                                            placeholder={`Filter ${col}`} 
                                            size="xs" 
                                            value={columnFilters[col] || ''}
                                            onChange={(e) => handleColumnFilterChange(col, e.currentTarget.value)}
                                            variant="filled" 
                                            styles={{ input: { height: 22, fontSize: 10, padding: '0 4px' } }}
                                            onClick={(e) => e.stopPropagation()} // Prevent sort when clicking input
                                        />
                                    </Table.Th>
                                );
                            })}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {filteredData.map(row => {
                            const isSelected = row.id === activeResourceId;
                            const filename = row.path.split(/[/\\]/).pop() || row.title || row.id;
                            
                            return (
                                <Table.Tr 
                                key={row.id} 
                                onClick={() => handleRowClick(row.id, row.path)}
                                bg={isSelected ? 'var(--mantine-primary-color-light)' : undefined}
                                style={{ cursor: 'pointer' }}
                                >
                                    {columns.map(col => {
                                        let val = '';
                                        if (col === 'title') val = row.title || filename;
                                        else if (col === 'collection') val = row.collection;
                                        else if (col === 'kind') val = row.kind;
                                        else val = row.metadata?.[col] || '';

                                        return (
                                            <Table.Td key={`${row.id}-${col}`}>
                                                <Text size="xs" truncate>{String(val)}</Text>
                                            </Table.Td>
                                        );
                                    })}
                                </Table.Tr>
                            );
                        })}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
                                <Group style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
                                    <TextInput 
                                    flex={1}
                                    style={{padding:4}}
                                        placeholder="Global Search..." 
                                        leftSection={<FontAwesomeIcon icon={faSearch} style={{ width: 12, height: 12 }} />}
                                        value={globalSearch}
                                        onChange={(e) => setGlobalSearch(e.currentTarget.value)}
                                        size="xs"
                                        styles={{ input: { height: 28 } }}
                                    />
                                </Group>
        </div>
    );
});
