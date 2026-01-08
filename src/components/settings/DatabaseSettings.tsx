import React from "react";
import { Stack, Title, Text, Select, NumberInput, Switch } from "@mantine/core";
import { DatabaseSettings as IDatabaseSettings } from "../../hooks/useSettings";
import { SettingGroup } from "./SettingGroup";

interface DatabaseSettingsProps {
  settings: IDatabaseSettings;
  onUpdate: <K extends keyof IDatabaseSettings>(
    key: K,
    value: IDatabaseSettings[K]
  ) => void;
}

export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({
  settings,
  onUpdate,
}) => {
  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>Database Settings</Title>
      <Text size="sm" c="dimmed">
        Customize database view and behavior.
      </Text>

      <SettingGroup
        title="View Settings"
        description="Default views and display options"
      >
        <Select
          label="Default View"
          description="How the database is displayed by default"
          data={[
            { value: "table", label: "Table View" },
            { value: "graph", label: "Graph View" },
            { value: "list", label: "List View" },
          ]}
          value={settings.defaultView}
          onChange={(val) => val && onUpdate("defaultView", val as any)}
        />

        <Switch
          label="Show Metadata Panel"
          description="Display metadata panel by default when viewing resources"
          checked={settings.showMetadataPanel}
          onChange={(e) =>
            onUpdate("showMetadataPanel", e.currentTarget.checked)
          }
        />

        <NumberInput
          label="Table Page Size"
          description="Number of rows per page in table view (10-100)"
          value={settings.tablePageSize}
          onChange={(val) => onUpdate("tablePageSize", Number(val))}
          min={10}
          max={100}
        />
      </SettingGroup>

      <SettingGroup
        title="Graph View"
        description="Settings for visual graph display"
      >
        <Switch
          label="Enable Physics Simulation"
          description="Use force-directed layout for graph visualization"
          checked={settings.graphPhysics}
          onChange={(e) => onUpdate("graphPhysics", e.currentTarget.checked)}
        />

        <Switch
          label="Graph Animation"
          description="Animate graph transitions and interactions"
          checked={settings.graphAnimation}
          onChange={(e) => onUpdate("graphAnimation", e.currentTarget.checked)}
        />
      </SettingGroup>

      <SettingGroup
        title="Advanced Options"
        description="Additional database features"
      >
        <Switch
          label="Auto-detect Preambles"
          description="Automatically identify and categorize preamble files"
          checked={settings.autoDetectPreambles}
          onChange={(e) =>
            onUpdate("autoDetectPreambles", e.currentTarget.checked)
          }
        />

        <Switch
          label="Show File Preview on Hover"
          description="Display file preview tooltip when hovering over items"
          checked={settings.showFilePreview}
          onChange={(e) => onUpdate("showFilePreview", e.currentTarget.checked)}
        />
      </SettingGroup>
    </Stack>
  );
};
