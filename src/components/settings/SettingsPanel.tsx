import React, { useState, useMemo } from "react";
import {
  Box,
  Group,
  NavLink,
  Title,
  ScrollArea,
  TextInput,
  Text,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCog,
  faTerminal,
  faPalette,
  faCode,
  faFilePdf,
  faHammer,
  faKeyboard,
  faDatabase,
  faUniversalAccess,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { TexEngineSettings } from "./TexEngineSettings";
import { EditorSettings } from "./EditorSettings";
import { EditorBehaviorSettings } from "./EditorBehaviorSettings";
import { PdfViewerSettings } from "./PdfViewerSettings";
import { CompilationSettings } from "./CompilationSettings";
import { DatabaseSettings } from "./DatabaseSettings";
import { AccessibilitySettings } from "./AccessibilitySettings";
import { KeyboardShortcutsSettings } from "./KeyboardShortcutsSettings";
import { ThemeSettings } from "./ThemeSettings";
import { GeneralSettings } from "./GeneralSettings";
import {
  AppSettings,
  EditorSettings as IEditorSettings,
  EditorBehaviorSettings as IEditorBehaviorSettings,
  PdfViewerSettings as IPdfViewerSettings,
  CompilationSettings as ICompilationSettings,
  DatabaseSettings as IDatabaseSettings,
  AccessibilitySettings as IAccessibilitySettings,
  GeneralSettings as IGeneralSettings,
} from "../../hooks/useSettings";

type SettingsCategory =
  | "general"
  | "tex"
  | "compilation"
  | "editor"
  | "editorBehavior"
  | "pdfViewer"
  | "database"
  | "accessibility"
  | "shortcuts"
  | "theme";

interface SettingsPanelProps {
  initialCategory?: SettingsCategory;
  settings: AppSettings;
  onUpdateEditor: <K extends keyof IEditorSettings>(
    key: K,
    value: IEditorSettings[K]
  ) => void;
  onUpdateEditorBehavior: <K extends keyof IEditorBehaviorSettings>(
    key: K,
    value: IEditorBehaviorSettings[K]
  ) => void;
  onUpdatePdfViewer: <K extends keyof IPdfViewerSettings>(
    key: K,
    value: IPdfViewerSettings[K]
  ) => void;
  onUpdateCompilation: <K extends keyof ICompilationSettings>(
    key: K,
    value: ICompilationSettings[K]
  ) => void;
  onUpdateDatabase: <K extends keyof IDatabaseSettings>(
    key: K,
    value: IDatabaseSettings[K]
  ) => void;
  onUpdateAccessibility: <K extends keyof IAccessibilitySettings>(
    key: K,
    value: IAccessibilitySettings[K]
  ) => void;
  onUpdateGeneral: <K extends keyof IGeneralSettings>(
    key: K,
    value: IGeneralSettings[K]
  ) => void;
  onUpdateUi: (theme: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  initialCategory = "general",
  settings,
  onUpdateEditor,
  onUpdateEditorBehavior,
  onUpdatePdfViewer,
  onUpdateCompilation,
  onUpdateDatabase,
  onUpdateAccessibility,
  onUpdateGeneral,
  onUpdateUi,
}) => {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");

  // Define categories with metadata for search
  const categories = useMemo(
    () =>
      [
        {
          id: "general",
          label: "General",
          icon: faCog,
          keywords: "startup exit language autosave",
        },
        {
          id: "tex",
          label: "TeX Engines",
          icon: faTerminal,
          keywords: "latex compiler pdflatex xelatex lualatex bibtex",
        },
        {
          id: "compilation",
          label: "Compilation",
          icon: faHammer,
          keywords: "build compile error log timeout clean aux",
        },
        {
          id: "editor",
          label: "Editor Appearance",
          icon: faCode,
          keywords: "font size theme minimap line numbers wordwrap",
        },
        {
          id: "editorBehavior",
          label: "Editor Behavior",
          icon: faKeyboard,
          keywords: "tab indent autocomplete brackets cursor formatting",
        },
        {
          id: "pdfViewer",
          label: "PDF Viewer",
          icon: faFilePdf,
          keywords: "zoom pdf split view synctex scroll",
        },
        {
          id: "database",
          label: "Database",
          icon: faDatabase,
          keywords: "table graph view metadata preamble",
        },
        {
          id: "accessibility",
          label: "Accessibility",
          icon: faUniversalAccess,
          keywords: "contrast motion animation spacing ligatures whitespace",
        },
        {
          id: "shortcuts",
          label: "Keyboard Shortcuts",
          icon: faKeyboard,
          keywords: "hotkeys keybindings shortcuts commands",
        },
        {
          id: "theme",
          label: "Theme",
          icon: faPalette,
          keywords: "color ui dark light theme appearance",
        },
      ] as const,
    []
  );

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.label.toLowerCase().includes(query) ||
        cat.keywords.toLowerCase().includes(query)
    );
  }, [searchQuery, categories]);

  const renderContent = () => {
    switch (activeCategory) {
      case "general":
        return (
          <GeneralSettings
            settings={settings.general}
            onUpdate={onUpdateGeneral}
          />
        );
      case "tex":
        return <TexEngineSettings />;
      case "compilation":
        return (
          <CompilationSettings
            settings={settings.compilation}
            onUpdate={onUpdateCompilation}
          />
        );
      case "editor":
        return (
          <EditorSettings
            settings={settings.editor}
            onUpdate={onUpdateEditor}
          />
        );
      case "editorBehavior":
        return (
          <EditorBehaviorSettings
            settings={settings.editorBehavior}
            onUpdate={onUpdateEditorBehavior}
          />
        );
      case "pdfViewer":
        return (
          <PdfViewerSettings
            settings={settings.pdfViewer}
            onUpdate={onUpdatePdfViewer}
          />
        );
      case "database":
        return (
          <DatabaseSettings
            settings={settings.database}
            onUpdate={onUpdateDatabase}
          />
        );
      case "accessibility":
        return (
          <AccessibilitySettings
            settings={settings.accessibility}
            onUpdate={onUpdateAccessibility}
          />
        );
      case "shortcuts":
        return <KeyboardShortcutsSettings />;
      case "theme":
        return (
          <ThemeSettings
            settings={settings}
            onUpdateEditor={onUpdateEditor}
            onUpdateUi={onUpdateUi}
          />
        );
      default:
        return (
          <GeneralSettings
            settings={settings.general}
            onUpdate={onUpdateGeneral}
          />
        );
    }
  };

  return (
    <Group h="100%" gap={0} align="stretch" style={{ overflow: "hidden" }}>
      {/* Settings Sidebar */}
      <Box
        w={250}
        style={{
          backgroundColor: "var(--app-sidebar-bg)",
          borderRight: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <Box p="md">
          <Title order={4} mb="xs">
            Settings
          </Title>
          <TextInput
            placeholder="Search settings..."
            leftSection={
              <FontAwesomeIcon icon={faSearch} style={{ width: 14 }} />
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            mb="sm"
            size="sm"
          />
        </Box>
        <Box>
          {filteredCategories.length === 0 ? (
            <Text size="sm" c="dimmed" p="md" ta="center">
              No settings found
            </Text>
          ) : (
            filteredCategories.map((cat) => (
              <NavLink
                key={cat.id}
                label={cat.label}
                leftSection={
                  <FontAwesomeIcon icon={cat.icon} style={{ width: 16 }} />
                }
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id as SettingsCategory)}
                style={{ transition: "all 0.2s ease" }}
              />
            ))
          )}
        </Box>
      </Box>

      {/* Content Area */}
      <Box h="100%" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <ScrollArea h="100%" p="xl" scrollbarSize={8} type="auto">
          {renderContent()}
        </ScrollArea>
      </Box>
    </Group>
  );
};
