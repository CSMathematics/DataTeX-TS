import { useEffect, useMemo, useCallback, useState } from 'react';
import { Stack, Text, Loader, Box, Checkbox, UnstyledButton, Modal, Button, Group, ActionIcon, ScrollArea, Divider } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSync, faDatabase, faTrash, faFolderTree, faFolder, faWandMagicSparkles, faTable, faPenNib } from '@fortawesome/free-solid-svg-icons';
import { useDatabaseStore } from '../../stores/databaseStore';
import { useProjectStore } from '../../stores/projectStore';
import { open } from '@tauri-apps/plugin-dialog';

// Import shared tree components
import { 
    TreeNode,
    TreeItemConfig,
    TreeItemCallbacks,
    UnifiedTreeItem,
    TreeToolbar,
    TreeSearchInput,
    useTreeState,
    ToolbarAction
} from '../shared/tree';
import { FileSystemNode } from '../layout/Sidebar';

// Allowed file extensions for the file tree view
const ALLOWED_EXTENSIONS = ['tex', 'pdf', 'bib', 'sty', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];

// View types for the sidebar
type SidebarViewType = 'collections' | 'dbFiles' | 'projects';

// Props for project folder operations
interface DatabaseSidebarProps {
    // Project folder operations (passed from App.tsx)
    onOpenFolder?: () => void;
    onRemoveFolder?: (path: string) => void;
    onOpenFileNode?: (node: FileSystemNode) => void;
    onCreateItem?: (name: string, type: 'file' | 'folder', parentPath: string) => void;
    onRenameItem?: (node: FileSystemNode, newName: string) => void;
    onDeleteItem?: (node: FileSystemNode) => void;
    // Navigation to wizards
    onNavigate?: (view: string) => void;
}

/**
 * Database Sidebar component.
 * Shows Collections, DB File Tree, or Project Folders (3-way toggle).
 * Now uses shared UnifiedTreeItem component for file trees.
 */
