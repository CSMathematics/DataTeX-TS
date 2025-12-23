import React from 'react';
import { Table, ScrollArea, Box, Text, Group, ActionIcon, Badge } from '@mantine/core';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faExclamationCircle, faExclamationTriangle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { LogEntry } from '../../utils/logParser';

interface LogPanelProps {
    entries: LogEntry[];
    onClose: () => void;
    onJump: (line: number) => void;
}

export const LogPanel: React.FC<LogPanelProps> = ({ entries, onClose, onJump }) => {

    const rows = entries.map((entry, index) => (
        <Table.Tr
            key={index}
            onClick={() => onJump(entry.line)}
            style={{ cursor: 'pointer' }}
        >
            <Table.Td style={{ width: 40, textAlign: 'center' }}>
                {entry.type === 'error' && <FontAwesomeIcon icon={faExclamationCircle} style={{ color: 'var(--mantine-color-red-6)' }} />}
                {entry.type === 'warning' && <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: 'var(--mantine-color-yellow-6)' }} />}
                {entry.type === 'info' && <FontAwesomeIcon icon={faInfoCircle} style={{ color: 'var(--mantine-color-blue-6)' }} />}
            </Table.Td>
            <Table.Td style={{ width: 80 }}>
                 {entry.line > 0 ? `Line ${entry.line}` : '-'}
            </Table.Td>
            <Table.Td>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {entry.message}
                </Text>
            </Table.Td>
        </Table.Tr>
    ));

    const errorCount = entries.filter(e => e.type === 'error').length;
    const warningCount = entries.filter(e => e.type === 'warning').length;

    return (
        <Box h="100%" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--mantine-color-body)', borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Group justify="space-between" px="xs" py={4} bg="var(--mantine-color-default)" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                <Group gap="xs">
                    <Text size="xs" fw={700} c="dimmed">LOGS</Text>
                    <Badge size="xs" color="red" variant="light">{errorCount} Errors</Badge>
                    <Badge size="xs" color="yellow" variant="light">{warningCount} Warnings</Badge>
                </Group>
                <ActionIcon size="xs" variant="transparent" onClick={onClose}>
                    <FontAwesomeIcon icon={faTimes} />
                </ActionIcon>
            </Group>

            <ScrollArea style={{ flex: 1 }}>
                <Table striped highlightOnHover stickyHeader>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th style={{ width: 40 }}></Table.Th>
                            <Table.Th style={{ width: 80 }}>Line</Table.Th>
                            <Table.Th>Message</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {rows.length > 0 ? rows : (
                            <Table.Tr>
                                <Table.Td colSpan={3}>
                                    <Text size="sm" c="dimmed" ta="center" py="xl">No errors or warnings found.</Text>
                                </Table.Td>
                            </Table.Tr>
                        )}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </Box>
    );
};
