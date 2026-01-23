import React from "react";
import { Box, Button, Group, Text, Paper } from "@mantine/core";
import { DiffEditor } from "@monaco-editor/react";
import { useAIStore } from "../../stores/aiStore";
import { useTabsStore } from "../../stores/useTabsStore";
import { writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { notifications } from "@mantine/notifications";

interface AIReviewTabProps {
  original: string;
  modified: string;
  path: string;
  tabId: string;
}

export const AIReviewTab: React.FC<AIReviewTabProps> = ({
  original,
  modified,
  path,
  tabId,
}) => {
  const { setPendingWrite, addMessage } = useAIStore();
  const { closeTab } = useTabsStore();

  const handleAccept = async () => {
    try {
      // Ensure parent directory exists (for new file creation)
      const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
      if (lastSlash > 0) {
        const parentDir = path.substring(0, lastSlash);
        await mkdir(parentDir, { recursive: true });
      }
      // Write to disk
      await writeTextFile(path, modified);

      // 2. Update store state so Editor reflects changes immediately (Editor remounts)
      useTabsStore.getState().updateTabContent(path, modified);
      useTabsStore.getState().markDirty(path, false);

      notifications.show({
        title: "Success",
        message: `File updated: ${path}`,
        color: "green",
      });
      addMessage({
        role: "system",
        content: `User Approved: Successfully wrote to ${path}`,
      });
      setPendingWrite(null);
      closeTab(tabId);
    } catch (e: any) {
      notifications.show({
        title: "Error",
        message: `Failed to write file: ${e.message}`,
        color: "red",
      });
    }
  };

  const handleReject = () => {
    addMessage({
      role: "system",
      content: `User Rejected: The write operation for ${path} was cancelled.`,
    });
    setPendingWrite(null);
    closeTab(tabId);
  };

  return (
    <Box h="100%" display="flex" style={{ flexDirection: "column" }}>
      {/* Header with Actions */}
      <Paper
        p="md"
        radius={0}
        bg="var(--mantine-color-body)"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <Group justify="space-between">
          <Box>
            <Text fw={700} size="sm">
              Review AI Suggested Changes
            </Text>
            <Text size="xs" c="dimmed">
              {path}
            </Text>
          </Box>
          <Group>
            <Button color="red" variant="subtle" onClick={handleReject}>
              Reject
            </Button>
            <Button color="green" onClick={handleAccept}>
              Accept Changes
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Diff Editor */}
      <Box style={{ flex: 1, position: "relative" }}>
        <DiffEditor
          height="100%"
          original={original}
          modified={modified}
          language="latex"
          theme="vs-dark" // or dynamic based on settings
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
          }}
        />
      </Box>
    </Box>
  );
};