export const DatabaseSidebar = ({
    onOpenFolder,
    onRemoveFolder,
    onOpenFileNode,
    onCreateItem,
    onRenameItem,
    onDeleteItem,
    onNavigate
}: DatabaseSidebarProps) => {
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

    // Project folder state from store
    const { projectData } = useProjectStore();

    // Use shared tree state hook
    const {
        expandAllSignal,
        collapseAllSignal,
        isToggleExpanded,
        searchQuery,
        setSearchQuery,
        toggleExpandState
    } = useTreeState<TreeNode>();

    // Local state - 3-way view toggle
    const [activeView, setActiveView] = useState<SidebarViewType>('collections');
    const [fileTreeSearch, setFileTreeSearch] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [hoveredCollection, setHoveredCollection] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);
    const [creatingItem, setCreatingItem] = useState<{ type: 'file' | 'folder', parentId: string } | null>(null);
    const [selectedProjectNode] = useState<FileSystemNode | null>(null);

    // Fetch collections on mount
    useEffect(() => {
        fetchCollections();
    }, [fetchCollections]);

    // --- Handlers ---
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
        e.stopPropagation();
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

    // --- Collections filtering ---
    const filteredCollections = useMemo(() => {
        if (!searchQuery) return collections;
        return collections.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [collections, searchQuery]);

    // --- Build file tree from resources ---
    const fileTree = useMemo((): TreeNode[] => {
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

        // Group resources by collection
        const byCollection = new Map<string, typeof filteredResources>();
        filteredResources.forEach(r => {
            const existing = byCollection.get(r.collection) || [];
            existing.push(r);
            byCollection.set(r.collection, existing);
        });

        const collectionTrees: TreeNode[] = [];

        // Build tree for each collection
        byCollection.forEach((resources, collectionName) => {
            const paths = resources.map(r => r.path);
            const separator = paths[0]?.includes('\\') ? '\\' : '/';
            
            // Find common prefix
            const allParts = paths.map(p => p.split(separator));
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
            const rootNode: TreeNode = {
                id: collectionName,
                name: collectionName,
                type: 'folder',
                path: commonRoot,
                children: [],
                isRoot: true,
                metadata: { collectionName }
            };

            // Add files to tree
            resources.forEach(r => {
                const relativePath = r.path.substring(commonRoot.length).replace(/^[/\\]/, '');
                const parts = relativePath.split(/[/\\]/).filter(Boolean);
                
                let currentNode = rootNode;
                
                // Navigate/create folder structure
                for (let i = 0; i < parts.length - 1; i++) {
                    const folderName = parts[i];
                    let folderNode = currentNode.children?.find(c => c.name === folderName && c.type === 'folder');
                    
                    if (!folderNode) {
                        folderNode = {
                            id: `${currentNode.id}/${folderName}`,
                            name: folderName,
                            type: 'folder',
                            path: `${currentNode.path}${separator}${folderName}`,
                            children: []
                        };
                        currentNode.children = currentNode.children || [];
                        currentNode.children.push(folderNode);
                    }
                    currentNode = folderNode;
                }

                // Add file node
                const fileName = parts[parts.length - 1] || r.path.split(/[/\\]/).pop() || 'unknown';
                currentNode.children = currentNode.children || [];
                currentNode.children.push({
                    id: r.id,
                    name: fileName,
                    type: 'file',
                    path: r.path
                });
            });

            // Sort children: folders first, then files, alphabetically
            const sortChildren = (node: TreeNode) => {
                if (node.children) {
                    node.children.sort((a, b) => {
                        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                        return a.name.localeCompare(b.name);
                    });
                    node.children.forEach(child => {
                        if (child.type === 'folder') sortChildren(child);
                    });
                }
            };
            sortChildren(rootNode);

            collectionTrees.push(rootNode);
        });

        return collectionTrees;
    }, [allLoadedResources, fileTreeSearch]);

    // --- File click handler ---
    const handleFileClick = useCallback((node: TreeNode) => {
        const resource = allLoadedResources.find(r => r.path === node.path);
        if (resource) {
            selectResource(resource.id);
        }
    }, [allLoadedResources, selectResource]);

    // --- Selected path for highlighting ---
    const selectedPath = useMemo(() => {
        const activeResource = allLoadedResources.find(r => r.id === activeResourceId);
        return activeResource?.path || null;
    }, [allLoadedResources, activeResourceId]);

    // --- Tree item config (enables context menu for file operations) ---
    const treeConfig: TreeItemConfig = useMemo(() => ({
        enableDragDrop: false,  // Will enable in Phase 4
        enableContextMenu: true,  // NEW: Context menu for Database tree
        enableRename: false,  // Database files aren't renamed through this UI
        enableCheckbox: false
    }), []);

    // --- Tree item callbacks ---
    const treeCallbacks: TreeItemCallbacks = useMemo(() => ({
        onFileClick: handleFileClick,
        onFolderToggle: undefined,
        onContextMenu: undefined,  // Use default context menu from UnifiedTreeItem
        onRename: undefined,
        onDelete: undefined,
        onCreate: undefined,
        onDrop: undefined
    }), [handleFileClick]);

    // --- Toolbar actions ---
    const fileTreeToolbarActions: ToolbarAction[] = useMemo(() => [
        {
            icon: faDatabase,
            tooltip: 'Back to Collections',
            onClick: () => setActiveView('collections'),
            variant: 'light' as const,
            color: 'blue'
        }
    ], []);

    const collectionsToolbarActions: ToolbarAction[] = useMemo(() => [
        {
            icon: faSync,
            tooltip: 'Refresh',
            onClick: () => fetchCollections()
        },
        {
            icon: faPlus,
            tooltip: 'Import Folder',
            onClick: handleImport
        },
        {
            icon: faFolderTree,
            tooltip: 'Show File Tree',
            onClick: () => setActiveView('dbFiles'),
            disabled: loadedCollections.length === 0
        },
        {
            icon: faFolder,
            tooltip: 'Project Folders',
            onClick: () => setActiveView('projects'),
            variant: 'subtle' as const,
            color: 'orange'
        }
    ], [fetchCollections, handleImport, loadedCollections.length]);

    // Get current view title and actions
    const currentTitle = activeView === 'collections' ? 'COLLECTIONS' : activeView === 'dbFiles' ? 'FILE TREE' : 'PROJECT FOLDERS';
    const currentActions = activeView === 'collections' ? collectionsToolbarActions : fileTreeToolbarActions;
    const showExpandToggle = activeView !== 'collections';

    return (
        <Stack p="xs" gap="xs" h="100%" style={{ overflow: 'hidden' }}>
            {/* Header Toolbar */}
            <TreeToolbar
                title={currentTitle}
                actions={currentActions}
                showExpandToggle={showExpandToggle}
                isExpanded={isToggleExpanded}
                onToggleExpand={toggleExpandState}
            />

            {/* Search box */}
            <Box px={4}>
                <TreeSearchInput
                    value={activeView === 'dbFiles' ? fileTreeSearch : activeView === 'projects' ? projectSearch : searchQuery}
                    onChange={activeView === 'dbFiles' ? setFileTreeSearch : activeView === 'projects' ? setProjectSearch : setSearchQuery}
                    onClear={() => activeView === 'dbFiles' ? setFileTreeSearch('') : activeView === 'projects' ? setProjectSearch('') : setSearchQuery('')}
                    placeholder={activeView === 'collections' ? "Search collections..." : "Filter files..."}
                />
            </Box>

            {/* Loading state */}
            {isLoading && collections.length === 0 && <Loader size="xs" mx="auto" />}

            {/* FILE TREE VIEW */}
            {activeView === 'dbFiles' ? (
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
                                <UnifiedTreeItem
                                    key={node.id}
                                    node={node}
                                    level={0}
                                    config={treeConfig}
                                    callbacks={treeCallbacks}
                                    selectedPath={selectedPath}
                                    expandSignal={expandAllSignal}
                                    collapseSignal={collapseAllSignal}
                                />
                            ))}
                        </Box>
                    )}
                </ScrollArea>
            ) : activeView === 'projects' ? (
                /* PROJECT FOLDERS VIEW */
                <ScrollArea style={{ flex: 1 }}>
                    {/* Quick Tools */}
                    <Box p="xs">
                        <Text size="xs" fw={700} c="dimmed" mb={4}>QUICK TOOLS</Text>
                        <Group gap={4}>
                            {onNavigate && (
                                <>
                                    <ActionIcon variant="light" size="sm" color="violet" onClick={() => onNavigate("wizard-preamble")}>
                                        <FontAwesomeIcon icon={faWandMagicSparkles} style={{ width: 14, height: 14 }} />
                                    </ActionIcon>
                                    <ActionIcon variant="light" size="sm" color="green" onClick={() => onNavigate("wizard-table")}>
                                        <FontAwesomeIcon icon={faTable} style={{ width: 14, height: 14 }} />
                                    </ActionIcon>
                                    <ActionIcon variant="light" size="sm" color="orange" onClick={() => onNavigate("wizard-tikz")}>
                                        <FontAwesomeIcon icon={faPenNib} style={{ width: 14, height: 14 }} />
                                    </ActionIcon>
                                </>
                            )}
                        </Group>
                    </Box>
                    <Divider my={4} color="default-border" />

                    {/* Project Folders Tree */}
                    {projectData.length === 0 ? (
                        <Box p="md" ta="center">
                            <Text size="xs" c="dimmed" mb="xs">No folder opened</Text>
                            {onOpenFolder && (
                                <Group justify="center">
                                    <Button size="xs" variant="default" onClick={onOpenFolder}>Open Folder</Button>
                                </Group>
                            )}
                        </Box>
                    ) : (
                        <Box>
                            {projectData.map(node => {
                                const treeNode: TreeNode = {
                                    ...node,
                                    isRoot: true,
                                    children: node.children as TreeNode[] | undefined
                                };
                                
                                const projectConfig: TreeItemConfig = {
                                    enableDragDrop: true,
                                    enableContextMenu: true,
                                    enableRename: true
                                };
                                
                                const projectCallbacks: TreeItemCallbacks = {
                                    onFileClick: (n) => onOpenFileNode && onOpenFileNode(n as FileSystemNode),
                                    onRename: onRenameItem ? (n, newName) => onRenameItem(n as FileSystemNode, newName) : undefined,
                                    onDelete: onDeleteItem ? (n) => onDeleteItem(n as FileSystemNode) : undefined,
                                    onCreate: (type, parentNode) => {
                                        setCreatingItem({ type, parentId: parentNode.id });
                                    },
                                    onRemoveFolder: onRemoveFolder ? (n) => onRemoveFolder(n.path) : undefined
                                };
                                
                                return (
                                    <UnifiedTreeItem
                                        key={node.id}
                                        node={treeNode}
                                        level={0}
                                        config={projectConfig}
                                        callbacks={projectCallbacks}
                                        selectedPath={selectedProjectNode?.path || null}
                                        expandSignal={expandAllSignal}
                                        collapseSignal={collapseAllSignal}
                                        creatingState={creatingItem}
                                        onCommitCreation={(name, type, parentPath) => {
                                            if (onCreateItem) onCreateItem(name, type, parentPath);
                                            setCreatingItem(null);
                                        }}
                                        onCancelCreation={() => setCreatingItem(null)}
                                    />
                                );
                            })}
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

            {/* Delete Confirmation Modal */}
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
