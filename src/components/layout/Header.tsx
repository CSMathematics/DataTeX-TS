import React from "react";
import {
  Group,
  Text,
  Button,
  TextInput,
  Menu,
  Box,
  ActionIcon,
  Tooltip,
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
  faColumns,
  faImage,
} from "@fortawesome/free-solid-svg-icons";
import {
  IconLayoutSidebarRightCollapseFilled,
  IconLayoutSidebarRightExpandFilled,
  IconDatabase,
  IconLayoutSidebarFilled,
  IconMinus,
  IconSquare,
  IconX,
} from "@tabler/icons-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface HeaderProps {
  onNewFile: () => void;
  onNewFromTemplate?: () => void;
  onSaveFile?: () => void;
  // Database panel props
  showDatabasePanel?: boolean;
  onToggleDatabasePanel?: () => void;
  databasePanelPosition?: "bottom" | "left";
  onToggleDatabasePosition?: () => void;

  // Left sidebar (Outline) props
  showLeftSidebar?: boolean;
  onToggleLeftSidebar?: () => void;

  // Right sidebar (ResourceInspector) props
  showRightSidebar?: boolean;
  onToggleRightSidebar?: () => void;
  // New props
  onUndo?: () => void;
  onRedo?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onFind?: () => void;
  onToggleWordCount?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onOpenWizard?: (wizard: string) => void;
  onOpenSettings?: () => void;
  onOpenDatabase?: () => void;
  onAddCollection?: () => void;
  onRefreshDatabase?: () => void;
  onCompile?: () => void;
  onStopCompile?: () => void;
  onOpenPackageBrowser?: () => void;
  onInsertImage?: () => void;
}

