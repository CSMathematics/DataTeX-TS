import {
  TextInput,
  Select,
  Checkbox,
  Stack,
  Title,
  Group,
  Text,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
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

  const { t } = useTranslation();

  const handleChange = (key: keyof ITexEngineSettings, value: any) => {
    onUpdate(key, value);
  };

  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>{t("settings.tex.title")}</Title>
      <Text size="sm" c="dimmed">
        {t("settings.tex.description")}
      </Text>

      <Select
        label={t("settings.tex.defaultEngine.label")}
        description={t("settings.tex.defaultEngine.description")}
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
          label={t("settings.tex.pdflatexPath.label")}
          placeholder="pdflatex"
          value={settings.pdflatexPath}
          onChange={(e) => handleChange("pdflatexPath", e.currentTarget.value)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label={t("settings.tex.xelatexPath.label")}
          placeholder="xelatex"
          value={settings.xelatexPath}
          onChange={(e) => handleChange("xelatexPath", e.currentTarget.value)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label={t("settings.tex.lualatexPath.label")}
          placeholder="lualatex"
          value={settings.lualatexPath}
          onChange={(e) => handleChange("lualatexPath", e.currentTarget.value)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label={t("settings.tex.dvisvgmPath.label")}
          description={t("settings.tex.dvisvgmPath.description")}
          placeholder="dvisvgm"
          value={settings.dvisvgmPath}
          onChange={(e) => handleChange("dvisvgmPath", e.currentTarget.value)}
        />
      </Group>

      <TextInput
        label={t("settings.tex.outputDirectory.label")}
        description={t("settings.tex.outputDirectory.description")}
        value={settings.outputDirectory}
        onChange={(e) => handleChange("outputDirectory", e.currentTarget.value)}
      />

      <Checkbox
        label={t("settings.tex.shellEscape.label")}
        description={t("settings.tex.shellEscape.description")}
        checked={settings.shellEscape}
        onChange={(e) => handleChange("shellEscape", e.currentTarget.checked)}
      />

      <Checkbox
        label={t("settings.tex.synctex.label")}
        description={t("settings.tex.synctex.description")}
        checked={settings.synctex}
        onChange={(e) => handleChange("synctex", e.currentTarget.checked)}
      />

      <Checkbox
        label={t("settings.tex.bibtex.label")}
        description={t("settings.tex.bibtex.description")}
        checked={settings.bibtex}
        onChange={(e) => handleChange("bibtex", e.currentTarget.checked)}
      />
    </Stack>
  );
};
