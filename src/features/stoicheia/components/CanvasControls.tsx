import { useState, type ReactNode } from 'react';
import { type AutoLabelShape, useEditorStore } from '../store';
import { Eye, EyeOff, ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet, Hand, RotateCcw, Zap, FileCode2, Tags, Crosshair, Ruler, Info } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { getUiTranslation } from '../i18n';

const AUTO_LABEL_OPTION_KEYS: AutoLabelShape[] = [
  'segments',
  'lines',
  'angles',
  'circles',
  'arcs',
];

export function CanvasControls() {
  const [showLabelSettings, setShowLabelSettings] = useState(false);
  const {
    activeTool, setActiveTool,
    showHandles, setShowHandles,
    zoomLevel,
    showGrid, setShowGrid,
    showAxes, setShowAxes,
    showMeasurements, setShowMeasurements,
    snapToGrid, setSnapToGrid,
    autoLabelShapes, setAutoLabelShape,
    pan, setCanvasView,
    requestFitView,
    previewMode, setPreviewMode,
    latexFresh, isCompiling, errorLog,
    language,
  } = useEditorStore(useShallow(state => ({
    activeTool: state.activeTool,
    setActiveTool: state.setActiveTool,
    showHandles: state.showHandles,
    setShowHandles: state.setShowHandles,
    zoomLevel: state.zoomLevel,
    showGrid: state.showGrid,
    setShowGrid: state.setShowGrid,
    showAxes: state.showAxes,
    setShowAxes: state.setShowAxes,
    showMeasurements: state.showMeasurements,
    setShowMeasurements: state.setShowMeasurements,
    snapToGrid: state.snapToGrid,
    setSnapToGrid: state.setSnapToGrid,
    autoLabelShapes: state.autoLabelShapes,
    setAutoLabelShape: state.setAutoLabelShape,
    pan: state.pan,
    setCanvasView: state.setCanvasView,
    requestFitView: state.requestFitView,
    previewMode: state.previewMode,
    setPreviewMode: state.setPreviewMode,
    latexFresh: state.compiledSource === state.source && state.compiledSource !== null,
    isCompiling: state.isCompiling,
    errorLog: state.errorLog,
    language: state.settings.language,
  })));
  const t = getUiTranslation(language).canvasControls;
  const hasAutoLabels = Object.values(autoLabelShapes).some(Boolean);
  const compileIndicatorClass = errorLog
    ? 'control-indicator-error'
    : isCompiling
      ? 'control-indicator-busy'
      : latexFresh
        ? 'control-indicator-ready'
        : '';

  const applyZoom = (nextZoom: number) => {
    const clampedZoom = Math.min(Math.max(nextZoom, 0.1), 5);
    const ratio = clampedZoom / zoomLevel;
    setCanvasView({ zoomLevel: clampedZoom, pan: { x: pan.x * ratio, y: pan.y * ratio } });
  };

  const handleZoomIn = () => applyZoom(zoomLevel * 1.2);
  const handleZoomOut = () => applyZoom(zoomLevel / 1.2);
  const handleViewReset = () => {
    setCanvasView({ zoomLevel: 1, pan: { x: 0, y: 0 } });
  };

  const toggleBtn = (active: boolean, onClick: () => void, icon: ReactNode, label: string, title: string) => (
    <button
      type="button"
      onClick={onClick}
      className={`control-button ${active ? 'control-button-active' : ''}`}
      title={title}
      aria-pressed={active}
    >
      {icon}
      <span className="font-semibold">{label}</span>
    </button>
  );

  return (
    <div className="canvas-command-bar shrink-0">
      <div className="control-cluster">
        {toggleBtn(previewMode === 'instant', () => setPreviewMode('instant'),
          <Zap size={15} />,
          t.instant, t.useFastPreview
        )}
        {toggleBtn(previewMode === 'latex', () => setPreviewMode('latex'),
          <FileCode2 size={15} />,
          t.latex, t.useLatexPreview
        )}
        <span
          className={`control-indicator ${compileIndicatorClass}`}
          title={errorLog ? t.latexError : isCompiling ? t.latexCompiling : latexFresh ? t.latexCurrent : t.latexStale}
        />
      </div>

      <div className="control-divider"></div>
      
      {/* Visibility Controls */}
      <div className="control-cluster">
        {toggleBtn(activeTool === 'pan', () => setActiveTool(activeTool === 'pan' ? 'cursor' : 'pan'),
          <Hand size={15} />,
          t.pan, activeTool === 'pan' ? t.returnSelection : t.panLeftDrag
        )}
        {toggleBtn(showHandles, () => setShowHandles(!showHandles),
          showHandles ? <Eye size={15} /> : <EyeOff size={15} />,
          t.handles, showHandles ? t.hideHandles : t.showHandles
        )}
        {toggleBtn(showGrid, () => setShowGrid(!showGrid),
          <Grid3x3 size={15} />,
          t.grid, showGrid ? t.hideGrid : t.showGrid
        )}
        {toggleBtn(showAxes, () => setShowAxes(!showAxes),
          <Crosshair size={15} />,
          t.axes, showAxes ? t.hideAxes : t.showAxes
        )}
        {toggleBtn(showMeasurements, () => setShowMeasurements(!showMeasurements),
          <Ruler size={15} />,
          t.measure, showMeasurements ? t.hideMeasurements : t.showMeasurements
        )}
        {toggleBtn(snapToGrid, () => setSnapToGrid(!snapToGrid),
          <Magnet size={15} />,
          t.snap, snapToGrid ? t.disableSnap : t.enableSnap
        )}
      </div>

      <div className="control-divider"></div>

      {/* Automatic Labels */}
      <div className="control-cluster relative">
        {toggleBtn(hasAutoLabels, () => setShowLabelSettings(value => !value),
          <Tags size={15} />,
          t.labels, t.configureAutoLabels
        )}
        {showLabelSettings && (
          <div className="control-popover">
            <div className="control-popover-title">
              {t.autoLabels}
            </div>
            {AUTO_LABEL_OPTION_KEYS.map(option => (
              <label
                key={option}
                className="control-popover-option"
              >
                <input
                  type="checkbox"
                  checked={autoLabelShapes[option]}
                  onChange={(event) => setAutoLabelShape(option, event.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-[var(--accent)]"
                  aria-label={`${t.autoLabels}: ${t.autoLabelOptions[option]}`}
                />
                <span>{t.autoLabelOptions[option]}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="control-divider"></div>

      {/* Zoom Controls */}
      <div className="control-cluster">
        <button 
          type="button"
          onClick={handleZoomOut}
          className="control-button"
          title={t.zoomOut}
        >
          <ZoomOut size={17} />
        </button>
        
        <span className="control-zoom-value select-none">
          {Math.round(zoomLevel * 100)}%
        </span>

        <input
          type="range"
          min="10"
          max="500"
          step="5"
          value={Math.round(zoomLevel * 100)}
          onChange={(e) => applyZoom(Number(e.target.value) / 100)}
          className="control-range"
          title={t.zoomLevel}
        />
        
        <button 
          type="button"
          onClick={handleZoomIn}
          className="control-button"
          title={t.zoomIn}
        >
          <ZoomIn size={17} />
        </button>
        
        <button 
          type="button"
          onClick={requestFitView}
          className="control-button border-l theme-border"
          title={t.fitView}
        >
          <Maximize size={15} />
        </button>

        <button
          type="button"
          onClick={handleViewReset}
          className="control-button"
          title={t.resetView}
        >
          <RotateCcw size={15} />
        </button>
      </div>

      <div className="control-help-cluster">
        <button
          type="button"
          className="control-help-button"
          aria-label={t.interactionHint}
          title={t.interactionHint}
        >
          <Info size={16} />
        </button>
      </div>
    </div>
  );
}
