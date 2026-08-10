import { Preview } from "./components/Preview";
import { Toolbar } from "./components/Toolbar";
import { ObjectTree } from "./components/ObjectTree";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { ConstructionHistory } from "./components/ConstructionHistory";
import { StyleManager } from "./components/StyleManager";
import { CanvasControls } from "./components/CanvasControls";
import { AppHeader } from "./components/AppHeader";
import { StatusBar } from "./components/StatusBar";
import { Braces, Eye, Map as MapIcon, Palette } from "lucide-react";
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDocumentPipeline } from "./hooks/useDocumentPipeline";
import { useAutosaveDraft } from "./hooks/useAutosaveDraft";
import { clampEditorWidth as clampWidth, getEditorResizeBounds } from "./layout/editorResize";
import { clampInspectorWidth as clampInspector, getInspectorResizeBounds } from "./layout/inspectorResize";
import {
  useEditorStore,
  SETTINGS_STORAGE_KEY,
  type LatexCompiler,
  type LatexEnginePaths,
} from "./store";
import { applyAppTheme, type AppTheme } from "./theme";
import { getUiTranslation, type AppLanguage } from "./i18n";
import { isStoicheiaInteractionTarget } from "./bridge/focusScope";
import { loadStoicheiaCodeEditor } from "./bridge/loadCodeEditor";

const MemoStyleManager = memo(StyleManager);
const MemoPreview = memo(Preview);
const MemoToolbar = memo(Toolbar);
const MemoObjectTree = memo(ObjectTree);
const MemoPropertiesPanel = memo(PropertiesPanel);
const MemoConstructionHistory = memo(ConstructionHistory);
const MemoCanvasControls = memo(CanvasControls);
const MemoStatusBar = memo(StatusBar);
const LazyCodeEditor = lazy(loadStoicheiaCodeEditor);
const LazySettingsPage = lazy(() => import("./components/SettingsPage").then(module => ({ default: module.SettingsPage })));
const LazyCommandPalette = lazy(() => import("./components/CommandPalette").then(module => ({ default: module.CommandPalette })));

const LazyPanelFallback = () => (
  <div className="theme-app flex min-h-0 flex-1 items-center justify-center" aria-busy="true" />
);

const LazyEditorFallback = () => (
  <div className="theme-editor h-full w-full" aria-busy="true" />
);

type IdleSchedulerWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type AppPage = "workspace" | "settings";

export type StoicheiaAppProps =
  | { mode?: "standalone" }
  | {
      mode: "embedded";
      theme: AppTheme;
      language: AppLanguage;
      latexCompiler: LatexCompiler;
      latexEnginePaths: LatexEnginePaths;
      dvisvgmPath?: string;
      onBack: () => void;
      onRequestApply?: (source: string) => void;
      onRequestSave?: (source: string) => void;
      onRequestSaveAs?: (source: string) => void;
      onRequestExportSvg?: (
        svgSource: string,
        suggestedFileName: string,
      ) => void;
      applyActionLabel?: string;
      copySourceMode?: "document" | "tikzpicture";
      onOpenHostSettings?: () => void;
    };

