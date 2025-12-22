import React from 'react';
import { Stack, Title, Text, Select } from '@mantine/core';
import { AppSettings } from '../../hooks/useSettings';

interface ThemeSettingsProps {
    settings: AppSettings;
    onUpdateEditor: (key: 'theme', value: string) => void;
    onUpdateUi: (theme: 'dark' | 'light' | 'auto') => void;
}

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({ settings, onUpdateEditor, onUpdateUi }) => {
    return (
        <Stack gap="md" maw={600}>
            <Title order={4}>Theme Settings</Title>
            <Text size="sm" c="dimmed">Customize the look and feel of the application.</Text>

            <Select
                label="Editor Theme"
                description="Color theme for the code editor."
                data={[
                    { value: 'data-tex-dark', label: 'DataTex Dark' },
                    { value: 'data-tex-light', label: 'DataTex Light' },
                    { value: 'data-tex-hc', label: 'High Contrast' },
                ]}
                value={settings.editor.theme}
                onChange={(val) => val && onUpdateEditor('theme', val)}
            />

            <Select
                label="UI Theme"
                description="Color theme for the application interface."
                data={[
                    { value: 'dark', label: 'Dark' },
                    { value: 'light', label: 'Light' },
                    { value: 'auto', label: 'System Default' }
                ]}
                value={settings.uiTheme}
                onChange={(val) => val && onUpdateUi(val as any)}
            />
        </Stack>
    );
};
