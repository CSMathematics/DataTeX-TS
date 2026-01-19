import React, { useEffect, useState } from "react";
import { Box, Group, Text, ScrollArea } from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";

export interface SideBySideLine {
  left_line_num: number | null;
  right_line_num: number | null;
  left_content: string;
  right_content: string;
  change_type: "unchanged" | "added" | "removed" | "modified";
}

interface SideBySideDiffProps {
  repoPath: string;
  filePath: string;
}

export const SideBySideDiff: React.FC<SideBySideDiffProps> = ({
  repoPath,
  filePath,
}) => {
  const [lines, setLines] = useState<SideBySideLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDiff = async () => {
      try {
        const diff = await invoke<SideBySideLine[]>(
          "git_get_side_by_side_diff_cmd",
          {
            repoPath,
            filePath,
          },
        );
        setLines(diff);
      } catch (err) {
        console.error("Failed to load side-by-side diff:", err);
        setError(String(err));
      }
    };

    if (repoPath && filePath) {
      loadDiff();
    }
  }, [repoPath, filePath]);

  if (error) {
    return (
      <Box p="md">
        <Text c="red">Error loading diff: {error}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          backgroundColor: "var(--mantine-color-default-hover)",
          padding: "4px 8px",
        }}
      >
        <Text fw={500} size="xs">
          BASE / HEAD
        </Text>
        <Text fw={500} size="xs">
          WORKING TREE
        </Text>
      </Box>

      <ScrollArea.Autosize mah="70vh" type="auto">
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          {lines.map((line, idx) => (
            <React.Fragment key={idx}>
              {/* Left Side (Old) */}
              <Group
                gap="xs"
                p={2}
                style={{
                  backgroundColor:
                    line.change_type === "removed"
                      ? "rgba(255, 0, 0, 0.1)"
                      : undefined,
                  borderRight: "1px solid var(--mantine-color-default-border)",
                  minHeight: "20px",
                }}
              >
                <Text
                  c="dimmed"
                  size="xs"
                  w={30}
                  ta="right"
                  style={{ userSelect: "none" }}
                >
                  {line.left_line_num || ""}
                </Text>
                <Text
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                  c={line.change_type === "removed" ? "red" : undefined}
                >
                  {line.left_content}
                </Text>
              </Group>

              {/* Right Side (New) */}
              <Group
                gap="xs"
                p={2}
                style={{
                  backgroundColor:
                    line.change_type === "added"
                      ? "rgba(0, 255, 0, 0.1)"
                      : undefined,
                  minHeight: "20px",
                }}
              >
                <Text
                  c="dimmed"
                  size="xs"
                  w={30}
                  ta="right"
                  style={{ userSelect: "none" }}
                >
                  {line.right_line_num || ""}
                </Text>
                <Text
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                  c={line.change_type === "added" ? "green" : undefined}
                >
                  {line.right_content}
                </Text>
              </Group>
            </React.Fragment>
          ))}
        </Box>
      </ScrollArea.Autosize>
    </Box>
  );
};
