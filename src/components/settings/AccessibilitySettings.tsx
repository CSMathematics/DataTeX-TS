import React from "react";
import { Stack, Title, Text, Select, NumberInput, Switch } from "@mantine/core";
import { AccessibilitySettings as IAccessibilitySettings } from "../../hooks/useSettings";
import { SettingGroup } from "./SettingGroup";

interface AccessibilitySettingsProps {
  settings: IAccessibilitySettings;
  onUpdate: <K extends keyof IAccessibilitySettings>(
    key: K,
    value: IAccessibilitySettings[K]
  ) => void;
}

export const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({
  settings,
  onUpdate,
}) => {
  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>Accessibility Settings</Title>
      <Text size="sm" c="dimmed">
        Improve readability and reduce visual strain.
      </Text>

      <SettingGroup
        title="Visual Enhancements"
        description="Settings for better visibility"
      >
        <Switch
          label="High Contrast Mode"
          description="Increase contrast for better visibility"
          checked={settings.highContrastMode}
          onChange={(e) =>
            onUpdate("highContrastMode", e.currentTarget.checked)
          }
        />

        <Switch
          label="Font Ligatures"
          description="Use special character combinations (→, ≤, etc.)"
          checked={settings.fontLigatures}
          onChange={(e) => onUpdate("fontLigatures", e.currentTarget.checked)}
        />

        <NumberInput
          label="Letter Spacing"
          description="Additional space between letters in pixels (0-2)"
          value={settings.letterSpacing}
          onChange={(val) => onUpdate("letterSpacing", Number(val))}
          min={0}
          max={2}
          step={0.1}
          decimalScale={1}
          suffix=" px"
        />

        <NumberInput
          label="Line Height"
          description="Vertical space between lines (1.0-2.0)"
          value={settings.lineHeight}
          onChange={(val) => onUpdate("lineHeight", Number(val))}
          min={1.0}
          max={2.0}
          step={0.1}
          decimalScale={1}
        />

        <Select
          label="Render Whitespace"
          description="Show invisible whitespace characters"
          data={[
            { value: "none", label: "None" },
            { value: "boundary", label: "Boundary (Trailing/Leading)" },
            { value: "selection", label: "Selection Only" },
            { value: "all", label: "All Whitespace" },
          ]}
          value={settings.renderWhitespace}
          onChange={(val) => val && onUpdate("renderWhitespace", val as any)}
        />
      </SettingGroup>

      <SettingGroup
        title="Motion & Animation"
        description="Control movement and transitions"
      >
        <Switch
          label="Smooth Scrolling"
          description="Enable smooth scrolling animations"
          checked={settings.smoothScrolling}
          onChange={(e) => onUpdate("smoothScrolling", e.currentTarget.checked)}
        />

        <Select
          label="Animation Speed"
          description="Speed of UI animations and transitions"
          data={[
            { value: "slow", label: "Slow (Relaxed)" },
            { value: "normal", label: "Normal" },
            { value: "fast", label: "Fast (Snappy)" },
            { value: "none", label: "None (Instant)" },
          ]}
          value={settings.animationSpeed}
          onChange={(val) => val && onUpdate("animationSpeed", val as any)}
        />

        <Switch
          label="Reduce Motion"
          description="Minimize animations for motion sensitivity (overrides animation speed)"
          checked={settings.reduceMotion}
          onChange={(e) => onUpdate("reduceMotion", e.currentTarget.checked)}
        />
      </SettingGroup>
    </Stack>
  );
};
