import React from "react";
import { Stack, Title, Text, Select, NumberInput, Switch } from "@mantine/core";
import { EditorBehaviorSettings as IEditorBehaviorSettings } from "../../hooks/useSettings";
import { SettingGroup } from "./SettingGroup";

interface EditorBehaviorSettingsProps {
  settings: IEditorBehaviorSettings;
  onUpdate: <K extends keyof IEditorBehaviorSettings>(
    key: K,
    value: IEditorBehaviorSettings[K]
  ) => void;
}

export const EditorBehaviorSettings: React.FC<EditorBehaviorSettingsProps> = ({
  settings,
  onUpdate,
}) => {
  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>Editor Behavior Settings</Title>
      <Text size="sm" c="dimmed">
        Customize how the editor responds to your input.
      </Text>

      <SettingGroup
        title="Formatting"
        description="Indentation and spacing preferences"
      >
        <NumberInput
          label="Tab Size"
          description="Number of spaces per tab"
          value={settings.tabSize}
          onChange={(val) => onUpdate("tabSize", Number(val))}
          min={2}
          max={8}
        />

        <Switch
          label="Insert Spaces"
          description="Use spaces instead of tab characters"
          checked={settings.insertSpaces}
          onChange={(e) => onUpdate("insertSpaces", e.currentTarget.checked)}
        />
      </SettingGroup>

      <SettingGroup
        title="Auto Completion"
        description="Automatic insertion and completion"
      >
        <Switch
          label="Auto Close Brackets"
          description="Automatically close (), {}, [], and quotes"
          checked={settings.autoCloseBrackets}
          onChange={(e) =>
            onUpdate("autoCloseBrackets", e.currentTarget.checked)
          }
        />

        <Switch
          label="Auto Close LaTeX Environments"
          description="Automatically insert \\end{} when typing \\begin{}"
          checked={settings.autoCloseLatexEnv}
          onChange={(e) =>
            onUpdate("autoCloseLatexEnv", e.currentTarget.checked)
          }
        />

        <Switch
          label="Suggest on Trigger Characters"
          description="Show IntelliSense suggestions when typing \\"
          checked={settings.suggestOnTrigger}
          onChange={(e) =>
            onUpdate("suggestOnTrigger", e.currentTarget.checked)
          }
        />

        <Switch
          label="Quick Suggestions"
          description="Show inline suggestions while typing"
          checked={settings.quickSuggestions}
          onChange={(e) =>
            onUpdate("quickSuggestions", e.currentTarget.checked)
          }
        />
      </SettingGroup>

      <SettingGroup
        title="Editor Actions"
        description="Automatic formatting and saving"
      >
        <Switch
          label="Format on Save"
          description="Automatically format document when saving"
          checked={settings.formatOnSave}
          onChange={(e) => onUpdate("formatOnSave", e.currentTarget.checked)}
        />

        <Switch
          label="Scroll Beyond Last Line"
          description="Allow scrolling past the end of the document"
          checked={settings.scrollBeyondLastLine}
          onChange={(e) =>
            onUpdate("scrollBeyondLastLine", e.currentTarget.checked)
          }
        />
      </SettingGroup>

      <SettingGroup title="Cursor" description="Cursor appearance and behavior">
        <Select
          label="Cursor Style"
          description="Visual style of the text cursor"
          data={[
            { value: "line", label: "Line (|)" },
            { value: "block", label: "Block (█)" },
            { value: "underline", label: "Underline (_)" },
          ]}
          value={settings.cursorStyle}
          onChange={(val) => val && onUpdate("cursorStyle", val as any)}
        />

        <Select
          label="Cursor Blinking"
          description="Animation style for the cursor"
          data={[
            { value: "blink", label: "Blink" },
            { value: "smooth", label: "Smooth" },
            { value: "phase", label: "Phase" },
            { value: "expand", label: "Expand" },
            { value: "solid", label: "Solid (No Blink)" },
          ]}
          value={settings.cursorBlinking}
          onChange={(val) => val && onUpdate("cursorBlinking", val as any)}
        />
      </SettingGroup>
    </Stack>
  );
};
