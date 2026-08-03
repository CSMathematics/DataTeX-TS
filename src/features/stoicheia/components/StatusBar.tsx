import { Activity, Box, MousePointer2, ZoomIn } from 'lucide-react';
import { useEditorStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

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

export function StatusBar() {
  const { activeTool, zoomLevel, parsedNodeCount, snapToGrid, performanceMetrics } = useEditorStore(useShallow(state => ({
    activeTool: state.activeTool,
    zoomLevel: state.zoomLevel,
    parsedNodeCount: state.parsedNodes.length,
    snapToGrid: state.snapToGrid,
    performanceMetrics: state.performanceMetrics,
  })));
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
