import React, { useState } from "react";
import {
  Box,
  Button,
  Group,
  Text,
  Paper,
  SegmentedControl,
} from "@mantine/core";
import { DiffEditor } from "@monaco-editor/react";
import { useAIStore } from "../../stores/aiStore";
import { useTabsStore } from "../../stores/useTabsStore";
import { writeTextFile, mkdir } from "@tauri-apps/plugin-fs";
import { notifications } from "@mantine/notifications";
import { configureLatexMonaco } from "../../services/latexMonaco";
import { useSettingsStore } from "../../stores/settingsStore";

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
  const editorTheme = useSettingsStore((state) => state.settings.editor.theme);
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");

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

      // 2. Open or Update the file tab
      const tabsStore = useTabsStore.getState();
      const filename = path.split(/[/\\]/).pop() || "Untitled";

      if (tabsStore.hasTab(path)) {
        tabsStore.updateTabContent(path, modified);
        tabsStore.markDirty(path, false);
        tabsStore.setActiveTab(path);
      } else {
        tabsStore.openTab({
          id: path,
          title: filename,
          type: "editor",
          content: modified,
          isDirty: false,
        });
      }

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
            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(v) => setViewMode(v as "split" | "unified")}
              data={[
                { label: "Split", value: "split" },
                { label: "Unified", value: "unified" },
              ]}
            />
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
          language="my-latex"
          beforeMount={configureLatexMonaco}
          theme={editorTheme}
          options={{
            readOnly: true,
            renderSideBySide: viewMode === "split",
            minimap: { enabled: false },
          }}
        />
      </Box>
    </Box>
  );
};
