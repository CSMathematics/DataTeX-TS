import React from "react";
import { useTranslation } from "react-i18next";
import { Group, Text, ActionIcon, Tooltip } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTerminal,
  faDatabase,
  faSpellCheck,
  faCalculator,
} from "@fortawesome/free-solid-svg-icons";

interface StatusBarProps {
  language?: string;
  dbConnected?: boolean;
  cursorPosition?: { lineNumber: number; column: number };
  spellCheckEnabled?: boolean;
  onToggleSpellCheck?: () => void;
  onWordCount?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = React.memo(
  ({
    language,
    dbConnected = true,
    cursorPosition = { lineNumber: 1, column: 1 },
    spellCheckEnabled = false,
    onToggleSpellCheck,
    onWordCount,
  }) => {
    const { t } = useTranslation();
    return (
      <Group
        h={24}
        px="xs"
        justify="space-between"
        style={{
          fontSize: "12px",
          userSelect: "none",
          backgroundColor: "var(--app-status-bar-bg)",
          color: "white",
        }}
      >
        <Group gap="lg">
          <Group gap={4}>
            <FontAwesomeIcon
              icon={faTerminal}
              style={{ width: 12, height: 12 }}
            />
            <Text size="xs" inherit>
              {t("statusBar.ready")}
            </Text>
          </Group>
        </Group>

        <Group gap="lg">
          {onWordCount && language === "latex" && (
            <Tooltip label={t("statusBar.wordCount")}>
              <ActionIcon
                size="xs"
                variant="transparent"
                onClick={onWordCount}
                color="white"
              >
                <FontAwesomeIcon
                  icon={faCalculator}
                  style={{ width: 12, height: 12 }}
                />
              </ActionIcon>
            </Tooltip>
          )}

          {onToggleSpellCheck && (
            <Tooltip
              label={`${t("statusBar.spellCheck")}: ${
                spellCheckEnabled ? "On" : "Off"
              }`}
            >
              <ActionIcon
                size="xs"
                variant="transparent"
                onClick={onToggleSpellCheck}
                style={{
                  color: spellCheckEnabled
                    ? "var(--mantine-color-green-4)"
                    : "var(--mantine-color-gray-5)",
                }}
              >
                <FontAwesomeIcon
                  icon={faSpellCheck}
                  style={{ width: 14, height: 14 }}
                />
              </ActionIcon>
            </Tooltip>
          )}

          <Text size="xs" inherit>
            {t("statusBar.ln")} {cursorPosition.lineNumber},{" "}
            {t("statusBar.col")} {cursorPosition.column}
          </Text>

          <Text size="xs" inherit>
            {language === "latex"
              ? "LaTeX"
              : language || t("statusBar.plainText")}
          </Text>
          <Text size="xs" inherit>
            UTF-8
          </Text>
          <Group gap={4}>
            <FontAwesomeIcon
              icon={faDatabase}
              style={{
                width: 10,
                height: 10,
                color: dbConnected ? "white" : "#ff3e3eff",
              }}
            />
            <Text size="xs" inherit>
              {t("statusBar.dbPrefix")}{" "}
              {dbConnected
                ? t("statusBar.connected")
                : t("statusBar.disconnected")}
            </Text>
          </Group>
        </Group>
      </Group>
    );
  }
);
