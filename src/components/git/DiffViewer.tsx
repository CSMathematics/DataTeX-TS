import React, { useState } from "react";
import {
  Box,
  Group,
  Text,
  Badge,
  ActionIcon,
  ScrollArea,
  SegmentedControl,
  Stack,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faMinus,
  faColumns,
  faList,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { SideBySideDiff } from "./SideBySideDiff";

interface DiffLine {
  line_type: string; // "context", "add", "delete", "header"
  old_line_no: number | null;
  new_line_no: number | null;
  content: string;
}

interface DiffStats {
  additions: number;
  deletions: number;
}

export interface StructuredDiff {
  file_path: string;
  old_content: string;
  new_content: string;
  lines: DiffLine[];
  stats: DiffStats;
}

interface DiffViewerProps {
  diff: StructuredDiff;
  repoPath: string;
  onClose?: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  repoPath,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<"unified" | "split">("unified");

  const fileName = diff.file_path.split("/").pop() || diff.file_path;

  return (
    <Stack gap={0} h="100%" style={{ overflow: "hidden" }}>
      {/* Header */}
      <Group
        justify="space-between"
        px="sm"
        py="xs"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
          backgroundColor: "var(--mantine-color-dark-7)",
        }}
      >
        <Group gap="xs">
          <Text size="xs" fw={500}>
            {fileName}
          </Text>
          <Badge
            size="xs"
            color="green"
            leftSection={
              <FontAwesomeIcon icon={faPlus} style={{ fontSize: 8 }} />
            }
          >
            {diff.stats.additions}
          </Badge>
          <Badge
            size="xs"
            color="red"
            leftSection={
              <FontAwesomeIcon icon={faMinus} style={{ fontSize: 8 }} />
            }
          >
            {diff.stats.deletions}
          </Badge>
        </Group>
        <Group gap="xs">
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(v) => setViewMode(v as "unified" | "split")}
            data={[
              {
                value: "unified",
                label: (
                  <Group gap={4}>
                    <FontAwesomeIcon icon={faList} style={{ fontSize: 10 }} />
                    <span>Unified</span>
                  </Group>
                ),
              },
              {
                value: "split",
                label: (
                  <Group gap={4}>
                    <FontAwesomeIcon
                      icon={faColumns}
                      style={{ fontSize: 10 }}
                    />
                    <span>Split</span>
                  </Group>
                ),
              },
            ]}
          />
          {onClose && (
            <ActionIcon variant="subtle" size="xs" onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      {/* Diff Content */}
      <ScrollArea style={{ flex: 1 }}>
        {viewMode === "unified" ? (
          <UnifiedDiffView lines={diff.lines} />
        ) : (
          <SideBySideDiff repoPath={repoPath} filePath={diff.file_path} />
        )}
      </ScrollArea>
    </Stack>
  );
};

// Unified diff view (like git diff)
const UnifiedDiffView: React.FC<{ lines: DiffLine[] }> = ({ lines }) => {
  return (
    <Box
      style={{
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      {lines.map((line, idx) => (
        <Group
          key={idx}
          gap={0}
          wrap="nowrap"
          style={{
            backgroundColor: getLineBackground(line.line_type),
            borderLeft: `3px solid ${getLineBorderColor(line.line_type)}`,
          }}
        >
          {/* Line numbers */}
          <Text
            size="xs"
            c="dimmed"
            style={{
              width: 40,
              minWidth: 40,
              textAlign: "right",
              paddingRight: 8,
              fontFamily: "monospace",
              userSelect: "none",
            }}
          >
            {line.old_line_no || ""}
          </Text>
          <Text
            size="xs"
            c="dimmed"
            style={{
              width: 40,
              minWidth: 40,
              textAlign: "right",
              paddingRight: 8,
              fontFamily: "monospace",
              userSelect: "none",
              borderRight: "1px solid var(--mantine-color-default-border)",
            }}
          >
            {line.new_line_no || ""}
          </Text>
          {/* Content */}
          <Text
            size="xs"
            style={{
              flex: 1,
              paddingLeft: 8,
              paddingRight: 8,
              fontFamily: "monospace",
              whiteSpace: "pre",
              color: getLineColor(line.line_type),
            }}
          >
            {getLinePrefix(line.line_type)}
            {line.content}
          </Text>
        </Group>
      ))}
    </Box>
  );
};

// Helper functions
function getLineBackground(type: string): string | undefined {
  switch (type) {
    case "add":
      return "rgba(0, 255, 0, 0.08)";
    case "delete":
      return "rgba(255, 0, 0, 0.08)";
    case "header":
      return "rgba(100, 100, 255, 0.1)";
    default:
      return undefined;
  }
}

function getLineBorderColor(type: string): string {
  switch (type) {
    case "add":
      return "#51cf66";
    case "delete":
      return "#ff6b6b";
    case "header":
      return "#748ffc";
    default:
      return "transparent";
  }
}

function getLineColor(type: string): string | undefined {
  switch (type) {
    case "add":
      return "#51cf66";
    case "delete":
      return "#ff6b6b";
    case "header":
      return "#748ffc";
    default:
      return undefined;
  }
}

function getLinePrefix(type: string): string {
  switch (type) {
    case "add":
      return "+ ";
    case "delete":
      return "- ";
    default:
      return "  ";
  }
}
