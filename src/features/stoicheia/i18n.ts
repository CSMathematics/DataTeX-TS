import { EL_SETTINGS_PAGE_TRANSLATION, EL_UI_TRANSLATION } from './i18n/el';
import { FR_SETTINGS_PAGE_TRANSLATION, FR_UI_TRANSLATION } from './i18n/fr';
import { DE_SETTINGS_PAGE_TRANSLATION, DE_UI_TRANSLATION } from './i18n/de';
import { ES_SETTINGS_PAGE_TRANSLATION, ES_UI_TRANSLATION } from './i18n/es';
import { IT_SETTINGS_PAGE_TRANSLATION, IT_UI_TRANSLATION } from './i18n/it';
import { RU_SETTINGS_PAGE_TRANSLATION, RU_UI_TRANSLATION } from './i18n/ru';
import { PT_SETTINGS_PAGE_TRANSLATION, PT_UI_TRANSLATION } from './i18n/pt';
import { PL_SETTINGS_PAGE_TRANSLATION, PL_UI_TRANSLATION } from './i18n/pl';
import { TR_SETTINGS_PAGE_TRANSLATION, TR_UI_TRANSLATION } from './i18n/tr';
import { NL_SETTINGS_PAGE_TRANSLATION, NL_UI_TRANSLATION } from './i18n/nl';
import { ZH_SETTINGS_PAGE_TRANSLATION, ZH_UI_TRANSLATION } from './i18n/zh';
import { JA_SETTINGS_PAGE_TRANSLATION, JA_UI_TRANSLATION } from './i18n/ja';
import { AR_SETTINGS_PAGE_TRANSLATION, AR_UI_TRANSLATION } from './i18n/ar';

export type AppLanguage = 'en' | 'el' | 'fr' | 'it' | 'de' | 'ru' | 'es' | 'pt' | 'pl' | 'tr' | 'nl' | 'zh' | 'ja' | 'ar';

export const APP_LANGUAGE_OPTIONS: Array<{
  value: AppLanguage;
  flag: string;
  nativeName: string;
  englishName: string;
}> = [
  { value: 'en', flag: '🇬🇧', nativeName: 'English', englishName: 'English' },
  { value: 'el', flag: '🇬🇷', nativeName: 'Ελληνικά', englishName: 'Greek' },
  { value: 'fr', flag: '🇫🇷', nativeName: 'Français', englishName: 'French' },
  { value: 'it', flag: '🇮🇹', nativeName: 'Italiano', englishName: 'Italian' },
  { value: 'de', flag: '🇩🇪', nativeName: 'Deutsch', englishName: 'German' },
  { value: 'ru', flag: '🇷🇺', nativeName: 'Русский', englishName: 'Russian' },
  { value: 'es', flag: '🇪🇸', nativeName: 'Español', englishName: 'Spanish' },
  { value: 'pt', flag: '🇵🇹', nativeName: 'Português', englishName: 'Portuguese' },
  { value: 'pl', flag: '🇵🇱', nativeName: 'Polski', englishName: 'Polish' },
  { value: 'tr', flag: '🇹🇷', nativeName: 'Türkçe', englishName: 'Turkish' },
  { value: 'nl', flag: '🇳🇱', nativeName: 'Nederlands', englishName: 'Dutch' },
  { value: 'zh', flag: '🇨🇳', nativeName: '简体中文', englishName: 'Simplified Chinese' },
  { value: 'ja', flag: '🇯🇵', nativeName: '日本語', englishName: 'Japanese' },
  { value: 'ar', flag: '🇸🇦', nativeName: 'العربية', englishName: 'Arabic' },
];

export const normalizeLanguage = (language: unknown): AppLanguage => {
  if (typeof language !== 'string') return 'en';
  return APP_LANGUAGE_OPTIONS.some(option => option.value === language) ? language as AppLanguage : 'en';
};

