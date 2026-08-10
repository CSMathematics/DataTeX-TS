import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react';
import { AstNode, useEditorStore } from '../store';
import { AlertTriangle, LoaderCircle, Shapes } from 'lucide-react';
import { buildFastRenderScene, FastRenderScene, FastSvgRenderer } from '../renderers/FastSvgRenderer';
import { buildFastViewport } from '../geometry/fastViewport';
import { logPerformance, nowMs } from '../performanceMetrics';
import { useShallow } from 'zustand/react/shallow';
import { getNodeId } from './nodeIdentity';
import { sanitizeExactSvg } from '../bridge/sanitizeExactSvg';
import {
  beginStoicheiaFrameInteraction,
  endStoicheiaFrameInteraction,
  markStoicheiaFirstCanvasCommit,
  recordStoicheiaInteractionFrame,
} from '../../../utils/stoicheiaRuntimePerformance';

interface Transform {
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
}

const isPairCollectionTool = (tool: string) => ['add_lines', 'add_segments', 'add_circles', 'add_semicircles', 'add_compasses', 'mark_segments', 'label_segments'].includes(tool);
const isTripleCollectionTool = (tool: string) => ['fill_angles', 'mark_angles', 'mark_right_angles', 'label_angles'].includes(tool);
const isPointCollectionTool = (tool: string) => tool === 'label_points' || tool === 'auto_label_points';
const isCollectionTool = (tool: string) => isPairCollectionTool(tool) || isTripleCollectionTool(tool) || isPointCollectionTool(tool) || tool === 'add_polyseg';
const snapCoordinate = (value: number, step: number) => {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const nearest = Math.round(value / safeStep) * safeStep;
  return Math.abs(value - nearest) <= safeStep * 0.15 ? nearest : value;
};

const summarizeLatexDiagnostics = (log: string | null) => {
  if (!log) return [];
  const lines = log.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const diagnostics: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith('!')) diagnostics.push(line.replace(/^!\s*/, ''));
    else if (/^l\.\d+/.test(line)) diagnostics.push(line);
    else if (/undefined control sequence/i.test(line)) diagnostics.push('Undefined control sequence');
    else if (/file .* not found/i.test(line)) diagnostics.push(line);
    else if (/emergency stop/i.test(line)) diagnostics.push('Emergency stop');
    if (diagnostics.length >= 5) break;
  }
  return Array.from(new Set(diagnostics));
};

const completeCollectionDrawing = (trimPendingPoint = false) => {
  const state = useEditorStore.getState();
  if (!isCollectionTool(state.activeTool)) return false;
  let points = state.selectedPoints;
  if (state.activeTool === 'add_polyseg') {
    if (points.length < 2) return false;
    state.addPolySeg(points);
    state.setSelectedPoints([]);
    state.setActiveTool('cursor');
    return true;
  }
  if (isPointCollectionTool(state.activeTool)) {
    const unique = Array.from(new Set(points));
    if (state.activeTool === 'label_points') {
      if (!unique.length) return false;
      state.addPointLabels(unique);
    } else {
      if (unique.length < 2) return false;
      state.addAutoPointLabels(unique[0], unique.slice(1));
    }
    state.setSelectedPoints([]);
    state.setActiveTool('cursor');
    return true;
  }
  if (isTripleCollectionTool(state.activeTool)) {
    if (points.length % 3 !== 0 && trimPendingPoint) points = points.slice(0, points.length - points.length % 3);
    if (points.length < 3 || points.length % 3 !== 0) return false;
    const angles: [string, string, string][] = [];
    for (let index = 0; index < points.length; index += 3) angles.push([points[index], points[index + 1], points[index + 2]]);
    if (state.activeTool === 'fill_angles') state.fillAngles(angles);
    else if (state.activeTool === 'mark_angles') state.addAnglesMark(angles);
    else if (state.activeTool === 'mark_right_angles') state.addRightAnglesMark(angles);
    else state.addAngleLabels(angles);
    state.setSelectedPoints([]);
    state.setActiveTool('cursor');
    return true;
  }
  if (points.length % 2 !== 0 && trimPendingPoint) points = points.slice(0, -1);
  if (points.length < 2 || points.length % 2 !== 0) return false;
  const pairs: [string, string][] = [];
  for (let index = 0; index < points.length; index += 2) pairs.push([points[index], points[index + 1]]);
  if (state.activeTool === 'add_lines') state.addLines(pairs);
  else if (state.activeTool === 'add_segments') state.addSegments(pairs);
  else if (state.activeTool === 'add_circles') state.addCircles(pairs);
  else if (state.activeTool === 'add_semicircles') state.addSemiCircles(pairs);
  else if (state.activeTool === 'add_compasses') state.addCompasses(pairs);
  else if (state.activeTool === 'mark_segments') state.addSegmentsMark(pairs);
  else state.addSegmentLabels(pairs);
  state.setSelectedPoints([]);
  state.setActiveTool('cursor');
  return true;
};

const CollectionToolTip = memo(({ activeTool, selectedPoints }: { activeTool: string; selectedPoints: string[] }) => {
  if (isPointCollectionTool(activeTool)) {
    return (
      <div className="canvas-tip">
        <div>
          <p className="canvas-tip-title">{activeTool === 'label_points' ? 'Label multiple points' : 'Auto-label points'} · {selectedPoints.length} selected</p>
          <p className="canvas-tip-text">{activeTool === 'auto_label_points' ? 'Select the center first, then label points' : 'Select existing points'} · Enter, Finish or double-click · Esc to cancel</p>
        </div>
        <button type="button" disabled={selectedPoints.length < (activeTool === 'auto_label_points' ? 2 : 1)} onMouseDown={event => event.stopPropagation()} onClick={() => completeCollectionDrawing()} className="canvas-tip-button">Finish</button>
      </div>
    );
  }

  if (isTripleCollectionTool(activeTool)) {
    const angleCount = Math.floor(selectedPoints.length / 3);
    return (
      <div className="canvas-tip">
        <div>
          <p className="canvas-tip-title">{activeTool === 'fill_angles' ? 'Multiple angle fills' : activeTool === 'mark_angles' ? 'Multiple angle marks' : activeTool === 'label_angles' ? 'Multiple angle labels' : 'Multiple right-angle marks'} · {angleCount} angle{angleCount === 1 ? '' : 's'}</p>
          <p className="canvas-tip-text">Select side–vertex–side triples · Enter, Finish or double-click · Esc to cancel</p>
        </div>
        <button type="button" disabled={selectedPoints.length < 3 || selectedPoints.length % 3 !== 0} onMouseDown={event => event.stopPropagation()} onClick={() => completeCollectionDrawing()} className="canvas-tip-button">Finish</button>
      </div>
    );
  }

  if (isCollectionTool(activeTool)) {
    const pairCount = Math.floor(selectedPoints.length / 2);
    return (
      <div className="canvas-tip">
        <div>
          <p className="canvas-tip-title">{activeTool === 'add_lines' ? 'Multiple lines' : activeTool === 'add_segments' ? 'Multiple segments' : activeTool === 'add_circles' ? 'Multiple circles' : activeTool === 'add_semicircles' ? 'Multiple semicircles' : activeTool === 'mark_segments' ? 'Mark multiple segments' : activeTool === 'label_segments' ? 'Label multiple segments' : 'Polygonal chain'} · {activeTool === 'add_polyseg' ? `${selectedPoints.length} points` : `${pairCount} pair${pairCount === 1 ? '' : 's'}`}</p>
          <p className="canvas-tip-text">Select {activeTool === 'add_polyseg' ? 'points in order' : 'point pairs'} · Enter, Finish or double-click a point · Esc to cancel</p>
        </div>
        <button type="button" disabled={selectedPoints.length < 2 || (isPairCollectionTool(activeTool) && selectedPoints.length % 2 !== 0)} onMouseDown={event => event.stopPropagation()} onClick={() => completeCollectionDrawing()} className="canvas-tip-button">Finish</button>
      </div>
    );
  }

  return null;
});
CollectionToolTip.displayName = 'CollectionToolTip';

const PreviewDiagnosticsLayer = memo(({
  isCompiling,
  previewMode,
  errorLog,
  latexDiagnostics,
}: {
  isCompiling: boolean;
  previewMode: string;
  errorLog: string | null;
  latexDiagnostics: string[];
}) => (
  <>
    {isCompiling && (
      <div className="canvas-compile-pill">
        <LoaderCircle size={13} className="text-indigo-500 animate-spin" />
        Compiling…
      </div>
    )}

    {previewMode === 'latex' && errorLog && (
      <div className="latex-error-overlay">
        <div className="latex-error-card">
          <div className="latex-error-header shrink-0">
            <AlertTriangle size={17} />
            <span>LaTeX compilation failed</span>
          </div>
          {latexDiagnostics.length > 0 && (
            <div className="latex-diagnostics">
              {latexDiagnostics.map((diagnostic, index) => <div key={`${diagnostic}-${index}`} className="latex-diagnostic-item">{diagnostic}</div>)}
            </div>
          )}
          <pre className="latex-error-log inspector-scroll">{errorLog}</pre>
        </div>
      </div>
    )}
  </>
));
PreviewDiagnosticsLayer.displayName = 'PreviewDiagnosticsLayer';

const EmptyPreviewState = memo(() => (
  <div className="flex flex-col items-center text-center px-6 cursor-default">
    <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4">
      <Shapes size={24} className="text-slate-400" />
    </div>
    <p className="text-sm font-semibold text-slate-600">No preview yet</p>
    <p className="text-xs text-slate-400 mt-1 max-w-56">Add a point or edit the LaTeX source to render your construction.</p>
  </div>
));
EmptyPreviewState.displayName = 'EmptyPreviewState';

const hiddenSceneStyle: CSSProperties = { opacity: 0, pointerEvents: 'none' };

const PreviewSceneFrame = memo(({
  pan,
  sceneStyle,
  sceneReady,
  children,
}: {
  pan: { x: number; y: number };
  sceneStyle: CSSProperties;
  sceneReady: boolean;
  children: ReactNode;
}) => (
  <div
    data-preview-scene-frame
    className="absolute left-1/2 top-1/2"
    style={{
      transform: `translate(${pan.x}px, ${pan.y}px)`,
      transformOrigin: '0 0',
    }}
  >
    <div className="relative" style={sceneReady ? sceneStyle : hiddenSceneStyle}>
      {children}
    </div>
  </div>
));
PreviewSceneFrame.displayName = 'PreviewSceneFrame';

const PreviewArtworkLayer = memo(({
  previewMode,
  fastRenderScene,
  svgOutput,
}: {
  previewMode: string;
  fastRenderScene: FastRenderScene;
  svgOutput: string | null;
}) => {
  const sanitizedSvgOutput = useMemo(
    () => sanitizeExactSvg(svgOutput),
    [svgOutput],
  );

  return previewMode === 'instant' ? (
    <div className="absolute inset-0 pointer-events-none [&>svg]:w-full [&>svg]:h-full [&>svg]:overflow-visible">
      <FastSvgRenderer scene={fastRenderScene} />
    </div>
  ) : (
    <div
      data-latex-preview
      className="absolute inset-0 [&>svg]:w-full [&>svg]:h-full [&>svg]:overflow-visible"
      dangerouslySetInnerHTML={{ __html: sanitizedSvgOutput }}
    />
  );
});
PreviewArtworkLayer.displayName = 'PreviewArtworkLayer';

const InteractionOverlayFrame = memo(({ viewBox, children }: { viewBox: string; children: ReactNode }) => (
  <svg
    viewBox={viewBox}
    className="absolute inset-0 pointer-events-none overflow-visible"
  >
    {children}
  </svg>
));
InteractionOverlayFrame.displayName = 'InteractionOverlayFrame';

type OverlayPoint = { x: number; y: number };
type OverlayPointMap = Record<string, OverlayPoint>;
type PointMouseDownHandler = (event: ReactMouseEvent, nodeName: string, nodeId?: string) => void;
type SegmentMouseDownHandler = (event: ReactMouseEvent, p1: string, p2: string, nodeId: string) => void;
type ObjectMouseDownHandler = (event: ReactMouseEvent, nodeId: string) => void;
type NodeHoverHandler = (nodeId: string | null) => void;
type ConstructionPreviewPoint = OverlayPoint;
type CanvasWorldBounds = { minX: number; maxX: number; minY: number; maxY: number };

const niceAxisStride = (minimumStride: number) => {
  if (!Number.isFinite(minimumStride) || minimumStride <= 1) return 1;
  const exponent = 10 ** Math.floor(Math.log10(minimumStride));
  const normalized = minimumStride / exponent;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(1, Math.ceil(factor * exponent));
};

const formatAxisValue = (value: number, step: number) => {
  const decimals = Math.min(6, Math.max(0, Math.ceil(-Math.log10(Math.max(step, 1e-6)))));
  const formatted = value.toFixed(decimals);
  return formatted.includes('.') ? formatted.replace(/0+$/, '').replace(/\.$/, '') : formatted;
};

