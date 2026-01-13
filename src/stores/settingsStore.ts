import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export interface TexEngineSettings {
  defaultEngine: "pdflatex" | "xelatex" | "lualatex";
  pdflatexPath: string;
  xelatexPath: string;
  lualatexPath: string;
  outputDirectory: string;
  shellEscape: boolean;
  synctex: boolean;
  bibtex: boolean;
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
  texEngine: TexEngineSettings;
  database: DatabaseSettings;
  accessibility: AccessibilitySettings;
  general: GeneralSettings;
  uiTheme: string; // Theme ID (e.g. 'dark-blue', 'light-gray')
  customThemeOverrides?: CustomThemeOverrides;
  customThemes?: CustomTheme[];
  shortcuts: Record<string, string>;
}

export const DEFAULT_SETTINGS: AppSettings = {
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
  texEngine: {
    defaultEngine: "pdflatex",
    pdflatexPath: "pdflatex",
    xelatexPath: "xelatex",
    lualatexPath: "lualatex",
    outputDirectory: "build",
    shellEscape: false,
    synctex: true,
    bibtex: false,
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
  shortcuts: {
    "file.save": "Ctrl+S",
    "file.saveAll": "Ctrl+Shift+S",
    "file.closeTab": "Ctrl+W",
    "view.toggleSidebar": "Ctrl+B",
    "view.openSettings": "Ctrl+,",
    "tools.packageBrowser": "Ctrl+Shift+P",
    "file.newTemplate": "Ctrl+Shift+N",
    "editor.find": "Ctrl+F",
    "editor.replace": "Ctrl+H",
    "compilation.build": "F5",
  },
};

interface SettingsState {
  settings: AppSettings;
  updateEditorSetting: <K extends keyof EditorSettings>(
    key: K,
    value: EditorSettings[K]
  ) => void;
  updateEditorBehaviorSetting: <K extends keyof EditorBehaviorSettings>(
    key: K,
    value: EditorBehaviorSettings[K]
  ) => void;
  updatePdfViewerSetting: <K extends keyof PdfViewerSettings>(
    key: K,
    value: PdfViewerSettings[K]
  ) => void;
  updateCompilationSetting: <K extends keyof CompilationSettings>(
    key: K,
    value: CompilationSettings[K]
  ) => void;
  updateTexEngineSetting: <K extends keyof TexEngineSettings>(
    key: K,
    value: TexEngineSettings[K]
  ) => void;
  updateDatabaseSetting: <K extends keyof DatabaseSettings>(
    key: K,
    value: DatabaseSettings[K]
  ) => void;
  updateAccessibilitySetting: <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => void;
  updateGeneralSetting: <K extends keyof GeneralSettings>(
    key: K,
    value: GeneralSettings[K]
  ) => void;
  setUiTheme: (theme: string) => void;
  updateCustomThemeOverride: (
    overrides: CustomThemeOverrides | undefined
  ) => void;
  addCustomTheme: (theme: CustomTheme) => void;
  removeCustomTheme: (id: string) => void;
  updateShortcut: (id: string, keys: string) => void;
  resetShortcuts: () => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,

      // Actions
      updateEditorSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            editor: { ...state.settings.editor, [key]: value },
          },
        })),

      updateEditorBehaviorSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            editorBehavior: { ...state.settings.editorBehavior, [key]: value },
          },
        })),

      updatePdfViewerSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            pdfViewer: { ...state.settings.pdfViewer, [key]: value },
          },
        })),

      updateCompilationSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            compilation: { ...state.settings.compilation, [key]: value },
          },
        })),

      updateTexEngineSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            texEngine: { ...state.settings.texEngine, [key]: value },
          },
        })),

      updateDatabaseSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            database: { ...state.settings.database, [key]: value },
          },
        })),

      updateAccessibilitySetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            accessibility: { ...state.settings.accessibility, [key]: value },
          },
        })),

      updateGeneralSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            general: { ...state.settings.general, [key]: value },
          },
        })),

      setUiTheme: (theme) =>
        set((state) => ({
          settings: { ...state.settings, uiTheme: theme },
        })),

      updateCustomThemeOverride: (overrides) =>
        set((state) => ({
          settings: { ...state.settings, customThemeOverrides: overrides },
        })),

      addCustomTheme: (theme) =>
        set((state) => ({
          settings: {
            ...state.settings,
            customThemes: [...(state.settings.customThemes || []), theme],
          },
        })),

      removeCustomTheme: (id) =>
        set((state) => ({
          settings: {
            ...state.settings,
            customThemes: (state.settings.customThemes || []).filter(
              (t) => t.id !== id
            ),
          },
        })),

      updateShortcut: (id, keys) =>
        set((state) => ({
          settings: {
            ...state.settings,
            shortcuts: { ...state.settings.shortcuts, [id]: keys },
          },
        })),

      resetShortcuts: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            shortcuts: DEFAULT_SETTINGS.shortcuts,
          },
        })),

      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: "app-settings-store", // unique name
      // Custom merge to handle migrations if needed
      merge: (persistedState: any, currentState) => {
        // Simple merge for now, but we could add logic here similar to the old useSettings
        if (!persistedState || !persistedState.settings) return currentState;

        // Merge partial settings
        const loadedSettings = persistedState.settings as AppSettings;

        // Ensure new fields (like shortcuts) are present
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...loadedSettings,
          shortcuts: {
            ...DEFAULT_SETTINGS.shortcuts,
            ...(loadedSettings.shortcuts || {}),
          },
        };

        return {
          ...currentState,
          settings: mergedSettings,
        };
      },
    }
  )
);