export type SettingsPageTranslation = {
  header: {
    eyebrow: string;
    title: string;
    description: string;
    back: string;
    reset: string;
  };
  tabs: Record<'general' | 'editor' | 'canvas' | 'latex' | 'export', { label: string; description: string }>;
  themeOptions: Record<'dark' | 'light', string>;
  previewOptions: Record<'instant' | 'latex', { label: string; description: string }>;
  latexCompilerOptions: Record<'lualatex' | 'pdflatex' | 'xelatex', { label: string; description: string }>;
  general: {
    appearanceTitle: string;
    appearanceDescription: string;
    theme: string;
    language: string;
    languageDescription: string;
    currentDefaultsTitle: string;
    currentDefaultsDescription: string;
    editorWidth: string;
    canvasZoom: string;
    previewMode: string;
    fast: string;
    gridSnap: string;
    gridOn: string;
    gridOff: string;
    snapOn: string;
    snapOff: string;
  };
  editor: {
    title: string;
    description: string;
    defaultWidth: string;
    defaultWidthSlider: string;
    fontSize: string;
    fontSizeSlider: string;
    minimapTitle: string;
    minimapDescription: string;
    wordWrapTitle: string;
    wordWrapDescription: string;
    lineNumbersTitle: string;
    lineNumbersDescription: string;
    autosaveTitle: string;
    autosaveDescription: string;
  };
  canvas: {
    title: string;
    description: string;
    defaultZoom: string;
    defaultZoomSlider: string;
    previewMode: string;
    showGridTitle: string;
    showGridDescription: string;
    gridStep: string;
    axesTitle: string;
    axesDescription: string;
    showAxesTitle: string;
    showAxesDescription: string;
    showAxisTicksTitle: string;
    showAxisTicksDescription: string;
    showAxisLabelsTitle: string;
    showAxisLabelsDescription: string;
    axisLineWidth: string;
    axisTickSize: string;
    axisLabelFontSize: string;
    axisLabelSpacing: string;
    snapTitle: string;
    snapDescription: string;
    snapStep: string;
  };
  latex: {
    compilerTitle: string;
    compilerDescription: string;
    compiler: string;
    pathsTitle: string;
    pathsDescription: string;
    executablePath: (compilerLabel: string) => string;
    autoDetectPlaceholder: string;
    selectExecutableTitle: (compilerLabel: string) => string;
    browse: string;
    clearPath: (compilerLabel: string) => string;
  };
  export: {
    title: string;
    description: string;
    filename: string;
    omittedExtension: string;
  };
};

