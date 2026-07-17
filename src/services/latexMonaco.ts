import {
  latexConfiguration,
  latexLanguage,
  setupLatexProviders,
} from "../languages/latex";
import { dataTexHCTheme } from "../themes/monaco-hc";
import { dataTexLightTheme } from "../themes/monaco-light";
import { monokaiTheme } from "../themes/monaco-monokai";
import { nordTheme } from "../themes/monaco-nord";
import { dataTexDarkTheme } from "../themes/monaco-theme";
import {
  buildLatexTheme,
  LATEX_EDITOR_THEME_IDS,
  LATEX_SYNTAX_FONT_STYLES,
  LATEX_SYNTAX_COLOR_SLOTS,
  sanitizeLatexSyntaxThemeOverrides,
  type LatexEditorThemeId,
  type LatexSyntaxSlotOverrides,
  type LatexSyntaxThemeOverrides,
} from "../themes/latex-theme-customization";

export const LATEX_LANGUAGE_ID = "my-latex";

const configuredInstances = new Set<any>();
let activeThemeOverrides: LatexSyntaxThemeOverrides = {};

const defaultThemes = {
  "data-tex-dark": dataTexDarkTheme,
  "data-tex-light": dataTexLightTheme,
  "data-tex-hc": dataTexHCTheme,
  "data-tex-monokai": monokaiTheme,
  "data-tex-nord": nordTheme,
} satisfies Record<LatexEditorThemeId, unknown>;

function defineLatexThemes(
  monaco: any,
  overrides: LatexSyntaxThemeOverrides,
): void {
  for (const themeId of LATEX_EDITOR_THEME_IDS) {
    const themeOverrides = overrides[themeId];
    monaco.editor.defineTheme(
      themeId,
      themeOverrides
        ? buildLatexTheme(themeId, themeOverrides)
        : defaultThemes[themeId],
    );
  }
}

function overridesAreEqual(
  left: LatexSyntaxSlotOverrides | undefined,
  right: LatexSyntaxSlotOverrides | undefined,
): boolean {
  for (const { id } of LATEX_SYNTAX_COLOR_SLOTS) {
    const leftSlot = left?.[id];
    const rightSlot = right?.[id];
    if (leftSlot?.foreground !== rightSlot?.foreground) return false;
    for (const style of LATEX_SYNTAX_FONT_STYLES) {
      if (leftSlot?.fontStyles?.[style] !== rightSlot?.fontStyles?.[style]) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Register the DataTeX LaTeX grammar and every matching Monaco theme.
 *
 * Multiple editor surfaces can mount in any order (main editor, preview,
 * diff, wizard). Keeping this idempotent prevents duplicate providers while
 * ensuring a secondary editor can never fall back to Monaco's basic LaTeX
 * grammar merely because it mounted first.
 */
export function configureLatexMonaco(monaco: any): void {
  if (configuredInstances.has(monaco)) return;

  // Theme definition is idempotent and intentionally independent from the
  // language guard. A language registered by another surface must not prevent
  // the DataTeX themes from being available.
  defineLatexThemes(monaco, activeThemeOverrides);

  if (
    !monaco.languages
      .getLanguages()
      .some((language: { id: string }) => language.id === LATEX_LANGUAGE_ID)
  ) {
    monaco.languages.register({ id: LATEX_LANGUAGE_ID });
  }

  monaco.languages.setMonarchTokensProvider(LATEX_LANGUAGE_ID, latexLanguage);
  monaco.languages.setLanguageConfiguration(
    LATEX_LANGUAGE_ID,
    latexConfiguration,
  );
  setupLatexProviders(monaco);
  configuredInstances.add(monaco);
}

/**
 * Apply persisted semantic colors and typography to every configured Monaco
 * instance.
 *
 * Only themes whose overrides actually changed are redefined. Monaco emits a
 * color-theme change when the currently active theme is redefined under the
 * same name, so open editors repaint immediately without setTheme, model
 * recreation or a React remount.
 */
export function applyLatexSyntaxThemeOverrides(
  themes: LatexSyntaxThemeOverrides,
): void {
  const sanitized = sanitizeLatexSyntaxThemeOverrides(themes);
  const changedThemeIds = LATEX_EDITOR_THEME_IDS.filter(
    (themeId) =>
      !overridesAreEqual(
        activeThemeOverrides[themeId],
        sanitized[themeId],
      ),
  );

  activeThemeOverrides = sanitized;
  if (changedThemeIds.length === 0) return;

  for (const monaco of configuredInstances) {
    for (const themeId of changedThemeIds) {
      monaco.editor.defineTheme(
        themeId,
        buildLatexTheme(themeId, sanitized[themeId]),
      );
    }
  }
}
