import React from "react";
import { Stack, Title, Text, Table, Badge } from "@mantine/core";

export const KeyboardShortcutsSettings: React.FC = () => {
  const shortcuts = [
    {
      category: "General",
      items: [
        { keys: ["Ctrl", "S"], description: "Save current file" },
        { keys: ["Ctrl", "Shift", "S"], description: "Save all files" },
        { keys: ["Ctrl", "W"], description: "Close current tab" },
        { keys: ["Ctrl", "Shift", "W"], description: "Close all tabs" },
        { keys: ["Ctrl", "P"], description: "Quick file search" },
        { keys: ["Ctrl", ","], description: "Open Settings" },
      ],
    },
    {
      category: "Editor",
      items: [
        { keys: ["Ctrl", "F"], description: "Find in file" },
        { keys: ["Ctrl", "H"], description: "Find and replace" },
        { keys: ["Ctrl", "D"], description: "Select next occurrence" },
        { keys: ["Ctrl", "/"], description: "Toggle line comment" },
        { keys: ["Ctrl", "Z"], description: "Undo" },
        { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
        { keys: ["Alt", "↑/↓"], description: "Move line up/down" },
        { keys: ["Ctrl", "L"], description: "Select entire line" },
      ],
    },
    {
      category: "Compilation",
      items: [
        { keys: ["F5"], description: "Compile current document" },
        {
          keys: ["Ctrl", "Shift", "B"],
          description: "Build with selected engine",
        },
        { keys: ["F7"], description: "View compilation log" },
      ],
    },
    {
      category: "Navigation",
      items: [
        { keys: ["Ctrl", "Tab"], description: "Next tab" },
        { keys: ["Ctrl", "Shift", "Tab"], description: "Previous tab" },
        { keys: ["Ctrl", "B"], description: "Toggle sidebar" },
        { keys: ["Ctrl", "Shift", "E"], description: "Focus on database view" },
      ],
    },
  ];

  const renderKey = (key: string) => (
    <Badge
      key={key}
      size="sm"
      variant="filled"
      style={{
        fontFamily: "monospace",
        fontSize: "11px",
        padding: "4px 8px",
        margin: "0 2px",
        backgroundColor: "var(--mantine-color-dark-5)",
        color: "var(--mantine-color-gray-1)",
      }}
    >
      {key}
    </Badge>
  );

  return (
    <Stack gap="md" maw={800}>
      <Title order={4}>Keyboard Shortcuts</Title>
      <Text size="sm" c="dimmed">
        Quick reference for keyboard shortcuts. Custom shortcuts configuration
        coming soon.
      </Text>

      {shortcuts.map((section) => (
        <div key={section.category}>
          <Text size="sm" fw={600} mb="xs" mt="md">
            {section.category}
          </Text>
          <Table striped highlightOnHover>
            <Table.Tbody>
              {section.items.map((shortcut, idx) => (
                <Table.Tr key={idx}>
                  <Table.Td width="35%">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {shortcut.keys.map((key) => renderKey(key))}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{shortcut.description}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      ))}

      <Text size="xs" c="dimmed" mt="lg">
        💡 Tip: Most shortcuts follow standard editor conventions. Custom
        shortcut mapping will be available in a future update.
      </Text>
    </Stack>
  );
};
