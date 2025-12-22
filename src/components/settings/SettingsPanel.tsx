import React, { useState } from 'react';
import { Box, Group, NavLink, Title, Text, ScrollArea } from '@mantine/core';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faTerminal, faPalette, faCode } from "@fortawesome/free-solid-svg-icons";
import { TexEngineSettings } from './TexEngineSettings';

type SettingsCategory = 'general' | 'tex' | 'editor' | 'theme';

interface SettingsPanelProps {
    initialCategory?: SettingsCategory;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ initialCategory = 'tex' }) => {
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>(initialCategory);

    const renderContent = () => {
        switch (activeCategory) {
            case 'tex':
                return <TexEngineSettings />;
            case 'general':
                return <Text>General settings (coming soon)</Text>;
            case 'editor':
                return <Text>Editor settings (coming soon)</Text>;
            case 'theme':
                return <Text>Theme settings (coming soon)</Text>;
            default:
                return <TexEngineSettings />;
        }
    };

    return (
        <Group h="100%" gap={0} align="stretch" style={{ overflow: 'hidden' }}>
            {/* Settings Sidebar */}
            <Box w={250} bg="dark.8" style={{ borderRight: '1px solid var(--mantine-color-dark-6)' }}>
                <Box p="md">
                    <Title order={4} mb="xs">Settings</Title>
                </Box>
                <Box>
                    <NavLink
                        label="General"
                        leftSection={<FontAwesomeIcon icon={faCog} style={{ width: 16 }} />}
                        active={activeCategory === 'general'}
                        onClick={() => setActiveCategory('general')}
                    />
                    <NavLink
                        label="TeX Engines"
                        leftSection={<FontAwesomeIcon icon={faTerminal} style={{ width: 16 }} />}
                        active={activeCategory === 'tex'}
                        onClick={() => setActiveCategory('tex')}
                    />
                    <NavLink
                        label="Editor"
                        leftSection={<FontAwesomeIcon icon={faCode} style={{ width: 16 }} />}
                        active={activeCategory === 'editor'}
                        onClick={() => setActiveCategory('editor')}
                    />
                    <NavLink
                        label="Theme"
                        leftSection={<FontAwesomeIcon icon={faPalette} style={{ width: 16 }} />}
                        active={activeCategory === 'theme'}
                        onClick={() => setActiveCategory('theme')}
                    />
                </Box>
            </Box>

            {/* Content Area */}
            <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <ScrollArea p="xl">
                   {renderContent()}
                </ScrollArea>
            </Box>
        </Group>
    );
};
