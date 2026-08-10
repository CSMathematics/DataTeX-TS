import { Activity, Box, MousePointer2, ZoomIn } from 'lucide-react';
import { useEditorStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useEffect, useRef } from 'react';
import {
  clearStoicheiaHostStatus,
  publishStoicheiaHostStatus,
} from '../../../stores/stoicheiaHostStatus';
import {
  recordStoicheiaExactCompile,
  recordStoicheiaParseRoundTrip,
  recordStoicheiaRenderer,
} from '../../../utils/stoicheiaRuntimePerformance';

const humanizeTool = (tool: string) => {
  if (tool === 'cursor') return 'Select';
  if (tool === 'pan') return 'Pan';
  if (tool === 'add_point_polar') return 'Polar Point';
  return tool.replace(/^add_/, '').replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase());
};

const formatMs = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return value < 10 ? `${value.toFixed(1)}ms` : `${Math.round(value)}ms`;
};

export function StatusBar({ mode = 'standalone' }: { mode?: 'standalone' | 'embedded' }) {
  const {
    activeTool,
    zoomLevel,
    parsedNodeCount,
    snapToGrid,
    performanceMetrics,
    isCompiling,
    errorLog,
    previewMode,
    source,
    parsedSource,
    compiledSource,
    svgOutput,
    latexCompiler,
  } = useEditorStore(useShallow(state => ({
    activeTool: state.activeTool,
    zoomLevel: state.zoomLevel,
    parsedNodeCount: state.parsedNodes.length,
    snapToGrid: state.snapToGrid,
    performanceMetrics: state.performanceMetrics,
    isCompiling: state.isCompiling,
    errorLog: state.errorLog,
    previewMode: state.previewMode,
    source: state.source,
    parsedSource: state.parsedSource,
    compiledSource: state.compiledSource,
    svgOutput: state.svgOutput,
    latexCompiler: state.settings.latexCompiler,
  })));
  const wasCompilingRef = useRef(false);
  const compileMetricAtStartRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (mode !== 'embedded') return undefined;
    publishStoicheiaHostStatus({
      activeTool,
      zoomLevel,
      parsedNodeCount,
      snapToGrid,
      performanceMetrics,
      isCompiling,
      hasCompileError: Boolean(errorLog),
      previewMode,
    });
    return undefined;
  }, [
    activeTool,
    errorLog,
    isCompiling,
    mode,
    parsedNodeCount,
    performanceMetrics,
    previewMode,
    snapToGrid,
    zoomLevel,
  ]);

  useEffect(() => {
    if (mode !== 'embedded') return undefined;
    return clearStoicheiaHostStatus;
  }, [mode]);

  useEffect(() => {
    if (mode !== 'embedded' || performanceMetrics?.rendererMs === undefined) {
      return;
    }
    recordStoicheiaRenderer(performanceMetrics.rendererMs);
  }, [mode, performanceMetrics?.rendererMs]);

  useEffect(() => {
    if (
      mode === 'embedded'
      && parsedSource
      && performanceMetrics?.parseRoundTripMs !== undefined
    ) {
      recordStoicheiaParseRoundTrip(performanceMetrics.parseRoundTripMs);
    }
  }, [mode, parsedSource]);

  useEffect(() => {
    const wasCompiling = wasCompilingRef.current;
    wasCompilingRef.current = isCompiling;
    if (!wasCompiling && isCompiling) {
      compileMetricAtStartRef.current = performanceMetrics?.compileRoundTripMs;
      return;
    }
    if (
      mode !== 'embedded'
      || !wasCompiling
      || isCompiling
      || performanceMetrics?.compileRoundTripMs === undefined
      || performanceMetrics.compileRoundTripMs === compileMetricAtStartRef.current
    ) {
      return;
    }
    recordStoicheiaExactCompile(
      performanceMetrics.compileRoundTripMs,
      source,
      latexCompiler,
      compiledSource === source && Boolean(svgOutput) && !errorLog,
    );
  }, [
    compiledSource,
    errorLog,
    isCompiling,
    latexCompiler,
    mode,
    performanceMetrics?.compileRoundTripMs,
    source,
    svgOutput,
  ]);

  if (mode === 'embedded') return null;
  const perfTitle = performanceMetrics ? [
    `Parse round-trip: ${formatMs(performanceMetrics.parseRoundTripMs)}`,
    `Rust parse: ${formatMs(performanceMetrics.parseMs)}`,
    `Rust geometry: ${formatMs(performanceMetrics.geometryMs)}`,
    `Rust viewport: ${formatMs(performanceMetrics.viewportMs)}`,
    `TS viewport: ${formatMs(performanceMetrics.viewportBuildMs)}`,
    `Renderer: ${formatMs(performanceMetrics.rendererMs)}`,
    `Compile round-trip: ${formatMs(performanceMetrics.compileRoundTripMs)}`,
  ].join('\n') : '';

  return (
    <footer className="status-bar shrink-0 border-t">
      <div className="status-item">
        <MousePointer2 size={12} />
        {humanizeTool(activeTool)}
      </div>
      <div className="status-item">
        <Box size={12} />
        {parsedNodeCount} objects
      </div>
      <div className="status-item">
        <ZoomIn size={12} />
        {Math.round(zoomLevel * 100)}%
      </div>
      <div className="status-spacer flex items-center gap-3">
        {performanceMetrics && (
          <span title={perfTitle} className="status-item status-item-muted hidden lg:flex">
            <Activity size={12} />
            P {formatMs(performanceMetrics.parseRoundTripMs)} · G {formatMs(performanceMetrics.geometryMs)} · R {formatMs(performanceMetrics.rendererMs)}
          </span>
        )}
        <span className={snapToGrid ? 'status-item-active' : 'status-item-muted'}>Snap {snapToGrid ? 'on' : 'off'}</span>
        <span className="status-item-muted hidden sm:inline">tkz-euclide</span>
      </div>
    </footer>
  );
}