function App(props: StoicheiaAppProps = { mode: "standalone" }) {
  const embeddedHost = props.mode === "embedded" ? props : null;
  const isEmbedded = embeddedHost !== null;
  useDocumentPipeline(
    embeddedHost
      ? {
          latexCompiler: embeddedHost.latexCompiler,
          latexEnginePaths: embeddedHost.latexEnginePaths,
          dvisvgmPath: embeddedHost.dvisvgmPath ?? '',
        }
      : undefined,
  );
  useAutosaveDraft("autosave.tex", !isEmbedded);
  const [showEditor, setShowEditor] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [sourcePanelMode, setSourcePanelMode] = useState<'source' | 'styles'>('source');
  const [activePage, setActivePage] = useState<AppPage>("workspace");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [editorPreloaded, setEditorPreloaded] = useState(false);
  const [editorWidth, setEditorWidth] = useState<number | null>(null);
  const [inspectorWidth, setInspectorWidth] = useState<number | null>(null);
  const [mainWidth, setMainWidth] = useState(0);
  const [canvasRowWidth, setCanvasRowWidth] = useState(0);
  const storeTheme = useEditorStore(state => state.theme);
  const showEditorMinimap = useEditorStore(state => state.showEditorMinimap);
  const setShowEditorMinimap = useEditorStore(state => state.setShowEditorMinimap);
  const editorWidthRatio = useEditorStore(state => state.settings.editorWidthRatio);
  const storeLanguage = useEditorStore(state => state.settings.language);
  const theme = embeddedHost?.theme ?? storeTheme;
  const language = embeddedHost?.language ?? storeLanguage;
  const t = getUiTranslation(language).appShell;
  const appRootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const canvasRowRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const inspectorDragCleanupRef = useRef<(() => void) | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const inspectorResizeFrameRef = useRef<number | null>(null);
  const pendingEditorWidthRef = useRef<number | null>(null);
  const pendingInspectorWidthRef = useRef<number | null>(null);
  const bodyInteractionStyleRef = useRef<{
    cursor: string;
    userSelect: string;
  } | null>(null);
  const hostSettingsSnapshotRef = useRef<{
    theme: AppTheme;
    language: AppLanguage;
    latexCompiler: LatexCompiler;
    latexEnginePaths: LatexEnginePaths;
  } | null>(null);

  useLayoutEffect(() => {
    if (!isEmbedded) return;
    const state = useEditorStore.getState();
    hostSettingsSnapshotRef.current = {
      theme: state.theme,
      language: state.settings.language,
      latexCompiler: state.settings.latexCompiler,
      latexEnginePaths: { ...state.settings.latexEnginePaths },
    };

    return () => {
      const snapshot = hostSettingsSnapshotRef.current;
      hostSettingsSnapshotRef.current = null;
      if (!snapshot) return;
      const settings = {
        ...useEditorStore.getState().settings,
        theme: snapshot.theme,
        language: snapshot.language,
        latexCompiler: snapshot.latexCompiler,
        latexEnginePaths: snapshot.latexEnginePaths,
      };
      try {
        window.localStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(settings),
        );
      } catch {
        // Runtime restoration still works when storage is unavailable.
      }
      useEditorStore.setState({
        theme: snapshot.theme,
        settings,
      });
    };
  }, [isEmbedded]);

  useLayoutEffect(() => {
    if (!embeddedHost) return;
    useEditorStore.setState(current => ({
      theme: embeddedHost.theme,
      settings: {
        ...current.settings,
        theme: embeddedHost.theme,
        language: embeddedHost.language,
        latexCompiler: embeddedHost.latexCompiler,
        latexEnginePaths: embeddedHost.latexEnginePaths,
      },
    }));
  }, [
    isEmbedded,
    language,
    embeddedHost?.latexCompiler,
    embeddedHost?.latexEnginePaths.lualatex,
    embeddedHost?.latexEnginePaths.pdflatex,
    embeddedHost?.latexEnginePaths.xelatex,
    theme,
  ]);

  const editorBounds = useCallback(() => {
    return getEditorResizeBounds(mainWidth > 0 ? mainWidth : 760, showInspector);
  }, [mainWidth, showInspector]);

  const clampEditorWidth = useCallback((width: number) => {
    const { minimum, maximum } = editorBounds();
    return clampWidth(width, { minimum, maximum });
  }, [editorBounds]);

  const currentEditorWidth = useCallback(() => (
    editorWidth ?? editorRef.current?.getBoundingClientRect().width ?? 480
  ), [editorWidth]);

  const flushEditorResize = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
    if (pendingEditorWidthRef.current !== null) {
      setEditorWidth(pendingEditorWidthRef.current);
      pendingEditorWidthRef.current = null;
    }
  }, []);

  const captureBodyInteractionStyle = useCallback(() => {
    bodyInteractionStyleRef.current ??= {
      cursor: document.body.style.cursor,
      userSelect: document.body.style.userSelect,
    };
  }, []);

  const restoreBodyInteractionStyle = useCallback(() => {
    const previous = bodyInteractionStyleRef.current;
    if (!previous) return;
    document.body.style.cursor = previous.cursor;
    document.body.style.userSelect = previous.userSelect;
    bodyInteractionStyleRef.current = null;
  }, []);

  const stopResize = useCallback(() => {
    flushEditorResize();
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    restoreBodyInteractionStyle();
  }, [flushEditorResize, restoreBodyInteractionStyle]);

  const inspectorBounds = useCallback(() => {
    return getInspectorResizeBounds(canvasRowWidth > 0 ? canvasRowWidth : 600);
  }, [canvasRowWidth]);

  const clampInspectorWidth = useCallback((width: number) => clampInspector(width, inspectorBounds()), [inspectorBounds]);

  const currentInspectorWidth = useCallback(() => (
    inspectorWidth ?? inspectorRef.current?.getBoundingClientRect().width ?? 288
  ), [inspectorWidth]);

  const flushInspectorResize = useCallback(() => {
    if (inspectorResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(inspectorResizeFrameRef.current);
      inspectorResizeFrameRef.current = null;
    }
    if (pendingInspectorWidthRef.current !== null) {
      setInspectorWidth(pendingInspectorWidthRef.current);
      pendingInspectorWidthRef.current = null;
    }
  }, []);

  const stopInspectorResize = useCallback(() => {
    flushInspectorResize();
    inspectorDragCleanupRef.current?.();
    inspectorDragCleanupRef.current = null;
    restoreBodyInteractionStyle();
  }, [flushInspectorResize, restoreBodyInteractionStyle]);

  useEffect(() => () => {
    stopResize();
    stopInspectorResize();
  }, [stopInspectorResize, stopResize]);

  useEffect(() => {
    if (!isEmbedded) applyAppTheme(theme);
  }, [isEmbedded, theme]);

  useEffect(() => {
    if (!isEmbedded) document.documentElement.lang = language;
  }, [isEmbedded, language]);

  useEffect(() => {
    setEditorWidth(null);
  }, [editorWidthRatio]);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    const idleWindow = window as IdleSchedulerWindow;

    const preload = () => {
      void loadStoicheiaCodeEditor()
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setEditorPreloaded(true);
        });
    };

    const frameId = window.requestAnimationFrame(() => {
      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(preload, { timeout: 1200 });
      } else {
        timeoutId = window.setTimeout(preload, 120);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const measureMain = () => {
      const measuredWidth = mainRef.current?.getBoundingClientRect().width ?? 0;
      if (measuredWidth <= 0) return;
      setMainWidth(current => Math.abs(current - measuredWidth) < 0.5 ? current : measuredWidth);
      const bounds = getEditorResizeBounds(measuredWidth, showInspector);
      setEditorWidth(width => width === null ? null : clampWidth(width, bounds));
    };
    measureMain();
    if (!mainRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureMain);
    observer.observe(mainRef.current);
    return () => observer.disconnect();
  }, [showInspector]);

  useEffect(() => {
    const measureCanvasRow = () => {
      const measuredWidth = canvasRowRef.current?.getBoundingClientRect().width ?? 0;
      if (measuredWidth <= 0) return;
      setCanvasRowWidth(current => Math.abs(current - measuredWidth) < 0.5 ? current : measuredWidth);
      const bounds = getInspectorResizeBounds(measuredWidth);
      setInspectorWidth(width => width === null ? null : clampInspector(width, bounds));
    };
    measureCanvasRow();
    if (!canvasRowRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureCanvasRow);
    observer.observe(canvasRowRef.current);
    return () => observer.disconnect();
  }, [activePage, showEditor, showInspector]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopResize();
    stopInspectorResize();

    const startX = event.clientX;
    const startWidth = currentEditorWidth();
    captureBodyInteractionStyle();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (moveEvent: PointerEvent) => {
      pendingEditorWidthRef.current = clampEditorWidth(startWidth + moveEvent.clientX - startX);
      if (resizeFrameRef.current === null) {
        resizeFrameRef.current = window.requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          if (pendingEditorWidthRef.current !== null) {
            setEditorWidth(pendingEditorWidthRef.current);
            pendingEditorWidthRef.current = null;
          }
        });
      }
    };
    const onUp = () => stopResize();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
    };
  };

  const startInspectorResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopResize();
    stopInspectorResize();
    const startX = event.clientX;
    const startWidth = currentInspectorWidth();
    captureBodyInteractionStyle();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (moveEvent: PointerEvent) => {
      pendingInspectorWidthRef.current = clampInspectorWidth(startWidth - (moveEvent.clientX - startX));
      if (inspectorResizeFrameRef.current === null) {
        inspectorResizeFrameRef.current = window.requestAnimationFrame(() => {
          inspectorResizeFrameRef.current = null;
          if (pendingInspectorWidthRef.current !== null) {
            setInspectorWidth(pendingInspectorWidthRef.current);
            pendingInspectorWidthRef.current = null;
          }
        });
      }
    };
    const onUp = () => stopInspectorResize();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    inspectorDragCleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
    };
  };

  const resizeWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const { minimum, maximum } = editorBounds();
    if (event.key === 'Home') setEditorWidth(minimum);
    else if (event.key === 'End') setEditorWidth(maximum);
    else setEditorWidth(clampEditorWidth(currentEditorWidth() + (event.key === 'ArrowRight' ? 20 : -20)));
  };

  const resizeInspectorWithKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const { minimum, maximum } = inspectorBounds();
    if (event.key === 'Home') setInspectorWidth(minimum);
    else if (event.key === 'End') setInspectorWidth(maximum);
    else setInspectorWidth(clampInspectorWidth(currentInspectorWidth() + (event.key === 'ArrowLeft' ? 20 : -20)));
  };

  const resizeBounds = editorBounds();
  const displayedEditorWidth = editorWidth ?? clampWidth(mainWidth * editorWidthRatio, resizeBounds);
  const inspectorResizeBounds = inspectorBounds();
  const displayedInspectorWidth = inspectorWidth ?? clampInspector(288, inspectorResizeBounds);
  const openSourcePanel = useCallback(() => {
    setActivePage("workspace");
    setShowEditor(true);
    setSourcePanelMode("source");
  }, []);
  const openStylesPanel = useCallback(() => {
    setActivePage("workspace");
    setShowEditor(true);
    setSourcePanelMode("styles");
  }, []);
  const openWorkspace = useCallback(() => {
    setActivePage("workspace");
  }, []);
  const openSettings = useCallback(() => {
    setActivePage("settings");
  }, []);
  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);
  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);
  const toggleEditor = useCallback(() => {
    setShowEditor(value => !value);
  }, []);
  const toggleInspector = useCallback(() => {
    setShowInspector(value => !value);
  }, []);

  useEffect(() => {
    const handleCommandShortcuts = (event: KeyboardEvent) => {
      if (
        isEmbedded &&
        !isStoicheiaInteractionTarget(event.target, appRootRef.current)
      ) {
        return;
      }
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      if (event.key.toLowerCase() === 'k' || (event.shiftKey && event.key.toLowerCase() === 'p')) {
        event.preventDefault();
        setCommandPaletteOpen(open => !open);
      } else if (event.key === ',') {
        event.preventDefault();
        setCommandPaletteOpen(false);
        openSettings();
      }
    };
    window.addEventListener('keydown', handleCommandShortcuts);
    return () => window.removeEventListener('keydown', handleCommandShortcuts);
  }, [isEmbedded, openSettings]);

  return (
    <div
      ref={appRootRef}
      className={`${isEmbedded ? "" : "stoicheia-scope"} theme-app app-shell flex min-h-0 min-w-0 flex-col overflow-hidden ${
        isEmbedded ? "h-full w-full" : "h-screen w-screen"
      }`}
      data-theme={theme}
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <AppHeader
        mode={isEmbedded ? "embedded" : "standalone"}
        shortcutScopeRoot={appRootRef}
        onRequestApply={embeddedHost?.onRequestApply}
        onRequestSave={embeddedHost?.onRequestSave}
        onRequestSaveAs={embeddedHost?.onRequestSaveAs}
        onRequestExportSvg={embeddedHost?.onRequestExportSvg}
        applyActionLabel={embeddedHost?.applyActionLabel}
        copySourceMode={embeddedHost?.copySourceMode}
        showEditor={showEditor}
        showInspector={showInspector}
        sourcePanelMode={sourcePanelMode}
        activePage={activePage}
        onOpenSettings={openSettings}
        onOpenSource={openSourcePanel}
        onOpenStyles={openStylesPanel}
        onOpenCommandPalette={openCommandPalette}
        onToggleEditor={toggleEditor}
        onToggleInspector={toggleInspector}
      />

      <main ref={mainRef} className="theme-app workspace-main flex-1 min-h-0 flex overflow-hidden">
        {activePage === "settings" ? (
          <Suspense fallback={<LazyPanelFallback />}>
            <LazySettingsPage
              mode={isEmbedded ? "embedded" : "standalone"}
              hostLanguage={isEmbedded ? language : undefined}
              onBack={() => setActivePage("workspace")}
              onOpenHostSettings={embeddedHost?.onOpenHostSettings}
            />
          </Suspense>
        ) : (
          <>
        {showEditor && (
          <section
            ref={editorRef}
            className="theme-editor source-panel shrink-0 flex flex-col"
            style={{
              width: `${displayedEditorWidth}px`,
              minWidth: `${resizeBounds.minimum}px`,
              maxWidth: `${resizeBounds.maximum}px`,
            }}
          >
            <div className="panel-titlebar panel-titlebar-dark source-titlebar">
              <div className="panel-title-left">
                <span className="panel-title-icon">{sourcePanelMode === 'source' ? <Braces size={14} /> : <Palette size={14} />}</span>
                <div className="source-mode-tabs flex items-center rounded-lg p-0.5">
                  <button type="button" aria-label={t.showSourceEditor} onClick={() => setSourcePanelMode('source')} className={`source-mode-tab h-6 rounded-md px-2 text-xs font-semibold ${sourcePanelMode === 'source' ? 'source-mode-tab-active' : ''}`}>
                    {t.source}
                  </button>
                  <button type="button" aria-label={t.showStyleManager} onClick={() => setSourcePanelMode('styles')} className={`source-mode-tab h-6 rounded-md px-2 text-xs font-semibold ${sourcePanelMode === 'styles' ? 'source-mode-tab-active' : ''}`}>
                    {t.styles}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {sourcePanelMode === 'source' && (
                  <button
                    type="button"
                    aria-label={showEditorMinimap ? t.hideEditorMinimap : t.showEditorMinimap}
                    title={showEditorMinimap ? t.hideMinimap : t.showMinimap}
                    onClick={() => setShowEditorMinimap(!showEditorMinimap)}
                    className={`panel-icon-toggle ${showEditorMinimap ? 'panel-icon-toggle-active' : ''}`}
                  >
                    <MapIcon size={12} />
                  </button>
                )}
                <span className="panel-badge-dark">{sourcePanelMode === 'source' ? t.live : t.setup}</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {sourcePanelMode === 'source' ? (
                editorPreloaded ? (
                  <Suspense fallback={<LazyEditorFallback />}>
                    <LazyCodeEditor />
                  </Suspense>
                ) : <LazyEditorFallback />
              ) : <MemoStyleManager />}
            </div>
          </section>
        )}

        {showEditor && (
          <div
            role="separator"
            aria-label={t.resizeEditorCanvas}
            aria-orientation="vertical"
            aria-valuemin={resizeBounds.minimum}
            aria-valuemax={resizeBounds.maximum}
            aria-valuenow={Math.round(displayedEditorWidth)}
            tabIndex={0}
            onPointerDown={startResize}
            onDoubleClick={() => setEditorWidth(null)}
            onKeyDown={resizeWithKeyboard}
            className="theme-resizer workbench-resizer group relative shrink-0 cursor-col-resize border-x outline-none"
            title={t.resizeResetHint}
          >
            <span className="workbench-resizer-line" />
          </div>
        )}

        <section className="theme-panel preview-panel flex-1 min-w-0 flex flex-col">
          <div className="panel-titlebar theme-panel-header canvas-titlebar border-b">
            <div className="panel-title-left">
              <span className="panel-title-icon"><Eye size={14} /></span>
              <span className="font-semibold">{t.interactiveCanvas}</span>
            </div>
            <span className="panel-kicker">{t.preview}</span>
          </div>
          <MemoCanvasControls />
          <div ref={canvasRowRef} className="canvas-work-area flex-1 min-h-0 flex overflow-hidden">
            <MemoToolbar />
            <div className="canvas-frame flex-1 min-w-0 relative border-r theme-border">
              <MemoPreview shortcutScope={isEmbedded ? "canvas" : "window"} />
            </div>
            {showInspector && (
              <div
                role="separator"
                aria-label={t.resizeCanvasInspector}
                aria-orientation="vertical"
                aria-valuemin={inspectorResizeBounds.minimum}
                aria-valuemax={inspectorResizeBounds.maximum}
                aria-valuenow={Math.round(displayedInspectorWidth)}
                tabIndex={0}
                onPointerDown={startInspectorResize}
                onDoubleClick={() => setInspectorWidth(null)}
                onKeyDown={resizeInspectorWithKeyboard}
                className="theme-resizer workbench-resizer group relative shrink-0 cursor-col-resize border-x outline-none"
                title={t.resizeInspectorResetHint}
              >
                <span className="workbench-resizer-line" />
              </div>
            )}
            {showInspector && (
              <aside ref={inspectorRef} className="theme-panel inspector-shell flex flex-col shrink-0" style={{ width: `${displayedInspectorWidth}px` }}>
                <MemoObjectTree />
                <MemoConstructionHistory />
                <MemoPropertiesPanel />
              </aside>
            )}
          </div>
        </section>
          </>
        )}
      </main>
      {commandPaletteOpen && (
        <Suspense fallback={null}>
          <LazyCommandPalette
            open={commandPaletteOpen}
            showEditor={showEditor}
            showInspector={showInspector}
            onClose={closeCommandPalette}
            onOpenWorkspace={openWorkspace}
            onOpenSource={openSourcePanel}
            onOpenStyles={openStylesPanel}
            onOpenSettings={openSettings}
            onToggleEditor={toggleEditor}
            onToggleInspector={toggleInspector}
          />
        </Suspense>
      )}
      <MemoStatusBar mode={isEmbedded ? "embedded" : "standalone"} />
    </div>
  );
}

export default App;
