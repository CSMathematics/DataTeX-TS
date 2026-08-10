import React from "react";
import { useTranslation } from "react-i18next";
import { Group, Text, ActionIcon, Tooltip } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTerminal,
  faDatabase,
  faSpellCheck,
  faCalculator,
  faStopwatch,
} from "@fortawesome/free-solid-svg-icons";
import { useCursorStore } from "../../stores/cursorStore";
import { useStoicheiaHostStatus } from "../../stores/stoicheiaHostStatus";
import {
  copyStoicheiaRuntimePerformanceReport,
  getMissingStoicheiaRuntimePerformanceMetrics,
  isStoicheiaRuntimeCaptureEnabled,
} from "../../utils/stoicheiaRuntimePerformance";

interface StatusBarProps {
  language?: string;
  dbConnected?: boolean;
  spellCheckEnabled?: boolean;
  onToggleSpellCheck?: () => void;
  onWordCount?: () => void;
  stoicheiaActive?: boolean;
}

const humanizeTool = (tool: string) => {
  if (tool === "cursor") return "Select";
  if (tool === "pan") return "Pan";
  if (tool === "add_point_polar") return "Polar Point";
  return tool
    .replace(/^add_/, "")
    .replace(/^get_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const formatMs = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value < 10 ? `${value.toFixed(1)}ms` : `${Math.round(value)}ms`;
};

export const StatusBar: React.FC<StatusBarProps> = React.memo(
  ({
    language,
    dbConnected = true,
    spellCheckEnabled = false,
    onToggleSpellCheck,
    onWordCount,
    stoicheiaActive = false,
  }) => {
    const { t } = useTranslation();
    // Subscribe to cursor store - select primitives to avoid infinite loop
    const lineNumber = useCursorStore((state) => state.lineNumber);
    const column = useCursorStore((state) => state.column);
    const stoicheiaStatus = useStoicheiaHostStatus();
    const runtimeCaptureEnabled = isStoicheiaRuntimeCaptureEnabled();
    const [runtimeCaptureMessage, setRuntimeCaptureMessage] = React.useState(
      "Finish and copy performance report",
    );
    const metrics = stoicheiaStatus.performanceMetrics;
    const performanceTitle = metrics
      ? [
          `Parse round-trip: ${formatMs(metrics.parseRoundTripMs)}`,
          `Rust parse: ${formatMs(metrics.parseMs)}`,
          `Rust geometry: ${formatMs(metrics.geometryMs)}`,
          `Rust viewport: ${formatMs(metrics.viewportMs)}`,
          `TS viewport: ${formatMs(metrics.viewportBuildMs)}`,
          `Renderer: ${formatMs(metrics.rendererMs)}`,
          `Compile round-trip: ${formatMs(metrics.compileRoundTripMs)}`,
        ].join("\n")
      : undefined;
    const stoicheiaState = stoicheiaStatus.hasCompileError
      ? "Compile error"
      : stoicheiaStatus.isCompiling
        ? "Compiling"
        : t("statusBar.ready");
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
              {stoicheiaActive
                ? `Stoicheia · ${stoicheiaState}`
                : t("statusBar.ready")}
            </Text>
          </Group>
        </Group>

        <Group gap="lg">
          {stoicheiaActive ? (
            <>
              <Text size="xs" inherit title="Active Stoicheia tool">
                {humanizeTool(stoicheiaStatus.activeTool)}
              </Text>
              <Text size="xs" inherit>
                {stoicheiaStatus.parsedNodeCount} objects
              </Text>
              <Text size="xs" inherit>
                {Math.round(stoicheiaStatus.zoomLevel * 100)}%
              </Text>
              <Text size="xs" inherit>
                {stoicheiaStatus.previewMode === "latex"
                  ? "LaTeX preview"
                  : "Instant preview"}
              </Text>
              {metrics && (
                <Text size="xs" inherit title={performanceTitle}>
                  P {formatMs(metrics.parseRoundTripMs)} · G{" "}
                  {formatMs(metrics.geometryMs)} · R{" "}
                  {formatMs(metrics.rendererMs)}
                </Text>
              )}
              <Text
                size="xs"
                inherit
                style={{ opacity: stoicheiaStatus.snapToGrid ? 1 : 0.7 }}
              >
                Snap {stoicheiaStatus.snapToGrid ? "on" : "off"}
              </Text>
              <Text size="xs" inherit style={{ opacity: 0.75 }}>
                tkz-euclide
              </Text>
              {runtimeCaptureEnabled && (
                <Tooltip
                  label={
                    runtimeCaptureMessage
                  }
                >
                  <ActionIcon
                    size="xs"
                    variant="transparent"
                    color="white"
                    aria-label="Finish and copy Stoicheia performance report"
                    onClick={() => {
                      const missing =
                        getMissingStoicheiaRuntimePerformanceMetrics();
                      if (missing.length > 0) {
                        setRuntimeCaptureMessage(
                          `Missing: ${missing.join(", ")}`,
                        );
                        return;
                      }
                      void copyStoicheiaRuntimePerformanceReport()
                        .then((copied) => setRuntimeCaptureMessage(
                          copied
                            ? "Performance report copied"
                            : "Could not copy performance report",
                        ))
                        .catch(() => setRuntimeCaptureMessage(
                          "Could not copy performance report",
                        ));
                    }}
                  >
                    <FontAwesomeIcon
                      icon={faStopwatch}
                      style={{ width: 12, height: 12 }}
                    />
                  </ActionIcon>
                </Tooltip>
              )}
            </>
          ) : (
            <>
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
                {t("statusBar.ln")} {lineNumber}, {t("statusBar.col")}{" "}
                {column}
              </Text>

              <Text size="xs" inherit>
                {language === "latex"
                  ? "LaTeX"
                  : language || t("statusBar.plainText")}
              </Text>
              <Text size="xs" inherit>
                UTF-8
              </Text>
            </>
          )}
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
  },
);