export type UiTranslation = {
  appShell: {
    source: string;
    styles: string;
    live: string;
    setup: string;
    interactiveCanvas: string;
    preview: string;
    showSourceEditor: string;
    showStyleManager: string;
    hideEditorMinimap: string;
    showEditorMinimap: string;
    hideMinimap: string;
    showMinimap: string;
    resizeEditorCanvas: string;
    resizeCanvasInspector: string;
    resizeResetHint: string;
    resizeInspectorResetHint: string;
  };
  header: {
    brandSubtitle: string;
    applicationMenu: string;
    menus: Record<'file' | 'edit' | 'insert' | 'view' | 'styles' | 'help', string>;
    settings: string;
    command: string;
    file: {
      new: string;
      open: string;
      save: string;
      saveAs: string;
      exportSvg: string;
      restoreAutosave: string;
      recentFiles: string;
      clearRecentFiles: string;
      copySource: string;
      copySvg: string;
    };
    edit: {
      undo: string;
      redo: string;
      selectionTool: string;
      panTool: string;
      clearSelectedPoints: string;
      clearSelectedObject: string;
      deleteSelectedObject: string;
    };
    insert: {
      cartesianPoint: string;
      segment: string;
      line: string;
      circle: string;
      polygon: string;
      pointLabel: string;
    };
    view: {
      sourceEditor: string;
      styleManager: string;
      inspector: string;
      fastPreview: string;
      latexPreview: string;
      canvasGrid: string;
      snapToGrid: string;
    };
    styles: {
      openStyleManager: string;
      enablePointDefaults: string;
      enableLineDefaults: string;
      enableLabelDefaults: string;
      createHighlightStyle: string;
    };
    help: {
      commandPalette: string;
      keyboardShortcuts: string;
      latexTroubleshooting: string;
      tkzDocs: string;
      about: string;
      shortcutsToast: string;
      aboutToast: string;
    };
    prompts: {
      discardUnsavedChanges: string;
    };
    notifications: {
      savedTo: (path: string) => string;
      saveFailed: string;
      exportedSvgTo: (path: string) => string;
      exportedSvg: string;
      exportSvgFailed: string;
      clipboardUnavailable: string;
      copied: (label: string) => string;
      copyFailed: string;
      restored: (name: string) => string;
      sourceLabel: string;
      svgLabel: string;
    };
    status: {
      compileError: string;
      compiling: string;
      autosaveFailed: string;
      ready: string;
    };
    activeTool: (label: string) => string;
    switchPreview: (mode: string) => string;
    toggleCanvasGrid: string;
    hideCanvasGrid: string;
    showCanvasGrid: string;
    toggleSnapToGrid: string;
    disableSnapToGrid: string;
    enableSnapToGrid: string;
    openStyleManager: string;
    openSourceEditor: string;
    hideSourceEditor: string;
    showSourceEditor: string;
    switchTheme: (theme: string) => string;
    hideInspector: string;
    showInspector: string;
    toolLabels: Record<string, string>;
  };
  canvasControls: {
    instant: string;
    latex: string;
    useFastPreview: string;
    useLatexPreview: string;
    latexError: string;
    latexCompiling: string;
    latexCurrent: string;
    latexStale: string;
    pan: string;
    returnSelection: string;
    panLeftDrag: string;
    handles: string;
    hideHandles: string;
    showHandles: string;
    grid: string;
    hideGrid: string;
    showGrid: string;
    axes: string;
    hideAxes: string;
    showAxes: string;
    measure: string;
    hideMeasurements: string;
    showMeasurements: string;
    snap: string;
    disableSnap: string;
    enableSnap: string;
    labels: string;
    configureAutoLabels: string;
    autoLabels: string;
    autoLabelOptions: Record<'segments' | 'lines' | 'angles' | 'circles' | 'arcs', string>;
    zoomOut: string;
    zoomIn: string;
    zoomLevel: string;
    fitView: string;
    resetView: string;
    interactionHint: string;
  };
  commandPalette: {
    ariaLabel: string;
    placeholder: string;
    availableCommands: string;
    noMatches: string;
    active: string;
    categories: Record<'tools' | 'workspace' | 'preview' | 'canvas', string>;
    actions: Record<string, { title: string; subtitle: string; keywords: string }>;
  };
  toolbar: {
    drawingTools: string;
    recent: string;
    groupedGeometryTools: string;
    groupTools: (label: string) => string;
    groups: Record<string, string>;
    sections: Record<string, string>;
    tools: Record<string, { label: string; description: string }>;
  };
};

