import React from "react";
import { Stack, Title, Text, Switch, Select } from "@mantine/core";
import { GeneralSettings as IGeneralSettings } from "../../hooks/useSettings";

interface GeneralSettingsProps {
  settings: IGeneralSettings;
  onUpdate: <K extends keyof IGeneralSettings>(
    key: K,
    value: IGeneralSettings[K]
  ) => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  settings,
  onUpdate,
}) => {
  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>General Settings</Title>
      <Text size="sm" c="dimmed">
        Global application settings.
      </Text>

      <Select
        label="Startup Behavior"
        description="What to show when the application starts"
        data={[
          { value: "restore", label: "Restore Last Session" },
          { value: "welcome", label: "Show Welcome Screen" },
          { value: "empty", label: "Empty Workspace" },
        ]}
        value={settings.startupBehavior}
        onChange={(val) => val && onUpdate("startupBehavior", val as any)}
      />

      <Switch
        label="Confirm on Exit"
        description="Ask for confirmation before closing with unsaved changes"
        checked={settings.confirmOnExit}
        onChange={(e) => onUpdate("confirmOnExit", e.currentTarget.checked)}
      />

      <Select
        label="Language"
        description="The language of the user interface."
        data={[
          { value: "en", label: "English" },
          // { value: 'el', label: 'Greek (Coming Soon)' }
        ]}
        value={settings.language}
        onChange={(val) => val && onUpdate("language", val)}
        disabled
      />

      <Switch
        label="Auto Save"
        description="Automatically save changes (Coming Soon)."
        checked={settings.autoSave}
        onChange={(e) => onUpdate("autoSave", e.currentTarget.checked)}
        disabled
      />
    </Stack>
  );
};
