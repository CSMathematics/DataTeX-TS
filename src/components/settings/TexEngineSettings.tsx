import {
  TextInput,
  Select,
  Checkbox,
  Stack,
  Title,
  Group,
  Text,
} from "@mantine/core";
import { TexEngineSettings as ITexEngineSettings } from "../../hooks/useSettings";

interface TexEngineSettingsProps {
  settings: ITexEngineSettings;
  onUpdate: <K extends keyof ITexEngineSettings>(
    key: K,
    value: ITexEngineSettings[K]
  ) => void;
}

export const TexEngineSettings: React.FC<TexEngineSettingsProps> = ({
  settings,
  onUpdate,
}) => {
  // Legacy support: We rely on the parent (App -> SettingsPanel) to provide state from the global store.
  // Local storage persistence is now handled by the store.

  const handleChange = (key: keyof ITexEngineSettings, value: any) => {
    onUpdate(key, value);
  };

  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>TeX Engine Configuration</Title>
      <Text size="sm" c="dimmed">
        Configure how your LaTeX documents are compiled.
      </Text>

      <Select
        label="Default Engine"
        description="The engine used when no specific magic comment is found."
        data={[
          { value: "pdflatex", label: "pdfLaTeX" },
          { value: "xelatex", label: "XeLaTeX" },
          { value: "lualatex", label: "LuaLaTeX" },
        ]}
        value={settings.defaultEngine}
        onChange={(val) => handleChange("defaultEngine", val)}
      />

      <Group grow align="flex-start">
        <TextInput
          label="pdfLaTeX Path"
          placeholder="pdflatex"
          value={settings.pdflatexPath}
          onChange={(e) => handleChange("pdflatexPath", e.currentTarget.value)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label="XeLaTeX Path"
          placeholder="xelatex"
          value={settings.xelatexPath}
          onChange={(e) => handleChange("xelatexPath", e.currentTarget.value)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label="LuaLaTeX Path"
          placeholder="lualatex"
          value={settings.lualatexPath}
          onChange={(e) => handleChange("lualatexPath", e.currentTarget.value)}
        />
      </Group>

      <TextInput
        label="Output Directory"
        description="Directory for auxiliary files (relative to document)."
        value={settings.outputDirectory}
        onChange={(e) => handleChange("outputDirectory", e.currentTarget.value)}
      />

      <Checkbox
        label="Enable Shell Escape (--shell-escape)"
        description="Allows execution of external commands (e.g., for minted)."
        checked={settings.shellEscape}
        onChange={(e) => handleChange("shellEscape", e.currentTarget.checked)}
      />

      <Checkbox
        label="Enable SyncTeX"
        description="Required for forward/inverse search."
        checked={settings.synctex}
        onChange={(e) => handleChange("synctex", e.currentTarget.checked)}
      />

      <Checkbox
        label="Run BibTeX/Biber"
        description="Automatically run bibliography processor."
        checked={settings.bibtex}
        onChange={(e) => handleChange("bibtex", e.currentTarget.checked)}
      />
    </Stack>
  );
};
