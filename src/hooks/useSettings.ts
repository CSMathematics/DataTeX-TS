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
};

export function useSettings() {
  return useSettingsStore();
}
