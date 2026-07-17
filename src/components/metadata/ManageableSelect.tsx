// Manageable Select Components with Inline Edit/Delete in Dropdown
import React, { useState, useRef } from "react";
import {
  Stack,
  Group,
  Loader,
  Combobox,
  InputBase,
  useCombobox,
  ActionIcon,
  TextInput,
  Text,
  ScrollArea,
  Box,
} from "@mantine/core";
import { IconEdit, IconTrash, IconCheck, IconX } from "@tabler/icons-react";

// ============================================================================
// Manageable Select Component (Single Select with Inline Edit/Delete)
// ============================================================================

export interface ManageableSelectProps {
  label: string;
  placeholder: string;
  data: { id: string; name: string }[];
  value?: string;
  onChange: (value: string | undefined) => void;
  onCreate: (name: string) => Promise<{ id: string; name: string }>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}

export const ManageableSelect: React.FC<ManageableSelectProps> = ({
  label,
  placeholder,
  data,
  value,
  onChange,
  onCreate,
  onRename,
  onDelete,
  disabled = false,
}) => {
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setEditingId(null);
    },
  });

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [processing, setProcessing] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = data.find((item) => item.id === value);

  // Filter options based on search
  const filteredData = data.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase().trim()),
  );

  // Check if search matches exactly
  const exactMatch = data.some(
    (item) => item.name.toLowerCase() === search.toLowerCase().trim(),
  );

  const handleCreate = async () => {
    if (!search.trim()) return;
    setCreating(true);
    try {
      const newItem = await onCreate(search.trim());
      onChange(newItem.id);
      setSearch("");
      combobox.closeDropdown();
    } catch (error) {
      console.error("Failed to create:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editValue.trim()) return;
    setProcessing(true);
    try {
      await onRename(id, editValue.trim());
      setEditingId(null);
    } catch (error) {
      console.error("Failed to rename:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessing(true);
    try {
      await onDelete(id);
      if (value === id) {
        onChange(undefined);
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setProcessing(false);
    }
  };

  const startEdit = (
    item: { id: string; name: string },
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditValue(item.name);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const options = filteredData.map((item) => (
    <Combobox.Option
      value={item.id}
      key={item.id}
      disabled={editingId === item.id}
    >
      {editingId === item.id ? (
        <Group gap={4} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <TextInput
            ref={editInputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.currentTarget.value)}
            size="xs"
            style={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRename(item.id);
              } else if (e.key === "Escape") {
                setEditingId(null);
              }
            }}
          />
          <ActionIcon
            size="xs"
            variant="subtle"
            color="green"
            onClick={() => handleRename(item.id)}
            loading={processing}
          >
            <IconCheck size={12} />
          </ActionIcon>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="gray"
            onClick={cancelEdit}
          >
            <IconX size={12} />
          </ActionIcon>
        </Group>
      ) : (
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" truncate style={{ flex: 1 }}>
            {item.name}
          </Text>
          <Group gap={2} wrap="nowrap">
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={(e) => startEdit(item, e)}
              disabled={processing}
            >
              <IconEdit size={12} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={(e) => handleDelete(item.id, e)}
              disabled={processing}
            >
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
        </Group>
      )}
    </Combobox.Option>
  ));

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <Combobox
        store={combobox}
        onOptionSubmit={(val) => {
          if (editingId) return;
          if (val === "$create") {
            void handleCreate();
            return;
          }
          // Ensure empty strings are treated as undefined to avoid FK violations
          onChange(val || undefined);
          setSearch("");
          combobox.closeDropdown();
        }}
      >
        <Combobox.Target>
          <InputBase
            rightSection={
              creating ? <Loader size={16} /> : <Combobox.Chevron />
            }
            rightSectionPointerEvents="none"
            onClick={() => combobox.openDropdown()}
            onFocus={() => combobox.openDropdown()}
            onBlur={() => {
              combobox.closeDropdown();
              setSearch(selectedItem?.name || "");
            }}
            placeholder={placeholder}
            value={search || selectedItem?.name || ""}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              combobox.updateSelectedOptionIndex();
              combobox.openDropdown();
            }}
            disabled={disabled || creating}
          />
        </Combobox.Target>

        <Combobox.Dropdown>
          <Combobox.Options>
            <ScrollArea.Autosize mah={200}>
              {options}
              {search.trim() && !exactMatch && !creating && (
                <Combobox.Option value="$create">
                  <Text size="sm" c="blue">
                    + Create "{search}"
                  </Text>
                </Combobox.Option>
              )}
              {filteredData.length === 0 && !search.trim() && (
                <Combobox.Empty>No items</Combobox.Empty>
              )}
            </ScrollArea.Autosize>
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    </Stack>
  );
};

// ============================================================================
// Manageable Multi-Select Component (Multi-Select with Inline Edit/Delete)
// ============================================================================

