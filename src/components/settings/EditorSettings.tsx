import React from 'react';
import { Stack, Title, Text, Select, NumberInput, Switch, TextInput } from '@mantine/core';
import { EditorSettings as IEditorSettings } from '../../hooks/useSettings';

interface EditorSettingsProps {
    settings: IEditorSettings;
    onUpdate: <K extends keyof IEditorSettings>(key: K, value: IEditorSettings[K]) => void;
}

export const EditorSettings: React.FC<EditorSettingsProps> = ({ settings, onUpdate }) => {
    return (
        <Stack gap="md" maw={600}>
            <Title order={4}>Editor Settings</Title>
            <Text size="sm" c="dimmed">Customize the code editor experience.</Text>

            <NumberInput
                label="Font Size"
                description="Controls the font size in pixels."
                value={settings.fontSize}
                onChange={(val) => onUpdate('fontSize', Number(val))}
                min={8}
                max={32}
            />

            <TextInput
                label="Font Family"
                description="The font family used in the editor."
                value={settings.fontFamily}
                onChange={(e) => onUpdate('fontFamily', e.currentTarget.value)}
            />

            <Select
                label="Word Wrap"
                description="Controls how lines should wrap."
                data={[
                    { value: 'on', label: 'On' },
                    { value: 'off', label: 'Off' }
                ]}
                value={settings.wordWrap}
                onChange={(val) => onUpdate('wordWrap', val as 'on' | 'off')}
            />

            <Select
                label="Line Numbers"
                description="Controls the display of line numbers."
                data={[
                    { value: 'on', label: 'On' },
                    { value: 'off', label: 'Off' },
                    { value: 'relative', label: 'Relative' }
                ]}
                value={settings.lineNumbers}
                onChange={(val) => onUpdate('lineNumbers', val as any)}
            />

            <Switch
                label="Minimap"
                description="Controls whether the minimap is shown."
                checked={settings.minimap}
                onChange={(e) => onUpdate('minimap', e.currentTarget.checked)}
            />
        </Stack>
    );
};
