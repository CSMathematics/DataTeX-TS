import React from "react";
import {
  Group,
  Text,
  Button,
  Menu,
  Box,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
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
import { IconSparkles2 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { DataTeXLogo } from "../icons/DataTeXLogo";

interface HeaderProps {
  onNewFile: () => void;
  onNewFromTemplate?: () => void;
  onSaveFile?: () => void;
  onOpenFile?: () => void;
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
  onToggleAI?: () => void;
}

export const HeaderContent: React.FC<HeaderProps> = ({
  onNewFile,
  onNewFromTemplate,
  onSaveFile,
  onOpenFile,
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
  onToggleAI,
}) => {
  const { t } = useTranslation();

  return (
    <Group
      h="100%"
      px="md"
      justify="space-between"
      style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
      data-tauri-drag-region
    >
      <Group data-tauri-drag-region>
        <Group gap={0} mr="lg" style={{ userSelect: "none" }}>
          <DataTeXLogo size={24} color="var(--mantine-primary-color-filled)" />
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
                {t("menu.file.label")}
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
                {t("menu.file.newFile")}
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
                {t("menu.file.newFromTemplate")}
              </Menu.Item>
              <Menu.Item
                leftSection={
                  <FontAwesomeIcon
                    icon={faFolderOpen}
                    style={{ width: 14, height: 14 }}
                  />
                }
                onClick={onOpenFile}
                rightSection={
                  <Text size="xs" c="dimmed">
                    Ctrl+Shift+O
                  </Text>
                }
              >
                {t("menu.file.openFile")}
              </Menu.Item>
              <Menu.Divider />
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
                {t("menu.file.open")}
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
                {t("menu.file.save")}
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
                {t("menu.file.exportPdf")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red">{t("menu.file.exit")}</Menu.Item>
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
                {t("menu.edit.label")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                onClick={onUndo}
                rightSection={<Text size="xs">Ctrl+Z</Text>}
              >
                {t("menu.edit.undo")}
              </Menu.Item>
              <Menu.Item
                onClick={onRedo}
                rightSection={<Text size="xs">Ctrl+Y</Text>}
              >
                {t("menu.edit.redo")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                onClick={onCut}
                rightSection={<Text size="xs">Ctrl+X</Text>}
              >
                {t("menu.edit.cut")}
              </Menu.Item>
              <Menu.Item
                onClick={onCopy}
                rightSection={<Text size="xs">Ctrl+C</Text>}
              >
                {t("menu.edit.copy")}
              </Menu.Item>
              <Menu.Item
                onClick={onPaste}
                rightSection={<Text size="xs">Ctrl+V</Text>}
              >
                {t("menu.edit.paste")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                onClick={onFind}
                rightSection={<Text size="xs">Ctrl+F</Text>}
              >
                {t("menu.edit.find")}
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
                {t("menu.insert.label")}
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
                {t("menu.insert.image")}
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
                {t("menu.view.label")}
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
                {t("menu.view.databasePanel")}
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
                {t("menu.view.rightSidebar")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item onClick={onToggleWordCount}>
                {t("menu.view.wordCount")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                onClick={onZoomIn}
                rightSection={<Text size="xs">Ctrl++</Text>}
              >
                {t("menu.view.zoomIn")}
              </Menu.Item>
              <Menu.Item
                onClick={onZoomOut}
                rightSection={<Text size="xs">Ctrl+-</Text>}
              >
                {t("menu.view.zoomOut")}
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
                {t("menu.database.label")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={onOpenDatabase}>
                {t("menu.database.open")}
              </Menu.Item>
              <Menu.Item onClick={onAddCollection}>
                {t("menu.database.addCollection")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item onClick={onRefreshDatabase}>
                {t("menu.database.refresh")}
              </Menu.Item>
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
                {t("menu.tools.label")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{t("menu.tools.wizards")}</Menu.Label>
              <Menu.Item
                onClick={() => onOpenWizard && onOpenWizard("preamble")}
              >
                {t("menu.tools.preambleWizard")}
              </Menu.Item>
              <Menu.Item onClick={() => onOpenWizard && onOpenWizard("table")}>
                {t("menu.tools.tableWizard")}
              </Menu.Item>
              <Menu.Item onClick={() => onOpenWizard && onOpenWizard("tikz")}>
                {t("menu.tools.tikzWizard")}
              </Menu.Item>
              <Menu.Item
                onClick={() => onOpenWizard && onOpenWizard("fancyhdr")}
              >
                {t("menu.tools.fancyhdrWizard")}
              </Menu.Item>
              <Menu.Item
                onClick={() => onOpenWizard && onOpenWizard("pstricks")}
              >
                {t("menu.tools.pstricksWizard")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                onClick={() => onOpenWizard && onOpenWizard("gallery")}
              >
                {t("menu.tools.packageGallery")}
              </Menu.Item>
              <Menu.Item
                onClick={onOpenPackageBrowser}
                rightSection={<Text size="xs">Ctrl+Shift+P</Text>}
              >
                {t("menu.tools.packageBrowser")}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item onClick={onOpenSettings}>
                {t("menu.tools.settings")}
              </Menu.Item>
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
                {t("menu.build.label")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                onClick={onCompile}
                rightSection={<Text size="xs">F5</Text>}
              >
                {t("menu.build.compile")}
              </Menu.Item>
              <Menu.Item onClick={onStopCompile}>
                {t("menu.build.stop")}
              </Menu.Item>
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
                {t("menu.help.label")}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item>{t("menu.help.about")}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      <Box
        style={{
          position: "absolute",
          left: "50%",
          width: "10%",
        }}
      >
        <Text size="sm" c="dimmed" fw={700}>
          DataTeX
        </Text>
      </Box>
      <Group gap={3}>
        {/* Left Sidebar (Outline) Toggle */}
        {onToggleLeftSidebar && (
          <Tooltip
            label={
              showLeftSidebar
                ? t("header.hideOutline")
                : t("header.showOutline")
            }
          >
            <ActionIcon
              variant="subtle"
              size="sm"
              color={showLeftSidebar ? "blue" : "gray.5"}
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
              showDatabasePanel
                ? t("header.hideDatabase")
                : t("header.showDatabase")
            }
          >
            <ActionIcon
              variant="subtle"
              size="sm"
              color={showDatabasePanel ? "blue" : "gray.5"}
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
                ? t("header.moveDatabaseLeft")
                : t("header.moveDatabaseBottom")
            }
          >
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray.5"
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
            label={
              showRightSidebar
                ? t("header.hideRightPanel")
                : t("header.showRightPanel")
            }
          >
            <ActionIcon
              variant="subtle"
              size="sm"
              color={showRightSidebar ? "blue" : "gray.5"}
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

        {/* AI Assistant Toggle */}
        {onToggleAI && (
          <Tooltip label={t("header.aiAssistant")}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="blue" // Distinct color for AI
              onClick={onToggleAI}
            >
              <IconSparkles2 stroke={1.5} />
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
            color="red"
            onClick={() => getCurrentWindow().close()}
            size="sm"
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Group>
  );
};