const GridOverlayLayer = memo(({
  showGrid,
  showAxes,
  showAxisTicks,
  showAxisLabels,
  axisLineWidth,
  axisTickSize,
  axisLabelFontSize,
  axisLabelSpacing,
  canvasGridStep,
  transform,
  zoomLevel,
  visibleBounds,
}: {
  showGrid: boolean;
  showAxes: boolean;
  showAxisTicks: boolean;
  showAxisLabels: boolean;
  axisLineWidth: number;
  axisTickSize: number;
  axisLabelFontSize: number;
  axisLabelSpacing: number;
  canvasGridStep: number;
  transform: Transform;
  zoomLevel: number;
  visibleBounds: CanvasWorldBounds;
}) => {
  if (!showGrid && !showAxes) return null;
  const gridElements = [];
  const safeGridStep = Number.isFinite(canvasGridStep) && canvasGridStep > 0 ? canvasGridStep : 1;
  const safeZoom = Number.isFinite(zoomLevel) && zoomLevel > 0 ? zoomLevel : 1;
  const minimumGridSpacing = 12;
  const gridStride = niceAxisStride(minimumGridSpacing / (safeGridStep * Math.min(Math.abs(transform.scaleX), Math.abs(transform.scaleY)) * safeZoom));
  const xStride = niceAxisStride(axisLabelSpacing / (safeGridStep * Math.abs(transform.scaleX) * safeZoom));
  const yStride = niceAxisStride(axisLabelSpacing / (safeGridStep * Math.abs(transform.scaleY) * safeZoom));
  const xLabelStep = safeGridStep * xStride;
  const yLabelStep = safeGridStep * yStride;
  const axisLabelOffset = (axisTickSize + 4) / safeZoom;
  const tickSize = axisTickSize / safeZoom;
  const labelFontSize = axisLabelFontSize / safeZoom;
  const labelHaloWidth = 3 / safeZoom;
  const tickStrokeWidth = Math.max(0.75, axisLineWidth * 0.72) / safeZoom;
  const axisStrokeWidth = axisLineWidth / safeZoom;
  const minorGridStrokeWidth = 0.45 / safeZoom;
  const majorGridStrokeWidth = 0.7 / safeZoom;

  const forVisibleIndices = (minimum: number, maximum: number, stride: number, render: (index: number) => void) => {
    const first = Math.ceil(minimum / safeGridStep / stride) * stride;
    const last = Math.floor(maximum / safeGridStep / stride) * stride;
    for (let index = first; index <= last; index += stride) render(index);
  };

  if (showGrid) {
    forVisibleIndices(visibleBounds.minX, visibleBounds.maxX, gridStride, i => {
      const value = Number((i * safeGridStep).toFixed(6));
      if (Math.abs(value) < 0.000001) return;
      const x = transform.originX + value * transform.scaleX;
      const isMajor = i % (gridStride * 5) === 0;
      gridElements.push(
        <line
          key={`gx-${value}`}
          x1={x}
          y1={-10000}
          x2={x}
          y2={10000}
          stroke={isMajor ? 'var(--canvas-grid-major)' : 'var(--canvas-grid-minor)'}
          strokeWidth={isMajor ? majorGridStrokeWidth : minorGridStrokeWidth}
        />,
      );
    });
    forVisibleIndices(visibleBounds.minY, visibleBounds.maxY, gridStride, i => {
      const value = Number((i * safeGridStep).toFixed(6));
      if (Math.abs(value) < 0.000001) return;
      const y = transform.originY - value * transform.scaleY;
      const isMajor = i % (gridStride * 5) === 0;
      gridElements.push(
        <line
          key={`gy-${value}`}
          x1={-10000}
          y1={y}
          x2={10000}
          y2={y}
          stroke={isMajor ? 'var(--canvas-grid-major)' : 'var(--canvas-grid-minor)'}
          strokeWidth={isMajor ? majorGridStrokeWidth : minorGridStrokeWidth}
        />,
      );
    });
  }

  if (showAxes && (showAxisTicks || showAxisLabels)) {
    forVisibleIndices(visibleBounds.minX, visibleBounds.maxX, xStride, i => {
      const value = Number((i * safeGridStep).toFixed(6));
      if (Math.abs(value) < 0.000001) return;
      const x = transform.originX + value * transform.scaleX;
      gridElements.push(
        <g key={`axis-x-label-${value}`} className="pointer-events-none">
          {showAxisTicks && <line data-axis-tick="x" x1={x} y1={transform.originY - tickSize} x2={x} y2={transform.originY + tickSize} stroke="var(--canvas-axis)" strokeWidth={tickStrokeWidth} />}
          {showAxisLabels && <text data-axis-label="x" x={x} y={transform.originY + axisLabelOffset} fill="var(--canvas-axis-label)" stroke="var(--canvas-bg)" strokeWidth={labelHaloWidth} paintOrder="stroke" strokeLinejoin="round" fontSize={labelFontSize} fontWeight={500} textAnchor="middle" dominantBaseline="hanging">{formatAxisValue(value, xLabelStep)}</text>}
        </g>,
      );
    });
    forVisibleIndices(visibleBounds.minY, visibleBounds.maxY, yStride, i => {
      const value = Number((i * safeGridStep).toFixed(6));
      if (Math.abs(value) < 0.000001) return;
      const y = transform.originY - value * transform.scaleY;
      gridElements.push(
        <g key={`axis-y-label-${value}`} className="pointer-events-none">
          {showAxisTicks && <line data-axis-tick="y" x1={transform.originX - tickSize} y1={y} x2={transform.originX + tickSize} y2={y} stroke="var(--canvas-axis)" strokeWidth={tickStrokeWidth} />}
          {showAxisLabels && <text data-axis-label="y" x={transform.originX - axisLabelOffset} y={y} fill="var(--canvas-axis-label)" stroke="var(--canvas-bg)" strokeWidth={labelHaloWidth} paintOrder="stroke" strokeLinejoin="round" fontSize={labelFontSize} fontWeight={500} textAnchor="end" dominantBaseline="central">{formatAxisValue(value, yLabelStep)}</text>}
        </g>,
      );
    });
  }
  if (showAxes) {
    gridElements.push(<line data-axis-line="x" key="axis-x" x1={-10000} y1={transform.originY} x2={10000} y2={transform.originY} stroke="var(--canvas-axis)" strokeWidth={axisStrokeWidth} />);
    gridElements.push(<line data-axis-line="y" key="axis-y" x1={transform.originX} y1={-10000} x2={transform.originX} y2={10000} stroke="var(--canvas-axis)" strokeWidth={axisStrokeWidth} />);
    if (showAxisLabels) {
      gridElements.push(<text data-axis-label="origin" key="axis-origin" x={transform.originX - axisLabelOffset} y={transform.originY + axisLabelOffset} fill="var(--canvas-axis-label)" stroke="var(--canvas-bg)" strokeWidth={labelHaloWidth} paintOrder="stroke" strokeLinejoin="round" fontSize={labelFontSize} fontWeight={500} textAnchor="end" dominantBaseline="hanging">0</text>);
    }
  }
  return <>{gridElements}</>;
});
GridOverlayLayer.displayName = 'GridOverlayLayer';

const HoverHighlightLayer = memo(({
  hoveredNode,
  pointMap,
  parsedNodes,
}: {
  hoveredNode: string | null;
  pointMap: OverlayPointMap;
  parsedNodes: AstNode[];
}) => {
  if (!hoveredNode) return null;

  const parts = hoveredNode.split('_');
  const type = parts[0];

  if (type === 'point' && pointMap[parts[1]]) {
    const p = pointMap[parts[1]];
    return <circle cx={p.x} cy={p.y} r={8} className="fill-none stroke-blue-400 stroke-[3px] opacity-80 animate-pulse" />;
  }
  if (type === 'midpoint' && pointMap[parts[1]]) {
    const p = pointMap[parts[1]];
    return <circle cx={p.x} cy={p.y} r={8} className="fill-none stroke-cyan-400 stroke-[3px] opacity-80 animate-pulse" />;
  }
  if ((type === 'goldenratio' || type === 'barycentric') && pointMap[parts[1]]) {
    const p = pointMap[parts[1]];
    return <circle cx={p.x} cy={p.y} r={8} className="fill-none stroke-purple-400 stroke-[3px] opacity-80 animate-pulse" />;
  }
  if ((type === 'similitude' || type === 'harmonic') && pointMap[parts[1]]) {
    const p = pointMap[parts[1]];
    return <circle cx={p.x} cy={p.y} r={8} className="fill-none stroke-pink-400 stroke-[3px] opacity-80 animate-pulse" />;
  }
  if ((type === 'harmonicpair' || type === 'equipoints') && pointMap[parts[1]] && pointMap[parts[2]]) {
    return <g>{[pointMap[parts[1]], pointMap[parts[2]]].map((p, index) => <circle key={index} cx={p.x} cy={p.y} r={8} className="fill-none stroke-sky-400 stroke-[3px] opacity-80 animate-pulse" />)}</g>;
  }
  if ((type === 'midarc' || type === 'pointonline' || type === 'pointoncircle' || type === 'randompoint') && pointMap[parts[1]]) {
    const p = pointMap[parts[1]];
    return <circle cx={p.x} cy={p.y} r={8} className="fill-none stroke-indigo-400 stroke-[3px] opacity-80 animate-pulse" />;
  }
  if (type === 'trianglecenter' && pointMap[parts[1]]) {
    const p = pointMap[parts[1]];
    return <circle cx={p.x} cy={p.y} r={8} className="fill-none stroke-rose-400 stroke-[3px] opacity-80 animate-pulse" />;
  }
  if (type === 'transformation' && pointMap[parts[1]]) {
    const p = pointMap[parts[1]];
    return <circle cx={p.x} cy={p.y} r={8} className="fill-none stroke-violet-400 stroke-[3px] opacity-80 animate-pulse" />;
  }
  if (type === 'transformations' && parts.slice(1).every(name => pointMap[name])) {
    return <g>{parts.slice(1).map(name => <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={8} className="fill-none stroke-fuchsia-400 stroke-[3px] opacity-80 animate-pulse" />)}</g>;
  }
  if (type === 'vectorpoint' && pointMap[parts[1]]) {
    const p = pointMap[parts[1]];
    return <circle cx={p.x} cy={p.y} r={8} className="fill-none stroke-sky-400 stroke-[3px] opacity-80 animate-pulse" />;
  }
  if (type === 'definedline' && parts.slice(1).every(name => pointMap[name])) {
    return <g>{parts.slice(1).map(name => <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={8} className="fill-none stroke-blue-500 stroke-[3px] opacity-80 animate-pulse" />)}</g>;
  }
  if (type === 'definedtriangle' && pointMap[parts[1]]) {
    const p = pointMap[parts[1]];
    return <circle cx={p.x} cy={p.y} r={8} className="fill-none stroke-rose-500 stroke-[3px] opacity-80 animate-pulse" />;
  }
  if (type === 'associatedtriangle' && parts.slice(1).every(name => pointMap[name])) {
    return <g>{parts.slice(1).map(name => <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={8} className="fill-none stroke-purple-500 stroke-[3px] opacity-80 animate-pulse" />)}</g>;
  }
  if (type === 'polygonconstruction' && parts.slice(1).every(name => pointMap[name])) {
    return <g>{parts.slice(1).map(name => <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={8} className="fill-none stroke-emerald-500 stroke-[3px] opacity-80 animate-pulse" />)}</g>;
  }
  if (type === 'definedcircle' && parts.slice(1).every(name => pointMap[name])) {
    return <g>{parts.slice(1).map(name => <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={8} className="fill-none stroke-cyan-500 stroke-[3px] opacity-80 animate-pulse" />)}</g>;
  }
  if ((type === 'projectedexcenters' || type === 'circletransformation') && parts.slice(1).every(name => pointMap[name])) {
    return <g>{parts.slice(1).map(name => <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={8} className="fill-none stroke-fuchsia-500 stroke-[3px] opacity-80 animate-pulse" />)}</g>;
  }
  if ((type === 'linecircleintersection' || type === 'circlecircleintersection') && parts.slice(1).every(name => pointMap[name])) {
    return <g>{parts.slice(1).map(name => <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={8} className="fill-none stroke-blue-500 stroke-[3px] opacity-80 animate-pulse" />)}</g>;
  }
  if (type === 'segment' && pointMap[parts[1]] && pointMap[parts[2]]) {
    const p1 = pointMap[parts[1]];
    const p2 = pointMap[parts[2]];
    return <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="stroke-blue-400 stroke-[4px] opacity-80" strokeLinecap="round" />;
  }
  if (type === 'polygon') {
    const pts = parts.slice(1);
    if (pts.every((pt: string) => pointMap[pt])) {
      const pointsAttr = pts.map((pt: string) => `${pointMap[pt].x},${pointMap[pt].y}`).join(' ');
      return <polygon points={pointsAttr} className="fill-blue-400/20 stroke-blue-400 stroke-[3px]" />;
    }
  }
  if (type === 'circle' && pointMap[parts[1]]) {
    const circleNode = parsedNodes.find((node): node is Extract<AstNode, { type: 'Circle' }> => node.type === 'Circle' && node.center === parts[1]);
    if (circleNode && pointMap[circleNode.radius_point]) {
      const center = pointMap[circleNode.center];
      const target = pointMap[circleNode.radius_point];
      const r = Math.sqrt(Math.pow(target.x - center.x, 2) + Math.pow(target.y - center.y, 2));
      return <circle cx={center.x} cy={center.y} r={r} className="fill-blue-400/10 stroke-blue-400 stroke-[3px]" />;
    }
  }
  if (type === 'arc') {
    const arcNode = parsedNodes.find((node): node is Extract<AstNode, { type: 'Arc' }> =>
      node.type === 'Arc' &&
      node.center === parts[1] &&
      node.first === parts[2] &&
      node.second.join('_') === parts.slice(3).join('_')
    );
    if (arcNode?.type === 'Arc' && arcNode.mode === 'towards') {
      const center = pointMap[arcNode.center];
      const start = pointMap[arcNode.first];
      const endDirection = pointMap[arcNode.second[0]];
      if (center && start && endDirection) {
        const radius = Math.hypot(start.x - center.x, start.y - center.y);
        const endVectorLength = Math.hypot(endDirection.x - center.x, endDirection.y - center.y);
        if (radius > 0 && endVectorLength > 0) {
          const end = {
            x: center.x + (endDirection.x - center.x) * radius / endVectorLength,
            y: center.y + (endDirection.y - center.y) * radius / endVectorLength,
          };
          const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
          const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
          const counterClockwiseAngle = (startAngle - endAngle + Math.PI * 2) % (Math.PI * 2);
          const largeArc = counterClockwiseAngle > Math.PI ? 1 : 0;
          const path = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
          return <path d={path} className="fill-none stroke-blue-400 stroke-[4px] opacity-80" strokeLinecap="round" />;
        }
      }
    }
  }
  if (type === 'perpendicular' && pointMap[parts[1]] && pointMap[parts[2]] && pointMap[parts[3]]) {
    const baseStart = pointMap[parts[1]];
    const baseEnd = pointMap[parts[2]];
    const through = pointMap[parts[3]];
    const dx = baseEnd.x - baseStart.x;
    const dy = baseEnd.y - baseStart.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      const perpendicularX = -dy / length;
      const perpendicularY = dx / length;
      return (
        <line
          x1={through.x - perpendicularX * 10000}
          y1={through.y - perpendicularY * 10000}
          x2={through.x + perpendicularX * 10000}
          y2={through.y + perpendicularY * 10000}
          className="stroke-blue-400 stroke-[4px] opacity-80"
          strokeLinecap="round"
        />
      );
    }
  }
  if (type === 'projection' && pointMap[parts[1]] && pointMap[parts[2]] && pointMap[parts[3]]) {
    const baseStart = pointMap[parts[1]];
    const baseEnd = pointMap[parts[2]];
    const from = pointMap[parts[3]];
    const dx = baseEnd.x - baseStart.x;
    const dy = baseEnd.y - baseStart.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      const perpendicularX = -dy / length;
      const perpendicularY = dx / length;
      return (
        <line
          x1={from.x - perpendicularX * 10000}
          y1={from.y - perpendicularY * 10000}
          x2={from.x + perpendicularX * 10000}
          y2={from.y + perpendicularY * 10000}
          className="stroke-blue-400 stroke-[4px] opacity-80"
          strokeLinecap="round"
        />
      );
    }
  }
  if (type === 'bisector' && pointMap[parts[1]] && pointMap[parts[2]]) {
    const start = pointMap[parts[1]];
    const end = pointMap[parts[2]];
    const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      const perpendicularX = -dy / length;
      const perpendicularY = dx / length;
      return (
        <line
          x1={midpoint.x - perpendicularX * 10000}
          y1={midpoint.y - perpendicularY * 10000}
          x2={midpoint.x + perpendicularX * 10000}
          y2={midpoint.y + perpendicularY * 10000}
          className="stroke-blue-400 stroke-[4px] opacity-80"
          strokeLinecap="round"
        />
      );
    }
  }
  if (type === 'anglebisector' && pointMap[parts[1]] && pointMap[parts[2]] && pointMap[parts[3]]) {
    const side1 = pointMap[parts[1]];
    const vertex = pointMap[parts[2]];
    const side2 = pointMap[parts[3]];
    const v1 = { x: side1.x - vertex.x, y: side1.y - vertex.y };
    const v2 = { x: side2.x - vertex.x, y: side2.y - vertex.y };
    const length1 = Math.hypot(v1.x, v1.y);
    const length2 = Math.hypot(v2.x, v2.y);
    if (length1 > 0 && length2 > 0) {
      const direction = {
        x: v1.x / length1 + v2.x / length2,
        y: v1.y / length1 + v2.y / length2,
      };
      const directionLength = Math.hypot(direction.x, direction.y);
      if (directionLength > 0) {
        return (
          <line
            x1={vertex.x}
            y1={vertex.y}
            x2={vertex.x + direction.x / directionLength * 10000}
            y2={vertex.y + direction.y / directionLength * 10000}
            className="stroke-blue-400 stroke-[4px] opacity-80"
            strokeLinecap="round"
          />
        );
      }
    }
  }
  if (type === 'altitude' && pointMap[parts[1]] && pointMap[parts[2]] && pointMap[parts[3]]) {
    const side1 = pointMap[parts[1]];
    const vertex = pointMap[parts[2]];
    const side2 = pointMap[parts[3]];
    const dx = side2.x - side1.x;
    const dy = side2.y - side1.y;
    const denominator = dx * dx + dy * dy;
    if (denominator > 0) {
      const t = ((vertex.x - side1.x) * dx + (vertex.y - side1.y) * dy) / denominator;
      const foot = { x: side1.x + t * dx, y: side1.y + t * dy };
      return (
        <g>
          <line x1={vertex.x} y1={vertex.y} x2={foot.x} y2={foot.y} className="stroke-blue-400 stroke-[4px] opacity-80" />
          <circle cx={foot.x} cy={foot.y} r={5} className="fill-blue-400 stroke-white stroke-[2px]" />
        </g>
      );
    }
  }
  if (type === 'allaltitudes' && pointMap[parts[1]] && pointMap[parts[2]] && pointMap[parts[3]]) {
    const a = pointMap[parts[1]];
    const b = pointMap[parts[2]];
    const c = pointMap[parts[3]];
    const project = (point: OverlayPoint, line1: OverlayPoint, line2: OverlayPoint) => {
      const dx = line2.x - line1.x;
      const dy = line2.y - line1.y;
      const denominator = dx * dx + dy * dy;
      if (denominator === 0) return null;
      const t = ((point.x - line1.x) * dx + (point.y - line1.y) * dy) / denominator;
      return { x: line1.x + t * dx, y: line1.y + t * dy };
    };
    const footA = project(a, b, c);
    const footB = project(b, a, c);
    const footC = project(c, a, b);
    if (footA && footB && footC) {
      return (
        <g className="stroke-blue-400 opacity-80">
          <line x1={a.x} y1={a.y} x2={footA.x} y2={footA.y} strokeWidth={4} />
          <line x1={b.x} y1={b.y} x2={footB.x} y2={footB.y} strokeWidth={4} />
          <line x1={c.x} y1={c.y} x2={footC.x} y2={footC.y} strokeWidth={4} />
          {[footA, footB, footC].map((foot, index) => (
            <circle key={index} cx={foot.x} cy={foot.y} r={5} className="fill-blue-400 stroke-white stroke-[2px]" />
          ))}
        </g>
      );
    }
  }
  return null;
});
HoverHighlightLayer.displayName = 'HoverHighlightLayer';

