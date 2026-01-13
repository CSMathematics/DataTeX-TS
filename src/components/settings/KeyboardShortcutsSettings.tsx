import React, { useState, useEffect } from "react";
import {
  Stack,
  Title,
  Text,
  Table,
  Badge,
  Button,
  Modal,
  Group,
  ActionIcon,
  Kbd,
  Box,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateLeft, faEdit } from "@fortawesome/free-solid-svg-icons";
import { useSettings } from "../../hooks/useSettings";
import { getShortcutFromEvent } from "../../utils/ShortcutUtils";

interface ShortcutDef {
  id: string;
  description: string;
  category: string;
  defaultKeys: string;
}

const SHORTCUT_DEFINITIONS: ShortcutDef[] = [
  // General
  {
    id: "file.save",
    category: "General",
    description: "Save current file",
    defaultKeys: "Ctrl+S",
  },
  {
    id: "file.saveAll",
    category: "General",
    description: "Save all files",
    defaultKeys: "Ctrl+Shift+S",
  },
  {
    id: "file.closeTab",
    category: "General",
    description: "Close current tab",
    defaultKeys: "Ctrl+W",
  },
  {
    id: "file.newTemplate",
    category: "General",
    description: "New file from template",
    defaultKeys: "Ctrl+Shift+N",
  },
  {
    id: "view.openSettings",
    category: "General",
    description: "Open Settings",
    defaultKeys: "Ctrl+,",
  },

  // Editor
  {
    id: "editor.find",
    category: "Editor",
    description: "Find in file",
    defaultKeys: "Ctrl+F",
  },
  {
    id: "editor.replace",
    category: "Editor",
    description: "Find and replace",
    defaultKeys: "Ctrl+H",
  },

  // Compilation
  {
    id: "compilation.build",
    category: "Compilation",
    description: "Compile current document",
    defaultKeys: "F5",
  },

  // Navigation
  {
    id: "view.toggleSidebar",
    category: "Navigation",
    description: "Toggle sidebar",
    defaultKeys: "Ctrl+B",
  },
  {
    id: "tools.packageBrowser",
    category: "Navigation",
    description: "Open Package Browser",
    defaultKeys: "Ctrl+Shift+P",
  },
];

export const KeyboardShortcutsSettings: React.FC = () => {
  const { settings, updateShortcut, resetShortcuts } = useSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string | null>(null);

  // Group definitions by category
  const groupedShortcuts = SHORTCUT_DEFINITIONS.reduce((acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  }, {} as Record<string, ShortcutDef[]>);

  // Handle key recording
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editingId) return;
      e.preventDefault();
      e.stopPropagation();

      // Ignore single modifier presses
      if (["Control", "Shift", "Alt", "Meta", "CapsLock"].includes(e.key)) {
        return;
      }

      const shortcut = getShortcutFromEvent(e);
      setRecordedKeys(shortcut);
    };

    if (editingId) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editingId]);

  const handleSaveShortcut = () => {
    if (editingId && recordedKeys) {
      updateShortcut(editingId, recordedKeys);
      setEditingId(null);
      setRecordedKeys(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setRecordedKeys(null);
  };

  const handleResetOne = (id: string, defaultKeys: string) => {
    updateShortcut(id, defaultKeys);
  };

  const renderKey = (keyString: string) => {
    if (!keyString) return null;
    return keyString.split("+").map((k, i) => (
      <Kbd key={i} size="xs" mr={4}>
        {k}
      </Kbd>
    ));
  };

  const activeDefinition = SHORTCUT_DEFINITIONS.find((d) => d.id === editingId);

  return (
    <Stack gap="md" maw={800}>
      <Group justify="space-between">
        <div>
          <Title order={4}>Keyboard Shortcuts</Title>
          <Text size="sm" c="dimmed">
            Customize keyboard shortcuts for frequent actions.
          </Text>
        </div>
        <Button
          variant="subtle"
          color="red"
          size="xs"
          leftSection={<FontAwesomeIcon icon={faRotateLeft} />}
          onClick={resetShortcuts}
        >
          Reset All to Defaults
        </Button>
      </Group>

      {Object.entries(groupedShortcuts).map(([category, items]) => (
        <div key={category}>
          <Text size="sm" fw={600} mb="xs" mt="md" tt="uppercase" c="dimmed">
            {category}
          </Text>
          <Table striped highlightOnHover withTableBorder>
            <Table.Tbody>
              {items.map((def) => {
                const currentKeys =
                  settings.shortcuts?.[def.id] || def.defaultKeys;
                const isCustom = currentKeys !== def.defaultKeys;

                return (
                  <Table.Tr key={def.id}>
                    <Table.Td width="40%">
                      <Text size="sm">{def.description}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {renderKey(currentKeys)}
                        {isCustom && (
                          <Badge size="xs" variant="dot" color="yellow">
                            Modified
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td width={80}>
                      <Group gap={4} justify="flex-end">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          onClick={() => setEditingId(def.id)}
                          title="Edit Shortcut"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </ActionIcon>
                        {isCustom && (
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            color="red"
                            onClick={() =>
                              handleResetOne(def.id, def.defaultKeys)
                            }
                            title="Reset to Default"
                          >
                            <FontAwesomeIcon icon={faRotateLeft} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
      ))}

      {/* Editing Modal */}
      <Modal
        opened={!!editingId}
        onClose={handleCancelEdit}
        title="Edit Shortcut"
        centered
      >
        <Stack align="center" py="md">
          <Text>Press the desired key combination for:</Text>
          <Text fw={700} size="lg">
            {activeDefinition?.description}
          </Text>

          <Box
            p="xl"
            style={{
              border: "2px dashed var(--mantine-color-default-border)",
              borderRadius: 8,
              minWidth: 200,
              textAlign: "center",
              backgroundColor: "var(--mantine-color-default-hover)",
            }}
          >
            {recordedKeys ? (
              <Group justify="center">{renderKey(recordedKeys)}</Group>
            ) : (
              <Text c="dimmed" fs="italic">
                Listening for keys...
              </Text>
            )}
          </Box>

          <Group mt="md">
            <Button variant="default" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveShortcut}
              disabled={!recordedKeys}
              color="blue"
            >
              Save Shortcut
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
