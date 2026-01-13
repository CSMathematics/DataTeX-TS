import React, { useState } from "react";
import {
  Stack,
  Title,
  Text,
  ColorInput,
  Button,
  Group,
  TextInput,
  Paper,
  Divider,
} from "@mantine/core";
import {
  CustomThemeOverrides,
  CustomTheme,
  AppSettings,
} from "../../hooks/useSettings";

interface AdvancedThemeEditorProps {
  settings: AppSettings;
  onUpdateOverride: (overrides: CustomThemeOverrides | undefined) => void;
  onSaveTheme: (theme: CustomTheme) => void;
}

export const AdvancedThemeEditor: React.FC<AdvancedThemeEditorProps> = ({
  settings,
  onUpdateOverride,
  onSaveTheme,
}) => {
  const [themeName, setThemeName] = useState("");
  const overrides = settings.customThemeOverrides || {};

  const handleColorChange = (key: keyof CustomThemeOverrides, val: string) => {
    onUpdateOverride({
      ...overrides,
      [key]: val,
    });
  };

  const handleReset = () => {
    onUpdateOverride(undefined);
  };

  const handleSave = () => {
    if (!themeName.trim()) return;

    const newTheme: CustomTheme = {
      id: `custom-${Date.now()}`,
      label: themeName,
      baseThemeId: settings.uiTheme, // The current base theme
      overrides: overrides,
    };

    onSaveTheme(newTheme);
    setThemeName("");
  };

  // Helper to get current value or placeholder (from base theme?)
  // Ideally we would show the base theme color as placeholder, but accessing it requires getTheme(settings.uiTheme).
  // For now, prompt usage nicely.

  return (
    <Paper p="md" withBorder mt="md" bg="var(--mantine-color-default)">
      <Stack gap="sm">
        <Title order={5}>Advanced Theme Editor</Title>
        <Text size="xs" c="dimmed">
          Override specific colors of the current theme. Changes are applied
          immediately.
        </Text>

        <ColorInput
          label="App Background"
          description="Main background behind the editor"
          placeholder="#ffffff"
          value={overrides.appBg || ""}
          onChange={(val) => handleColorChange("appBg", val)}
        />
        <ColorInput
          label="Sidebar Background"
          description="Left sidebar (activity bar)"
          placeholder="#f8f9fa"
          value={overrides.sidebarBg || ""}
          onChange={(val) => handleColorChange("sidebarBg", val)}
        />
        <ColorInput
          label="Header Background"
          description="Top navigation bar"
          placeholder="#ffffff"
          value={overrides.headerBg || ""}
          onChange={(val) => handleColorChange("headerBg", val)}
        />
        <ColorInput
          label="Panel Background"
          description="Side panels (files, database)"
          placeholder="#f8f9fa"
          value={overrides.panelBg || ""}
          onChange={(val) => handleColorChange("panelBg", val)}
        />
        <ColorInput
          label="Status Bar Background"
          description="Bottom status bar"
          placeholder="#blue"
          value={overrides.statusBarBg || ""}
          onChange={(val) => handleColorChange("statusBarBg", val)}
        />
        <ColorInput
          label="Primary Color"
          description="Main accent color (buttons, highlights)"
          placeholder="blue" // Mantine color name or hex
          value={overrides.primaryColor || ""}
          onChange={(val) => handleColorChange("primaryColor", val)}
        />
        <ColorInput
          label="Accent Color"
          description="Secondary accent (icons, active states)"
          placeholder="#339af0"
          value={overrides.accentColor || ""}
          onChange={(val) => handleColorChange("accentColor", val)}
        />
        <ColorInput
          label="Border Color"
          description="Global border color"
          placeholder="default"
          value={overrides.borderColor || ""}
          onChange={(val) => handleColorChange("borderColor", val)}
        />

        <Divider my="xs" label="Actions" labelPosition="center" />

        <Group justify="space-between" align="flex-end">
          <Button variant="subtle" color="red" size="xs" onClick={handleReset}>
            Reset Overrides
          </Button>

          <Group gap="xs" align="flex-end">
            <TextInput
              size="xs"
              placeholder="New Theme Name"
              value={themeName}
              onChange={(e) => setThemeName(e.currentTarget.value)}
              style={{ width: 150 }}
            />
            <Button
              size="xs"
              variant="light"
              disabled={!themeName.trim()}
              onClick={handleSave}
            >
              Save as Theme
            </Button>
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
};
