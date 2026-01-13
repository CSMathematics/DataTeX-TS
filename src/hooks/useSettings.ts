import { useState, useEffect } from "react";

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  wordWrap: "on" | "off";
  minimap: boolean;
  lineNumbers: "on" | "off" | "relative";
  theme: string; // Monaco theme name
}

export interface EditorBehaviorSettings {
  tabSize: number;
  insertSpaces: boolean;
  autoCloseBrackets: boolean;
  autoCloseLatexEnv: boolean;
  formatOnSave: boolean;
  suggestOnTrigger: boolean;
  quickSuggestions: boolean;
  scrollBeyondLastLine: boolean;
  cursorStyle: "line" | "block" | "underline";
  cursorBlinking: "blink" | "smooth" | "phase" | "expand" | "solid";
}

export interface PdfViewerSettings {
  defaultZoom: "fit-page" | "fit-width" | "actual" | number;
  autoRefresh: boolean;
  splitViewMode: "horizontal" | "vertical" | "auto";
  showByDefault: boolean;
  syncTexHighlight: boolean;
  scrollSync: boolean;
}

export interface CompilationSettings {
  compileOnSave: boolean;
  buildDirectory: "source" | "build" | "output" | "custom";
  customBuildPath: string;
  cleanAuxFiles: boolean;
  maxErrors: number;
  showLogOnError: boolean;
  timeout: number;
}

export interface DatabaseSettings {
  defaultView: "table" | "graph" | "list";
  showMetadataPanel: boolean;
  autoDetectPreambles: boolean;
  tablePageSize: number;
  graphPhysics: boolean;
  graphAnimation: boolean;
  showFilePreview: boolean;
}

export interface AccessibilitySettings {
  highContrastMode: boolean;
  fontLigatures: boolean;
  letterSpacing: number;
  lineHeight: number;
  renderWhitespace: "none" | "boundary" | "selection" | "all";
  smoothScrolling: boolean;
  animationSpeed: "slow" | "normal" | "fast" | "none";
  reduceMotion: boolean;
}

export interface GeneralSettings {
  language: string;
  autoSave: boolean;
  startupBehavior: "restore" | "welcome" | "empty";
  confirmOnExit: boolean;
}

export interface CustomThemeOverrides {
  appBg?: string;
  sidebarBg?: string;
  headerBg?: string;
  statusBarBg?: string;
  panelBg?: string;
  primaryColor?: string;
  accentColor?: string;
  borderColor?: string;
}

export interface CustomTheme {
  id: string;
  label: string;
  baseThemeId: string; // The theme this was based on
  overrides: CustomThemeOverrides;
}

export interface AppSettings {
  editor: EditorSettings;
  editorBehavior: EditorBehaviorSettings;
  pdfViewer: PdfViewerSettings;
  compilation: CompilationSettings;
  database: DatabaseSettings;
  accessibility: AccessibilitySettings;
  general: GeneralSettings;
  uiTheme: string; // Theme ID (e.g. 'dark-blue', 'light-gray')
  customThemeOverrides?: CustomThemeOverrides;
  customThemes?: CustomTheme[];
}

