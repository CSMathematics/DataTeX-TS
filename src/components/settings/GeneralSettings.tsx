import React from "react";
import { Stack, Title, Text, Switch, Select } from "@mantine/core";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  return (
    <Stack gap="md" maw={600}>
      <Title order={4}>{t("settings.general.title")}</Title>
      <Text size="sm" c="dimmed">
        {t("settings.general.description")}
      </Text>

      <Select
        label={t("settings.general.startupBehavior.label")}
        description={t("settings.general.startupBehavior.description")}
        data={[
          {
            value: "restore",
            label: t("settings.general.startupBehavior.restore"),
          },
          {
            value: "welcome",
            label: t("settings.general.startupBehavior.welcome"),
          },
          {
            value: "empty",
            label: t("settings.general.startupBehavior.empty"),
          },
        ]}
        value={settings.startupBehavior}
        onChange={(val) => val && onUpdate("startupBehavior", val as any)}
      />

      <Switch
        label={t("settings.general.confirmOnExit.label")}
        description={t("settings.general.confirmOnExit.description")}
        checked={settings.confirmOnExit}
        onChange={(e) => onUpdate("confirmOnExit", e.currentTarget.checked)}
      />

      <Select
        label={t("settings.general.language.label")}
        description={t("settings.general.language.description")}
        data={[
          { value: "en", label: "🇬🇧 English" },
          { value: "el", label: "🇬🇷 Ελληνικά" },
          { value: "it", label: "🇮🇹 Italiano" },
          { value: "fr", label: "🇫🇷 Français" },
          { value: "de", label: "🇩🇪 Deutsch" },
          { value: "es", label: "🇪🇸 Español" },
          { value: "zh-CN", label: "🇨🇳 简体中文 (Chinese)" },
          { value: "pt", label: "🇵🇹 Português" },
          { value: "ru", label: "🇷🇺 Русский" },
          { value: "ja", label: "🇯🇵 日本語 (Japanese)" },
        ]}
        value={settings.language}
        onChange={(val) => val && onUpdate("language", val)}
      />

      <Switch
        label={t("settings.general.autoSave.label")}
        description={t("settings.general.autoSave.description")}
        checked={settings.autoSave}
        onChange={(e) => onUpdate("autoSave", e.currentTarget.checked)}
        disabled
      />
    </Stack>
  );
};
