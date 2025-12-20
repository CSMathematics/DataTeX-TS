import React from 'react';
import { Box, ScrollArea, SimpleGrid, Paper, Tooltip, Code, Text } from '@mantine/core';
import { SYMBOLS_DB, SymbolCategory } from '../wizards/preamble/SymbolDB';

interface SymbolPanelProps {
    category: SymbolCategory;
    onInsert: (code: string) => void;
}

export const SymbolPanel: React.FC<SymbolPanelProps> = ({ category, onInsert }) => {
    const symbols = SYMBOLS_DB[category] || [];

    return (
        <Box
            w={250}
            h="100%"
            bg="dark.7"
            style={{
                borderRight: '1px solid var(--mantine-color-dark-6)',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)' }}>
                <Text size="sm" fw={700} c="dimmed" tt="uppercase">
                    {category.replace('_', ' ')}
                </Text>
            </Box>
            <ScrollArea flex={1} type="auto" offsetScrollbars>
                <Box p="xs">
                    <SimpleGrid cols={5} spacing="xs">
                        {symbols.map((s, index) => (
                            <Tooltip key={`${s.cmd}-${index}`} label={<Code>{s.cmd}</Code>} withArrow transitionProps={{ duration: 200 }}>
                                <Paper
                                    withBorder
                                    p={0}
                                    component="button"
                                    onClick={() => onInsert(s.cmd)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: 36,
                                        width: '100%',
                                        cursor: 'pointer',
                                        backgroundColor: 'var(--mantine-color-dark-6)',
                                        fontSize: '1.2rem',
                                        border: '1px solid transparent',
                                        color: 'inherit',
                                        transition: 'background-color 0.2s'
                                    }}
                                >
                                    {s.char}
                                </Paper>
                            </Tooltip>
                        ))}
                    </SimpleGrid>
                    {symbols.length === 0 && (
                        <Text c="dimmed" ta="center" mt="xl" size="sm">No symbols defined.</Text>
                    )}
                </Box>
            </ScrollArea>
        </Box>
    );
};