const DEFAULT_SETTINGS: AppSettings = {
  editor: {
    fontSize: 14,
    fontFamily: "Consolas, monospace",
    wordWrap: "on",
    minimap: true,
    lineNumbers: "on",
    theme: "data-tex-dark",
  },
  editorBehavior: {
    tabSize: 4,
    insertSpaces: true,
    autoCloseBrackets: true,
    autoCloseLatexEnv: true,
    formatOnSave: false,
    suggestOnTrigger: true,
    quickSuggestions: true,
    scrollBeyondLastLine: true,
    cursorStyle: "line",
    cursorBlinking: "blink",
  },
  pdfViewer: {
    defaultZoom: "fit-width",
    autoRefresh: true,
    splitViewMode: "horizontal",
    showByDefault: true,
    syncTexHighlight: true,
    scrollSync: false,
  },
  compilation: {
    compileOnSave: false,
    buildDirectory: "source",
    customBuildPath: "",
    cleanAuxFiles: true,
    maxErrors: 50,
    showLogOnError: true,
    timeout: 60,
  },
  database: {
    defaultView: "table",
    showMetadataPanel: true,
    autoDetectPreambles: true,
    tablePageSize: 20,
    graphPhysics: true,
    graphAnimation: true,
    showFilePreview: true,
  },
  accessibility: {
    highContrastMode: false,
    fontLigatures: true,
    letterSpacing: 0,
    lineHeight: 1.5,
    renderWhitespace: "none",
    smoothScrolling: true,
    animationSpeed: "normal",
    reduceMotion: false,
  },
  general: {
    language: "en",
    autoSave: false,
    startupBehavior: "restore",
    confirmOnExit: true,
  },
  uiTheme: "dark-blue",
  customThemeOverrides: {},
  customThemes: [],
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem("app-settings");
    if (saved) {
      try {
        // Merge saved settings with defaults to handle new fields
        const parsed = JSON.parse(saved);

        // Migration Logic
        let uiTheme = parsed.uiTheme;
        if (uiTheme === "dark") uiTheme = "dark-blue";
        if (uiTheme === "light") uiTheme = "light-blue";
        if (uiTheme === "auto") uiTheme = "dark-blue"; // Default 'auto' to dark-blue for now
        if (!uiTheme) uiTheme = DEFAULT_SETTINGS.uiTheme;

        return {
          editor: { ...DEFAULT_SETTINGS.editor, ...parsed.editor },
          editorBehavior: {
            ...DEFAULT_SETTINGS.editorBehavior,
            ...parsed.editorBehavior,
          },
          pdfViewer: { ...DEFAULT_SETTINGS.pdfViewer, ...parsed.pdfViewer },
          compilation: {
            ...DEFAULT_SETTINGS.compilation,
            ...parsed.compilation,
          },
          database: { ...DEFAULT_SETTINGS.database, ...parsed.database },
          accessibility: {
            ...DEFAULT_SETTINGS.accessibility,
            ...parsed.accessibility,
          },
          general: { ...DEFAULT_SETTINGS.general, ...parsed.general },
          uiTheme: uiTheme,
          customThemeOverrides: parsed.customThemeOverrides || {},
          customThemes: parsed.customThemes || [],
        };
      } catch (e) {
        console.error("Failed to parse settings", e);
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem("app-settings", JSON.stringify(settings));
  }, [settings]);

  const updateEditorSetting = <K extends keyof EditorSettings>(
    key: K,
    value: EditorSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      editor: { ...prev.editor, [key]: value },
    }));
  };

  const updateGeneralSetting = <K extends keyof GeneralSettings>(
    key: K,
    value: GeneralSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      general: { ...prev.general, [key]: value },
    }));
  };

  const updateEditorBehaviorSetting = <K extends keyof EditorBehaviorSettings>(
    key: K,
    value: EditorBehaviorSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      editorBehavior: { ...prev.editorBehavior, [key]: value },
    }));
  };

  const updatePdfViewerSetting = <K extends keyof PdfViewerSettings>(
    key: K,
    value: PdfViewerSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      pdfViewer: { ...prev.pdfViewer, [key]: value },
    }));
  };

  const updateCompilationSetting = <K extends keyof CompilationSettings>(
    key: K,
    value: CompilationSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      compilation: { ...prev.compilation, [key]: value },
    }));
  };

  const updateDatabaseSetting = <K extends keyof DatabaseSettings>(
    key: K,
    value: DatabaseSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      database: { ...prev.database, [key]: value },
    }));
  };

  const updateAccessibilitySetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      accessibility: { ...prev.accessibility, [key]: value },
    }));
  };

  const setUiTheme = (theme: string) => {
    setSettings((prev) => ({ ...prev, uiTheme: theme }));
  };

  const updateCustomThemeOverride = (
    overrides: CustomThemeOverrides | undefined
  ) => {
    setSettings((prev) => ({ ...prev, customThemeOverrides: overrides }));
  };

  const addCustomTheme = (theme: CustomTheme) => {
    setSettings((prev) => ({
      ...prev,
      customThemes: [...(prev.customThemes || []), theme],
    }));
  };

  const removeCustomTheme = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      customThemes: (prev.customThemes || []).filter((t) => t.id !== id),
    }));
  };

  return {
    settings,
    updateEditorSetting,
    updateEditorBehaviorSetting,
    updatePdfViewerSetting,
    updateCompilationSetting,
    updateDatabaseSetting,
    updateAccessibilitySetting,
    updateGeneralSetting,
    setUiTheme,
    updateCustomThemeOverride,
    addCustomTheme,
    removeCustomTheme,
    resetSettings: () => setSettings(DEFAULT_SETTINGS),
  };
}
