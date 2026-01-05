import React from 'react';
import {
  Group,
  Text,
  Button,
  TextInput,
  Menu,
  Box,
  ActionIcon,
  Tooltip
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDatabase,
  faSearch,
  faSave,
  faFolderOpen,
  faFileCirclePlus,
  faFilePdf,
  faTableList,
  faBars
} from "@fortawesome/free-solid-svg-icons";

interface HeaderProps {
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile?: () => void;
  // Database panel props
  showDatabasePanel?: boolean;
  onToggleDatabasePanel?: () => void;
  // Sidebar props
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
}

export const HeaderContent: React.FC<HeaderProps> = ({ 
  onNewFile, 
  onOpenFile,
  onSaveFile,
  showDatabasePanel,
  onToggleDatabasePanel,
  showSidebar,
  onToggleSidebar
}) => (
  <Group h="100%" px="md" justify="space-between" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }} data-tauri-drag-region>
    <Group data-tauri-drag-region>
      <Group gap={6} mr="lg" style={{ userSelect: 'none' }}>
        <FontAwesomeIcon icon={faDatabase} style={{ width: 18, height: 18, color: "#339af0" }} />
        <Text fw={700} size="sm" c="dimmed">DataTex <Text span size="xs" c="dimmed">v2.0</Text></Text>
      </Group>
      <Group gap={0} visibleFrom="sm">
        {["File", "Edit", "View", "Go", "Help"].map((label) => (
          <Menu key={label} shadow="md" width={200}>
            <Menu.Target>
                <Button variant="subtle" color="gray" size="compact-xs" radius="sm" fw={400} style={{ fontSize: 12 }}>{label}</Button>
            </Menu.Target>
            <Menu.Dropdown>
              {label === 'File' && (
                <>
                  <Menu.Item leftSection={<FontAwesomeIcon icon={faFileCirclePlus} style={{ width: 14, height: 14 }} />} onClick={onNewFile}>New File</Menu.Item>
                  <Menu.Item leftSection={<FontAwesomeIcon icon={faFolderOpen} style={{ width: 14, height: 14 }} />} onClick={onOpenFile}>Open Folder</Menu.Item>
                  <Menu.Item leftSection={<FontAwesomeIcon icon={faSave} style={{ width: 14, height: 14 }} />} onClick={onSaveFile}>Save</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item leftSection={<FontAwesomeIcon icon={faFilePdf} style={{ width: 14, height: 14 }} />}>Export to PDF</Menu.Item>
                </>
              )}
              {label === 'Edit' && (
                  <>
                    <Menu.Item>Undo</Menu.Item>
                    <Menu.Item>Redo</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item>Cut</Menu.Item>
                    <Menu.Item>Copy</Menu.Item>
                    <Menu.Item>Paste</Menu.Item>
                  </>
              )}
              {label !== 'File' && label !== 'Edit' && (
                  <Menu.Item>Placeholder Action</Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        ))}
      </Group>
    </Group>
    <Box style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: '30%' }}>
      <TextInput 
        placeholder="DataTex Search (Ctrl+P)" 
        leftSection={<FontAwesomeIcon icon={faSearch} style={{ width: 12, height: 12 }} />}
        size="xs" 
        radius="md" 
        styles={{ 
            input: { 
                height: 24, 
                minHeight: 24, 
                backgroundColor: "var(--mantine-color-default)",
                borderColor: "transparent", 
                color: "var(--mantine-color-text)",
                textAlign: 'center' 
            } 
        }} 
      />
    </Box>
    <Group gap="xs">
      {/* Sidebar Toggle */}
      {onToggleSidebar && (
        <Tooltip label={showSidebar ? "Hide sidebar" : "Show sidebar"}>
          <ActionIcon 
            variant="subtle"
            size="sm"
            color={showSidebar ? "blue" : "gray"}
            onClick={onToggleSidebar}
          >
            <FontAwesomeIcon icon={faBars} style={{ width: 14, height: 14 }} />
          </ActionIcon>
        </Tooltip>
      )}
      
      {/* Database Table Toggle - always visible */}
      {onToggleDatabasePanel && (
        <Tooltip label={showDatabasePanel ? "Hide database table" : "Show database table"}>
          <ActionIcon 
            variant="subtle"
            size="sm"
            color={showDatabasePanel ? "blue" : "gray"}
            onClick={onToggleDatabasePanel}
          >
            <FontAwesomeIcon icon={faTableList} style={{ width: 14, height: 14 }} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  </Group>
);