const EN_UI_TRANSLATION: UiTranslation = {
  appShell: {
    source: 'Source',
    styles: 'Styles',
    live: 'Live',
    setup: 'Setup',
    interactiveCanvas: 'Interactive canvas',
    preview: 'Preview',
    showSourceEditor: 'Show source editor',
    showStyleManager: 'Show style manager',
    hideEditorMinimap: 'Hide editor minimap',
    showEditorMinimap: 'Show editor minimap',
    hideMinimap: 'Hide minimap',
    showMinimap: 'Show minimap',
    resizeEditorCanvas: 'Resize source editor and canvas',
    resizeCanvasInspector: 'Resize canvas and inspector',
    resizeResetHint: 'Drag to resize · Double-click to reset',
    resizeInspectorResetHint: 'Drag to resize inspector · Double-click to reset',
  },
  header: {
    brandSubtitle: 'Euclidean workspace',
    applicationMenu: 'Application menu',
    menus: { file: 'File', edit: 'Edit', insert: 'Insert', view: 'View', styles: 'Styles', help: 'Help' },
    settings: 'Settings',
    command: 'Command',
    file: {
      new: 'New',
      open: 'Open…',
      save: 'Save',
      saveAs: 'Save as…',
      exportSvg: 'Export SVG',
      restoreAutosave: 'Restore autosave',
      recentFiles: 'Recent files',
      clearRecentFiles: 'Clear recent files',
      copySource: 'Copy source',
      copySvg: 'Copy SVG',
    },
    edit: {
      undo: 'Undo',
      redo: 'Redo',
      selectionTool: 'Selection tool',
      panTool: 'Pan tool',
      clearSelectedPoints: 'Clear selected points',
      clearSelectedObject: 'Clear selected object',
      deleteSelectedObject: 'Delete selected object',
    },
    insert: {
      cartesianPoint: 'Cartesian point',
      segment: 'Segment',
      line: 'Line',
      circle: 'Circle',
      polygon: 'Polygon',
      pointLabel: 'Point label',
    },
    view: {
      sourceEditor: 'Source editor',
      styleManager: 'Style manager',
      inspector: 'Inspector',
      fastPreview: 'Fast preview',
      latexPreview: 'LaTeX preview',
      canvasGrid: 'Canvas grid',
      snapToGrid: 'Snap to grid',
    },
    styles: {
      openStyleManager: 'Open Style Manager',
      enablePointDefaults: 'Enable point defaults',
      enableLineDefaults: 'Enable line defaults',
      enableLabelDefaults: 'Enable label defaults',
      createHighlightStyle: 'Create highlight style',
    },
    help: {
      commandPalette: 'Command palette',
      keyboardShortcuts: 'Keyboard shortcuts',
      latexTroubleshooting: 'LaTeX troubleshooting',
      tkzDocs: 'tkz-euclide docs',
      about: 'About Stoicheia',
      shortcutsToast: 'Shortcuts: Ctrl+S save · Ctrl+Z undo · Ctrl+Shift+Z redo · Esc cancel menus · Alt bypasses snap',
      aboutToast: 'Stoicheia · Euclidean workspace for tkz-euclide · Updated for tkz-euclide 5.13c',
    },
    prompts: { discardUnsavedChanges: 'Discard the unsaved changes?' },
    notifications: {
      savedTo: path => `Saved to ${path}`,
      saveFailed: 'Save failed',
      exportedSvgTo: path => `Exported SVG to ${path}`,
      exportedSvg: 'Exported SVG',
      exportSvgFailed: 'Export SVG failed',
      clipboardUnavailable: 'Clipboard unavailable',
      copied: label => `Copied ${label}`,
      copyFailed: 'Copy failed',
      restored: name => `Restored ${name}`,
      sourceLabel: 'source',
      svgLabel: 'SVG',
    },
    status: {
      compileError: 'Compile error',
      compiling: 'Compiling…',
      autosaveFailed: 'Autosave failed',
      ready: 'Ready',
    },
    activeTool: label => `Active tool: ${label}`,
    switchPreview: mode => `Switch to ${mode} preview`,
    toggleCanvasGrid: 'Toggle canvas grid',
    hideCanvasGrid: 'Hide canvas grid',
    showCanvasGrid: 'Show canvas grid',
    toggleSnapToGrid: 'Toggle snap to grid',
    disableSnapToGrid: 'Disable snap to grid',
    enableSnapToGrid: 'Enable snap to grid',
    openStyleManager: 'Open Style Manager',
    openSourceEditor: 'Open source editor',
    hideSourceEditor: 'Hide source editor',
    showSourceEditor: 'Show source editor',
    switchTheme: theme => `Switch to ${theme} theme`,
    hideInspector: 'Hide inspector',
    showInspector: 'Show inspector',
    toolLabels: { cursor: 'Cursor', pan: 'Pan' },
  },
  canvasControls: {
    instant: 'Instant',
    latex: 'LaTeX',
    useFastPreview: 'Use fast TypeScript preview',
    useLatexPreview: 'Use configured LaTeX engine preview',
    latexError: 'LaTeX error',
    latexCompiling: 'LaTeX compiling',
    latexCurrent: 'LaTeX preview is current',
    latexStale: 'LaTeX preview is stale',
    pan: 'Pan',
    returnSelection: 'Return to selection (V)',
    panLeftDrag: 'Pan with left drag (H)',
    handles: 'Handles',
    hideHandles: 'Hide point handles',
    showHandles: 'Show point handles',
    grid: 'Grid',
    hideGrid: 'Hide grid',
    showGrid: 'Show grid',
    axes: 'Axes',
    hideAxes: 'Hide axes',
    showAxes: 'Show axes',
    measure: 'Measure',
    hideMeasurements: 'Hide inline measurements',
    showMeasurements: 'Show inline measurements',
    snap: 'Snap',
    disableSnap: 'Disable smart snapping',
    enableSnap: 'Enable smart snapping',
    labels: 'Labels',
    configureAutoLabels: 'Configure automatic labels for new shapes',
    autoLabels: 'Auto labels',
    autoLabelOptions: { segments: 'Segments', lines: 'Lines', angles: 'Angles', circles: 'Circles', arcs: 'Arcs' },
    zoomOut: 'Zoom Out',
    zoomIn: 'Zoom In',
    zoomLevel: 'Zoom level',
    fitView: 'Fit drawing to view (F)',
    resetView: 'Reset view to 100% (0)',
    interactionHint: 'Wheel: zoom · Drag background: pan · Middle/right drag: pan · Shift: constrain · Alt: free move',
  },
  commandPalette: {
    ariaLabel: 'Command palette',
    placeholder: 'Search commands and tools',
    availableCommands: 'Available commands',
    noMatches: 'No matching commands',
    active: 'Active',
    categories: { tools: 'Tools', workspace: 'Workspace', preview: 'Preview', canvas: 'Canvas' },
    actions: {},
  },
  toolbar: {
    drawingTools: 'Drawing tools',
    recent: 'Recent',
    groupedGeometryTools: 'Grouped geometry tools',
    groupTools: label => `${label} tools`,
    groups: {},
    sections: {},
    tools: {},
  },
};

