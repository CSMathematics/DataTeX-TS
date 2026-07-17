import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Group,
  NavLink,
  Title,
  ScrollArea,
  TextInput,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
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
  faHighlighter,
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
import { SyntaxHighlightingSettings } from "./SyntaxHighlightingSettings";
import {
  AppSettings,
  EditorSettings as IEditorSettings,
  EditorBehaviorSettings as IEditorBehaviorSettings,
  PdfViewerSettings as IPdfViewerSettings,
  CompilationSettings as ICompilationSettings,
  TexEngineSettings as ITexEngineSettings,
  DatabaseSettings as IDatabaseSettings,
  AccessibilitySettings as IAccessibilitySettings,
  GeneralSettings as IGeneralSettings,
  CustomThemeOverrides,
  CustomTheme,
} from "../../hooks/useSettings";
import type {
  LatexEditorThemeId,
  LatexSyntaxColorSlotId,
  LatexSyntaxFontStyle,
} from "../../themes/latex-theme-customization";

type SettingsCategory =
  | "general"
  | "tex"
  | "compilation"
  | "editor"
  | "syntaxColors"
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
  onUpdateTexEngine: <K extends keyof ITexEngineSettings>(
    key: K,
    value: ITexEngineSettings[K]
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
  onUpdateCustomThemeOverride: (
    overrides: CustomThemeOverrides | undefined
  ) => void;
  onAddCustomTheme: (theme: CustomTheme) => void;
  onRemoveCustomTheme: (id: string) => void;
  onSetLatexSyntaxColor: (
    themeId: LatexEditorThemeId,
    slotId: LatexSyntaxColorSlotId,
    color: string
  ) => void;
  onResetLatexSyntaxColor: (
    themeId: LatexEditorThemeId,
    slotId: LatexSyntaxColorSlotId
  ) => void;
  onSetLatexSyntaxFontStyle: (
    themeId: LatexEditorThemeId,
    slotId: LatexSyntaxColorSlotId,
    fontStyle: LatexSyntaxFontStyle,
    enabled: boolean
  ) => void;
  onResetLatexSyntaxFontStyles: (
    themeId: LatexEditorThemeId,
    slotId: LatexSyntaxColorSlotId
  ) => void;
  onResetLatexSyntaxColorGroup: (
    themeId: LatexEditorThemeId,
    slotIds: readonly LatexSyntaxColorSlotId[]
  ) => void;
  onResetLatexSyntaxTheme: (themeId: LatexEditorThemeId) => void;
  onResetAllLatexSyntaxColors: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  initialCategory = "general",
  settings,
  onUpdateEditor,
  onUpdateEditorBehavior,
  onUpdatePdfViewer,
  onUpdateCompilation,
  onUpdateTexEngine,
  onUpdateDatabase,
  onUpdateAccessibility,
  onUpdateGeneral,
  onUpdateUi,
  onUpdateCustomThemeOverride,
  onAddCustomTheme,
  onRemoveCustomTheme,
  onSetLatexSyntaxColor,
  onResetLatexSyntaxColor,
  onSetLatexSyntaxFontStyle,
  onResetLatexSyntaxFontStyles,
  onResetLatexSyntaxColorGroup,
  onResetLatexSyntaxTheme,
  onResetAllLatexSyntaxColors,
}) => {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const isNarrow = useMediaQuery("(max-width: 760px)");

  // Define categories with metadata for search
  const categories = useMemo(
    () =>
      [
        {
          id: "general",
          label: t("settings.categories.general"),
          icon: faCog,
          keywords: "startup exit language autosave",
        },
        {
          id: "tex",
          label: t("settings.categories.tex"),
          icon: faTerminal,
          keywords: "latex compiler pdflatex xelatex lualatex bibtex",
        },
        {
          id: "compilation",
          label: t("settings.categories.compilation"),
          icon: faHammer,
          keywords: "build compile error log timeout clean aux",
        },
        {
          id: "editor",
          label: t("settings.categories.editor"),
          icon: faCode,
          keywords: "font size theme minimap line numbers wordwrap",
        },
        {
          id: "syntaxColors",
          label: t("settings.categories.syntaxColors"),
          icon: faHighlighter,
          keywords:
            "latex syntax highlighting colors commands environments math operators variables brackets palette monaco",
        },
        {
          id: "editorBehavior",
          label: t("settings.categories.editorBehavior"),
          icon: faKeyboard,
          keywords: "tab indent autocomplete brackets cursor formatting",
        },
        {
          id: "pdfViewer",
          label: t("settings.categories.pdfViewer"),
          icon: faFilePdf,
          keywords: "zoom pdf split view synctex scroll",
        },
        {
          id: "database",
          label: t("settings.categories.database"),
          icon: faDatabase,
          keywords: "table graph view metadata preamble",
        },
        {
          id: "accessibility",
          label: t("settings.categories.accessibility"),
          icon: faUniversalAccess,
          keywords: "contrast motion animation spacing ligatures whitespace",
        },
        {
          id: "shortcuts",
          label: t("settings.categories.shortcuts"),
          icon: faKeyboard,
          keywords: "hotkeys keybindings shortcuts commands",
        },
        {
          id: "theme",
          label: t("settings.categories.theme"),
          icon: faPalette,
          keywords: "color ui dark light theme appearance",
        },
      ] as const,
    [t]
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
        return (
          <TexEngineSettings
            settings={settings.texEngine}
            onUpdate={onUpdateTexEngine}
          />
        );
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
      case "syntaxColors":
        return (
          <SyntaxHighlightingSettings
            settings={settings.latexSyntaxHighlighting}
            activeEditorTheme={settings.editor.theme}
            onSetLatexSyntaxColor={onSetLatexSyntaxColor}
            onResetLatexSyntaxColor={onResetLatexSyntaxColor}
            onSetLatexSyntaxFontStyle={onSetLatexSyntaxFontStyle}
            onResetLatexSyntaxFontStyles={onResetLatexSyntaxFontStyles}
            onResetLatexSyntaxColorGroup={onResetLatexSyntaxColorGroup}
            onResetLatexSyntaxTheme={onResetLatexSyntaxTheme}
            onResetAllLatexSyntaxColors={onResetAllLatexSyntaxColors}
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
            onUpdateUi={onUpdateUi}
            onUpdateCustomThemeOverride={onUpdateCustomThemeOverride}
            onAddCustomTheme={onAddCustomTheme}
            onRemoveCustomTheme={onRemoveCustomTheme}
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
    <Box
      h="100%"
      style={{
        display: "flex",
        flexDirection: isNarrow ? "column" : "row",
        overflow: "hidden",
      }}
    >
      {/* Settings Sidebar */}
      <Box
        w={isNarrow ? "100%" : 250}
        style={{
          flex: "0 0 auto",
          display: "flex",
          flexDirection: "column",
          height: isNarrow ? "auto" : "100%",
          minHeight: 0,
          overflow: "hidden",
          backgroundColor: "var(--app-sidebar-bg)",
          borderRight: isNarrow
            ? undefined
            : "1px solid var(--mantine-color-default-border)",
          borderBottom: isNarrow
            ? "1px solid var(--mantine-color-default-border)"
            : undefined,
        }}
      >
        <Box p={isNarrow ? "sm" : "md"}>
          <Title order={4} mb={isNarrow ? 6 : "xs"}>
            {t("settings.title")}
          </Title>
          <TextInput
            placeholder={t("settings.searchPlaceholder")}
            leftSection={
              <FontAwesomeIcon icon={faSearch} style={{ width: 14 }} />
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            mb={isNarrow ? 0 : "sm"}
            size="sm"
          />
        </Box>
        <Box
          style={{
            flex: isNarrow ? "0 0 auto" : "1 1 auto",
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {filteredCategories.length === 0 ? (
            <Text size="sm" c="dimmed" p="md" ta="center">
              {t("settings.noSettingsFound")}
            </Text>
          ) : (
            <ScrollArea
              h={isNarrow ? undefined : "100%"}
              type="auto"
              scrollbarSize={5}
              styles={{ viewport: { paddingBottom: isNarrow ? 6 : 0 } }}
            >
              <Group
                gap={isNarrow ? 6 : 0}
                wrap="nowrap"
                px={isNarrow ? "sm" : 0}
                style={{
                  flexDirection: isNarrow ? "row" : "column",
                  alignItems: "stretch",
                }}
              >
                {filteredCategories.map((cat) => (
                  <NavLink
                    key={cat.id}
                    label={cat.label}
                    leftSection={
                      <FontAwesomeIcon icon={cat.icon} style={{ width: 16 }} />
                    }
                    active={activeCategory === cat.id}
                    onClick={() =>
                      setActiveCategory(cat.id as SettingsCategory)
                    }
                    style={{
                      flex: "0 0 auto",
                      width: isNarrow ? "max-content" : "100%",
                      borderRadius: isNarrow ? "var(--mantine-radius-sm)" : 0,
                      transition: "background-color 120ms ease",
                    }}
                  />
                ))}
              </Group>
            </ScrollArea>
          )}
        </Box>
      </Box>

      {/* Content Area */}
      <Box h="100%" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <ScrollArea
          h="100%"
          p={isNarrow ? "md" : "xl"}
          scrollbarSize={8}
          type="auto"
        >
          {renderContent()}
        </ScrollArea>
      </Box>
    </Box>
  );
};
