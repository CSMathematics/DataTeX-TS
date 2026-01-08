import React from "react";
import { Stack, Title, Text, Select, Switch } from "@mantine/core";
import { PdfViewerSettings as IPdfViewerSettings } from "../../hooks/useSettings";
import { SettingGroup } from "./SettingGroup";

interface PdfViewerSettingsProps {
  settings: IPdfViewerSettings;
  onUpdate: <K extends keyof IPdfViewerSettings>(
    key: K,
    value: IPdfViewerSettings[K]
  ) => void;
}

export const PdfViewerSettings: React.FC<PdfViewerSettingsProps> = ({
  settings,
  onUpdate,
}) => {
  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>PDF Viewer Settings</Title>
      <Text size="sm" c="dimmed">
        Customize the PDF viewer behavior and appearance.
      </Text>

      <SettingGroup
        title="Display Settings"
        description="Control how PDFs are displayed"
      >
        <Select
          label="Default Zoom Level"
          description="How PDFs should be displayed by default"
          data={[
            { value: "fit-page", label: "Fit to Page" },
            { value: "fit-width", label: "Fit to Width" },
            { value: "actual", label: "Actual Size (100%)" },
          ]}
          value={settings.defaultZoom as string}
          onChange={(val) => val && onUpdate("defaultZoom", val as any)}
        />

        <Select
          label="Split View Mode"
          description="How the editor and PDF are arranged"
          data={[
            { value: "horizontal", label: "Horizontal (Side by Side)" },
            { value: "vertical", label: "Vertical (Top and Bottom)" },
            { value: "auto", label: "Auto (Based on Window Size)" },
          ]}
          value={settings.splitViewMode}
          onChange={(val) => val && onUpdate("splitViewMode", val as any)}
        />
      </SettingGroup>

      <SettingGroup
        title="Behavior Settings"
        description="Automatic actions and features"
      >
        <Switch
          label="Show PDF by Default"
          description="Automatically show PDF panel when opening .tex files"
          checked={settings.showByDefault}
          onChange={(e) => onUpdate("showByDefault", e.currentTarget.checked)}
        />

        <Switch
          label="Auto Refresh PDF"
          description="Automatically reload PDF after successful compilation"
          checked={settings.autoRefresh}
          onChange={(e) => onUpdate("autoRefresh", e.currentTarget.checked)}
        />
      </SettingGroup>

      <SettingGroup
        title="SyncTeX Settings"
        description="Synchronization between source and PDF"
      >
        <Switch
          label="SyncTeX Highlighting"
          description="Highlight the corresponding position in PDF during forward sync"
          checked={settings.syncTexHighlight}
          onChange={(e) =>
            onUpdate("syncTexHighlight", e.currentTarget.checked)
          }
        />

        <Switch
          label="Scroll Synchronization"
          description="Sync scrolling between editor and PDF viewer"
          checked={settings.scrollSync}
          onChange={(e) => onUpdate("scrollSync", e.currentTarget.checked)}
        />
      </SettingGroup>
    </Stack>
  );
};
