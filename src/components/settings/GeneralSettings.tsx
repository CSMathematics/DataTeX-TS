import React from 'react';
import { Stack, Title, Text, Switch, Select } from '@mantine/core';
import { GeneralSettings as IGeneralSettings } from '../../hooks/useSettings';

interface GeneralSettingsProps {
    settings: IGeneralSettings;
    onUpdate: <K extends keyof IGeneralSettings>(key: K, value: IGeneralSettings[K]) => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, onUpdate }) => {
    return (
        <Stack gap="md" maw={600}>
            <Title order={4}>General Settings</Title>
            <Text size="sm" c="dimmed">Global application settings.</Text>

             <Select
                label="Language"
                description="The language of the user interface."
                data={[
                    { value: 'en', label: 'English' },
                    // { value: 'el', label: 'Greek (Coming Soon)' }
                ]}
                value={settings.language}
                onChange={(val) => val && onUpdate('language', val)}
                disabled
            />

            <Switch
                label="Auto Save"
                description="Automatically save changes (Coming Soon)."
                checked={settings.autoSave}
                onChange={(e) => onUpdate('autoSave', e.currentTarget.checked)}
                disabled
            />
        </Stack>
    );
};
