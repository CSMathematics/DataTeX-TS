import React from 'react';
import { Stack, Tooltip, UnstyledButton } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlus,
    faEquals,
    faArrowRight,
    faCode,
    faFont,
    faCalculator,
    faQuoteRight,
    faFlag,
    faStar,
    faGlobe
} from '@fortawesome/free-solid-svg-icons';
import { SymbolCategory } from '../wizards/preamble/SymbolDB';

interface SymbolSidebarProps {
    activeCategory: SymbolCategory | null;
    onSelectCategory: (category: SymbolCategory | null) => void;
}

const CATEGORIES: { id: SymbolCategory; icon: any; label: string }[] = [
    { id: 'operators', icon: faPlus, label: 'Operators' },
    { id: 'relations', icon: faEquals, label: 'Relations' },
    { id: 'arrows', icon: faArrowRight, label: 'Arrows' },
    { id: 'delimiters', icon: faCode, label: 'Delimiters' },
    { id: 'greek', icon: faFont, label: 'Greek' },
    { id: 'cyrillic', icon: faGlobe, label: 'Cyrillic' },
    { id: 'misc', icon: faCalculator, label: 'Misc Math' },
    { id: 'misc_text', icon: faQuoteRight, label: 'Misc Text' },
    { id: 'fontawesome', icon: faFlag, label: 'FontAwesome' },
    { id: 'special', icon: faStar, label: 'Special' },
];

export const SymbolSidebar = React.memo<SymbolSidebarProps>(({ activeCategory, onSelectCategory }) => {
    return (
        <Stack
            w={40}
            h="100%"
            gap={0}
            bg="dark.8"
            align="center"
            style={{ borderRight: '1px solid var(--mantine-color-dark-6)', zIndex: 10 }}
        >
            {CATEGORIES.map((cat) => (
                <Tooltip key={cat.id} label={cat.label} position="right" withArrow>
                    <UnstyledButton
                        onClick={() => onSelectCategory(activeCategory === cat.id ? null : cat.id)}
                        style={{
                            width: 40,
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: activeCategory === cat.id ? 'var(--mantine-color-dark-6)' : 'transparent',
                            color: activeCategory === cat.id ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-gray-5)',
                            transition: 'background-color 0.2s, color 0.2s',
                        }}
                    >
                        <FontAwesomeIcon icon={cat.icon} style={{ width: 16, height: 16 }} />
                    </UnstyledButton>
                </Tooltip>
            ))}
        </Stack>
    );
});
