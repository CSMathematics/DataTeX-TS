import React from 'react';
import { Box, Group, NavLink, Title, ScrollArea } from '@mantine/core';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faTerminal, faPalette, faCode } from "@fortawesome/free-solid-svg-icons";
import { TexEngineSettings } from './TexEngineSettings';
import { EditorSettings } from './EditorSettings';
import { ThemeSettings } from './ThemeSettings';
import { GeneralSettings } from './GeneralSettings';
import { AppSettings, EditorSettings as IEditorSettings, GeneralSettings as IGeneralSettings } from '../../hooks/useSettings';

type SettingsCategory = 'general' | 'tex' | 'editor' | 'theme';

interface SettingsPanelProps {
    initialCategory?: SettingsCategory;
    settings: AppSettings;
    onUpdateEditor: <K extends keyof IEditorSettings>(key: K, value: IEditorSettings[K]) => void;
    onUpdateGeneral: <K extends keyof IGeneralSettings>(key: K, value: IGeneralSettings[K]) => void;
    onUpdateUi: (theme: 'dark' | 'light' | 'auto') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    initialCategory = 'tex',
    settings,
    onUpdateEditor,
    onUpdateGeneral,
    onUpdateUi
}) => {
    const [activeCategory, setActiveCategory] = React.useState<SettingsCategory>(initialCategory);

    const renderContent = () => {
        switch (activeCategory) {
            case 'tex':
                return <TexEngineSettings />;
            case 'general':
                return <GeneralSettings settings={settings.general} onUpdate={onUpdateGeneral} />;
            case 'editor':
                return <EditorSettings settings={settings.editor} onUpdate={onUpdateEditor} />;
            case 'theme':
                return <ThemeSettings settings={settings} onUpdateEditor={onUpdateEditor} onUpdateUi={onUpdateUi} />;
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
                <ScrollArea p="xl" style={{ height: '100%' }}>
                   {renderContent()}
                </ScrollArea>
            </Box>
        </Group>
    );
};
