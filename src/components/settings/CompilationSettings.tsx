import React from "react";
import {
  Stack,
  Title,
  Text,
  Select,
  NumberInput,
  Switch,
  TextInput,
} from "@mantine/core";
import { CompilationSettings as ICompilationSettings } from "../../hooks/useSettings";
import { SettingGroup } from "./SettingGroup";

interface CompilationSettingsProps {
  settings: ICompilationSettings;
  onUpdate: <K extends keyof ICompilationSettings>(
    key: K,
    value: ICompilationSettings[K]
  ) => void;
}

export const CompilationSettings: React.FC<CompilationSettingsProps> = ({
  settings,
  onUpdate,
}) => {
  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>Compilation Settings</Title>
      <Text size="sm" c="dimmed">
        Advanced compilation behavior and output management.
      </Text>

      <SettingGroup
        title="Build Behavior"
        description="When and how files are compiled"
      >
        <Switch
          label="Compile on Save"
          description="Automatically compile documents when saving"
          checked={settings.compileOnSave}
          onChange={(e) => onUpdate("compileOnSave", e.currentTarget.checked)}
        />

        <NumberInput
          label="Compilation Timeout"
          description="Maximum time in seconds for compilation (30-300)"
          value={settings.timeout}
          onChange={(val) => onUpdate("timeout", Number(val))}
          min={30}
          max={300}
          suffix=" sec"
        />
      </SettingGroup>

      <SettingGroup
        title="Output Directory"
        description="Where compilation artifacts are stored"
      >
        <Select
          label="Build Directory"
          description="Location for auxiliary and output files"
          data={[
            { value: "source", label: "Same as Source File" },
            { value: "build", label: "./build" },
            { value: "output", label: "./output" },
            { value: "custom", label: "Custom Path" },
          ]}
          value={settings.buildDirectory}
          onChange={(val) => val && onUpdate("buildDirectory", val as any)}
        />

        {settings.buildDirectory === "custom" && (
          <TextInput
            label="Custom Build Path"
            description="Relative or absolute path for build output"
            value={settings.customBuildPath}
            onChange={(e) => onUpdate("customBuildPath", e.currentTarget.value)}
            placeholder="./custom-build"
          />
        )}

        <Switch
          label="Clean Auxiliary Files"
          description="Remove .aux, .log, .toc files after successful compilation"
          checked={settings.cleanAuxFiles}
          onChange={(e) => onUpdate("cleanAuxFiles", e.currentTarget.checked)}
        />
      </SettingGroup>

      <SettingGroup
        title="Error Handling"
        description="How compilation errors are displayed"
      >
        <Switch
          label="Show Log Panel on Error"
          description="Automatically open the log panel when errors occur"
          checked={settings.showLogOnError}
          onChange={(e) => onUpdate("showLogOnError", e.currentTarget.checked)}
        />

        <NumberInput
          label="Maximum Errors to Display"
          description="Limit the number of errors shown (10-100)"
          value={settings.maxErrors}
          onChange={(val) => onUpdate("maxErrors", Number(val))}
          min={10}
          max={100}
        />
      </SettingGroup>
    </Stack>
  );
};