const formatMeasurement = (value: number) => {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const MeasurementBadge = ({ x, y, text }: { x: number; y: number; text: string }) => {
  const width = Math.max(34, text.length * 4.8 + 12);
  return (
    <g data-measurement-overlay className="pointer-events-none">
      <rect
        x={x - width / 2}
        y={y - 13}
        width={width}
        height={14}
        rx={3}
        fill="var(--surface-raised)"
        stroke="var(--border-strong)"
        strokeWidth={0.45}
        opacity={0.94}
      />
      <text x={x} y={y - 6} fill="var(--text)" fontSize={5} textAnchor="middle" dominantBaseline="central">{text}</text>
    </g>
  );
};

const MeasurementOverlayLayer = memo(({
  showMeasurements,
  selectedNode,
  hoveredNode,
  parsedNodes,
  pointMap,
  worldPoints,
}: {
  showMeasurements: boolean;
  selectedNode: string | null;
  hoveredNode: string | null;
  parsedNodes: AstNode[];
  pointMap: OverlayPointMap;
  worldPoints: ReadonlyMap<string, { x: number; y: number }>;
}) => {
  if (!showMeasurements) return null;
  const nodeId = selectedNode ?? hoveredNode;
  if (!nodeId) return null;
  const node = parsedNodes.find(item => getNodeId(item) === nodeId);
  if (!node) return null;

  const worldDistance = (first: string, second: string) => {
    const a = worldPoints.get(first);
    const b = worldPoints.get(second);
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : null;
  };
  const svgMidpoint = (first: string, second: string) => {
    const a = pointMap[first];
    const b = pointMap[second];
    return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
  };
  const perimeter = (points: string[], closed: boolean) => {
    let total = 0;
    for (let index = 0; index < points.length - 1; index++) {
      const distance = worldDistance(points[index], points[index + 1]);
      if (distance === null) return null;
      total += distance;
    }
    if (closed && points.length > 2) {
      const distance = worldDistance(points[points.length - 1], points[0]);
      if (distance === null) return null;
      total += distance;
    }
    return total;
  };
  const centroid = (points: string[]) => {
    const svgPoints = points.map(point => pointMap[point]);
    if (svgPoints.some(point => !point)) return null;
    const validPoints = svgPoints as OverlayPoint[];
    return {
      x: validPoints.reduce((sum, point) => sum + point.x, 0) / validPoints.length,
      y: validPoints.reduce((sum, point) => sum + point.y, 0) / validPoints.length,
    };
  };
  const pointBadge = (name: string) => {
    const svgPoint = pointMap[name];
    const worldPoint = worldPoints.get(name);
    if (!svgPoint || !worldPoint) return null;
    return <MeasurementBadge x={svgPoint.x} y={svgPoint.y - 9} text={`${name} (${formatMeasurement(worldPoint.x)}, ${formatMeasurement(worldPoint.y)})`} />;
  };

  if (node.type === 'Point') return pointBadge(node.name);
  if (node.type === 'MidPoint' || node.type === 'GoldenRatioPoint' || node.type === 'BarycentricPoint' || node.type === 'SimilitudeCenter' || node.type === 'HarmonicPoint' || node.type === 'MidArcPoint' || node.type === 'PointOnLine' || node.type === 'PointOnCircle' || node.type === 'TriangleCenter' || node.type === 'PointTransformation' || node.type === 'VectorPoint' || node.type === 'DefinedTriangle' || node.type === 'RandomPoint') {
    return pointBadge(node.name);
  }
  if (node.type === 'Segment' || node.type === 'Line') {
    const distance = worldDistance(node.p1, node.p2);
    const midpoint = svgMidpoint(node.p1, node.p2);
    if (distance === null || !midpoint) return null;
    return <MeasurementBadge x={midpoint.x} y={midpoint.y - 7} text={`${node.p1}${node.p2} = ${formatMeasurement(distance)}`} />;
  }
  if (node.type === 'Circle' || node.type === 'SemiCircle') {
    const center = node.type === 'Circle' ? node.center : node.center;
    const radiusPoint = node.type === 'Circle' ? node.radius_point : node.radius_point;
    const radius = worldDistance(center, radiusPoint);
    const svgCenter = pointMap[center];
    const svgRadiusPoint = pointMap[radiusPoint];
    if (radius === null || !svgCenter || !svgRadiusPoint) return null;
    return <MeasurementBadge x={(svgCenter.x + svgRadiusPoint.x) / 2} y={(svgCenter.y + svgRadiusPoint.y) / 2 - 7} text={`r = ${formatMeasurement(radius)}`} />;
  }
  if (node.type === 'Polygon' || node.type === 'FillPolygon' || node.type === 'PolySeg') {
    const total = perimeter(node.points, node.type !== 'PolySeg');
    const center = centroid(node.points);
    if (total === null || !center) return null;
    return <MeasurementBadge x={center.x} y={center.y - 9} text={`${node.type === 'PolySeg' ? 'length' : 'perim'} = ${formatMeasurement(total)}`} />;
  }
  if (node.type === 'Segments') {
    const badges = node.pairs.map(([p1, p2]) => {
      const distance = worldDistance(p1, p2);
      const midpoint = svgMidpoint(p1, p2);
      return distance !== null && midpoint ? <MeasurementBadge key={`${p1}-${p2}`} x={midpoint.x} y={midpoint.y - 7} text={`${p1}${p2} = ${formatMeasurement(distance)}`} /> : null;
    });
    return <>{badges}</>;
  }
  if (node.type === 'Circles' || node.type === 'SemiCircles') {
    return (
      <>
        {node.pairs.map(([center, radiusPoint]) => {
          const radius = worldDistance(center, radiusPoint);
          const svgCenter = pointMap[center];
          const svgRadiusPoint = pointMap[radiusPoint];
          return radius !== null && svgCenter && svgRadiusPoint
            ? <MeasurementBadge key={`${center}-${radiusPoint}`} x={(svgCenter.x + svgRadiusPoint.x) / 2} y={(svgCenter.y + svgRadiusPoint.y) / 2 - 7} text={`r = ${formatMeasurement(radius)}`} />
            : null;
        })}
      </>
    );
  }
  return null;
});
MeasurementOverlayLayer.displayName = 'MeasurementOverlayLayer';

const ConstructionPreviewLayer = memo(({
  activeTool,
  selectedPoints,
  pointMap,
  previewPoint,
}: {
  activeTool: string;
  selectedPoints: string[];
  pointMap: OverlayPointMap;
  previewPoint: ConstructionPreviewPoint | null;
}) => {
  if (!previewPoint || selectedPoints.length === 0) return null;

  const strokeClass = 'pointer-events-none fill-none stroke-sky-500 stroke-[2px] opacity-75 [stroke-dasharray:6_4]';
  const fillClass = 'pointer-events-none fill-sky-500/10 stroke-sky-500 stroke-[2px] opacity-75 [stroke-dasharray:6_4]';
  const first = pointMap[selectedPoints[0]];
  const last = pointMap[selectedPoints[selectedPoints.length - 1]];
  if (!first || !last) return null;

  const finiteLine = (kind: string, start: OverlayPoint, end: OverlayPoint) => (
    <line data-construction-preview={kind} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className={strokeClass} strokeLinecap="round" />
  );

  const infiniteLine = (kind: string, start: OverlayPoint, end: OverlayPoint) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) return null;
    return (
      <line
        data-construction-preview={kind}
        x1={start.x - dx / length * 10000}
        y1={start.y - dy / length * 10000}
        x2={end.x + dx / length * 10000}
        y2={end.y + dy / length * 10000}
        className={strokeClass}
        strokeLinecap="round"
      />
    );
  };

  if (['add_segment', 'add_segments', 'mark_segment', 'mark_segments', 'label_segment'].includes(activeTool)) {
    return finiteLine('segment', last, previewPoint);
  }

  if (['add_line', 'add_lines', 'label_line'].includes(activeTool)) {
    return infiniteLine('line', last, previewPoint);
  }

  if (['add_circle', 'add_circles', 'fill_circle', 'label_circle'].includes(activeTool)) {
    const radius = Math.hypot(previewPoint.x - first.x, previewPoint.y - first.y);
    if (radius <= 0) return null;
    return <circle data-construction-preview="circle" cx={first.x} cy={first.y} r={radius} className={activeTool === 'fill_circle' ? fillClass : strokeClass} />;
  }

  if (['add_semicircle', 'add_semicircles'].includes(activeTool)) {
    const radius = Math.hypot(previewPoint.x - first.x, previewPoint.y - first.y);
    if (radius <= 0) return null;
    const opposite = { x: first.x * 2 - previewPoint.x, y: first.y * 2 - previewPoint.y };
    return <path data-construction-preview="semicircle" d={`M ${previewPoint.x} ${previewPoint.y} A ${radius} ${radius} 0 0 0 ${opposite.x} ${opposite.y}`} className={strokeClass} strokeLinecap="round" />;
  }

  if (activeTool === 'add_arc' && selectedPoints.length >= 2) {
    const start = pointMap[selectedPoints[1]];
    if (!start) return null;
    const radius = Math.hypot(start.x - first.x, start.y - first.y);
    const directionLength = Math.hypot(previewPoint.x - first.x, previewPoint.y - first.y);
    if (radius <= 0 || directionLength <= 0) return null;
    const end = {
      x: first.x + (previewPoint.x - first.x) * radius / directionLength,
      y: first.y + (previewPoint.y - first.y) * radius / directionLength,
    };
    const startAngle = Math.atan2(start.y - first.y, start.x - first.x);
    const endAngle = Math.atan2(end.y - first.y, end.x - first.x);
    const counterClockwiseAngle = (startAngle - endAngle + Math.PI * 2) % (Math.PI * 2);
    const largeArc = counterClockwiseAngle > Math.PI ? 1 : 0;
    return <path data-construction-preview="arc" d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`} className={strokeClass} strokeLinecap="round" />;
  }

  if (['add_polyseg', 'add_polygon', 'fill_polygon'].includes(activeTool)) {
    const points = selectedPoints.map(name => pointMap[name]);
    if (points.some(point => !point)) return null;
    const pointsAttr = [...(points as OverlayPoint[]), previewPoint].map(point => `${point.x},${point.y}`).join(' ');
    return <polyline data-construction-preview={activeTool === 'add_polyseg' ? 'polyseg' : 'polygon'} points={pointsAttr} className={strokeClass} strokeLinejoin="round" strokeLinecap="round" />;
  }

  return null;
});
ConstructionPreviewLayer.displayName = 'ConstructionPreviewLayer';

const ShapeHitTargetsLayer = memo(({
  parsedNodes,
  pointMap,
  activeTool,
  onObjectMouseDown,
  onSegmentMouseDown,
  onNodeHover,
}: {
  parsedNodes: AstNode[];
  pointMap: OverlayPointMap;
  activeTool: string;
  onObjectMouseDown: ObjectMouseDownHandler;
  onSegmentMouseDown: SegmentMouseDownHandler;
  onNodeHover: NodeHoverHandler;
}) => {
  const segmentToolActive = ['add_intersection', 'add_perpendicular', 'add_projection', 'add_perpendicular_bisector'].includes(activeTool);
  if (activeTool !== 'cursor' && !segmentToolActive) return null;

  const hoverProps = (nodeId: string) => ({
    onMouseEnter: () => onNodeHover(nodeId),
    onMouseLeave: () => onNodeHover(null),
  });

  const objectProps = (nodeId: string) => ({
    'data-hit-target': nodeId,
    className: 'stroke-transparent pointer-events-auto cursor-pointer hover:stroke-blue-400/30',
    onMouseDown: (event: ReactMouseEvent) => onObjectMouseDown(event, nodeId),
    ...hoverProps(nodeId),
  });

  const segmentProps = (nodeId: string, p1: string, p2: string) => ({
    'data-hit-target': nodeId,
    className: 'stroke-transparent pointer-events-auto cursor-pointer hover:stroke-blue-400/30',
    onMouseDown: (event: ReactMouseEvent) => segmentToolActive ? onSegmentMouseDown(event, p1, p2, nodeId) : onObjectMouseDown(event, nodeId),
    ...hoverProps(nodeId),
  });

  const lineTarget = (key: string, nodeId: string, p1: OverlayPoint, p2: OverlayPoint, infinite = false) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) return null;
    const inset = infinite ? 0 : Math.min(8, length / 3);
    const start = infinite
      ? { x: p1.x - dx / length * 10000, y: p1.y - dy / length * 10000 }
      : { x: p1.x + dx / length * inset, y: p1.y + dy / length * inset };
    const end = infinite
      ? { x: p2.x + dx / length * 10000, y: p2.y + dy / length * 10000 }
      : { x: p2.x - dx / length * inset, y: p2.y - dy / length * inset };
    return <line key={key} x1={start.x} y1={start.y} x2={end.x} y2={end.y} strokeWidth={15} strokeLinecap="round" {...objectProps(nodeId)} />;
  };

  const segmentTarget = (key: string, nodeId: string, startName: string, endName: string) => {
    const p1 = pointMap[startName];
    const p2 = pointMap[endName];
    if (!p1 || !p2) return null;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) return null;
    const inset = Math.min(8, length / 3);
    const start = { x: p1.x + dx / length * inset, y: p1.y + dy / length * inset };
    const end = { x: p2.x - dx / length * inset, y: p2.y - dy / length * inset };
    return <line key={key} x1={start.x} y1={start.y} x2={end.x} y2={end.y} strokeWidth={15} strokeLinecap="round" {...segmentProps(nodeId, startName, endName)} />;
  };

  const circleTarget = (key: string, nodeId: string, centerName: string, radiusName: string) => {
    const center = pointMap[centerName];
    const radiusPoint = pointMap[radiusName];
    if (!center || !radiusPoint) return null;
    const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y);
    if (radius <= 0) return null;
    return <circle key={key} cx={center.x} cy={center.y} r={radius} fill="none" strokeWidth={15} {...objectProps(nodeId)} />;
  };

  const polygonTarget = (key: string, nodeId: string, pointNames: string[], closed: boolean) => {
    const points = pointNames.map(name => pointMap[name]);
    if (points.some(point => !point)) return null;
    const pointsAttr = (points as OverlayPoint[]).map(point => `${point.x},${point.y}`).join(' ');
    if (closed) {
      return <polygon key={key} points={pointsAttr} fill="transparent" strokeWidth={15} strokeLinejoin="round" pointerEvents="all" {...objectProps(nodeId)} />;
    }
    return <polyline key={key} points={pointsAttr} fill="none" strokeWidth={15} strokeLinejoin="round" strokeLinecap="round" {...objectProps(nodeId)} />;
  };

  const arcTarget = (key: string, nodeId: string, center: OverlayPoint, start: OverlayPoint, endDirection: OverlayPoint, swapped = false) => {
    const radius = Math.hypot(start.x - center.x, start.y - center.y);
    const directionLength = Math.hypot(endDirection.x - center.x, endDirection.y - center.y);
    if (radius <= 0 || directionLength <= 0) return null;
    const end = {
      x: center.x + (endDirection.x - center.x) * radius / directionLength,
      y: center.y + (endDirection.y - center.y) * radius / directionLength,
    };
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    const counterClockwiseAngle = (startAngle - endAngle + Math.PI * 2) % (Math.PI * 2);
    const largeArc = counterClockwiseAngle > Math.PI ? 1 : 0;
    const path = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${swapped ? 1 : 0} ${end.x} ${end.y}`;
    return <path key={key} d={path} fill="none" strokeWidth={15} strokeLinecap="round" {...objectProps(nodeId)} />;
  };

  return (
    <>
      {parsedNodes.map((node, index) => {
        const nodeId = getNodeId(node);
        if (node.type === 'Segment') return segmentTarget(`${nodeId}-${index}`, nodeId, node.p1, node.p2);
        if (node.type === 'Segments') {
          return <g key={`${nodeId}-${index}`}>{node.pairs.map(([p1, p2], pairIndex) => segmentTarget(`${nodeId}-${pairIndex}`, nodeId, p1, p2))}</g>;
        }
        if (activeTool !== 'cursor') return null;
        if (node.type === 'Line') {
          const p1 = pointMap[node.p1];
          const p2 = pointMap[node.p2];
          return p1 && p2 ? lineTarget(`${nodeId}-${index}`, nodeId, p1, p2, true) : null;
        }
        if (node.type === 'Lines') {
          return <g key={`${nodeId}-${index}`}>{node.pairs.map(([start, end], pairIndex) => {
            const p1 = pointMap[start];
            const p2 = pointMap[end];
            return p1 && p2 ? lineTarget(`${nodeId}-${pairIndex}`, nodeId, p1, p2, true) : null;
          })}</g>;
        }
        if (node.type === 'PolySeg') return polygonTarget(`${nodeId}-${index}`, nodeId, node.points, false);
        if (node.type === 'Polygon') return polygonTarget(`${nodeId}-${index}`, nodeId, node.points, true);
        if (node.type === 'Circle') return circleTarget(`${nodeId}-${index}`, nodeId, node.center, node.radius_point);
        if (node.type === 'Circles') {
          return <g key={`${nodeId}-${index}`}>{node.pairs.map(([center, radius], pairIndex) => circleTarget(`${nodeId}-${pairIndex}`, nodeId, center, radius))}</g>;
        }
        if (node.type === 'SemiCircle') {
          const center = pointMap[node.center];
          const start = pointMap[node.radius_point];
          if (!center || !start) return null;
          const opposite = { x: center.x * 2 - start.x, y: center.y * 2 - start.y };
          const swapped = node.options?.includes('swap') ?? false;
          return arcTarget(`${nodeId}-${index}`, nodeId, center, start, opposite, swapped);
        }
        if (node.type === 'SemiCircles') {
          return <g key={`${nodeId}-${index}`}>{node.pairs.map(([centerName, radiusName], pairIndex) => {
            const center = pointMap[centerName];
            const start = pointMap[radiusName];
            if (!center || !start) return null;
            const opposite = { x: center.x * 2 - start.x, y: center.y * 2 - start.y };
            const swapped = node.options?.includes('swap') ?? false;
            return arcTarget(`${nodeId}-${pairIndex}`, nodeId, center, start, opposite, swapped);
          })}</g>;
        }
        if (node.type === 'Arc' && node.mode === 'towards') {
          const center = pointMap[node.center];
          const start = pointMap[node.first];
          const endDirection = pointMap[node.second[0]];
          return center && start && endDirection ? arcTarget(`${nodeId}-${index}`, nodeId, center, start, endDirection) : null;
        }
        return null;
      })}
    </>
  );
});
ShapeHitTargetsLayer.displayName = 'ShapeHitTargetsLayer';

