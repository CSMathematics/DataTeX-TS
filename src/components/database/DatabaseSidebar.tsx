import { useEffect, useState, useMemo, useCallback } from 'react';
import { Stack, Text, Loader, ActionIcon, Group, Tooltip, Box, TextInput, Checkbox, UnstyledButton } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSync, faSearch, faTimes, faDatabase } from '@fortawesome/free-solid-svg-icons';
import { useDatabaseStore } from '../../stores/databaseStore';
import { open } from '@tauri-apps/plugin-dialog';

export const DatabaseSidebar = () => {
    const { 
        collections, 
        fetchCollections, 
        loadedCollections, 
        toggleCollectionLoaded, 
        isLoading, 
        importFolder 
    } = useDatabaseStore();
    const [searchQuery, setSearchQuery] = useState('');

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

    const filteredCollections = useMemo(() => {
        if (!searchQuery) return collections;
        return collections.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [collections, searchQuery]);

    return (
        <Stack p="xs" gap="xs" h="100%" style={{ overflow: 'hidden' }}>
            <Group justify="space-between" px={4}>
                <Text size="xs" fw={700} c="dimmed">COLLECTIONS</Text>
                <Group gap={2}>
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
                </Group>
            </Group>

            <Box px={4}>
                <TextInput 
                    placeholder="Search collections..." 
                    size="xs" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    rightSection={searchQuery ? <ActionIcon size="xs" variant="transparent" onClick={() => setSearchQuery('')}><FontAwesomeIcon icon={faTimes} /></ActionIcon> : <FontAwesomeIcon icon={faSearch} style={{ width: 12, height: 12, color: 'var(--mantine-color-dimmed)' }} />}
                />
            </Box>

            {isLoading && collections.length === 0 && <Loader size="xs" mx="auto" />}

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
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '6px 8px',
                                    borderRadius: 4,
                                    backgroundColor: isLoaded ? 'rgba(64, 192, 87, 0.1)' : 'transparent',
                                    transition: 'background-color 0.15s ease',
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
        </Stack>
    );
};

