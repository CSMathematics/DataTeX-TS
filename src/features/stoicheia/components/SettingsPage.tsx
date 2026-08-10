import { useState } from 'react';
import { ArrowLeft, Code2, Crosshair, Download, FileCode2, FolderOpen, Grid3x3, Monitor, Palette, RotateCcw, X } from 'lucide-react';
import { open as showTauriOpenDialog } from '@tauri-apps/plugin-dialog';
import { useShallow } from 'zustand/react/shallow';
import { APP_LANGUAGE_OPTIONS, getSettingsPageTranslation, type AppLanguage } from '../i18n';
import { type AppSettings, type LatexCompiler, useEditorStore } from '../store';

interface SettingsPageProps {
  onBack: () => void;
  mode?: 'standalone' | 'embedded';
  hostLanguage?: AppLanguage;
  onOpenHostSettings?: () => void;
}

const settingsTabItems = [
  { id: 'general', Icon: Palette },
  { id: 'editor', Icon: Code2 },
  { id: 'canvas', Icon: Grid3x3 },
  { id: 'latex', Icon: FileCode2 },
  { id: 'export', Icon: Download },
] as const;

type SettingsTab = typeof settingsTabItems[number]['id'];

const checkboxClassName = 'mt-0.5 h-4 w-4 accent-indigo-500';
const optionBoxClassName = 'flex items-start gap-3 rounded-lg border theme-border bg-[var(--surface)] p-3 text-sm';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export function SettingsPage({
  onBack,
  mode = 'standalone',
  hostLanguage,
  onOpenHostSettings,
}: SettingsPageProps) {
  const embedded = mode === 'embedded';
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { settings, updateSettings, resetSettings } = useEditorStore(useShallow(state => ({
    settings: state.settings,
    updateSettings: state.updateSettings,
    resetSettings: state.resetSettings,
  })));

  const editorWidthPercent = Math.round(settings.editorWidthRatio * 100);
  const defaultZoomPercent = Math.round(settings.defaultZoom * 100);
  const language = embedded && hostLanguage ? hostLanguage : settings.language;
  const t = getSettingsPageTranslation(language);
  const themeOptions: Array<{ value: AppSettings['theme']; label: string }> = [
    { value: 'dark', label: t.themeOptions.dark },
    { value: 'light', label: t.themeOptions.light },
  ];
  const previewOptions: Array<{ value: AppSettings['previewMode']; label: string; description: string }> = [
    { value: 'instant', ...t.previewOptions.instant },
    { value: 'latex', ...t.previewOptions.latex },
  ];
  const latexCompilerOptions: Array<{ value: AppSettings['latexCompiler']; label: string; description: string }> = [
    { value: 'lualatex', ...t.latexCompilerOptions.lualatex },
    { value: 'pdflatex', ...t.latexCompilerOptions.pdflatex },
    { value: 'xelatex', ...t.latexCompilerOptions.xelatex },
  ];
  const settingsTabs = settingsTabItems
    .filter(tab => !embedded || tab.id !== 'latex')
    .map(tab => ({ ...tab, ...t.tabs[tab.id] }));
  const managedByDataTex =
    language === 'el'
      ? 'Η ρύθμιση διαχειρίζεται κεντρικά από το DataTeX.'
      : 'This setting is managed centrally by DataTeX.';
  const resetPreferences = () => {
    if (!embedded) {
      resetSettings();
      return;
    }

    const hostOwnedSettings = {
      theme: settings.theme,
      language: settings.language,
      autoSaveDraft: settings.autoSaveDraft,
      latexCompiler: settings.latexCompiler,
      latexEnginePaths: settings.latexEnginePaths,
    };
    resetSettings();
    useEditorStore.getState().updateSettings(hostOwnedSettings);
  };

  const updateEditorWidth = (value: string) => updateSettings({ editorWidthRatio: Number(value) / 100 });
  const updateDefaultZoom = (value: string) => updateSettings({ defaultZoom: Number(value) / 100 });
  const updateLatexEnginePath = (compiler: LatexCompiler, path: string) => updateSettings({
    latexEnginePaths: { ...settings.latexEnginePaths, [compiler]: path },
  });
  const browseLatexEnginePath = async (compiler: LatexCompiler) => {
    try {
      const selected = await showTauriOpenDialog({
        title: t.latex.selectExecutableTitle(latexCompilerOptions.find(option => option.value === compiler)?.label ?? compiler),
        multiple: false,
        directory: false,
      });
      if (typeof selected === 'string') updateLatexEnginePath(compiler, selected);
    } catch (error) {
      console.warn('Could not open compiler path dialog', error);
    }
  };

  return (
    <section className="theme-panel settings-page flex-1 overflow-y-auto">
      <div className="settings-shell mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="theme-muted text-[10px] font-bold uppercase tracking-[0.18em]">{t.header.eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t.header.title}</h1>
            <p className="theme-muted mt-1 text-sm">{t.header.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center gap-2 rounded-lg border theme-border px-3 text-xs font-semibold hover:bg-[var(--hover)]"
            >
              <ArrowLeft size={15} />
              {t.header.back}
            </button>
            <button
              type="button"
              onClick={resetPreferences}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-500 hover:bg-amber-500/15"
            >
              <RotateCcw size={15} />
              {t.header.reset}
            </button>
          </div>
        </header>

        <div className="settings-layout grid gap-4 lg:grid-cols-[15rem_1fr]">
          <nav aria-label={t.header.title} className="settings-tab-list">
            {settingsTabs.map(tab => {
              const Icon = tab.Icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  data-active={isActive}
                  className="settings-tab-button"
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="settings-tab-icon"><Icon size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{tab.label}</span>
                    <span className="settings-tab-description">{tab.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {activeTab === 'general' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="property-card space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="settings-section-icon text-blue-500"><Palette size={19} /></span>
                    <div>
                      <h2 className="text-sm font-semibold">{t.general.appearanceTitle}</h2>
                      <p className="theme-muted text-xs">{t.general.appearanceDescription}</p>
                    </div>
                  </div>
                  {embedded ? (
                    <div className="rounded-lg border theme-border bg-[var(--surface)] p-3">
                      <p className="text-sm font-semibold">DataTeX</p>
                      <p className="theme-muted mt-1 text-xs">{managedByDataTex}</p>
                      {onOpenHostSettings && (
                        <button
                          type="button"
                          className="mt-3 inline-flex h-8 items-center rounded-lg border theme-border px-3 text-xs font-semibold hover:bg-[var(--hover)]"
                          onClick={onOpenHostSettings}
                        >
                          {language === 'el' ? 'Άνοιγμα ρυθμίσεων DataTeX' : 'Open DataTeX settings'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <label className="property-field-label">
                        {t.general.theme}
                        <select
                          aria-label={t.general.theme}
                          className="property-input"
                          value={settings.theme}
                          onChange={event => updateSettings({ theme: event.target.value as AppSettings['theme'] })}
                        >
                          {themeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="property-field-label">
                        {t.general.language}
                        <select
                          aria-label={t.general.language}
                          className="property-input"
                          value={settings.language}
                          onChange={event => updateSettings({ language: event.target.value as AppLanguage })}
                        >
                          {APP_LANGUAGE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.flag} {option.nativeName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="theme-muted text-xs">{t.general.languageDescription}</p>
                    </>
                  )}
                </section>

                <section className="property-card space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="settings-section-icon text-emerald-500"><Monitor size={19} /></span>
                    <div>
                      <h2 className="text-sm font-semibold">{t.general.currentDefaultsTitle}</h2>
                      <p className="theme-muted text-xs">{t.general.currentDefaultsDescription}</p>
                    </div>
                  </div>
                  <div className="settings-readout-grid">
                    <span>{t.general.editorWidth}</span><strong>{editorWidthPercent}%</strong>
                    <span>{t.general.canvasZoom}</span><strong>{formatPercent(settings.defaultZoom)}</strong>
                    <span>{t.general.previewMode}</span><strong>{settings.previewMode === 'instant' ? t.general.fast : 'LaTeX'}</strong>
                    <span>{t.general.gridSnap}</span><strong>{settings.showGrid ? t.general.gridOn : t.general.gridOff}, {settings.snapToGrid ? t.general.snapOn : t.general.snapOff}</strong>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'editor' && (
              <section className="property-card space-y-5">
                <div className="flex items-center gap-3">
                  <span className="settings-section-icon text-cyan-500"><Code2 size={19} /></span>
                  <div>
                    <h2 className="text-sm font-semibold">{t.editor.title}</h2>
                    <p className="theme-muted text-xs">{t.editor.description}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_6rem] sm:items-end">
                      <label className="property-field-label">
                        {t.editor.defaultWidth}
                        <input
                          aria-label={t.editor.defaultWidth}
                          type="number"
                          min={30}
                          max={75}
                          step={1}
                          className="property-input"
                          value={editorWidthPercent}
                          onChange={event => updateEditorWidth(event.target.value)}
                        />
                      </label>
                      <span className="theme-muted pb-2 text-xs font-semibold">{editorWidthPercent}%</span>
                    </div>
                    <input
                      aria-label={t.editor.defaultWidthSlider}
                      type="range"
                      min={30}
                      max={75}
                      step={1}
                      value={editorWidthPercent}
                      onChange={event => updateEditorWidth(event.target.value)}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_6rem] sm:items-end">
                      <label className="property-field-label">
                        {t.editor.fontSize}
                        <input
                          aria-label={t.editor.fontSize}
                          type="number"
                          min={10}
                          max={22}
                          step={1}
                          className="property-input"
                          value={settings.editorFontSize}
                          onChange={event => updateSettings({ editorFontSize: Number(event.target.value) })}
                        />
                      </label>
                      <span className="theme-muted pb-2 text-xs font-semibold">{settings.editorFontSize}px</span>
                    </div>
                    <input
                      aria-label={t.editor.fontSizeSlider}
                      type="range"
                      min={10}
                      max={22}
                      step={1}
                      value={settings.editorFontSize}
                      onChange={event => updateSettings({ editorFontSize: Number(event.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <label className={optionBoxClassName}>
                    <input
                      aria-label={t.editor.minimapTitle}
                      type="checkbox"
                      checked={settings.showEditorMinimap}
                      onChange={event => updateSettings({ showEditorMinimap: event.target.checked })}
                      className={checkboxClassName}
                    />
                    <span>
                      <span className="block font-semibold">{t.editor.minimapTitle}</span>
                      <span className="theme-muted block text-xs">{t.editor.minimapDescription}</span>
                    </span>
                  </label>
                  <label className={optionBoxClassName}>
                    <input
                      aria-label={t.editor.wordWrapTitle}
                      type="checkbox"
                      checked={settings.editorWordWrap}
                      onChange={event => updateSettings({ editorWordWrap: event.target.checked })}
                      className={checkboxClassName}
                    />
                    <span>
                      <span className="block font-semibold">{t.editor.wordWrapTitle}</span>
                      <span className="theme-muted block text-xs">{t.editor.wordWrapDescription}</span>
                    </span>
                  </label>
                  <label className={optionBoxClassName}>
                    <input
                      aria-label={t.editor.lineNumbersTitle}
                      type="checkbox"
                      checked={settings.editorLineNumbers}
                      onChange={event => updateSettings({ editorLineNumbers: event.target.checked })}
                      className={checkboxClassName}
                    />
                    <span>
                      <span className="block font-semibold">{t.editor.lineNumbersTitle}</span>
                      <span className="theme-muted block text-xs">{t.editor.lineNumbersDescription}</span>
                    </span>
                  </label>
                  {embedded ? (
                    <div className={optionBoxClassName}>
                      <Monitor size={16} className="mt-0.5 shrink-0 text-blue-500" />
                      <span>
                        <span className="block font-semibold">{t.editor.autosaveTitle}</span>
                        <span className="theme-muted block text-xs">{managedByDataTex}</span>
                      </span>
                    </div>
                  ) : (
                    <label className={optionBoxClassName}>
                      <input
                        aria-label={t.editor.autosaveTitle}
                        type="checkbox"
                        checked={settings.autoSaveDraft}
                        onChange={event => updateSettings({ autoSaveDraft: event.target.checked })}
                        className={checkboxClassName}
                      />
                      <span>
                        <span className="block font-semibold">{t.editor.autosaveTitle}</span>
                        <span className="theme-muted block text-xs">{t.editor.autosaveDescription}</span>
                      </span>
                    </label>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'canvas' && (
              <section className="property-card space-y-5">
                <div className="flex items-center gap-3">
                  <span className="settings-section-icon text-emerald-500"><Grid3x3 size={19} /></span>
                  <div>
                    <h2 className="text-sm font-semibold">{t.canvas.title}</h2>
                    <p className="theme-muted text-xs">{t.canvas.description}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_6rem] sm:items-end">
                      <label className="property-field-label">
                        {t.canvas.defaultZoom}
                        <input
                          aria-label={t.canvas.defaultZoom}
                          type="number"
                          min={10}
                          max={500}
                          step={5}
                          className="property-input"
                          value={defaultZoomPercent}
                          onChange={event => updateDefaultZoom(event.target.value)}
                        />
                      </label>
                      <span className="theme-muted pb-2 text-xs font-semibold">{defaultZoomPercent}%</span>
                    </div>
                    <input
                      aria-label={t.canvas.defaultZoomSlider}
                      type="range"
                      min={10}
                      max={500}
                      step={5}
                      value={defaultZoomPercent}
                      onChange={event => updateDefaultZoom(event.target.value)}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="property-field-label">
                      {t.canvas.previewMode}
                      <select
                        aria-label={t.canvas.previewMode}
                        className="property-input"
                        value={settings.previewMode}
                        onChange={event => updateSettings({ previewMode: event.target.value as AppSettings['previewMode'] })}
                      >
                        {previewOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <p className="theme-muted text-xs">
                      {previewOptions.find(option => option.value === settings.previewMode)?.description}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-3">
                    <label className={optionBoxClassName}>
                      <input
                        aria-label={t.canvas.showGridTitle}
                        type="checkbox"
                        checked={settings.showGrid}
                        onChange={event => updateSettings({ showGrid: event.target.checked })}
                        className={checkboxClassName}
                      />
                      <span>
                        <span className="block font-semibold">{t.canvas.showGridTitle}</span>
                        <span className="theme-muted block text-xs">{t.canvas.showGridDescription}</span>
                      </span>
                    </label>
                    <label className="property-field-label">
                      {t.canvas.gridStep}
                      <input
                        aria-label={t.canvas.gridStep}
                        type="number"
                        min={0.25}
                        max={5}
                        step={0.25}
                        className="property-input"
                        value={settings.canvasGridStep}
                        onChange={event => updateSettings({ canvasGridStep: Number(event.target.value) })}
                      />
                    </label>
                  </div>

                  <div className="space-y-3">
                    <label className={optionBoxClassName}>
                      <input
                        aria-label={t.canvas.snapTitle}
                        type="checkbox"
                        checked={settings.snapToGrid}
                        onChange={event => updateSettings({ snapToGrid: event.target.checked })}
                        className={checkboxClassName}
                      />
                      <span>
                        <span className="block font-semibold">{t.canvas.snapTitle}</span>
                        <span className="theme-muted block text-xs">{t.canvas.snapDescription}</span>
                      </span>
                    </label>
                    <label className="property-field-label">
                      {t.canvas.snapStep}
                      <input
                        aria-label={t.canvas.snapStep}
                        type="number"
                        min={0.25}
                        max={5}
                        step={0.25}
                        className="property-input"
                        value={settings.snapStep}
                        onChange={event => updateSettings({ snapStep: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-4 border-t theme-border pt-5">
                  <div className="flex items-center gap-3">
                    <span className="settings-section-icon text-blue-500"><Crosshair size={18} /></span>
                    <div>
                      <h3 className="text-sm font-semibold">{t.canvas.axesTitle}</h3>
                      <p className="theme-muted text-xs">{t.canvas.axesDescription}</p>
                    </div>
                  </div>

                  <label className={optionBoxClassName}>
                    <input
                      aria-label={t.canvas.showAxesTitle}
                      type="checkbox"
                      checked={settings.showAxes}
                      onChange={event => updateSettings({ showAxes: event.target.checked })}
                      className={checkboxClassName}
                    />
                    <span>
                      <span className="block font-semibold">{t.canvas.showAxesTitle}</span>
                      <span className="theme-muted block text-xs">{t.canvas.showAxesDescription}</span>
                    </span>
                  </label>

                  <div className={`grid gap-3 lg:grid-cols-2 ${settings.showAxes ? '' : 'opacity-50'}`}>
                    <label className={optionBoxClassName}>
                      <input
                        aria-label={t.canvas.showAxisTicksTitle}
                        type="checkbox"
                        disabled={!settings.showAxes}
                        checked={settings.showAxisTicks}
                        onChange={event => updateSettings({ showAxisTicks: event.target.checked })}
                        className={checkboxClassName}
                      />
                      <span>
                        <span className="block font-semibold">{t.canvas.showAxisTicksTitle}</span>
                        <span className="theme-muted block text-xs">{t.canvas.showAxisTicksDescription}</span>
                      </span>
                    </label>
                    <label className={optionBoxClassName}>
                      <input
                        aria-label={t.canvas.showAxisLabelsTitle}
                        type="checkbox"
                        disabled={!settings.showAxes}
                        checked={settings.showAxisLabels}
                        onChange={event => updateSettings({ showAxisLabels: event.target.checked })}
                        className={checkboxClassName}
                      />
                      <span>
                        <span className="block font-semibold">{t.canvas.showAxisLabelsTitle}</span>
                        <span className="theme-muted block text-xs">{t.canvas.showAxisLabelsDescription}</span>
                      </span>
                    </label>
                  </div>

                  <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${settings.showAxes ? '' : 'opacity-50'}`}>
                    <label className="property-field-label">
                      {t.canvas.axisLineWidth}
                      <input
                        aria-label={t.canvas.axisLineWidth}
                        type="number"
                        min={0.5}
                        max={4}
                        step={0.25}
                        disabled={!settings.showAxes}
                        className="property-input"
                        value={settings.axisLineWidth}
                        onChange={event => updateSettings({ axisLineWidth: Number(event.target.value) })}
                      />
                    </label>
                    <label className="property-field-label">
                      {t.canvas.axisTickSize}
                      <input
                        aria-label={t.canvas.axisTickSize}
                        type="number"
                        min={2}
                        max={12}
                        step={1}
                        disabled={!settings.showAxes || !settings.showAxisTicks}
                        className="property-input"
                        value={settings.axisTickSize}
                        onChange={event => updateSettings({ axisTickSize: Number(event.target.value) })}
                      />
                    </label>
                    <label className="property-field-label">
                      {t.canvas.axisLabelFontSize}
                      <input
                        aria-label={t.canvas.axisLabelFontSize}
                        type="number"
                        min={9}
                        max={24}
                        step={1}
                        disabled={!settings.showAxes || !settings.showAxisLabels}
                        className="property-input"
                        value={settings.axisLabelFontSize}
                        onChange={event => updateSettings({ axisLabelFontSize: Number(event.target.value) })}
                      />
                    </label>
                    <label className="property-field-label">
                      {t.canvas.axisLabelSpacing}
                      <input
                        aria-label={t.canvas.axisLabelSpacing}
                        type="number"
                        min={32}
                        max={160}
                        step={4}
                        disabled={!settings.showAxes || (!settings.showAxisTicks && !settings.showAxisLabels)}
                        className="property-input"
                        value={settings.axisLabelSpacing}
                        onChange={event => updateSettings({ axisLabelSpacing: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                </div>
              </section>
            )}

            {!embedded && activeTab === 'latex' && (
              <div className="grid gap-4">
                <section className="property-card space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="settings-section-icon text-violet-500"><FileCode2 size={19} /></span>
                    <div>
                      <h2 className="text-sm font-semibold">{t.latex.compilerTitle}</h2>
                      <p className="theme-muted text-xs">{t.latex.compilerDescription}</p>
                    </div>
                  </div>
                  <label className="property-field-label">
                    {t.latex.compiler}
                    <select
                      aria-label={t.latex.compiler}
                      className="property-input"
                      value={settings.latexCompiler}
                      onChange={event => updateSettings({ latexCompiler: event.target.value as AppSettings['latexCompiler'] })}
                    >
                      {latexCompilerOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <p className="theme-muted text-xs">
                    {latexCompilerOptions.find(option => option.value === settings.latexCompiler)?.description}
                  </p>
                </section>

                <section className="property-card space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold">{t.latex.pathsTitle}</h2>
                    <p className="theme-muted mt-1 text-xs">{t.latex.pathsDescription}</p>
                  </div>
                  <div className="grid gap-3">
                    {latexCompilerOptions.map(option => (
                      <div key={option.value} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                        <label className="property-field-label min-w-0">
                          {t.latex.executablePath(option.label)}
                          <input
                            aria-label={t.latex.executablePath(option.label)}
                            className="property-input font-mono"
                            placeholder={t.latex.autoDetectPlaceholder}
                            value={settings.latexEnginePaths[option.value]}
                            onChange={event => updateLatexEnginePath(option.value, event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void browseLatexEnginePath(option.value)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border theme-border px-2 text-xs font-semibold hover:bg-[var(--hover)]"
                        >
                          <FolderOpen size={13} />
                          {t.latex.browse}
                        </button>
                        <button
                          type="button"
                          aria-label={t.latex.clearPath(option.label)}
                          onClick={() => updateLatexEnginePath(option.value, '')}
                          disabled={!settings.latexEnginePaths[option.value]}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border theme-border text-xs font-semibold hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'export' && (
              <section className="property-card space-y-4">
                <div className="flex items-center gap-3">
                  <span className="settings-section-icon text-rose-500"><Download size={19} /></span>
                  <div>
                    <h2 className="text-sm font-semibold">{t.export.title}</h2>
                    <p className="theme-muted text-xs">{t.export.description}</p>
                  </div>
                </div>
                <label className="property-field-label">
                  {t.export.filename}
                  <input
                    aria-label={t.export.filename}
                    className="property-input"
                    value={settings.exportSvgFilename}
                    placeholder="stoicheia.svg"
                    onChange={event => updateSettings({ exportSvgFilename: event.target.value })}
                  />
                </label>
                <p className="theme-muted text-xs">{t.export.omittedExtension}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
