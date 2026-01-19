import React, { useState } from "react";
import { Box, SegmentedControl, Text, Group, Stack } from "@mantine/core";
import { DiffViewer, StructuredDiff } from "./DiffViewer";
import { BlameViewer } from "./BlameViewer";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExchangeAlt, faHistory } from "@fortawesome/free-solid-svg-icons";

export interface GitViewData {
  repoPath: string;
  filePath: string;
  initialView: "diff" | "blame";
}

interface GitFileViewerProps {
  data: GitViewData;
}

export const GitFileViewer: React.FC<GitFileViewerProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<"diff" | "blame">(data.initialView);
  const [diffData, setDiffData] = useState<StructuredDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Load diff data if in diff mode and not loaded
  React.useEffect(() => {
    if (viewMode === "diff" && !diffData && !loadingDiff) {
      const loadDiff = async () => {
        setLoadingDiff(true);
        try {
          const diff = await invoke<StructuredDiff>(
            "git_get_structured_diff_cmd",
            {
              repoPath: data.repoPath,
              filePath: data.filePath,
            },
          );
          setDiffData(diff);
        } catch (e) {
          console.error("Failed to load diff:", e);
        } finally {
          setLoadingDiff(false);
        }
      };
      loadDiff();
    }
  }, [viewMode, data.repoPath, data.filePath, diffData, loadingDiff]);

  return (
    <Stack gap={0} h="100%" w="100%">
      {/* Header / Toolbar */}
      <Box
        p="xs"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
          backgroundColor: "var(--mantine-color-body)",
        }}
      >
        <Group justify="space-between">
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {data.filePath.split("/").pop()}
            </Text>
            <Text size="xs" c="dimmed">
              {data.repoPath}
            </Text>
          </Group>

          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(v) => setViewMode(v as "diff" | "blame")}
            data={[
              {
                value: "diff",
                label: (
                  <Group gap={4}>
                    <FontAwesomeIcon
                      icon={faExchangeAlt}
                      style={{ fontSize: 10 }}
                    />
                    <span>Diff</span>
                  </Group>
                ),
              },
              {
                value: "blame",
                label: (
                  <Group gap={4}>
                    <FontAwesomeIcon
                      icon={faHistory}
                      style={{ fontSize: 10 }}
                    />
                    <span>Blame</span>
                  </Group>
                ),
              },
            ]}
          />
        </Group>
      </Box>

      {/* Content */}
      <Box style={{ flex: 1, overflow: "hidden" }}>
        {viewMode === "diff" ? (
          diffData ? (
            <DiffViewer diff={diffData} repoPath={data.repoPath} />
          ) : (
            <Box p="md">
              <Text>Loading diff...</Text>
            </Box>
          )
        ) : (
          <BlameViewer repoPath={data.repoPath} filePath={data.filePath} />
        )}
      </Box>
    </Stack>
  );
};
