import { useEffect, useState, useMemo, useCallback } from 'react';
import { Stack, Text, Loader, ActionIcon, Group, Tooltip, Box, TextInput, Checkbox, UnstyledButton, Modal, Button, Collapse, ScrollArea } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faPlus, faSync, faSearch, faTimes, faDatabase, faTrash, faFolderTree, 
    faChevronRight, faFolder, faFolderOpen, faExpand, faCompress,
    faChevronDown, faBoxOpen
} from '@fortawesome/free-solid-svg-icons';
import { useDatabaseStore } from '../../stores/databaseStore';
import { open } from '@tauri-apps/plugin-dialog';
import { getFileIcon } from '../layout/Sidebar';

// --- Types ---
interface FileTreeNode {
    id: string;
    name: string;
    type: 'file' | 'folder';
    path: string;
    children: FileTreeNode[];
    isCollectionRoot?: boolean;
}

// Allowed file extensions for the file tree view
const ALLOWED_EXTENSIONS = ['tex', 'pdf', 'bib', 'sty', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];

// --- File Tree Item Component ---
const DatabaseFileTreeItem = ({ 
    node, 
    level, 
    onFileClick,
    selectedPath,
    expandSignal,
    collapseSignal
}: { 
    node: FileTreeNode; 
    level: number; 
    onFileClick: (path: string) => void;
    selectedPath: string | null;
    expandSignal: number;
    collapseSignal: number;
}) => {
    const isRoot = node.isCollectionRoot;
    const [expanded, setExpanded] = useState(isRoot); // Root folders start expanded

    // React to expand/collapse all signals
    useEffect(() => { if (expandSignal > 0) setExpanded(true); }, [expandSignal]);
    useEffect(() => { if (collapseSignal > 0 && !isRoot) setExpanded(false); }, [collapseSignal, isRoot]);

    const handleClick = useCallback(() => {
        if (node.type === 'folder') {
            setExpanded(prev => !prev);
        } else {
            onFileClick(node.path);
        }
    }, [node, onFileClick]);

    const isSelected = node.path === selectedPath;
    
    // Styles based on level/root status
    const isFile = node.type === 'file';
    const paddingLeft = isRoot ? 8 : (isFile ? level * 10 + 28 : level * 10 + 12);
    const bgColor = isRoot 
        ? 'var(--app-header-bg)' 
        : (isSelected ? 'var(--mantine-primary-color-light)' : 'transparent');
    const textColor = isSelected ? 'var(--mantine-primary-color-text)' : 'var(--mantine-color-text)';
    const fontWeight = isRoot ? 700 : 400;
    const borderBottom = isRoot ? '1px solid var(--mantine-color-default-border)' : 'none';

    return (
        <Box>
            <UnstyledButton
                onClick={handleClick}
                style={{
                    width: '100%',
                    padding: isRoot ? '8px 8px' : '4px 8px',
                    paddingLeft: paddingLeft,
                    fontSize: 13,
                    color: textColor,
                    backgroundColor: bgColor,
                    borderBottom: borderBottom,
                    fontWeight: fontWeight,
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background-color 0.2s',
                }}
            >
                <Group gap={isRoot ? 8 : 6} wrap="nowrap" style={{ flex: 1, overflow: 'hidden' }}>
                    {node.type === 'folder' && (
                        <Box style={{ 
                            transform: expanded ? (isRoot ? 'rotate(0deg)' : 'rotate(90deg)') : (isRoot ? 'rotate(-90deg)' : 'none'), 
                            transition: 'transform 0.2s', 
                            display: 'flex', 
                            opacity: 0.7 
                        }}>
                            <FontAwesomeIcon icon={isRoot ? faChevronDown : faChevronRight} style={{ width: 10, height: 10 }} />
                        </Box>
                    )}
                    
                    {isRoot ? (
                        <FontAwesomeIcon icon={faBoxOpen} style={{ width: 14, height: 14, color: "var(--mantine-primary-color-filled)" }} />
                    ) : node.type === 'folder' ? (
                        <FontAwesomeIcon 
                            icon={expanded ? faFolderOpen : faFolder} 
                            style={{ width: 14, height: 14, color: "#fab005" }} 
                        />
                    ) : (
                        getFileIcon(node.name, 'file')
                    )}
                    
                    <Text size={isRoot ? "xs" : "xs"} truncate fw={isRoot ? 700 : 400} tt={isRoot ? "uppercase" : "none"}>
                        {node.name}
                    </Text>
                </Group>
            </UnstyledButton>

            {node.type === 'folder' && node.children.length > 0 && (
                <Collapse in={expanded ?? false}>
                    {node.children.map(child => (
                        <DatabaseFileTreeItem
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onFileClick={onFileClick}
                            selectedPath={selectedPath}
                            expandSignal={expandSignal}
                            collapseSignal={collapseSignal}
                        />
                    ))}
                </Collapse>
            )}
        </Box>
    );
};

