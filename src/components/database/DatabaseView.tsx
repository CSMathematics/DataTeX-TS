import React, { useState, useMemo, useCallback } from 'react';
import { Table, ScrollArea, Group, Text, TextInput, Badge } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; 
import { faSearch, faSort } from '@fortawesome/free-solid-svg-icons';
import { useDatabaseStore } from '../../stores/databaseStore';

interface DatabaseViewProps {
    onOpenFile?: (path: string) => void;
}

export const DatabaseView = React.memo(({ onOpenFile }: DatabaseViewProps) => {
    const { allLoadedResources, loadedCollections, selectResource, activeResourceId } = useDatabaseStore();
    const [search, setSearch] = useState('');
    
    // Derived columns from metadata
    // We scan all resources in current view to find all unique metadata keys
    const columns = useMemo(() => {
        const standardCols = ['title', 'collection', 'kind']; // Standard fields - title first
        const metaKeys = new Set<string>();
        allLoadedResources.forEach(r => {
            if (r.metadata) {
                Object.keys(r.metadata).forEach(k => metaKeys.add(k));
            }
        });
        return [...standardCols, ...Array.from(metaKeys)];
    }, [allLoadedResources]);

    const filteredData = useMemo(() => {
        if (!search) return allLoadedResources;
        return allLoadedResources.filter(r => 
            r.title?.toLowerCase().includes(search.toLowerCase()) ||
            r.id.toLowerCase().includes(search.toLowerCase()) ||
            r.collection.toLowerCase().includes(search.toLowerCase()) ||
            JSON.stringify(r.metadata).toLowerCase().includes(search.toLowerCase())
        );
    }, [allLoadedResources, search]);

    const handleRowClick = useCallback((id: string, path: string) => {
        selectResource(id);
        if (onOpenFile) {
            onOpenFile(path);
        }
    }, [selectResource, onOpenFile]);

    if (loadedCollections.length === 0) {
        return <Text p="xl" c="dimmed" ta="center">Select one or more collections to view their contents.</Text>;
    }

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <Group p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}>
                <Text fw={700} size="sm">
                    {loadedCollections.length === 1 
                        ? loadedCollections[0] 
                        : `${loadedCollections.length} Collections`}
                </Text>
                <Badge size="sm">{filteredData.length} .tex files</Badge>
                <Group ml="auto">
                    <TextInput 
                        placeholder="Search..." 
                        leftSection={<FontAwesomeIcon icon={faSearch} style={{ width: 12, height: 12 }} />}
                        value={search}
                        onChange={(e) => setSearch(e.currentTarget.value)}
                        size="xs"
                        styles={{ input: { height: 28 } }}
                    />
                </Group>
            </Group>

            {/* Table Area */}
            <ScrollArea style={{ flex: 1 }}>
                <Table stickyHeader highlightOnHover striped>
                    <Table.Thead>
                        <Table.Tr>
                            {columns.map(col => (
                                <Table.Th key={col} style={{ whiteSpace: 'nowrap' }}>
                                    <Group gap={4} style={{ cursor: 'pointer' }}>
                                        <Text size="xs" fw={700} tt="capitalize">{col}</Text>
                                        <FontAwesomeIcon icon={faSort} style={{ opacity: 0.3, width: 10 }} />
                                    </Group>
                                    <TextInput 
                                        placeholder={`Filter ${col}`} 
                                        size="xs" 
                                        mt={4} 
                                        variant="filled" 
                                        styles={{ input: { height: 22, fontSize: 10 } }}
                                    />
                                </Table.Th>
                            ))}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {filteredData.map(row => {
                            const isSelected = row.id === activeResourceId;
                            // Extract filename from path
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
                                                <Text size="xs">{String(val)}</Text>
                                            </Table.Td>
                                        );
                                    })}
                                </Table.Tr>
                            );
                        })}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </div>
    );
});
