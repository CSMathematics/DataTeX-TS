import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APP_SETTINGS, SETTINGS_STORAGE_KEY, useEditorStore } from '../store';
import { SettingsPage } from './SettingsPage';

const installLocalStorageMock = () => {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
};

const resetStoreSettings = () => {
  useEditorStore.setState({
    settings: { ...DEFAULT_APP_SETTINGS },
    theme: DEFAULT_APP_SETTINGS.theme,
    showEditorMinimap: DEFAULT_APP_SETTINGS.showEditorMinimap,
    previewMode: DEFAULT_APP_SETTINGS.previewMode,
    showGrid: DEFAULT_APP_SETTINGS.showGrid,
    showAxes: DEFAULT_APP_SETTINGS.showAxes,
    showMeasurements: DEFAULT_APP_SETTINGS.showMeasurements,
    snapToGrid: DEFAULT_APP_SETTINGS.snapToGrid,
    zoomLevel: DEFAULT_APP_SETTINGS.defaultZoom,
  });
};

describe('SettingsPage', () => {
  beforeEach(() => {
    installLocalStorageMock();
    window.localStorage.clear();
    resetStoreSettings();
  });

  it('updates app settings and synchronized runtime state', () => {
    render(<SettingsPage onBack={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'light' } });
    expect(screen.getByRole('option', { name: /🇬🇷 Ελληνικά/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /🇫🇷 Français/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /🇮🇹 Italiano/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /🇩🇪 Deutsch/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /🇷🇺 Русский/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /🇪🇸 Español/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Source editor layout/ }));
    fireEvent.change(screen.getByLabelText('Default editor width'), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Editor font size'), { target: { value: '16' } });
    fireEvent.click(screen.getByLabelText('Show minimap'));
    fireEvent.click(screen.getByLabelText('Word wrap'));
    fireEvent.click(screen.getByLabelText('Line numbers'));
    fireEvent.click(screen.getByLabelText('Autosave draft'));

    fireEvent.click(screen.getByRole('button', { name: /Preview, grid and snapping/ }));
    fireEvent.change(screen.getByLabelText('Default zoom'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Preview mode'), { target: { value: 'latex' } });
    fireEvent.click(screen.getByLabelText('Show canvas grid'));
    fireEvent.change(screen.getByLabelText('Canvas grid step'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByLabelText('Snap to grid'));
    fireEvent.change(screen.getByLabelText('Snap step'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Axis width (px)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Tick length (px)'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Label font size (px)'), { target: { value: '16' } });
    fireEvent.change(screen.getByLabelText('Minimum label spacing (px)'), { target: { value: '72' } });
    fireEvent.click(screen.getByLabelText('Show axis ticks'));
    fireEvent.click(screen.getByLabelText('Show numeric labels'));
    fireEvent.click(screen.getByLabelText('Show coordinate axes'));

    fireEvent.click(screen.getByRole('button', { name: /Compiler and executable paths/ }));
    fireEvent.change(screen.getByLabelText('LaTeX compiler'), { target: { value: 'xelatex' } });
    fireEvent.change(screen.getByLabelText('XeLaTeX executable path'), { target: { value: '/opt/texlive/bin/xelatex' } });

    fireEvent.click(screen.getByRole('button', { name: /Download naming defaults/ }));
    fireEvent.change(screen.getByLabelText('SVG export filename'), { target: { value: 'triangle-proof' } });

    fireEvent.click(screen.getByRole('button', { name: /Theme and workspace defaults/ }));
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'es' } });
    expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument();

    const state = useEditorStore.getState();
    expect(state.settings).toMatchObject({
      theme: 'light',
      language: 'es',
      editorWidthRatio: 0.6,
      defaultZoom: 2,
      showEditorMinimap: true,
      editorFontSize: 16,
      editorWordWrap: false,
      editorLineNumbers: false,
      autoSaveDraft: false,
      previewMode: 'latex',
      latexCompiler: 'xelatex',
      latexEnginePaths: { ...DEFAULT_APP_SETTINGS.latexEnginePaths, xelatex: '/opt/texlive/bin/xelatex' },
      showGrid: false,
      showAxes: false,
      showAxisTicks: false,
      showAxisLabels: false,
      axisLineWidth: 2,
      axisTickSize: 8,
      axisLabelFontSize: 16,
      axisLabelSpacing: 72,
      showMeasurements: true,
      snapToGrid: false,
      canvasGridStep: 0.5,
      snapStep: 2,
      exportSvgFilename: 'triangle-proof',
    });
    expect(state.theme).toBe('light');
    expect(state.zoomLevel).toBe(2);
    expect(state.showEditorMinimap).toBe(true);
    expect(state.previewMode).toBe('latex');
    expect(state.settings.latexCompiler).toBe('xelatex');
    expect(state.settings.latexEnginePaths.xelatex).toBe('/opt/texlive/bin/xelatex');
    expect(state.showGrid).toBe(false);
    expect(state.showAxes).toBe(false);
    expect(state.showMeasurements).toBe(true);
    expect(state.snapToGrid).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject(state.settings);
  });

  it('resets settings back to release defaults', () => {
    useEditorStore.getState().updateSettings({
      theme: 'light',
      language: 'fr',
      defaultZoom: 2.5,
      editorWidthRatio: 0.7,
      showEditorMinimap: true,
      editorFontSize: 18,
      editorWordWrap: false,
      editorLineNumbers: false,
      autoSaveDraft: false,
      previewMode: 'latex',
      latexCompiler: 'pdflatex',
      latexEnginePaths: { ...DEFAULT_APP_SETTINGS.latexEnginePaths, pdflatex: 'C:/texlive/bin/pdflatex.exe' },
      showGrid: false,
      showAxes: false,
      showAxisTicks: false,
      showAxisLabels: false,
      axisLineWidth: 3,
      axisTickSize: 10,
      axisLabelFontSize: 20,
      axisLabelSpacing: 100,
      showMeasurements: false,
      snapToGrid: false,
      canvasGridStep: 2,
      snapStep: 0.5,
      exportSvgFilename: 'draft.svg',
    });

    render(<SettingsPage onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /réinitialiser/i }));

    const state = useEditorStore.getState();
    expect(state.settings).toEqual(DEFAULT_APP_SETTINGS);
    expect(state.theme).toBe(DEFAULT_APP_SETTINGS.theme);
    expect(state.zoomLevel).toBe(DEFAULT_APP_SETTINGS.defaultZoom);
    expect(state.showEditorMinimap).toBe(DEFAULT_APP_SETTINGS.showEditorMinimap);
    expect(state.previewMode).toBe(DEFAULT_APP_SETTINGS.previewMode);
    expect(state.showGrid).toBe(DEFAULT_APP_SETTINGS.showGrid);
    expect(state.showAxes).toBe(DEFAULT_APP_SETTINGS.showAxes);
    expect(state.showMeasurements).toBe(DEFAULT_APP_SETTINGS.showMeasurements);
    expect(state.snapToGrid).toBe(DEFAULT_APP_SETTINGS.snapToGrid);
  });

  it('delegates host-owned settings and resets only Stoicheia preferences when embedded', () => {
    const hostPaths = {
      lualatex: '/host/lualatex',
      pdflatex: '/host/pdflatex',
      xelatex: '/host/xelatex',
    };
    useEditorStore.getState().updateSettings({
      theme: 'light',
      language: 'el',
      autoSaveDraft: false,
      latexCompiler: 'xelatex',
      latexEnginePaths: hostPaths,
      defaultZoom: 2.5,
      showGrid: false,
      exportSvgFilename: 'custom.svg',
    });

    render(
      <SettingsPage
        mode="embedded"
        hostLanguage="en"
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Theme')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Compiler and executable paths/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Source editor layout/ }));
    expect(screen.queryByRole('checkbox', { name: /Autosave draft/ })).not.toBeInTheDocument();
    expect(screen.getByText('This setting is managed centrally by DataTeX.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reset defaults/ }));
    const state = useEditorStore.getState();
    expect(state.settings).toMatchObject({
      theme: 'light',
      language: 'el',
      autoSaveDraft: false,
      latexCompiler: 'xelatex',
      latexEnginePaths: hostPaths,
      defaultZoom: DEFAULT_APP_SETTINGS.defaultZoom,
      showGrid: DEFAULT_APP_SETTINGS.showGrid,
      exportSvgFilename: DEFAULT_APP_SETTINGS.exportSvgFilename,
    });
  });
});
