import { useSettingsStore } from "../stores/settingsStore";
import type {
  AppSettings,
  EditorSettings,
  EditorBehaviorSettings,
  PdfViewerSettings,
  CompilationSettings,
  DatabaseSettings,
  AccessibilitySettings,
  GeneralSettings,
  CustomThemeOverrides,
  CustomTheme,
  TexEngineSettings,
  LatexEditorThemeId,
  LatexSyntaxColorSlotId,
  LatexSyntaxFontStyle,
  LatexSyntaxHighlightingSettings,
  LatexSyntaxSlotOverride,
  LatexSyntaxSlotOverrides,
} from "../stores/settingsStore";

// Re-export types for compatibility
export type {
  AppSettings,
  EditorSettings,
  EditorBehaviorSettings,
  PdfViewerSettings,
  CompilationSettings,
  DatabaseSettings,
  AccessibilitySettings,
  GeneralSettings,
  CustomThemeOverrides,
  CustomTheme,
  TexEngineSettings,
  LatexEditorThemeId,
  LatexSyntaxColorSlotId,
  LatexSyntaxFontStyle,
  LatexSyntaxHighlightingSettings,
  LatexSyntaxSlotOverride,
  LatexSyntaxSlotOverrides,
};

export function useSettings() {
  return useSettingsStore();
}