export const HeaderContent: React.FC<HeaderProps> = ({
  onNewFile,
  onNewFromTemplate,
  onSaveFile,
  // Database panel props
  showDatabasePanel,
  onToggleDatabasePanel,
  databasePanelPosition,
  onToggleDatabasePosition,

  // Left sidebar (Outline) props
  showLeftSidebar,
  onToggleLeftSidebar,

  // Right sidebar (ResourceInspector) props
  showRightSidebar,
  onToggleRightSidebar,
  // New props
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onFind,
  onToggleWordCount,
  onZoomIn,
  onZoomOut,
  onOpenWizard,
  onOpenSettings,
  onOpenDatabase,
  onAddCollection,
  onRefreshDatabase,
  onCompile,
  onStopCompile,
  onOpenPackageBrowser,
  onInsertImage,
}) => (
  <Group
    h="100%"
    px="md"
    justify="space-between"
    style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
    data-tauri-drag-region
  >
    <Group data-tauri-drag-region>
      <Group gap={6} mr="lg" style={{ userSelect: "none" }}>
        <FontAwesomeIcon
          icon={faDatabase}
          style={{ width: 18, height: 18, color: "var(--app-accent-color)" }}
        />
        <Text fw={700} size="sm" c="dimmed">
          DataTex{" "}
          <Text span size="xs" c="dimmed">
            v2.0
          </Text>
        </Text>
      </Group>
      <Group gap={0} visibleFrom="sm">
        {/* FILE MENU */}
        <Menu shadow="md" width={220}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              radius="sm"
              fw={400}
              style={{ fontSize: 12 }}
            >
              File
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={
                <FontAwesomeIcon
                  icon={faFileCirclePlus}
                  style={{ width: 14, height: 14 }}
                />
              }
              onClick={onNewFile}
              rightSection={
                <Text size="xs" c="dimmed">
                  Ctrl+N
                </Text>
              }
            >
              New File
            </Menu.Item>
            <Menu.Item
              leftSection={
                <FontAwesomeIcon
                  icon={faFileCirclePlus}
                  style={{ width: 14, height: 14 }}
                />
              }
              onClick={onNewFromTemplate}
              rightSection={
                <Text size="xs" c="dimmed">
                  Ctrl+Shift+N
                </Text>
              }
            >
              New from Template
            </Menu.Item>
            <Menu.Item
              leftSection={
                <FontAwesomeIcon
                  icon={faFolderOpen}
                  style={{ width: 14, height: 14 }}
                />
              }
              onClick={onOpenDatabase}
              rightSection={
                <Text size="xs" c="dimmed">
                  Ctrl+O
                </Text>
              }
            >
              Open Database / Folder
            </Menu.Item>
            <Menu.Item
              leftSection={
                <FontAwesomeIcon
                  icon={faSave}
                  style={{ width: 14, height: 14 }}
                />
              }
              onClick={onSaveFile}
              rightSection={
                <Text size="xs" c="dimmed">
                  Ctrl+S
                </Text>
              }
            >
              Save
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={
                <FontAwesomeIcon
                  icon={faFilePdf}
                  style={{ width: 14, height: 14 }}
                />
              }
            >
              Export to PDF
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red">Exit</Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* EDIT MENU */}
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              radius="sm"
              fw={400}
              style={{ fontSize: 12 }}
            >
              Edit
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              onClick={onUndo}
              rightSection={<Text size="xs">Ctrl+Z</Text>}
            >
              Undo
            </Menu.Item>
            <Menu.Item
              onClick={onRedo}
              rightSection={<Text size="xs">Ctrl+Y</Text>}
            >
              Redo
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              onClick={onCut}
              rightSection={<Text size="xs">Ctrl+X</Text>}
            >
              Cut
            </Menu.Item>
            <Menu.Item
              onClick={onCopy}
              rightSection={<Text size="xs">Ctrl+C</Text>}
            >
              Copy
            </Menu.Item>
            <Menu.Item
              onClick={onPaste}
              rightSection={<Text size="xs">Ctrl+V</Text>}
            >
              Paste
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              onClick={onFind}
              rightSection={<Text size="xs">Ctrl+F</Text>}
            >
              Find
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* INSERT MENU */}
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              radius="sm"
              fw={400}
              style={{ fontSize: 12 }}
            >
              Insert
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={
                <FontAwesomeIcon
                  icon={faImage}
                  style={{ width: 14, height: 14 }}
                />
              }
              onClick={onInsertImage}
            >
              Image (Figure)
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* VIEW MENU */}
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              radius="sm"
              fw={400}
              style={{ fontSize: 12 }}
            >
              View
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={
                <FontAwesomeIcon
                  icon={faTableList}
                  style={{ width: 14, height: 14 }}
                />
              }
              onClick={onToggleDatabasePanel}
              rightSection={
                <Text size="xs">{showDatabasePanel ? "✓" : ""}</Text>
              }
            >
              Database Panel
            </Menu.Item>
            <Menu.Item
              leftSection={
                <FontAwesomeIcon
                  icon={faColumns}
                  style={{ width: 14, height: 14 }}
                />
              }
              onClick={onToggleRightSidebar}
              rightSection={
                <Text size="xs">{showRightSidebar ? "✓" : ""}</Text>
              }
            >
              Right Sidebar (PDF)
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item onClick={onToggleWordCount}>Word Count</Menu.Item>
            <Menu.Divider />
            <Menu.Item
              onClick={onZoomIn}
              rightSection={<Text size="xs">Ctrl++</Text>}
            >
              Zoom In
            </Menu.Item>
            <Menu.Item
              onClick={onZoomOut}
              rightSection={<Text size="xs">Ctrl+-</Text>}
            >
              Zoom Out
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* DATABASE MENU */}
        <Menu shadow="md" width={220}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              radius="sm"
              fw={400}
              style={{ fontSize: 12 }}
            >
              Database
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onOpenDatabase}>Open Database</Menu.Item>
            <Menu.Item onClick={onAddCollection}>
              Add Collection (Folder)
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item onClick={onRefreshDatabase}>Refresh Database</Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* TOOLS MENU */}
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              radius="sm"
              fw={400}
              style={{ fontSize: 12 }}
            >
              Tools
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Wizards</Menu.Label>
            <Menu.Item onClick={() => onOpenWizard && onOpenWizard("preamble")}>
              Preamble Wizard
            </Menu.Item>
            <Menu.Item onClick={() => onOpenWizard && onOpenWizard("table")}>
              Table Wizard
            </Menu.Item>
            <Menu.Item onClick={() => onOpenWizard && onOpenWizard("tikz")}>
              TikZ Wizard
            </Menu.Item>
            <Menu.Item onClick={() => onOpenWizard && onOpenWizard("fancyhdr")}>
              FancyHDR Wizard
            </Menu.Item>
            <Menu.Item onClick={() => onOpenWizard && onOpenWizard("pstricks")}>
              PSTricks Wizard
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item onClick={() => onOpenWizard && onOpenWizard("gallery")}>
              Package Gallery
            </Menu.Item>
            <Menu.Item
              onClick={onOpenPackageBrowser}
              rightSection={<Text size="xs">Ctrl+Shift+P</Text>}
            >
              Package Browser
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item onClick={onOpenSettings}>Settings</Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* BUILD MENU */}
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              radius="sm"
              fw={400}
              style={{ fontSize: 12 }}
            >
              Build
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              onClick={onCompile}
              rightSection={<Text size="xs">F5</Text>}
            >
              Compile
            </Menu.Item>
            <Menu.Item onClick={onStopCompile}>Stop Build</Menu.Item>
          </Menu.Dropdown>
        </Menu>

        {/* HELP MENU */}
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              radius="sm"
              fw={400}
              style={{ fontSize: 12 }}
            >
              Help
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item>About DataTex</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Group>
    <Box
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        width: "30%",
      }}
    >
      <TextInput
        placeholder="DataTex Search (Ctrl+P)"
        leftSection={
          <FontAwesomeIcon icon={faSearch} style={{ width: 12, height: 12 }} />
        }
        size="xs"
        radius="md"
        styles={{
          input: {
            height: 24,
            minHeight: 24,
            backgroundColor: "var(--mantine-color-default)",
            borderColor: "transparent",
            color: "var(--mantine-color-text)",
            textAlign: "center",
          },
        }}
      />
    </Box>
    <Group gap={3}>
      {/* Left Sidebar (Outline) Toggle */}
      {onToggleLeftSidebar && (
        <Tooltip label={showLeftSidebar ? "Hide outline" : "Show outline"}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color={showLeftSidebar ? "blue" : "gray.7"}
            onClick={onToggleLeftSidebar}
          >
            <IconLayoutSidebarFilled size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {/* Database Table Toggle */}
      {onToggleDatabasePanel && (
        <Tooltip
          label={
            showDatabasePanel ? "Hide database table" : "Show database table"
          }
        >
          <ActionIcon
            variant="subtle"
            size="sm"
            color={showDatabasePanel ? "blue" : "gray.7"}
            onClick={onToggleDatabasePanel}
          >
            <IconDatabase size={16} />
          </ActionIcon>
        </Tooltip>
      )}

      {/* Database Panel Position Toggle */}
      {showDatabasePanel && onToggleDatabasePosition && (
        <Tooltip
          label={
            databasePanelPosition === "bottom"
              ? "Move database to left"
              : "Move database to bottom"
          }
        >
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray.7"
            onClick={onToggleDatabasePosition}
          >
            <FontAwesomeIcon
              icon={
                databasePanelPosition === "bottom" ? faColumns : faTableList
              }
              style={{ width: 14, height: 14 }}
            />
          </ActionIcon>
        </Tooltip>
      )}

      {/* Right Sidebar (ResourceInspector) Toggle */}
      {onToggleRightSidebar && (
        <Tooltip
          label={showRightSidebar ? "Hide right panel" : "Show right panel"}
        >
          <ActionIcon
            variant="subtle"
            size="sm"
            color={showRightSidebar ? "blue" : "gray.7"}
            onClick={onToggleRightSidebar}
          >
            {showRightSidebar ? (
              <IconLayoutSidebarRightCollapseFilled size={16} />
            ) : (
              <IconLayoutSidebarRightExpandFilled size={16} />
            )}
          </ActionIcon>
        </Tooltip>
      )}

      {/* Window Controls */}
      <Group gap={0} ml="xs">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => getCurrentWindow().minimize()}
        >
          <IconMinus size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => getCurrentWindow().toggleMaximize()}
        >
          <IconSquare size={14} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="red" // Usually close is red on hover, but user asked for simple style. Let's start with gray and maybe hover red if possible, but mantine simple variant is easiest.
          // Actually user image showed grey icons. Let's stick to gray.
          onClick={() => getCurrentWindow().close()}
          size="sm"
        >
          <IconX size={16} />
        </ActionIcon>
      </Group>
    </Group>
  </Group>
);