export const DatabaseSidebar = () => {
    const { 
        collections, 
        fetchCollections, 
        loadedCollections, 
        toggleCollectionLoaded, 
        isLoading, 
        importFolder,
        deleteCollection,
        allLoadedResources,
        selectResource,
        activeResourceId
    } = useDatabaseStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [fileTreeSearch, setFileTreeSearch] = useState('');
    const [hoveredCollection, setHoveredCollection] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);
    const [showFileTree, setShowFileTree] = useState(false);
    
    // Expand/Collapse all state
    const [expandAllSignal, setExpandAllSignal] = useState(0);
    const [collapseAllSignal, setCollapseAllSignal] = useState(0);
    const [isToggleExpanded, setIsToggleExpanded] = useState(true);

    useEffect(() => {
        fetchCollections();
    }, []);

    const handleImport = useCallback(async () => {
        try {
            const selected = await open({ directory: true, title: "Select Folder to Import" });
            if (selected && typeof selected === 'string') {
                 const separator = selected.includes('\\') ? '\\' : '/';
                 const name = selected.split(separator).pop() || 'Imported';
                 await importFolder(selected, name);
            }
        } catch (e) {
            console.error("Import failed", e);
        }
    }, [importFolder]);

    const handleToggleCollection = useCallback((name: string) => {
        toggleCollectionLoaded(name);
    }, [toggleCollectionLoaded]);

    const handleDeleteClick = useCallback((name: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent toggling the collection
        setCollectionToDelete(name);
        setDeleteModalOpen(true);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (collectionToDelete) {
            await deleteCollection(collectionToDelete);
            setDeleteModalOpen(false);
            setCollectionToDelete(null);
        }
    }, [collectionToDelete, deleteCollection]);

    const cancelDelete = useCallback(() => {
        setDeleteModalOpen(false);
        setCollectionToDelete(null);
    }, []);

    const filteredCollections = useMemo(() => {
        if (!searchQuery) return collections;
        return collections.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [collections, searchQuery]);

    const handleToggleExpand = useCallback(() => {
        if (isToggleExpanded) {
            setCollapseAllSignal(prev => prev + 1);
        } else {
            setExpandAllSignal(prev => prev + 1);
        }
        setIsToggleExpanded(prev => !prev);
    }, [isToggleExpanded]);

    // Build file tree from resources
    const fileTree = useMemo(() => {
        // Filter resources by allowed extensions
        let filteredResources = allLoadedResources.filter(r => {
            const ext = r.path.split('.').pop()?.toLowerCase() || '';
            return ALLOWED_EXTENSIONS.includes(ext);
        });

        // Apply search filter
        if (fileTreeSearch) {
            const searchLower = fileTreeSearch.toLowerCase();
            filteredResources = filteredResources.filter(r => 
                r.path.toLowerCase().includes(searchLower)
            );
        }

        if (filteredResources.length === 0) return [];

        // Group files by collection and build tree structure
        const collectionTrees: FileTreeNode[] = [];

        // Group resources by collection
        const byCollection = new Map<string, typeof filteredResources>();
        filteredResources.forEach(r => {
            const existing = byCollection.get(r.collection) || [];
            existing.push(r);
            byCollection.set(r.collection, existing);
        });

        // Build tree for each collection
        byCollection.forEach((resources, collectionName) => {
            // Find common root path for this collection
            const paths = resources.map(r => r.path);
            const separator = paths[0]?.includes('\\') ? '\\' : '/';
            
            // Get all path parts
            const allParts = paths.map(p => p.split(separator));
            
            // Find common prefix
            let commonPrefix: string[] = [];
            if (allParts.length > 0) {
                commonPrefix = [...allParts[0]];
                for (let i = 1; i < allParts.length; i++) {
                    let j = 0;
                    while (j < commonPrefix.length && j < allParts[i].length && commonPrefix[j] === allParts[i][j]) {
                        j++;
                    }
                    commonPrefix = commonPrefix.slice(0, j);
                }
            }
            const commonRoot = commonPrefix.join(separator);

            // Build tree structure - collection as root
            const rootNode: FileTreeNode = {
                id: collectionName,
                name: collectionName,
                type: 'folder',
                path: commonRoot,
                children: [],
                isCollectionRoot: true
            };

            // Add files to tree
            resources.forEach(r => {
                const relativePath = r.path.substring(commonRoot.length).replace(/^[/\\]/, '');
                const parts = relativePath.split(/[/\\]/).filter(Boolean);
                
                let currentNode = rootNode;
                
                // Navigate/create folder structure
                for (let i = 0; i < parts.length - 1; i++) {
                    const folderName = parts[i];
                    let folderNode = currentNode.children.find(c => c.name === folderName && c.type === 'folder');
                    
                    if (!folderNode) {
                        folderNode = {
                            id: `${currentNode.id}/${folderName}`,
                            name: folderName,
                            type: 'folder',
                            path: `${currentNode.path}${separator}${folderName}`,
                            children: []
                        };
                        currentNode.children.push(folderNode);
                    }
                    currentNode = folderNode;
                }

                // Add file node
                const fileName = parts[parts.length - 1] || r.path.split(/[/\\]/).pop() || 'unknown';
                currentNode.children.push({
                    id: r.id,
                    name: fileName,
                    type: 'file',
                    path: r.path,
                    children: []
                });
            });

            // Sort children: folders first, then files, alphabetically
            const sortChildren = (node: FileTreeNode) => {
                node.children.sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });
                node.children.forEach(child => {
                    if (child.type === 'folder') sortChildren(child);
                });
            };
            sortChildren(rootNode);

            collectionTrees.push(rootNode);
        });

        return collectionTrees;
    }, [allLoadedResources, fileTreeSearch]);

    const handleFileClick = useCallback((path: string) => {
        const resource = allLoadedResources.find(r => r.path === path);
        if (resource) {
            selectResource(resource.id);
        }
    }, [allLoadedResources, selectResource]);

    const selectedPath = useMemo(() => {
        const activeResource = allLoadedResources.find(r => r.id === activeResourceId);
        return activeResource?.path || null;
    }, [allLoadedResources, activeResourceId]);

    return (
        <Stack p="xs" gap="xs" h="100%" style={{ overflow: 'hidden' }}>
            {/* Header - changes based on mode */}
            <Group justify="space-between" px={4}>
                <Text size="xs" fw={700} c="dimmed">
                    {showFileTree ? 'FILE TREE' : 'COLLECTIONS'}
                </Text>
                <Group gap={2}>
                    {showFileTree ? (
                        // File tree mode toolbar
                        <>
                            <Tooltip label={isToggleExpanded ? "Collapse All" : "Expand All"}>
                                <ActionIcon variant="subtle" size="xs" color="gray" onClick={handleToggleExpand}>
                                    <FontAwesomeIcon icon={isToggleExpanded ? faCompress : faExpand} style={{ width: 12, height: 12 }} />
                                </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Back to Collections">
                                <ActionIcon 
                                    size="xs" 
                                    variant="light" 
                                    color="blue" 
                                    onClick={() => setShowFileTree(false)}
                                >
                                    <FontAwesomeIcon icon={faDatabase} style={{ width: 12, height: 12 }} />
                                </ActionIcon>
                            </Tooltip>
                        </>
                    ) : (
                        // Collections mode toolbar
                        <>
                            <Tooltip label="Refresh">
                                <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => fetchCollections()}>
                                    <FontAwesomeIcon icon={faSync} style={{ width: 12, height: 12 }} />
                                </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Import Folder">
                                <ActionIcon size="xs" variant="subtle" color="gray" onClick={handleImport}>
                                    <FontAwesomeIcon icon={faPlus} style={{ width: 12, height: 12 }} />
                                </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Show File Tree">
                                <ActionIcon 
                                    size="xs" 
                                    variant="subtle" 
                                    color="gray" 
                                    onClick={() => setShowFileTree(true)}
                                    disabled={loadedCollections.length === 0}
                                >
                                    <FontAwesomeIcon icon={faFolderTree} style={{ width: 12, height: 12 }} />
                                </ActionIcon>
                            </Tooltip>
                        </>
                    )}
                </Group>
            </Group>

            {/* Search box */}
            <Box px={4}>
                <TextInput 
                    placeholder={showFileTree ? "Filter files..." : "Search collections..."} 
                    size="xs" 
                    value={showFileTree ? fileTreeSearch : searchQuery}
                    onChange={(e) => showFileTree 
                        ? setFileTreeSearch(e.currentTarget.value) 
                        : setSearchQuery(e.currentTarget.value)
                    }
                    rightSection={
                        (showFileTree ? fileTreeSearch : searchQuery) 
                            ? <ActionIcon size="xs" variant="transparent" onClick={() => showFileTree ? setFileTreeSearch('') : setSearchQuery('')}>
                                <FontAwesomeIcon icon={faTimes} />
                              </ActionIcon> 
                            : <FontAwesomeIcon icon={faSearch} style={{ width: 12, height: 12, color: 'var(--mantine-color-dimmed)' }} />
                    }
                />
            </Box>

            {/* Loading state */}
            {isLoading && collections.length === 0 && <Loader size="xs" mx="auto" />}

            {/* FILE TREE VIEW */}
            {showFileTree ? (
                <ScrollArea style={{ flex: 1 }}>
                    {loadedCollections.length === 0 ? (
                        <Text size="xs" c="dimmed" ta="center" py="md">
                            No collections loaded. Go back and select collections first.
                        </Text>
                    ) : fileTree.length === 0 ? (
                        <Text size="xs" c="dimmed" ta="center" py="md">No files found.</Text>
                    ) : (
                        <Box>
                            {fileTree.map(node => (
                                <DatabaseFileTreeItem
                                    key={node.id}
                                    node={node}
                                    level={0}
                                    onFileClick={handleFileClick}
                                    selectedPath={selectedPath}
                                    expandSignal={expandAllSignal}
                                    collapseSignal={collapseAllSignal}
                                />
                            ))}
                        </Box>
                    )}
                </ScrollArea>
            ) : (
                /* COLLECTIONS VIEW */
                <>
                    {collections.length === 0 && !isLoading && (
                        <Text size="xs" c="dimmed" ta="center">No collections found.</Text>
                    )}

                    <Box style={{ flex: 1, overflowY: 'auto' }} px={4}>
                        <Stack gap={4}>
                            {filteredCollections.map(col => {
                                const isLoaded = loadedCollections.includes(col.name);
                                return (
                                    <UnstyledButton
                                        key={col.name}
                                        onClick={() => handleToggleCollection(col.name)}
                                        onMouseEnter={() => setHoveredCollection(col.name)}
                                        onMouseLeave={() => setHoveredCollection(null)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '6px 8px',
                                            borderRadius: 4,
                                            backgroundColor: isLoaded ? 'rgba(64, 192, 87, 0.1)' : 'transparent',
                                            transition: 'background-color 0.15s ease',
                                            position: 'relative',
                                        }}
                                        styles={{
                                            root: {
                                                '&:hover': {
                                                    backgroundColor: isLoaded ? 'rgba(64, 192, 87, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                }
                                            }
                                        }}
                                    >
                                        <Checkbox
                                            checked={isLoaded}
                                            onChange={() => {}}
                                            size="xs"
                                            styles={{
                                                input: { cursor: 'pointer' }
                                            }}
                                        />
                                        <FontAwesomeIcon 
                                            icon={faDatabase} 
                                            style={{ 
                                                width: 14, 
                                                height: 14, 
                                                color: isLoaded ? '#40c057' : '#868e96',
                                                transition: 'color 0.15s ease'
                                            }} 
                                        />
                                        <Text 
                                            size="sm" 
                                            truncate 
                                            style={{ 
                                                flex: 1,
                                                color: isLoaded ? '#c9c9c9' : '#868e96'
                                            }}
                                        >
                                            {col.name}
                                        </Text>
                                        
                                        {hoveredCollection === col.name && (
                                            <ActionIcon
                                                size="xs"
                                                variant="subtle"
                                                color="red"
                                                onClick={(e) => handleDeleteClick(col.name, e)}
                                                style={{
                                                    transition: 'opacity 0.15s ease',
                                                }}
                                            >
                                                <FontAwesomeIcon icon={faTrash} style={{ width: 12, height: 12 }} />
                                            </ActionIcon>
                                        )}
                                    </UnstyledButton>
                                );
                            })}
                        </Stack>
                    </Box>

                    {loadedCollections.length > 0 && (
                        <Box px={4} py={4} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <Text size="xs" c="dimmed">
                                {loadedCollections.length} collection{loadedCollections.length > 1 ? 's' : ''} loaded
                            </Text>
                        </Box>
                    )}
                </>
            )}

            <Modal
                opened={deleteModalOpen}
                onClose={cancelDelete}
                title="Διαγραφή Συλλογής"
                centered
                size="md"
            >
                <Stack gap="md">
                    <Text>
                        Είστε σίγουροι ότι θέλετε να διαγράψετε τη συλλογή <Text component="span" fw={700}>"{collectionToDelete}"</Text>;
                    </Text>
                    <Text size="sm" c="dimmed">
                        ⚠️ Προσοχή: Αυτή η ενέργεια θα διαγράψει τη συλλογή και όλα τα resources της από τη βάση δεδομένων, 
                        αλλά <Text component="span" fw={700}>ΔΕΝ θα διαγράψει</Text> τα αρχεία από το σύστημα αρχείων σας.
                    </Text>
                    <Group justify="flex-end" gap="xs">
                        <Button variant="default" onClick={cancelDelete}>
                            Ακύρωση
                        </Button>
                        <Button color="red" onClick={confirmDelete}>
                            Διαγραφή
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    );
};