export const SETTINGS_PAGE_TRANSLATIONS: Record<AppLanguage, SettingsPageTranslation> = {
  en: {
    header: {
      eyebrow: 'Stoicheia preferences',
      title: 'Settings',
      description: 'Default behaviour for the editor, preview canvas, LaTeX pipeline and exports.',
      back: 'Back to workspace',
      reset: 'Reset defaults',
    },
    tabs: {
      general: { label: 'General', description: 'Theme and workspace defaults.' },
      editor: { label: 'Editor', description: 'Source editor layout and text.' },
      canvas: { label: 'Canvas', description: 'Preview, grid and snapping.' },
      latex: { label: 'LaTeX', description: 'Compiler and executable paths.' },
      export: { label: 'Export', description: 'Download naming defaults.' },
    },
    themeOptions: { dark: 'Dark', light: 'Light' },
    previewOptions: {
      instant: { label: 'Fast preview', description: 'Uses the internal parser/renderer for immediate feedback.' },
      latex: { label: 'LaTeX preview', description: 'Compiles through the selected LaTeX engine and dvisvgm for final output checks.' },
    },
    latexCompilerOptions: {
      lualatex: { label: 'LuaLaTeX', description: 'Recommended default for modern Unicode documents.' },
      pdflatex: { label: 'pdfLaTeX', description: 'Classic engine; best for older packages and ASCII-oriented documents.' },
      xelatex: { label: 'XeLaTeX', description: 'Good for system fonts and Unicode-heavy documents.' },
    },
    general: {
      appearanceTitle: 'Appearance',
      appearanceDescription: 'Theme and language used by the app chrome and panels.',
      theme: 'Theme',
      language: 'Language',
      languageDescription: 'Choose the interface language for Stoicheia.',
      currentDefaultsTitle: 'Current defaults',
      currentDefaultsDescription: 'A quick readout of the settings that shape new sessions.',
      editorWidth: 'Editor width',
      canvasZoom: 'Canvas zoom',
      previewMode: 'Preview mode',
      fast: 'Fast',
      gridSnap: 'Grid / snap',
      gridOn: 'Grid on',
      gridOff: 'Grid off',
      snapOn: 'Snap on',
      snapOff: 'Snap off',
    },
    editor: {
      title: 'Source editor',
      description: 'Monaco defaults for layout, font size and source readability.',
      defaultWidth: 'Default editor width',
      defaultWidthSlider: 'Default editor width slider',
      fontSize: 'Editor font size',
      fontSizeSlider: 'Editor font size slider',
      minimapTitle: 'Show minimap',
      minimapDescription: "Adds Monaco's right-side source overview.",
      wordWrapTitle: 'Word wrap',
      wordWrapDescription: 'Wraps long command lines inside the viewport.',
      lineNumbersTitle: 'Line numbers',
      lineNumbersDescription: 'Shows source line numbers in the gutter.',
      autosaveTitle: 'Autosave draft',
      autosaveDescription: 'Keeps a recoverable local draft.',
    },
    canvas: {
      title: 'Preview canvas',
      description: 'Defaults for the interactive preview, grid density and point snapping.',
      defaultZoom: 'Default zoom',
      defaultZoomSlider: 'Default zoom slider',
      previewMode: 'Preview mode',
      showGridTitle: 'Show canvas grid',
      showGridDescription: 'Displays the point grid behind the drawing.',
      gridStep: 'Canvas grid step',
      axesTitle: 'Axes and labels',
      axesDescription: 'Keep axes readable at every zoom level and control their screen appearance.',
      showAxesTitle: 'Show coordinate axes',
      showAxesDescription: 'Displays the horizontal and vertical axes through the origin.',
      showAxisTicksTitle: 'Show axis ticks',
      showAxisTicksDescription: 'Displays adaptive tick marks along both axes.',
      showAxisLabelsTitle: 'Show numeric labels',
      showAxisLabelsDescription: 'Displays adaptive coordinate values with a legibility halo.',
      axisLineWidth: 'Axis width (px)',
      axisTickSize: 'Tick length (px)',
      axisLabelFontSize: 'Label font size (px)',
      axisLabelSpacing: 'Minimum label spacing (px)',
      snapTitle: 'Snap to grid',
      snapDescription: 'Point creation and dragging snap unless Alt is held.',
      snapStep: 'Snap step',
    },
    latex: {
      compilerTitle: 'LaTeX compiler',
      compilerDescription: 'Compiler choice for final preview output and diagnostics.',
      compiler: 'LaTeX compiler',
      pathsTitle: 'Engine executable paths',
      pathsDescription: 'Leave a field empty to auto-detect from PATH and common TeX Live locations. Fill it when an installed AppImage cannot see your terminal PATH.',
      executablePath: compilerLabel => `${compilerLabel} executable path`,
      autoDetectPlaceholder: 'Auto-detect from PATH',
      selectExecutableTitle: compilerLabel => `Select ${compilerLabel} executable`,
      browse: 'Browse…',
      clearPath: compilerLabel => `Clear ${compilerLabel} executable path`,
    },
    export: {
      title: 'SVG export',
      description: 'Default filename used by File > Export SVG.',
      filename: 'SVG export filename',
      omittedExtension: 'If the extension is omitted, the export action adds .svg automatically.',
    },
  },
  el: EL_SETTINGS_PAGE_TRANSLATION,
  fr: FR_SETTINGS_PAGE_TRANSLATION,
  it: IT_SETTINGS_PAGE_TRANSLATION,
  de: DE_SETTINGS_PAGE_TRANSLATION,
  ru: RU_SETTINGS_PAGE_TRANSLATION,
  es: ES_SETTINGS_PAGE_TRANSLATION,
  pt: PT_SETTINGS_PAGE_TRANSLATION,
  pl: PL_SETTINGS_PAGE_TRANSLATION,
  tr: TR_SETTINGS_PAGE_TRANSLATION,
  nl: NL_SETTINGS_PAGE_TRANSLATION,
  zh: ZH_SETTINGS_PAGE_TRANSLATION,
  ja: JA_SETTINGS_PAGE_TRANSLATION,
  ar: AR_SETTINGS_PAGE_TRANSLATION,
};

export const UI_TRANSLATIONS: Partial<Record<AppLanguage, UiTranslation>> = {
  en: EN_UI_TRANSLATION,
  el: EL_UI_TRANSLATION,
  fr: FR_UI_TRANSLATION,
  it: IT_UI_TRANSLATION,
  de: DE_UI_TRANSLATION,
  ru: RU_UI_TRANSLATION,
  es: ES_UI_TRANSLATION,
  pt: PT_UI_TRANSLATION,
  pl: PL_UI_TRANSLATION,
  tr: TR_UI_TRANSLATION,
  nl: NL_UI_TRANSLATION,
  zh: ZH_UI_TRANSLATION,
  ja: JA_UI_TRANSLATION,
  ar: AR_UI_TRANSLATION,
};

export const getSettingsPageTranslation = (language: AppLanguage) => SETTINGS_PAGE_TRANSLATIONS[language] ?? SETTINGS_PAGE_TRANSLATIONS.en;
export const getUiTranslation = (language: AppLanguage) => UI_TRANSLATIONS[language] ?? EN_UI_TRANSLATION;