const PointHandlesLayer = memo(({
  showHandles,
  parsedNodes,
  pointMap,
  activeTool,
  selectedPoints,
  onPointMouseDown,
  onNodeHover,
}: {
  showHandles: boolean;
  parsedNodes: AstNode[];
  pointMap: OverlayPointMap;
  activeTool: string;
  selectedPoints: string[];
  onPointMouseDown: PointMouseDownHandler;
  onNodeHover: (nodeId: string | null) => void;
}) => {
  if (!showHandles) return null;

  const hoverProps = (nodeId: string) => ({
    onMouseEnter: () => onNodeHover(nodeId),
    onMouseLeave: () => onNodeHover(null),
  });

  return (
    <>
      {parsedNodes.map((node, i) => {
        if (node.type === 'Point') {
          const p = pointMap[node.name];
          if (!p) return null;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              className={`fill-red-500 stroke-white stroke-2 pointer-events-auto ${activeTool === 'pan' ? 'cursor-grab' : activeTool === 'cursor' ? 'cursor-move' : 'cursor-crosshair'} ${selectedPoints.includes(node.name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`}
              onMouseDown={(e) => onPointMouseDown(e, node.name, getNodeId(node))}
              {...hoverProps(getNodeId(node))}
            />
          );
        }
        if (node.type === 'MidPoint') {
          const p = pointMap[node.name];
          if (!p) return null;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              className={`fill-cyan-500 stroke-white stroke-2 pointer-events-auto ${activeTool === 'pan' ? 'cursor-grab' : 'cursor-pointer'} ${selectedPoints.includes(node.name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`}
              onMouseDown={(e) => onPointMouseDown(e, node.name, getNodeId(node))}
              {...hoverProps(getNodeId(node))}
            />
          );
        }
        if (node.type === 'GoldenRatioPoint' || node.type === 'BarycentricPoint') {
          const p = pointMap[node.name];
          if (!p) return null;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              className={`stroke-white stroke-2 pointer-events-auto cursor-pointer ${node.type === 'GoldenRatioPoint' ? 'fill-amber-500' : 'fill-purple-500'} ${selectedPoints.includes(node.name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`}
              onMouseDown={(e) => onPointMouseDown(e, node.name, getNodeId(node))}
              {...hoverProps(getNodeId(node))}
            />
          );
        }
        if (node.type === 'SimilitudeCenter' || node.type === 'HarmonicPoint') {
          const p = pointMap[node.name];
          if (!p) return null;
          return <circle key={i} cx={p.x} cy={p.y} r={4} className={`stroke-white stroke-2 pointer-events-auto cursor-pointer ${node.type === 'SimilitudeCenter' ? 'fill-teal-500' : 'fill-pink-500'} ${selectedPoints.includes(node.name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, node.name, getNodeId(node))} {...hoverProps(getNodeId(node))} />;
        }
        if (node.type === 'HarmonicPair' || node.type === 'EquiPoints') {
          return (
            <g key={i}>
              {[node.name1, node.name2].map(name => pointMap[name] && <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={4} className={`stroke-white stroke-2 pointer-events-auto cursor-pointer ${node.type === 'HarmonicPair' ? 'fill-pink-500' : 'fill-sky-500'} ${selectedPoints.includes(name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, name, getNodeId(node))} {...hoverProps(getNodeId(node))} />)}
            </g>
          );
        }
        if (node.type === 'MidArcPoint' || node.type === 'PointOnLine' || node.type === 'PointOnCircle' || node.type === 'RandomPoint') {
          const p = pointMap[node.name];
          if (!p) return null;
          return <circle key={i} cx={p.x} cy={p.y} r={4} className={`stroke-white stroke-2 pointer-events-auto cursor-pointer ${node.type === 'MidArcPoint' ? 'fill-orange-500' : node.type === 'PointOnLine' ? 'fill-green-500' : 'fill-indigo-500'} ${selectedPoints.includes(node.name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, node.name, getNodeId(node))} {...hoverProps(getNodeId(node))} />;
        }
        if (node.type === 'TriangleCenter') {
          const p = pointMap[node.name];
          if (!p) return null;
          return <circle key={i} cx={p.x} cy={p.y} r={4} className={`fill-rose-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(node.name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, node.name, getNodeId(node))} {...hoverProps(getNodeId(node))} />;
        }
        if (node.type === 'PointTransformation') {
          const p = pointMap[node.name];
          if (!p) return null;
          return <circle key={i} cx={p.x} cy={p.y} r={4} className={`fill-violet-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(node.name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, node.name, getNodeId(node))} {...hoverProps(getNodeId(node))} />;
        }
        if (node.type === 'PointsTransformation') {
          return <g key={i}>{node.names.map(name => pointMap[name] && <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={4} className={`fill-fuchsia-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, name, getNodeId(node))} {...hoverProps(getNodeId(node))} />)}</g>;
        }
        if (node.type === 'VectorPoint') {
          const p = pointMap[node.name];
          if (!p) return null;
          return <circle key={i} cx={p.x} cy={p.y} r={4} className={`fill-sky-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(node.name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, node.name, getNodeId(node))} {...hoverProps(getNodeId(node))} />;
        }
        if (node.type === 'DefinedLine') {
          return <g key={i}>{node.results.map(name => pointMap[name] && <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={4} className={`fill-blue-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, name, getNodeId(node))} {...hoverProps(getNodeId(node))} />)}</g>;
        }
        if (node.type === 'DefinedTriangle') {
          const p = pointMap[node.name];
          if (!p) return null;
          return <circle key={i} cx={p.x} cy={p.y} r={4} className={`fill-rose-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(node.name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, node.name, getNodeId(node))} {...hoverProps(getNodeId(node))} />;
        }
        if (node.type === 'AssociatedTriangle') {
          return <g key={i}>{node.results.map(name => pointMap[name] && <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={4} className={`fill-purple-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, name, getNodeId(node))} {...hoverProps(getNodeId(node))} />)}</g>;
        }
        if (node.type === 'PolygonConstruction' && node.mode !== 'permute') {
          return <g key={i}>{node.results.map(name => pointMap[name] && <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={4} className={`fill-emerald-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, name, getNodeId(node))} {...hoverProps(getNodeId(node))} />)}</g>;
        }
        if (node.type === 'DefinedCircle') {
          return <g key={i}>{node.results.map(name => pointMap[name] && <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={4} className={`fill-cyan-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, name, getNodeId(node))} {...hoverProps(getNodeId(node))} />)}</g>;
        }
        if (node.type === 'ProjectedExcenters' || node.type === 'CircleTransformation') {
          return <g key={i}>{node.results.map(name => pointMap[name] && <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={4} className={`stroke-white stroke-2 pointer-events-auto cursor-pointer ${node.type === 'ProjectedExcenters' ? 'fill-orange-600' : 'fill-fuchsia-600'} ${selectedPoints.includes(name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, name, getNodeId(node))} {...hoverProps(getNodeId(node))} />)}</g>;
        }
        if (node.type === 'LineCircleIntersection' || node.type === 'CircleCircleIntersection') {
          return <g key={i}>{node.results.map(name => pointMap[name] && <circle key={name} cx={pointMap[name].x} cy={pointMap[name].y} r={4} className={`fill-blue-600 stroke-white stroke-2 pointer-events-auto cursor-pointer ${selectedPoints.includes(name) ? 'fill-yellow-400 stroke-yellow-200' : 'hover:opacity-80'}`} onMouseDown={event => onPointMouseDown(event, name, getNodeId(node))} {...hoverProps(getNodeId(node))} />)}</g>;
        }
        return null;
      })}
    </>
  );
});
PointHandlesLayer.displayName = 'PointHandlesLayer';

interface PreviewProps {
  shortcutScope?: 'window' | 'canvas';
}

export function Preview({ shortcutScope = 'window' }: PreviewProps = {}) {
  const { parsedSource, svgOutput, errorLog, isCompiling, parsedNodes, resolvedPoints, resolvedViewport, selectedPoints, hoveredNode, selectedNode, showHandles, showMeasurements, zoomLevel, showGrid, showAxes, axisSettings, canvasGridStep, pan, setPan, setCanvasView, activeTool, fitViewRequest, previewMode } = useEditorStore(useShallow(state => ({
    parsedSource: state.parsedSource,
    svgOutput: state.svgOutput,
    errorLog: state.errorLog,
    isCompiling: state.isCompiling,
    parsedNodes: state.parsedNodes,
    resolvedPoints: state.resolvedPoints,
    resolvedViewport: state.resolvedViewport,
    selectedPoints: state.selectedPoints,
    hoveredNode: state.hoveredNode,
    selectedNode: state.selectedNode,
    showHandles: state.showHandles,
    showMeasurements: state.showMeasurements,
    zoomLevel: state.zoomLevel,
    showGrid: state.showGrid,
    showAxes: state.showAxes,
    axisSettings: state.settings,
    canvasGridStep: state.settings.canvasGridStep,
    pan: state.pan,
    setPan: state.setPan,
    setCanvasView: state.setCanvasView,
    activeTool: state.activeTool,
    fitViewRequest: state.fitViewRequest,
    previewMode: state.previewMode,
  })));
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionCleanupRef = useRef<((updateState: boolean) => void) | null>(null);
  const wheelFrameRef = useRef<number | null>(null);
  const pendingWheelRef = useRef({ deltaY: 0, clientX: 0, clientY: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [latexViewBox, setLatexViewBox] = useState<string | null>(null);
  const [latexTransform, setLatexTransform] = useState<Transform | null>(null);
  const viewportBuildMsRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const rect = container.getBoundingClientRect();
      setCanvasSize(previous => (
        previous.width === rect.width && previous.height === rect.height
          ? previous
          : { width: rect.width, height: rect.height }
      ));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (wheelFrameRef.current !== null) window.cancelAnimationFrame(wheelFrameRef.current);
  }, []);

  const cancelActiveInteraction = useCallback((updateState = true) => {
    const cleanup = interactionCleanupRef.current;
    interactionCleanupRef.current = null;
    cleanup?.(updateState);
  }, []);

  useEffect(() => () => cancelActiveInteraction(false), [cancelActiveInteraction]);
  const fastViewport = useMemo(() => {
    const startedAt = nowMs();
    const viewport = buildFastViewport(parsedNodes, resolvedPoints, resolvedViewport?.viewBox);
    viewportBuildMsRef.current = nowMs() - startedAt;
    return viewport;
  }, [parsedNodes, resolvedPoints, resolvedViewport]);
  const fastRenderScene = useMemo<FastRenderScene>(
    () => buildFastRenderScene({
      nodes: parsedNodes,
      viewBox: fastViewport.viewBox,
      resolvedPoints: fastViewport.points,
      source: parsedSource,
    }),
    [fastViewport.points, fastViewport.viewBox, parsedNodes, parsedSource],
  );
  const viewBox = previewMode === 'instant' ? fastViewport.viewBox : latexViewBox;
  const transform = previewMode === 'instant' ? fastViewport.transform : latexTransform;
  const latexDiagnostics = useMemo(() => summarizeLatexDiagnostics(errorLog), [errorLog]);
  const [dragPreviewPoint, setDragPreviewPoint] = useState<{ name: string; x: number; y: number } | null>(null);
  const [constructionPreviewPoint, setConstructionPreviewPoint] = useState<ConstructionPreviewPoint | null>(null);
  const overlayPointMap = useMemo(() => {
    const points: Record<string, { x: number; y: number }> = {};
    if (!transform) return points;
    fastViewport.points.forEach((point, name) => {
      points[name] = {
        x: transform.originX + point.x * transform.scaleX,
        y: transform.originY - point.y * transform.scaleY,
      };
    });
    if (dragPreviewPoint) {
      points[dragPreviewPoint.name] = {
        x: transform.originX + dragPreviewPoint.x * transform.scaleX,
        y: transform.originY - dragPreviewPoint.y * transform.scaleY,
      };
    }
    return points;
  }, [dragPreviewPoint, fastViewport.points, transform]);

  useEffect(() => {
    if (viewportBuildMsRef.current === null) return;
    const viewportBuildMs = viewportBuildMsRef.current;
    useEditorStore.getState().setPerformanceMetrics({ viewportBuildMs });
    logPerformance('viewport', {
      viewportBuildMs,
      rustViewBox: Boolean(resolvedViewport?.viewBox),
      pointCount: fastViewport.points.size,
      nodeCount: parsedNodes.length,
    });
  }, [fastViewport, parsedNodes.length, resolvedViewport?.viewBox]);

  // Spacebar pan state
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const lastFitRequestRef = useRef(fitViewRequest);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return !!element && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) ||
        element.isContentEditable
      );
    };

    const zoomAtCenter = (factor: number) => {
      const state = useEditorStore.getState();
      const nextZoom = Math.min(Math.max(state.zoomLevel * factor, 0.1), 5);
      const ratio = nextZoom / state.zoomLevel;
      state.setCanvasView({
        zoomLevel: nextZoom,
        pan: { x: state.pan.x * ratio, y: state.pan.y * ratio },
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        shortcutScope === 'canvas' &&
        !containerRef.current?.contains(document.activeElement)
      ) {
        return;
      }
      if (isTypingTarget(e.target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
      } else if (e.code === 'KeyH') {
        useEditorStore.getState().setActiveTool('pan');
      } else if (e.code === 'Enter' && completeCollectionDrawing()) {
        e.preventDefault();
      } else if (e.code === 'KeyV' || e.code === 'Escape') {
        const state = useEditorStore.getState();
        state.setSelectedPoints([]);
        state.setActiveTool('cursor');
      } else if (e.code === 'KeyF') {
        useEditorStore.getState().requestFitView();
      } else if (e.code === 'Digit0' || e.code === 'Numpad0') {
        useEditorStore.getState().setCanvasView({ zoomLevel: 1, pan: { x: 0, y: 0 } });
      } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomAtCenter(1.2);
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomAtCenter(1 / 1.2);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    const onBlur = () => setSpacePressed(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [shortcutScope]);

  useEffect(() => {
    if (!svgOutput || !containerRef.current) return;

    const timer = setTimeout(() => {
      const svgElement = containerRef.current?.querySelector('[data-latex-preview] > svg');
      if (!svgElement) return;

      setLatexViewBox(svgElement.getAttribute('viewBox'));

      const parseAnchor = (id: string) => {
        const el = svgElement.querySelector(`#${id}`);
        if (!el) return null;
        const dx = parseFloat(el.getAttribute('data-dvi-x') || '0');
        const dy = parseFloat(el.getAttribute('data-dvi-y') || '0');
        const matrixStr = el.getAttribute('data-matrix');
        let e = 0, f = 0;
        if (matrixStr) {
          const match = matrixStr.match(/matrix\(([^)]+)\)/);
          if (match) {
            const parts = match[1].trim().split(/[\s,]+/);
            if (parts.length >= 6) {
              e = parseFloat(parts[4]);
              f = parseFloat(parts[5]);
            }
          }
        }
        return { x: dx + e, y: dy + f };
      };

      const origin = parseAnchor('ITZ_ORIGIN');
      const unitX = parseAnchor('ITZ_UNIT_X');
      const unitY = parseAnchor('ITZ_UNIT_Y');

      if (origin && unitX && unitY) {
        setLatexTransform({
          originX: origin.x,
          originY: origin.y,
          scaleX: unitX.x - origin.x,
          scaleY: origin.y - unitY.y, // Y grows downwards in SVG
        });
      }
    }, 10);

    return () => clearTimeout(timer);
  }, [previewMode, svgOutput]);

  useEffect(() => {
    if (!viewBox || !transform || !containerRef.current) return;
    if (lastFitRequestRef.current === fitViewRequest) return;

    const [minX, minY, width, height] = viewBox.split(' ').map(Number);
    const container = containerRef.current.getBoundingClientRect();
    if (![minX, minY, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;

    const padding = 64;
    const availableWidth = Math.max(container.width - padding * 2, 1);
    const availableHeight = Math.max(container.height - padding * 2, 1);
    const nextZoom = Math.min(Math.max(Math.min(availableWidth / width, availableHeight / height), 0.1), 5);
    const contentCenterOffsetX = -(transform.originX - minX) + width / 2;
    const contentCenterOffsetY = -(transform.originY - minY) + height / 2;

    const nextPanX = -contentCenterOffsetX * nextZoom;
    const nextPanY = -contentCenterOffsetY * nextZoom;
    setCanvasView({
      zoomLevel: nextZoom,
      pan: {
        x: Math.abs(nextPanX) < 1e-9 ? 0 : nextPanX,
        y: Math.abs(nextPanY) < 1e-9 ? 0 : nextPanY,
      },
    });
    lastFitRequestRef.current = fitViewRequest;
  }, [fitViewRequest, setCanvasView, transform, viewBox]);

  const processToolAction = useCallback((nodeName: string | null, newX?: number, newY?: number) => {
    const { activeTool, selectedPoints, setSelectedPoints } = useEditorStore.getState();

    // Construction tools may use an existing point or create one directly on
    // the empty canvas. Feed a newly created point back through the same flow.
    if (nodeName === null && newX !== undefined && newY !== undefined && activeTool !== 'cursor' && activeTool !== 'pan') {
      if (activeTool === 'add_point_polar') {
        const angle = ((Math.atan2(newY, newX) * 180 / Math.PI) + 360) % 360;
        const distance = Math.hypot(newX, newY);
        useEditorStore.getState().addPolarPoint(angle, distance);
        useEditorStore.getState().setActiveTool('cursor');
        return;
      }
      const newPoint = useEditorStore.getState().addPoint(newX, newY);
      if (activeTool === 'add_point') {
        useEditorStore.getState().setActiveTool('cursor');
      } else {
        processToolAction(newPoint);
      }
      return;
    }

    if (activeTool === 'cursor') {
      if (nodeName) {
        if (selectedPoints.includes(nodeName)) {
          setSelectedPoints(selectedPoints.filter(p => p !== nodeName));
        } else {
          setSelectedPoints([...selectedPoints, nodeName]);
        }
      } else {
        setSelectedPoints([]);
      }
    } else if (activeTool === 'add_compass') {
      if (nodeName) {
        if (selectedPoints.length === 0) setSelectedPoints([nodeName]);
        else if (selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addCompass(selectedPoints[0], nodeName);
          setSelectedPoints([]); useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_protractor') {
      if (nodeName) {
        if (selectedPoints.length === 0) setSelectedPoints([nodeName]);
        else if (selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addProtractor(selectedPoints[0], nodeName);
          setSelectedPoints([]); useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_compasses') {
      if (nodeName && !(selectedPoints.length % 2 === 1 && selectedPoints[selectedPoints.length - 1] === nodeName)) setSelectedPoints([...selectedPoints, nodeName]);
    } else if (activeTool === 'add_segment') {
      if (nodeName) {
        if (selectedPoints.length === 0) {
          setSelectedPoints([nodeName]);
        } else if (selectedPoints.length === 1 && selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addSegment(selectedPoints[0], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'mark_segment') {
      if (nodeName) {
        if (selectedPoints.length === 0) setSelectedPoints([nodeName]);
        else if (selectedPoints.length === 1 && selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addSegmentMark(selectedPoints[0], nodeName);
          setSelectedPoints([]); useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'label_point') {
      if (nodeName) {
        useEditorStore.getState().addPointLabel(nodeName);
        setSelectedPoints([]);
        useEditorStore.getState().setActiveTool('cursor');
      }
    } else if (activeTool === 'label_segment' || activeTool === 'label_line') {
      if (nodeName) {
        if (selectedPoints.length === 0) setSelectedPoints([nodeName]);
        else if (selectedPoints[0] !== nodeName) {
          if (activeTool === 'label_segment') useEditorStore.getState().addSegmentLabel(selectedPoints[0], nodeName);
          else useEditorStore.getState().addLineLabel(selectedPoints[0], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'label_circle') {
      if (nodeName) {
        if (selectedPoints.length === 0) setSelectedPoints([nodeName]);
        else if (selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addCircleLabel(selectedPoints[0], nodeName);
          setSelectedPoints([]); useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'label_arc') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) setSelectedPoints([...selectedPoints, nodeName]);
        else {
          useEditorStore.getState().addArcLabel(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]); useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (isPointCollectionTool(activeTool)) {
      if (nodeName && !selectedPoints.includes(nodeName)) setSelectedPoints([...selectedPoints, nodeName]);
    } else if (activeTool === 'add_line') {
      if (nodeName) {
        if (selectedPoints.length === 0) {
          setSelectedPoints([nodeName]);
        } else if (selectedPoints.length === 1 && selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addLine(selectedPoints[0], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_lines' || activeTool === 'add_segments') {
      if (nodeName && !(selectedPoints.length % 2 === 1 && selectedPoints[selectedPoints.length - 1] === nodeName)) {
        setSelectedPoints([...selectedPoints, nodeName]);
      }
    } else if (activeTool === 'mark_segments') {
      if (nodeName && !(selectedPoints.length % 2 === 1 && selectedPoints[selectedPoints.length - 1] === nodeName)) setSelectedPoints([...selectedPoints, nodeName]);
    } else if (activeTool === 'add_circles' || activeTool === 'add_semicircles') {
      if (nodeName && !(selectedPoints.length % 2 === 1 && selectedPoints[selectedPoints.length - 1] === nodeName)) {
        setSelectedPoints([...selectedPoints, nodeName]);
      }
    } else if (activeTool === 'add_polyseg') {
      if (nodeName && selectedPoints[selectedPoints.length - 1] !== nodeName) setSelectedPoints([...selectedPoints, nodeName]);
    } else if (activeTool === 'add_midpoint') {
      if (nodeName) {
        if (selectedPoints.length === 0) {
          setSelectedPoints([nodeName]);
        } else if (selectedPoints.length === 1 && selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addMidPoint(selectedPoints[0], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_golden_ratio') {
      if (nodeName) {
        if (selectedPoints.length === 0) {
          setSelectedPoints([nodeName]);
        } else if (selectedPoints.length === 1 && selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addGoldenRatioPoint(selectedPoints[0], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_polygon') {
      if (nodeName) {
        if (selectedPoints.includes(nodeName)) {
          if (selectedPoints.length >= 3 && selectedPoints[0] === nodeName) {
            useEditorStore.getState().addPolygon(selectedPoints);
            setSelectedPoints([]);
            useEditorStore.getState().setActiveTool('cursor');
          }
        } else {
          setSelectedPoints([...selectedPoints, nodeName]);
        }
      }
    } else if (activeTool === 'fill_polygon') {
      if (nodeName) {
        if (selectedPoints.includes(nodeName)) {
          if (selectedPoints.length >= 3 && selectedPoints[0] === nodeName) {
            useEditorStore.getState().fillPolygon(selectedPoints);
            setSelectedPoints([]);
            useEditorStore.getState().setActiveTool('cursor');
          }
        } else {
          setSelectedPoints([...selectedPoints, nodeName]);
        }
      }
    } else if (activeTool === 'add_circle') {
      if (nodeName) {
        if (selectedPoints.length === 0) {
          setSelectedPoints([nodeName]);
        } else if (selectedPoints.length === 1 && selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addCircle(selectedPoints[0], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'fill_circle') {
      if (nodeName) {
        if (selectedPoints.length === 0) {
          setSelectedPoints([nodeName]);
        } else if (selectedPoints.length === 1 && selectedPoints[0] !== nodeName) {
          useEditorStore.getState().fillCircle(selectedPoints[0], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_semicircle') {
      if (nodeName) {
        if (selectedPoints.length === 0) {
          setSelectedPoints([nodeName]);
        } else if (selectedPoints.length === 1 && selectedPoints[0] !== nodeName) {
          useEditorStore.getState().addSemiCircle(selectedPoints[0], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_arc') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else {
          useEditorStore.getState().addArc(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'mark_arc') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) setSelectedPoints([...selectedPoints, nodeName]);
        else {
          useEditorStore.getState().addArcMark(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]); useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_sector') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else {
          useEditorStore.getState().addSector(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'fill_sector') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else {
          useEditorStore.getState().fillSector(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_perpendicular') {
      if (nodeName) {
        if (selectedPoints.length < 2) {
          if (!selectedPoints.includes(nodeName)) {
            setSelectedPoints([...selectedPoints, nodeName]);
          }
        } else {
          useEditorStore.getState().addPerpendicularLine(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_projection') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else {
          useEditorStore.getState().addProjectionLine(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_perpendicular_bisector') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length === 0) {
          setSelectedPoints([nodeName]);
        } else {
          useEditorStore.getState().addPerpendicularBisector(selectedPoints[0], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_angle_bisector') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else {
          useEditorStore.getState().addAngleBisector(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_altitude') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else {
          useEditorStore.getState().addTriangleAltitude(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_all_altitudes') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else {
          useEditorStore.getState().addAllAltitudes(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'add_angle') {
      if (nodeName) {
        if (selectedPoints.length < 2 && !selectedPoints.includes(nodeName)) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else if (selectedPoints.length === 2 && !selectedPoints.includes(nodeName)) {
          useEditorStore.getState().addAngle(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'label_angle') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) setSelectedPoints([...selectedPoints, nodeName]);
        else {
          useEditorStore.getState().addAngleLabel(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]); useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'mark_right_angle') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) setSelectedPoints([...selectedPoints, nodeName]);
        else {
          useEditorStore.getState().addRightAngleMark(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'pic_angle' || activeTool === 'pic_right_angle') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) setSelectedPoints([...selectedPoints, nodeName]);
        else {
          if (activeTool === 'pic_angle') useEditorStore.getState().addPicAngle(selectedPoints[0], selectedPoints[1], nodeName);
          else useEditorStore.getState().addPicRightAngle(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (activeTool === 'fill_angle') {
      if (nodeName && !selectedPoints.includes(nodeName)) {
        if (selectedPoints.length < 2) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else {
          useEditorStore.getState().fillAngle(selectedPoints[0], selectedPoints[1], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    } else if (isTripleCollectionTool(activeTool)) {
      if (nodeName && !(selectedPoints.length % 3 > 0 && selectedPoints.slice(selectedPoints.length - selectedPoints.length % 3).includes(nodeName))) {
        setSelectedPoints([...selectedPoints, nodeName]);
      }
    } else if (activeTool === 'add_intersection') {
      if (nodeName) {
        if (selectedPoints.length < 3 && !selectedPoints.includes(nodeName)) {
          setSelectedPoints([...selectedPoints, nodeName]);
        } else if (selectedPoints.length === 3 && !selectedPoints.includes(nodeName)) {
          useEditorStore.getState().addIntersection(selectedPoints[0], selectedPoints[1], selectedPoints[2], nodeName);
          setSelectedPoints([]);
          useEditorStore.getState().setActiveTool('cursor');
        }
      }
    }
  }, []);

  const getSvgCoords = useCallback((clientX: number, clientY: number, overlaySvg: SVGSVGElement) => {
    const rect = overlaySvg.getBoundingClientRect();
    const vBox = overlaySvg.viewBox.baseVal;

    // With 1:1 natural sizing, scaling is solely driven by our CSS scale()
    // but getBoundingClientRect already accounts for it.
    // Actually, because we scale the wrapper, we can just use the inverse transform.
    // However, overlaySvg.viewBox.baseVal and rect.width give the exact ratio.
    const scaleSvgToScreen = rect.width / vBox.width;

    return {
      x: vBox.x + (clientX - rect.left) / scaleSvgToScreen,
      y: vBox.y + (clientY - rect.top) / scaleSvgToScreen
    };
  }, []);

  const getPointerWorldCoords = useCallback((
    clientX: number,
    clientY: number,
    overlaySvg: SVGSVGElement,
    options: { altKey?: boolean; excludePointName?: string | null } = {},
  ) => {
    if (!transform) return null;

    const svgP = getSvgCoords(clientX, clientY, overlaySvg);
    let newX = (svgP.x - transform.originX) / transform.scaleX;
    let newY = (transform.originY - svgP.y) / transform.scaleY;
    const { snapToGrid, settings } = useEditorStore.getState();

    if (snapToGrid && !options.altKey) {
      const rect = overlaySvg.getBoundingClientRect();
      const vBox = overlaySvg.viewBox.baseVal;
      const scaleSvgToScreen = rect.width / vBox.width;
      const snapRadius = 12 / (scaleSvgToScreen || 1);
      const worldToOverlayPoint = (point: { x: number; y: number }) => ({
        x: transform.originX + point.x * transform.scaleX,
        y: transform.originY - point.y * transform.scaleY,
      });
      const overlayToWorldPoint = (point: OverlayPoint) => ({
        x: (point.x - transform.originX) / transform.scaleX,
        y: (transform.originY - point.y) / transform.scaleY,
      });
      type SnapLine = {
        svgStart: OverlayPoint;
        svgEnd: OverlayPoint;
        worldStart: { x: number; y: number };
        worldEnd: { x: number; y: number };
        finite: boolean;
      };
      type SnapCircle = {
        svgCenter: OverlayPoint;
        worldCenter: { x: number; y: number };
        radius: number;
      };
      const snapLines: SnapLine[] = [];
      const snapCircles: SnapCircle[] = [];
      const addLineCandidate = (startName: string, endName: string, finite: boolean) => {
        const svgStart = overlayPointMap[startName];
        const svgEnd = overlayPointMap[endName];
        const worldStart = fastViewport.points.get(startName);
        const worldEnd = fastViewport.points.get(endName);
        if (!svgStart || !svgEnd || !worldStart || !worldEnd) return;
        if (Math.hypot(svgEnd.x - svgStart.x, svgEnd.y - svgStart.y) <= 0) return;
        snapLines.push({ svgStart, svgEnd, worldStart, worldEnd, finite });
      };
      const addCircleCandidate = (centerName: string, radiusName: string) => {
        const svgCenter = overlayPointMap[centerName];
        const worldCenter = fastViewport.points.get(centerName);
        const worldRadius = fastViewport.points.get(radiusName);
        if (!svgCenter || !worldCenter || !worldRadius) return;
        const radius = Math.hypot(worldRadius.x - worldCenter.x, worldRadius.y - worldCenter.y);
        if (radius <= 0) return;
        snapCircles.push({ svgCenter, worldCenter, radius });
      };
      const addPathEdges = (points: string[], closed: boolean) => {
        points.forEach((pointName, index) => {
          const nextName = points[index + 1] ?? (closed ? points[0] : null);
          if (nextName) addLineCandidate(pointName, nextName, true);
        });
      };

      parsedNodes.forEach(node => {
        if (node.type === 'Segment') addLineCandidate(node.p1, node.p2, true);
        else if (node.type === 'Segments') node.pairs.forEach(([p1, p2]) => addLineCandidate(p1, p2, true));
        else if (node.type === 'Line') addLineCandidate(node.p1, node.p2, false);
        else if (node.type === 'Lines') node.pairs.forEach(([p1, p2]) => addLineCandidate(p1, p2, false));
        else if (node.type === 'PolySeg') addPathEdges(node.points, false);
        else if (node.type === 'Polygon' || node.type === 'FillPolygon') addPathEdges(node.points, true);
        else if (node.type === 'Circle') addCircleCandidate(node.center, node.radius_point);
        else if (node.type === 'Circles') node.pairs.forEach(([center, radiusPoint]) => addCircleCandidate(center, radiusPoint));
        else if (node.type === 'FillCircle' && node.mode === 'radius') addCircleCandidate(node.center, node.radius);
      });

      const nearestLinePoint = (line: SnapLine) => {
        const dx = line.svgEnd.x - line.svgStart.x;
        const dy = line.svgEnd.y - line.svgStart.y;
        const lengthSquared = dx * dx + dy * dy;
        if (lengthSquared <= 0) return null;
        const rawT = ((svgP.x - line.svgStart.x) * dx + (svgP.y - line.svgStart.y) * dy) / lengthSquared;
        const t = line.finite ? Math.min(Math.max(rawT, 0), 1) : rawT;
        const svgPoint = { x: line.svgStart.x + dx * t, y: line.svgStart.y + dy * t };
        return { svgPoint, worldPoint: overlayToWorldPoint(svgPoint), distance: Math.hypot(svgPoint.x - svgP.x, svgPoint.y - svgP.y) };
      };
      const nearestCirclePoint = (circle: SnapCircle) => {
        const pointerWorld = { x: newX, y: newY };
        const dx = pointerWorld.x - circle.worldCenter.x;
        const dy = pointerWorld.y - circle.worldCenter.y;
        const length = Math.hypot(dx, dy);
        if (length <= 0) return null;
        const worldPoint = {
          x: circle.worldCenter.x + dx / length * circle.radius,
          y: circle.worldCenter.y + dy / length * circle.radius,
        };
        const svgPoint = worldToOverlayPoint(worldPoint);
        return { svgPoint, worldPoint, distance: Math.hypot(svgPoint.x - svgP.x, svgPoint.y - svgP.y) };
      };
      const lineIntersection = (first: SnapLine, second: SnapLine) => {
        const x1 = first.worldStart.x;
        const y1 = first.worldStart.y;
        const x2 = first.worldEnd.x;
        const y2 = first.worldEnd.y;
        const x3 = second.worldStart.x;
        const y3 = second.worldStart.y;
        const x4 = second.worldEnd.x;
        const y4 = second.worldEnd.y;
        const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denominator) <= 1e-9) return null;
        const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator;
        const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator;
        const inRange = (value: number, start: number, end: number) => value >= Math.min(start, end) - 1e-6 && value <= Math.max(start, end) + 1e-6;
        if (first.finite && (!inRange(px, x1, x2) || !inRange(py, y1, y2))) return null;
        if (second.finite && (!inRange(px, x3, x4) || !inRange(py, y3, y4))) return null;
        return { x: px, y: py };
      };
      const lineCircleIntersections = (line: SnapLine, circle: SnapCircle) => {
        const dx = line.worldEnd.x - line.worldStart.x;
        const dy = line.worldEnd.y - line.worldStart.y;
        const fx = line.worldStart.x - circle.worldCenter.x;
        const fy = line.worldStart.y - circle.worldCenter.y;
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - circle.radius * circle.radius;
        const discriminant = b * b - 4 * a * c;
        if (a <= 0 || discriminant < -1e-9) return [];
        const root = Math.sqrt(Math.max(discriminant, 0));
        return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
          .filter((t, index, values) => (!line.finite || (t >= -1e-6 && t <= 1 + 1e-6)) && values.findIndex(item => Math.abs(item - t) < 1e-9) === index)
          .map(t => ({ x: line.worldStart.x + dx * t, y: line.worldStart.y + dy * t }));
      };
      const circleCircleIntersections = (first: SnapCircle, second: SnapCircle) => {
        const dx = second.worldCenter.x - first.worldCenter.x;
        const dy = second.worldCenter.y - first.worldCenter.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 1e-9 || distance > first.radius + second.radius + 1e-9 || distance < Math.abs(first.radius - second.radius) - 1e-9) return [];
        const a = (first.radius * first.radius - second.radius * second.radius + distance * distance) / (2 * distance);
        const hSquared = first.radius * first.radius - a * a;
        if (hSquared < -1e-9) return [];
        const h = Math.sqrt(Math.max(hSquared, 0));
        const baseX = first.worldCenter.x + a * dx / distance;
        const baseY = first.worldCenter.y + a * dy / distance;
        const offsetX = -dy / distance * h;
        const offsetY = dx / distance * h;
        const intersections = [{ x: baseX + offsetX, y: baseY + offsetY }];
        if (h > 1e-9) intersections.push({ x: baseX - offsetX, y: baseY - offsetY });
        return intersections;
      };
      const nearestWorldCandidate = (worldPoint: { x: number; y: number }) => {
        const svgPoint = worldToOverlayPoint(worldPoint);
        return { svgPoint, worldPoint, distance: Math.hypot(svgPoint.x - svgP.x, svgPoint.y - svgP.y) };
      };
      const chooseClosest = (candidates: Array<{ worldPoint: { x: number; y: number }; distance: number } | null>) => (
        candidates.reduce<{ worldPoint: { x: number; y: number }; distance: number } | null>((best, candidate) => {
          if (!candidate || candidate.distance > snapRadius) return best;
          return !best || candidate.distance < best.distance ? candidate : best;
        }, null)
      );
      let closestName: string | null = null;
      let closestDistance = Infinity;

      Object.entries(overlayPointMap).forEach(([name, point]) => {
        if (name === options.excludePointName) return;
        const distance = Math.hypot(point.x - svgP.x, point.y - svgP.y);
        if (distance <= snapRadius && distance < closestDistance) {
          closestName = name;
          closestDistance = distance;
        }
      });

      if (closestName) {
        const snappedPoint = fastViewport.points.get(closestName);
        if (snappedPoint) {
          newX = snappedPoint.x;
          newY = snappedPoint.y;
        }
      } else {
        const intersectionCandidates = [
          ...snapLines.flatMap((line, lineIndex) => snapLines.slice(lineIndex + 1).map(otherLine => lineIntersection(line, otherLine)).filter(Boolean).map(point => nearestWorldCandidate(point!))),
          ...snapLines.flatMap(line => snapCircles.flatMap(circle => lineCircleIntersections(line, circle).map(nearestWorldCandidate))),
          ...snapCircles.flatMap((circle, circleIndex) => snapCircles.slice(circleIndex + 1).flatMap(otherCircle => circleCircleIntersections(circle, otherCircle).map(nearestWorldCandidate))),
        ];
        const shapeCandidates = [
          ...snapLines.map(nearestLinePoint),
          ...snapCircles.map(nearestCirclePoint),
        ];
        const closestIntersection = chooseClosest(intersectionCandidates);
        const closestShape = chooseClosest(shapeCandidates);
        const geometrySnap = closestIntersection ?? closestShape;
        if (geometrySnap) {
          newX = geometrySnap.worldPoint.x;
          newY = geometrySnap.worldPoint.y;
        } else {
          newX = snapCoordinate(newX, settings.snapStep);
          newY = snapCoordinate(newY, settings.snapStep);
        }
      }
    }

    return {
      x: Math.round(newX * 100) / 100,
      y: Math.round(newY * 100) / 100,
    };
  }, [fastViewport.points, getSvgCoords, overlayPointMap, transform]);

  const beginPan = useCallback((clientX: number, clientY: number) => {
    if (isPanningRef.current) return;

    cancelActiveInteraction();
    beginStoicheiaFrameInteraction('pan');
    isPanningRef.current = true;
    setIsPanning(true);
    lastMouseRef.current = { x: clientX, y: clientY };
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';

    let panFrame: number | null = null;
    let pendingDx = 0;
    let pendingDy = 0;
    let finished = false;
    const flushPan = () => {
      panFrame = null;
      if (pendingDx === 0 && pendingDy === 0) return;
      const dx = pendingDx;
      const dy = pendingDy;
      pendingDx = 0;
      pendingDy = 0;
      recordStoicheiaInteractionFrame('pan');
      setPan(currentPan => ({ x: currentPan.x + dx, y: currentPan.y + dy }));
    };

    const onPanMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - lastMouseRef.current.x;
      const dy = moveEvent.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      pendingDx += dx;
      pendingDy += dy;
      if (panFrame === null) panFrame = window.requestAnimationFrame(flushPan);
    };

    const finishPan = (commit: boolean, updateState: boolean) => {
      if (finished) return;
      finished = true;
      if (panFrame !== null) window.cancelAnimationFrame(panFrame);
      panFrame = null;
      if (commit) flushPan();
      isPanningRef.current = false;
      if (updateState) setIsPanning(false);
      document.body.style.cursor = previousCursor;
      window.removeEventListener('mousemove', onPanMove);
      window.removeEventListener('mouseup', onPanEnd);
      window.removeEventListener('blur', onPanCancel);
      if (interactionCleanupRef.current === cancelPan) {
        interactionCleanupRef.current = null;
      }
      endStoicheiaFrameInteraction('pan');
    };
    const onPanEnd = () => finishPan(true, true);
    const onPanCancel = () => finishPan(false, true);
    const cancelPan = (updateState: boolean) => finishPan(false, updateState);

    window.addEventListener('mousemove', onPanMove);
    window.addEventListener('mouseup', onPanEnd);
    window.addEventListener('blur', onPanCancel);
    interactionCleanupRef.current = cancelPan;
  }, [cancelActiveInteraction, setPan]);

  const handlePointClick = useCallback((e: ReactMouseEvent, nodeName: string, nodeId?: string) => {
    e.stopPropagation();

    const { activeTool, setSelectedNode, setSelectedPoints } = useEditorStore.getState();

    if (e.button === 1 || e.button === 2 || spacePressed || activeTool === 'pan') {
      e.preventDefault();
      beginPan(e.clientX, e.clientY);
      return;
    }

    if (e.button !== 0) return;

    if (activeTool === 'cursor') {
      if (nodeId) setSelectedNode(nodeId);
      setSelectedPoints([]);
      const overlaySvg = (e.currentTarget as SVGElement).ownerSVGElement as SVGSVGElement | null;
      if (!overlaySvg || !transform) return;
      const originalPoint = parsedNodes.find(node => node.type === 'Point' && node.name === nodeName);
      if (!originalPoint || originalPoint.type !== 'Point') {
        return;
      }

      cancelActiveInteraction();
      beginStoicheiaFrameInteraction('drag');
      const previousCursor = document.body.style.cursor;
      document.body.style.cursor = 'move';

      let dragFrame: number | null = null;
      let pendingMove: {
        clientX: number;
        clientY: number;
        altKey: boolean;
        shiftKey: boolean;
      } | null = null;
      let pendingCoords: { x: number; y: number } | null = null;
      let finished = false;
      const commitPointDrag = () => {
        if (!pendingCoords) return;
        const { x, y } = pendingCoords;
        pendingCoords = null;
        useEditorStore.getState().updatePointCoords(nodeName, x, y);
      };

      const flushPointDragPreview = () => {
        dragFrame = null;
        const move = pendingMove;
        pendingMove = null;
        if (!move) return;
        recordStoicheiaInteractionFrame('drag');

        const pointerCoords = getPointerWorldCoords(move.clientX, move.clientY, overlaySvg, {
          altKey: move.altKey,
          excludePointName: nodeName,
        });
        if (!pointerCoords) return;

        let newX = pointerCoords.x;
        let newY = pointerCoords.y;

        if (move.shiftKey) {
          const dx = newX - originalPoint.x;
          const dy = newY - originalPoint.y;
          if (Math.abs(dx) >= Math.abs(dy)) {
            newY = originalPoint.y;
          } else {
            newX = originalPoint.x;
          }
        }

        newX = Math.round(newX * 100) / 100;
        newY = Math.round(newY * 100) / 100;
        setDragPreviewPoint({ name: nodeName, x: newX, y: newY });
        pendingCoords = { x: newX, y: newY };
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        pendingMove = {
          clientX: moveEvent.clientX,
          clientY: moveEvent.clientY,
          altKey: moveEvent.altKey,
          shiftKey: moveEvent.shiftKey,
        };
        if (dragFrame === null) {
          dragFrame = window.requestAnimationFrame(flushPointDragPreview);
        }
      };

      const finishPointDrag = (commit: boolean, updateState: boolean) => {
        if (finished) return;
        finished = true;
        if (dragFrame !== null) window.cancelAnimationFrame(dragFrame);
        dragFrame = null;
        if (commit) {
          flushPointDragPreview();
          commitPointDrag();
        } else {
          pendingMove = null;
          pendingCoords = null;
        }
        if (updateState) {
          setDragPreviewPoint(null);
        }
        document.body.style.cursor = previousCursor;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('blur', onMouseCancel);
        if (interactionCleanupRef.current === cancelPointDrag) {
          interactionCleanupRef.current = null;
        }
        endStoicheiaFrameInteraction('drag');
      };
      const onMouseUp = () => finishPointDrag(true, true);
      const onMouseCancel = () => finishPointDrag(false, true);
      const cancelPointDrag = (updateState: boolean) => finishPointDrag(false, updateState);

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('blur', onMouseCancel);
      interactionCleanupRef.current = cancelPointDrag;
    } else {
      processToolAction(nodeName);
    }
  }, [beginPan, cancelActiveInteraction, getPointerWorldCoords, parsedNodes, processToolAction, spacePressed, transform]);

  const handleSegmentClick = useCallback((e: ReactMouseEvent, p1: string, p2: string, nodeId: string) => {
    e.stopPropagation();
    const { activeTool, setSelectedNode, setSelectedPoints } = useEditorStore.getState();
    if (activeTool === 'cursor') {
      setSelectedNode(nodeId);
      setSelectedPoints([]);
    } else if (activeTool === 'add_intersection') {
      processToolAction(p1);
      processToolAction(p2);
    } else if (activeTool === 'add_perpendicular' || activeTool === 'add_projection') {
      setSelectedPoints([p1, p2]);
    } else if (activeTool === 'add_perpendicular_bisector') {
      useEditorStore.getState().addPerpendicularBisector(p1, p2);
      setSelectedPoints([]);
      useEditorStore.getState().setActiveTool('cursor');
    }
  }, [processToolAction]);

  const handleObjectClick = useCallback((e: ReactMouseEvent, nodeId: string) => {
    e.stopPropagation();

    const { activeTool, setSelectedNode, setSelectedPoints } = useEditorStore.getState();

    if (e.button === 1 || e.button === 2 || spacePressed || activeTool === 'pan') {
      e.preventDefault();
      beginPan(e.clientX, e.clientY);
      return;
    }

    if (e.button !== 0 || activeTool !== 'cursor') return;

    setSelectedNode(nodeId);
    setSelectedPoints([]);
  }, [beginPan, spacePressed]);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    useEditorStore.getState().setHoveredNode(nodeId);
  }, []);


  const handleContainerMouseDown = (e: ReactMouseEvent) => {
    const currentTool = useEditorStore.getState().activeTool;
    const shouldPan =
      e.button === 1 ||
      e.button === 2 ||
      (e.button === 0 && (spacePressed || currentTool === 'pan'));

    if (shouldPan) {
      e.preventDefault();
      beginPan(e.clientX, e.clientY);
      return;
    }

    if (e.button === 0 && currentTool === 'cursor') {
      const state = useEditorStore.getState();
      state.setSelectedNode(null);
      state.setSelectedPoints([]);
      return;
    }

    if (e.button === 0) {
      handleCanvasAction(e);
    }
  };

  const handleCanvasAction = (e: ReactMouseEvent) => {
    if (isPanningRef.current || spacePressed) return;

    const { activeTool } = useEditorStore.getState();
    if (activeTool === 'cursor' || activeTool === 'pan') return;
    if (!transform || !containerRef.current) return;

    const overlaySvg = containerRef.current.querySelector('svg.pointer-events-none') as SVGSVGElement;
    if (!overlaySvg) return;

    const pointerCoords = getPointerWorldCoords(e.clientX, e.clientY, overlaySvg, { altKey: e.altKey });
    if (!pointerCoords) return;

    processToolAction(null, pointerCoords.x, pointerCoords.y);
  };

  const handleContainerMouseMove = (e: ReactMouseEvent) => {
    if (isPanningRef.current || spacePressed) return;

    const { activeTool, selectedPoints } = useEditorStore.getState();
    if (activeTool === 'cursor' || activeTool === 'pan' || selectedPoints.length === 0) {
      setConstructionPreviewPoint(null);
      return;
    }
    if (!transform || !containerRef.current) return;

    const overlaySvg = containerRef.current.querySelector('svg.pointer-events-none') as SVGSVGElement;
    if (!overlaySvg) return;

    const pointerCoords = getPointerWorldCoords(e.clientX, e.clientY, overlaySvg, { altKey: e.altKey });
    if (!pointerCoords) return;

    const nextPoint = {
      x: transform.originX + pointerCoords.x * transform.scaleX,
      y: transform.originY - pointerCoords.y * transform.scaleY,
    };
    setConstructionPreviewPoint(previous => (
      previous && Math.abs(previous.x - nextPoint.x) < 0.001 && Math.abs(previous.y - nextPoint.y) < 0.001
        ? previous
        : nextPoint
    ));
  };

  const handleContainerMouseLeave = () => {
    setConstructionPreviewPoint(null);
  };

  const [minX, minY, vbWidth, vbHeight] = useMemo(
    () => viewBox ? viewBox.split(' ').map(parseFloat) : [0, 0, 0, 0],
    [viewBox],
  );

  const svgStyle = useMemo<CSSProperties>(() => ({
    // Size the SVG at its final zoomed viewport instead of scaling an already
    // rasterized layer. WebKitGTK otherwise upscales the composited SVG texture
    // and makes the instant canvas visibly pixelated.
    width: `${vbWidth * zoomLevel}px`,
    height: `${vbHeight * zoomLevel}px`,
    marginLeft: transform ? `${-(transform.originX - minX) * zoomLevel}px` : '0px',
    marginTop: transform ? `${-(transform.originY - minY) * zoomLevel}px` : '0px',
    overflow: 'visible',
  }), [minX, minY, transform, vbHeight, vbWidth, zoomLevel]);

  const visibleWorldBounds = useMemo<CanvasWorldBounds>(() => {
    if (!transform || canvasSize.width <= 0 || canvasSize.height <= 0) {
      return { minX: -50, maxX: 50, minY: -50, maxY: 50 };
    }
    const scaleX = Math.max(Math.abs(transform.scaleX) * zoomLevel, 1e-6);
    const scaleY = Math.max(Math.abs(transform.scaleY) * zoomLevel, 1e-6);
    const halfWidth = canvasSize.width / 2;
    const halfHeight = canvasSize.height / 2;
    const padding = Math.max(canvasGridStep, 0.25) * 2;
    return {
      minX: (-halfWidth - pan.x) / scaleX - padding,
      maxX: (halfWidth - pan.x) / scaleX + padding,
      minY: (pan.y - halfHeight) / scaleY - padding,
      maxY: (pan.y + halfHeight) / scaleY + padding,
    };
  }, [canvasGridStep, canvasSize.height, canvasSize.width, pan.x, pan.y, transform, zoomLevel]);

  const handleWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    pendingWheelRef.current.deltaY += e.deltaY;
    pendingWheelRef.current.clientX = e.clientX;
    pendingWheelRef.current.clientY = e.clientY;
    if (wheelFrameRef.current !== null) return;

    wheelFrameRef.current = window.requestAnimationFrame(() => {
      wheelFrameRef.current = null;
      recordStoicheiaInteractionFrame('zoom', 220);
      const pending = pendingWheelRef.current;
      pendingWheelRef.current = { deltaY: 0, clientX: pending.clientX, clientY: pending.clientY };
      const state = useEditorStore.getState();
      const zoomFactor = Math.exp(-pending.deltaY * 0.0015);
      const nextZoom = Math.min(Math.max(0.1, state.zoomLevel * zoomFactor), 5);
      if (nextZoom === state.zoomLevel || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const dx = pending.clientX - (rect.left + rect.width / 2);
      const dy = pending.clientY - (rect.top + rect.height / 2);
      const localX = (dx - state.pan.x) / state.zoomLevel;
      const localY = (dy - state.pan.y) / state.zoomLevel;
      state.setCanvasView({
        zoomLevel: nextZoom,
        pan: {
          x: dx - localX * nextZoom,
          y: dy - localY * nextZoom,
        },
      });
    });
  };

  const canvasCursor = isPanning
    ? 'cursor-grabbing'
    : spacePressed || activeTool === 'pan'
      ? 'cursor-grab'
      : activeTool === 'cursor'
        ? 'cursor-default'
        : 'cursor-crosshair';
  const hasPreview = previewMode === 'instant' ? parsedNodes.length > 0 : Boolean(svgOutput);
  const sceneReady = Boolean(viewBox && transform);

  useLayoutEffect(() => {
    // The canvas surface itself is the first usable Graphics Studio paint.
    // Waiting for a non-empty scene included user think/drawing time in this
    // metric and made the first-open measurement meaningless.
    markStoicheiaFirstCanvasCommit();
  }, []);

  return (
    <div
      className={`canvas-surface w-full h-full relative overflow-hidden flex flex-col items-center justify-center select-none ${canvasCursor}`}
      ref={containerRef}
      tabIndex={shortcutScope === 'canvas' ? 0 : undefined}
      onMouseDown={(event) => {
        if (shortcutScope === 'canvas') {
          containerRef.current?.focus({ preventScroll: true });
        }
        handleContainerMouseDown(event);
      }}
      onMouseMove={handleContainerMouseMove}
      onMouseLeave={handleContainerMouseLeave}
      onDoubleClick={event => {
        if ((event.target as Element).closest?.('circle')) completeCollectionDrawing(true);
      }}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <CollectionToolTip activeTool={activeTool} selectedPoints={selectedPoints} />
      <PreviewDiagnosticsLayer
        isCompiling={isCompiling}
        previewMode={previewMode}
        errorLog={errorLog}
        latexDiagnostics={latexDiagnostics}
      />

      {previewMode === 'latex' && errorLog ? null : hasPreview ? (
        <PreviewSceneFrame
          pan={pan}
          sceneStyle={svgStyle}
          sceneReady={sceneReady}
        >
          <PreviewArtworkLayer
            previewMode={previewMode}
            fastRenderScene={fastRenderScene}
            svgOutput={svgOutput}
          />

            {/* Interactive Overlay */}
            {viewBox && transform && (
              <InteractionOverlayFrame viewBox={viewBox}>
                <GridOverlayLayer
                  showGrid={showGrid}
                  showAxes={showAxes}
                  showAxisTicks={axisSettings.showAxisTicks}
                  showAxisLabels={axisSettings.showAxisLabels}
                  axisLineWidth={axisSettings.axisLineWidth}
                  axisTickSize={axisSettings.axisTickSize}
                  axisLabelFontSize={axisSettings.axisLabelFontSize}
                  axisLabelSpacing={axisSettings.axisLabelSpacing}
                  canvasGridStep={canvasGridStep}
                  transform={transform}
                  zoomLevel={zoomLevel}
                  visibleBounds={visibleWorldBounds}
                />
                <ConstructionPreviewLayer
                  activeTool={activeTool}
                  selectedPoints={selectedPoints}
                  pointMap={overlayPointMap}
                  previewPoint={constructionPreviewPoint}
                />
                <ShapeHitTargetsLayer
                  parsedNodes={parsedNodes}
                  pointMap={overlayPointMap}
                  activeTool={activeTool}
                  onObjectMouseDown={handleObjectClick}
                  onSegmentMouseDown={handleSegmentClick}
                  onNodeHover={handleNodeHover}
                />
                <HoverHighlightLayer
                  hoveredNode={hoveredNode}
                  pointMap={overlayPointMap}
                  parsedNodes={parsedNodes}
                />
                <MeasurementOverlayLayer
                  showMeasurements={showMeasurements}
                  selectedNode={selectedNode}
                  hoveredNode={hoveredNode}
                  parsedNodes={parsedNodes}
                  pointMap={overlayPointMap}
                  worldPoints={fastViewport.points}
                />
                <PointHandlesLayer
                  showHandles={showHandles}
                  parsedNodes={parsedNodes}
                  pointMap={overlayPointMap}
                  activeTool={activeTool}
                  selectedPoints={selectedPoints}
                  onPointMouseDown={handlePointClick}
                  onNodeHover={handleNodeHover}
                />
              </InteractionOverlayFrame>
            )}
        </PreviewSceneFrame>
      ) : (
        <EmptyPreviewState />
      )}
    </div>
  );
}
