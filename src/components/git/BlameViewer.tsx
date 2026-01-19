import React, { useEffect, useState } from "react";
import { Box, Group, Text, ScrollArea, Tooltip, Loader } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";

export interface BlameInfo {
  line_number: number;
  commit_id: string;
  short_id: string;
  author: string;
  timestamp: number;
  line_content: string;
}

interface BlameViewerProps {
  repoPath: string;
  filePath: string;
}

export const BlameViewer: React.FC<BlameViewerProps> = ({
  repoPath,
  filePath,
}) => {
  const [blameData, setBlameData] = useState<BlameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBlame = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await invoke<BlameInfo[]>("git_blame_cmd", {
          repoPath,
          filePath,
        });
        setBlameData(data);
      } catch (err) {
        console.error("Failed to load blame:", err);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    if (repoPath && filePath) {
      loadBlame();
    }
  }, [repoPath, filePath]);

  if (loading) {
    return (
      <Box p="xl" style={{ display: "flex", justifyContent: "center" }}>
        <Loader size="sm" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="md">
        <Text c="red">Error loading blame: {error}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          backgroundColor: "var(--mantine-color-default-hover)",
          padding: "4px 8px",
        }}
      >
        <Text fw={500} size="xs">
          COMMIT INFO
        </Text>
        <Text fw={500} size="xs">
          CONTENT
        </Text>
      </Box>

      <ScrollArea.Autosize mah="70vh" type="auto">
        <Box style={{ fontFamily: "monospace", fontSize: "12px" }}>
          {blameData.map((line, idx) => {
            // Check if previous line commit is same to group visually
            const isSameCommit =
              idx > 0 && blameData[idx - 1].commit_id === line.commit_id;

            return (
              <Box
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr",
                  borderTop: !isSameCommit
                    ? "1px solid var(--mantine-color-default-border)"
                    : undefined,
                  backgroundColor: !isSameCommit
                    ? "var(--mantine-color-body)"
                    : undefined,
                }}
              >
                {/* Commit Info Column */}
                <Box
                  p={2}
                  style={{
                    borderRight:
                      "1px solid var(--mantine-color-default-border)",
                    opacity: isSameCommit ? 0.3 : 1,
                  }}
                >
                  {!isSameCommit && (
                    <Tooltip
                      label={`${line.author} - ${new Date(line.timestamp * 1000).toLocaleString()} \n ${line.commit_id}`}
                    >
                      <Group gap={4} wrap="nowrap">
                        <Text size="xs" c="blue" fw={500} style={{ width: 50 }}>
                          {line.short_id}
                        </Text>
                        <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                          {line.author}
                        </Text>
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{ width: 60, textAlign: "right" }}
                        >
                          {new Date(line.timestamp * 1000).toLocaleDateString()}
                        </Text>
                      </Group>
                    </Tooltip>
                  )}
                </Box>

                {/* Content Column */}
                <Group gap="xs" p={2} wrap="nowrap">
                  <Text
                    c="dimmed"
                    size="xs"
                    w={30}
                    ta="right"
                    style={{ userSelect: "none" }}
                  >
                    {line.line_number}
                  </Text>
                  <Text
                    style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                  >
                    {line.line_content}
                  </Text>
                </Group>
              </Box>
            );
          })}
        </Box>
      </ScrollArea.Autosize>
    </Box>
  );
};