export interface ManageableMultiSelectProps {
  label: string;
  placeholder: string;
  data: { id: string; name: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  onCreate: (name: string) => Promise<{ id: string; name: string }>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  disabled?: boolean;
}

export const ManageableMultiSelect: React.FC<ManageableMultiSelectProps> = ({
  label,
  placeholder,
  data,
  value,
  onChange,
  onCreate,
  onRename,
  onDelete,
  disabled = false,
}) => {
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setEditingId(null);
    },
  });

  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [processing, setProcessing] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Get selected item names for display
  const selectedItems = data.filter((item) => value.includes(item.id));

  // Filter options based on search
  const filteredData = data.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase().trim()),
  );

  // Check if search matches exactly
  const exactMatch = data.some(
    (item) => item.name.toLowerCase() === search.toLowerCase().trim(),
  );

  const handleCreate = async () => {
    if (!search.trim()) return;
    setCreating(true);
    try {
      const newItem = await onCreate(search.trim());
      onChange([...value, newItem.id]);
      setSearch("");
    } catch (error) {
      console.error("Failed to create:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!editValue.trim()) return;
    setProcessing(true);
    try {
      await onRename(id, editValue.trim());
      setEditingId(null);
    } catch (error) {
      console.error("Failed to rename:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessing(true);
    try {
      await onDelete(id);
      if (value.includes(id)) {
        onChange(value.filter((v) => v !== id));
      }
    } catch (error) {
      console.error("Failed to delete:", error);
    } finally {
      setProcessing(false);
    }
  };

  const startEdit = (
    item: { id: string; name: string },
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditValue(item.name);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleValueToggle = (id: string) => {
    if (editingId) return;
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      // Ensure we don't add empty strings
      if (id) onChange([...value, id]);
    }
  };

  const options = filteredData.map((item) => {
    const isSelected = value.includes(item.id);

    return (
      <Combobox.Option
        value={item.id}
        key={item.id}
        disabled={editingId === item.id}
      >
        {editingId === item.id ? (
          <Group gap={4} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
            <TextInput
              ref={editInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.currentTarget.value)}
              size="xs"
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRename(item.id);
                } else if (e.key === "Escape") {
                  setEditingId(null);
                }
              }}
            />
            <ActionIcon
              size="xs"
              variant="subtle"
              color="green"
              onClick={() => handleRename(item.id)}
              loading={processing}
            >
              <IconCheck size={12} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={cancelEdit}
            >
              <IconX size={12} />
            </ActionIcon>
          </Group>
        ) : (
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
              <Box
                style={{
                  width: 14,
                  height: 14,
                  border: "1px solid var(--mantine-color-gray-4)",
                  borderRadius: 3,
                  backgroundColor: isSelected
                    ? "var(--mantine-color-blue-6)"
                    : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected && <IconCheck size={10} color="white" />}
              </Box>
              <Text size="sm" truncate>
                {item.name}
              </Text>
            </Group>
            <Group gap={2} wrap="nowrap">
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={(e) => startEdit(item, e)}
                disabled={processing}
              >
                <IconEdit size={12} />
              </ActionIcon>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                onClick={(e) => handleDelete(item.id, e)}
                disabled={processing}
              >
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
          </Group>
        )}
      </Combobox.Option>
    );
  });

  // Display value for selected items
  const displayValue =
    selectedItems.length > 0
      ? selectedItems.map((item) => item.name).join(", ")
      : "";

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <Combobox
        store={combobox}
        onOptionSubmit={(val) => {
          if (val === "$create") {
            handleCreate();
          } else {
            handleValueToggle(val);
          }
        }}
      >
        <Combobox.Target>
          <InputBase
            rightSection={
              creating ? <Loader size={16} /> : <Combobox.Chevron />
            }
            rightSectionPointerEvents="none"
            onClick={() => combobox.openDropdown()}
            onFocus={() => combobox.openDropdown()}
            onBlur={() => {
              combobox.closeDropdown();
              setSearch("");
            }}
            placeholder={selectedItems.length === 0 ? placeholder : undefined}
            value={search || displayValue}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              combobox.updateSelectedOptionIndex();
              combobox.openDropdown();
            }}
            disabled={disabled || creating}
          />
        </Combobox.Target>

        <Combobox.Dropdown>
          <Combobox.Options>
            <ScrollArea.Autosize mah={200}>
              {options}
              {search.trim() && !exactMatch && !creating && (
                <Combobox.Option value="$create">
                  <Text size="sm" c="blue">
                    + Create "{search}"
                  </Text>
                </Combobox.Option>
              )}
              {filteredData.length === 0 && !search.trim() && (
                <Combobox.Empty>No items</Combobox.Empty>
              )}
            </ScrollArea.Autosize>
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>
    </Stack>
  );
};
