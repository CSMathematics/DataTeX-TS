import React from "react";
import { ActionIcon, Group, Select, Stack, Text, Title } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import {
  AppSettings,
  CustomTheme,
  CustomThemeOverrides,
} from "../../hooks/useSettings";
import { AdvancedThemeEditor } from "./AdvancedThemeEditor";

interface ThemeSettingsProps {
  settings: AppSettings;
  onUpdateUi: (theme: string) => void;
  onUpdateCustomThemeOverride: (
    overrides: CustomThemeOverrides | undefined
  ) => void;
  onAddCustomTheme: (theme: CustomTheme) => void;
  onRemoveCustomTheme: (id: string) => void;
}

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({
  settings,
  onUpdateUi,
  onUpdateCustomThemeOverride,
  onAddCustomTheme,
  onRemoveCustomTheme,
}) => {
  const customThemeItems = (settings.customThemes || []).map((t) => ({
    value: t.id,
    label: t.label,
  }));

  const handleDeleteTheme = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onRemoveCustomTheme(id);
    if (settings.uiTheme === id) {
      onUpdateUi("dark-blue");
    }
  };

  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>Theme Settings</Title>
      <Text size="sm" c="dimmed">
        Customize the look and feel of the application.
      </Text>

      <Select
        label="UI Theme"
        description="Color theme for the application interface."
        data={[
          {
            group: "Custom",
            items: customThemeItems,
          },
          {
            group: "Light",
            items: [
              { value: "light-blue", label: "Light Blue (Default)" },
              { value: "light-gray", label: "Light Gray (Minimal)" },
              { value: "light-teal", label: "Light Teal (Nature)" },
            ],
          },
          {
            group: "Dark",
            items: [
              { value: "dark-blue", label: "Dark Blue (Default)" },
              { value: "dark-deep", label: "Deep Black (OLED)" },
              { value: "dark-monokai", label: "Monokai Vivid" },
              { value: "dark-nord", label: "Nordic Cool" },
            ],
          },
        ]}
        value={settings.uiTheme}
        onChange={(val) => val && onUpdateUi(val)}
        renderOption={({ option }) => {
          const isCustom = settings.customThemes?.some(
            (t) => t.id === option.value
          );
          return (
            <Group flex="1" justify="space-between" wrap="nowrap">
              <Text size="sm">{option.label}</Text>
              {isCustom && (
                <ActionIcon
                  size="sm"
                  color="red"
                  variant="subtle"
                  onMouseDown={(e) => handleDeleteTheme(e, option.value)}
                >
                  <FontAwesomeIcon icon={faTrash} style={{ width: 12 }} />
                </ActionIcon>
              )}
            </Group>
          );
        }}
      />

      <AdvancedThemeEditor
        settings={settings}
        onUpdateOverride={onUpdateCustomThemeOverride}
        onSaveTheme={onAddCustomTheme}
      />
    </Stack>
  );
};
